// File: src/lib/db.js
// Data layer: maps between App.jsx state shapes and Supabase rows.
// All functions are user-scoped; RLS enforces isolation server-side.

import { memberProfilePayload, validateMemberProfile } from './memberProfile.js';
import { supabase } from './supabase';

// ── Water tests ──────────────────────────────────────────────

export function rowToTest(r) {
  return {
    id: r.id,
    // null = not tested (skipped by the Health Score), never coerced to 0 —
    // a 0 here is a real reading (e.g. no chlorine).
    freeChlor:       r.free_chlorine ?? null,
    pH:              r.ph ?? null,
    alkalinity:      r.alkalinity ?? null,
    cyanuricAcid:    r.cyanuric_acid ?? null,
    calciumHardness: r.calcium ?? null,
    ...(r.salt != null ? { salt: r.salt } : {}),
    ...(r.phosphates != null ? { phosphates: r.phosphates } : {}),
    ...(r.tds != null ? { tds: r.tds } : {}),
    healthScore: r.health_score ?? null, // score as stored at test time
    createdAt: r.tested_at,
    source: r.source || 'manual',
    // Set by the database when a reading is changed after the first save
    // (migration 018). auditTracked is false until that migration is applied.
    editedAt: r.edited_at ?? null,
    originalReadings: r.original_readings ?? null,
    auditTracked: 'edited_at' in r,
    // Path of the printout photo in the private bucket (migration 019).
    printoutPath: r.printout_path ?? null,
  };
}

