//! Frame rate of the app in front, for the notch's FPS widget.
//!
//! A real-time ETW session listens for the present calls the Direct3D 9 and DXGI
//! (Direct3D 10, 11 and 12) runtimes report, the same events PresentMon counts. Nothing is
//! injected into games. Windows only lets elevated processes and members of the built-in
//! Performance Log Users group start an ETW session, so `request_fps_access` adds the user to
//! that group once, behind a UAC prompt, by relaunching kairo.exe with `fps-grant <sid>`.
//! Windows applies group changes at the next sign-in.
//!
//! The session only runs while something asks for stats, and stops itself after
//! `IDLE_STOP_MS` without a request.

use std::collections::{HashMap, VecDeque};
use std::os::windows::ffi::OsStrExt;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::AppHandle;
use windows::core::{w, BOOL, GUID, HRESULT, PCWSTR, PWSTR};
use windows::Win32::Foundation::{
    CloseHandle, LocalFree, ERROR_ALREADY_EXISTS, ERROR_CANCELLED, ERROR_MEMBER_IN_ALIAS, ERROR_SUCCESS, HANDLE, HLOCAL,
};
use windows::Win32::Security::Authorization::{ConvertSidToStringSidW, ConvertStringSidToSidW};
use windows::Win32::Security::{CheckTokenMembership, PSID};
use windows::Win32::System::Diagnostics::Etw::{
    CloseTrace, ControlTraceW, EnableTraceEx2, OpenTraceW, ProcessTrace, StartTraceW, CONTROLTRACE_HANDLE,
    EVENT_CONTROL_CODE_ENABLE_PROVIDER, EVENT_RECORD, EVENT_TRACE_CONTROL_STOP, EVENT_TRACE_LOGFILEW,
    EVENT_TRACE_PROPERTIES, EVENT_TRACE_REAL_TIME_MODE, PROCESS_TRACE_MODE_EVENT_RECORD, PROCESS_TRACE_MODE_REAL_TIME,
    TRACE_LEVEL_INFORMATION, WNODE_FLAG_TRACED_GUID,
};

const SESSION_NAME: &str = "KairoFrameCounter";
const GRANT_ARG: &str = "fps-grant";
const ACCESS_SETTING: &str = "kairo-fps-access-requested";

const DXGI_PROVIDER: GUID = GUID::from_u128(0xca11c036_0102_4a2d_a6ad_f03cfed5d3c9);
const D3D9_PROVIDER: GUID = GUID::from_u128(0x783aca0a_790e_4d7f_8451_aa850511c6b9);
const DXGI_PRESENT_START: u16 = 42;
const DXGI_PRESENT_MULTIPLANE_START: u16 = 55;
const D3D9_PRESENT_START: u16 = 1;

const PERFORMANCE_LOG_USERS: PCWSTR = w!("S-1-5-32-559");
const ADMINISTRATORS: PCWSTR = w!("S-1-5-32-544");

/// ETW timestamps are FILETIME ticks of 100 ns.
const TICKS_PER_SECOND: i64 = 10_000_000;
const HISTORY_TICKS: i64 = 5 * TICKS_PER_SECOND;
const MAX_FRAMES: usize = 5_000;
/// Real-time buffers are flushed once a second, so frames arrive up to a second late.
const STALE_AFTER: Duration = Duration::from_secs(3);
const FORGET_AFTER: Duration = Duration::from_secs(10);
const IDLE_STOP_MS: i64 = 15_000;
/// Fewer frames than this in the history and the 1% low is just noise.
const MIN_FRAMES_FOR_LOW: usize = 100;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FpsStats {
    /// "granted", "signout" (approved, waiting for the next sign-in) or "needs-access".
    pub access: String,
    pub fps: Option<f32>,
    pub frame_time_ms: Option<f32>,
    pub low_fps: Option<f32>,
    pub app: Option<String>,
    pub error: Option<String>,
}

#[derive(Default)]
struct Track {
    times: VecDeque<i64>,
    last_arrival: Option<Instant>,
}

