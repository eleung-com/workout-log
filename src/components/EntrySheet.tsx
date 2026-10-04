"use client";
import { useState } from "react";
import { formatLine } from "@/lib/parse";
import { entryFields, resolveLine } from "@/lib/resolve";
import type { Entry } from "@/lib/types";
import type { Data } from "@/lib/useData";

export default function EntrySheet({ entry, data, onClose, onSave, onDelete }:
  { entry: Entry; data: Data; onClose: () => void; onSave: (p: Partial<Entry>) => void; onDelete: () => void }) {
  const ex = data.exById.get(entry.exerciseId);
  const [text, setText] = useState(formatLine(ex?.name ?? "", entry, !!ex && ex.type !== "weighted"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    const r = resolveLine(text, data.exercises, data.lastUsed, {});
    // Keep the exercise unless the edited name clearly points at a different one
    const exerciseId = r.m.kind === "match" ? r.m.exercise.id : entry.exerciseId;
    const f = entryFields(r);
    onSave({ exerciseId, weight: f.weight, reps: f.reps, seconds: f.seconds, variant: f.variant, note: f.note || entry.note, source: text });
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Edit entry" onClick={e => e.stopPropagation()}>
        <h2>Edit {ex?.name ?? "entry"}</h2>
        <div className="field">
          <input aria-label="Entry" value={text} onChange={e => setText(e.target.value)} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            onKeyDown={e => { if (e.key === "Enter") save(); }} />
        </div>
        {confirmDelete ? (
          <div className="actions">
            <button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <button className="btn danger" onClick={onDelete}>Yes, delete</button>
          </div>
        ) : (
          <div className="actions">
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete</button>
            <button className="btn primary" onClick={save}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}
