// Member location details stored on user_profiles.
// Email is not part of this payload — it already lives on the auth user.

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
