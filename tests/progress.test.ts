import { describe, it, expect } from "vitest";
import { isPR, metricFor, niceTicks, prsFor, series, type Dated } from "../src/lib/progress";
import type { Exercise } from "../src/lib/types";

const squat: Exercise = { id: "sq", name: "Back squat", type: "weighted", group: "Legs", aliases: [] };
const lock: Exercise = { id: "lo", name: "Lockoffs", type: "hold", group: "Pull", aliases: [] };
const pull: Exercise = { id: "pu", name: "Pullups", type: "added-weight", group: "Pull", aliases: [] };
let n = 0;
const e = (date: string, weight: number | null, reps: number[] | null, seconds: number[] | null = null, ex = "sq"): Dated =>
  ({ id: `e${++n}`, sessionId: `s-${date}`, exerciseId: ex, order: 1, weight, reps, seconds, variant: "", note: "", date });

describe("progress", () => {
  const sq = [e("2026-08-27", 95, [6, 6, 6]), e("2026-08-30", 95, [7, 7, 7]), e("2026-09-06", 115, [7, 7, 7]), e("2026-09-13", 115, [5, 5, 5]), e("2026-10-03", 95, [8, 8, 6])];
  it("weighted chart = top weight per session", () => expect(series(sq, metricFor(squat)).map(p => p.value)).toEqual([95, 95, 115, 115, 95]));
  it("PRs: first time hitting the heaviest, best at each avg rep count (rounded down)", () => {
    const prs = prsFor(squat, sq);
    expect(prs[0]).toMatchObject({ title: "Heaviest", value: "115", date: "2026-09-06" });
    expect(prs.find(p => p.title === "Best at 7 reps")).toMatchObject({ value: "115", date: "2026-09-06" }); // 8/8/6 averages to 7.33 -> 7
    expect(prs.find(p => p.title === "Best at 5 reps")).toMatchObject({ value: "115" });
  });
  it("hold chart = average seconds; PR per added weight", () => {
    const lo = [e("2026-10-01", 16, null, [8, 10, 12], "lo"), e("2026-10-05", 16, null, [12, 12, 12], "lo")];
    expect(series(lo, metricFor(lock)).map(p => p.value)).toEqual([10, 12]);
    expect(prsFor(lock, lo).find(p => p.title.startsWith("Longest"))).toMatchObject({ value: "12", date: "2026-10-05" });
  });
  it("bodyweight chart = average reps per set", () => {
    const pu = [e("2026-08-11", null, [8, 8, 8, 8, 8, 8], null, "pu"), e("2026-08-08", null, [6, 5], null, "pu")];
    expect(series(pu, metricFor(pull)).map(p => p.value)).toEqual([5, 8]);
  });
  it("isPR", () => {
    expect(isPR(e("2026-10-10", 120, [5, 5, 5]), squat, sq)).toBe(true);
    expect(isPR(e("2026-10-10", 100, [8, 8, 8]), squat, sq)).toBe(true);   // new best at 8
    expect(isPR(e("2026-10-10", 95, [7, 7, 7]), squat, sq)).toBe(false);
    expect(isPR(e("2026-10-10", 95, [7, 7, 7]), squat, [])).toBe(false);  // first time is not a PR
  });
  it("niceTicks covers the max", () => { const t = niceTicks(115); expect(t[t.length - 1]).toBeGreaterThanOrEqual(115); expect(t[0]).toBe(0); });
});
