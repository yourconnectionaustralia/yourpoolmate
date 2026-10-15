import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { buildMyData } from './myData.js';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, startMarker);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

test('expired trial screen offers the existing JSON download and sign out', () => {
  const app = read('../App.jsx');
  const screen = sliceBetween(app, 'function TrialExpiredScreen', '// CHEMISTRY LOGIC HELPERS');
  const account = read('../components/AccountData.jsx');

  assert.match(app, /if \(trialExpired && !isPremium\) \{\s*return <TrialExpiredScreen /);
  assert.doesNotMatch(app, /from '\.\/components\/TrialExpiredScreen/);

  assert.match(screen, /const \{ user, signOut \} = useAuth\(\)/);
  assert.match(screen, /db\.loadMyData\(user\.id\)/);
  assert.match(screen, /buildMyData\(\{ email: user\.email, \.\.\.raw \}\)/);
  assert.match(screen, /saveBlob\(myDataBlob\(data\), myDataFileName\(\)\)/);
  assert.match(screen, /onClick=\{signOut\}/);
  assert.equal([...screen.matchAll(/className="btn btn-ghost btn-sm"/g)].length, 2);
  assert.match(screen, /Download my data/);
  assert.match(screen, /Sign out/);

  const footnoteAt = screen.indexOf('{copy.footnote}');
  const downloadAt = screen.indexOf('Download my data');
  assert.match(screen, /onClick=\{signOut\}>\s*Sign out\s*<\/button>/);
  const signOutAt = screen.indexOf('onClick={signOut}');
  assert.ok(footnoteAt >= 0 && downloadAt > footnoteAt && signOutAt > footnoteAt);

  // Resting card copy stays the trial offer. Status lines are the Profile ones.
  assert.match(screen, /Your free trial has ended/);
  assert.ok(screen.includes('{copy.expiredBody}'));
  assert.ok(screen.includes("{copy.priceLabel || '—'}"));
  assert.ok(screen.includes('{copy.priceNote}'));
  assert.ok(screen.includes('{copy.claimLabel}'));
  assert.ok(screen.includes('{copy.footnote}'));
  assert.match(account, /Downloaded\. Check your Downloads folder\./);
  assert.match(screen, /Downloaded\. Check your Downloads folder\./);
  assert.match(screen, /We couldn't put your data together just now/);
});

test('buildMyData still includes the record when the account is not premium', () => {
  const data = buildMyData({
    email: 'owner@example.com',
    profile: { is_premium: false, plan: null, trial_ends_at: '2026-01-01T00:00:00.000Z', first_name: 'Pat' },
    pool: { name: 'Backyard' },
    tests: [{ id: 't1' }],
    equipment: [{ id: 'eq1' }],
    events: [{ id: 'e1' }],
    now: new Date('2026-10-15T00:00:00Z'),
  });
  assert.equal(data.account.membership.paid, false);
  assert.equal(data.account.membership.plan, null);
  assert.equal(data.pool.name, 'Backyard');
  assert.equal(data.waterTests.length, 1);
  assert.equal(data.equipment.length, 1);
  assert.equal(data.events.length, 1);
});

test('loadMyData reads the owner rows and does not gate on premium', () => {
  const db = read('./db.js');
  const load = sliceBetween(db, 'export async function loadMyData', 'export async function nudgeMemberEmails');
  assert.match(load, /loadUserProfile\(userId\)/);
  assert.match(load, /\.from\('pool_profiles'\)\.select\('\*'\)\.eq\('user_id', userId\)/);
  assert.match(load, /\.from\('water_tests'\)\.select\('\*'\)\.eq\('user_id', userId\)/);
  assert.match(load, /\.from\('equipment'\)\.select\('\*'\)\.eq\('user_id', userId\)/);
  assert.match(load, /\.from\('pool_events'\)\.select\('\*'\)\.eq\('user_id', userId\)/);
  assert.doesNotMatch(load, /is_premium|trial_ends_at|isPremium/);

  const profile = sliceBetween(db, 'export async function loadUserProfile', 'export async function saveReminderPrefs');
  assert.match(profile, /\.eq\('id', userId\)/);
  assert.doesNotMatch(profile, /\.eq\(\s*['"]is_premium['"]/);
});

test('owner select policies for the export tables do not require premium', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const sql = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => readFileSync(new URL(name, dir), 'utf8'))
    .join('\n');
  const tables = ['user_profiles', 'pool_profiles', 'water_tests', 'equipment', 'pool_events'];
  for (const table of tables) {
    const re = new RegExp(
      `create policy "(?:[^"]*)"\\s+on public\\.${table}\\s+for select\\s[\\s\\S]*?;`,
      'gi',
    );
    const policies = sql.match(re) || [];
    assert.ok(policies.length >= 1, `${table} has a select policy`);
    for (const policy of policies) {
      assert.match(policy, /auth\.uid\(\)/, policy);
      assert.doesNotMatch(policy, /is_premium/, policy);
    }
  }
});
