import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MEMBER_METADATA_KEY,
  isMissingMemberColumnError,
  memberDetailsForForm,
  memberFormFromRow,
  memberProfilePayload,
  memberSavePlan,
  saveMemberDetails,
  shouldCopyAccountDetailsToProfile,
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
  const profileLib = read('./memberProfile.js');
  const migration = read('../../supabase/migrations/017_member_location.sql');

  assert.match(app, /Signed in as <strong>\{user\?\.email \|\| 'guest'\}<\/strong>/);
  assert.match(app, /<MemberProfileForm/);
  assert.match(app, /db\.saveUserProfile\(user\.id, fields\)/);
  assert.match(app, /memberDetailsForForm\(profile, user\?\.user_metadata\)/);
  assert.doesNotMatch(form, /type="email"/);
  assert.doesNotMatch(form, /chlorine|alkalinity|pH|sanitiser/i);
  assert.match(db, /saveMemberDetails\(supabase, userId, fields\)/);
  assert.match(db, /isMissingMemberColumnError\(error\)/);
  assert.match(profileLib, /\.from\('user_profiles'\)\s*\.update\(row\)/);
  assert.match(profileLib, /first_name, last_name, address, suburb, postcode/);
  assert.match(migration, /grant update \(first_name, last_name, address, suburb, postcode\)/);
  assert.match(migration, /postcode is null or postcode ~ '\^\[0-9\]\{4\}\$'/);
  assert.doesNotMatch(migration, /create table/i);
});

const SAMPLE = {
  firstName: 'Sam',
  lastName: 'Taylor',
  address: '9 Wattle Court',
  suburb: 'Fitzroy',
  postcode: '3065',
};

const SAMPLE_ROW = {
  first_name: 'Sam',
  last_name: 'Taylor',
  address: '9 Wattle Court',
  suburb: 'Fitzroy',
  postcode: '3065',
};

function fakeClient(profileResult, authError = null) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      return {
        update(row) {
          calls.push({ type: 'update', table, row });
          const query = {
            eq() { return query; },
            select() { return query; },
            maybeSingle: async () => profileResult,
          };
          return query;
        },
      };
    },
    auth: {
      updateUser: async (args) => {
        calls.push({ type: 'auth', args });
        return { error: authError };
      },
    },
  };
  return client;
}

test('the live missing-column error is not a permission failure', () => {
  const live = {
    code: 'PGRST204',
    message: "Could not find the 'first_name' column of 'user_profiles' in the schema cache",
  };
  assert.equal(isMissingMemberColumnError(live), true);
  assert.equal(memberSavePlan(live, null), 'account');
  assert.equal(isMissingMemberColumnError({
    code: '42703',
    message: 'column user_profiles.first_name does not exist',
  }), true);
  assert.equal(isMissingMemberColumnError({
    code: '42501',
    message: 'permission denied for table user_profiles',
  }), false);
  assert.equal(memberSavePlan({ code: '42501', message: 'permission denied' }, null), 'fail');
  assert.equal(memberSavePlan(null, SAMPLE_ROW), 'profile');
});

test('a valid details save writes the profile row when the columns exist', async () => {
  const client = fakeClient({ data: SAMPLE_ROW, error: null });
  const saved = await saveMemberDetails(client, 'user-1', SAMPLE);
  assert.deepEqual(saved, SAMPLE_ROW);
  assert.deepEqual(client.calls, [{ type: 'update', table: 'user_profiles', row: SAMPLE_ROW }]);
});

test('optional name and address can be blank when only a postcode is saved', async () => {
  const row = {
    first_name: null,
    last_name: null,
    address: null,
    suburb: null,
    postcode: '0800',
  };
  const client = fakeClient({ data: row, error: null });
  const saved = await saveMemberDetails(client, 'user-1', {
    firstName: ' ',
    lastName: '',
    address: '',
    suburb: '',
    postcode: '0800',
  });
  assert.deepEqual(saved, row);
  assert.equal(client.calls.some((call) => call.type === 'auth'), false);
});

test('a valid save still succeeds when the live profile columns are missing', async () => {
  const client = fakeClient({
    data: null,
    error: {
      code: 'PGRST204',
      message: "Could not find the 'first_name' column of 'user_profiles' in the schema cache",
    },
  });
  const saved = await saveMemberDetails(client, 'user-1', SAMPLE);
  assert.deepEqual(saved, SAMPLE_ROW);
  assert.equal(client.calls[0].type, 'update');
  assert.deepEqual(client.calls[1], {
    type: 'auth',
    args: { data: { [MEMBER_METADATA_KEY]: SAMPLE_ROW } },
  });
});

test('other database errors do not store a second copy and still fail the save', async () => {
  const client = fakeClient({
    data: null,
    error: { code: '42501', message: 'permission denied for table user_profiles' },
  });
  await assert.rejects(
    () => saveMemberDetails(client, 'user-1', SAMPLE),
    (err) => err?.code === '42501',
  );
  assert.equal(client.calls.some((call) => call.type === 'auth'), false);
});

test('an empty profile update still shows the save failure', async () => {
  const client = fakeClient({ data: null, error: null });
  await assert.rejects(
    () => saveMemberDetails(client, 'user-1', SAMPLE),
    (err) => err?.message === "Couldn't save your details. Try again.",
  );
  assert.equal(client.calls.some((call) => call.type === 'auth'), false);
});

test('the form is filled from the account copy until the profile row has a postcode', () => {
  const meta = { [MEMBER_METADATA_KEY]: SAMPLE_ROW, first_name: 'Ignored' };
  assert.deepEqual(memberDetailsForForm({ is_premium: false, trial_ends_at: null }, meta), {
    firstName: 'Sam',
    lastName: 'Taylor',
    address: '9 Wattle Court',
    suburb: 'Fitzroy',
    postcode: '3065',
  });
  assert.deepEqual(memberDetailsForForm({
    first_name: 'Alex',
    last_name: null,
    address: null,
    suburb: null,
    postcode: '2000',
  }, meta), {
    firstName: 'Alex',
    lastName: '',
    address: '',
    suburb: '',
    postcode: '2000',
  });
  assert.deepEqual(memberDetailsForForm(null, { [MEMBER_METADATA_KEY]: { postcode: '12' } }), {
    firstName: '',
    lastName: '',
    address: '',
    suburb: '',
    postcode: '',
  });
  assert.equal(shouldCopyAccountDetailsToProfile(
    { is_premium: false },
    { postcode: '3065' },
  ), false);
  assert.equal(shouldCopyAccountDetailsToProfile(
    { postcode: null },
    { postcode: '3065' },
  ), true);
  assert.equal(shouldCopyAccountDetailsToProfile(
    { postcode: '2000' },
    { postcode: '3065' },
  ), false);
  assert.equal(shouldCopyAccountDetailsToProfile(
    { postcode: null },
    { postcode: '' },
  ), false);
});
