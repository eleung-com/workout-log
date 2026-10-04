"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "./db";
import type { Entry, Exercise, Session } from "./types";

export interface Data {
  exercises: Exercise[]; sessions: Session[]; entries: Entry[];
  exById: Map<string, Exercise>; dateOf: Map<string, string>;
  lastUsed: Record<string, number>;
  /** entries for an exercise strictly before a date, newest first */
  historyBefore: (exerciseId: string, date: string) => Entry[];
  datesWithEntries: Set<string>;
  loaded: boolean;
}

export function useData(): Data {
  const raw = useLiveQuery(async () => {
    const [exercises, sessions, entries] = await Promise.all([db.exercises.toArray(), db.sessions.toArray(), db.entries.toArray()]);
    return { exercises, sessions, entries };
  }, []);
  return useMemo(() => {
    const exercises = raw?.exercises ?? [], sessions = raw?.sessions ?? [], entries = raw?.entries ?? [];
    const exById = new Map(exercises.map(e => [e.id, e]));
    const dateOf = new Map(sessions.map(s => [s.id, s.date]));
    const byEx = new Map<string, Entry[]>();
    for (const e of entries) byEx.set(e.exerciseId, [...(byEx.get(e.exerciseId) ?? []), e]);
    const key = (e: Entry) => `${dateOf.get(e.sessionId) ?? ""}#${String(e.order).padStart(4, "0")}`;
    for (const list of byEx.values()) list.sort((a, b) => key(b).localeCompare(key(a)));
    const lastUsed: Record<string, number> = {};
    for (const [id, list] of byEx) lastUsed[id] = Date.parse(dateOf.get(list[0].sessionId) ?? "1970-01-01");
    const datesWithEntries = new Set(entries.map(e => dateOf.get(e.sessionId)!).filter(Boolean));
    return {
      exercises, sessions, entries, exById, dateOf, lastUsed, datesWithEntries, loaded: !!raw,
      historyBefore: (id, date) => (byEx.get(id) ?? []).filter(e => (dateOf.get(e.sessionId) ?? "") < date),
    };
  }, [raw]);
}
