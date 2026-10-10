// "Add to home screen" guide.
//
// An installed web app opens like any other app and, on iPhone, keeps the
// owner from losing it in a browser tab. The guide appears from the second
// visit, on a phone, until the app is installed or the owner dismisses it.
// Dismissing hides it for 30 days.

export const DISMISS_DAYS = 30;
export const MIN_VISITS = 2;

// 'installed' | 'android-prompt' | 'ios' | 'android' | 'other'
//   android-prompt: Chrome gave us a one-tap install prompt
//   android:        Android without the prompt (steps via the browser menu)
export function installPlatform({ userAgent = '', standalone = false, hasPrompt = false, maxTouchPoints = 0 } = {}) {
  if (standalone) return 'installed';
  const ua = userAgent || '';
  // iPadOS 13+ reports itself as a Mac with a touch screen.
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/.test(ua)) return hasPrompt ? 'android-prompt' : 'android';
  return 'other';
}

export function shouldShowInstallGuide({ platform, visits = 0, dismissedAt = null, now = new Date() }) {
  if (platform === 'installed' || platform === 'other') return false;
  if (visits < MIN_VISITS) return false;
  if (dismissedAt) {
    const t = new Date(dismissedAt).getTime();
    if (Number.isFinite(t) && now.getTime() - t < DISMISS_DAYS * 86400000) return false;
  }
  return true;
}

export const IOS_STEPS = [
  'Tap the Share button at the bottom of the screen. It is the square with an arrow pointing up.',
  'Scroll down and tap "Add to Home Screen".',
  'Tap "Add" in the top corner. Your Pool Mate now sits on your home screen like any other app.',
];

export const ANDROID_STEPS = [
  'Tap the three dots at the top right of Chrome.',
  'Tap "Add to Home screen" or "Install app".',
  'Tap "Install". Your Pool Mate now sits on your home screen like any other app.',
];

const VISITS_KEY = 'ypm.visits.v1';
const DISMISS_KEY = 'ypm.installDismissed.v1';

export function countVisit(storage, sessionStore) {
  try {
    if (sessionStore.getItem('ypm.visitCounted')) return Number(storage.getItem(VISITS_KEY) || 0);
    const next = Number(storage.getItem(VISITS_KEY) || 0) + 1;
    storage.setItem(VISITS_KEY, String(next));
    sessionStore.setItem('ypm.visitCounted', '1');
    return next;
  } catch { return 0; }
}

export function readDismissed(storage) {
  try { return storage.getItem(DISMISS_KEY); } catch { return null; }
}

export function writeDismissed(storage, iso) {
  try { storage.setItem(DISMISS_KEY, iso); } catch { /* private mode: it just shows again next visit */ }
}
