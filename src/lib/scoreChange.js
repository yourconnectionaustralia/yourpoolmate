// How the latest Health Score compares with the test before it, for the line
// under the ring on Home. Tests are sorted oldest first, each with healthScore.
// Returns null when there is nothing fair to compare.
export function scoreChange(tests) {
  const scored = (tests || []).filter((t) => Number.isFinite(t?.healthScore));
  if (scored.length < 2) return null;
  const latest = scored[scored.length - 1];
  // Only compare against the newest test, never an older one standing in for it.
  if (latest !== tests[tests.length - 1]) return null;
  const delta = Math.round(latest.healthScore - scored[scored.length - 2].healthScore);
  if (delta === 0) return { delta, tone: 'same', text: 'Same as your last test' };
  const up = delta > 0;
  return {
    delta,
    tone: up ? 'up' : 'down',
    text: `${up ? 'Up' : 'Down'} ${Math.abs(delta)} since your last test`,
  };
}
