import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayNameFromUser,
  firstNameFromDisplayName,
  greetingPhrase,
  homeGreeting,
  melbourneHour,
} from './greeting.js';

// 26 Sep 2026 is AEST (UTC+10). 15 Jan 2026 is AEDT (UTC+11).
const AEST = {
  morning: new Date('2026-09-26T01:59:00Z'),   // 11:59
  noon: new Date('2026-09-26T02:00:00Z'),      // 12:00
  lateArvo: new Date('2026-09-26T07:59:00Z'),  // 17:59
  evening: new Date('2026-09-26T08:00:00Z'),   // 18:00
};
const AEDT = {
  morning: new Date('2026-01-15T00:59:00Z'),   // 11:59
  noon: new Date('2026-01-15T01:00:00Z'),      // 12:00
  lateArvo: new Date('2026-01-15T06:59:00Z'),  // 17:59
  evening: new Date('2026-01-15T07:00:00Z'),   // 18:00
};

test('Melbourne hour follows AEST and AEDT', () => {
  assert.equal(melbourneHour(AEST.morning), 11);
  assert.equal(melbourneHour(AEST.noon), 12);
  assert.equal(melbourneHour(AEST.lateArvo), 17);
  assert.equal(melbourneHour(AEST.evening), 18);
  assert.equal(melbourneHour(AEDT.morning), 11);
  assert.equal(melbourneHour(AEDT.noon), 12);
  assert.equal(melbourneHour(AEDT.evening), 18);
});

test('time of day phrases use Melbourne boundaries', () => {
  for (const zone of [AEST, AEDT]) {
    assert.equal(greetingPhrase(zone.morning), 'Good morning');
    assert.equal(greetingPhrase(zone.noon), 'Good afternoon');
    assert.equal(greetingPhrase(zone.lateArvo), 'Good afternoon');
    assert.equal(greetingPhrase(zone.evening), 'Good evening');
  }
});

test('greeting appends the first word of a display name', () => {
  assert.equal(homeGreeting(AEST.morning, 'James Smith'), 'Good morning, James');
  assert.equal(homeGreeting(AEST.noon, 'Mary-Jane Watson'), 'Good afternoon, Mary-Jane');
  assert.equal(firstNameFromDisplayName('  José   García '), 'José');
});

test('greeting has no name, no there, and no email local-part', () => {
  assert.equal(homeGreeting(AEST.evening, ''), 'Good evening');
  assert.equal(homeGreeting(AEST.evening, null), 'Good evening');
  assert.equal(homeGreeting(AEST.evening, '   '), 'Good evening');
  assert.equal(homeGreeting(AEST.morning, 'james@example.com'), 'Good morning');
  assert.equal(homeGreeting(AEST.morning, ''), 'Good morning');
});

test('display name comes from profile metadata, not email', () => {
  assert.equal(displayNameFromUser({
    email: 'james@example.com',
    user_metadata: { full_name: 'James Smith' },
  }), 'James Smith');
  assert.equal(displayNameFromUser({
    email: 'jamie@example.com',
    user_metadata: { display_name: 'Jamie Lee', full_name: 'James Smith' },
  }), 'Jamie Lee');
  assert.equal(displayNameFromUser({
    email: 'james@example.com',
    user_metadata: { name: 'james@example.com', first_name: 'James' },
  }), 'James');
  assert.equal(displayNameFromUser({ email: 'james@example.com' }), '');
  assert.equal(displayNameFromUser(null), '');
  assert.equal(displayNameFromUser({
    email: 'james@example.com',
    identities: [{ identity_data: { full_name: 'James Smith' } }],
  }), '');
  assert.equal(displayNameFromUser({
    email: 'james@example.com',
    user_metadata: { first_name: 'Mary Jane', full_name: 'Mary Jane Watson' },
  }), 'Mary Jane');
  assert.equal(
    homeGreeting(AEST.morning, displayNameFromUser({
      email: 'james@example.com',
      user_metadata: { full_name: 'James Smith' },
    })),
    'Good morning, James',
  );
  assert.equal(
    homeGreeting(AEST.morning, displayNameFromUser({
      user_metadata: { first_name: 'Mary Jane' },
    })),
    'Good morning, Mary',
  );
  assert.equal(
    homeGreeting(AEST.morning, displayNameFromUser({ email: 'james@example.com' })),
    'Good morning',
  );
});
