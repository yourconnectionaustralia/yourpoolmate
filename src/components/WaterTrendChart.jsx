// File: src/components/WaterTrendChart.jsx
// Your Pool Mate — Water analysis trend graph
// Dependency-free inline SVG line chart. No charting library (stack is locked to
// React + Vite with no chart dep) — this keeps the PWA bundle small.
//
// Features:
//   • Toggle between chemicals (chips) to see a timeline of each parameter
//   • "All" chip overlays every parameter at once, each line normalised to its
//     own ideal band so different scales (pH vs salt) share one canvas —
//     answers "which chemical is drifting?" at a glance
//   • Shaded "ideal" target band per parameter
//   • Tap/hover a point to read its exact value + date
//   • Event overlays pinned to the timeline:
//       - manual events (green-pool treatment, shock, drain/refill, custom)
//       - auto "new equipment" markers (from the equipment register)
//       - auto "untested > 2 months" shaded gap bands (from test spacing)
//
// Mobile-first: SVG scales to container width via viewBox; chips are 44px tap targets.

import { useState } from 'react';
import styles from './WaterTrendChart.module.css';

// ── Series config ────────────────────────────────────────────
// lo/hi = ideal target band. decimals = display precision.
const SERIES = [
  { key: 'freeChlor',       label: 'Chlorine',     unit: 'ppm',  lo: 1,    hi: 3,    decimals: 1 },
  { key: 'pH',              label: 'pH',           unit: '',     lo: 7.2,  hi: 7.6,  decimals: 1 },
  { key: 'alkalinity',      label: 'Alkalinity',   unit: 'ppm',  lo: 80,   hi: 120,  decimals: 0 },
  { key: 'cyanuricAcid',    label: 'Cyanuric',     unit: 'ppm',  lo: 30,   hi: 50,   decimals: 0 },
  { key: 'calciumHardness', label: 'Calcium',      unit: 'ppm',  lo: 200,  hi: 400,  decimals: 0 },
  { key: 'salt',            label: 'Salt',         unit: 'ppm',  lo: 3000, hi: 4500, decimals: 0, saltOnly: true },
  { key: 'score',           label: 'Health Score', unit: '/100', lo: 80,   hi: 100,  decimals: 0, isScore: true },
];

const ALL_KEY = 'all';

// Distinct line colours for the "All" overlay (single-series mode keeps the
// module's default line styling).
const SERIES_COLORS = {
  freeChlor:       '#0077B6',
  pH:              '#7C3AED',
  alkalinity:      '#059669',
  cyanuricAcid:    '#D97706',
  calciumHardness: '#DC2626',
  salt:            '#0891B2',
  score:           '#64748B',
};

