// A short, plain-text summary of the owner's pool for Ask Mate, so answers
// fit their litres, readings and today's plan. Sent with each question and
// capped on the server; nothing here is stored.

import { doseLabel } from './plan.js';

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' }).format(d);
};

export function chatContext({ poolProfile, testData, plan, now = new Date() } = {}) {
  const lines = [`Today: ${fmtDate(now.toISOString())}.`];
  if (poolProfile) {
    const litres = poolProfile.volumeL ?? (poolProfile.volumeKl ? poolProfile.volumeKl * 1000 : null);
    const bits = [
      litres ? `${Math.round(litres).toLocaleString('en-AU')} litres` : 'volume not set',
      poolProfile.type,
      poolProfile.surface,
      poolProfile.sanitiser ? `sanitiser: ${poolProfile.sanitiser}` : null,
      poolProfile.filter ? `filter: ${poolProfile.filter}` : null,
      poolProfile.hasCover ? 'has a cover' : null,
    ].filter(Boolean);
    lines.push(`Pool: ${bits.join(', ')}.`);
  }
  if (testData?.createdAt && plan?.rows?.length) {
    const readings = plan.rows
      .filter((r) => r.value != null && r.value !== '')
      .map((r) => `${r.name} ${r.value}${r.unit ? ` ${r.unit}` : ''} (${r.state === 'ok' ? 'good' : r.state}, target ${r.target})`);
    if (readings.length) lines.push(`Latest test, ${fmtDate(testData.createdAt)}: ${readings.join('; ')}.`);
    if (plan.score != null) lines.push(`Health Score: ${plan.score}/100.`);
    if (plan.swim?.title) lines.push(`Swim call: ${plan.swim.title}.`);
    const steps = (plan.steps || []).map((s, i) => {
      const o = s.options?.[0];
      return `${i + 1}. ${s.action}${o ? `: ${doseLabel(o)}` : ''}`;
    });
    lines.push(steps.length ? `Today's plan in the app:\n${steps.join('\n')}` : "Today's plan: nothing to add.");
  } else {
    lines.push('No water test saved yet.');
  }
  return lines.join('\n');
}