#[derive(Debug, PartialEq)]
struct FrameStats {
    fps: f32,
    frame_time_ms: f32,
    low_fps: Option<f32>,
}

static RUNNING: AtomicBool = AtomicBool::new(false);
static WATCHDOG: AtomicBool = AtomicBool::new(false);
static LAST_WANTED_MS: AtomicI64 = AtomicI64::new(0);
static START_LOCK: Mutex<()> = Mutex::new(());
static HAS_ACCESS: OnceLock<bool> = OnceLock::new();
static APP_NAME: Mutex<Option<(u32, String)>> = Mutex::new(None);
static TRACKS: OnceLock<Mutex<HashMap<(u32, u8), Track>>> = OnceLock::new();

fn tracks() -> &'static Mutex<HashMap<(u32, u8), Track>> {
    TRACKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

// ---- Commands -------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_fps_stats(app: AppHandle) -> FpsStats {
    tauri::async_runtime::spawn_blocking(move || stats(&app)).await.unwrap_or_default()
}

#[tauri::command]
pub fn get_fps_access(app: AppHandle) -> String {
    access_state(&app).to_string()
}

#[tauri::command]
pub async fn request_fps_access(app: AppHandle) -> Result<String, String> {
    if has_access() {
        return Ok("granted".into());
    }
    tauri::async_runtime::spawn_blocking(request_access).await.map_err(|e| e.to_string())??;
    crate::commands::save_setting(app.clone(), ACCESS_SETTING.into(), serde_json::Value::String("true".into()))?;
    Ok(access_state(&app).to_string())
}

/// Stops the session so it doesn't outlive Kairo. Safe to call when nothing is running.
pub fn shutdown() {
    if RUNNING.load(Ordering::Acquire) {
        stop_session();
    }
}

// ---- Access ---------------------------------------------------------------------------------

fn token_has(sid: PCWSTR) -> bool {
    unsafe {
        let mut psid = PSID::default();
        if ConvertStringSidToSidW(sid, &mut psid).is_err() {
            return false;
        }
        let mut member = BOOL(0);
        let checked = CheckTokenMembership(None, psid, &mut member).is_ok();
        let _ = LocalFree(Some(HLOCAL(psid.0)));
        checked && member.as_bool()
    }
}

/// Group membership is fixed for the life of a logon token, so this is checked once.
fn has_access() -> bool {
    *HAS_ACCESS.get_or_init(|| token_has(PERFORMANCE_LOG_USERS) || token_has(ADMINISTRATORS))
}

fn access_state(app: &AppHandle) -> &'static str {
    if has_access() {
        "granted"
    } else if crate::utils::get_setting_str(app, ACCESS_SETTING).as_deref() == Some("true") {
        "signout"
    } else {
        "needs-access"
    }
}

fn current_user_sid() -> Option<String> {
    use windows::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).ok()?;
        let mut len = 0u32;
        let _ = GetTokenInformation(token, TokenUser, None, 0, &mut len);
        let mut buffer = vec![0u64; (len as usize).div_ceil(8).max(1)];
        let read = GetTokenInformation(token, TokenUser, Some(buffer.as_mut_ptr() as *mut _), len, &mut len);
        let _ = CloseHandle(token);
        read.ok()?;
        let user = &*(buffer.as_ptr() as *const TOKEN_USER);
        let mut text = PWSTR::null();
        ConvertSidToStringSidW(user.User.Sid, &mut text).ok()?;
        let sid = text.to_string().ok();
        let _ = LocalFree(Some(HLOCAL(text.0 as *mut _)));
        sid
    }
}

