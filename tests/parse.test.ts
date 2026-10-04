import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseLine } from "../src/lib/parse";
import { matchName } from "../src/lib/match";
import type { Backup } from "../src/lib/types";

// Your real Notes data is kept out of git, so CI uses a small built-in library instead.
const BACKUP = "import/lift-log-backup.json";
const hasBackup = existsSync(BACKUP);
const backup: Backup = hasBackup ? JSON.parse(readFileSync(BACKUP, "utf8")) : { app: "lift-log", version: 1, exportedAt: "", units: "lb", sessions: [], entries: [],
  exercises: [
    ["dumbbell-press", "Dumbbell press", ["dumbell press"]], ["arnold-press", "Arnold press", ["arnold"]], ["bench-press", "Bench press", ["bench"]],
    ["back-squat", "Back squat", ["squat"]], ["hammer-curl", "Hammer curl", ["hammer"]], ["incline-dumbbell-press", "Incline dumbbell press", ["incline"]],
    ["pullups", "Pullups", []], ["lockoffs", "Lockoffs", ["lockoff"]],
  ].map(([id, name, aliases]) => ({ id: id as string, name: name as string, aliases: aliases as string[], type: "weighted" as const, group: "Push" as const })) };
const ex = backup.exercises;
const read = (line: string) => {
  const p = parseLine(line);
  const m = matchName([p.name, p.core], ex);
  return { p, id: m.kind === "match" ? m.exercise.id : m.kind };
};

describe("PRD parsing rules", () => {
  const cases: [string, Partial<{ reps: number[]; weight: number | null; seconds: number[] }>][] = [
    ["3X7 95lb squat", { reps: [7, 7, 7], weight: 95 }],
    ["3×7 95 squat", { reps: [7, 7, 7], weight: 95 }],
    ["squat 3*7 @95", { reps: [7, 7, 7], weight: 95 }],
    ["3 x 7 95# squat", { reps: [7, 7, 7], weight: 95 }],
    ["3 sets of 7 squat 95 pounds", { reps: [7, 7, 7], weight: 95 }],
    ["squat 7 reps 95lbs", { reps: [7], weight: 95 }],
    ["8-8-6 arnold 22.5", { reps: [8, 8, 6], weight: 22.5 }],
    ["8,8,6 arnold 22,5", { reps: [8, 8, 6], weight: 22.5 }],
    ["3x5/5/7 dumbell press 45lb", { reps: [5, 5, 7], weight: 45 }],
    ["2x6 + 1x5 bench 105", { reps: [6, 6, 5], weight: 105 }],
    ["3x7x95 squat", { reps: [7, 7, 7], weight: 95 }],
    ["three by seven squat 95", { reps: [7, 7, 7], weight: 95 }],
    ["dumbbell press 40s 3x8", { reps: [8, 8, 8], weight: 40 }],
    ["pullups 3x6 +25", { reps: [6, 6, 6], weight: 25 }],
    ["lockoff 3x10s +15", { seconds: [10, 10, 10], weight: 15 }],
    ["lockoff 3x8 sec", { seconds: [8, 8, 8] }],
    ["hangboard 20mm 7/3 +15", { weight: 15 }],
  ];
  for (const [line, want] of cases) it(line, () => {
    const p = parseLine(line);
    if (want.reps) expect(p.reps).toEqual(want.reps);
    if (want.seconds) expect(p.seconds).toEqual(want.seconds);
    if ("weight" in want) expect(p.weight).toBe(want.weight);
  });

  it("edge size is a variant, not weight", () => {
    const p = parseLine("hangboard 20mm +15");
    expect(p.variants).toContain("20mm"); expect(p.weight).toBe(15);
  });
  it("notes come out of the line", () => {
    const p = parseLine("squat 3x5 115 rpe 8 (left knee) felt heavy");
    expect(p.notes).toEqual(expect.arrayContaining(["left knee", "RPE 8", "felt heavy"]));
    expect(p.core).toBe("squat");
  });
  it("kg is flagged", () => expect(parseLine("squat 3x5 60kg").flags[0]).toBe("kg:60"));
  it("grip words become variants, name stays", () => {
    const p = parseLine("wide pullups 3x7");
    expect(p.variants).toContain("wide"); expect(p.core).toBe("pullups");
  });
  it("matches typos, plurals and word order", () => {
    expect(read("dumbel press 3x5 45").id).toBe("dumbbell-press");
    expect(read("squats 3x5 115").id).toBe("back-squat");
    expect(read("curls hammer 3x8 20").id).toBe("hammer-curl");
    expect(read("db press 3x5 45").id).toBe("dumbbell-press");
    expect(read("incline 3x8 30").id).toBe("incline-dumbbell-press");
  });
  it("vague name asks instead of guessing", () => expect(read("press 3x5 45").id).toBe("ambiguous"));
  it("unknown name is new", () => expect(read("cable woodchop 3x12 30").id).toBe("new"));
});

describe.skipIf(!hasBackup)("Notes import accuracy (target 90%)", () => {
  // Lines that became exactly one entry are comparable one to one
  const bySource = new Map<string, typeof backup.entries>();
  for (const e of backup.entries) bySource.set(e.source!, [...(bySource.get(e.source!) ?? []), e]);
  // Lines whose answer came from context only you knew (no exercise name, sets you remembered, plate math)
  const fromYou = new Set(["* normal - 7 then 5", "* wide - 7 then 6", "* narrow - 7 then 6", "50 lb wide lat pull down",
    "3x8 incline rplb", "3x5 115 lb", "squat 3x7 25lb plate"]);
  const all = [...bySource.entries()].filter(([, es]) => es.length === 1);
  const single = all.filter(([src]) => !fromYou.has(src));
  const misses: string[] = [];
  for (const [src, [e]] of single) {
    const { p, id } = read(src);
    const ok = id === e.exerciseId && JSON.stringify(p.reps) === JSON.stringify(e.reps) && p.weight === e.weight;
    if (!ok) misses.push(`${src}  ->  ${id} ${JSON.stringify(p.reps)} ${p.weight}  (want ${e.exerciseId} ${JSON.stringify(e.reps)} ${e.weight})`);
  }
  const acc = 1 - misses.length / single.length;
  it(`skips ${all.length - single.length} context-only lines, reads ${single.length} lines, accuracy ${(acc * 100).toFixed(0)}%`, () => {
    if (misses.length) console.log("Misses:\n" + misses.join("\n"));
    expect(acc).toBeGreaterThanOrEqual(0.9);
  });
});
