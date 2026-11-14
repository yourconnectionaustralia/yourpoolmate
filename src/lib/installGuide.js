// "Add to home screen" guide.
//
// An installed web app opens like any other app and, on iPhone, keeps the
// owner from losing it in a browser tab. The guide appears from the second
// visit, on a phone, until the app is installed or the owner dismisses it.
// Dismissing hides it for 30 days.
//
// The steps differ by phone and by browser, and a wrong step is worse than
// none, so the guide only shows what we can stand behind:
//   - Chrome (and any Android browser that offers it) gets a one-tap button,
//     because the browser supplies the install prompt itself.
//   - iPhone Safari and Android Chrome get steps that follow Apple's iPhone
//     User Guide and Google's Chrome Help.
//   - Everything else (Facebook, Instagram and other in-app browsers, Chrome
//     or Firefox on iPhone, iPad, Samsung Internet and Firefox without a
//     prompt, desktop) gets no guide at all.

export const DISMISS_DAYS = 30;
export const MIN_VISITS = 2;

// Browsers that live inside another app (Facebook, Instagram, Messenger, TikTok,
// the Google app, Android WebViews). They cannot add a site to the home screen.
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|MicroMessenger|TikTok|musical_ly|Snapchat|Pinterest|LinkedInApp|Twitter|\bLine\/|GSA\/|; wv\)/i;
// Browsers that look like Safari or Chrome but have their own menus.
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Mercury|YaBrowser|UCBrowser/i;
const ANDROID_OTHER_BROWSER = /EdgA|OPR\/|OPT\/|SamsungBrowser|Firefox|UCBrowser|DuckDuckGo|Vivaldi|YaBrowser|MiuiBrowser|HeyTapBrowser|Puffin/i;

// 'installed' | 'android-prompt' | 'ios' | 'android' | 'other'
//   android-prompt: the browser gave us a one-tap install prompt
//   ios:            iPhone in Safari (steps via the Share button)
//   android:        Android in Chrome without the prompt (steps via the menu)
//   other:          no reliable steps, so no guide
export function installPlatform({ userAgent = '', standalone = false, hasPrompt = false } = {}) {
  if (standalone) return 'installed';
  const ua = userAgent || '';
  if (IN_APP.test(ua)) return 'other';
  // iPad is left out on purpose: its Share button sits somewhere else. iPadOS 13+
  // reports itself as a Mac, so it lands in 'other' with desktops.
  if (/iPhone|iPod/.test(ua)) {
    const safari = /Version\/[\d.]+/.test(ua) && /Safari\//.test(ua) && !IOS_OTHER_BROWSER.test(ua);
    return safari ? 'ios' : 'other';
  }
  if (/Android/.test(ua)) {
    if (hasPrompt) return 'android-prompt';
    return /Chrome\//.test(ua) && !ANDROID_OTHER_BROWSER.test(ua) ? 'android' : 'other';
  }
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

// Apple (iPhone User Guide, "Bookmark a website in Safari", iOS 26): the Share
// button is inside the More button, or in the toolbar when Safari's tab bar is
// at the top or bottom. "Add to Home Screen" may need adding with Edit Actions.
export const IOS_STEPS = [
  'In Safari, tap the Share button. It is the square with an arrow pointing up. If you cannot see it, tap the "More" button (three dots) first, then tap Share.',
  'Scroll down the list and tap "Add to Home Screen". If it is not there, scroll to the bottom, tap "Edit Actions", then tap "Add to Home Screen".',
  'Tap "Add". Your Pool Mate now sits on your home screen like any other app.',
];

// Google (Chrome Help, "Use web apps", Android): More, then Add to home screen,
// then Install. The menu sits to the right of the address bar, wherever that is.
export const ANDROID_STEPS = [
  'In Chrome, tap the menu (three dots) to the right of the address bar.',
  'Tap "Add to home screen", then tap "Install". On some phones it says "Install app" straight away.',
  'Follow the prompts. Your Pool Mate now sits on your home screen like any other app.',
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
