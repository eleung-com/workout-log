export type ExType = "weighted" | "bodyweight" | "added-weight" | "hold";
export const GROUPS = ["Push", "Pull", "Legs", "Core", "Fingerboard", "Conditioning"] as const;
export type Group = (typeof GROUPS)[number];

export interface Exercise { id: string; name: string; type: ExType; group: Group; aliases: string[] }
export interface Session { id: string; date: string; note: string }
export interface Entry {
  id: string; sessionId: string; exerciseId: string; order: number;
  weight: number | null;          // lb. Dumbbells per hand, barbell total, bodyweight moves = added weight
  reps: number[] | null;          // reps per set
  seconds: number[] | null;       // holds: seconds per set
  variant: string; note: string; source?: string;
  createdAt?: number;
}
export interface Backup { app: "lift-log"; version: 1; exportedAt: string; units: "lb"; exercises: Exercise[]; sessions: Session[]; entries: Entry[] }
