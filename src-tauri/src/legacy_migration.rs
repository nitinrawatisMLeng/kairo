//! Kairo used to be called Nectar. On the first launch after the rename this carries the user's
//! data over from Nectar's folder, with the `nectar-` setting keys renamed to `kairo-`. Nectar's
//! folder is left as it is, so nothing is lost if this goes wrong.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde_json::{Map, Value};

const OLD_DATA_DIR: &str = "com.kua8.nectar";
const NEW_DATA_DIR: &str = "com.kairo.desktop";
const OLD_KEY_PREFIX: &str = "nectar-";
const NEW_KEY_PREFIX: &str = "kairo-";
const SETTINGS_FILE: &str = "settings.json";
const PINNED_FILE: &str = "pinned_apps.json";

/// Not carried over: logs and icon caches are rebuilt, the taskbar flag belongs to the old app, and
/// the agent API writes a new port and token. Settings and pins are rewritten instead of copied.
const NOT_COPIED: &[&str] = &[
    "logs",
    "icons_cache.json",
    "icons_cache_v2",
    "taskbar_hidden.flag",
    "update-state.json",
    "agent.json",
    SETTINGS_FILE,
    PINNED_FILE,
];

/// Settings of the update system, which no longer exists.
const REMOVED_SETTINGS: &[&str] = &["nectar-auto-update", "nectar-update-channel", "nectar-show-update-indicator"];

static MIGRATED: AtomicBool = AtomicBool::new(false);

/// True during the launch that carried Nectar's data over.
pub fn migrated() -> bool {
    MIGRATED.load(Ordering::Relaxed)
}

fn nectar_is_running() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{OpenMutexW, SYNCHRONIZATION_ACCESS_RIGHTS};
    const SYNCHRONIZE: u32 = 0x0010_0000;
    unsafe {
        match OpenMutexW(SYNCHRONIZATION_ACCESS_RIGHTS(SYNCHRONIZE), false, w!("NectarSingleInstance")) {
            Ok(handle) => {
                let _ = CloseHandle(handle);
                true
            }
            Err(_) => false,
        }
    }
}

/// Both apps would fight over the taskbar and the screen edges, so Kairo won't start beside
/// Nectar. Returns true when it told the user and the launch should stop.
pub fn refuse_while_nectar_runs() -> bool {
    use windows::core::PCWSTR;
    use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK, MB_TOPMOST};
    if !nectar_is_running() {
        return false;
    }
    let text = crate::uninstall_registry::wide(
        "Nectar is still running.\n\nKairo replaces Nectar. Uninstall Nectar in Windows Settings > Apps, then open Kairo again. Your settings carry over.",
    );
    let title = crate::uninstall_registry::wide(crate::uninstall_registry::PRODUCT_NAME);
    unsafe {
        MessageBoxW(None, PCWSTR(text.as_ptr()), PCWSTR(title.as_ptr()), MB_OK | MB_ICONINFORMATION | MB_TOPMOST);
    }
    true
}

/// Nectar's settings with the keys and any paths into its data folder renamed.
fn migrate_settings(raw: &str) -> Option<String> {
    let old: Map<String, Value> = serde_json::from_str(raw).ok()?;
    let mut new = Map::with_capacity(old.len());
    for (key, value) in old {
        if REMOVED_SETTINGS.contains(&key.as_str()) {
            continue;
        }
        let key = match key.strip_prefix(OLD_KEY_PREFIX) {
            Some(rest) => format!("{NEW_KEY_PREFIX}{rest}"),
            None => key,
        };
        let value = match value {
            Value::String(text) => Value::String(text.replace(OLD_DATA_DIR, NEW_DATA_DIR)),
            other => other,
        };
        new.insert(key, value);
    }
    serde_json::to_string(&new).ok()
}

fn copy_dir(from: &Path, to: &Path, skip: &[&str]) {
    let Ok(entries) = std::fs::read_dir(from) else { return };
    let _ = std::fs::create_dir_all(to);
    for entry in entries.flatten() {
        let name = entry.file_name();
        if skip.iter().any(|s| name.to_string_lossy().eq_ignore_ascii_case(s)) {
            continue;
        }
        let (source, target) = (entry.path(), to.join(&name));
        if source.is_dir() {
            copy_dir(&source, &target, &[]);
        } else {
            let _ = std::fs::copy(&source, &target);
        }
    }
}

fn migrate_dir(old: &Path, new: &Path) -> bool {
    let settings = old.join(SETTINGS_FILE);
    if !settings.is_file() || new.join(SETTINGS_FILE).exists() {
        return false;
    }
    let Some(migrated) = std::fs::read_to_string(&settings).ok().and_then(|raw| migrate_settings(&raw)) else {
        return false;
    };
    copy_dir(old, new, NOT_COPIED);
    if let Ok(pinned) = std::fs::read_to_string(old.join(PINNED_FILE)) {
        let _ = std::fs::write(new.join(PINNED_FILE), pinned.replace(OLD_DATA_DIR, NEW_DATA_DIR));
    }
    // Written last: its presence is what marks the migration as done.
    std::fs::create_dir_all(new).is_ok() && std::fs::write(new.join(SETTINGS_FILE), migrated).is_ok()
}

