# Kairo Settings Reference

All settings are stored in `settings.json` in the app config directory (`%APPDATA%/com.kairo.desktop/`, derived from the Tauri app identifier). The file is a flat JSON object with `kairo-` prefixed keys. Kairo watches this file for external changes and applies them in real-time.

## Quick Start

Edit `settings.json` with any text editor while Kairo is running. Changes are applied immediately — no restart required.

```json
{
  "kairo-dock-enabled": "true",
  "kairo-dock-mode": "smart",
  "kairo-theme-mode": "dark",
  "kairo-scale": "1.0"
}
```

## Settings Keys

### Dock

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-dock-enabled` | `"true"` / `"false"` | `"true"` | Show or hide the Kairo Dock (taskbar replacement). |
| `kairo-dock-mode` | `"fixed"` / `"smart"` / `"peek"` | `"smart"` | Dock visibility behavior. **fixed** = always visible as AppBar. **smart** = auto-hide when overlapped by another window or a fullscreen app. **peek** = hidden until cursor approaches bottom edge. Smart/peek still reveal on hover and are clickable even over a fullscreen app — only a thin pre-emptive strip right at the screen edge stays click-through, so other apps' own edge-hugging UI (e.g. a Snipping Tool selection) is never intercepted. |
| `kairo-dock-preview-enabled` | `"true"` / `"false"` | `"true"` | Show window thumbnail previews when hovering dock icons. |
| `kairo-dock-hide-delay` | number string (ms) | `"800"` | Smart and peek dock only. How long the dock stays up after the cursor leaves. Options from `800` up to `10800000` (3 h). |
| `kairo-dock-preview-delay` | number string (ms) | `"300"` | How long the cursor rests on a dock icon before its window preview opens. Options `0`, `100`, `200`, `300`, `500`, `800`. Only used while previews are on (`kairo-dock-preview-enabled`). |
| `kairo-dock-attention-enabled` | `"true"` / `"false"` | `"true"` | Show a dot on running apps that want attention: the ones that flash their taskbar button (chat apps on a new message, for example), until you switch to them. When an app puts an unread count in its window title, like `(3) Inbox` or `Telegram (5)`, the dot shows the number. Off in Legacy Mode. |
| `kairo-dock-search-enabled` | `"true"` / `"false"` | `"true"` | Show a search icon next to Start. What it opens is set by `kairo-dock-search-provider`. |
| `kairo-dock-search-provider` | `"windows"` / `"cmdpal"` / `"ptrun"` / `"raycast"` / `"shortcut"` | `"windows"` | What the dock's search icon opens. **windows** = Windows Search (Win+S). **cmdpal** = PowerToys Command Palette and **ptrun** = PowerToys Run, opened the same way as their own hotkey, so they follow your PowerToys settings. **raycast** = presses Raycast's shortcut (`kairo-dock-search-shortcut`, or Alt+Space if empty), since Raycast for Windows can't be opened by another app yet. **shortcut** = presses `kairo-dock-search-shortcut` for any other launcher. If the chosen launcher isn't running, or the shortcut can't be read, Windows Search opens instead and the dock shows why above the search icon. Legacy Mode always uses Windows Search. |
| `kairo-dock-search-shortcut` | string | `""` | Shortcut pressed for `raycast` and `shortcut`, written like `"Alt+Space"` or `"Win+Ctrl+K"`: any of Win, Ctrl, Alt, Shift, then one key (a letter, digit, F1 to F24, Space, Enter, Tab, Esc, arrows, Home, End, PageUp, PageDown, Insert, Delete, Backspace, or one of `` ` - = , . / ; ' [ ] \ ``). |
| `kairo-dock-calendar-enabled` | `"true"` / `"false"` | `"true"` | Show a calendar icon next to the search icon that opens the Calendar window. The Calendar window is also in the dock's Kairo Options menu, the tray menu, and the notch calendar's open button. |
| `kairo-dock-tray-enabled` | `"true"` / `"false"` | `"true"` | Show a ^ button in the dock that opens the hidden tray icons popup. Hidden in Legacy Mode. |
| `kairo-dock-taskview-enabled` | `"true"` / `"false"` | `"false"` | Show a Task View button next to the calendar icon (Win+Tab). Hidden in Legacy Mode. |
| `kairo-dock-show-desktop-corner` | `"true"` / `"false"` | `"false"` | Show a thin bar at the right end of the dock that shows the desktop (Win+D) when clicked, and do the same for a click in the very bottom-right corner of the screen (a 6 px square on the dock's monitor, not while a fullscreen app is in front). |
| `kairo-dock-recycle-enabled` | `"true"` / `"false"` | `"false"` | Show the Recycle Bin in the dock. Hidden in Legacy Mode. |
| `kairo-dock-drives` | JSON array, e.g. `["C","D"]` | `[]` | Drive letters to show as dock buttons that open the drive in Explorer. Hidden in Legacy Mode. |
| `kairo-dock-hidden-apps` | JSON array of `{"id","name"}` | `[]` | Running apps hidden from the dock with Hide from Dock in the right-click menu. Restore them in Settings > Dock. |
| `kairo-dock-icon-only` | `"true"` / `"false"` | `"false"` | Minimal icon-only style (no background/padding around icons). |
| `kairo-dock-icon-shape` | `"circle"` / `"rounded"` | `"circle"` | Shape of the tile behind each dock icon: a circle, or the earlier rounded square. Has no effect with `kairo-dock-icon-only`. Set in Settings > Dock > Icon Shape. |
| `kairo-start-icon` | `"default"` / `"windows"` / `custom:<data URI>` | `"default"` | Start button icon in the dock: the Kairo logo, the Windows logo, or an uploaded image (`custom:` followed by its data URI). |
| `kairo-dock-adaptive` | `"true"` / `"false"` | `"false"` | Fixed dock only. Stretch the dock to full width like a traditional taskbar while a window is maximized, and contract back when it's restored. |
| `kairo-dock-win-number-enabled` | `"true"` / `"false"` | `"true"` | When the taskbar is replaced, Win+1 through Win+9 activate the matching pinned dock app (focus/minimize if running, launch otherwise) instead of the native taskbar slots. |
| `kairo-dock-mixed-reorder` | `"true"` / `"false"` | `"false"` | `"false"` = pinned and running icons stay in two separate groups with a divider between them. `"true"` = a single group — any icon, pinned or not, can be dragged anywhere. |

### Notch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-notch-edge-delay` | number string (ms) | `"200"` | Smart and peek notch only. How long the cursor has to rest on the top edge before the notch peeks, so sweeping across a maximized window's tabs doesn't trigger it. `0` peeks instantly. Maximum `2000`. Set in Settings > Notch > Edge delay. |
| `kairo-notch-mode` | `"fixed"` / `"smart"` / `"peek"` | `"fixed"` | Notch (top bar) visibility behavior. **fixed** = always visible, never auto-hides (including over fullscreen apps — matches a real hardware notch, which doesn't disappear either). **smart** = hides when overlapped by another window/fullscreen app, reveals on hover. **peek** = hidden until cursor approaches the top edge, a media event, or a notification. Smart/peek reveal and are fully clickable on hover even over a fullscreen app (only a thin strip right at the screen edge stays click-through, so it never steals input meant for another app). Unlike the Dock, the notch never reserves desktop work-area space, so it never leaves a gap above maximized windows' content. |
| `kairo-notch-timer-progress` | `"true"` / `"false"` | `"true"` | Show an edge progress bar along the bottom of the notch while a timer or Pomodoro session is active. |
| `kairo-notch-scroll-volume` | `"true"` / `"false"` | `"false"` | Scroll with mouse wheel over the volume, brightness and mixer sliders to adjust them. |
| `kairo-agent-api` | `"true"` / `"false"` | `"false"` | Let AI agents on this computer show their status next to the notch. When on, Kairo listens on `127.0.0.1` only, on a random port, and writes the port and a token to `agent.json` in the settings folder. Agents report with `kairo.exe agent <working|needs-input|done|error|clear> [--name NAME] [--project PROJECT]`. Takes effect after a restart. |
| `kairo-agent-sounds` | `"true"` / `"false"` | `"true"` | Play a sound when an AI agent needs input, finishes or fails. Each of the three sounds can be replaced with your own mp3, wav, ogg or m4a file (up to 3 MB) from Settings > Notch > AI agents; the files are kept in the `sounds` folder in the settings folder. |
| `kairo-shelf-persist` | `"true"` / `"false"` | `"false"` | Keep the notch shelf's items after Kairo restarts. The shelf holds files (as links, not copies) and text dropped on the notch; at most 10, newest first. Off clears them when Kairo closes. Files that no longer exist are dropped on start. |
| `kairo-notch-remember-mode` | `"true"` / `"false"` | `"false"` | When the cursor leaves the notch and comes back, reopen the Control Center or Calendar panel you were on instead of resetting to the default (status or music). |
| `kairo-panel-control-center-enabled` | `"true"` / `"false"` | `"true"` | Include the Control Center when scrolling through the notch panels. |
| `kairo-panel-shelf-enabled` | `"true"` / `"false"` | `"true"` | Include the Shelf panel and accept files and text dropped on the notch. |
| `kairo-panel-order` | JSON string, e.g. `"[\"status\",\"music\"]"` | unset | Order of the notch panels when scrolling: `command-center`, `status`, `music`, `calendar`, `shelf`. Missing panels are added at the end. Unset keeps the default order, where Music moves in front of Status while something plays. Set in Settings > Notch > Panel Order. |
| `kairo-cc-layout` | JSON string | unset | Which Control Center items show, and their order: `{"tiles":[...],"buttons":[...],"sliders":[...]}`. Tiles: `network`, `dock-mode`, `bluetooth`, `notch-mode`. Buttons: `dnd`, `airplane`, `mic`, `hotspot`, `battery-saver`, `tray`, `notifications`, `settings`, `restart`. **airplane** turns every radio off (Windows has no public API for its own airplane switch) and back on with the ones that were on; it shows as on while every radio is off. **mic** mutes the default microphone. **hotspot** starts or stops Mobile hotspot for the current internet connection, and is dimmed when that connection can't be shared. Right-click airplane, mic or hotspot to open its Windows settings. A saved layout from before these three existed keeps them out until you drag them in. Sliders: `volume`, `brightness`. An item that is not listed is hidden. A missing list shows all its items in the default order. Set in Settings > Notch > Control Center layout, by dragging items in, out and around like the status widgets. |

### Monitors

The dock and the notch each choose their monitors separately. In Settings this is the **Show On** dropdown on the Dock and Notch tabs.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-dock-monitor-mode` | `"primary"` / `"all"` / `"specific"` | `"primary"` | Where the dock appears. **primary** = your primary display only. **all** = every connected display gets its own dock. **specific** = the single display named in `kairo-dock-monitor-id`. |
| `kairo-dock-monitor-id` | string | `""` | Windows display name of the monitor to use when the dock mode is `"specific"` (for example `\\.\DISPLAY2`). Set automatically when you pick a monitor in Settings. |
| `kairo-notch-monitor-mode` | `"primary"` / `"all"` / `"specific"` | `"primary"` | Where the notch appears. Same values as the dock. |
| `kairo-notch-monitor-id` | string | `""` | Windows display name of the monitor to use when the notch mode is `"specific"`. Set automatically when you pick a monitor in Settings. |

If the chosen monitor is unplugged, Kairo falls back to the primary display.

With **All Monitors** and more than one display, the **Per-Monitor Behavior** toggle on the Dock and Notch tabs gives each monitor its own Fixed / Smart / Peek. Turning it off goes back to one behavior for all of them.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-dock-mode-by-monitor` | JSON string | `"{}"` | Per-monitor dock behavior: a JSON object mapping each Windows display name (as in `kairo-dock-monitor-id`) to `"fixed"`, `"smart"` or `"peek"`. A monitor without an entry uses `kairo-dock-mode`. |
| `kairo-notch-mode-by-monitor` | JSON string | `"{}"` | Same as above for the notch, falling back to `kairo-notch-mode`. |

### Weather

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-weather-enabled` | `"true"` / `"false"` | `"true"` | Show weather widget in the notch status bar. |
| `kairo-weather-city` | string | `""` | Manually set city name for weather. Empty string = auto-detect via IP geolocation (HTTPS only). If detection fails and no city is set, no weather is shown. |
| `kairo-weather-lat` | number string | (auto) | Latitude coordinate for weather. Set automatically when a city is selected. |
| `kairo-weather-lon` | number string | (auto) | Longitude coordinate for weather. Set automatically when a city is selected. |
| `kairo-weather-cached-temp` | number string | (none) | Cached temperature value shown before next API fetch. |
| `kairo-weather-cached-condition` | string | (none) | Cached weather condition text (e.g. "Partly Cloudy"). |
| `kairo-weather-ip-location` | JSON `{"lat":0,"lon":0,"city":""}` | (none) | The last location found from the IP address, kept so the weather still loads when the lookup fails. Set automatically. |
| `kairo-temp-unit` | `"celsius"` / `"fahrenheit"` | `"celsius"` | Temperature display unit. |

### Modules

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-calendar-enabled` | `"true"` / `"false"` | `"true"` | Show the calendar in the notch's calendar panel. |
| `kairo-timer-enabled` | `"true"` / `"false"` | follows `kairo-calendar-enabled` | Show the countdown timer (presets and a custom time) in the notch's calendar panel. |
| `kairo-timer-sound-enabled` | `"true"` / `"false"` | `"true"` | Play a short chime when the countdown timer finishes. |
| `kairo-stopwatch-enabled` | `"true"` / `"false"` | follows `kairo-calendar-enabled` | Show the stopwatch (with laps) next to the timer. |
| `kairo-dual-clock-enabled` | `"true"` / `"false"` | `"false"` | Show a second clock for another time zone next to the time in the notch. Follows `kairo-time-format-24h`, and shows `+1` / `−1` when that zone is on a different day. |
| `kairo-dual-clock-zone` | IANA time zone string | `"UTC"` | Time zone of the second clock, for example `"Asia/Tokyo"`. Set by searching a city or time zone in Settings › Notch › Dual Clock. |
| `kairo-dual-clock-label` | string | `"UTC"` | Name shown beside the second clock, for example `"Tokyo"`. |
| `kairo-calendar-view` | `"day"` / `"week"` / `"month"` / `"agenda"` | `"month"` | Which view the notch calendar shows once a calendar source is connected. Set by the Day / Week / Month / Agenda switcher in the notch. |
| `kairo-calendar-window-view` | `"day"` / `"week"` / `"month"` / `"agenda"` | `"month"` | Which view the Calendar window opens on. It remembers the last one you used. |
| `kairo-calendar-hidden` | JSON array of strings | `[]` | Calendars you switched off in the Calendar window. Set by the window. |
| `kairo-clock-tab` | `"timer"` / `"stopwatch"` | `"timer"` | Which tab the notch clock panel opens on. It remembers the last one you used. |
| `kairo-music-mode-enabled` | `"true"` / `"false"` | `"true"` | Enable interactive music media widget. |
| `kairo-music-compact-notch` | `"true"` / `"false"` | `"true"` | Show compact music display (visualizer + artwork) in collapsed notch. |

### Calendar Sync (links and CalDAV)

Read-only sync of your calendars into the notch calendar. Open Settings › Notch › Calendar Sync (shown while Calendar is on). There are two ways to connect, and you can use both at once. Kairo never writes to a server.

- **Calendar links** need no password: paste a Google, iCloud, Outlook, Proton, Nextcloud or any other `.ics` / `webcal://` link. Repeating events, exceptions and time zones are expanded locally.
- **CalDAV account** (Nextcloud, iCloud, or any CalDAV server) also reads private calendars, using an app password.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-caldav-enabled` | `"true"` / `"false"` | `"false"` | Whether calendar sync is active. Set to `"true"` when you connect and `"false"` when you disconnect. |
| `kairo-caldav-url` | string | `""` | Server address, for example `cloud.example.com`. A bare host is expanded to `/remote.php/dav/`; you can also give a full CalDAV URL. iCloud uses `https://caldav.icloud.com` (filled in for you) with an app-specific password. |
| `kairo-caldav-username` | string | `""` | Account username. |
| `kairo-caldav-interval` | number string | `"15"` | Minutes between background syncs. Minimum `5`. |

`kairo-caldav-interval` applies to every source, links included. After Kairo restarts or crashes it syncs right away instead of waiting out the interval, and retries a few times if the network isn't back yet.

Secrets are **not** in `settings.json`. The CalDAV app password lives in Windows Credential Manager as `Kairo CalDAV`, and each calendar link (which acts like a password, since anyone holding it can read the calendar) lives there as `Kairo Calendar Link`. Everything else is local to the app config directory:

| File | Contents |
|------|----------|
| `calendar_links.json` | The names and provider of your calendar links (not the links themselves). |
| `calendar_cache.json` | Synced events, so the calendar works offline. Nothing is sent to any third-party service. |

Removing a link or disconnecting the account deletes its stored secret and cached events. If a CalDAV server rejects the login, automatic syncing of that account pauses until you reconnect, so a wrong password can't trigger a lockout. Events from 35 days back to 95 days ahead are synced.

### Music Appearance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-media-layout` | `"classic"` / `"compact"` | `"classic"` | Expanded player style. **classic** = large album art. **compact** = small thumbnail + controls. |
| `kairo-media-ambience-enabled` | `"true"` / `"false"` | `"true"` | Colored ambient glow behind expanded album art. |
| `kairo-media-compact-glow-enabled` | `"true"` / `"false"` | `"true"` | Glow effect around the collapsed compact thumbnail. |
| `kairo-media-visualizer-enabled` | `"true"` / `"false"` | `"true"` | Audio visualizer bars in music mode. Also accepts `kairo-visualizer-enabled` (legacy alias). |
| `kairo-media-album-art-enabled` | `"true"` / `"false"` | `"true"` | Show album artwork in the notch music display. |
| `kairo-media-artwork-theme` | `"true"` / `"false"` | `"false"` | Tint the notch music panel with colors extracted from the album art. |

### Overlays

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-volume-overlay-enabled` | `"true"` / `"false"` | `"true"` | Show Kairo volume HUD when volume changes (replaces native Windows OSD). |
| `kairo-volume-edge-enabled` | `"true"` / `"false"` | `"true"` | Trigger volume HUD by hovering the left screen edge. |
| `kairo-brightness-overlay-enabled` | `"true"` / `"false"` | `"true"` | Show Kairo brightness HUD when brightness changes. |
| `kairo-brightness-edge-enabled` | `"true"` / `"false"` | `"true"` | Trigger brightness HUD by hovering the right screen edge. |
| `kairo-edge-delay` | number string (ms) | `"300"` | How long the cursor has to rest on the left or right screen edge before the volume or brightness HUD appears. `0` shows it instantly. Only the edge strip of the primary monitor counts, so being on another monitor never opens the HUD. |
| `kairo-volume-side` | `"left"` / `"right"` | `"left"` | Screen edge the volume slider appears on. The brightness slider is moved to the opposite edge when both would share one. |
| `kairo-brightness-side` | `"left"` / `"right"` | `"right"` | Screen edge the brightness slider appears on. |

### Appearance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-theme-mode` | `"auto"` / `"dark"` / `"light"` / `"custom"` / `"adaptive"` | `"dark"` | Theme mode. **auto** = dark or light, following the Windows app mode. **dark** = dark translucent. **light** = light translucent. **custom** = user-picked color. **adaptive** = follows Windows system accent color. The Presets in Settings › Appearance set `custom` mode with a matching color, saturation, brightness and accent. |
| `kairo-theme-color` | hex string | `"#007aff"` | Custom theme color (used in `custom` and `adaptive` modes). |
| `kairo-theme-opacity` | float string | `"0.80"` | Background opacity (0.1 to 1.0). |
| `kairo-theme-saturation` | float string | `"0.50"` | Color saturation for custom/adaptive themes (0.0 to 1.0). |
| `kairo-theme-brightness` | float string | `"0.15"` | Background brightness for custom/adaptive themes (0.0 to 1.0). |
| `kairo-theme-style` | `"solid"` / `"frosted"` / `"liquid"` / `"fluid"` / `"material"` | `"solid"` | How the notch, dock and volume/brightness overlays are drawn. **solid** = plain fill. **frosted** = milky haze with fine grain. **liquid** = clear glass with bright rims and a sheen. **fluid** = nearly clear glass: a light tint over a barely blurred wallpaper, a bright rim, an inner sheen on the side away from the screen edge, and glass-bubble dock tiles. **material** = Material You tonal palette built from the accent color (the Windows accent when the accent is `mono`). Picking a style in Settings also sets `kairo-theme-opacity` to the value it is tuned for (0.8, 0.6, 0.45, 0.25, 0.96). The notch and dock windows are transparent, so the glass styles show a blurred copy of the wallpaper on their monitor behind them, lined up with the screen (a solid color desktop shows that color). When an app window is behind them, they switch to a see-through tint so that window shows through instead. The volume/brightness overlays always use the tint. The notch uses a denser fill (at least 82%) while the calendar, command center or shelf is open, so the text stays readable. Legacy Mode always uses Solid with monochrome highlights. |
| `kairo-glass-wallpaper` | `"true"` / `"false"` | `"false"` | Frosted and Liquid only. Show a blurred copy of the desktop wallpaper behind the notch and dock, and the window behind them when there is one. Off keeps the plain tint. Animated wallpapers (Wallpaper Engine) are not shown. |
| `kairo-sync-windows-accent` | `"true"` / `"false"` | `"false"` | Only with a custom accent (`kairo-theme-accent` = `custom`). Also sets the Windows system accent to `kairo-theme-accent-color`: the DWM `AccentColor`, `ColorizationColor` and `ColorizationAfterglow` values and the Explorer `AccentColorMenu`, `StartColorMenu` and `AccentPalette` values under `HKCU`. The first time it is turned on Kairo saves the previous values to `windows-accent-backup.json` in the settings folder, and turning it off writes them back and deletes the file. |
| `kairo-theme-accent` | `"mono"` / `"system"` / `"custom"` | `"mono"` | Color for toggles, active buttons, sliders, progress bars and today's date. **mono** = the text color (the classic look). **system** = Windows accent. **custom** = `kairo-theme-accent-color`. Ignored in Legacy Mode. |
| `kairo-theme-accent-color` | hex string | `"#0a84ff"` | Accent used when `kairo-theme-accent` is `custom`. |
| `kairo-corners-enabled` | `"true"` / `"false"` | `"false"` | Render rounded screen corner overlays on top edges. |

### Status Widgets

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-net-widget-mode` | `"speed"` / `"status"` | `"speed"` | What the `net` status widget shows. **speed** = live upload and download speed. **status** = an icon for Wi-Fi, Ethernet or offline, with a tooltip. Set in Settings > Notch > Network widget. |
| `kairo-ram-widget-mode` | `"percent"` / `"gb"` | `"percent"` | What the `ram` status widget shows. **percent** = memory in use as a percent. **gb** = used and total memory, like `9.4/16G`. Set in Settings > Notch > RAM widget. |
| `kairo-fps-access-requested` | `"true"` / absent | absent | Set by Kairo after you approve the FPS counter in Settings > Notch > FPS counter. It only decides whether that row says "sign out to finish": the approval itself adds your account to the Windows group **Performance Log Users**, which Windows applies at the next sign-in. To undo it, remove your account from that group in Computer Management. |
| `kairo-notch-hotkey` | string | `""` | Global shortcut that hides the notch until pressed again, written like `"Ctrl+Alt+N"`: any of Win, Ctrl, Alt, Shift, then one key (same keys as `kairo-dock-search-shortcut`). Empty is off. If another program already uses the shortcut, Kairo logs it and the shortcut does nothing. Set in Settings > Notch > Shortcut by clicking the box and pressing the keys. The hidden state is not saved: the notch is back after a restart. |
| `kairo-status-widgets` | JSON string | `{"left":["weather"],"right":["battery"]}` | Widget layout in collapsed notch. Available: `"weather"`, `"battery"`, `"cpu"`, `"ram"`, `"disk"`, `"net"`, `"gpu"`, `"fps"`. `"gpu"` shows the usage of the GPU with the most video memory, and its temperature when the driver reports one. `"fps"` shows the frame rate of the app in front (tooltip: frame time and 1% low) and needs the one-time FPS counter approval; it counts Direct3D 9 to 12 games, and Vulkan or OpenGL games only when the driver presents them through DXGI. The `"battery"` widget (and its low-battery/charging pulses) is automatically suppressed on desktops with no physical battery — detected via Windows' `PowerManager.BatteryStatus`, not the browser's Battery API (which fakes a permanent "100%, charging" reading on desktops). It's also silently dropped from a placed config on such machines, even if set manually or imported from a laptop's settings file. |

Example:
```json
{
  "kairo-status-widgets": "{\"left\":[\"cpu\",\"ram\"],\"right\":[\"battery\",\"net\"]}"
}
```

### System

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `kairo-scale` | float string | `"1.0"` | UI scale factor (0.8 to 1.3). Changing this re-registers AppBars to resize the reserved screen area. |
| `kairo-low-battery-threshold` | integer string | `"20"` | Battery percentage that triggers the low-battery alert pulse (5 to 50, step 5). |
| `kairo-time-format-24h` | `"true"` / `"false"` | `"false"` | Use 24-hour clock format in the notch. When `"false"`, displays 12-hour format with AM/PM. |
| `kairo-language` | `"system"` / language code, e.g. `"en"` | `"system"` | UI language: `en`, `tr`, `de`, `es`, `fr` and `ar` (Arabic mirrors the Settings and Calendar windows right to left). `"system"` follows the Windows display language and falls back to English when that language has no translation. Missing keys in a translation fall back to English. Translations live in `src/locales/<code>.json` and are registered in `src/i18n.ts` and `src-tauri/src/i18n.rs` (tray menu). Calendar dates and times follow this language too. |
| `kairo-tour-seen` | `"1"` | unset | Set once the first-run tour has been finished or skipped. Delete it to see the tour again, or use Settings > About > Replay Tour. |
| `kairo-legacy-mode` | `"true"` / `"false"` | `"false"` | Keep the classic notch and dock. Turns off features added after 1.4 (dock Task View, Recycle Bin and drive buttons, and later additions). Settings > General > Legacy Mode. |
| `kairo-ram-saver` | `"true"` / `"false"` | `"false"` | Hand unused pages back to Windows a few seconds after you stop interacting, and re-trim while the app stays idle. The app is a WebView2 host, so most of its footprint is cache that Chromium would otherwise keep resident forever; this is what brings it from ~125 MB down to ~20 MB of private working set. Applied live, no restart. Settings > General > Memory Saver. |
| `kairo-ram-ultra` | `"true"` / `"false"` | `"false"` | Adds `--disable-gpu` to the WebView2 arguments, which removes the GPU process and about 140 MB of commit at the cost of software rasterising the blur effects. **Requires a restart** (WebView2 reads its arguments once at startup). Settings > General > Maximum Memory Saving. |

### Internal (Do Not Edit Manually)

| Key | Type | Description |
|-----|------|-------------|
| `kairo-first-run` | sentinel | Set to `"done"` after first launch. Triggers splash screen if absent. |
| `kairo-app-version` | string | Last known app version. If it differs from current, the splash screen is shown. |

## Event System

Kairo uses two Tauri events for settings synchronization:

### `settings-changed`
- **Emitted by:** `save_setting` command (frontend or backend)
- **Payload:** `{ "key": "kairo-...", "value": ... }`
- **Purpose:** Broadcasts changes made through the Kairo UI to all windows
- **Key format:** Kairo-prefixed keys as-is (e.g. `"kairo-dock-mode"`)

### `settings-external-changed`
- **Emitted by:** File watcher (detects external edits to `settings.json`)
- **Payload:** `{ "key": "kairo-...", "value": ... }` or `{ "key": "kairo-...", "value": null }` for removed keys
- **Purpose:** Broadcasts changes made by external editors (VS Code, notepad, scripts)
- **Key format:** Kairo-prefixed keys as-is
- **Behavior:** Also syncs values to `localStorage` for instant frontend reads

### Flow
```
External editor saves settings.json
    ↓
File watcher detects change (ReadDirectoryChangesW)
    ↓
Diffs against SETTINGS_CACHE
    ↓
Emits settings-external-changed for each changed/removed key
    ↓
useSettingsSync hook updates React state + localStorage
    ↓
UI re-renders with new values
```

## Example: Changing Dock Mode via Script

```powershell
# PowerShell: switch dock to smart mode
$json = Get-Content "$env:APPDATA\com.kairo.desktop\settings.json" | ConvertFrom-Json
$json.'kairo-dock-mode' = 'smart'
$json | ConvertTo-Json | Set-Content "$env:APPDATA\com.kairo.desktop\settings.json"
```

```python
# Python: disable dock
import json, os
path = os.path.join(os.environ['APPDATA'], 'com.kairo.desktop', 'settings.json')
with open(path) as f: settings = json.load(f)
settings['kairo-dock-enabled'] = 'false'
with open(path, 'w') as f: json.dump(settings, f)
```

## Notes

- All boolean values are strings (`"true"` / `"false"`) for consistency with `localStorage`.
- The `useSettingsSync` hook auto-converts `"true"` / `"false"` strings to booleans.
- `auto-hide` mode values in `kairo-dock-mode` and `kairo-notch-mode` are legacy aliases for `smart` — they are mapped automatically.
- Changing `kairo-scale` triggers AppBar re-registration to adjust reserved screen space.
- Theme changes (`kairo-theme-*`) are applied by reading all theme values from `localStorage` and calling `applyTheme()` — the theme system depends on all the theme keys being in sync.
