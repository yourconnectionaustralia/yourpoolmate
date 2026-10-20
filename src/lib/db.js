// File: src/lib/db.js
// Data layer: maps between App.jsx state shapes and Supabase rows.
// All functions are user-scoped; RLS enforces isolation server-side.

import { memberProfilePayload, validateMemberProfile } from './memberProfile.js';
import { supabase } from './supabase';

// Migrations are applied by hand, so a new table or column can be missing
// for a while after the app ships. These codes mean "not there yet", which
// the app treats as a feature that is not switched on, never as lost data.
const MISSING_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST200']);
export function isMissingSchema(err) {
  return Boolean(err && (MISSING_CODES.has(err.code) || /does not exist|schema cache/i.test(err.message || '')));
}

export class FeatureNotReady extends Error {
  constructor(feature) {
    super(`${feature} is not switched on yet.`);
    this.code = 'FEATURE_NOT_READY';
  }
}

// ── Water tests ──────────────────────────────────────────────

export function rowToTest(r) {
  return {
    id: r.id,
    // null = not tested (skipped by the Health Score), never coerced to 0 —
    // a 0 here is a real reading (e.g. no chlorine).
    freeChlor:       r.free_chlorine ?? null,
    ...(r.total_chlorine != null ? { totalChlor: r.total_chlorine } : {}),
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
    total_chlorine: test.totalChlor ?? null,
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
    total_chlorine: test.totalChlor ?? null,
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
    // Migration 021. Null until the owner sets them.
    pumpHoursPerDay: r.pump_hours_per_day ?? null,
    pumpHoursSummer: r.pump_hours_summer ?? null,
    pumpHoursAutumn: r.pump_hours_autumn ?? null,
    pumpHoursWinter: r.pump_hours_winter ?? null,
    pumpHoursSpring: r.pump_hours_spring ?? null,
    pumpScheduleNote: r.pump_schedule_note ?? '',
    chlorinatorOutputPercent: r.chlorinator_output_percent ?? null,
    chlorinatorCellGPerHour: r.chlorinator_cell_g_per_hour != null ? Number(r.chlorinator_cell_g_per_hour) : null,
  };
}

const hours = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : null;
};

// Pump and chlorinator columns (migration 021). Sent only when the database
// has them; see savePoolProfile.
function poolSettingsRow(p) {
  const pct = parseInt(p.chlorinatorOutputPercent, 10);
  const cell = parseFloat(p.chlorinatorCellGPerHour);
  return {
    pump_hours_per_day: hours(p.pumpHoursPerDay),
    pump_hours_summer:  hours(p.pumpHoursSummer),
    pump_hours_autumn:  hours(p.pumpHoursAutumn),
    pump_hours_winter:  hours(p.pumpHoursWinter),
    pump_hours_spring:  hours(p.pumpHoursSpring),
    pump_schedule_note: (p.pumpScheduleNote || '').trim().slice(0, 200) || null,
    chlorinator_output_percent: Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : null,
    chlorinator_cell_g_per_hour: Number.isFinite(cell) && cell >= 1 && cell <= 100 ? cell : null,
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
  const upsert = (r) => supabase.from('pool_profiles').upsert(r, { onConflict: 'user_id' }).select('id').single();
  let { data, error } = await upsert({ ...row, ...poolSettingsRow(p) });
  // Before migration 021 the pump columns don't exist. Save the rest.
  if (error && isMissingSchema(error)) ({ data, error } = await upsert(row));
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
    // Dose detail (migration 021). Absent on older rows and older databases.
    testId: r.test_id ?? null,
    stepKey: r.step_key ?? null,
    product: r.product ?? null,
    grams: r.grams != null ? Number(r.grams) : null,
    millilitres: r.millilitres != null ? Number(r.millilitres) : null,
    costAud: r.cost_aud != null ? Number(r.cost_aud) : null,
    shedDraw: Array.isArray(r.shed_draw) ? r.shed_draw : [],
  };
}

