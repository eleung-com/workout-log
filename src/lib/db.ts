"use client";
import Dexie, { type Table } from "dexie";
import type { Backup, Entry, Exercise, Session } from "./types";

// All data lives on the phone (IndexedDB). No server, no login. Backup file = the safety net.
class LiftDB extends Dexie {
  exercises!: Table<Exercise, string>;
  sessions!: Table<Session, string>;
  entries!: Table<Entry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super("lift-log");
    this.version(1).stores({
      exercises: "id, name, group",
      sessions: "id, date",
      entries: "id, sessionId, exerciseId",
      meta: "key",
    });
  }
}
export const db = new LiftDB();

export const sessionId = (date: string) => `s-${date}`;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Ask the browser not to clear our storage. Installed home-screen apps usually get it. */
export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export async function addEntries(date: string, items: Omit<Entry, "id" | "sessionId" | "order">[]) {
  const sid = sessionId(date);
  await db.transaction("rw", db.sessions, db.entries, async () => {
    if (!(await db.sessions.get(sid))) await db.sessions.put({ id: sid, date, note: "" });
    let order = await db.entries.where("sessionId").equals(sid).count();
    for (const it of items) await db.entries.put({ ...it, id: uid("e"), sessionId: sid, order: ++order, createdAt: Date.now() });
  });
}

export const updateEntry = (id: string, patch: Partial<Entry>) => db.entries.update(id, patch);

export async function deleteEntry(id: string): Promise<Entry | undefined> {
  const e = await db.entries.get(id);
  if (e) await db.entries.delete(id);
  return e;
}
export const restoreEntry = (e: Entry) => db.entries.put(e);

export async function createExercise(name: string, group: Exercise["group"], type: Exercise["type"]): Promise<Exercise> {
  let id = slug(name) || uid("x");
  if (await db.exercises.get(id)) id = `${id}-${Date.now().toString(36)}`;
  const ex: Exercise = { id, name: name.charAt(0).toUpperCase() + name.slice(1), group, type, aliases: [] };
  await db.exercises.put(ex);
  return ex;
}

/** Confirmed typos become alternate spellings, so the app learns. */
export async function addAlias(exerciseId: string, alias: string) {
  const a = alias.trim().toLowerCase();
  const ex = await db.exercises.get(exerciseId);
  if (!ex || !a || ex.name.toLowerCase() === a || ex.aliases.includes(a)) return;
  await db.exercises.update(exerciseId, { aliases: [...ex.aliases, a] });
}

export async function exportBackup(): Promise<Backup> {
  const [exercises, sessions, entries] = await Promise.all([db.exercises.toArray(), db.sessions.toArray(), db.entries.toArray()]);
  await db.meta.put({ key: "lastBackup", value: Date.now() });
  return { app: "lift-log", version: 1, exportedAt: new Date().toISOString(), units: "lb", exercises, sessions, entries };
}

/** Merge a backup file in. Same ids overwrite, nothing else is removed. */
export async function restoreBackup(b: Backup): Promise<{ sessions: number; entries: number }> {
  if (b?.app !== "lift-log" || !Array.isArray(b.entries)) throw new Error("This isn't a Lift Log backup file.");
  await db.transaction("rw", db.exercises, db.sessions, db.entries, async () => {
    await db.exercises.bulkPut(b.exercises);
    await db.sessions.bulkPut(b.sessions);
    await db.entries.bulkPut(b.entries);
  });
  return { sessions: b.sessions.length, entries: b.entries.length };
}

export const updateExercise = (id: string, patch: Partial<Exercise>) => db.exercises.update(id, patch);

/** Move every entry from one exercise to another, keep its names as alternate spellings, remove the old one. */
export async function mergeExercises(fromId: string, toId: string): Promise<number> {
  if (fromId === toId) return 0;
  return db.transaction("rw", db.exercises, db.entries, async () => {
    const [from, to] = await Promise.all([db.exercises.get(fromId), db.exercises.get(toId)]);
    if (!from || !to) throw new Error("Exercise not found");
    const moved = await db.entries.where("exerciseId").equals(fromId).modify({ exerciseId: toId });
    const names = [from.name, ...from.aliases].map(a => a.toLowerCase()).filter(a => a !== to.name.toLowerCase());
    await db.exercises.update(toId, { aliases: [...new Set([...to.aliases, ...names])] });
    await db.exercises.delete(fromId);
    return moved;
  });
}

/** Days since the last saved backup, or null if never. */
export async function daysSinceBackup(): Promise<number | null> {
  const m = await db.meta.get("lastBackup");
  return m?.value ? Math.floor((Date.now() - (m.value as number)) / 864e5) : null;
}
