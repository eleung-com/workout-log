"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { db, exportBackup, restoreBackup } from "@/lib/db";
import { todayIso } from "@/lib/dates";

export default function BackupSheet({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const last = useLiveQuery(() => db.meta.get("lastBackup"), []);
  const lastText = last?.value ? new Date(last.value as number).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "never";

  async function download() {
    const b = await exportBackup();
    const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
    const name = `lift-log-backup-${todayIso()}.json`;
    const f = new File([blob], name, { type: "application/json" });
    // On iPhone the share sheet lets you save straight to iCloud Files
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); onDone("Backup saved"); return; } catch { /* cancelled, fall through */ } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    onDone("Backup downloaded");
  }

  async function load(f: File) {
    setError("");
    try {
      const { sessions, entries } = await restoreBackup(JSON.parse(await f.text()));
      onDone(`Loaded ${sessions} sessions, ${entries} entries`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read that file. Pick a Lift Log backup (.json)."); }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Backup" onClick={e => e.stopPropagation()}>
        <h2>Backup</h2>
        <p className="sub">Your workouts live only on this phone. Save a backup to iCloud Files every week. Last backup: <b>{lastText}</b>.</p>
        <div className="actions">
          <button className="btn primary" onClick={download}>Save backup</button>
          <button className="btn" onClick={() => file.current?.click()}>Load backup</button>
        </div>
        <p className="sub">Loading adds the file&apos;s workouts to what&apos;s here. Nothing gets deleted.</p>
        {error && <p className="sub" style={{ color: "var(--danger)" }}>{error}</p>}
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
      </div>
    </div>
  );
}
