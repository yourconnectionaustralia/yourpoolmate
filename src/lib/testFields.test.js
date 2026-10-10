process.env.TZ = 'Australia/Melbourne';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formFromTest, isoFromDateInput, testFormFields, testFromForm, toDateInput, validateReadings, EMPTY_TEST_FORM,
} from './testFields.js';

test('salt appears only for salt pools', () => {
  assert.equal(testFormFields(false).some(f => f.key === 'salt'), false);
  assert.equal(testFormFields(true, { lo: 3000, hi: 4000 }).find(f => f.key === 'salt').placeholder, '3000–4000');
});

test('a form round-trips and keeps 0 as a real reading', () => {
  const t = { freeChlor: 0, pH: 7.4, alkalinity: 90, cyanuricAcid: null, calciumHardness: 250 };
  const form = formFromTest(t);
  assert.equal(form.freeChlor, '0');
  assert.equal(form.cyanuricAcid, '');
  const back = testFromForm(form);
  assert.equal(back.freeChlor, 0);
  assert.equal(back.cyanuricAcid, null);
  assert.equal('salt' in back, false);
});

test('optional readings are only included when typed', () => {
  assert.equal(testFromForm({ ...EMPTY_TEST_FORM, pH: '7.2', salt: '3500' }).salt, 3500);
  assert.equal('tds' in testFromForm({ ...EMPTY_TEST_FORM, pH: '7.2' }), false);
});

test('validation catches typos and empty forms', () => {
  assert.equal(validateReadings(EMPTY_TEST_FORM), 'Enter at least one reading.');
  assert.match(validateReadings({ ...EMPTY_TEST_FORM, pH: '72' }), /pH of 72 looks too high/);
  assert.match(validateReadings({ ...EMPTY_TEST_FORM, pH: '-1' }), /can't be below 0/);
  assert.match(validateReadings({ ...EMPTY_TEST_FORM, pH: 'abc' }), /needs to be a number/);
  assert.equal(validateReadings({ ...EMPTY_TEST_FORM, freeChlor: '0' }), null);
});

test('an unchanged date keeps the original time, a new date is midday', () => {
  const original = '2026-10-03T21:45:00Z'; // 4 Oct 08:45 AEDT
  assert.equal(toDateInput(original), '2026-10-04');
  assert.equal(isoFromDateInput('2026-10-04', original), original);
  assert.equal(isoFromDateInput('2026-10-01', original), '2026-10-01T02:00:00.000Z'); // 12:00 AEST
});
