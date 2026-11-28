// File: src/components/PoolStateQuestions.jsx
//
// Water level and pool cover. Both are required before a new test is saved,
// whether the readings were typed, scanned or spoken, like "How does your pool
// look?" (PoolLookQuestion.jsx), whose styles they share. See lib/poolState.js.

import { COVER_STATES, WATER_LEVELS } from '../lib/poolState.js';

function Choice({ legend, why, options, value, onChange, name, compact = false }) {
  return (
    <fieldset className="look-question">
      <legend className="look-legend">{legend}</legend>
      {why && <p className="plan-small look-why">{why}</p>}
      <div className={`look-choices${compact ? ' look-choices-grid' : ''}`}>
        {options.map((o) => (
          <label key={o.value} className={`look-choice${value === o.value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="look-choice-label">{o.label}</span>
              {o.hint && <span className="look-choice-hint">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {!value && <p className="look-pick" role="status">Pick one to continue.</p>}
    </fieldset>
  );
}

export function PoolStateQuestions({ waterLevel, onWaterLevel, coverState, onCoverState, idPrefix = 'state' }) {
  return (
    <>
      <Choice
        legend="Where is the water level?"
        why="Rain, splashing and evaporation move it, and it changes what to do next."
        options={WATER_LEVELS}
        value={waterLevel}
        onChange={onWaterLevel}
        name={`${idPrefix}-water-level`}
      />
      <Choice
        legend="Was the pool cover on or off?"
        options={COVER_STATES}
        value={coverState}
        onChange={onCoverState}
        name={`${idPrefix}-cover`}
        compact
      />
    </>
  );
}

export default PoolStateQuestions;
