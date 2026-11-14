

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT CONSTANTS
// ─────────────────────────────────────────────────────────────────
// 'Chlorinator' covers both salt and mineral units (renamed from 'Salt
// Chlorinator', July 2026). Existing rows with the old label are
// normalised when opened for editing.
export const EQUIPMENT_TYPES = [
  'Pump', 'Filter', 'Heater / Heat Pump', 'Robotic Cleaner',
  'Suction Cleaner', 'Chlorinator', 'Lighting', 'Other',
];

// The Equipment page prompts for each of these until one has been added.
// 'Other' is deliberately absent — it's a catch-all, not something an owner
// can be asked to go and find. Each line says what the app does with it, so
// the row answers "why should I bother" before it's asked.
export const EQUIPMENT_PROMPTS = [
  { type: 'Pump',               why: 'Sets your daily run time and turnover guidance.' },
  { type: 'Filter',             why: 'Drives backwash and media-change reminders.' },
  { type: 'Chlorinator',        why: 'Sets your salt target and cell-clean interval.' },
  { type: 'Heater / Heat Pump', why: 'Adjusts seasonal chemistry for a heated pool.' },
  { type: 'Robotic Cleaner',    why: 'Adds service intervals for the unit.' },
  { type: 'Suction Cleaner',    why: 'Tracks hose and diaphragm wear.' },
  { type: 'Lighting',           why: 'Logs globe and transformer replacements.' },
];

// Popular AU brands per equipment type — shown as a dropdown with an
// "Other" escape hatch to free text. Types not listed here (Filter,
// Lighting, Other) get a plain free-text brand field.
export const EQUIPMENT_BRANDS = {
  'Pump':               ['AstralPool', 'Davey', 'Hayward', 'Hurlcon', 'Zodiac', 'Waterco', 'Onga', 'Poolrite'],
  'Suction Cleaner':    ['Kreepy Krauly', 'Zodiac', 'Hayward'],
  'Heater / Heat Pump': ['Australian Energy Systems', 'Madimack', 'EvoHeat', 'Zodiac'],
  'Robotic Cleaner':    ['Zodiac', 'Kreepy Krauly', 'Maytronics'],
  'Chlorinator':        ['AstralPool', 'Zodiac', 'Pool Controls', 'Maytronics Mineral Swim', 'Pool Pro'],
};

// Popular AU models per equipment type + brand (keyed 'Type|Brand'). Shown as
// a dropdown once a brand is picked, with an "Other" fall-back to free text.
// Kept mostly at series level — owners rarely know the exact size variant, and
// the free-text field still captures it. Includes well-known legacy lines
// (owners log gear they already own, often 5–15 years old).
export const EQUIPMENT_MODELS = {
  // Pumps
  'Pump|AstralPool': ['Viron XT', 'CTX Series', 'BX Series', 'E-Series'],
  'Pump|Davey':      ['PowerMaster 200', 'PowerMaster 250', 'PowerMaster 350', 'PowerMaster 450', 'PowerMaster Eco', 'Silensor SLL'],
  'Pump|Hayward':    ['TriStar', 'Super Pump', 'MaxFlo'],
  'Pump|Hurlcon':    ['CX Series', 'TX Series', 'CTX', 'E-Series'],
  'Pump|Zodiac':     ['FloPro E3', 'FloPro'],
  'Pump|Waterco':    ['Hydrostorm', 'Supastream', 'Supatuf'],
  'Pump|Onga':       ['LeisureTime LTP', 'Pantera PPP', 'SilentFlo'],
  'Pump|Poolrite':   ['SQI Series', 'SQ/SQI Gemini', 'Enduro'],
  // Suction cleaners
  'Suction Cleaner|Kreepy Krauly': ['Sprinta Plus', 'VTX-3', 'VTX-7', 'Marathon'],
  'Suction Cleaner|Zodiac':        ['MX8', 'MX6'],
  'Suction Cleaner|Hayward':       ['AquaNaut 250', 'AquaNaut 450', 'PoolVac XL', 'Navigator V-Flex'],
  // Heaters / heat pumps
  'Heater / Heat Pump|Australian Energy Systems': ['Ultra Inverter', 'Ai Aqua-Inverter Plus', 'EFI Ultra', 'TDI'],
  'Heater / Heat Pump|Madimack': ['InverELITE V4', 'InverELITE V3'],
  'Heater / Heat Pump|EvoHeat':  ['Fusion-i', 'Fusion-i Pro', 'Force-i'],
  'Heater / Heat Pump|Zodiac':   ['Z400 iQ'],
  // Robotic cleaners
  'Robotic Cleaner|Zodiac':        ['CX20', 'CX35', 'TX35', 'VX40', 'VX50'],
  'Robotic Cleaner|Kreepy Krauly': ['rX-Tank Pro'],
  'Robotic Cleaner|Maytronics':    ['Dolphin M600', 'Dolphin M700', 'Dolphin S400', 'Liberty 600'],
  // Chlorinators
  'Chlorinator|AstralPool':             ['eQuilibrium EQ18', 'eQuilibrium EQ25', 'eQuilibrium EQ35', 'eQuilibrium EQ45'],
  'Chlorinator|Zodiac':                 ['eXO iQ', 'eXO iQ pH', 'eXO PRO', 'TRi-XO', 'TRi'],
  'Chlorinator|Pool Controls':          ['SWC 15', 'SWC 25', 'SWC 35', 'SWC 45', 'SWC 60', 'XLS'],
  'Chlorinator|Maytronics Mineral Swim': ['PRO20', 'PRO25', 'PRO40'],
  'Chlorinator|Pool Pro':               ['CPP', 'CPPS', 'MineralX'],
};
