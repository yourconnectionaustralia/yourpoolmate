

// ─────────────────────────────────────────────────────────────────
// POOL SETUP OPTIONS
// ─────────────────────────────────────────────────────────────────
export const POOL_TYPES = [
  'In-ground', 'Above-ground', 'Plunge pool', 'Container pool',
  'Lap pool', 'Indoor pool', 'Spa / spool', 'Swim spa',
];

export const POOL_SHAPES = [
  'Rectangular', 'Oval', 'Kidney / freeform', 'Round',
  'L-shaped', 'Square', 'Figure-8', 'Other',
];

export const POOL_SURFACES = [
  'Pebble / pebblecrete', 'Concrete / rendered', 'Fibreglass',
  'Vinyl liner', 'Fully tiled', 'Painted concrete', 'Other',
];

export const SANITISER_TYPES = [
  'Chlorine (granular/liquid)', 'Saltwater chlorinator', 'Mineral / magnesium',
  'Ozone', 'Freshwater system', 'UV', 'Bromine', 'Other',
];

export const FILTER_TYPES = [
  'Sand', 'Glass media', 'Cartridge', 'Diatomaceous earth (DE)',
  'Zeolite', 'Other',
];

// Current year, for the "Year built" dropdown
export const CURRENT_YEAR = new Date().getFullYear();

export const DEFAULT_POOL = {
  id: null,
  name: 'My pool',
  type: 'In-ground',
  shape: 'Rectangular',
  surface: 'Pebble / pebblecrete',
  volumeL: 0,
  sanitiser: 'Chlorine (granular/liquid)',
  filter: 'Sand',
  yearBuilt: '',
  yearBuiltApprox: false,
  hasCover: false,
  fenceCertDate: '',
};