export async function loadTests(userId) {
  const { data, error } = await supabase
    .from('water_tests')
    .select('*')
    .eq('user_id', userId)
    .order('tested_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTest);
}

export async function saveTest(userId, poolId, test, healthScore) {
  const row = {
    user_id: userId,
    pool_id: poolId || null,
    // ?? not || — a 0 reading (e.g. no chlorine) is real data, not "untested".
    ph:             test.pH ?? null,
    free_chlorine:  test.freeChlor ?? null,
    alkalinity:     test.alkalinity ?? null,
    cyanuric_acid:  test.cyanuricAcid ?? null,
    calcium:        test.calciumHardness ?? null,
    salt:           test.salt ?? null,
    phosphates:     test.phosphates ?? null,
    tds:            test.tds ?? null,
    health_score:   Number.isFinite(healthScore) ? Math.round(healthScore) : null,
    source:         test.source || 'manual', // manual | ocr | voice | shop_import
    tested_at:      test.createdAt || new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('water_tests').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

function testToRow(test, healthScore) {
  return {
    // ?? not || — a 0 reading is real data, not "untested".
    ph:             test.pH ?? null,
    free_chlorine:  test.freeChlor ?? null,
    alkalinity:     test.alkalinity ?? null,
    cyanuric_acid:  test.cyanuricAcid ?? null,
    calcium:        test.calciumHardness ?? null,
    salt:           test.salt ?? null,
    phosphates:     test.phosphates ?? null,
    tds:            test.tds ?? null,
    health_score:   Number.isFinite(healthScore) ? Math.round(healthScore) : null,
    tested_at:      test.createdAt || new Date().toISOString(),
  };
}

// Fix a reading or the date. The database records that it was edited and keeps
// the readings as first saved (migration 018), so the owner cannot hide an edit.
export async function updateTest(id, test, healthScore) {
  const { data, error } = await supabase
    .from('water_tests').update(testToRow(test, healthScore)).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToTest(data);
}

export async function deleteTest(id, printoutPath) {
  const { data, error } = await supabase.from('water_tests').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('That test was not deleted.');
  if (printoutPath) await supabase.storage.from(PRINTOUT_BUCKET).remove([printoutPath]).catch(() => {});
}

// ── Printout photos (private bucket, migration 019) ──────────
// One photo per test at <user_id>/<test_id>.jpg. Never public: the app opens a
// photo with a link that expires in a few minutes.

const PRINTOUT_BUCKET = 'printouts';

export async function savePrintout(userId, testId, blob) {
  const path = `${userId}/${testId}.jpg`;
  const up = await supabase.storage.from(PRINTOUT_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from('water_tests').update({ printout_path: path }).eq('id', testId);
  if (error) throw error;
  return path;
}

export async function printoutUrl(path) {
  const { data, error } = await supabase.storage.from(PRINTOUT_BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function removePrintout(testId, path) {
  const { error } = await supabase.from('water_tests').update({ printout_path: null }).eq('id', testId);
  if (error) throw error;
  // Best effort: the row no longer points at it either way.
  await supabase.storage.from(PRINTOUT_BUCKET).remove([path]).catch(() => {});
}

// ── Pool profile ─────────────────────────────────────────────

export function rowToPool(r) {
  return {
    id: r.id,
    name:    r.name || 'My pool',
    type:    r.pool_type || 'In-ground',
    shape:   r.pool_shape || 'Rectangular',
    surface: r.pool_surface || 'Pebble / pebblecrete',
    volumeL: r.volume_litres || 0,
    sanitiser: r.sanitiser_type || 'Chlorine (granular/liquid)',
    filter:    r.filter_type || 'Sand',
    yearBuilt: r.year_built ?? '',
    yearBuiltApprox: r.year_built_approx ?? false,
    hasCover:  r.has_cover ?? false,
    fenceCertDate: r.fence_cert_date ?? '',
  };
}

export async function loadPoolProfile(userId) {
  const { data, error } = await supabase
    .from('pool_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPool(data) : null;
}

export async function savePoolProfile(userId, p) {
  const row = {
    user_id: userId,
    name:           p.name || null,
    pool_type:      p.type || null,
    pool_shape:     p.shape || null,
    pool_surface:   p.surface || null,
    volume_litres:  p.volumeL ? parseInt(p.volumeL, 10) : null,
    sanitiser_type: p.sanitiser || null,
    filter_type:    p.filter || null,
    year_built:     p.yearBuilt ? parseInt(p.yearBuilt, 10) : null,
    year_built_approx: !!p.yearBuiltApprox,
    has_cover:      !!p.hasCover,
    fence_cert_date: p.fenceCertDate || null,
    updated_at:     new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('pool_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ── Equipment ────────────────────────────────────────────────

export async function loadEquipment(userId) {
  const { data, error } = await supabase
    .from('equipment')
    .select('id, type, brand, model, notes, installed_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addEquipment(userId, item) {
  const { data, error } = await supabase
    .from('equipment')
    .insert({ user_id: userId, type: item.type, brand: item.brand || null,
              model: item.model || null, notes: item.notes || null,
              installed_at: item.installed_at || null })
    .select('id, type, brand, model, notes, installed_at, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipment(item) {
  const { error } = await supabase
    .from('equipment')
    .update({ type: item.type, brand: item.brand || null, model: item.model || null,
              notes: item.notes || null, installed_at: item.installed_at || null,
              updated_at: new Date().toISOString() })
    .eq('id', item.id);
  if (error) throw error;
}

export async function deleteEquipment(id) {
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
}

// ── Pool events (timeline annotations) ───────────────────────
// Manual special events the owner pins to their water-test timeline:
// green-pool treatments, shock doses, drain/refills, custom notes, etc.

export function rowToEvent(r) {
  return {
    id: r.id,
    type: r.event_type || 'custom',
    title: r.title || '',
    notes: r.notes || '',
    date: r.occurred_at,
    source: 'manual',
  };
}

export async function loadEvents(userId) {
  const { data, error } = await supabase
    .from('pool_events')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToEvent);
}

export async function addEvent(userId, poolId, event) {
  const { data, error } = await supabase
    .from('pool_events')
    .insert({
      user_id:     userId,
      pool_id:     poolId || null,
      event_type:  event.type || 'custom',
      title:       event.title,
      notes:       event.notes || null,
      occurred_at: event.date || new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('pool_events').delete().eq('id', id);
  if (error) throw error;
}

// ── User profile (trial / premium) ───────────────────────────

// Newest column set first. Each older set is used only when the database
// does not have the newer columns yet (migrations 017 and 020 are applied by
// hand), so the membership read keeps working and the rest of the app loads.
const USER_PROFILE_COLUMN_SETS = [
  'is_premium, trial_ends_at, plan, first_name, last_name, address, suburb, postcode, reminder_day, monthly_report',
  'is_premium, trial_ends_at, plan, first_name, last_name, address, suburb, postcode',
  'is_premium, trial_ends_at, plan',
];

export async function loadUserProfile(userId) {
  for (let i = 0; i < USER_PROFILE_COLUMN_SETS.length; i++) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(USER_PROFILE_COLUMN_SETS[i])
      .eq('id', userId)
      .maybeSingle();
    if (error?.code === '42703' && i < USER_PROFILE_COLUMN_SETS.length - 1) continue;
    if (error) throw error;
    return data;
  }
  return null;
}

// Weekly reminder day (0 Sunday to 6 Saturday, null = off) and the monthly
// report switch. Migration 020 grants UPDATE on just these two columns.
export async function saveReminderPrefs(userId, { reminderDay, monthlyReport }) {
  const row = {};
  if (reminderDay !== undefined) {
    if (reminderDay !== null && !(Number.isInteger(reminderDay) && reminderDay >= 0 && reminderDay <= 6)) {
      throw new Error('Pick a day of the week.');
    }
    row.reminder_day = reminderDay;
  }
  if (monthlyReport !== undefined) row.monthly_report = !!monthlyReport;
  const { data, error } = await supabase
    .from('user_profiles')
    .update(row)
    .eq('id', userId)
    .select('reminder_day, monthly_report')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Couldn't save that. Try again.");
  return data;
}

// Location details on the same user_profiles row. Premium and Stripe
// columns are not in this payload — the database rejects those writes.
export async function saveUserProfile(userId, fields) {
  const problem = validateMemberProfile(fields);
  if (problem) {
    const err = new Error(problem.message);
    err.field = problem.field;
    throw err;
  }
  const row = memberProfilePayload(fields);
  const { data, error } = await supabase
    .from('user_profiles')
    .update(row)
    .eq('id', userId)
    .select('first_name, last_name, address, suburb, postcode')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Couldn't save your details. Try again.");
  }
  return data;
}
