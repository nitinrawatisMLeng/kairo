# Kairo installer

A second, self-contained Tauri v2 app — not NSIS. This is what users actually
download and run to install Kairo. It's a real webview, so the UI is plain
HTML/CSS matching the app's own dark theme, not NSIS's native-dialog wizard.

## Why there are two installers

`npm run tauri build` in the main app makes a standard NSIS installer (`tauri.conf.json` → `bundle.windows.nsis`, `installer/`). This project is an alternative with a custom UI, built separately in the release pipeline.

## How it works

The main app's release exe is zipped and embedded into this installer's own
binary via `include_bytes!` (`src-tauri/src/payload.rs`). At runtime the
installer extracts that payload to the chosen install directory, creates
Start Menu / Desktop shortcuts (`src-tauri/src/shortcuts.rs`, via the same
`IShellLinkW` COM interfaces the main app already uses read-only for taskbar
pin import), and writes an `Uninstall` registry entry
(`src-tauri/src/registry.rs`) so it shows up in Add/Remove Programs.

Uninstalling reuses the same binary: the installer copies itself into the
install directory as `uninstall.exe` during install, and registers that path
with a `--uninstall` flag as the `UninstallString`. Launched with
`--uninstall`, it runs an uninstall UI instead of the install flow.

"Install for all users" needs admin rights. If the installer isn't already
elevated when that's chosen, it relaunches itself with the `runas` verb
(`src-tauri/src/elevate.rs`) carrying the user's choices as CLI args
(`--install-dir=`, `--all-users`, `--auto-install`, `--no-desktop-shortcut`),
so the elevated relaunch resumes straight into installing instead of making
the user redo the wizard after the UAC prompt.

## Building

1. **Build the payload** (from the repo root, PowerShell):

   ```powershell
   ./installer-app/scripts/build-payload.ps1
   ```

   This runs `tauri build --no-bundle` on the main app and zips
   `src-tauri/target/release/kairo.exe` into
   `installer-app/src-tauri/payload.zip`. Re-run it whenever the main app
   changes — `payload.zip` is not checked in (it's build output).

2. **Build the installer**:

   ```powershell
   cd installer-app
   npm install
   npm run tauri build -- --no-bundle
   ```

   `bundle.active` is `false` in `installer-app/src-tauri/tauri.conf.json`, so
   this just compiles a normal native exe — no NSIS/MSI wrapping. The output
   at `installer-app/src-tauri/target/release/kairo-installer.exe` **is**
   the shippable `Kairo-Setup.exe`; rename/upload it as-is.

## Known limitations

- No rollback if an install is interrupted partway through.
