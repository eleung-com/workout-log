import type { Entry, Exercise } from "./types";

export function setsLabel(e: Pick<Entry, "reps" | "seconds">): string {
  if (e.seconds?.length) return `${e.seconds.length}×${e.seconds[0]}s`;
  if (!e.reps?.length) return "";
  return e.reps.every(r => r === e.reps![0]) ? `${e.reps.length}×${e.reps[0]}` : e.reps.join("/");
}

export function weightLabel(e: Pick<Entry, "weight">, ex?: Pick<Exercise, "type">): string {
  if (e.weight === null) return ex && ex.type !== "weighted" ? "BW" : "";
  const added = ex && (ex.type === "added-weight" || ex.type === "hold");
  return `${added ? "+" : ""}${e.weight} lb`;
}

export function entryLabel(e: Entry, ex?: Exercise): string {
  const s = setsLabel(e), w = weightLabel(e, ex);
  return [s, w].filter(Boolean).join(" @ ") || "logged";
}

const sig = (e: Entry) => JSON.stringify([e.weight, e.reps, e.seconds]);

/** Most recent earlier entry plus how many sessions in a row it was identical. history = newest first. */
export function lastTime(history: Entry[]): { last: Entry; streak: number } | null {
  // one entry per session, newest first
  const seen = new Set<string>(); const per = history.filter(e => !seen.has(e.sessionId) && seen.add(e.sessionId));
  if (!per.length) return null;
  const last = per[0];
  let streak = 1;
  for (let i = 1; i < per.length && sig(per[i]) === sig(last); i++) streak++;
  return { last, streak };
}

/** Average reps per set, rounded down (PRD). */
export const avgReps = (reps: number[] | null) => (reps?.length ? Math.floor(reps.reduce((a, b) => a + b, 0) / reps.length) : 0);
