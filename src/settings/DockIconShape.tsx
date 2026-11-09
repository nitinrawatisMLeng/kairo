import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Circle } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { Dropdown } from "./Dropdown";
import { useT } from "../i18n";

const SHAPES = ["circle", "rounded"];

export function DockIconShape({ disabled }: { disabled?: boolean }) {
  const t = useT();
  const [value, setValue] = useState(() => (localStorage.getItem("kairo-dock-icon-shape") === "rounded" ? "rounded" : "circle"));

  const change = (next: string) => {
    setValue(next);
    localStorage.setItem("kairo-dock-icon-shape", next);
    invoke("save_setting", { key: "kairo-dock-icon-shape", value: next }).catch(() => { });
  };

  return (
    <SettingRow icon={Circle} label={t("dock.iconShape")} desc={disabled ? t("dock.iconShape.iconOnly") : t("dock.iconShape.desc")}>
      <Dropdown
        value={value}
        onChange={change}
        options={SHAPES.map((s) => ({ value: s, label: t(`dock.iconShape.${s}`) }))}
      />
    </SettingRow>
  );
}
