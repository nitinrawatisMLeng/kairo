//! GPU usage and temperature for the notch's GPU widget.
//!
//! Usage comes from the counters Task Manager reads, `\GPU Engine(*)\Utilization Percentage`:
//! one instance per process and engine, summed per engine, and the busiest engine is the GPU's
//! usage. Temperature comes from the graphics driver through `D3DKMTQueryAdapterInfo`, which
//! only newer drivers fill in. Both are read for the adapter with the most dedicated memory,
//! which is the discrete GPU on machines that have one.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::LUID;
use windows::Win32::System::Performance::{
    PdhAddEnglishCounterW, PdhCloseQuery, PdhCollectQueryData, PdhGetFormattedCounterArrayW, PdhOpenQueryW,
    PDH_CSTATUS_NEW_DATA, PDH_CSTATUS_VALID_DATA, PDH_FMT, PDH_FMT_COUNTERVALUE_ITEM_W, PDH_FMT_DOUBLE, PDH_HCOUNTER,
    PDH_HQUERY, PDH_MORE_DATA,
};

const PDH_FMT_NOCAP100: u32 = 0x0000_8000;
const IDLE_CLOSE_MS: i64 = 30_000;
const FIRST_SAMPLE_GAP: Duration = Duration::from_millis(250);

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GpuStats {
    pub name: Option<String>,
    pub usage: Option<u32>,
    pub temperature: Option<f32>,
}

struct Adapter {
    name: String,
    luid: LUID,
    luid_key: String,
}

struct Query {
    query: PDH_HQUERY,
    counter: PDH_HCOUNTER,
}

// The PDH handles are only touched while QUERY is locked.
unsafe impl Send for Query {}

static QUERY: Mutex<Option<Query>> = Mutex::new(None);
static ADAPTER: OnceLock<Option<Adapter>> = OnceLock::new();
static LAST_USE_MS: AtomicI64 = AtomicI64::new(0);
static REAPER: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn get_gpu_stats() -> GpuStats {
    tauri::async_runtime::spawn_blocking(sample).await.unwrap_or_default()
}

pub fn sample() -> GpuStats {
    LAST_USE_MS.store(crate::utils::get_now_ms(), Ordering::Relaxed);
    let adapter = ADAPTER.get_or_init(primary_adapter).as_ref();
    let usage = read_usage(adapter.map(|a| a.luid_key.as_str()));
    let temperature = adapter.and_then(|a| temperature(a.luid));
    ensure_reaper();
    GpuStats { name: adapter.map(|a| a.name.clone()), usage, temperature }
}

fn luid_key(luid: LUID) -> String {
    format!("0x{:08X}_0x{:08X}", luid.HighPart as u32, luid.LowPart)
}

fn primary_adapter() -> Option<Adapter> {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE};
    unsafe {
        let factory: IDXGIFactory1 = CreateDXGIFactory1().ok()?;
        let mut best: Option<(usize, Adapter)> = None;
        let mut index = 0;
        while let Ok(adapter) = factory.EnumAdapters1(index) {
            index += 1;
            let Ok(desc) = adapter.GetDesc1() else { continue };
            if desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32 != 0 {
                continue;
            }
            let end = desc.Description.iter().position(|&c| c == 0).unwrap_or(desc.Description.len());
            let name = String::from_utf16_lossy(&desc.Description[..end]).trim().to_string();
            let vram = desc.DedicatedVideoMemory;
            if best.as_ref().map_or(true, |(most, _)| vram > *most) {
                let luid = desc.AdapterLuid;
                best = Some((vram, Adapter { name, luid, luid_key: luid_key(luid) }));
            }
        }
        best.map(|(_, adapter)| adapter)
    }
}

