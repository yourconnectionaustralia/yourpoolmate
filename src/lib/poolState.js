// File: src/lib/poolState.js
//
// Two more questions asked with every new test: where the water level is, and
// whether the cover was on. Neither shows in the readings, and both change what
// is worth doing next. They do not change the Health Score or any dose amount.

export const WATER_LEVELS = [
  { value: 'normal', label: 'About normal', hint: 'Around halfway up the skimmer opening' },
  { value: 'high',   label: 'Too high',     hint: 'Near or over the top of the opening, often after rain' },
  { value: 'low',    label: 'Too low',      hint: 'Near or below the bottom of the opening' },
  { value: 'unsure', label: 'Not sure',     hint: 'Or I was not at the pool' },
];

export const COVER_STATES = [
  { value: 'on',     label: 'On' },
  { value: 'off',    label: 'Off' },
  { value: 'none',   label: 'No cover' },
  { value: 'unsure', label: 'Not sure' },
];

// Only a known answer is kept. Anything else is "not asked".
const keep = (list) => (v) => (list.some((o) => o.value === v) ? v : null);
export const normaliseWaterLevel = keep(WATER_LEVELS);
export const normaliseCover = keep(COVER_STATES);

const LEVEL_TEXT = { normal: 'Water level normal', high: 'Water level high', low: 'Water level low', unsure: 'Water level not checked' };
const COVER_TEXT = { on: 'Cover on', off: 'Cover off', none: 'No cover', unsure: 'Cover not checked' };

// "Water level high · Cover on", or '' for a test saved before these were asked.
export function conditionSummary(test) {
  return [LEVEL_TEXT[normaliseWaterLevel(test?.waterLevel)], COVER_TEXT[normaliseCover(test?.coverState)]]
    .filter(Boolean)
    .join(' · ');
}

// Plan watch-outs from the two answers. `hasSteps` is true when the plan has
// something to add or change.
export function conditionWatchouts(test, hasSteps = false) {
  const out = [];
  const level = normaliseWaterLevel(test?.waterLevel);
  if (level === 'high') {
    out.push(hasSteps
      ? 'The water level was high. If you are lowering it, do that before you add salt or other chemicals, so you do not send them out with the water.'
      : 'The water level was high. A skimmer works best with the water about halfway up its opening.');
  }
  if (level === 'low') {
    out.push('The water level was low. Top it up so the pump does not draw in air. Fresh water changes the readings, so test again afterwards.');
  }
  if (normaliseCover(test?.coverState) === 'on' && hasSteps) {
    out.push("The cover was on. Take it off before you add chemicals and leave it off while they mix in. Check your cover's instructions before you put it back.");
  }
  return out;
}
