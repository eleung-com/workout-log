"use client";
import Link from "next/link";
import { useState } from "react";
import { fromIso, iso, shortDate, todayIso } from "@/lib/dates";
import { isPR } from "@/lib/progress";
import { entryLabel } from "@/lib/stats";
import { useData } from "@/lib/useData";
import Nav from "./Nav";

export default function HistoryScreen() {
  const data = useData();
  const t = fromIso(todayIso());
  const [ym, setYm] = useState<[number, number]>([t.getFullYear(), t.getMonth()]);
  const [y, m] = ym;
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), pad = (first.getDay() + 6) % 7;
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;

  const prDates = new Set<string>();
  for (const e of data.entries) {
    const d = data.dateOf.get(e.sessionId) ?? "", ex = data.exById.get(e.exerciseId);
    if (d.startsWith(monthKey) && ex && isPR(e, ex, data.historyBefore(ex.id, d))) prDates.add(d);
  }
  const monthDates = [...data.datesWithEntries].filter(d => d.startsWith(monthKey)).sort().reverse();
  const total = data.datesWithEntries.size;
  const firstDate = [...data.datesWithEntries].sort()[0];
  const shift = (k: number) => { const d = new Date(y, m + k, 1); setYm([d.getFullYear(), d.getMonth()]); };
  const isCurrent = y === t.getFullYear() && m === t.getMonth();

  return (
    <main className="screen">
      <div><p className="h-greet">History</p><p className="sub">{total} sessions{firstDate ? ` since ${shortDate(firstDate).replace(/^\w+, /, "")}` : ""}</p></div>
      <div className="cal">
        <div className="row between">
          <button className="iconbtn sm" onClick={() => shift(-1)} aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></button>
          <b>{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b>
          <button className="iconbtn sm" onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
        <div className="grid">
          {["M", "T", "W", "T", "F", "S", "S"].map((h, i) => <span key={i} className="h">{h}</span>)}
          {Array.from({ length: pad }, (_, i) => <span key={`p${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const d = iso(new Date(y, m, i + 1));
            const cls = prDates.has(d) ? "l2" : data.datesWithEntries.has(d) ? "l1" : "";
            return data.datesWithEntries.has(d)
              ? <Link key={d} href={`/?date=${d}`} className={`num ${cls}${d === todayIso() ? " today" : ""}`}>{i + 1}</Link>
              : <span key={d} className={`num${d === todayIso() ? " today" : ""}`}>{i + 1}</span>;
          })}
        </div>
        <div className="legend"><span><i className="l1" />Session</span><span><i className="l2" />Had a PR</span><span className="sub">{monthDates.length} this month</span></div>
      </div>
      {monthDates.length === 0 && <p className="empty">No sessions this month.</p>}
      {monthDates.map(d => {
        const list = data.entries.filter(e => data.dateOf.get(e.sessionId) === d).sort((a, b) => a.order - b.order);
        const groups = [...new Set(list.map(e => data.exById.get(e.exerciseId)?.group).filter(Boolean))];
        return (
          <Link key={d} href={`/?date=${d}`} className="sess">
            <div className="row between"><b>{shortDate(d)}</b><span className="sub">{groups.join(" · ")}</span></div>
            <table><tbody>
              {list.map(e => {
                const ex = data.exById.get(e.exerciseId);
                const pr = ex && isPR(e, ex, data.historyBefore(ex.id, d));
                return <tr key={e.id}><td>{ex?.name}{pr && <span className="badge pr">PR</span>}</td><td>{entryLabel(e, ex)}</td></tr>;
              })}
            </tbody></table>
          </Link>
        );
      })}
      <Nav />
    </main>
  );
}
