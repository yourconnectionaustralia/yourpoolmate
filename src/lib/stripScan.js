// File: src/lib/stripScan.js
// Words and rules for "Read my test strip": the owner photographs a dipped
// colour-matching test strip and the app picks the closest chart step for each
// pad. Pure functions, no React, so node can test them.
//
// The server (supabase/functions/_shared/strip-chart.js) has already capped how
// sure each reading can claim to be. Nothing here makes a reading look surer
// than the server said. The owner confirms every value before anything is saved.

import { SCAN_FIELDS } from './scanMerge.js';

// Always on the review screen. A colour in a photo is not the colour in the
// hand: the light moves it, so a reading can be a step out either way.
export const STRIP_CAVEAT = 'Colours look different in different light, so a photo can be out by a step. Treat these as a good guess and check each one against the chart on your pack before you use it.';

// Shown before the photo is taken. Order matters: timing first, since a strip
// keeps changing colour after the time on the pack.
export const STRIP_TIPS = [
  'Dip the strip as your pack says, then take the photo at the time it tells you to read it. The colours keep changing after that.',
  'Lay the strip flat on something white, in shaded daylight. Direct sun, torchlight and indoor lights all shift the colours.',
  'Put the colour chart from your bottle in the same photo, right next to the strip. That is what makes the readings most accurate.',
];

// True when the reply came from an edge function that knows about strips. An
// older deploy ignores kind and reads the photo as a printout, which would give
// a confident but wrong answer for a strip.
export function isStripReply(data) {
  return data?.kind === 'strip';
}

export const STRIP_NOT_READY = 'Reading test strips isn\'t ready on our side yet. Please try again in a few minutes, or type the readings in.';

const hasValue = (v) => v !== null && v !== undefined && v !== '';

// What the review screen shows, from the edge function's strip reply.
//   values       app-keyed strings, only for pads that were read
//   padTags      app key -> { cls, text } for pads the owner should look at twice
//   confidence   overall: 'high' | 'medium' | 'low'
//   notes        what affects accuracy, from the server (may be null)
//   readCount    how many pads were read
export function stripReview(data) {
  const readings = data?.readings || {};
  const padConfidence = data?.pad_confidence || {};
  const values = {};
  const padTags = {};
  for (const f of SCAN_FIELDS) {
    const v = readings[f.ocr];
    if (!hasValue(v)) continue;
    values[f.app] = String(v);
    const tag = padTag(padConfidence[f.ocr]);
    if (tag) padTags[f.app] = tag;
  }
  const confidence = ['high', 'medium', 'low'].includes(data?.confidence) ? data.confidence : 'low';
  return {
    values,
    padTags,
    confidence,
    notes: typeof data?.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
    readCount: Object.keys(values).length,
  };
}

// A missing or unknown confidence counts as low: say "check" rather than nothing.
export function padTag(level) {
  if (level === 'high') return null;
  if (level === 'medium') return { cls: 'tag-warn', text: 'Check against your chart' };
  return { cls: 'tag-warn', text: 'Best guess, please check' };
}

// The line next to the overall confidence tag. Strips are never "High
// confidence" in the plain sense the printout reader uses, so the words differ.
export function stripConfidenceTag(confidence) {
  if (confidence === 'high') return { cls: 'tag-good', text: 'Clear match' };
  if (confidence === 'medium') return { cls: 'tag-warn', text: 'Good guess, please check the values' };
  return { cls: 'tag-warn', text: 'Rough guess, please check every value' };
}

// Plain message when nothing usable came back. data is the strip reply.
export function stripFailure(data) {
  const notes = typeof data?.notes === 'string' ? data.notes.trim() : '';
  if (data?.strip_found === false) {
    return 'Couldn\'t see a dipped test strip in that photo. Dip the strip, wait the time your pack says, then lay it on something white in good light and try again.';
  }
  return `Couldn't match the colours on that strip.${notes ? ` ${notes}` : ''} Try again in shaded daylight, with the chart from your bottle next to the strip.`;
}

// Date line under the date box. A strip photo has no printed date, so the
// date is today unless the owner changes it.
export function stripDateText() {
  return 'This is today. Change it if you dipped the strip on another day.';
}
