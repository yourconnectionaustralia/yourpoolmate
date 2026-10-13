import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMyData, deleteErrorMessage, isDeleteConfirmed, myDataFileName } from './myData.js';

test('buildMyData: shapes account, keeps rows, no secrets', () => {
  const d = buildMyData({
    email: 'a@b.com',
    profile: { first_name: 'Margaret', last_name: 'T', suburb: 'Frankston', postcode: '3199', is_premium: true, plan: 'founding_lifetime', reminder_day: 3, monthly_report: false, stripe_customer_id: 'cus_1' },
    pool: { name: 'Backyard' }, tests: [{ id: 't1' }], equipment: [], events: [{ id: 'e1' }],
    now: new Date('2026-10-10T00:00:00Z'),
  });
  assert.equal(d.account.email, 'a@b.com');
  assert.equal(d.account.firstName, 'Margaret');
  assert.equal(d.account.membership.paid, true);
  assert.equal(d.account.reminders.weeklyReminderDay, 3);
  assert.equal(d.account.reminders.monthlyReport, false);
  assert.equal(d.waterTests.length, 1);
  assert.ok(!JSON.stringify(d).includes('cus_1'));
  assert.equal(d.exportedAt, '2026-10-10T00:00:00.000Z');
});

test('buildMyData: empty account still valid', () => {
  const d = buildMyData({ email: null, profile: null, pool: null, tests: null, equipment: null, events: null });
  assert.deepEqual(d.waterTests, []);
  assert.equal(d.pool, null);
  assert.equal(d.account.reminders.monthlyReport, true);
});

test('file name uses the Melbourne date', () => {
  assert.equal(myDataFileName(new Date('2026-10-09T23:30:00Z')), 'your-pool-mate-my-data-2026-10-10.json');
});

test('delete confirmation word', () => {
  assert.equal(isDeleteConfirmed('delete'), true);
  assert.equal(isDeleteConfirmed(' DELETE '), true);
  assert.equal(isDeleteConfirmed('del'), false);
  assert.equal(isDeleteConfirmed(''), false);
});

test('delete error messages are plain and never blame the member', () => {
  for (const code of ['STRIPE', 'STORAGE', 'DATA', 'NO_AUTH', 'SERVER_ERROR', undefined]) {
    const m = deleteErrorMessage({ code });
    assert.ok(m.length > 20 && !m.includes('undefined'));
  }
  assert.match(deleteErrorMessage({ code: 'STRIPE' }), /nothing was deleted/);
});
