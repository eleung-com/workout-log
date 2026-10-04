import { matchName, type MatchResult } from "./match";
import { parseLine, type ParsedLine } from "./parse";
import type { Entry, Exercise, Group } from "./types";

export interface Pick { exerciseId?: string; group?: Group; asNew?: boolean }
export interface Resolved {
  p: ParsedLine; m: MatchResult;
  exercise?: Exercise;            // known exercise this line logs to
  newName?: string;               // name for a new exercise
  status: "ready" | "needs-group" | "needs-choice" | "empty";
}

export function holdRegex(exercises: Exercise[]): RegExp | undefined {
  const words = exercises.filter(e => e.type === "hold").flatMap(e => [e.name, ...e.aliases]).map(w => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return words.length ? new RegExp(`\\b(?:${words.join("|")})\\b`) : undefined;
}

export function resolveLine(line: string, exercises: Exercise[], lastUsed: Record<string, number>, pick: Pick = {}): Resolved {
  const p = parseLine(line, { holdNames: holdRegex(exercises) });
  const m = matchName([p.name, p.core], exercises, lastUsed);
  if (m.kind === "empty") return { p, m, status: "empty" };
  if (pick.exerciseId) {
    const ex = exercises.find(e => e.id === pick.exerciseId);
    if (ex) return { p, m, exercise: ex, status: "ready" };
  }
  if (m.kind === "match") return { p, m, exercise: m.exercise, status: "ready" };
  if (m.kind === "ambiguous" && !pick.asNew && !pick.group) return { p, m, status: "needs-choice" };
  const newName = m.usedName === p.name ? p.core || p.name : m.usedName;
  return { p, m, newName, status: pick.group ? "ready" : "needs-group" };
}

export function inferType(p: ParsedLine): Exercise["type"] {
  if (p.seconds) return "hold";
  if (p.weightKind === "added") return "added-weight";
  if (p.weight === null) return "bodyweight";
  return "weighted";
}

/** The fields an entry gets from a parsed line. `same` copies last time. */
export function entryFields(r: Resolved, last?: Entry): Omit<Entry, "id" | "sessionId" | "order" | "exerciseId"> {
  const { p } = r;
  const usedVariantAsName = r.m.kind === "match" && r.m.exact && r.m.usedName === p.name && p.name !== p.core;
  const variant = (usedVariantAsName ? p.variants.filter(v => /mm$/.test(v)) : p.variants).join(", ");
  const note = p.notes.join("; ");
  if (p.same && last) return { weight: last.weight, reps: last.reps, seconds: last.seconds, variant: variant || last.variant, note, source: p.raw };
  const assisted = p.weightKind === "assisted";
  return { weight: p.bodyweight || assisted ? null : p.weight, reps: p.reps, seconds: p.seconds, variant, note, source: p.raw };
}
