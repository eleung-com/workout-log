"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { relDays } from "@/lib/dates";
import { entryLabel } from "@/lib/stats";
import { GROUPS } from "@/lib/types";
import { useData } from "@/lib/useData";
import ExerciseView from "./ExerciseView";
import Nav from "./Nav";

const ago = (d: string) => { const n = relDays(d); return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };

export default function ProgressScreen() {
  const data = useData();
  const exId = useSearchParams().get("ex");
  const ex = exId ? data.exById.get(exId) : undefined;
  if (ex) return <main className="screen"><ExerciseView ex={ex} data={data} backHref="/progress/" /><Nav /></main>;

  const latest = new Map<string, { date: string; label: string; n: number }>();
  for (const e of data.entries) {
    const d = data.dateOf.get(e.sessionId) ?? "", cur = latest.get(e.exerciseId);
    const n = (cur?.n ?? 0) + 1;
    if (!cur || d > cur.date) latest.set(e.exerciseId, { date: d, label: entryLabel(e, data.exById.get(e.exerciseId)), n }); else cur.n = n;
  }
  return (
    <main className="screen">
      <div><p className="h-greet">Progress</p><p className="sub">{data.exercises.length} exercises · tap one for its chart and PRs</p></div>
      {data.loaded && !data.exercises.length && <p className="empty">Log a workout or load your backup to see progress here.</p>}
      {GROUPS.map(g => {
        const list = data.exercises.filter(x => x.group === g).sort((a, b) => (latest.get(b.id)?.date ?? "").localeCompare(latest.get(a.id)?.date ?? ""));
        if (!list.length) return null;
        return (
          <section key={g} className="exgroup">
            <h2 className="sec">{g}</h2>
            <div className="exlist">
              {list.map(x => {
                const l = latest.get(x.id);
                return (
                  <Link key={x.id} href={`/progress/?ex=${encodeURIComponent(x.id)}`} className="exrow">
                    <span><b>{x.name}</b><span className="sub">{l ? `${ago(l.date)} · ${l.n} session${l.n === 1 ? "" : "s"}` : "not logged yet"}</span></span>
                    <span className="num">{l?.label ?? ""}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
      <Nav />
    </main>
  );
}
