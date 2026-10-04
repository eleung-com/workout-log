"use client";
import Link from "next/link";
import { shortDate } from "@/lib/dates";
import { metricFor, prsFor, series, type Dated } from "@/lib/progress";
import { entryLabel, lastTime, setsLabel, weightLabel } from "@/lib/stats";
import type { Exercise } from "@/lib/types";
import type { Data } from "@/lib/useData";
import Chart from "./Chart";

export default function ExerciseView({ ex, data, backHref }: { ex: Exercise; data: Data; backHref: string }) {
  const entries: Dated[] = data.entries.filter(e => e.exerciseId === ex.id).map(e => ({ ...e, date: data.dateOf.get(e.sessionId) ?? "" }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  const m = metricFor(ex);
  const pts = series(entries, m);
  const prs = prsFor(ex, entries);
  const lt = lastTime(entries);
  const best = pts.length ? Math.max(...pts.map(p => p.value)) : null;
  const bestDate = best !== null ? pts.find(p => p.value === best)!.date : "";
  const sessions = new Set(entries.map(e => e.date)).size;

  return (
    <>
      <div className="row">
        <Link href={backHref} className="iconbtn" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></Link>
        <div className="title-c"><b>{ex.name}</b><span className="grp">{ex.group}</span></div>
        <span style={{ width: 40 }} />
      </div>
      <div className="statbar">
        <div><small>Last</small><strong className="num">{lt ? setsLabel(lt.last) || "—" : "—"}</strong><small className="num">{lt ? weightLabel(lt.last, ex) || shortDate((lt.last as Dated).date) : ""}</small></div>
        <div><small>Best</small><strong className="num">{best !== null ? m.fmt(best) : "—"}<em>{m.unit === "lb" ? "lb" : ""}</em></strong><small>{bestDate ? shortDate(bestDate).replace(/^\w+, /, "") : ""}</small></div>
        <div><small>Streak</small><strong className="num">{lt?.streak ?? 0}</strong><small>{(lt?.streak ?? 0) > 1 ? "same in a row" : "changed last time"}</small></div>
      </div>
      <div className="chart">
        <div className="head"><b>{m.title}</b><span className="sub">{m.unit} · {sessions} session{sessions === 1 ? "" : "s"}</span></div>
        <Chart points={pts} unit={m.unit} />
      </div>
      {prs.length > 0 && <h2 className="sec">Personal records</h2>}
      {prs.map(p => (
        <div className="stat" key={p.title}>
          <div className="l"><b>{p.title}</b><span>{shortDate(p.date)}</span></div>
          <div className="r"><strong className="num">{p.value}</strong><span>{p.unit}</span></div>
        </div>
      ))}
      <h2 className="sec">History</h2>
      <div className="sess"><table><tbody>
        {entries.slice(0, 30).map(e => (
          <tr key={e.id}><td><Link href={`/?date=${e.date}`}>{shortDate(e.date)}</Link>{e.variant && <span className="sub"> · {e.variant}</span>}</td><td>{entryLabel(e, ex)}</td></tr>
        ))}
      </tbody></table></div>
    </>
  );
}
