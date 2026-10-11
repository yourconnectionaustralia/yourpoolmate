// Home line under the Health Score when the latest test cannot be scored.
// A 0 from missing readings is not a chemistry emergency. A measured 0
// (for example free chlorine at 0) still falls through to the scored line.

import { hasScorableReadings } from './healthScore.js';

export const EMPTY_TEST_HEADLINE =
  'No readings on this test. Do a water test to see where your water stands.';

export function emptyTestHeadline(test, sanitiserType) {
  if (hasScorableReadings(test, sanitiserType)) return null;
  return EMPTY_TEST_HEADLINE;
}
