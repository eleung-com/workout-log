import type { Exercise } from "./types";

// Name matching, in PRD order: clean -> exact/alias -> close spelling -> ambiguous -> new.

const ABBR: [RegExp, string][] = [
  [/\bdb\b/g, "dumbbell"], [/\bbb\b/g, "barbell"], [/\bkb\b/g, "kettlebell"],
  [/\bohp\b/g, "overhead press"], [/\brdl\b/g, "romanian deadlift"], [/\bbss\b/g, "bulgarian split squat"],
  [/\bdl\b/g, "deadlift"], [/\blat ?pd\b/g, "lat pulldown"], [/\bdumb ?bell\b/g, "dumbbell"],
];

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Lowercase, expand abbreviations, drop plurals, ignore word order, spaces and hyphens. */
export function nameKey(s: string): string {
  let t = s.toLowerCase().replace(/[-_]/g, " ");
  for (const [re, v] of ABBR) t = t.replace(re, v);
  return t.split(/\s+/).filter(Boolean).map(singular).sort().join("");
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export type MatchResult =
  | { kind: "match"; exercise: Exercise; exact: boolean; usedName: string }
  | { kind: "ambiguous"; options: Exercise[]; usedName: string }
  | { kind: "new"; usedName: string }
  | { kind: "empty" };

export function matchName(names: string[], exercises: Exercise[], lastUsed: Record<string, number> = {}): MatchResult {
  const tries = names.map(s => s.trim()).filter(Boolean);
  if (!tries.length) return { kind: "empty" };
  const keyed = exercises.map(e => ({ e, keys: [e.name, ...e.aliases].map(nameKey) }));

  // 1-2. exact name or saved alternate spelling, full name first, then without variant words
  for (const name of tries) {
    const k = nameKey(name);
    const hits = keyed.filter(x => x.keys.includes(k)).map(x => x.e);
    if (hits.length === 1) return { kind: "match", exercise: hits[0], exact: true, usedName: name };
    if (hits.length > 1) return { kind: "ambiguous", options: rank(hits, lastUsed).slice(0, 3), usedName: name };
  }

  // 3-4. close spelling; accept alone only when exactly one strong match
  const name = tries[tries.length - 1];
  const k = nameKey(name);
  const scored = keyed.map(x => {
    let best = 0;
    for (const key of x.keys) {
      const s = 1 - lev(k, key) / Math.max(k.length, key.length);
      const contains = key.length > 3 && k.length > 3 && (key.includes(k) || k.includes(key)) ? 0.7 : 0;
      best = Math.max(best, s, contains);
    }
    return { e: x.e, s: best };
  }).sort((a, b) => b.s - a.s || (lastUsed[b.e.id] ?? 0) - (lastUsed[a.e.id] ?? 0));

  const strong = scored.filter(x => x.s >= 0.8);
  if (strong.length === 1 && (scored[1]?.s ?? 0) < strong[0].s - 0.1) return { kind: "match", exercise: strong[0].e, exact: false, usedName: name };
  const options = scored.filter(x => x.s >= 0.6).map(x => x.e);
  if (options.length) return { kind: "ambiguous", options: rank(options, lastUsed).slice(0, 3), usedName: name };
  return { kind: "new", usedName: name };
}

function rank(list: Exercise[], lastUsed: Record<string, number>) {
  return [...list].sort((a, b) => (lastUsed[b.id] ?? 0) - (lastUsed[a.id] ?? 0));
}
