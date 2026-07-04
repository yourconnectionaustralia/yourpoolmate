// File: src/lib/db.js
// Data layer: maps between App.jsx state shapes and Supabase rows.
// All functions are user-scoped; RLS enforces isolation server-side.

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
    source:         test.source || 'manual',
    tested_at:      test.createdAt || new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('water_tests').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
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
    .select('id, type, brand, model, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addEquipment(userId, item) {
  const { data, error } = await supabase
    .from('equipment')
    .insert({ user_id: userId, type: item.type, brand: item.brand || null,
              model: item.model || null, notes: item.notes || null })
    .select('id, type, brand, model, notes, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipment(item) {
  const { error } = await supabase
    .from('equipment')
    .update({ type: item.type, brand: item.brand || null, model: item.model || null,
              notes: item.notes || null, updated_at: new Date().toISOString() })
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

export async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_premium, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