/// Relaunches kairo.exe elevated to add this user to Performance Log Users, and waits for it.
fn request_access() -> Result<(), String> {
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let sid = current_user_sid().ok_or("could not read the current account")?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_w: Vec<u16> = exe.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let params = wide(&format!("{GRANT_ARG} {sid}"));
    unsafe {
        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
            lpVerb: w!("runas"),
            lpFile: PCWSTR(exe_w.as_ptr()),
            lpParameters: PCWSTR(params.as_ptr()),
            nShow: SW_HIDE.0,
            ..Default::default()
        };
        if let Err(e) = ShellExecuteExW(&mut info) {
            if e.code() == HRESULT::from_win32(ERROR_CANCELLED.0) {
                return Err("cancelled".into());
            }
            return Err(e.message());
        }
        if info.hProcess.is_invalid() {
            return Err("the approval process did not start".into());
        }
        let _ = WaitForSingleObject(info.hProcess, INFINITE);
        let mut code = 1u32;
        let _ = GetExitCodeProcess(info.hProcess, &mut code);
        let _ = CloseHandle(info.hProcess);
        if code == 0 {
            Ok(())
        } else {
            crate::diagnostics::log(&format!("fps: grant failed with code {code}"));
            Err(format!("Windows returned error {code}"))
        }
    }
}

fn is_sid_string(text: &str) -> bool {
    text.len() < 200 && text.starts_with("S-1-") && text[2..].chars().all(|c| c.is_ascii_digit() || c == '-')
}

/// `kairo.exe fps-grant <sid>`, run elevated by `request_access`. Returns the exit code.
pub fn run_cli(args: &[String]) -> Option<i32> {
    if args.get(1).map(String::as_str) != Some(GRANT_ARG) {
        return None;
    }
    Some(match args.get(2) {
        Some(sid) if is_sid_string(sid) => grant(sid),
        _ => 2,
    })
}

fn grant(user_sid: &str) -> i32 {
    use windows::Win32::NetworkManagement::NetManagement::{NetLocalGroupAddMembers, LOCALGROUP_MEMBERS_INFO_0, NERR_Success};
    use windows::Win32::Security::{LookupAccountSidW, SID_NAME_USE};
    unsafe {
        let user_w = wide(user_sid);
        let mut user = PSID::default();
        if ConvertStringSidToSidW(PCWSTR(user_w.as_ptr()), &mut user).is_err() {
            return 3;
        }
        let mut group = PSID::default();
        if ConvertStringSidToSidW(PERFORMANCE_LOG_USERS, &mut group).is_err() {
            let _ = LocalFree(Some(HLOCAL(user.0)));
            return 4;
        }
        // The group's name is translated, so look it up from its well-known SID.
        let mut name = [0u16; 256];
        let mut name_len = name.len() as u32;
        let mut domain = [0u16; 256];
        let mut domain_len = domain.len() as u32;
        let mut kind = SID_NAME_USE::default();
        let looked_up = LookupAccountSidW(
            PCWSTR::null(),
            group,
            Some(PWSTR(name.as_mut_ptr())),
            &mut name_len,
            Some(PWSTR(domain.as_mut_ptr())),
            &mut domain_len,
            &mut kind,
        );
        let code = if looked_up.is_ok() {
            let member = LOCALGROUP_MEMBERS_INFO_0 { lgrmi0_sid: user };
            let status = NetLocalGroupAddMembers(
                PCWSTR::null(),
                PCWSTR(name.as_ptr()),
                0,
                &member as *const LOCALGROUP_MEMBERS_INFO_0 as *const u8,
                1,
            );
            if status == NERR_Success || status == ERROR_MEMBER_IN_ALIAS.0 { 0 } else { status as i32 }
        } else {
            5
        };
        let _ = LocalFree(Some(HLOCAL(user.0)));
        let _ = LocalFree(Some(HLOCAL(group.0)));
        code
    }
}

// ---- ETW session ----------------------------------------------------------------------------

/// EVENT_TRACE_PROPERTIES followed by room for the session name, 8-byte aligned.
struct Properties(Vec<u64>);

impl Properties {
    fn new() -> Self {
        let header = std::mem::size_of::<EVENT_TRACE_PROPERTIES>();
        let total = header + (SESSION_NAME.len() + 1) * 2;
        let mut properties = Properties(vec![0u64; total.div_ceil(8)]);
        let p = properties.as_mut_ptr();
        unsafe {
            (*p).Wnode.BufferSize = total as u32;
            (*p).LoggerNameOffset = header as u32;
        }
        properties
    }

