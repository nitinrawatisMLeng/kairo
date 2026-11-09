import { Power, Clock, History, BatteryWarning, RefreshCw, LogOut, Languages, MemoryStick, Zap } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { SettingSection } from "./SettingSection";
import { Dropdown } from "./Dropdown";
import { LANGUAGES, getLanguagePreference, setLanguagePreference, useT } from "../i18n";

interface GeneralTabProps {
  autostart: boolean;
  toggleAutostart: () => void;
  timeFormat24h: boolean;
  toggleTimeFormat24h: () => void;
  legacyMode: boolean;
  toggleLegacyMode: () => void;
  ramSaver: boolean;
  toggleRamSaver: () => void;
  ramUltra: boolean;
  toggleRamUltra: () => void;
  lowBatteryThreshold: number;
  hasBattery: boolean;
  handleThresholdChange: (val: number) => void;
  restartKairo: () => void;
  quitKairo: () => void;
}

export function GeneralTab({
  autostart,
  toggleAutostart,
  timeFormat24h,
  toggleTimeFormat24h,
  legacyMode,
  toggleLegacyMode,
  ramSaver,
  toggleRamSaver,
  ramUltra,
  toggleRamUltra,
  lowBatteryThreshold,
  hasBattery,
  handleThresholdChange,
  restartKairo,
  quitKairo,
}: GeneralTabProps) {
  const t = useT();
  const languageOptions = [
    { value: "system", label: t("general.language.system") },
    ...Object.entries(LANGUAGES).map(([value, { name }]) => ({ value, label: name })),
  ];
  return (
    <>
      <SettingSection id="general-system" title={t("general.system")} defaultOpen>
        <SettingRow icon={Power} label={t("general.launchAtLogin")} desc={t("general.launchAtLogin.desc")}>
          <label className="toggle-switch">
            <input type="checkbox" checked={autostart} onChange={toggleAutostart} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={Languages} label={t("general.language")} desc={t("general.language.desc")}>
          <Dropdown value={getLanguagePreference()} options={languageOptions} onChange={setLanguagePreference} />
        </SettingRow>

        <SettingRow icon={Clock} label={t("general.time24h")} desc={t("general.time24h.desc")}>
          <label className="toggle-switch">
            <input type="checkbox" checked={timeFormat24h} onChange={toggleTimeFormat24h} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow
          icon={History}
          label={t("general.legacyMode")}
          desc={t("general.legacyMode.desc")}
        >
          <label className="toggle-switch">
            <input type="checkbox" checked={legacyMode} onChange={toggleLegacyMode} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow
          icon={MemoryStick}
          label={t("general.ramSaver")}
          desc={t("general.ramSaver.desc")}
        >
          <label className="toggle-switch">
            <input type="checkbox" checked={ramSaver} onChange={toggleRamSaver} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow
          icon={Zap}
          label={t("general.ramUltra")}
          desc={t("general.ramUltra.desc")}
          divider={hasBattery}
        >
          <label className="toggle-switch">
            <input type="checkbox" checked={ramUltra} onChange={toggleRamUltra} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        {hasBattery && (
          <SettingRow
            icon={BatteryWarning}
            label={t("general.lowBattery")}
            desc={t("general.lowBattery.desc", { percent: lowBatteryThreshold })}
            divider={false}
          >
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={lowBatteryThreshold}
              onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
              className="settings-slider"
            />
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection id="general-app" title={t("general.app")}>
        <SettingRow icon={RefreshCw} label={t("general.restart")} desc={t("general.restart.desc")} action onClick={restartKairo} />
        <SettingRow icon={LogOut} label={t("general.quit")} desc={t("general.quit.desc")} action danger onClick={quitKairo} divider={false} />
      </SettingSection>
    </>
  );
}
