import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { blankValues, conflictMessage, daysOld, duplicateTest, hasReadings, mergeMeta, mergeScans, volumeNotice } from './scanMerge.js';

const page1 = { readings: { free_chlorine: 1.2, ph: 7.4 }, confidence: 'high', notes: null };
const page2 = { readings: { alkalinity: 95, cyanuric_acid: 40 }, confidence: 'medium', notes: 'page 2' };

test('a second page fills the gaps and the lowest confidence wins', () => {
  const m = mergeScans({}, [page1, page2]);
  assert.equal(m.values.freeChlor, '1.2');
  assert.equal(m.values.alkalinity, '95');
  assert.equal(m.values.salt, '');
  assert.equal(m.confidence, 'medium');
  assert.equal(m.notes, 'page 2');
  assert.deepEqual(m.conflicts, []);
});

test('a later photo never overwrites a reading already on screen, and says so', () => {
  const first = mergeScans({}, [page1]);
  // The owner has edited pH on screen to 7.5 before adding another photo.
  const m = mergeScans({ ...first.values, pH: '7.5' }, [{ readings: { ph: 7.9, alkalinity: 95 }, confidence: 'high' }], first.confidence, first.notes);
  assert.equal(m.values.pH, '7.5');
  assert.equal(m.values.alkalinity, '95');
  assert.equal(m.conflicts.length, 1);
  assert.match(conflictMessage(m.conflicts), /pH \(7\.5 kept, another photo says 7\.9\)/);
});

test('the same number on two photos is not a conflict', () => {
  const m = mergeScans({}, [page1, { readings: { ph: '7.40' }, confidence: 'high' }]);
  assert.deepEqual(m.conflicts, []);
});

test('blank and null readings do not count as readings', () => {
  assert.equal(hasReadings({ free_chlorine: null, ph: '' }), false);
  assert.equal(hasReadings({ ph: 0 }), true);
  assert.equal(hasReadings(undefined), false);
  assert.equal(Object.keys(blankValues()).length, 7);
});

test('the first photo with a date and pool size wins; a clash is reported', () => {
  const m = mergeMeta({}, [{ test_date: '2026-10-15', pool_volume_l: 39200 }, { test_date: '2026-10-15', pool_volume_l: 39200 }]);
  assert.equal(m.testDate, '2026-10-15');
  assert.equal(m.poolVolumeL, 39200);
  assert.deepEqual(m.conflicts, []);
  const c = mergeMeta({ testDate: '2026-10-15', poolVolumeL: 39200 }, [{ test_date: '2026-03-24', pool_volume_l: 45000 }]);
  assert.equal(c.testDate, '2026-10-15');
  assert.equal(c.poolVolumeL, 39200);
  assert.equal(c.conflicts.length, 2);
  // A page with neither leaves what is there alone.
  const keep = mergeMeta({ testDate: '2026-10-15', poolVolumeL: null }, [{ test_date: null, pool_volume_l: null }]);
  assert.equal(keep.testDate, '2026-10-15');
  assert.deepEqual(keep.conflicts, []);
});

test('days old counts calendar days on the device', () => {
  const now = new Date(2026, 9, 24, 9, 0);
  assert.equal(daysOld('2026-10-24', now), 0);
  assert.equal(daysOld('2026-10-15', now), 9);
  assert.equal(daysOld('2026-10-30', now), 0);
  assert.equal(daysOld('', now), 0);
});

test('the pool size cross-check only speaks when the two differ by more than 10%', () => {
  assert.equal(volumeNotice(39200, 39200), '');
  assert.equal(volumeNotice(39200, 41000), '');
  assert.equal(volumeNotice(null, 45000), '');
  assert.equal(volumeNotice(39200, null), '');
  const n = volumeNotice(39200, 45000);
  assert.match(n, /printout says your pool is 39,200 L, but Pool setup has 45,000 L/);
  assert.match(n, /Doses use Pool setup/);
});

test('a printout scanned twice is spotted: same day, same readings', () => {
  const saved = { id: 'a', createdAt: new Date(2026, 9, 15, 12, 0).toISOString(), freeChlor: 0.61, pH: 7.9, alkalinity: 83, salt: 4572 };
  const scan = { freeChlor: '0.61', pH: '7.9', alkalinity: '83', cyanuricAcid: '', salt: '4572' };
  assert.equal(duplicateTest([saved], '2026-10-15', scan)?.id, 'a');
  // Another day, or a changed reading, is a different test.
  assert.equal(duplicateTest([saved], '2026-10-16', scan), null);
  assert.equal(duplicateTest([saved], '2026-10-15', { ...scan, pH: '7.6' }), null);
  // One shared reading is not enough to call it a copy.
  assert.equal(duplicateTest([saved], '2026-10-15', { freeChlor: '0.61' }), null);
  assert.equal(duplicateTest([], '2026-10-15', scan), null);
});

test('the app files a dated printout in order and uses the printout pool size only as a suggestion', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  // History stays in date order, and an older printout never becomes the "current" test.
  assert.match(app, /sortTests\(\[\.\.\.h, data\]\)/);
  assert.match(app, /setActiveView\(isNewest \? 'health' : 'history'\)/);
  // The pool size is passed to the volume prompt, never saved to the pool.
  assert.match(app, /const \{ printoutVolumeL, \.\.\.test \} = data;/);
  assert.match(app, /suggestedL=\{suggestedVolumeL\}/);
  assert.match(app, /poolVolumeL=\{hasVolume\(poolProfile\) \? poolProfile\.volumeL : null\}/);
  const scanner = readFileSync(new URL('../components/WaterTestScanner.jsx', import.meta.url), 'utf8');
  // The date comes from the printout, can be changed, and can't be in the future.
  assert.match(scanner, /max=\{todayInput\}/);
  assert.match(scanner, /createdAt: isoFromDateInput\(testDate > todayInput \? todayInput : testDate/);
});
