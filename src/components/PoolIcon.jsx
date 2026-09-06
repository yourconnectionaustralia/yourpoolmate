// File: src/components/PoolIcon.jsx
//
// One line-icon set for everywhere the app used to sit an emoji.
//
// House style, matched to the `Icon` set already in App.jsx so the whole app
// reads as one family:
//   · 24×24 viewBox, drawn on the 4–20 field
//   · fill: none, stroke: currentColor, round caps and joins
//   · stroke 1.6 at small sizes, easing to 1.4 above 32px so a large icon
//     doesn't read heavier than a small one
//
// Colour comes from `currentColor` — set it on the wrapper, not here.
//
// Usage: <PoolIcon name="pump" size={22} />

const PATHS = {
  // ── Pool equipment ──────────────────────────────────────────
  // Centrifugal pump: volute, impeller, discharge elbow, base.
  // Pump: strainer pot, wet end and finned motor on the base.
  pump: (
    <>
      <path d="M3.4 19.8h17.2" />
      <rect x="11" y="9.4" width="9.4" height="7.6" rx="2" />
      <path d="M14.4 9.4v7.6M17.4 9.4v7.6" />
      <circle cx="7.6" cy="13.2" r="4.6" />
      <path d="M5.6 9.2V7a2 2 0 0 1 4 0v2.2" />
    </>
  ),
  // Filter: pressure vessel with its mid band and top inlet stub.
  // Filter: round media tank with its multiport valve and sand bed.
  filter: (
    <>
      <circle cx="12" cy="13" r="6.2" />
      <path d="M12 6.8V4.9" />
      <rect x="9.3" y="2.5" width="5.4" height="2.4" rx="0.9" />
      <path d="M6.5 15c1.7-1.1 3.6-1.1 5.5 0s3.8 1.1 5.5 0" />
      <path d="M6.6 20.4h10.8" />
    </>
  ),
  // Chlorinator: an electrolytic cell — plates in a housing, lead out the top.
  // Chlorinator: cell plumbed in line, with the bolt for electrolysis.
  chlorinator: (
    <>
      <rect x="5.5" y="8.6" width="13" height="9" rx="2" />
      <path d="M5.5 13.1H2.6M18.5 13.1h2.9" />
      <path d="M13 10.4 10.3 13.6h3.4L11 16.6" />
    </>
  ),
  // Heater / heat pump: unit with heat rising off it.
  // Heater / heat pump: cabinet with the fan in its centre.
  heater: (
    <>
      <rect x="2.8" y="5.8" width="18.4" height="12.4" rx="2.4" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.3" />
      <path d="M12.1 10.8q2.3-.4 3.1 1.4" />
      <path d="M12.1 10.8q2.3-.4 3.1 1.4" transform="rotate(120 12 12)" />
      <path d="M12.1 10.8q2.3-.4 3.1 1.4" transform="rotate(240 12 12)" />
    </>
  ),
  // Robotic cleaner: domed body, rollers, carry handle.
  // Robotic cleaner: body on drive wheels, floating lead.
  robot: (
    <>
      <path d="M5 15.4V12a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3.4" />
      <circle cx="8.2" cy="17.6" r="2.4" />
      <circle cx="15.8" cy="17.6" r="2.4" />
      <path d="M10.6 17.6h2.8" />
      <path d="M16.4 9V7.2c0-1.7 1.4-3.2 3.2-3.2" />
    </>
  ),
  // Suction cleaner: head on the floor with the hose running up.
  // Suction cleaner: head on the floor, hose arching away.
  suction: (
    <>
      <path d="M4.2 20.2h8.6" />
      <path d="M5.8 20.2v-2.3a2.7 2.7 0 0 1 5.4 0v2.3" />
      <path d="M8.5 15.2V9.4a4.4 4.4 0 0 1 8.8 0v3.6" />
    </>
  ),
  // Lighting: globe.
  bulb: (
    <>
      <path d="M9 17.4c0-1.2-.5-2-1.3-2.8a5.5 5.5 0 1 1 8.6 0c-.8.8-1.3 1.6-1.3 2.8" />
      <path d="M9 17.4h6" />
      <path d="M10.2 20.5h3.6" />
    </>
  ),
  // Anything else: a spanner.
  wrench: (
    <path d="M15.2 4.4a4.8 4.8 0 0 0-6 6.2L4 15.8a2 2 0 0 0 0 2.8l1.4 1.4a2 2 0 0 0 2.8 0l5.2-5.2a4.8 4.8 0 0 0 6.2-6l-2.9 2.9-2.6-.6-.6-2.6z" />
  ),
  // Generic pool hardware — the nav's Equipment item.
  // Pool hardware: toolbox.
  hardware: (
    <>
      <path d="M2.8 11.2h18.4v7.2a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2z" />
      <path d="M8.6 11.2V8.4a2.2 2.2 0 0 1 2.2-2.2h2.4a2.2 2.2 0 0 1 2.2 2.2v2.8" />
      <path d="M10.6 11.2v2.6h2.8v-2.6" />
    </>
  ),

  // ── Seasons ─────────────────────────────────────────────────
  // Autumn: fallen leaf.
  leaf: (
    <>
      <path d="M20.4 4.2c.9 7.4-3.4 14.3-10.6 14.3-1.2 0-2.3-.3-3.2-.8C6 9.6 12 4 20.4 4.2z" />
      <path d="M4 20.4c2.2-3 4.7-5.6 7.4-7.8" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 2.5v19" />
      <path d="M3.8 7.2l16.4 9.6" />
      <path d="M20.2 7.2L3.8 16.8" />
      <path d="M9.6 4.6 12 6.4l2.4-1.8M9.6 19.4 12 17.6l2.4 1.8" />
      <path d="M4.2 10.4 5 7.6l2.9-.4M19.8 13.6 19 16.4l-2.9.4" />
      <path d="M7.9 17.2 5 16.8l-.8-2.8M16.1 6.8l2.9.4.8 2.8" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 20.5v-7.2" />
      <path d="M12 13.3C12 10 9.3 7.3 6 7.3c0 3.3 2.7 6 6 6z" />
      <path d="M12 15.3c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3" />
      <path d="M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),

  // ── Everywhere else ─────────────────────────────────────────
  swimmer: (
    <>
      <circle cx="7" cy="8" r="2.3" />
      <path d="M4 14.6 9.6 12l4.6 2.2 4.8-2.6" />
      <path d="M9.6 12 12.6 7.2 16.6 9" />
      <path d="M2.5 18.8c1.7 0 1.7 1.4 3.4 1.4s1.7-1.4 3.4-1.4 1.7 1.4 3.4 1.4 1.7-1.4 3.4-1.4 1.7 1.4 3.4 1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.8 2.8L16.5 9.3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.6 7.6 12 13.2l8.4-5.6" />
    </>
  ),
  // "You already have an account" — a known face, not a wave.
  userCheck: (
    <>
      <circle cx="10" cy="8" r="3.6" />
      <path d="M3.4 19.6c1.3-3.4 3.7-5.1 6.6-5.1.9 0 1.8.2 2.6.5" />
      <path d="M14.6 17.6l2 2 4-4.6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <rect x="9" y="2.6" width="6" height="4" rx="1.2" />
      <path d="M8.6 11.5h6.8M8.6 15.5h4.4" />
    </>
  ),
  camera: (
    <>
      <path d="M22 18.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3l1.8-2.6h6.4L17 6.5h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  droplet: (
    <path d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z" />
  ),
  close: (
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  ),
}

export function PoolIcon({ name, size = 20, strokeWidth, className, style, title }) {
  const shape = PATHS[name] || PATHS.wrench
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (size >= 32 ? 1.4 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {shape}
    </svg>
  )
}

// Equipment type → icon name. Matches on substrings so legacy labels
// ("Salt Chlorinator", "Heat Pump") still resolve.
export function equipmentIconName(type) {
  if (!type) return 'wrench'
  const t = type.toLowerCase()
  if (t.includes('pump') && !t.includes('heat')) return 'pump'
  if (t.includes('filter')) return 'filter'
  if (t.includes('heat')) return 'heater'
  if (t.includes('robot')) return 'robot'
  if (t.includes('suction') || t.includes('cleaner')) return 'suction'
  if (t.includes('chlorin') || t.includes('salt')) return 'chlorinator'
  if (t.includes('light')) return 'bulb'
  return 'wrench'
}

export default PoolIcon