    fn for_start() -> Self {
        let mut properties = Self::new();
        let p = properties.as_mut_ptr();
        unsafe {
            (*p).Wnode.Flags = WNODE_FLAG_TRACED_GUID;
            (*p).Wnode.ClientContext = 1; // QueryPerformanceCounter timestamps
            (*p).LogFileMode = EVENT_TRACE_REAL_TIME_MODE;
            (*p).FlushTimer = 1;
            (*p).BufferSize = 16;
            (*p).MinimumBuffers = 4;
            (*p).MaximumBuffers = 32;
        }
        properties
    }

    fn as_mut_ptr(&mut self) -> *mut EVENT_TRACE_PROPERTIES {
        self.0.as_mut_ptr() as *mut EVENT_TRACE_PROPERTIES
    }
}

fn stop_session() {
    let name = wide(SESSION_NAME);
    let mut properties = Properties::new();
    unsafe {
        let _ = ControlTraceW(
            CONTROLTRACE_HANDLE::default(),
            PCWSTR(name.as_ptr()),
            properties.as_mut_ptr(),
            EVENT_TRACE_CONTROL_STOP,
        );
    }
}

fn start_session() -> Result<(), String> {
    let name = wide(SESSION_NAME);
    let mut control = CONTROLTRACE_HANDLE::default();
    let mut properties = Properties::for_start();
    let mut status = unsafe { StartTraceW(&mut control, PCWSTR(name.as_ptr()), properties.as_mut_ptr()) };
    if status == ERROR_ALREADY_EXISTS {
        // Left over from a run that ended without stopping it.
        stop_session();
        properties = Properties::for_start();
        status = unsafe { StartTraceW(&mut control, PCWSTR(name.as_ptr()), properties.as_mut_ptr()) };
    }
    if status != ERROR_SUCCESS {
        return Err(format!("could not start frame tracing (error {})", status.0));
    }
    for provider in [DXGI_PROVIDER, D3D9_PROVIDER] {
        let status = unsafe {
            EnableTraceEx2(
                control,
                &provider,
                EVENT_CONTROL_CODE_ENABLE_PROVIDER.0,
                TRACE_LEVEL_INFORMATION as u8,
                u64::MAX,
                0,
                0,
                None,
            )
        };
        if status != ERROR_SUCCESS && provider == DXGI_PROVIDER {
            stop_session();
            return Err(format!("could not listen for frames (error {})", status.0));
        }
    }
    Ok(())
}

/// Blocks until the session stops.
fn consume() {
    let mut name = wide(SESSION_NAME);
    unsafe {
        let mut logfile = EVENT_TRACE_LOGFILEW::default();
        logfile.LoggerName = PWSTR(name.as_mut_ptr());
        logfile.Anonymous1.ProcessTraceMode = PROCESS_TRACE_MODE_REAL_TIME | PROCESS_TRACE_MODE_EVENT_RECORD;
        logfile.Anonymous2.EventRecordCallback = Some(on_event);
        let trace = OpenTraceW(&mut logfile);
        if trace.Value == u64::MAX || trace.Value == u32::MAX as u64 {
            crate::diagnostics::log("fps: OpenTrace failed");
            stop_session();
            return;
        }
        let _ = ProcessTrace(&[trace], None, None);
        let _ = CloseTrace(trace);
    }
}

fn ensure_running() -> Result<(), String> {
    if RUNNING.load(Ordering::Acquire) {
        return Ok(());
    }
    let _guard = START_LOCK.lock().map_err(|_| "frame tracing is busy".to_string())?;
    if RUNNING.load(Ordering::Acquire) {
        return Ok(());
    }
    start_session()?;
    RUNNING.store(true, Ordering::Release);
    let spawned = std::thread::Builder::new().name("fps-trace".into()).spawn(|| {
        consume();
        RUNNING.store(false, Ordering::Release);
    });
    if let Err(e) = spawned {
        stop_session();
        RUNNING.store(false, Ordering::Release);
        return Err(e.to_string());
    }
    Ok(())
}

