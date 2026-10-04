export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const todayIso = () => iso(new Date());
export function weekOf(date: string): string[] {
  const d = fromIso(date); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return iso(x); });
}
export const longDate = (s: string) => fromIso(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
export const shortDate = (s: string) => fromIso(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const relDays = (s: string) => Math.round((fromIso(todayIso()).getTime() - fromIso(s).getTime()) / 864e5);
