// File: src/components/PoolLookQuestion.jsx
//
// "How does your pool look?" — one required question that comes before a new
// test is saved, whether the readings were typed, scanned from a printout or
// strip, or spoken. The readings cannot show green or cloudy water, and they
// are not the whole story: see lib/poolLook.js.

import { POOL_LOOKS } from '../lib/poolLook.js';

export function PoolLookQuestion({ value, onChange, idPrefix = 'look' }) {
  return (
    <fieldset className="look-question">
      <legend className="look-legend">How does your pool look?</legend>
      <p className="plan-small look-why">
        Numbers don't show everything. Balanced water can still be green, and water that is out of balance can look perfectly clear. Your answer helps us spot what the readings miss.
      </p>
      <div className="look-choices">
        {POOL_LOOKS.map((o) => (
          <label key={o.value} className={`look-choice${value === o.value ? ' is-on' : ''}`}>
            <input
              type="radio"
              name={`${idPrefix}-look`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>
              <span className="look-choice-label">{o.label}</span>
              <span className="look-choice-hint">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {!value && <p className="look-pick" role="status">Pick one to continue.</p>}
    </fieldset>
  );
}

export default PoolLookQuestion;