// ── Event styling ────────────────────────────────────────────
function eventStyle(type) {
  switch (type) {
    case 'green_treatment': return { color: 'var(--green)',      code: 'G', label: 'Green-pool treatment' };
    case 'shock':           return { color: 'var(--blue)',       code: 'S', label: 'Shock dose' };
    case 'new_equipment':   return { color: 'var(--color-sky)',  code: 'E', label: 'New equipment' };
    case 'drain_refill':    return { color: 'var(--blue)',       code: 'D', label: 'Drain / refill' };
    case 'treatment':       return { color: 'var(--green)',      code: 'T', label: 'Treatment' };
    default:                return { color: 'var(--gray-mid)',   code: '•', label: 'Event' };
  }
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const fmtDateYr = (iso) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

const valOf = (h, s) => {
  const v = s.isScore ? h.score : h[s.key];
  // 0 is a real reading (e.g. no chlorine) and must plot; null/undefined = not tested.
  return Number.isFinite(v) ? v : null;
};

export function WaterTrendChart({ history = [], events = [], gaps = [], saltRange = null }) {
  // The salt "ideal" band follows the owner's chlorinator when known, so the
  // chart matches the Health Score and readings table.
  const seriesList = saltRange
    ? SERIES.map(s => s.key === 'salt' ? { ...s, lo: saltRange.lo, hi: saltRange.hi } : s)
    : SERIES;
  // Which series can actually be shown (has at least one data point).
  const hasSalt = history.some(h => Number.isFinite(h.salt) && h.salt > 0);
  const available = seriesList.filter(s => {
    if (s.saltOnly && !hasSalt) return false;
    if (s.isScore) return history.length > 0;
    return history.some(h => valOf(h, s) != null);
  });

  const [selectedKey, setSelectedKey] = useState('freeChlor');
  const [active, setActive] = useState(null); // { key, i } | null

  const isAll = selectedKey === ALL_KEY;
  const series = available.find(s => s.key === selectedKey) || available[0];
  if (!series) return null;

  // ── Geometry ──────────────────────────────────────────────
  const W = 720, H = 320;
  const padL = 46, padR = 16, padT = 18, padB = 36;
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;
  const plotW = x1 - x0, plotH = y1 - y0;

  // Time domain — span the tests, plus any events / gap-ends so they stay on canvas.
  const times = [
    ...history.map(h => +new Date(h.createdAt)),
    ...events.map(e => +new Date(e.date)),
    ...gaps.flatMap(g => [+new Date(g.start), +new Date(g.end)]),
  ].filter(Number.isFinite);
  let tMin = Math.min(...times);
  let tMax = Math.max(...times);
  if (!Number.isFinite(tMin)) { tMin = Date.now(); tMax = Date.now(); }
  if (tMin === tMax) { tMin -= 86400000; tMax += 86400000; } // 1-day pad for single point
  const xFor = (t) => x0 + ((+new Date(t) - tMin) / (tMax - tMin)) * plotW;

  // ── Single-series value domain — data range widened to include the
  //    target band, then padded.
  const vals = history.map(h => valOf(h, series)).filter(v => v != null);
  let vMin = Math.min(series.lo, ...(vals.length ? vals : [series.lo]));
  let vMax = Math.max(series.hi, ...(vals.length ? vals : [series.hi]));
  const span = vMax - vMin || 1;
  vMin -= span * 0.12;
  vMax += span * 0.12;
  if (!series.isScore) vMin = Math.max(0, vMin);
  if (series.isScore) { vMin = Math.max(0, vMin); vMax = Math.min(100, vMax); }
  const yFor = (v) => y1 - ((v - vMin) / (vMax - vMin)) * plotH;

  // ── "All" overlay mapping — every series' ideal band [lo, hi] maps onto
  //    one shared visual band; values scale linearly around it and clamp to
  //    the plot edges. The y-axis has no shared unit in this mode.
  const bandTop = y0 + plotH * 0.38;
  const bandBottom = y0 + plotH * 0.62;
  const yForAll = (s, v) => {
    const t = bandBottom - ((v - s.lo) / (s.hi - s.lo)) * (bandBottom - bandTop);
    return Math.max(y0 + 6, Math.min(y1 - 6, t));
  };

  // Sorted points + line path for a series under a given y-mapping.
  const ptsFor = (s) => history
    .map((h, i) => ({ i, t: h.createdAt, v: valOf(h, s) }))
    .sort((a, b) => +new Date(a.t) - +new Date(b.t));
  const pathFor = (s, yMap) => {
    let d = '';
    let pen = false;
    for (const p of ptsFor(s)) {
      if (p.v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${xFor(p.t).toFixed(1)} ${yMap(p.v).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  };

  // ── Axis ticks ────────────────────────────────────────────
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, k) => {
    const v = vMin + (k / yTicks) * (vMax - vMin);
    return { v, y: yFor(v) };
  });
  const nPts = history.length;
  const xTickCount = Math.min(5, Math.max(2, nPts));
  const xLabels = Array.from({ length: xTickCount }, (_, k) => {
    const t = tMin + (k / (xTickCount - 1)) * (tMax - tMin);
    return { t, x: xFor(t) };
  });

  const fmtValFor = (s, v) => (s.decimals ? v.toFixed(s.decimals) : Math.round(v).toString());

  // Active readout — works in both modes.
  const activeSeries = active ? available.find(s => s.key === active.key) : null;
  const activeTest = active != null ? history[active.i] : null;
  const activeVal = activeSeries && activeTest ? valOf(activeTest, activeSeries) : null;

  const overlaySeries = isAll ? available : [series];

  return (
    <div className={styles.wrap}>
      {/* Chemical toggle chips */}
      <div className={styles.chips} role="tablist" aria-label="Choose a measurement">
        <button
          role="tab"
          aria-selected={isAll}
          className={`${styles.chip} ${isAll ? styles.chipActive : ''}`}
          onClick={() => { setSelectedKey(ALL_KEY); setActive(null); }}
        >
          All
        </button>
        {available.map(s => (
          <button
            key={s.key}
            role="tab"
            aria-selected={!isAll && s.key === series.key}
            className={`${styles.chip} ${!isAll && s.key === series.key ? styles.chipActive : ''}`}
            onClick={() => { setSelectedKey(s.key); setActive(null); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Readout */}
      <div className={styles.readout}>
        {activeSeries && activeVal != null ? (
          <>
            <span className={styles.readoutVal}>
              {isAll ? `${activeSeries.label} ` : ''}
              {fmtValFor(activeSeries, activeVal)}
              {activeSeries.unit && <span className={styles.readoutUnit}> {activeSeries.unit}</span>}
            </span>
            <span className={styles.readoutDate}>{fmtDateYr(activeTest.createdAt)}</span>
          </>
        ) : isAll ? (
          <span className={styles.readoutHint}>
            Each line is scaled to its own ideal band · tap a point for the reading
          </span>
        ) : (
          <span className={styles.readoutHint}>
            Ideal {series.label}: {fmtValFor(series, series.lo)}–{fmtValFor(series, series.hi)}{series.unit ? ` ${series.unit}` : ''} · tap a point for details
          </span>
        )}
      </div>

      {/* Chart */}
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={isAll ? 'All measurements over time' : `${series.label} over time`}
           preserveAspectRatio="xMidYMid meet">
        {/* Untested gap bands (behind everything) */}
        {gaps.map((g, k) => {
          const gx = xFor(g.start);
          const gw = Math.max(2, xFor(g.end) - gx);
          return (
            <g key={`gap-${k}`}>
              <rect x={gx} y={y0} width={gw} height={plotH} className={styles.gapBand} />
              <line x1={gx} y1={y0} x2={gx} y2={y1} className={styles.gapEdge} />
              <line x1={gx + gw} y1={y0} x2={gx + gw} y2={y1} className={styles.gapEdge} />
            </g>
          );
        })}

        {/* Target band */}
        {isAll ? (
          <>
            <rect x={x0} y={bandTop} width={plotW} height={bandBottom - bandTop}
                  className={styles.targetBand} />
            <text x={x1 - 4} y={bandTop + 12} className={styles.targetLabel} textAnchor="end">ideal</text>
          </>
        ) : (
          <>
            <rect x={x0} y={Math.min(yFor(series.hi), yFor(series.lo))}
                  width={plotW} height={Math.abs(yFor(series.lo) - yFor(series.hi))}
                  className={styles.targetBand} />
            <text x={x1 - 4} y={Math.min(yFor(series.hi), yFor(series.lo)) + 12}
                  className={styles.targetLabel} textAnchor="end">ideal</text>
          </>
        )}

        {/* Y grid + labels (numeric labels only make sense for one scale) */}
        {!isAll && yLabels.map((t, k) => (
          <g key={`y-${k}`}>
            <line x1={x0} y1={t.y} x2={x1} y2={t.y} className={styles.grid} />
            <text x={x0 - 8} y={t.y + 4} className={styles.axisLabel} textAnchor="end">{fmtValFor(series, t.v)}</text>
          </g>
        ))}
        {isAll && (
          <>
            <text x={x0 - 8} y={y0 + 10} className={styles.axisLabel} textAnchor="end">high</text>
            <text x={x0 - 8} y={y1 - 2} className={styles.axisLabel} textAnchor="end">low</text>
          </>
        )}

        {/* X labels */}
        {xLabels.map((t, k) => (
          <text key={`x-${k}`} x={t.x} y={y1 + 22} className={styles.axisLabel} textAnchor="middle">
            {fmtDate(t.t)}
          </text>
        ))}

        {/* Data lines + points */}
        {overlaySeries.map(s => {
          const yMap = isAll ? (v) => yForAll(s, v) : yFor;
          const d = pathFor(s, yMap);
          const color = isAll ? SERIES_COLORS[s.key] : undefined;
          return (
            <g key={`series-${s.key}`}>
              {d && (
                <path
                  d={d}
                  className={styles.line}
                  fill="none"
                  style={color ? { stroke: color } : undefined}
                />
              )}
              {ptsFor(s).map(p => p.v == null ? null : (
                <g key={`pt-${s.key}-${p.i}`}>
                  <circle
                    cx={xFor(p.t)} cy={yMap(p.v)}
                    r={active?.key === s.key && active?.i === p.i ? 5.5 : 3.5}
                    className={styles.point}
                    style={color ? { fill: color } : undefined}
                  />
                  <circle
                    cx={xFor(p.t)} cy={yMap(p.v)} r={isAll ? 12 : 16}
                    className={styles.hit}
                    onMouseEnter={() => setActive({ key: s.key, i: p.i })}
                    onClick={() => setActive({ key: s.key, i: p.i })}
                  />
                </g>
              ))}
            </g>
          );
        })}

        {/* Event markers (point-in-time) */}
        {events.map((e, k) => {
          const ex = xFor(e.date);
          const st = eventStyle(e.type);
          return (
            <g key={`ev-${e.id || k}`}>
              <title>{`${st.label}: ${e.title} (${fmtDateYr(e.date)})`}</title>
              <line x1={ex} y1={y0} x2={ex} y2={y1} stroke={st.color} className={styles.eventLine} />
              <circle cx={ex} cy={y0 + 1} r={8} fill={st.color} />
              <text x={ex} y={y0 + 5} className={styles.eventCode} textAnchor="middle">{st.code}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend — only needed when everything overlays */}
      {isAll && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 8 }}
             aria-hidden="true">
          {available.map(s => (
            <span key={s.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--gray-mid)',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: SERIES_COLORS[s.key],
              }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default WaterTrendChart;
