// File: src/lib/poolLook.js
//
// "How does your pool look?" — asked with every new test.
//
// The readings cannot see everything. Balanced water can still be green (most
// often a filter or pump that is not running enough, or something deeper), and
// water that is out of balance can look perfectly clear. So the owner says
// what they see, and the app uses it next to the numbers:
//   - green or cloudy water changes the swim call, whatever the numbers say
//   - green or cloudy water also holds the Health Score down (see scoreCapFor),
//     so perfect readings cannot show a green ring on a green pool
//   - something else wrong (foam, stains, dark water) points to the fixer
//   - clear, or not sure, changes nothing

export const POOL_LOOKS = [
  { value: 'clear',  label: 'Clear',                       hint: 'I can see the bottom easily' },
  { value: 'cloudy', label: 'Cloudy or hazy',              hint: 'Dull or milky, or I cannot see the bottom clearly' },
  { value: 'green',  label: 'Green',                       hint: 'Any shade of green, or slimy walls' },
  { value: 'other',  label: 'Something else looks wrong',  hint: 'Foam, stains, or dark or brown water' },
  { value: 'unsure', label: 'Not sure, or not at the pool', hint: 'We will go on the readings alone' },
];

export const POOL_LOOK_VALUES = POOL_LOOKS.map((l) => l.value);

// Only a known answer is kept. Anything else (an old row, a typo) is "not asked".
export const normaliseLook = (v) => (POOL_LOOK_VALUES.includes(v) ? v : null);

// The most the Health Score can be while the water looks like this. Green is
// the act-now band (under 60); cloudy is "needs attention" and never green
// (under 80). The cap is applied when a test is scored, so it is saved with the
// score and older tests keep the score they had. Anything else: no cap.
export const SCORE_CAP = { green: 55, cloudy: 69 };
export const scoreCapFor = (v) => SCORE_CAP[normaliseLook(v)] ?? null;

// Water you cannot see through: it changes the swim call.
export const isMurkyLook = (v) => v === 'green' || v === 'cloudy';

export const lookLabel = (v) => POOL_LOOKS.find((l) => l.value === v)?.label ?? null;

// What to tell the owner about their answer, or null when there is nothing to
// add (clear, not sure, or never asked). `readingsInRange` is true when no
// reading is outside its target, because that is when the numbers and the
// water disagree.
export function lookView(value, readingsInRange = false) {
  const look = normaliseLook(value);
  if (look === 'green') {
    return {
      key: 'green',
      tone: 'alert',
      title: 'The water is green',
      body: readingsInRange
        ? 'Your readings are in range, but green water is algae and the numbers cannot see it. It usually means the pump and filter are not running enough, or there is a deeper problem to sort out.'
        : 'Green water is algae. Work through the green water guide alongside the plan, because the readings alone will not clear it.',
      scoreNote: 'Your Health Score is held down while the water is green. Test again once it clears.',
    };
  }
  if (look === 'cloudy') {
    return {
      key: 'cloudy',
      tone: 'alert',
      title: 'The water is cloudy',
      body: readingsInRange
        ? 'Your readings are in range, but cloudy water usually comes down to the filter and how long the pump runs, which the numbers cannot show.'
        : 'Cloudy water is usually a filter or pump problem as well as a chemistry one. Work through the cloudy water guide alongside the plan.',
      scoreNote: 'Your Health Score is held down while the water is cloudy. Test again once it clears.',
    };
  }
  if (look === 'other') {
    return {
      key: 'other',
      tone: 'action',
      title: 'You said something else looks wrong',
      body: 'Foam, stains and dark water do not show up in the readings. The problem fixer has a guide for each.',
    };
  }
  return null;
}

// The swim call when the water looks green or cloudy, or null.
export function murkySwimCall(value) {
  const look = normaliseLook(value);
  if (!isMurkyLook(look)) return null;
  const word = look === 'green' ? 'green' : 'cloudy';
  return {
    tone: 'wait',
    title: `Hold off — the water is ${word}`,
    detail: 'The numbers cannot clear it, and murky water can hide a swimmer in trouble. If you cannot clearly see the bottom of the deep end, keep everyone out. Follow the problem fixer, then test again.',
  };
}
