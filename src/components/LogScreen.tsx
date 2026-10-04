"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { addAlias, addEntries, createExercise, deleteEntry, requestPersistence, restoreEntry, updateEntry } from "@/lib/db";
import { longDate, relDays, shortDate, todayIso, weekOf, fromIso } from "@/lib/dates";
import { splitLines } from "@/lib/parse";
import { entryFields, inferType, resolveLine, type Pick } from "@/lib/resolve";
import { entryLabel, lastTime, setsLabel, weightLabel } from "@/lib/stats";
import { GROUPS, type Entry } from "@/lib/types";
import { useData } from "@/lib/useData";
import { BackupIcon } from "./Icons";
import BackupSheet from "./BackupSheet";
import EntrySheet from "./EntrySheet";
import Nav from "./Nav";

export default function LogScreen() {
  const data = useData();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [editing, setEditing] = useState<Entry | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  useEffect(() => { requestPersistence(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const lines = splitLines(text);
  const resolved = useMemo(() => lines.map((l, i) => resolveLine(l, data.exercises, data.lastUsed, picks[i])), [text, data, picks]); // eslint-disable-line
  const ready = resolved.length > 0 && resolved.every(r => r.status === "ready");

  const sid = `s-${date}`;
  const todays = data.entries.filter(e => e.sessionId === sid).sort((a, b) => a.order - b.order);
  const week = weekOf(date);
  const weekCount = week.filter(d => data.datesWithEntries.has(d)).length;
  const pastDates = [...data.datesWithEntries].filter(d => d < date).sort().reverse().slice(0, 6);

  async function save() {
    if (!ready) return;
    const items = [];
    for (const r of resolved) {
      let ex = r.exercise;
      if (!ex) ex = await createExercise(r.newName!, picks[resolved.indexOf(r)]!.group!, inferType(r.p));
      else if (r.m.kind !== "match" || !r.m.exact) await addAlias(ex.id, r.m.kind === "empty" ? "" : r.m.usedName);
      const last = lastTime(data.historyBefore(ex.id, date))?.last;
      items.push({ exerciseId: ex.id, ...entryFields(r, last) });
    }
    await addEntries(date, items);
    setText(""); setPicks({});
    setToast({ msg: items.length > 1 ? `Added ${items.length} exercises` : "Added" });
  }

  async function remove(e: Entry) {
    const gone = await deleteEntry(e.id);
    setEditing(null);
    if (gone) setToast({ msg: "Deleted", undo: () => { restoreEntry(gone); setToast(null); } });
  }

  const isToday = date === today;
  return (
    <main className="screen">
      <div className="row between">
        <div>
          <button className="h-greet" onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.click()} aria-label="Pick a date">
            {longDate(date)}
          </button>
          <p className="sub">
            {isToday ? `${weekCount} session${weekCount === 1 ? "" : "s"} this week` : `${relDays(date)} days ago · `}
            {!isToday && <button className="linkbtn" onClick={() => setDate(today)}>Back to today</button>}
          </p>
          <input ref={dateInput} className="visually-hidden" type="date" max={today} value={date} onChange={e => e.target.value && setDate(e.target.value)} tabIndex={-1} aria-hidden />
        </div>
        <button className="iconbtn" aria-label="Backup and restore" onClick={() => setBackupOpen(true)}><BackupIcon /></button>
      </div>

      <div className="week" role="group" aria-label="This week">
        {week.map(d => (
          <button key={d} className={`day${data.datesWithEntries.has(d) ? " done" : ""}${d === date ? " on" : ""}`} disabled={d > today} onClick={() => setDate(d)} aria-pressed={d === date}>
            {fromIso(d).toLocaleDateString("en-US", { weekday: "short" })}<span className="num">{fromIso(d).getDate()}</span><i />
          </button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <label htmlFor="log" className="loglabel">{isToday ? "Log an exercise" : `Log to ${shortDate(date)}`}</label>
        <div className="field">
          <span className="plus" aria-hidden>+</span>
          <input id="log" value={text} onChange={e => { setText(e.target.value); }} placeholder="3x7 95lb squat"
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done" />
          <button className="add" type="submit" disabled={!ready}>Add</button>
        </div>
        {resolved.length > 0 && (
          <div className="previews" aria-live="polite">
            {resolved.map((r, i) => <Preview key={i} r={r} pick={picks[i] ?? {}} setPick={p => setPicks({ ...picks, [i]: p })} data={data} date={date} />)}
          </div>
        )}
      </form>

      <h2 className="sec">{isToday ? "Today" : shortDate(date)}</h2>
      {todays.length ? (
        <div className="entries">
          {todays.map(e => {
            const ex = data.exById.get(e.exerciseId);
            return (
              <button key={e.id} className="entry" onClick={() => setEditing(e)}>
                <span className="n">{ex?.name ?? "Unknown"}{e.variant && <span className="sub"> · {e.variant}</span>}</span>
                <span className="s">{setsLabel(e) || "—"}{e.note && ` · ${e.note}`}</span>
                <span className="w num">{weightLabel(e, ex) || "—"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty">{data.loaded && !data.entries.length
          ? "No workouts yet. Type a line above, or load your Notes backup with the button at the top right."
          : "Nothing logged for this day yet."}</p>
      )}

      {pastDates.length > 0 && <h2 className="sec">Earlier</h2>}
      {pastDates.map(d => {
        const list = data.entries.filter(e => data.dateOf.get(e.sessionId) === d).sort((a, b) => a.order - b.order);
        return (
          <button key={d} className="past" onClick={() => { setDate(d); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="d">{shortDate(d)}</span>
            <ul>{list.slice(0, 4).map(e => <li key={e.id}><span>{data.exById.get(e.exerciseId)?.name}</span><span>{entryLabel(e, data.exById.get(e.exerciseId))}</span></li>)}
              {list.length > 4 && <li><span className="sub">+{list.length - 4} more</span><span /></li>}</ul>
          </button>
        );
      })}

      {editing && <EntrySheet entry={editing} data={data} onClose={() => setEditing(null)} onDelete={() => remove(editing)}
        onSave={async patch => { await updateEntry(editing.id, patch); setEditing(null); setToast({ msg: "Saved" }); }} />}
      {backupOpen && <BackupSheet onClose={() => setBackupOpen(false)} onDone={msg => { setBackupOpen(false); setToast({ msg }); }} />}
      {toast && <div className="toast" role="status">{toast.msg}{toast.undo && <button onClick={toast.undo}>Undo</button>}</div>}
      <Nav />
    </main>
  );
}

function Preview({ r, pick, setPick, data, date }: { r: ReturnType<typeof resolveLine>; pick: Pick; setPick: (p: Pick) => void; data: ReturnType<typeof useData>; date: string }) {
  const { p } = r;
  const parts: { t: string; warn?: boolean }[] = [];
  if (p.same) parts.push({ t: "same as last time" });
  if (p.seconds) parts.push({ t: `${p.seconds.length} × ${p.seconds[0]} s hold` });
  else if (p.reps) parts.push({ t: p.reps.every(x => x === p.reps![0]) ? `${p.reps.length} × ${p.reps[0]}` : `${p.reps.join("/")} reps` });
  const added = r.exercise && r.exercise.type !== "weighted";
  if (!p.same) {
    if (p.weightKind === "assisted") parts.push({ t: `assisted −${p.weight} lb` });
    else if (p.weight !== null) parts.push({ t: added || p.weightKind === "added" ? `+${p.weight} lb added` : `${p.weight} lb` });
    else parts.push({ t: "bodyweight" });
  }
  for (const v of p.variants) parts.push({ t: v });
  for (const n of p.notes) parts.push({ t: n });
  for (const f of p.flags) parts.push({ warn: true, t: f.startsWith("kg:") ? `${f.slice(3)} kg? App is lb only` : f === "plates" ? "plates: 25s or 45s? Type the total" : "extra number ignored" });

  const hist = r.exercise ? lastTime(data.historyBefore(r.exercise.id, date)) : null;
  const ex = r.exercise;
  return (
    <div className="preview">
      <div className="name">
        {ex ? ex.name : r.status === "needs-choice" ? `“${r.m.kind === "ambiguous" ? r.m.usedName : ""}”` : r.newName ? cap(r.newName) : "Add an exercise name"}
        {ex && <span className="grp">{ex.group}</span>}
        {r.newName && !ex ? <span className="newtag">New exercise</span> : null}
        {ex && r.m.kind === "match" && !r.m.exact && <span className="sub">from “{r.m.usedName}”</span>}
      </div>
      <div className="parts">{parts.map((x, i) => <span key={i} className={x.warn ? "warn" : ""}>{x.t}</span>)}</div>
      {ex && <div className="last">{hist ? <><span>Last time <b>{entryLabel(hist.last, ex)}</b></span><span>{hist.streak > 1 ? `${hist.streak} in a row` : "1 session"}</span></> : <span>First time logging this</span>}</div>}
      {r.m.kind === "ambiguous" && (
        <div className="pick"><p>Which one?</p><div className="opts">
          {r.m.options.map(o => <button type="button" key={o.id} className="chipbtn" aria-pressed={pick.exerciseId === o.id} onClick={() => setPick({ exerciseId: o.id })}>{o.name}</button>)}
          <button type="button" className="chipbtn" aria-pressed={!!(pick.asNew || pick.group)} onClick={() => setPick({ asNew: true })}>New exercise</button>
        </div></div>
      )}
      {r.newName && !ex && (
        <div className="pick"><p>Pick a group for this exercise</p><div className="opts">
          {GROUPS.map(g => <button type="button" key={g} className="chipbtn" aria-pressed={pick.group === g} onClick={() => setPick({ group: g, asNew: true })}>{g}</button>)}
        </div></div>
      )}
    </div>
  );
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