fn open_query() -> Option<Query> {
    unsafe {
        let mut query = PDH_HQUERY::default();
        if PdhOpenQueryW(PCWSTR::null(), 0, &mut query) != 0 {
            return None;
        }
        let mut counter = PDH_HCOUNTER::default();
        if PdhAddEnglishCounterW(query, w!("\\GPU Engine(*)\\Utilization Percentage"), 0, &mut counter) != 0 {
            let _ = PdhCloseQuery(query);
            return None;
        }
        // Utilization is a rate, so it needs a sample to compare against.
        let _ = PdhCollectQueryData(query);
        std::thread::sleep(FIRST_SAMPLE_GAP);
        Some(Query { query, counter })
    }
}

fn read_usage(luid: Option<&str>) -> Option<u32> {
    let mut guard = QUERY.lock().ok()?;
    if guard.is_none() {
        *guard = open_query();
    }
    let query = guard.as_ref()?;
    let samples = unsafe {
        if PdhCollectQueryData(query.query) != 0 {
            return None;
        }
        read_counter_array(query.counter)?
    };
    let value = busiest_engine(&samples, luid).or_else(|| busiest_engine(&samples, None))?;
    Some(value.clamp(0.0, 100.0).round() as u32)
}

unsafe fn read_counter_array(counter: PDH_HCOUNTER) -> Option<Vec<(String, f64)>> {
    let format = PDH_FMT(PDH_FMT_DOUBLE.0 | PDH_FMT_NOCAP100);
    let mut size = 0u32;
    let mut count = 0u32;
    if PdhGetFormattedCounterArrayW(counter, format, &mut size, &mut count, None) != PDH_MORE_DATA || size == 0 {
        return None;
    }
    let mut buffer = vec![0u64; (size as usize).div_ceil(8)];
    let items = buffer.as_mut_ptr() as *mut PDH_FMT_COUNTERVALUE_ITEM_W;
    if PdhGetFormattedCounterArrayW(counter, format, &mut size, &mut count, Some(items)) != 0 {
        return None;
    }
    let mut samples = Vec::with_capacity(count as usize);
    for item in std::slice::from_raw_parts(items, count as usize) {
        let status = item.FmtValue.CStatus;
        if status != PDH_CSTATUS_VALID_DATA && status != PDH_CSTATUS_NEW_DATA {
            continue;
        }
        let Ok(name) = item.szName.to_string() else { continue };
        samples.push((name, item.FmtValue.Anonymous.doubleValue));
    }
    Some(samples)
}

/// Splits `pid_1234_luid_0x00000000_0x0000D1B5_phys_0_eng_3_engtype_3D` into the adapter
/// (`0x00000000_0x0000D1B5`) and the engine (`0x00000000_0x0000D1B5_phys_0_eng_3`).
fn parse_instance(name: &str) -> Option<(&str, &str)> {
    let rest = &name[name.find("luid_")? + "luid_".len()..];
    let luid_end = rest.match_indices('_').nth(1)?.0;
    let engine_end = rest.find("_engtype").unwrap_or(rest.len());
    if engine_end < luid_end {
        return None;
    }
    Some((&rest[..luid_end], &rest[..engine_end]))
}

/// Task Manager's GPU figure: per engine, the sum over processes; overall, the busiest engine.
fn busiest_engine(samples: &[(String, f64)], luid: Option<&str>) -> Option<f64> {
    let mut per_engine: HashMap<&str, f64> = HashMap::new();
    for (name, value) in samples {
        let Some((adapter, engine)) = parse_instance(name) else { continue };
        if luid.is_some_and(|wanted| !wanted.eq_ignore_ascii_case(adapter)) {
            continue;
        }
        *per_engine.entry(engine).or_default() += value;
    }
    per_engine.into_values().reduce(f64::max)
}

