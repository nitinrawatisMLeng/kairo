//! Extra Control Center toggles: airplane mode, microphone mute and mobile hotspot.
//!
//! Windows has no public API for its own airplane mode switch, so airplane mode here turns every
//! radio off through the same Radio API the Wi-Fi and Bluetooth tiles use, and turning it off
//! switches back on the radios that were on before. It reads as on whenever every radio is off.

use std::sync::Mutex;

use serde::Serialize;
use windows::Devices::Radios::{Radio, RadioAccessStatus, RadioState};
use windows::Networking::Connectivity::NetworkInformation;
use windows::Networking::NetworkOperators::{
    NetworkOperatorTetheringManager, TetheringCapability, TetheringOperationStatus, TetheringOperationalState,
};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eCapture, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QuickToggles {
    pub airplane: bool,
    /// None when there is no microphone.
    pub mic_muted: Option<bool>,
    /// None when this connection can't be shared as a hotspot.
    pub hotspot: Option<bool>,
}

/// Kinds of the radios that were on when airplane mode switched them off.
static RADIOS_BEFORE_AIRPLANE: Mutex<Option<Vec<i32>>> = Mutex::new(None);

fn init_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

// ---- Airplane mode --------------------------------------------------------------------------

fn radios() -> Result<Vec<Radio>, String> {
    let list = Radio::GetRadiosAsync().and_then(|op| op.get()).map_err(|e| e.message())?;
    Ok((0..list.Size().unwrap_or(0)).filter_map(|i| list.GetAt(i).ok()).collect())
}

fn airplane_on() -> bool {
    match radios() {
        Ok(radios) if !radios.is_empty() => radios.iter().all(|r| r.State().ok() != Some(RadioState::On)),
        _ => false,
    }
}

fn set_airplane(enabled: bool) -> Result<(), String> {
    let radios = radios()?;
    let restore = if enabled {
        let on: Vec<i32> = radios
            .iter()
            .filter(|r| r.State().ok() == Some(RadioState::On))
            .filter_map(|r| r.Kind().ok().map(|k| k.0))
            .collect();
        if let Ok(mut saved) = RADIOS_BEFORE_AIRPLANE.lock() {
            *saved = Some(on);
        }
        None
    } else {
        RADIOS_BEFORE_AIRPLANE.lock().ok().and_then(|mut saved| saved.take()).filter(|kinds| !kinds.is_empty())
    };

    let target = if enabled { RadioState::Off } else { RadioState::On };
    let mut denied = 0;
    for radio in &radios {
        // Without a remembered set (Kairo restarted in between), every radio comes back on.
        let wanted = restore
            .as_ref()
            .map_or(true, |kinds| radio.Kind().ok().is_some_and(|k| kinds.contains(&k.0)));
        if !wanted {
            continue;
        }
        match radio.SetStateAsync(target).and_then(|op| op.get()) {
            Ok(status) if status == RadioAccessStatus::Allowed => {}
            _ => denied += 1,
        }
    }
    if denied > 0 && denied == radios.len() {
        return Err("Windows did not allow changing the radios".into());
    }
    Ok(())
}

// ---- Microphone -----------------------------------------------------------------------------

fn microphone() -> Option<IAudioEndpointVolume> {
    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole).ok()?;
        device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).ok()
    }
}

fn mic_muted() -> Option<bool> {
    let volume = microphone()?;
    unsafe { volume.GetMute().ok().map(|muted| muted.as_bool()) }
}

fn set_mic_mute(muted: bool) -> Result<(), String> {
    let volume = microphone().ok_or("no microphone")?;
    unsafe { volume.SetMute(muted, std::ptr::null()).map_err(|e| e.message()) }
}

// ---- Mobile hotspot -------------------------------------------------------------------------

fn tethering() -> Option<NetworkOperatorTetheringManager> {
    let profile = NetworkInformation::GetInternetConnectionProfile().ok()?;
    let capability = NetworkOperatorTetheringManager::GetTetheringCapabilityFromConnectionProfile(&profile).ok()?;
    if capability != TetheringCapability::Enabled {
        return None;
    }
    NetworkOperatorTetheringManager::CreateFromConnectionProfile(&profile).ok()
}

fn hotspot_on() -> Option<bool> {
    let state = tethering()?.TetheringOperationalState().ok()?;
    Some(state == TetheringOperationalState::On || state == TetheringOperationalState::InTransition)
}

fn set_hotspot_state(enabled: bool) -> Result<(), String> {
    let manager = tethering().ok_or("mobile hotspot isn't available for this connection")?;
    let operation = if enabled { manager.StartTetheringAsync() } else { manager.StopTetheringAsync() };
    let result = operation.and_then(|op| op.get()).map_err(|e| e.message())?;
    let status = result.Status().map_err(|e| e.message())?;
    if status == TetheringOperationStatus::Success || (enabled && status == TetheringOperationStatus::AlreadyOn) {
        return Ok(());
    }
    let detail = result.AdditionalErrorMessage().map(|m| m.to_string()).unwrap_or_default();
    Err(if detail.trim().is_empty() { format!("Windows returned status {}", status.0) } else { detail })
}

// ---- Commands -------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_quick_toggles() -> QuickToggles {
    tauri::async_runtime::spawn_blocking(|| {
        init_com();
        QuickToggles { airplane: airplane_on(), mic_muted: mic_muted(), hotspot: hotspot_on() }
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn set_airplane_mode(enabled: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        init_com();
        set_airplane(enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_mic_muted(muted: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        init_com();
        set_mic_mute(muted)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_hotspot(enabled: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        init_com();
        set_hotspot_state(enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_hotspot_settings() {
    use windows::core::{w, PCWSTR};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    unsafe {
        let _ = ShellExecuteW(None, w!("open"), w!("ms-settings:network-mobilehotspot"), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reads the real state of this machine and changes nothing:
    /// `cargo test --bin kairo live_state -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_state() {
        init_com();
        let radios = radios().map(|list| {
            list.iter().map(|r| (r.Name().map(|n| n.to_string()).unwrap_or_default(), r.State().map(|s| s.0).ok())).collect::<Vec<_>>()
        });
        println!("radios: {radios:?}");
        println!("airplane: {}", airplane_on());
        println!("mic muted: {:?}", mic_muted());
        println!("hotspot: {:?}", hotspot_on());
    }
}
