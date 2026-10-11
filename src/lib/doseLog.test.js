import assert from 'node:assert/strict';
import test from 'node:test';
import { doseEventFor, retestPrompt } from './doseLog.js';

const step = { action: 'Raise Total Alkalinity' };

test('a dose with an amount becomes "Added <amount> <chemical>"', () => {
  const e = doseEventFor(step, { name: 'buffer / bicarb soda (sodium bicarbonate)', amount: '2.3 kg' }, 45000, new Date('2026-10-10T02:00:00Z'));
  assert.equal(e.type, 'dose');
  assert.equal(e.title, 'Added 2.3 kg buffer / bicarb soda (sodium bicarbonate)');
  assert.equal(e.notes, 'Raise Total Alkalinity · pool 45,000 L');
  assert.equal(e.date, '2026-10-10T02:00:00.000Z');
});

test('an action with no amount keeps the action in the title', () => {
  const e = doseEventFor({ action: 'Lower chlorine' }, { name: 'let chlorine reduce naturally (sunlight)', amount: null }, 0);
  assert.equal(e.title, 'Lower chlorine: let chlorine reduce naturally (sunlight)');
  assert.equal(e.notes, 'Lower chlorine');
});

const NOW = new Date('2026-10-10T02:00:00Z'); // Sat 10 Oct 13:00 AEDT
const dose = (iso) => ({ type: 'dose', date: iso });

test('no events, no prompt', () => {
  assert.equal(retestPrompt([], '2026-10-01T00:00:00Z', NOW), null);
});

test('a dose a few hours ago says when to test', () => {
  const p = retestPrompt([dose('2026-10-10T00:00:00Z')], '2026-10-01T00:00:00Z', NOW); // 11:00 AEDT
  assert.equal(p.kind, 'wait');
  assert.match(p.body, /tomorrow after 11:00am/);
});

test('a dose over 24 hours ago with no test since says to test now', () => {
  const p = retestPrompt([dose('2026-10-08T22:00:00Z')], '2026-10-01T00:00:00Z', NOW);
  assert.equal(p.kind, 'now');
});

test('a test after the dose clears the prompt', () => {
  assert.equal(retestPrompt([dose('2026-10-09T02:00:00Z')], '2026-10-09T20:00:00Z', NOW), null);
});

test('a prompt older than two weeks is dropped', () => {
  assert.equal(retestPrompt([dose('2026-09-20T02:00:00Z')], '2026-09-01T00:00:00Z', NOW), null);
});

test('shock and treatments count, notes and equipment do not', () => {
  assert.equal(retestPrompt([{ type: 'shock', date: '2026-10-10T00:00:00Z' }], null, NOW).kind, 'wait');
  assert.equal(retestPrompt([{ type: 'custom', date: '2026-10-10T00:00:00Z' }], null, NOW), null);
  assert.equal(retestPrompt([{ type: 'new_equipment', date: '2026-10-10T00:00:00Z' }], null, NOW), null);
});

test('events in the future are ignored', () => {
  assert.equal(retestPrompt([dose('2026-10-12T00:00:00Z')], null, NOW), null);
});
