"use client";
import { useState } from "react";
import { mergeExercises, updateExercise } from "@/lib/db";
import { GROUPS, type Exercise } from "@/lib/types";
import type { Data } from "@/lib/useData";

/** Rename, regroup, or merge a duplicate into another exercise. */
export default function ExerciseSheet({ ex, data, onClose, onMerged }: { ex: Exercise; data: Data; onClose: () => void; onMerged: (toId: string, moved: number) => void }) {
  const [name, setName] = useState(ex.name);
  const [group, setGroup] = useState(ex.group);
  const [mode, setMode] = useState<"edit" | "merge">("edit");
  const [target, setTarget] = useState<Exercise | null>(null);
  const [filter, setFilter] = useState("");
  const count = data.entries.filter(e => e.exerciseId === ex.id).length;
  const others = data.exercises.filter(x => x.id !== ex.id && x.name.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    await updateExercise(ex.id, { name: name.trim() || ex.name, group });
    onClose();
  }
  async function merge() {
    if (!target) return;
    const moved = await mergeExercises(ex.id, target.id);
    onMerged(target.id, moved);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Edit exercise" onClick={e => e.stopPropagation()}>
        {mode === "edit" ? (<>
          <h2>Edit exercise</h2>
          <div className="field"><input aria-label="Exercise name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="opts">{GROUPS.map(g => <button key={g} type="button" className="chipbtn" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
          {ex.aliases.length > 0 && <p className="sub">Also matches: {ex.aliases.join(", ")}</p>}
          <div className="actions">
            <button className="btn" onClick={() => setMode("merge")}>Merge into…</button>
            <button className="btn primary" onClick={save}>Save</button>
          </div>
        </>) : !target ? (<>
          <h2>Merge {ex.name} into…</h2>
          <p className="sub">Use this when one exercise got logged under two names. Its {count} entr{count === 1 ? "y" : "ies"} move over and “{ex.name}” becomes an alternate spelling.</p>
          <div className="field"><input aria-label="Find exercise" placeholder="Find exercise" value={filter} onChange={e => setFilter(e.target.value)} /></div>
          <div className="exlist mergelist">
            {others.map(x => <button key={x.id} className="exrow" onClick={() => setTarget(x)}><span><b>{x.name}</b><span className="sub">{x.group}</span></span><span /></button>)}
          </div>
          <button className="btn" onClick={() => setMode("edit")}>Back</button>
        </>) : (<>
          <h2>Merge into {target.name}?</h2>
          <p className="sub">{count} entr{count === 1 ? "y" : "ies"} move from <b>{ex.name}</b> to <b>{target.name}</b>, and {ex.name} is removed. This can&apos;t be undone, except by loading a backup.</p>
          <div className="actions">
            <button className="btn" onClick={() => setTarget(null)}>Cancel</button>
            <button className="btn danger" onClick={merge}>Merge</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
