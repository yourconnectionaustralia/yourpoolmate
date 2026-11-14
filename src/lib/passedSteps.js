// File: src/lib/passedSteps.js
//
// "Skip this step" on Today's plan.
//
// A plan step is done when a dose is in the history, or waiting on the
// shopping list. An owner can also decide to leave a step alone for now
// (they have already dealt with it, they are waiting for the pool shop, or
// they just don't want to). That choice is kept on this device, per test:
// it is not a dose, so it never reaches the history, the costs or the shed.
//
// Skipping changes nothing about the water. The next test builds a fresh
// plan, so a step that still matters comes back by itself.

const KEY = 'ypm.stepsPassed.v1';
const KEEP_TESTS = 20;

// { [testKey]: [stepKey, ...] }
export function readPassed(storage) {
  try {
    const all = JSON.parse(storage.getItem(KEY) || '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch { return {}; }
}

export function writePassed(storage, map) {
  try { storage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode: the skip just won't survive a reload */ }
}

// One test's skipped steps as { stepKey: true }.
export function passedFor(map, testKey) {
  const out = {};
  if (testKey == null) return out;
  for (const k of map?.[testKey] || []) out[k] = true;
  return out;
}

// A new map with one step skipped (on = true) or put back (on = false).
// Only the newest tests are kept, so this never grows without end.
export function setPassed(map, testKey, stepKey, on) {
  if (testKey == null) return map || {};
  const next = { ...(map || {}) };
  const keys = new Set(next[testKey] || []);
  if (on) keys.add(stepKey); else keys.delete(stepKey);
  delete next[testKey];
  if (keys.size) next[testKey] = [...keys];
  const tests = Object.keys(next);
  for (const old of tests.slice(0, Math.max(0, tests.length - KEEP_TESTS))) delete next[old];
  return next;
}

// The step to do next: not added, not on the shopping list, not skipped.
export function nextOpenStep(plan, done = {}, skipped = {}, passed = {}) {
  return plan?.steps?.find((s) => !done[s.key] && !skipped[s.key] && !passed[s.key]) ?? null;
}