function doseDetailRow(event) {
  if (event.type !== 'dose') return {};
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 10) / 10 : null);
  return {
    test_id: event.testId || null,
    step_key: event.stepKey || null,
    product: event.product ? String(event.product).slice(0, 120) : null,
    grams: n(event.grams),
    millilitres: n(event.millilitres),
    cost_aud: Number(event.costAud) > 0 ? Math.round(Number(event.costAud) * 100) / 100 : null,
    shed_draw: Array.isArray(event.shedDraw) && event.shedDraw.length ? event.shedDraw : null,
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
  const row = {
    user_id:     userId,
    pool_id:     poolId || null,
    event_type:  event.type || 'custom',
    title:       event.title,
    notes:       event.notes || null,
    occurred_at: event.date || new Date().toISOString(),
  };
  const insert = (r) => supabase.from('pool_events').insert(r).select('*').single();
  const detail = doseDetailRow(event);
  let { data, error } = await insert({ ...row, ...detail });
  // Before migration 021 a dose saves as a plain history line, as it always did.
  if (error && Object.keys(detail).length && isMissingSchema(error)) ({ data, error } = await insert(row));
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
  'is_premium, trial_ends_at, plan, first_name, last_name, address, suburb, postcode, reminder_day, monthly_report, app_prefs',
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

// Pinned shortcuts and other small settings (migration 021).
export async function saveAppPrefs(userId, prefs) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ app_prefs: prefs })
    .eq('id', userId)
    .select('app_prefs')
    .maybeSingle();
  if (error && isMissingSchema(error)) throw new FeatureNotReady('Saving shortcuts');
  if (error) throw error;
  return data?.app_prefs ?? prefs;
}

// ── My Shed (migration 021) ──────────────────────────────────

export function rowToShedItem(r) {
  return {
    id: r.id,
    productKey: r.product_key,
    label: r.label,
    packAmount: Number(r.pack_amount),
    packUnit: r.pack_unit,
    packs: r.packs ?? 1,
    priceAud: r.price_aud != null ? Number(r.price_aud) : null,
    boughtAt: r.bought_at,
    store: r.store ?? null,
    source: r.source || 'typed',
    receiptId: r.receipt_id ?? null,
    createdAt: r.created_at,
  };
}

// { available: false } until migration 021 is applied.
export async function loadShed(userId) {
  const { data, error } = await supabase.from('shed_items').select('*').eq('user_id', userId).order('bought_at', { ascending: true });
  if (error && isMissingSchema(error)) return { available: false, items: [] };
  if (error) throw error;
  return { available: true, items: (data || []).map(rowToShedItem) };
}

export async function addShedItems(userId, items) {
  const rows = items.map((i) => ({
    user_id: userId,
    product_key: i.productKey,
    label: String(i.label || '').slice(0, 120),
    pack_amount: Number(i.packAmount),
    pack_unit: i.packUnit,
    packs: Math.max(1, Math.min(100, parseInt(i.packs, 10) || 1)),
    price_aud: Number(i.priceAud) > 0 ? Math.round(Number(i.priceAud) * 100) / 100 : null,
    bought_at: i.boughtAt || new Date().toISOString().slice(0, 10),
    store: i.store ? String(i.store).trim().slice(0, 80) || null : null,
    source: i.source || 'typed',
    receipt_id: i.receiptId || null,
  }));
  const { data, error } = await supabase.from('shed_items').insert(rows).select('*');
  if (error && isMissingSchema(error)) throw new FeatureNotReady('My Shed');
  if (error) throw error;
  return (data || []).map(rowToShedItem);
}

export async function deleteShedItem(id) {
  const { error } = await supabase.from('shed_items').delete().eq('id', id);
  if (error) throw error;
}

// ── Shopping list (migration 021) ────────────────────────────

export function rowToShopItem(r) {
  return {
    id: r.id,
    product: r.product,
    productKey: r.product_key ?? null,
    quantity: Number(r.quantity) || 0,
    quantityLabel: r.quantity_label || '',
    form: r.form || 'other',
    status: r.status || 'needed',
    source: r.source || 'manual',
    testId: r.test_id ?? null,
    stepKey: r.step_key ?? null,
    stepTitle: r.step_title ?? null,
    boughtAt: r.bought_at ?? null,
    createdAt: r.created_at,
  };
}

