import { avgReps } from "./stats";
import type { Entry, Exercise } from "./types";

// Charts and PRs, per PRD "Data model and last-time logic".
export type Dated = Entry & { date: string };
export interface Point { date: string; value: number; label: string }
export interface Metric { title: string; unit: string; value: (es: Dated[]) => number | null; fmt: (v: number) => string }

const avgSecs = (s: number[] | null) => (s?.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0);
const maxOf = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.max(...v) : null; };

/** What the chart plots for this kind of exercise. */
export function metricFor(ex: Exercise): Metric {
  if (ex.type === "hold") return { title: "Average hold per set", unit: "s", fmt: v => `${v}s`, value: es => maxOf(es.map(e => (e.seconds ? avgSecs(e.seconds) : null))) };
  if (ex.group === "Fingerboard") {
    const added = ex.type !== "weighted";
    return { title: added ? "Added weight per session" : "Weight per session", unit: "lb", fmt: v => `${added ? "+" : ""}${v}`, value: es => maxOf(es.map(e => e.weight)) };
  }
  if (ex.type === "weighted") return { title: "Top weight per session", unit: "lb", fmt: v => `${v}`, value: es => maxOf(es.map(e => e.weight)) };
  return { title: "Average reps per set", unit: "reps", fmt: v => `${v}`, value: es => maxOf(es.map(e => (e.reps ? avgReps(e.reps) : null))) };
}

/** One point per session, oldest first. */
export function series(entries: Dated[], m: Metric): Point[] {
  const byDate = new Map<string, Dated[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, es]) => {
    const v = m.value(es);
    return v === null ? [] : [{ date, value: v, label: m.fmt(v) }];
  });
}

export interface PR { title: string; value: string; unit: string; date: string }

/** PR list. Uneven sets use average reps rounded down. Holds: longest average hold at each added weight + heaviest. */
export function prsFor(ex: Exercise, entries: Dated[]): PR[] {
  const out: PR[] = [];
  const asc = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const firstBest = <T,>(xs: T[], score: (x: T) => number | null) => {
    let best: T | null = null, bv = -Infinity;
    for (const x of xs) { const v = score(x); if (v !== null && v > bv) { bv = v; best = x; } } // strict > keeps the first time you hit it
    return best;
  };
  if (ex.type === "hold") {
    const byW = new Map<number, Dated[]>();
    for (const e of asc) if (e.seconds) byW.set(e.weight ?? 0, [...(byW.get(e.weight ?? 0) ?? []), e]);
    const heavy = firstBest(asc, e => e.weight);
    if (heavy?.weight != null) out.push({ title: "Heaviest added weight", value: `+${heavy.weight}`, unit: "lb", date: heavy.date });
    for (const [w, es] of [...byW.entries()].sort(([a], [b]) => b - a)) {
      const b = firstBest(es, e => avgSecs(e.seconds));
      if (b) out.push({ title: `Longest hold at ${w ? `+${w} lb` : "bodyweight"}`, value: `${avgSecs(b.seconds)}`, unit: "s", date: b.date });
    }
    return out;
  }
  const hasWeight = asc.some(e => e.weight !== null);
  if (hasWeight) {
    const heavy = firstBest(asc, e => e.weight);
    if (heavy) out.push({ title: "Heaviest", value: `${ex.type === "weighted" ? "" : "+"}${heavy.weight}`, unit: heavy.reps ? `lb × ${avgReps(heavy.reps)}` : "lb", date: heavy.date });
    const byReps = new Map<number, Dated[]>();
    for (const e of asc) if (e.reps && e.weight !== null) { const r = avgReps(e.reps); byReps.set(r, [...(byReps.get(r) ?? []), e]); }
    for (const [r, es] of [...byReps.entries()].sort(([a], [b]) => a - b)) {
      const b = firstBest(es, e => e.weight);
      if (b) out.push({ title: `Best at ${r} rep${r === 1 ? "" : "s"}`, value: `${ex.type === "weighted" ? "" : "+"}${b.weight}`, unit: "lb", date: b.date });
    }
  }
  const mostReps = firstBest(asc.filter(e => e.weight === null), e => (e.reps ? avgReps(e.reps) : null));
  if (mostReps) out.push({ title: "Most reps per set, bodyweight", value: `${avgReps(mostReps.reps)}`, unit: "reps", date: mostReps.date });
  return out;
}

/** Is this entry a PR against everything logged before its date? (Log screen badge.) */
export function isPR(e: Entry, ex: Exercise, earlier: Entry[]): boolean {
  if (!earlier.length) return false;
  if (ex.type === "hold") {
    const s = avgSecs(e.seconds); const w = e.weight ?? 0;
    const prevW = earlier.filter(x => (x.weight ?? 0) === w && x.seconds);
    return (e.weight ?? 0) > Math.max(...earlier.map(x => x.weight ?? 0)) || (prevW.length > 0 && s > Math.max(...prevW.map(x => avgSecs(x.seconds))));
  }
  if (e.weight !== null) {
    // PR = nothing earlier was at least as heavy for at least as many reps
    const r = e.reps ? avgReps(e.reps) : 0;
    return !earlier.some(x => x.weight !== null && x.weight >= e.weight! && (x.reps ? avgReps(x.reps) : 0) >= r);
  }
  if (!e.reps) return false;
  const bw = earlier.filter(x => x.weight === null && x.reps);
  return bw.length > 0 && avgReps(e.reps) > Math.max(...bw.map(x => avgReps(x.reps)));
}

/** Round up to a tidy axis maximum and give 4 ticks from 0. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 3, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw)!;
  return [0, step, step * 2, step * 3, ...(step * 3 < max ? [step * 4] : [])];
}
