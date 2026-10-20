// File: src/lib/reportLink.js
//
// A share link that carries the report itself: the pool, its recent tests
// and doses, packed into the part of the URL after "#". Whoever opens it sees
// a read-only page with no sign-in. Nothing is stored on a server and the
// part after "#" is never sent to one, so the link works without an account
// and the owner's email, name and address are never in it.
//
// A link is a snapshot. Sending a new one is the way to show newer tests.

export const REPORT_PATH = '/report';
const VERSION = 1;
const MAX_TESTS = 12;
const DOSE_DAYS = 90;
const MAX_DOSES = 30;
const KEYS = ['freeChlor', 'totalChlor', 'pH', 'alkalinity', 'cyanuricAcid', 'calciumHardness', 'salt', 'phosphates', 'tds'];

const round = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

export function buildReport({ pool, tests = [], events = [], scoreFn, saltRange = null, now = new Date() }) {
  const recent = [...tests]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_TESTS)
    .map((t) => {
      const r = {};
      for (const k of KEYS) {
        const v = t[k];
        if (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) r[k] = round(Number(v));
      }
      return {
        at: t.createdAt,
        s: scoreFn ? scoreFn(t) : (t.healthScore ?? null),
        src: t.source || 'manual',
        ...(t.editedAt ? { e: 1 } : {}),
        r,
      };
    });
  const since = now.getTime() - DOSE_DAYS * 864e5;
  const doses = events
    .filter((e) => (e.type === 'dose' || e.type === 'shock') && new Date(e.date).getTime() >= since)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_DOSES)
    .map((e) => ({ at: e.date, t: String(e.title || '').slice(0, 80) }));
  return {
    v: VERSION,
    g: now.toISOString(),
    p: {
      n: String(pool?.name || 'Pool').slice(0, 40),
      l: Number(pool?.volumeL) > 0 ? Math.round(Number(pool.volumeL)) : null,
      s: String(pool?.sanitiser || '').slice(0, 40),
      f: String(pool?.surface || '').slice(0, 40),
      ...(saltRange ? { r: [saltRange.lo, saltRange.hi] } : {}),
    },
    t: recent,
    d: doses,
  };
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeReport(report) {
  return toBase64Url(JSON.stringify(report));
}

export function reportUrl(origin, report) {
  return `${origin}${REPORT_PATH}#${encodeReport(report)}`;
}

// Parse and check a link. Returns null for anything damaged or unexpected.
export function decodeReport(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw || raw.length > 20000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const r = JSON.parse(fromBase64Url(raw));
    if (r?.v !== VERSION || !r.p || !Array.isArray(r.t) || !Array.isArray(r.d)) return null;
    const okDate = (d) => typeof d === 'string' && !Number.isNaN(new Date(d).getTime());
    if (!okDate(r.g)) return null;
    const tests = r.t.filter((t) => okDate(t.at) && t.r && typeof t.r === 'object').slice(0, MAX_TESTS).map((t) => {
      const readings = {};
      for (const k of KEYS) if (Number.isFinite(t.r[k])) readings[k] = t.r[k];
      return {
        at: t.at,
        score: Number.isFinite(t.s) ? Math.max(0, Math.min(100, Math.round(t.s))) : null,
        source: typeof t.src === 'string' ? t.src : 'manual',
        edited: t.e === 1,
        readings,
      };
    });
    return {
      generatedAt: r.g,
      pool: {
        name: String(r.p.n || 'Pool').slice(0, 40),
        volumeL: Number.isFinite(r.p.l) ? r.p.l : null,
        sanitiser: String(r.p.s || '').slice(0, 40),
        surface: String(r.p.f || '').slice(0, 40),
        saltRange: Array.isArray(r.p.r) && r.p.r.every(Number.isFinite) && r.p.r[0] < r.p.r[1]
          ? { lo: r.p.r[0], hi: r.p.r[1] } : null,
      },
      tests,
      doses: r.d.filter((d) => okDate(d.at)).slice(0, MAX_DOSES).map((d) => ({ at: d.at, title: String(d.t || '').slice(0, 80) })),
    };
  } catch {
    return null;
  }
}