fn ensure_watchdog() {
    if WATCHDOG.swap(true, Ordering::SeqCst) {
        return;
    }
    let spawned = std::thread::Builder::new().name("fps-idle".into()).spawn(|| loop {
        std::thread::sleep(Duration::from_secs(5));
        let idle = crate::utils::get_now_ms() - LAST_WANTED_MS.load(Ordering::Relaxed) > IDLE_STOP_MS;
        if idle || !RUNNING.load(Ordering::Acquire) {
            if idle {
                let _guard = START_LOCK.lock();
                stop_session();
                if let Ok(mut tracks) = tracks().lock() {
                    tracks.clear();
                }
            }
            WATCHDOG.store(false, Ordering::SeqCst);
            return;
        }
    });
    if spawned.is_err() {
        WATCHDOG.store(false, Ordering::SeqCst);
    }
}

unsafe extern "system" fn on_event(record: *mut EVENT_RECORD) {
    let Some(record) = record.as_ref() else { return };
    let header = &record.EventHeader;
    let id = header.EventDescriptor.Id;
    let source = if header.ProviderId == DXGI_PROVIDER {
        if id != DXGI_PRESENT_START && id != DXGI_PRESENT_MULTIPLANE_START {
            return;
        }
        0
    } else if header.ProviderId == D3D9_PROVIDER {
        if id != D3D9_PRESENT_START {
            return;
        }
        1
    } else {
        return;
    };
    record_frame(header.ProcessId, source, header.TimeStamp);
}

fn record_frame(pid: u32, source: u8, time: i64) {
    let Ok(mut tracks) = tracks().lock() else { return };
    let track = tracks.entry((pid, source)).or_default();
    track.times.push_back(time);
    track.last_arrival = Some(Instant::now());
    while track.times.len() > MAX_FRAMES || track.times.front().is_some_and(|&t| time - t > HISTORY_TICKS) {
        track.times.pop_front();
    }
}

// ---- Stats ----------------------------------------------------------------------------------

/// `times` are present timestamps in 100 ns ticks, oldest first. FPS and frame time cover the
/// last second of frames; the 1% low is the average rate of the slowest 1% of frames in the
/// whole history.
fn frame_stats(times: &VecDeque<i64>) -> Option<FrameStats> {
    let &last = times.back()?;
    let recent: Vec<i64> = times.iter().copied().filter(|&t| last - t <= TICKS_PER_SECOND).collect();
    if recent.len() < 2 {
        return None;
    }
    let span = (last - recent[0]) as f64;
    if span <= 0.0 {
        return None;
    }
    let frame_ticks = span / (recent.len() - 1) as f64;
    let mut gaps: Vec<i64> = times.iter().zip(times.iter().skip(1)).map(|(a, b)| b - a).filter(|&g| g > 0).collect();
    let low_fps = if gaps.len() >= MIN_FRAMES_FOR_LOW {
        gaps.sort_unstable_by(|a, b| b.cmp(a));
        let slowest = &gaps[..(gaps.len() / 100).max(1)];
        let average = slowest.iter().sum::<i64>() as f64 / slowest.len() as f64;
        Some((TICKS_PER_SECOND as f64 / average) as f32)
    } else {
        None
    };
    Some(FrameStats {
        fps: (TICKS_PER_SECOND as f64 / frame_ticks) as f32,
        frame_time_ms: (frame_ticks / 10_000.0) as f32,
        low_fps,
    })
}

fn foreground_pid() -> Option<u32> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        (pid != 0 && pid != std::process::id()).then_some(pid)
    }
}

fn process_path(pid: u32) -> Option<String> {
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(handle);
        ok.then(|| String::from_utf16_lossy(&buf[..len as usize]))
    }
}

