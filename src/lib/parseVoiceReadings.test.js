import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  formValuesFromTranscript,
  parseVoiceReadings,
  voiceReadingsFromForm,
} from './parseVoiceReadings.js';

function heard(transcript) {
  return parseVoiceReadings(transcript);
}

test('parses digit phrases for the core readings', () => {
  const r = heard('chlorine is 2.2 alkalinity is 125 pH is 7.4');
  assert.equal(r.freeChlor, 2.2);
  assert.equal(r.alkalinity, 125);
  assert.equal(r.pH, 7.4);
  assert.equal(r.cyanuricAcid, null);
  assert.equal(r.calciumHardness, null);
  assert.equal(r.salt, null);
});

test('accepts free chlorine, FC, and a later correction', () => {
  assert.equal(heard('free chlorine 2.2').freeChlor, 2.2);
  assert.equal(heard('FC 2.2').freeChlor, 2.2);
  assert.equal(heard('chlorine 2 chlorine is 2.2').freeChlor, 2.2);
});

test('does not treat total chlorine as free chlorine', () => {
  const r = heard('total chlorine 5 free chlorine 1.5');
  assert.equal(r.freeChlor, 1.5);
});

test('parses pH with either casing', () => {
  assert.equal(heard('pH 7.4').pH, 7.4);
  assert.equal(heard('ph is 7.4').pH, 7.4);
  assert.equal(heard('pH is seven point four').pH, 7.4);
});

test('parses alkalinity digits and spoken hundreds', () => {
  assert.equal(heard('alkalinity 125').alkalinity, 125);
  assert.equal(heard('total alkalinity one twenty five').alkalinity, 125);
  assert.equal(heard('alkalinity one hundred and twenty five').alkalinity, 125);
  assert.equal(heard('alk 90').alkalinity, 90);
});

test('parses CYA aliases', () => {
  assert.equal(heard('CYA 40').cyanuricAcid, 40);
  assert.equal(heard('stabiliser 40').cyanuricAcid, 40);
  assert.equal(heard('stabilizer 40').cyanuricAcid, 40);
  assert.equal(heard('cyanuric acid forty').cyanuricAcid, 40);
});

test('parses calcium and hardness into calcium hardness', () => {
  assert.equal(heard('calcium 200').calciumHardness, 200);
  assert.equal(heard('hardness 200').calciumHardness, 200);
  assert.equal(heard('calcium hardness two hundred').calciumHardness, 200);
});

test('parses salt, including thousands', () => {
  assert.equal(heard('salt 4000').salt, 4000);
  assert.equal(heard('salt three thousand two hundred').salt, 3200);
});

test('parses spoken decimals, point-only fractions, and halves', () => {
  assert.equal(heard('chlorine is two point two').freeChlor, 2.2);
  assert.equal(heard('chlorine is to point to').freeChlor, 2.2);
  assert.equal(heard('chlorine point five').freeChlor, 0.5);
  assert.equal(heard('chlorine is two and a half').freeChlor, 2.5);
});

test('a full shop-style sentence fills every supported field', () => {
  const r = heard(
    'free chlorine is 2.2 total alkalinity is 125 pH is 7.4 cyanuric acid is 40 calcium hardness is 220 salt is 3500'
  );
  assert.deepEqual(r, {
    freeChlor: 2.2,
    pH: 7.4,
    alkalinity: 125,
    cyanuricAcid: 40,
    calciumHardness: 220,
    salt: 3500,
  });
});

test('partial and empty transcripts leave the other fields empty', () => {
  const partial = heard('pH 7.4');
  assert.equal(partial.pH, 7.4);
  assert.equal(partial.freeChlor, null);
  assert.deepEqual(heard(''), {
    freeChlor: null, pH: null, alkalinity: null,
    cyanuricAcid: null, calciumHardness: null, salt: null,
  });
  assert.equal(heard('the pool looks fine').freeChlor, null);
});

test('form values are editable strings and blank when unheard', () => {
  const values = formValuesFromTranscript('chlorine is 2.2 alkalinity is 125');
  assert.equal(values.freeChlor, '2.2');
  assert.equal(values.alkalinity, '125');
  assert.equal(values.pH, '');
  assert.equal(values.salt, '');
});

test('confirmed form becomes the voice save payload', () => {
  const payload = voiceReadingsFromForm({
    freeChlor: '2.2',
    pH: '7.4',
    alkalinity: '125',
    cyanuricAcid: '',
    calciumHardness: '200',
    salt: '',
  });
  assert.equal(payload.source, 'voice');
  assert.equal(payload.freeChlor, 2.2);
  assert.equal(payload.pH, 7.4);
  assert.equal(payload.alkalinity, 125);
  assert.equal(payload.cyanuricAcid, null);
  assert.equal(payload.calciumHardness, 200);
  assert.equal('salt' in payload, false);
});

test('a typed salt of zero is kept and a blank salt is omitted', () => {
  const withZero = voiceReadingsFromForm({ salt: '0', freeChlor: '' });
  assert.equal(withZero.salt, 0);
  const blank = voiceReadingsFromForm({ salt: '   ' });
  assert.equal('salt' in blank, false);
});

test('live Water Tests path wires speak, voice source, and the scanner', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const scanner = readFileSync(new URL('../components/WaterTestScanner.jsx', import.meta.url), 'utf8');
  const voice = readFileSync(new URL('../components/VoiceTestEntry.jsx', import.meta.url), 'utf8');
  const db = readFileSync(new URL('./db.js', import.meta.url), 'utf8');

  assert.match(app, /import VoiceTestEntry from '\.\/components\/VoiceTestEntry\.jsx'/);
  assert.match(app, /Speak results/);
  assert.match(app, /source: 'voice'/);
  assert.match(app, /<VoiceTestEntry/);
  assert.match(app, /WaterTestScanner/);
  assert.match(app, /onScanTest/);
  assert.match(app, /Enter Test Results/);
  assert.match(scanner, /source: 'ocr'/);
  assert.match(voice, /voiceReadingsFromForm/);
  assert.match(voice, /This browser can't take spoken readings/);
  assert.equal(voice.includes('\u2014'), false);
  assert.equal(voice.includes('\u2013'), false);
  assert.match(db, /source:\s*test\.source/);
});