fn temperature(luid: LUID) -> Option<f32> {
    use windows::Wdk::Graphics::Direct3D::{
        D3DKMTCloseAdapter, D3DKMTOpenAdapterFromLuid, D3DKMTQueryAdapterInfo, D3DKMT_ADAPTER_PERFDATA,
        D3DKMT_CLOSEADAPTER, D3DKMT_OPENADAPTERFROMLUID, D3DKMT_QUERYADAPTERINFO, KMTQAITYPE_ADAPTERPERFDATA,
    };
    unsafe {
        let mut open = D3DKMT_OPENADAPTERFROMLUID { AdapterLuid: luid, hAdapter: 0 };
        if D3DKMTOpenAdapterFromLuid(&mut open).0 < 0 {
            return None;
        }
        let mut perf: D3DKMT_ADAPTER_PERFDATA = std::mem::zeroed();
        let mut query = D3DKMT_QUERYADAPTERINFO {
            hAdapter: open.hAdapter,
            Type: KMTQAITYPE_ADAPTERPERFDATA,
            pPrivateDriverData: &mut perf as *mut D3DKMT_ADAPTER_PERFDATA as *mut core::ffi::c_void,
            PrivateDriverDataSize: std::mem::size_of::<D3DKMT_ADAPTER_PERFDATA>() as u32,
        };
        let status = D3DKMTQueryAdapterInfo(&mut query);
        let _ = D3DKMTCloseAdapter(&D3DKMT_CLOSEADAPTER { hAdapter: open.hAdapter });
        if status.0 < 0 {
            return None;
        }
        // Reported in tenths of a degree Celsius; drivers that don't support it leave 0.
        let celsius = perf.Temperature as f32 / 10.0;
        (celsius > 0.0 && celsius < 150.0).then_some(celsius)
    }
}

/// Closes the counter query once nobody has asked for GPU stats in a while.
fn ensure_reaper() {
    if REAPER.swap(true, Ordering::SeqCst) {
        return;
    }
    let spawned = std::thread::Builder::new().name("gpu-stats-idle".into()).spawn(|| loop {
        std::thread::sleep(Duration::from_secs(10));
        if crate::utils::get_now_ms() - LAST_USE_MS.load(Ordering::Relaxed) > IDLE_CLOSE_MS {
            if let Ok(mut guard) = QUERY.lock() {
                if let Some(query) = guard.take() {
                    unsafe {
                        let _ = PdhCloseQuery(query.query);
                    }
                }
            }
            REAPER.store(false, Ordering::SeqCst);
            return;
        }
    });
    if spawned.is_err() {
        REAPER.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn instance_names_split_into_adapter_and_engine() {
        assert_eq!(
            parse_instance("pid_1234_luid_0x00000000_0x0000D1B5_phys_0_eng_3_engtype_3D"),
            Some(("0x00000000_0x0000D1B5", "0x00000000_0x0000D1B5_phys_0_eng_3"))
        );
        assert_eq!(parse_instance("_Total"), None);
        assert_eq!(parse_instance("pid_1_luid_0x1"), None);
    }

    #[test]
    fn usage_is_the_busiest_engine_summed_over_processes() {
        let samples = vec![
            ("pid_1_luid_0x00000000_0x0000AAAA_phys_0_eng_0_engtype_3D".to_string(), 30.0),
            ("pid_2_luid_0x00000000_0x0000AAAA_phys_0_eng_0_engtype_3D".to_string(), 25.0),
            ("pid_1_luid_0x00000000_0x0000AAAA_phys_0_eng_4_engtype_Copy".to_string(), 70.0),
            ("pid_3_luid_0x00000000_0x0000BBBB_phys_0_eng_0_engtype_3D".to_string(), 90.0),
        ];
        assert_eq!(busiest_engine(&samples, Some("0x00000000_0x0000aaaa")), Some(70.0));
        assert_eq!(busiest_engine(&samples, None), Some(90.0));
        assert_eq!(busiest_engine(&samples, Some("0x00000000_0x0000CCCC")), None);
    }

    /// Reads this machine's GPU: `cargo test --bin kairo live_gpu -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_gpu() {
        let first = sample();
        std::thread::sleep(Duration::from_millis(500));
        let second = sample();
        println!("gpu: {:?} usage {:?}% then {:?}%, temperature {:?}", second.name, first.usage, second.usage, second.temperature);
    }

    #[test]
    fn luid_key_matches_counter_instance_format() {
        let luid = LUID { LowPart: 0xD1B5, HighPart: 0 };
        assert_eq!(luid_key(luid), "0x00000000_0x0000D1B5");
    }
}
