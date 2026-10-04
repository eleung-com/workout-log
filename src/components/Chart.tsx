"use client";
import { useEffect, useRef } from "react";
import { fromIso } from "@/lib/dates";
import { niceTicks, type Point } from "@/lib/progress";

/** Rounded bars, one per session. Best session in ink with its value; scrolls sideways when long. */
export default function Chart({ points, unit }: { points: Point[]; unit: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) box.current.scrollLeft = box.current.scrollWidth; }, [points]);
  if (!points.length) return <p className="sub">Nothing to chart yet.</p>;
  const max = Math.max(...points.map(p => p.value));
  const ticks = niceTicks(max), top = ticks[ticks.length - 1];
  const bestIdx = points.findIndex(p => p.value === max);
  const step = 30, left = 34, H = 150, base = 128, plotTop = 18;
  const W = Math.max(300, left + points.length * step + 6);
  const y = (v: number) => base - (v / top) * (base - plotTop);
  const every = points.length > 14 ? 2 : 1;
  return (
    <div className="chartscroll" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chart in ${unit}, best ${max}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--hair)" />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = left + i * step + 6, h = Math.max(base - y(p.value), 2);
          return (
            <g key={p.date}>
              <rect x={x} y={base - h} width={18} height={h} rx={6} fill={i === bestIdx ? "var(--ink)" : "var(--mint)"} />
              {i === bestIdx && <text x={x + 9} y={base - h - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">{p.label}</text>}
              {i % every === 0 && <text x={x + 9} y={base + 15} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{fromIso(p.date).getMonth() + 1}/{fromIso(p.date).getDate()}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