export async function loadShop(userId) {
  const { data, error } = await supabase.from('shop_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error && isMissingSchema(error)) return { available: false, items: [] };
  if (error) throw error;
  return { available: true, items: (data || []).map(rowToShopItem) };
}

export async function addShopItem(userId, item) {
  const { data, error } = await supabase.from('shop_items').insert({
    user_id: userId,
    product: String(item.product || '').trim().slice(0, 120),
    product_key: item.productKey || null,
    quantity: Number(item.quantity) > 0 ? Math.round(Number(item.quantity) * 10) / 10 : 0,
    quantity_label: item.quantityLabel ? String(item.quantityLabel).slice(0, 60) : null,
    form: item.form || 'other',
    status: 'needed',
    source: item.source || 'manual',
    test_id: item.testId || null,
    step_key: item.stepKey || null,
    step_title: item.stepTitle ? String(item.stepTitle).slice(0, 80) : null,
  }).select('*').single();
  if (error && isMissingSchema(error)) throw new FeatureNotReady('The shopping list');
  if (error) throw error;
  return rowToShopItem(data);
}

export async function setShopItemBought(id, bought) {
  const { data, error } = await supabase.from('shop_items')
    .update({ status: bought ? 'bought' : 'needed', bought_at: bought ? new Date().toISOString() : null })
    .eq('id', id).select('*').single();
  if (error) throw error;
  return rowToShopItem(data);
}

export async function deleteShopItem(id) {
  const { error } = await supabase.from('shop_items').delete().eq('id', id);
  if (error) throw error;
}

// ── Your data: download everything, or delete the account ────

export async function loadMyData(userId) {
  const [profile, pool, tests, equipment, events] = await Promise.all([
    loadUserProfile(userId),
    supabase.from('pool_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('water_tests').select('*').eq('user_id', userId).order('tested_at', { ascending: true }),
    supabase.from('equipment').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('pool_events').select('*').eq('user_id', userId).order('occurred_at', { ascending: true }),
  ]);
  for (const r of [pool, tests, equipment, events]) if (r.error) throw r.error;
  // Shed and shopping list only exist once migration 021 is applied.
  const [shed, shop] = await Promise.all([
    supabase.from('shed_items').select('*').eq('user_id', userId).order('bought_at', { ascending: true }),
    supabase.from('shop_items').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ]);
  for (const r of [shed, shop]) if (r.error && !isMissingSchema(r.error)) throw r.error;
  return {
    profile,
    pool: pool.data,
    tests: tests.data || [],
    equipment: equipment.data || [],
    events: events.data || [],
    shed: shed.data || [],
    shopping_list: shop.data || [],
  };
}

// Asks the server to send this member's own welcome / first-test email now,
// instead of waiting for the next scheduled sweep. Fire and forget: it never
// blocks or breaks the app, and the server decides whether anything is due
// (once-only ledger, allowlist and timing rules all live there).
export async function nudgeMemberEmails() {
  try {
    await supabase.functions.invoke('send-lifecycle-email', { body: { action: 'member_sweep' } });
  } catch { /* the scheduled sweep is the backstop */ }
}

// Calls the delete-account Edge Function. It cancels a live subscription,
// removes saved photos and deletes the account. Throws with a plain message
// and a code on any failure; nothing is half-deleted without saying so.
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  let detail = data && typeof data === 'object' ? data : null;
  if (error) {
    const ctx = error.context;
    if (ctx && typeof ctx.json === 'function') {
      try { detail = await (typeof ctx.clone === 'function' ? ctx.clone().json() : ctx.json()); } catch { /* not JSON */ }
    }
    const err = new Error(error.message || 'delete failed');
    err.code = detail?.code || 'DELETE_FAILED';
    throw err;
  }
  if (!detail?.ok) {
    const err = new Error(detail?.error || 'delete failed');
    err.code = detail?.code || 'DELETE_FAILED';
    throw err;
  }
  return true;
}
