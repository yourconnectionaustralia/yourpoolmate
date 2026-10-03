// Member location details stored on user_profiles.
// Email is not part of this payload. It already lives on the auth user.
//
// Migration 017 adds the columns and the right to update them. Until that
// migration is on the live database, a save of the same fields is kept on
// the signed-in account (auth user metadata) so Save details can succeed.

export const MEMBER_LIMITS = {
  firstName: 80,
  lastName: 80,
  address: 200,
  suburb: 80,
};

const AU_POSTCODE = /^\d{4}$/;

function trimmed(value) {
  return String(value ?? '').trim();
}

function blankToNull(value) {
  const text = trimmed(value);
  return text ? text : null;
}

/**
 * @returns {{ field: string, message: string } | null}
 */
export function validateMemberProfile(fields) {
  const firstName = trimmed(fields?.firstName);
  const lastName = trimmed(fields?.lastName);
  const address = trimmed(fields?.address);
  const suburb = trimmed(fields?.suburb);
  const postcode = trimmed(fields?.postcode);

  if (firstName.length > MEMBER_LIMITS.firstName) {
    return { field: 'firstName', message: 'First name needs to be 80 characters or fewer.' };
  }
  if (lastName.length > MEMBER_LIMITS.lastName) {
    return { field: 'lastName', message: 'Last name needs to be 80 characters or fewer.' };
  }
  if (address.length > MEMBER_LIMITS.address) {
    return { field: 'address', message: 'Address needs to be 200 characters or fewer.' };
  }
  if (suburb.length > MEMBER_LIMITS.suburb) {
    return { field: 'suburb', message: 'Suburb needs to be 80 characters or fewer.' };
  }
  if (!postcode) {
    return { field: 'postcode', message: 'Enter your 4-digit postcode.' };
  }
  if (!AU_POSTCODE.test(postcode)) {
    return { field: 'postcode', message: 'Postcode needs to be 4 digits.' };
  }
  return null;
}

/** Columns written by saveUserProfile. Nothing else on the member row. */
export function memberProfilePayload(fields) {
  return {
    first_name: blankToNull(fields?.firstName),
    last_name: blankToNull(fields?.lastName),
    address: blankToNull(fields?.address),
    suburb: blankToNull(fields?.suburb),
    postcode: trimmed(fields?.postcode),
  };
}

export function memberFormFromRow(row) {
  const text = (value) => (value == null ? '' : String(value));
  return {
    firstName: text(row?.first_name),
    lastName: text(row?.last_name),
    address: text(row?.address),
    suburb: text(row?.suburb),
    postcode: text(row?.postcode),
  };
}

// Temporary copy used only while user_profiles has no location columns.
export const MEMBER_METADATA_KEY = 'member_details';

const SAVE_FAILED = "Couldn't save your details. Try again.";

/**
 * True when PostgREST or Postgres is saying the location columns are not
 * on user_profiles yet. Permission errors are a different failure.
 */
export function isMissingMemberColumnError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = String(error.message || '');
  return /could not find the '[^']+' column/i.test(message)
    || /column [\w.]+ does not exist/i.test(message);
}

/** Where a profile write should land: the row, the account copy, or a failure. */
export function memberSavePlan(error, data) {
  if (!error && data) return 'profile';
  if (isMissingMemberColumnError(error)) return 'account';
  return 'fail';
}

export function memberDetailsFromMetadata(meta) {
  const raw = meta?.[MEMBER_METADATA_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = {
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    address: raw.address ?? null,
    suburb: raw.suburb ?? null,
    postcode: raw.postcode ?? null,
  };
  const problem = validateMemberProfile({
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    address: row.address ?? '',
    suburb: row.suburb ?? '',
    postcode: row.postcode ?? '',
  });
  if (problem) return null;
  return row;
}

/**
 * Prefer a saved profile row once it has a postcode. Otherwise show the
 * account copy from before the location columns existed.
 */
/** True when the profile row can store a postcode but does not have one yet. */
export function shouldCopyAccountDetailsToProfile(profileRow, form) {
  if (!profileRow || !Object.prototype.hasOwnProperty.call(profileRow, 'postcode')) return false;
  if (String(profileRow.postcode ?? '').trim()) return false;
  return Boolean(String(form?.postcode ?? '').trim());
}

export function memberDetailsForForm(profileRow, meta) {
  const hasColumn = profileRow != null
    && Object.prototype.hasOwnProperty.call(profileRow, 'postcode');
  const columnPostcode = hasColumn ? profileRow.postcode : null;
  if (hasColumn && columnPostcode != null && String(columnPostcode).trim()) {
    return memberFormFromRow(profileRow);
  }
  const fromMeta = memberDetailsFromMetadata(meta);
  if (fromMeta) return memberFormFromRow(fromMeta);
  return memberFormFromRow(profileRow);
}

/**
 * Save location details for a signed-in member.
 * Writes user_profiles when those columns exist. If the live database has
 * not had migration 017 applied, keeps the same payload on the account.
 */
export async function saveMemberDetails(client, userId, fields) {
  const problem = validateMemberProfile(fields);
  if (problem) {
    const err = new Error(problem.message);
    err.field = problem.field;
    throw err;
  }
  const row = memberProfilePayload(fields);
  const { data, error } = await client
    .from('user_profiles')
    .update(row)
    .eq('id', userId)
    .select('first_name, last_name, address, suburb, postcode')
    .maybeSingle();

  const plan = memberSavePlan(error, data);
  if (plan === 'profile') return data;
  if (plan === 'account') {
    const { error: authError } = await client.auth.updateUser({
      data: { [MEMBER_METADATA_KEY]: row },
    });
    if (authError) throw authError;
    return row;
  }
  if (error) throw error;
  throw new Error(SAVE_FAILED);
}
