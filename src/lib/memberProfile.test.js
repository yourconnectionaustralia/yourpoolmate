import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  memberFormFromRow,
  memberProfilePayload,
  validateMemberProfile,
} from './memberProfile.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('postcode is required and must be 4 digits', () => {
  assert.equal(validateMemberProfile({ postcode: '' })?.message, 'Enter your 4-digit postcode.');
  assert.equal(validateMemberProfile({ postcode: '   ' })?.message, 'Enter your 4-digit postcode.');
  assert.equal(validateMemberProfile({})?.field, 'postcode');

  for (const postcode of ['300', '30000', 'abcd', '30 00', '3000a', '12-34']) {
    const problem = validateMemberProfile({ postcode });
    assert.equal(problem?.field, 'postcode', postcode);
    assert.equal(problem?.message, 'Postcode needs to be 4 digits.');
  }

  assert.equal(validateMemberProfile({ postcode: '3000' }), null);
  assert.equal(validateMemberProfile({ postcode: '0800' }), null);
  assert.equal(validateMemberProfile({ postcode: ' 3000 ' }), null);
});

test('optional location fields can be blank and are not chemistry', () => {
  assert.equal(validateMemberProfile({
    firstName: ' ',
    lastName: '',
    address: '',
    suburb: '',
    postcode: '2000',
  }), null);

  const payload = memberProfilePayload({
    firstName: '  ',
    lastName: '',
    address: '  ',
    suburb: '\n',
    postcode: ' 0800 ',
  });
  assert.deepEqual(payload, {
    first_name: null,
    last_name: null,
    address: null,
    suburb: null,
    postcode: '0800',
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'address',
    'first_name',
    'last_name',
    'postcode',
    'suburb',
  ]);
});

test('names and address are trimmed and length-capped', () => {
  assert.equal(
    validateMemberProfile({ firstName: 'a'.repeat(81), postcode: '3000' })?.message,
    'First name needs to be 80 characters or fewer.',
  );
  assert.equal(validateMemberProfile({ firstName: 'a'.repeat(80), postcode: '3000' }), null);
  assert.deepEqual(memberProfilePayload({
    firstName: ' Jamie ',
    lastName: ' Lee ',
    address: ' 1 Pool St ',
    suburb: ' Richmond ',
    postcode: '3121',
  }), {
    first_name: 'Jamie',
    last_name: 'Lee',
    address: '1 Pool St',
    suburb: 'Richmond',
    postcode: '3121',
  });
});

test('a saved row hydrates the form without inventing an email', () => {
  assert.deepEqual(memberFormFromRow(null), {
    firstName: '',
    lastName: '',
    address: '',
    suburb: '',
    postcode: '',
  });
  assert.deepEqual(memberFormFromRow({
    first_name: null,
    last_name: 'Nguyen',
    address: null,
    suburb: 'Carlton',
    postcode: '3053',
    is_premium: true,
  }), {
    firstName: '',
    lastName: 'Nguyen',
    address: '',
    suburb: 'Carlton',
    postcode: '3053',
  });
});

test('profile screen keeps the email display and saves through user_profiles', () => {
  const app = read('../App.jsx');
  const form = read('../components/MemberProfileForm.jsx');
  const db = read('./db.js');
  const migration = read('../../supabase/migrations/017_member_location.sql');

  assert.match(app, /Signed in as <strong>\{user\?\.email \|\| 'guest'\}<\/strong>/);
  assert.match(app, /<MemberProfileForm/);
  assert.match(app, /db\.saveUserProfile\(user\.id, fields\)/);
  assert.doesNotMatch(form, /type="email"/);
  assert.doesNotMatch(form, /chlorine|alkalinity|pH|sanitiser/i);
  assert.match(db, /\.from\('user_profiles'\)\s*\.update\(row\)/);
  assert.match(db, /first_name, last_name, address, suburb, postcode/);
  assert.match(migration, /grant update \(first_name, last_name, address, suburb, postcode\)/);
  assert.match(migration, /postcode is null or postcode ~ '\^\[0-9\]\{4\}\$'/);
  assert.doesNotMatch(migration, /create table/i);
});
