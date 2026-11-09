import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryStick } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { Dropdown } from "./Dropdown";
import { useT } from "../i18n";

const MODES = ["percent", "gb"];

export function RamWidgetMode() {
  const t = useT();
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem("kairo-ram-widget-mode");
    return saved && MODES.includes(saved) ? saved : "percent";
  });

  const change = (next: string) => {
    setValue(next);
    localStorage.setItem("kairo-ram-widget-mode", next);
    invoke("save_setting", { key: "kairo-ram-widget-mode", value: next }).catch(() => { });
  };

  return (
    <SettingRow icon={MemoryStick} label={t("notch.ramWidget")} desc={t("notch.ramWidget.desc")}>
      <Dropdown
        value={value}
        onChange={change}
        options={MODES.map((m) => ({ value: m, label: t(`notch.ramWidget.${m}`) }))}
      />
    </SettingRow>
  );
}