fn app_name(pid: u32) -> Option<String> {
    if let Ok(cache) = APP_NAME.lock() {
        if let Some((cached, name)) = cache.as_ref() {
            if *cached == pid {
                return Some(name.clone());
            }
        }
    }
    let path = process_path(pid)?;
    let name = crate::utils::exe_description(&path)
        .filter(|d| !d.trim().is_empty())
        .or_else(|| std::path::Path::new(&path).file_stem().map(|s| s.to_string_lossy().into_owned()))?;
    if let Ok(mut cache) = APP_NAME.lock() {
        *cache = Some((pid, name.clone()));
    }
    Some(name)
}

fn stats(app: &AppHandle) -> FpsStats {
    let access = access_state(app);
    let mut out = FpsStats { access: access.to_string(), ..Default::default() };
    if access != "granted" {
        return out;
    }
    LAST_WANTED_MS.store(crate::utils::get_now_ms(), Ordering::Relaxed);
    if let Err(e) = ensure_running() {
        out.error = Some(e);
        return out;
    }
    ensure_watchdog();

    let Some(pid) = foreground_pid() else { return out };
    let frame = {
        let Ok(mut tracks) = tracks().lock() else { return out };
        tracks.retain(|_, t| t.last_arrival.is_some_and(|a| a.elapsed() < FORGET_AFTER));
        [0u8, 1]
            .iter()
            .filter_map(|source| tracks.get(&(pid, *source)))
            .filter(|t| t.last_arrival.is_some_and(|a| a.elapsed() < STALE_AFTER))
            .max_by_key(|t| t.times.len())
            .and_then(|t| frame_stats(&t.times))
    };
    if let Some(frame) = frame {
        out.fps = Some(frame.fps);
        out.frame_time_ms = Some(frame.frame_time_ms);
        out.low_fps = frame.low_fps;
        out.app = app_name(pid);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn steady(frames: usize, interval: i64) -> VecDeque<i64> {
        (0..frames as i64).map(|i| i * interval).collect()
    }

    #[test]
    fn steady_60_fps() {
        let stats = frame_stats(&steady(300, TICKS_PER_SECOND / 60)).unwrap();
        assert!((stats.fps - 60.0).abs() < 0.5, "{stats:?}");
        assert!((stats.frame_time_ms - 16.67).abs() < 0.05, "{stats:?}");
        assert!((stats.low_fps.unwrap() - 60.0).abs() < 0.5, "{stats:?}");
    }

    #[test]
    fn stutters_pull_down_the_one_percent_low() {
        let interval = TICKS_PER_SECOND / 100;
        let mut times = VecDeque::new();
        let mut t = 0;
        for i in 0..400 {
            t += if i % 100 == 50 { interval * 5 } else { interval };
            times.push_back(t);
        }
        let stats = frame_stats(&times).unwrap();
        assert!(stats.fps > 90.0, "{stats:?}");
        assert!((stats.low_fps.unwrap() - 20.0).abs() < 0.5, "{stats:?}");
    }

    #[test]
    fn too_few_frames() {
        assert_eq!(frame_stats(&VecDeque::new()), None);
        assert_eq!(frame_stats(&steady(1, 1)), None);
        assert_eq!(frame_stats(&steady(30, TICKS_PER_SECOND / 30)).unwrap().low_fps, None);
    }

    /// Checks this account: `cargo test --bin kairo live_access -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_access() {
        println!("user sid: {:?}", current_user_sid());
        println!("can trace frames: {}", has_access());
    }

    #[test]
    fn grant_only_accepts_sid_strings() {
        assert!(is_sid_string("S-1-5-21-1004336348-1177238915-682003330-1001"));
        assert!(!is_sid_string("S-1-5-21 & calc"));
        assert!(!is_sid_string("Administrator"));
        assert_eq!(run_cli(&["kairo.exe".into(), GRANT_ARG.into()]), Some(2));
        assert_eq!(run_cli(&["kairo.exe".into(), "agent".into()]), None);
    }
}
