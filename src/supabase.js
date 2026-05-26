import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client (browser).
 *
 * Reads from Vite-injected env vars. Set these in:
 *   - Local dev:           .env.local (git-ignored)
 *   - Cloudflare Pages:    Settings → Environment variables
 *                          - Production scope:  prod project keys
 *                          - Preview scope:     preview/staging keys
 *
 * The anon key is publishable (RLS is the real defense layer), but
 * keeping it out of source control means: (a) we can rotate without
 * a code change, (b) preview deploys can point at a different
 * Supabase project, (c) we never accidentally bake a service_role
 * key into the bundle.
 */

// Normalize — trim whitespace and strip any surrounding quote chars that
// sometimes slip through when pasting into dashboard UIs.
function clean(v) {
  if (!v) return v;
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const SUPABASE_URL = clean(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Guard 1 — env vars missing entirely
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Set them in .env.local for local dev, or in Cloudflare Pages → ' +
    'Settings → Environment variables for deploys.'
  );
  throw new Error('Supabase env vars not set');
}

// Guard 2 — URL is present but malformed. The Supabase SDK throws a
// cryptic "Invalid supabaseUrl" with no context, which is a pain to
// debug in prod. Catch it here and say *which* value failed so the
// dashboard fix is obvious.
try {
  const u = new URL(SUPABASE_URL);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`bad protocol "${u.protocol}"`);
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(
    `[supabase] VITE_SUPABASE_URL is not a valid URL. Got: "${SUPABASE_URL}". ` +
    `Expected something like "https://<project-ref>.supabase.co". ` +
    `Check Cloudflare Pages → Settings → Environment variables.`
  );
  throw new Error(`Invalid VITE_SUPABASE_URL: "${SUPABASE_URL}"`);
}

// Guard 3 — Anon key sanity. Supabase anon keys are JWTs (three
// dot-separated base64 segments). If this doesn't look like one, fail
// early before createClient() produces a silent auth failure at first
// request time.
if (SUPABASE_ANON_KEY.split('.').length !== 3) {
  // eslint-disable-next-line no-console
  console.error(
    `[supabase] VITE_SUPABASE_ANON_KEY does not look like a JWT (expected 3 dot-separated parts). ` +
    `Length received: ${SUPABASE_ANON_KEY.length}. ` +
    `Check Cloudflare Pages → Settings → Environment variables.`
  );
  throw new Error('Invalid VITE_SUPABASE_ANON_KEY shape');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
