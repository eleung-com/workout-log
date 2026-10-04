// Rules-based line parser. No AI: instant, offline, predictable. See PRD "Parsing rules".

export interface ParsedLine {
  raw: string;
  name: string;          // leftover words, variant words included (matcher tries this first)
  core: string;          // leftover words with variant words removed
  variants: string[];
  reps: number[] | null;
  seconds: number[] | null;
  weight: number | null;
  weightKind: "lb" | "added" | "assisted" | null;
  bodyweight: boolean;
  notes: string[];
  flags: string[];       // things to ask about: "kg", "plates", "extra-number"
  same: boolean;         // "same squat" = copy last time
}

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20, thirty: 30,
};
const VARIANT_WORDS = [
  "close grip", "single arm", "single-arm", "one arm", "half crimp", "open hand", "3 finger drag",
  "each side", "per side", "per leg", "/side",
  "wide", "narrow", "normal", "neutral", "incline", "decline", "seated", "standing",
];
const HOLD_WORDS = /lock ?offs?|plank|l-?sit|hold/;
const FINGER_WORDS = /\d+\s*mm|repeater|hangboard|fingerboard|crimp|open hand|drag/;

const n = (s: string) => Number(s);
const repeat = (count: number, v: number) => Array.from({ length: count }, () => v);

/** Split a typed block into lines: ";" and line breaks split, commas never do. */
export function splitLines(text: string): string[] {
  return text.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
}

