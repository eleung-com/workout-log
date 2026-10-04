"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/dates";

/** Shows when the last backup is 7+ days old (or never), once there is data to lose. Snooze hides it for today. */
export default function BackupReminder({ hasData, onOpen }: { hasData: boolean; onOpen: () => void }) {
  const state = useLiveQuery(async () => {
    const [last, snooze] = await Promise.all([db.meta.get("lastBackup"), db.meta.get("reminderSnoozed")]);
    return { last: (last?.value as number) ?? null, snoozed: snooze?.value === todayIso() };
  }, []);
  if (!state || !hasData || state.snoozed) return null;
  const days = state.last ? Math.floor((Date.now() - state.last) / 864e5) : null;
  if (days !== null && days < 7) return null;
  return (
    <div className="reminder" role="status">
      <div><b>{days === null ? "No backup yet" : `Last backup ${days} days ago`}</b>
        <span>Your workouts live only on this phone. Save a copy to iCloud Files.</span></div>
      <div className="actions">
        <button className="btn" onClick={() => db.meta.put({ key: "reminderSnoozed", value: todayIso() })}>Later</button>
        <button className="btn primary" onClick={onOpen}>Save backup</button>
      </div>
    </div>
  );
}
