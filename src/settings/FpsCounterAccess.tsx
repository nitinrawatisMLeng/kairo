import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Gauge, ShieldCheck } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useT } from "../i18n";

type Access = "granted" | "signout" | "needs-access";

// Counting frames uses Windows event tracing, which needs the account to be in the built-in
// Performance Log Users group. Approving adds it once; Windows applies it at the next sign-in.
export function FpsCounterAccess() {
  const t = useT();
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    invoke<Access>("get_fps_access").then(setAccess).catch(() => setAccess(null));
  }, []);

  const enable = () => {
    setBusy(true);
    setProblem(null);
    invoke<Access>("request_fps_access")
      .then(setAccess)
      .catch((e) => {
        const error = String(e);
        setProblem(error === "cancelled" ? t("notch.fpsCounter.cancelled") : t("notch.fpsCounter.failed", { error }));
      })
      .finally(() => setBusy(false));
  };

  const desc =
    problem ??
    (access === "granted"
      ? t("notch.fpsCounter.on")
      : access === "signout"
        ? t("notch.fpsCounter.signOut")
        : t("notch.fpsCounter.desc"));

  return (
    <SettingRow icon={Gauge} label={t("notch.fpsCounter")} desc={desc}>
      {access === "needs-access" && (
        <button className="agent-sound-btn" onClick={enable} disabled={busy}>
          <ShieldCheck size={12} />
          {t("notch.fpsCounter.enable")}
        </button>
      )}
    </SettingRow>
  );
}