export function parseLine(raw: string, opts: { holdNames?: RegExp } = {}): ParsedLine {
  const out: ParsedLine = {
    raw, name: "", core: "", variants: [], reps: null, seconds: null, weight: null,
    weightKind: null, bodyweight: false, notes: [], flags: [], same: false,
  };
  let t = " " + raw + " ";

  // Parentheses go to the note
  t = t.replace(/\(([^)]*)\)/g, (_, inner) => { if (inner.trim()) out.notes.push(inner.trim()); return " "; });
  t = t.toLowerCase();

  // Normalise: number words, "by", x characters, comma decimals, rep-list separators
  t = t.replace(/\b([a-z]+)\b/g, w => (w in NUM_WORDS ? String(NUM_WORDS[w]) : w));
  t = t.replace(/(\d)\s*(?:×|\*|\bby\b)\s*(\d)/g, "$1x$2");
  t = t.replace(/(?<![\d,])(\d+),(\d)(?![\d,])/g, "$1.$2");
  t = t.replace(/(?<![\d.])\d{1,2}(?:\s*[,\-–]\s*\d{1,2}){1,}(?![\d.])/g, m => m.replace(/\s*[,\-–]\s*/g, "/"));
  t = t.replace(/(\d+)\s+then\s+(\d+)/g, "$1/$2");                 // "7 then 5" = rep list
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:b|l|ln|lv|kb?s)\b(?!\s*band)/g, (m, v) => (/kb?s$/.test(m) ? m : `${v}lb`)); // lb typos: 10b, 10l
  t = t.replace(/(\d+)\s*sec(?:ond)?s?\b/g, "$1s").replace(/(\d+)\s*"/g, "$1s");

  const isHold = HOLD_WORDS.test(t) || (opts.holdNames ? opts.holdNames.test(t) : false);
  const isFinger = FINGER_WORDS.test(t);

  // Notes inside the line
  const noteRules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/\brpe\s*(\d+(?:\.\d)?)/, m => `RPE ${m[1]}`],
    [/@\s*(\d{1,2}(?:\.\d)?)(?![\d.])/, m => (n(m[1]) < 20 ? `RPE ${m[1]}` : "")],
    [/\bfelt\s+\w+/, m => m[0]],
    [/\bfailed(?:\s+(?:the\s+)?last)?(?:\s+rep)?/, m => m[0]],
    [/\b(?:warm[\s-]?up|w\/u)\b/, () => "warm-up"],
    [/\b\d+\s*min(?:ute)?s?\s*(?:break|rest)\b/, m => m[0]],
  ];
  for (const [re, fn] of noteRules) {
    const m = t.match(re);
    if (m) { const note = fn(m); if (note) { out.notes.push(note); t = t.replace(m[0], " "); } }
  }

  if (/^\s*same\b/.test(t)) { out.same = true; t = t.replace(/^\s*same\b/, " "); }

  // Edge size before anything reads "20mm" as a number
  t = t.replace(/(\d+)\s*mm(?:\s*edge)?/g, (_, v) => { out.variants.push(`${v}mm`); return " "; });

  // Holds: sets x seconds
  if (isHold) {
    t = t.replace(/(\d+)\s*x\s*(\d+)s\b/, (_, a, b) => { out.seconds = repeat(n(a), n(b)); return " "; });
    if (!out.seconds) t = t.replace(/(?<![\d.])(\d+)s\b/, (_, b) => { out.seconds = [n(b)]; return " "; });
  }
  // Fingerboard repeater timing (7/3, 10s) is not logged
  if (isFinger) t = t.replace(/(?<![\d.])\d{1,2}\/\d{1,2}(?![\d.\/])/g, " ").replace(/(?<![\d.])\d+s\b/g, " ");

  // Sets and reps
  const setRules: [RegExp, (m: RegExpMatchArray) => void][] = [
    [/(\d+)\s*x\s*(\d+)\s*\+\s*(\d+)\s*x\s*(\d+)/, m => { out.reps = [...repeat(n(m[1]), n(m[2])), ...repeat(n(m[3]), n(m[4]))]; }],
    [/(\d+)\s*x\s*(\d+)\s*x\s*(\d+(?:\.\d+)?)/, m => { out.reps = repeat(n(m[1]), n(m[2])); out.weight = n(m[3]); out.weightKind = "lb"; }],
    [/(\d+)\s*x\s*(\d+(?:\/\d+)+)/, m => { out.reps = m[2].split("/").map(n); }],
    [/(\d+)\s*x\s*(\d+)(?![\d.])/, m => { out.reps = repeat(n(m[1]), n(m[2])); }],
    [/(\d+)\s*sets?\s*(?:of\s*)?(\d+)(?:\s*reps?)?/, m => { out.reps = repeat(n(m[1]), n(m[2])); }],
    [/(?<![\d.])(\d+(?:\/\d+)+)(?![\d.])/, m => { out.reps = m[1].split("/").map(n); }],
    [/(?<![\w.])x\s*(\d+)\b/, m => { out.reps = [n(m[1])]; }],
    [/(?<![\d.])(\d+)\s*reps?\b/, m => { out.reps = [n(m[1])]; }],
  ];
  for (const [re, fn] of setRules) {
    if (out.reps) break;
    const m = t.match(re);
    if (m) { fn(m); t = t.replace(m[0], " "); }
  }

  // Weight
  const take = (re: RegExp, kind: ParsedLine["weightKind"], val?: (m: RegExpMatchArray) => number) => {
    if (out.weight !== null) return;
    const m = t.match(re);
    if (m) { out.weight = val ? val(m) : n(m[1]); out.weightKind = kind; t = t.replace(m[0], " "); }
  };
  const kg = t.match(/(\d+(?:\.\d+)?)\s*kgs?\b/);
  if (kg) { out.flags.push(`kg:${kg[1]}`); t = t.replace(kg[0], " "); }
  take(/(?:\+|\bplus\s*)(\d+(?:\.\d+)?)\s*(?:lbs?|#|pounds?)?/, "added");
  take(/(?:^|\s)-(\d+(?:\.\d+)?)\s*(?:lbs?|#)?/, "assisted");
  const band = t.match(/\b(red|green|blue|black|purple|yellow|orange)\s+band\b/);
  if (band) { out.notes.push(`assisted, ${band[1]} band`); t = t.replace(band[0], " "); }
  take(/(\d+(?:\.\d+)?)\s*(?:lbs?|#|pounds?)(?![a-z])/, "lb");
  take(/@\s*(\d+(?:\.\d+)?)/, "lb");
  if (!isHold) take(/(?<![\d.])(\d+(?:\.\d+)?)s\b/, "lb");
  take(/(\d+(?:\.\d+)?)\s*each\b/, "lb");
  if (/\b(?:bw|body\s?weight)\b/.test(t)) { out.bodyweight = true; t = t.replace(/\b(?:bw|body\s?weight)\b/, " "); }
  if (/\bplates?\b/.test(t)) {
    if (out.weight === null) out.flags.push("plates");
    t = t.replace(/\b\d*\s*plates?\b/g, " ");
  }
  if (out.weight === null && /\bempty bar\b/.test(t)) { out.weight = 45; out.weightKind = "lb"; t = t.replace(/\bempty bar\b/, " "); }
  take(/(?<![\w.\/])(\d+(?:\.\d+)?)(?![\w.\/])/, "lb");
  if (/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/.test(t)) out.flags.push("extra-number");
  if (out.weightKind === "assisted") out.notes.push(`assisted -${out.weight} lb`);

  // Leftover words: strip units and filler, then pull out variant words
  t = t.replace(/\b(?:lbs?|pounds?|kettle?bell|kb|reps?|sets?|of|with|x)\b/g, " ")
       .replace(/[+@#,:*•\-–]/g, " ").replace(/\s+/g, " ").trim();
  out.name = t;
  let core = " " + t + " ";
  for (const w of VARIANT_WORDS) {
    const re = new RegExp(`(?:^|\\s)${w.replace("/", "\\/")}(?=\\s)`);
    if (re.test(core)) { out.variants.push(w.replace("/side", "each side")); core = core.replace(re, " "); }
  }
  core = core.replace(/\b(?:grips?|ea|each)\b/g, " ").replace(/\s+/g, " ").trim();
  out.core = core;
  return out;
}

/** Turn an entry back into a line for editing. */
export function formatLine(name: string, e: { weight: number | null; reps: number[] | null; seconds: number[] | null; variant: string }, added: boolean): string {
  const parts: string[] = [name.toLowerCase()];
  if (e.variant) parts.push(e.variant);
  if (e.seconds?.length) parts.push(`${e.seconds.length}x${e.seconds[0]}s`);
  else if (e.reps?.length) parts.push(e.reps.every(r => r === e.reps![0]) ? `${e.reps.length}x${e.reps[0]}` : e.reps.join("/"));
  if (e.weight !== null) parts.push(added ? `+${e.weight}` : `${e.weight}lb`);
  return parts.join(" ");
}
