// "Download all my data": everything the app holds about a member, as one JSON
// file they can keep. Pure shaping here; fetching is db.loadMyData.

const pickProfile = (p) => ({
  firstName: p?.first_name ?? null,
  lastName: p?.last_name ?? null,
  address: p?.address ?? null,
  suburb: p?.suburb ?? null,
  postcode: p?.postcode ?? null,
});

export function buildMyData({ email, profile, pool, tests, equipment, events, now = new Date() }) {
  return {
    about: 'Your Pool Mate: a copy of the information held about your account. Printout photos are not inside this file; the PDF water record on the Chemistry page includes them.',
    exportedAt: now.toISOString(),
    account: {
      email: email || null,
      ...pickProfile(profile),
      membership: {
        plan: profile?.plan ?? null,
        paid: !!profile?.is_premium,
        trialEndsAt: profile?.trial_ends_at ?? null,
      },
      reminders: {
        weeklyReminderDay: Number.isInteger(profile?.reminder_day) ? profile.reminder_day : null,
        monthlyReport: profile?.monthly_report !== false,
      },
    },
    pool: pool || null,
    waterTests: tests || [],
    equipment: equipment || [],
    events: events || [],
  };
}

export function myDataFileName(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return `your-pool-mate-my-data-${day}.json`;
}

export function myDataBlob(data) {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

// What the server says when deletion cannot finish, in plain words.
export function deleteErrorMessage(detail) {
  switch (detail?.code) {
    case 'STRIPE':
      return "We couldn't cancel your subscription, so nothing was deleted. Please try again, or email hello@yourpoolmate.com.au.";
    case 'STORAGE':
    case 'DATA':
      return "We couldn't remove everything just yet, so your account is still here. Please try again.";
    case 'NO_AUTH':
      return 'Please sign out, sign in again, then try once more.';
    default:
      return "We couldn't delete your account just now. Check your connection and try again.";
  }
}

export const DELETE_WORD = 'DELETE';
export const isDeleteConfirmed = (text) => String(text ?? '').trim().toUpperCase() === DELETE_WORD;