fn data_dir(name: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|dir| PathBuf::from(dir).join(name))
}

/// Runs before anything reads the settings.
pub fn run() {
    if let (Some(old), Some(new)) = (data_dir(OLD_DATA_DIR), data_dir(NEW_DATA_DIR)) {
        if migrate_dir(&old, &new) {
            MIGRATED.store(true, Ordering::Relaxed);
        }
    }
}

/// Windows read some settings straight from their own storage, which a new app starts without, so
/// on the migrating launch every page is seeded from the settings before its scripts run.
fn seed_script() -> String {
    if !migrated() {
        return String::new();
    }
    let settings = data_dir(NEW_DATA_DIR)
        .and_then(|dir| std::fs::read_to_string(dir.join(SETTINGS_FILE)).ok())
        .unwrap_or_else(|| "{}".into());
    format!(
        r#"(function(){{try{{
  if(sessionStorage.getItem("kairo-seeded"))return;
  sessionStorage.setItem("kairo-seeded","1");
  var s={settings};
  for(var k in s){{if(localStorage.getItem(k)===null)localStorage.setItem(k,typeof s[k]==="string"?s[k]:JSON.stringify(s[k]));}}
  localStorage.setItem("kairo-first-run","done");
}}catch(e){{}}}})();"#
    )
}

pub fn seed_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("kairo-settings-seed").js_init_script(seed_script()).build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kairo-migration-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn settings_keys_are_renamed_and_update_settings_dropped() {
        let raw = r#"{"nectar-dock-mode":"smart","nectar-auto-update":"true","nectar-update-channel":"stable","nectar-show-update-indicator":"true","nectar-scale":1.2,"other":"x","nectar-icon":"C:\\AppData\\com.kua8.nectar\\a.png"}"#;
        let new: Map<String, Value> = serde_json::from_str(&migrate_settings(raw).unwrap()).unwrap();
        assert_eq!(new["kairo-dock-mode"], "smart");
        assert_eq!(new["kairo-scale"], 1.2);
        assert_eq!(new["other"], "x");
        assert_eq!(new["kairo-icon"], r"C:\AppData\com.kairo.desktop\a.png");
        assert_eq!(new.len(), 4);
        assert!(new.keys().all(|key| !key.contains("nectar") && !key.contains("update")));
        assert_eq!(migrate_settings("not json"), None);
    }

    #[test]
    fn folder_is_carried_over_once_and_old_folder_kept() {
        let (old, new) = (scratch("old"), scratch("new"));
        std::fs::create_dir_all(old.join("custom_icons")).unwrap();
        std::fs::create_dir_all(old.join("logs")).unwrap();
        std::fs::write(old.join(SETTINGS_FILE), r#"{"nectar-a":"1"}"#).unwrap();
        std::fs::write(old.join(PINNED_FILE), r#"[{"path":"C:\\com.kua8.nectar\\x"}]"#).unwrap();
        std::fs::write(old.join("custom_icons").join("i.png"), "icon").unwrap();
        std::fs::write(old.join("logs").join("nectar.log"), "log").unwrap();
        std::fs::write(old.join("taskbar_hidden.flag"), "1").unwrap();
        std::fs::write(old.join("taskbar_pins_synced"), "1").unwrap();

        assert!(migrate_dir(&old, &new));
        assert_eq!(std::fs::read_to_string(new.join(SETTINGS_FILE)).unwrap(), r#"{"kairo-a":"1"}"#);
        assert!(std::fs::read_to_string(new.join(PINNED_FILE)).unwrap().contains("com.kairo.desktop"));
        assert!(new.join("custom_icons").join("i.png").exists());
        assert!(new.join("taskbar_pins_synced").exists());
        assert!(!new.join("logs").exists());
        assert!(!new.join("taskbar_hidden.flag").exists());
        assert!(old.join(SETTINGS_FILE).exists());

        // A second launch leaves Kairo's settings alone.
        std::fs::write(new.join(SETTINGS_FILE), r#"{"kairo-a":"changed"}"#).unwrap();
        assert!(!migrate_dir(&old, &new));
        assert_eq!(std::fs::read_to_string(new.join(SETTINGS_FILE)).unwrap(), r#"{"kairo-a":"changed"}"#);

        let _ = std::fs::remove_dir_all(&old);
        let _ = std::fs::remove_dir_all(&new);
    }

    #[test]
    fn nothing_to_migrate_without_old_settings() {
        let (old, new) = (scratch("absent-old"), scratch("absent-new"));
        assert!(!migrate_dir(&old, &new));
        assert!(!new.exists());
    }

    /// Reads this machine: `cargo test --bin kairo live_nectar -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn live_nectar() {
        println!("nectar running: {}", nectar_is_running());
        let raw = data_dir(OLD_DATA_DIR).and_then(|dir| std::fs::read_to_string(dir.join(SETTINGS_FILE)).ok());
        let migrated: Option<Map<String, Value>> = raw.as_deref().and_then(migrate_settings).and_then(|s| serde_json::from_str(&s).ok());
        println!("settings: {:?}", migrated.map(|m| m.keys().cloned().collect::<Vec<_>>()));
    }
}
