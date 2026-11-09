import { useState, useEffect, useCallback } from "react";
import { parseCcLayout, parsePanelOrder, type CcLayout, type PanelId } from "../panelOrder";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { useSettingsSync } from "../hooks/useSettingsSync";
import { hexToHsl, DEFAULT_ACCENT_COLOR, STYLE_OPACITY, type ThemePreset } from "../theme";
import { DEFAULT_DUAL_CLOCK_ZONE } from "../dualClock";
import type { WidgetConfig, MonitorInfo, MonitorMode } from "./types";

function saveSetting(key: string, value: string) {
  localStorage.setItem(key, value);
  invoke("save_setting", { key, value }).catch(console.error);
}

function readBool(val: string | null): boolean {
  return val === "true";
}

export interface HiddenDockApp { id: string; name: string }

function parseHiddenApps(val: unknown): HiddenDockApp[] {
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(parsed)
      ? parsed.filter((h): h is HiddenDockApp => !!h && typeof h.id === "string" && typeof h.name === "string")
      : [];
  } catch {
    return [];
  }
}

function parseDrives(val: string | null): string[] {
  try {
    const parsed = JSON.parse(val ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export function useSettings() {
  const [autostart, setAutostart] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(true);
  const [notchTimerProgress, setNotchTimerProgress] = useState(
    () => localStorage.getItem("kairo-notch-timer-progress") !== "false"
  );
  const [stopwatchEnabled, setStopwatchEnabled] = useState(true);
  const [dualClockEnabled, setDualClockEnabled] = useState(
    () => localStorage.getItem("kairo-dual-clock-enabled") === "true"
  );
  const [dualClockZone, setDualClockZone] = useState(
    () => localStorage.getItem("kairo-dual-clock-zone") || DEFAULT_DUAL_CLOCK_ZONE
  );
  const [dualClockLabel, setDualClockLabel] = useState(
    () => localStorage.getItem("kairo-dual-clock-label") || DEFAULT_DUAL_CLOCK_ZONE
  );
  const [musicModeEnabled, setMusicModeEnabled] = useState(true);
  const [musicCompactNotch, setMusicCompactNotch] = useState(true);
  const [agentApi, setAgentApi] = useState(() => localStorage.getItem("kairo-agent-api") === "true");
  const [notchScrollVolume, setNotchScrollVolume] = useState(
    () => localStorage.getItem("kairo-notch-scroll-volume") === "true"
  );
  const [rememberMode, setRememberMode] = useState(
    () => localStorage.getItem("kairo-notch-remember-mode") === "true"
  );
  const [shelfPersist, setShelfPersist] = useState(
    () => localStorage.getItem("kairo-shelf-persist") === "true"
  );
  const [volumeOverlayEnabled, setVolumeOverlayEnabled] = useState(true);
  const [volumeEdgeEnabled, setVolumeEdgeEnabled] = useState(
    () => localStorage.getItem("kairo-volume-edge-enabled") !== "false"
  );
  const [brightnessOverlayEnabled, setBrightnessOverlayEnabled] = useState(
    () => localStorage.getItem("kairo-brightness-overlay-enabled") !== "false"
  );
  const [brightnessEdgeEnabled, setBrightnessEdgeEnabled] = useState(
    () => localStorage.getItem("kairo-brightness-edge-enabled") !== "false"
  );
  const [mediaAmbienceEnabled, setMediaAmbienceEnabled] = useState(true);
  const [mediaCompactGlowEnabled, setMediaCompactGlowEnabled] = useState(true);
  const [mediaArtworkThemeEnabled, setMediaArtworkThemeEnabled] = useState(
    () => localStorage.getItem("kairo-media-artwork-theme") === "true"
  );
  const [mediaLayout, setMediaLayout] = useState<"classic" | "compact">(
    () => (localStorage.getItem("kairo-media-layout") as "classic" | "compact") || "classic"
  );
  const [cornersEnabled, setCornersEnabled] = useState(
    () => localStorage.getItem("kairo-corners-enabled") === "true"
  );
  const [timeFormat24h, setTimeFormat24h] = useState(
    () => localStorage.getItem("kairo-time-format-24h") === "true"
  );
  const [legacyMode, setLegacyMode] = useState(
    () => localStorage.getItem("kairo-legacy-mode") === "true"
  );
  const [ramSaver, setRamSaver] = useState(
    () => localStorage.getItem("kairo-ram-saver") === "true"
  );
  const [ramUltra, setRamUltra] = useState(
    () => localStorage.getItem("kairo-ram-ultra") === "true"
  );
  const [tempUnitFahrenheit, setTempUnitFahrenheit] = useState(false);
  const [cityName, setCityName] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState<
    Array<{ name: string; country: string; latitude: number; longitude: number }>
  >([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [statusWidgets, setStatusWidgets] = useState<WidgetConfig>({
    left: ["weather"],
    right: ["battery"],
  });
  const [dockEnabled, setDockEnabled] = useState(true);
  const [dockPreviewEnabled, setDockPreviewEnabled] = useState(true);
  const [dockAttentionEnabled, setDockAttentionEnabled] = useState(true);
  const [dockSearchEnabled, setDockSearchEnabled] = useState(true);
  const [dockSearchProvider, setDockSearchProvider] = useState(
    () => localStorage.getItem("kairo-dock-search-provider") || "windows"
  );
  const [dockSearchShortcut, setDockSearchShortcut] = useState(
    () => localStorage.getItem("kairo-dock-search-shortcut") || ""
  );
  const [dockCalendarEnabled, setDockCalendarEnabled] = useState(true);
  const [dockTray, setDockTray] = useState(
    () => localStorage.getItem("kairo-dock-tray-enabled") !== "false"
  );
  const [dockShowDesktop, setDockShowDesktop] = useState(
    () => localStorage.getItem("kairo-dock-show-desktop-corner") === "true"
  );
  const [panelControlCenter, setPanelControlCenter] = useState(
    () => localStorage.getItem("kairo-panel-control-center-enabled") !== "false"
  );
  const [panelOrder, setPanelOrder] = useState<PanelId[] | null>(
    () => parsePanelOrder(localStorage.getItem("kairo-panel-order"))
  );
  const [ccLayout, setCcLayout] = useState<CcLayout>(
    () => parseCcLayout(localStorage.getItem("kairo-cc-layout"))
  );
  const [panelShelf, setPanelShelf] = useState(
    () => localStorage.getItem("kairo-panel-shelf-enabled") !== "false"
  );
  const [dockTaskView, setDockTaskView] = useState(
    () => localStorage.getItem("kairo-dock-taskview-enabled") === "true"
  );
  const [dockRecycle, setDockRecycle] = useState(
    () => localStorage.getItem("kairo-dock-recycle-enabled") === "true"
  );
  const [dockDrives, setDockDrives] = useState<string[]>(() => parseDrives(localStorage.getItem("kairo-dock-drives")));
  const [hiddenDockApps, setHiddenDockApps] = useState<HiddenDockApp[]>(() => parseHiddenApps(localStorage.getItem("kairo-dock-hidden-apps")));
  const [dockIconOnly, setDockIconOnly] = useState(
    () => localStorage.getItem("kairo-dock-icon-only") === "true"
  );
  const [startIcon, setStartIcon] = useState(
    () => localStorage.getItem("kairo-start-icon") || "default"
  );
  const [dockAdaptive, setDockAdaptive] = useState(
    () => localStorage.getItem("kairo-dock-adaptive") === "true"
  );
  const [dockWinNumberEnabled, setDockWinNumberEnabled] = useState(
    () => localStorage.getItem("kairo-dock-win-number-enabled") !== "false"
  );
  const [dockMixedReorder, setDockMixedReorder] = useState(
    () => localStorage.getItem("kairo-dock-mixed-reorder") === "true"
  );
  const [dockMode, setDockMode] = useState(() => {
    const raw = localStorage.getItem("kairo-dock-mode") || "smart";
    return raw === "auto-hide" ? "smart" : raw;
  });
  const [notchMode, setNotchMode] = useState("fixed");
  const [dockMonitorMode, setDockMonitorMode] = useState<MonitorMode>(
    () => (localStorage.getItem("kairo-dock-monitor-mode") as MonitorMode) || "primary"
  );
  const [dockMonitorId, setDockMonitorId] = useState(
    () => localStorage.getItem("kairo-dock-monitor-id") || ""
  );
  const [notchMonitorMode, setNotchMonitorMode] = useState<MonitorMode>(
    () => (localStorage.getItem("kairo-notch-monitor-mode") as MonitorMode) || "primary"
  );
  const [notchMonitorId, setNotchMonitorId] = useState(
    () => localStorage.getItem("kairo-notch-monitor-id") || ""
  );
  const [dockModeByMonitor, setDockModeByMonitor] = useState<Record<string, string>>({});
  const [notchModeByMonitor, setNotchModeByMonitor] = useState<Record<string, string>>({});
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [lowBatteryThreshold, setLowBatteryThreshold] = useState(20);
  const [hasBattery, setHasBattery] = useState(() => localStorage.getItem("kairo-has-battery") !== "false");
  const [appVersion, setAppVersion] = useState("");
  const [scale, setScale] = useState(
    () => parseFloat(localStorage.getItem("kairo-scale") || "1.0")
  );
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("kairo-theme-mode") || "dark"
  );
  const [themeColor, setThemeColor] = useState(
    () => localStorage.getItem("kairo-theme-color") || "#007aff"
  );
  const [themeOpacity, setThemeOpacity] = useState(() => {
    const val = localStorage.getItem("kairo-theme-opacity");
    return val !== null ? parseFloat(val) : 0.8;
  });
  const [themeSaturation, setThemeSaturation] = useState(() => {
    const val = localStorage.getItem("kairo-theme-saturation");
    return val !== null ? parseFloat(val) : 0.5;
  });
  const [themeBrightness, setThemeBrightness] = useState(() => {
    const val = localStorage.getItem("kairo-theme-brightness");
    return val !== null ? parseFloat(val) : 0.15;
  });
  const [themeStyle, setThemeStyle] = useState(() => localStorage.getItem("kairo-theme-style") || "solid");
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem("kairo-theme-accent") || "mono");
  const [themeAccentColor, setThemeAccentColor] = useState(
    () => localStorage.getItem("kairo-theme-accent-color") || DEFAULT_ACCENT_COLOR
  );
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [resetStatus, setResetStatus] = useState<"idle" | "confirm" | "resetting">("idle");
  const [uninstallStatus, setUninstallStatus] = useState<"idle" | "confirm" | "uninstalling" | "error">("idle");
  const [uninstallError, setUninstallError] = useState("");

  // ── Load all settings from backend + localStorage ──
  const loadAllSettings = useCallback(async () => {
    try {
      const settings: Record<string, string> = await invoke("load_settings");
      const getVal = (key: string) => {
        const val = settings[key];
        if (val !== undefined && val !== null) return String(val);
        return localStorage.getItem(key);
      };

      const apply = <T>(val: string | null, setter: (v: T) => void, transform: (v: string) => T) => {
        if (val !== null) setter(transform(val));
      };

      apply(getVal("kairo-weather-enabled"), setWeatherEnabled, readBool);
      apply(getVal("kairo-calendar-enabled"), setCalendarEnabled, readBool);
      apply(getVal("kairo-timer-enabled") ?? getVal("kairo-calendar-enabled"), setTimerEnabled, readBool);
      apply(getVal("kairo-timer-sound-enabled"), setTimerSoundEnabled, readBool);
      apply(getVal("kairo-notch-timer-progress"), setNotchTimerProgress, readBool);
      apply(getVal("kairo-stopwatch-enabled") ?? getVal("kairo-calendar-enabled"), setStopwatchEnabled, readBool);
      apply(getVal("kairo-dual-clock-enabled"), setDualClockEnabled, readBool);
      apply(getVal("kairo-dual-clock-zone"), setDualClockZone, (v) => v);
      apply(getVal("kairo-dual-clock-label"), setDualClockLabel, (v) => v);
      apply(getVal("kairo-music-mode-enabled"), setMusicModeEnabled, readBool);
      apply(getVal("kairo-music-compact-notch"), setMusicCompactNotch, readBool);
      apply(getVal("kairo-notch-scroll-volume"), setNotchScrollVolume, (v) => v === "true");
      apply(getVal("kairo-agent-api"), setAgentApi, (v) => v === "true");
      apply(getVal("kairo-shelf-persist"), setShelfPersist, (v) => v === "true");
      apply(getVal("kairo-notch-remember-mode"), setRememberMode, (v) => v === "true");
      apply(getVal("kairo-volume-overlay-enabled"), setVolumeOverlayEnabled, readBool);
      apply(getVal("kairo-brightness-overlay-enabled"), setBrightnessOverlayEnabled, readBool);
      apply(getVal("kairo-media-ambience-enabled"), setMediaAmbienceEnabled, readBool);
      apply(getVal("kairo-media-compact-glow-enabled"), setMediaCompactGlowEnabled, readBool);
      apply(getVal("kairo-media-artwork-theme"), setMediaArtworkThemeEnabled, (v) => v === "true");
      apply(getVal("kairo-corners-enabled"), setCornersEnabled, readBool);
      apply(getVal("kairo-time-format-24h"), setTimeFormat24h, readBool);
      apply(getVal("kairo-legacy-mode"), setLegacyMode, readBool);
      apply(getVal("kairo-ram-saver"), setRamSaver, (v) => v === "true");
      apply(getVal("kairo-ram-ultra"), setRamUltra, readBool);
      apply(getVal("kairo-volume-edge-enabled"), setVolumeEdgeEnabled, readBool);
      apply(getVal("kairo-brightness-edge-enabled"), setBrightnessEdgeEnabled, readBool);
      apply(getVal("kairo-dock-enabled"), setDockEnabled, readBool);
      apply(getVal("kairo-dock-preview-enabled"), setDockPreviewEnabled, readBool);
      apply(getVal("kairo-dock-attention-enabled"), setDockAttentionEnabled, (v) => v !== "false");
      apply(getVal("kairo-dock-search-enabled"), setDockSearchEnabled, readBool);
      apply(getVal("kairo-dock-search-provider"), setDockSearchProvider, (v) => v);
      apply(getVal("kairo-dock-search-shortcut"), setDockSearchShortcut, (v) => v);
      apply(getVal("kairo-dock-calendar-enabled"), setDockCalendarEnabled, readBool);
      apply(getVal("kairo-dock-tray-enabled"), setDockTray, (v) => v !== "false");
      apply(getVal("kairo-dock-taskview-enabled"), setDockTaskView, readBool);
      apply(getVal("kairo-dock-show-desktop-corner"), setDockShowDesktop, readBool);
      apply(getVal("kairo-panel-control-center-enabled"), setPanelControlCenter, (v) => v !== "false");
      apply(getVal("kairo-panel-shelf-enabled"), setPanelShelf, (v) => v !== "false");
      apply(getVal("kairo-panel-order"), setPanelOrder, (v) => parsePanelOrder(v));
      apply(getVal("kairo-cc-layout"), setCcLayout, (v) => parseCcLayout(v));
      apply(getVal("kairo-dock-recycle-enabled"), setDockRecycle, readBool);
      apply(getVal("kairo-dock-drives"), setDockDrives, parseDrives);
      apply(getVal("kairo-dock-hidden-apps"), setHiddenDockApps, parseHiddenApps);
      apply(getVal("kairo-dock-icon-only"), setDockIconOnly, readBool);
      apply(getVal("kairo-start-icon"), setStartIcon, (v) => v);
      apply(getVal("kairo-dock-adaptive"), setDockAdaptive, readBool);
      apply(getVal("kairo-dock-win-number-enabled"), setDockWinNumberEnabled, readBool);
      apply(getVal("kairo-dock-mixed-reorder"), setDockMixedReorder, readBool);

      apply(getVal("kairo-temp-unit"), setTempUnitFahrenheit, (v) => v === "fahrenheit");
      apply(getVal("kairo-scale"), setScale, parseFloat);
      apply(getVal("kairo-low-battery-threshold"), setLowBatteryThreshold, parseInt);

      apply(getVal("kairo-notch-mode"), setNotchMode, (v) => (v === "auto-hide" ? "smart" : v));
      apply(getVal("kairo-dock-mode"), setDockMode, (v) => (v === "auto-hide" ? "smart" : v));

      apply(getVal("kairo-dock-monitor-mode"), setDockMonitorMode, (v) => v as MonitorMode);
      apply(getVal("kairo-dock-monitor-id"), setDockMonitorId, (v) => v);
      apply(getVal("kairo-notch-monitor-mode"), setNotchMonitorMode, (v) => v as MonitorMode);
      apply(getVal("kairo-notch-monitor-id"), setNotchMonitorId, (v) => v);

      const dockByMonVal = getVal("kairo-dock-mode-by-monitor");
      if (dockByMonVal) {
        try { setDockModeByMonitor(JSON.parse(dockByMonVal)); } catch {}
      }
      const notchByMonVal = getVal("kairo-notch-mode-by-monitor");
      if (notchByMonVal) {
        try { setNotchModeByMonitor(JSON.parse(notchByMonVal)); } catch {}
      }

      const savedCity = getVal("kairo-weather-city");
      if (savedCity) {
        setCityName(savedCity);
        setCityQuery(savedCity);
      }

      apply(getVal("kairo-theme-mode"), setThemeMode, (v) => v);
      apply(getVal("kairo-theme-color"), setThemeColor, (v) => v);
      apply(getVal("kairo-theme-opacity"), setThemeOpacity, parseFloat);
      apply(getVal("kairo-theme-saturation"), setThemeSaturation, parseFloat);
      apply(getVal("kairo-theme-brightness"), setThemeBrightness, parseFloat);
      apply(getVal("kairo-theme-style"), setThemeStyle, (v) => v);
      apply(getVal("kairo-theme-accent"), setThemeAccent, (v) => v);
      apply(getVal("kairo-theme-accent-color"), setThemeAccentColor, (v) => v);

      const widgetsVal = getVal("kairo-status-widgets");
      if (widgetsVal) {
        try {
          const parsed = JSON.parse(widgetsVal);
          if (parsed && Array.isArray(parsed.left) && Array.isArray(parsed.right)) {
            setStatusWidgets(parsed);
          }
        } catch {}
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  // ── Initialize on mount ──
  useEffect(() => {
    loadAllSettings();

    invoke<boolean>("get_autostart")
      .then(setAutostart)
      .catch(() => {});

    getVersion()
      .then((ver) => setAppVersion(ver))
      .catch(() => setAppVersion(""));

    invoke<boolean>("has_battery").then((present) => {
      setHasBattery(present);
      localStorage.setItem("kairo-has-battery", String(present));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const refreshMonitors = () => {
      invoke<MonitorInfo[]>("get_monitors").then(setMonitors).catch(() => {});
    };
    refreshMonitors();
    const unlisten = listen("monitors-changed", refreshMonitors);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ── Sync settings from other windows ──
  useSettingsSync({
    "kairo-dock-mode": setDockMode,
    "kairo-notch-mode": setNotchMode,
    "kairo-dock-monitor-mode": (v) => setDockMonitorMode(v as MonitorMode),
    "kairo-dock-monitor-id": setDockMonitorId,
    "kairo-notch-monitor-mode": (v) => setNotchMonitorMode(v as MonitorMode),
    "kairo-notch-monitor-id": setNotchMonitorId,
    "kairo-dock-mode-by-monitor": (v) => { try { setDockModeByMonitor(JSON.parse(v)); } catch {} },
    "kairo-notch-mode-by-monitor": (v) => { try { setNotchModeByMonitor(JSON.parse(v)); } catch {} },
    "kairo-dock-enabled": setDockEnabled,
    "kairo-dock-tray-enabled": (v) => setDockTray(v !== false && v !== "false"),
    "kairo-dock-taskview-enabled": setDockTaskView,
    "kairo-dock-show-desktop-corner": setDockShowDesktop,
    "kairo-panel-control-center-enabled": (v) => setPanelControlCenter(v !== false && v !== "false"),
    "kairo-panel-shelf-enabled": (v) => setPanelShelf(v !== false && v !== "false"),
    "kairo-panel-order": (v) => setPanelOrder(parsePanelOrder(v === null ? null : String(v))),
    "kairo-cc-layout": (v) => setCcLayout(parseCcLayout(v === null ? null : String(v))),
    "kairo-dock-recycle-enabled": setDockRecycle,
    "kairo-dock-drives": (v) => setDockDrives(parseDrives(v)),
    "kairo-dock-hidden-apps": (v) => setHiddenDockApps(parseHiddenApps(v)),
    "kairo-dock-icon-only": setDockIconOnly,
    "kairo-start-icon": setStartIcon,
    "kairo-dock-adaptive": setDockAdaptive,
    "kairo-dock-win-number-enabled": setDockWinNumberEnabled,
    "kairo-dock-preview-enabled": setDockPreviewEnabled,
    "kairo-dock-attention-enabled": (v) => setDockAttentionEnabled(v !== false && v !== "false"),
    "kairo-dock-search-enabled": setDockSearchEnabled,
    "kairo-dock-search-provider": (v) => setDockSearchProvider(String(v)),
    "kairo-dock-search-shortcut": (v) => setDockSearchShortcut(String(v)),
    "kairo-dock-calendar-enabled": setDockCalendarEnabled,
    "kairo-dock-mixed-reorder": setDockMixedReorder,
    "kairo-weather-enabled": setWeatherEnabled,
    "kairo-calendar-enabled": setCalendarEnabled,
    "kairo-timer-enabled": setTimerEnabled,
    "kairo-timer-sound-enabled": setTimerSoundEnabled,
    "kairo-notch-timer-progress": setNotchTimerProgress,
    "kairo-stopwatch-enabled": setStopwatchEnabled,
    "kairo-dual-clock-enabled": setDualClockEnabled,
    "kairo-dual-clock-zone": (v) => setDualClockZone(String(v)),
    "kairo-dual-clock-label": (v) => setDualClockLabel(String(v)),
    "kairo-music-mode-enabled": setMusicModeEnabled,
    "kairo-music-compact-notch": setMusicCompactNotch,
    "kairo-notch-scroll-volume": setNotchScrollVolume,
    "kairo-agent-api": setAgentApi,
    "kairo-shelf-persist": setShelfPersist,
    "kairo-notch-remember-mode": setRememberMode,
    "kairo-media-ambience-enabled": setMediaAmbienceEnabled,
    "kairo-media-compact-glow-enabled": setMediaCompactGlowEnabled,
    "kairo-media-artwork-theme": setMediaArtworkThemeEnabled,
    "kairo-media-layout": setMediaLayout,
    "kairo-corners-enabled": setCornersEnabled,
    "kairo-time-format-24h": setTimeFormat24h,
    "kairo-legacy-mode": setLegacyMode,
    "kairo-ram-saver": (v) => setRamSaver(v === true || v === "true"),
    "kairo-ram-ultra": (v) => setRamUltra(v === true || v === "true"),
    "kairo-low-battery-threshold": setLowBatteryThreshold,
    "kairo-scale": setScale,
    "kairo-temp-unit": (v) => setTempUnitFahrenheit(v === "fahrenheit"),
    "kairo-volume-overlay-enabled": setVolumeOverlayEnabled,
    "kairo-volume-edge-enabled": setVolumeEdgeEnabled,
    "kairo-brightness-overlay-enabled": setBrightnessOverlayEnabled,
    "kairo-brightness-edge-enabled": setBrightnessEdgeEnabled,
    "kairo-theme-mode": setThemeMode,
    "kairo-theme-color": setThemeColor,
    "kairo-theme-opacity": setThemeOpacity,
    "kairo-theme-saturation": setThemeSaturation,
    "kairo-theme-brightness": setThemeBrightness,
    "kairo-theme-style": (v) => setThemeStyle(String(v)),
    "kairo-theme-accent": (v) => setThemeAccent(String(v)),
    "kairo-theme-accent-color": (v) => setThemeAccentColor(String(v)),
    "kairo-weather-city": (v) => {
      setCityName(v || "");
      setCityQuery(v || "");
    },
  });

  // ── Listen for system accent changes (adaptive theme) ──
  useEffect(() => {
    const unlisten = listen<string>("system-accent-changed", (event) => {
      const mode = localStorage.getItem("kairo-theme-mode") || "dark";
      if (mode === "adaptive") {
        try {
          const hsl = hexToHsl(event.payload);
          setThemeSaturation(hsl.s / 100);
          setThemeBrightness(hsl.l / 100);
        } catch (e) {
          console.error("Failed to parse system accent color change HSL:", e);
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ── City search debounce ──
  useEffect(() => {
    if (cityQuery.trim().length < 2 || cityQuery === cityName) {
      setCitySearchResults([]);
      setShowCityDropdown(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=5&language=en&format=json`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setCitySearchResults(
            data.results.map((r: any) => ({
              name: r.name,
              country: r.country || "",
              latitude: r.latitude,
              longitude: r.longitude,
            }))
          );
          setShowCityDropdown(true);
        } else {
          setCitySearchResults([]);
        }
      } catch {
        setCitySearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [cityQuery, cityName]);

  // ── Autostart ──
  const toggleAutostart = async () => {
    try {
      const next = !(await invoke<boolean>("get_autostart"));
      await invoke("set_autostart", { enabled: next });
      setAutostart(next);
    } catch (err) {}
  };

  // ── Simple boolean toggles ──
  const toggleWeather = () => {
    const next = !weatherEnabled;
    setWeatherEnabled(next);
    saveSetting("kairo-weather-enabled", String(next));
  };

  const toggleCalendar = () => {
    const next = !calendarEnabled;
    setCalendarEnabled(next);
    saveSetting("kairo-calendar-enabled", String(next));
  };

  const toggleTimerEnabled = () => {
    const next = !timerEnabled;
    setTimerEnabled(next);
    saveSetting("kairo-timer-enabled", String(next));
  };

  const toggleTimerSound = () => {
    const next = !timerSoundEnabled;
    setTimerSoundEnabled(next);
    saveSetting("kairo-timer-sound-enabled", String(next));
  };

  const toggleNotchTimerProgress = () => {
    const next = !notchTimerProgress;
    setNotchTimerProgress(next);
    saveSetting("kairo-notch-timer-progress", String(next));
  };

  const toggleStopwatchEnabled = () => {
    const next = !stopwatchEnabled;
    setStopwatchEnabled(next);
    saveSetting("kairo-stopwatch-enabled", String(next));
  };

  const toggleDualClock = () => {
    const next = !dualClockEnabled;
    setDualClockEnabled(next);
    saveSetting("kairo-dual-clock-enabled", String(next));
  };

  const selectDualClockZone = ({ label, zone }: { label: string; zone: string }) => {
    setDualClockZone(zone);
    setDualClockLabel(label);
    saveSetting("kairo-dual-clock-zone", zone);
    saveSetting("kairo-dual-clock-label", label);
  };

  const toggleMusicMode = () => {
    const next = !musicModeEnabled;
    setMusicModeEnabled(next);
    saveSetting("kairo-music-mode-enabled", String(next));
  };

  const toggleMusicCompactNotch = () => {
    const next = !musicCompactNotch;
    setMusicCompactNotch(next);
    saveSetting("kairo-music-compact-notch", String(next));
  };

  const toggleAgentApi = () => {
    const next = !agentApi;
    setAgentApi(next);
    saveSetting("kairo-agent-api", String(next));
  };

  const toggleNotchScrollVolume = () => {
    const next = !notchScrollVolume;
    setNotchScrollVolume(next);
    saveSetting("kairo-notch-scroll-volume", String(next));
  };

  const toggleRememberMode = () => {
    const next = !rememberMode;
    setRememberMode(next);
    saveSetting("kairo-notch-remember-mode", String(next));
  };

  const toggleShelfPersist = () => {
    const next = !shelfPersist;
    setShelfPersist(next);
    saveSetting("kairo-shelf-persist", String(next));
  };

  const toggleMediaLayout = (layout: "classic" | "compact") => {
    setMediaLayout(layout);
    saveSetting("kairo-media-layout", layout);
  };

  const toggleVolumeOverlay = () => {
    const next = !volumeOverlayEnabled;
    setVolumeOverlayEnabled(next);
    saveSetting("kairo-volume-overlay-enabled", String(next));
  };

  const toggleVolumeEdge = () => {
    const next = !volumeEdgeEnabled;
    setVolumeEdgeEnabled(next);
    saveSetting("kairo-volume-edge-enabled", String(next));
  };

  const toggleBrightnessOverlay = () => {
    const next = !brightnessOverlayEnabled;
    setBrightnessOverlayEnabled(next);
    saveSetting("kairo-brightness-overlay-enabled", String(next));
  };

  const toggleBrightnessEdge = () => {
    const next = !brightnessEdgeEnabled;
    setBrightnessEdgeEnabled(next);
    saveSetting("kairo-brightness-edge-enabled", String(next));
  };

  const toggleAmbience = () => {
    const next = !mediaAmbienceEnabled;
    setMediaAmbienceEnabled(next);
    saveSetting("kairo-media-ambience-enabled", String(next));
  };

  const toggleCompactGlow = () => {
    const next = !mediaCompactGlowEnabled;
    setMediaCompactGlowEnabled(next);
    saveSetting("kairo-media-compact-glow-enabled", String(next));
  };

  const toggleArtworkTheme = () => {
    const next = !mediaArtworkThemeEnabled;
    setMediaArtworkThemeEnabled(next);
    saveSetting("kairo-media-artwork-theme", String(next));
  };

  const toggleCorners = () => {
    const next = !cornersEnabled;
    setCornersEnabled(next);
    saveSetting("kairo-corners-enabled", String(next));
  };

  const toggleTimeFormat24h = () => {
    const next = !timeFormat24h;
    setTimeFormat24h(next);
    saveSetting("kairo-time-format-24h", String(next));
  };

  const toggleLegacyMode = () => {
    const next = !legacyMode;
    setLegacyMode(next);
    saveSetting("kairo-legacy-mode", String(next));
  };

  const toggleRamSaver = () => {
    const next = !ramSaver;
    setRamSaver(next);
    saveSetting("kairo-ram-saver", String(next));
  };

  const toggleRamUltra = () => {
    const next = !ramUltra;
    setRamUltra(next);
    saveSetting("kairo-ram-ultra", String(next));
  };

  const toggleTempUnit = () => {
    const next = !tempUnitFahrenheit;
    setTempUnitFahrenheit(next);
    saveSetting("kairo-temp-unit", next ? "fahrenheit" : "celsius");
  };

  const toggleDock = () => {
    const next = !dockEnabled;
    setDockEnabled(next);
    saveSetting("kairo-dock-enabled", String(next));
  };

  const toggleDockPreview = () => {
    const next = !dockPreviewEnabled;
    setDockPreviewEnabled(next);
    saveSetting("kairo-dock-preview-enabled", String(next));
  };

  const toggleDockAttention = () => {
    const next = !dockAttentionEnabled;
    setDockAttentionEnabled(next);
    saveSetting("kairo-dock-attention-enabled", String(next));
  };

  const handleDockSearchProviderChange = (provider: string) => {
    setDockSearchProvider(provider);
    saveSetting("kairo-dock-search-provider", provider);
  };

  const handleDockSearchShortcutChange = (shortcut: string) => {
    setDockSearchShortcut(shortcut);
    saveSetting("kairo-dock-search-shortcut", shortcut);
  };

  const toggleDockSearch = () => {
    const next = !dockSearchEnabled;
    setDockSearchEnabled(next);
    saveSetting("kairo-dock-search-enabled", String(next));
  };

  const toggleDockTray = () => {
    const next = !dockTray;
    setDockTray(next);
    saveSetting("kairo-dock-tray-enabled", String(next));
  };

  const toggleDockShowDesktop = () => {
    const next = !dockShowDesktop;
    setDockShowDesktop(next);
    saveSetting("kairo-dock-show-desktop-corner", String(next));
  };

  const togglePanelControlCenter = () => {
    const next = !panelControlCenter;
    setPanelControlCenter(next);
    saveSetting("kairo-panel-control-center-enabled", String(next));
  };

  const reorderPanels = (order: PanelId[]) => {
    setPanelOrder(order);
    saveSetting("kairo-panel-order", JSON.stringify(order));
  };

  const changeCcLayout = (next: CcLayout) => {
    setCcLayout(next);
    saveSetting("kairo-cc-layout", JSON.stringify(next));
  };

  const resetCcLayout = () => {
    setCcLayout({});
    localStorage.removeItem("kairo-cc-layout");
    invoke("save_setting", { key: "kairo-cc-layout", value: null }).catch(() => {});
  };

  const resetPanelOrder = () => {
    setPanelOrder(null);
    localStorage.removeItem("kairo-panel-order");
    invoke("save_setting", { key: "kairo-panel-order", value: null }).catch(() => {});
  };

  const togglePanelShelf = () => {
    const next = !panelShelf;
    setPanelShelf(next);
    saveSetting("kairo-panel-shelf-enabled", String(next));
  };

  const toggleDockTaskView = () => {
    const next = !dockTaskView;
    setDockTaskView(next);
    saveSetting("kairo-dock-taskview-enabled", String(next));
  };

  const toggleDockRecycle = () => {
    const next = !dockRecycle;
    setDockRecycle(next);
    saveSetting("kairo-dock-recycle-enabled", String(next));
  };

  const toggleDockDrive = (letter: string) => {
    const next = dockDrives.includes(letter) ? dockDrives.filter((d) => d !== letter) : [...dockDrives, letter].sort();
    setDockDrives(next);
    saveSetting("kairo-dock-drives", JSON.stringify(next));
  };

  const restoreHiddenDockApp = (id: string) => {
    const next = hiddenDockApps.filter((h) => h.id !== id);
    setHiddenDockApps(next);
    saveSetting("kairo-dock-hidden-apps", JSON.stringify(next));
  };

  const toggleDockCalendar = () => {
    const next = !dockCalendarEnabled;
    setDockCalendarEnabled(next);
    saveSetting("kairo-dock-calendar-enabled", String(next));
  };

  const toggleDockMixedReorder = () => {
    const next = !dockMixedReorder;
    setDockMixedReorder(next);
    saveSetting("kairo-dock-mixed-reorder", String(next));
  };

  const toggleDockIconOnly = () => {
    const next = !dockIconOnly;
    setDockIconOnly(next);
    saveSetting("kairo-dock-icon-only", String(next));
  };

  const handleStartIconChange = (icon: string) => {
    setStartIcon(icon);
    saveSetting("kairo-start-icon", icon);
  };

  const toggleDockAdaptive = () => {
    const next = !dockAdaptive;
    setDockAdaptive(next);
    saveSetting("kairo-dock-adaptive", String(next));
  };

  const toggleDockWinNumber = () => {
    const next = !dockWinNumberEnabled;
    setDockWinNumberEnabled(next);
    saveSetting("kairo-dock-win-number-enabled", String(next));
  };

  // ── Value setters ──
  const setDockModeValue = (newMode: string) => {
    setDockMode(newMode);
    saveSetting("kairo-dock-mode", newMode);
  };

  const setNotchModeValue = (newMode: string) => {
    setNotchMode(newMode);
    saveSetting("kairo-notch-mode", newMode);
  };

  const setDockMonitorModeValue = (mode: MonitorMode) => {
    setDockMonitorMode(mode);
    saveSetting("kairo-dock-monitor-mode", mode);
  };

  const setDockMonitorIdValue = (id: string) => {
    setDockMonitorId(id);
    saveSetting("kairo-dock-monitor-id", id);
  };

  const setNotchMonitorModeValue = (mode: MonitorMode) => {
    setNotchMonitorMode(mode);
    saveSetting("kairo-notch-monitor-mode", mode);
  };

  const setNotchMonitorIdValue = (id: string) => {
    setNotchMonitorId(id);
    saveSetting("kairo-notch-monitor-id", id);
  };

  const setDockModeForMonitor = (monitorId: string, mode: string | null) => {
    setDockModeByMonitor((prev) => {
      const next = { ...prev };
      if (mode === null) delete next[monitorId]; else next[monitorId] = mode;
      saveSetting("kairo-dock-mode-by-monitor", JSON.stringify(next));
      return next;
    });
  };

  const replaceDockModesByMonitor = (next: Record<string, string>) => {
    setDockModeByMonitor(next);
    saveSetting("kairo-dock-mode-by-monitor", JSON.stringify(next));
  };

  const replaceNotchModesByMonitor = (next: Record<string, string>) => {
    setNotchModeByMonitor(next);
    saveSetting("kairo-notch-mode-by-monitor", JSON.stringify(next));
  };

  const setNotchModeForMonitor = (monitorId: string, mode: string | null) => {
    setNotchModeByMonitor((prev) => {
      const next = { ...prev };
      if (mode === null) delete next[monitorId]; else next[monitorId] = mode;
      saveSetting("kairo-notch-mode-by-monitor", JSON.stringify(next));
      return next;
    });
  };

  const handleThresholdChange = (val: number) => {
    setLowBatteryThreshold(val);
    saveSetting("kairo-low-battery-threshold", val.toString());
  };

  const handleScaleChange = (val: number) => {
    setScale(val);
    saveSetting("kairo-scale", val.toString());
  };

  const handleWidgetsChange = (config: WidgetConfig) => {
    setStatusWidgets(config);
    saveSetting("kairo-status-widgets", JSON.stringify(config));
  };

  // ── Theme handlers ──
  const handleThemeModeChange = async (mode: string) => {
    setThemeMode(mode);
    saveSetting("kairo-theme-mode", mode);

    if (mode === "adaptive") {
      try {
        const accentHex = await invoke<string>("get_system_accent_color");
        const hsl = hexToHsl(accentHex);
        setThemeSaturation(hsl.s / 100);
        saveSetting("kairo-theme-saturation", String(hsl.s / 100));
        setThemeBrightness(hsl.l / 100);
        saveSetting("kairo-theme-brightness", String(hsl.l / 100));
      } catch (e) {
        console.error("Failed to parse adaptive accent HSL:", e);
      }
    }
  };

  const handleThemeColorChange = (color: string) => {
    setThemeColor(color);
    saveSetting("kairo-theme-color", color);

    try {
      const hsl = hexToHsl(color);
      setThemeSaturation(hsl.s / 100);
      saveSetting("kairo-theme-saturation", String(hsl.s / 100));
      setThemeBrightness(hsl.l / 100);
      saveSetting("kairo-theme-brightness", String(hsl.l / 100));
    } catch (e) {
      console.error("Failed to parse custom color HSL:", e);
    }
  };

  const handleOpacityChange = (value: number) => {
    setThemeOpacity(value);
    saveSetting("kairo-theme-opacity", String(value));
  };

  const handleSaturationChange = (value: number) => {
    setThemeSaturation(value);
    saveSetting("kairo-theme-saturation", String(value));
  };

  const handleBrightnessChange = (value: number) => {
    setThemeBrightness(value);
    saveSetting("kairo-theme-brightness", String(value));
  };

  const handleThemeStyleChange = (style: string) => {
    setThemeStyle(style);
    saveSetting("kairo-theme-style", style);
    // Each style is tuned for an opacity; the slider can still change it afterwards.
    const opacity = STYLE_OPACITY[style];
    if (opacity !== undefined) {
      setThemeOpacity(opacity);
      saveSetting("kairo-theme-opacity", String(opacity));
    }
  };

  const handleAccentChange = (accent: string) => {
    setThemeAccent(accent);
    saveSetting("kairo-theme-accent", accent);
  };

  const handleAccentColorChange = (color: string) => {
    setThemeAccentColor(color);
    saveSetting("kairo-theme-accent-color", color);
  };

  const applyThemePreset = (preset: ThemePreset) => {
    setThemeMode("custom");
    setThemeColor(preset.color);
    setThemeSaturation(preset.saturation);
    setThemeBrightness(preset.brightness);
    setThemeAccent("custom");
    setThemeAccentColor(preset.accent);
    saveSetting("kairo-theme-mode", "custom");
    saveSetting("kairo-theme-color", preset.color);
    saveSetting("kairo-theme-saturation", String(preset.saturation));
    saveSetting("kairo-theme-brightness", String(preset.brightness));
    saveSetting("kairo-theme-accent", "custom");
    saveSetting("kairo-theme-accent-color", preset.accent);
  };

  // ── City search ──
  const selectCity = async (city: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }) => {
    setCityName(city.name);
    setCityQuery(city.name);
    setShowCityDropdown(false);
    setCitySearchResults([]);
    localStorage.setItem("kairo-weather-city", city.name);
    localStorage.setItem("kairo-weather-lat", city.latitude.toString());
    localStorage.setItem("kairo-weather-lon", city.longitude.toString());
    await invoke("save_setting", { key: "kairo-weather-lat", value: city.latitude.toString() }).catch(() => {});
    await invoke("save_setting", { key: "kairo-weather-lon", value: city.longitude.toString() }).catch(() => {});
    await invoke("save_setting", { key: "kairo-weather-city", value: city.name }).catch(() => {});
    emit("weather-refresh", { lat: city.latitude, lon: city.longitude, city: city.name });
  };

  const handleCityClear = async () => {
    setCityName("");
    setCityQuery("");
    setShowCityDropdown(false);
    setCitySearchResults([]);
    localStorage.removeItem("kairo-weather-city");
    localStorage.removeItem("kairo-weather-lat");
    localStorage.removeItem("kairo-weather-lon");
    await invoke("save_setting", { key: "kairo-weather-lat", value: null }).catch(() => {});
    await invoke("save_setting", { key: "kairo-weather-lon", value: null }).catch(() => {});
    await invoke("save_setting", { key: "kairo-weather-city", value: null }).catch(() => {});
    emit("weather-refresh", true);
  };

  // ── Export / Import ──
  const handleExportSettings = async () => {
    setExportStatus("exporting");
    try {
      const saved = await invoke<boolean>("export_settings_dialog");
      if (saved) {
        setExportStatus("success");
        setTimeout(() => setExportStatus("idle"), 2000);
      } else {
        setExportStatus("idle");
      }
    } catch (e) {
      console.error("Export failed:", e);
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  };

  const handleImportSettings = async () => {
    setImportStatus("importing");
    try {
      const imported = await invoke<boolean>("import_settings_dialog");
      if (imported) {
        await loadAllSettings();
        setImportStatus("success");
        setTimeout(() => setImportStatus("idle"), 2000);
      } else {
        setImportStatus("idle");
      }
    } catch (e) {
      console.error("Import failed:", e);
      setImportStatus("error");
      setTimeout(() => setImportStatus("idle"), 3000);
    }
  };

  const handleResetSettings = async () => {
    if (resetStatus === "idle") {
      setResetStatus("confirm");
      setTimeout(() => setResetStatus((s) => (s === "confirm" ? "idle" : s)), 4000);
      return;
    }
    if (resetStatus !== "confirm") return;

    setResetStatus("resetting");
    try {
      await invoke("reset_settings");
      localStorage.clear();
      await invoke("restart_kairo");
    } catch (e) {
      console.error("Reset failed:", e);
      setResetStatus("idle");
    }
  };

  const handleUninstallKairo = async () => {
    if (uninstallStatus === "idle" || uninstallStatus === "error") {
      setUninstallStatus("confirm");
      setTimeout(() => setUninstallStatus((s) => (s === "confirm" ? "idle" : s)), 4000);
      return;
    }
    if (uninstallStatus !== "confirm") return;

    setUninstallStatus("uninstalling");
    try {
      await invoke("uninstall_kairo");
    } catch (e) {
      console.error("Uninstall failed:", e);
      setUninstallError(typeof e === "string" ? e : String((e as Error)?.message ?? e));
      setUninstallStatus("error");
      setTimeout(() => setUninstallStatus((s) => (s === "error" ? "idle" : s)), 12000);
    }
  };

  return {
    // System
    autostart,
    toggleAutostart,
    lowBatteryThreshold,
    handleThresholdChange,
    timeFormat24h,
    toggleTimeFormat24h,
    legacyMode,
    toggleLegacyMode,
    ramSaver,
    toggleRamSaver,
    ramUltra,
    toggleRamUltra,
    scale,
    handleScaleChange,
    cornersEnabled,
    toggleCorners,

    // Theme
    themeMode,
    handleThemeModeChange,
    themeColor,
    handleThemeColorChange,
    themeOpacity,
    handleOpacityChange,
    themeSaturation,
    handleSaturationChange,
    themeBrightness,
    handleBrightnessChange,
    themeStyle,
    handleThemeStyleChange,
    themeAccent,
    handleAccentChange,
    themeAccentColor,
    handleAccentColorChange,
    applyThemePreset,

    // Notch
    notchMode,
    setNotchModeValue,
    calendarEnabled,
    toggleCalendar,
    timerEnabled,
    toggleTimerEnabled,
    timerSoundEnabled,
    toggleTimerSound,
    notchTimerProgress,
    toggleNotchTimerProgress,
    stopwatchEnabled,
    toggleStopwatchEnabled,
    dualClockEnabled,
    toggleDualClock,
    dualClockZone,
    dualClockLabel,
    selectDualClockZone,
    musicModeEnabled,
    toggleMusicMode,
    musicCompactNotch,
    toggleMusicCompactNotch,
    agentApi,
    toggleAgentApi,
    notchScrollVolume,
    toggleNotchScrollVolume,
    shelfPersist,
    toggleShelfPersist,
    rememberMode,
    toggleRememberMode,
    mediaLayout,
    toggleMediaLayout,
    mediaAmbienceEnabled,
    toggleAmbience,
    mediaCompactGlowEnabled,
    toggleCompactGlow,
    mediaArtworkThemeEnabled,
    toggleArtworkTheme,

    // Weather
    weatherEnabled,
    toggleWeather,
    tempUnitFahrenheit,
    toggleTempUnit,
    cityName,
    cityQuery,
    setCityQuery,
    citySearchResults,
    showCityDropdown,
    setShowCityDropdown,
    selectCity,
    handleCityClear,

    // Widgets
    statusWidgets,
    handleWidgetsChange,
    hasBattery,

    // Dock
    dockEnabled,
    toggleDock,
    dockMode,
    setDockModeValue,
    dockPreviewEnabled,
    toggleDockPreview,
    dockAttentionEnabled,
    toggleDockAttention,
    dockSearchEnabled,
    toggleDockSearch,
    dockSearchProvider,
    handleDockSearchProviderChange,
    dockSearchShortcut,
    handleDockSearchShortcutChange,
    dockCalendarEnabled,
    toggleDockCalendar,
    dockTray,
    toggleDockTray,
    dockTaskView,
    toggleDockTaskView,
    dockShowDesktop,
    toggleDockShowDesktop,
    panelControlCenter,
    togglePanelControlCenter,
    panelShelf,
    togglePanelShelf,
    panelOrder,
    reorderPanels,
    resetPanelOrder,
    ccLayout,
    changeCcLayout,
    resetCcLayout,
    dockRecycle,
    toggleDockRecycle,
    dockDrives,
    toggleDockDrive,
    hiddenDockApps,
    restoreHiddenDockApp,
    dockIconOnly,
    toggleDockIconOnly,
    startIcon,
    handleStartIconChange,
    dockAdaptive,
    toggleDockAdaptive,
    dockWinNumberEnabled,
    toggleDockWinNumber,
    dockMixedReorder,
    toggleDockMixedReorder,

    monitors,
    dockMonitorMode,
    setDockMonitorModeValue,
    dockMonitorId,
    setDockMonitorIdValue,
    notchMonitorMode,
    setNotchMonitorModeValue,
    notchMonitorId,
    setNotchMonitorIdValue,
    dockModeByMonitor,
    setDockModeForMonitor,
    replaceDockModesByMonitor,
    notchModeByMonitor,
    setNotchModeForMonitor,
    replaceNotchModesByMonitor,

    // Overlays
    volumeOverlayEnabled,
    toggleVolumeOverlay,
    volumeEdgeEnabled,
    toggleVolumeEdge,
    brightnessOverlayEnabled,
    toggleBrightnessOverlay,
    brightnessEdgeEnabled,
    toggleBrightnessEdge,

    // Updates
    appVersion,

    exportStatus,
    importStatus,
    handleExportSettings,
    handleImportSettings,
    resetStatus,
    handleResetSettings,
    uninstallStatus,
    uninstallError,
    handleUninstallKairo,

    // Utilities
    restartKairo: () => invoke("restart_kairo"),
    quitKairo: () => invoke("quit_kairo"),
  };
}
