// Card that shows how to put Your Pool Mate on the home screen.
// Android with Chrome's install prompt gets a one-tap button; iPhone and other
// Android browsers get the steps in plain words.

import { useEffect, useState } from 'react';
import {
  ANDROID_STEPS, IOS_STEPS, countVisit, installPlatform, readDismissed, shouldShowInstallGuide, writeDismissed,
} from '../lib/installGuide.js';

export default function InstallGuide() {
  const [prompt, setPrompt] = useState(null);   // Chrome's beforeinstallprompt event
  const [visits] = useState(() => {
    try { return countVisit(localStorage, sessionStorage); } catch { return 0; }
  });
  const [dismissedAt, setDismissedAt] = useState(() => {
    try { return readDismissed(localStorage); } catch { return null; }
  });
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const standalone = (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && navigator.standalone === true);
  const platform = installed ? 'installed' : installPlatform({
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    standalone,
    hasPrompt: !!prompt,
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  });

  if (!shouldShowInstallGuide({ platform, visits, dismissedAt })) return null;

  const dismiss = () => {
    const iso = new Date().toISOString();
    writeDismissed(localStorage, iso);
    setDismissedAt(iso);
  };

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* closed without choosing */ }
    setPrompt(null);
  };

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS;

  return (
    <div className="card-section install-guide" role="region" aria-label="Add Your Pool Mate to your home screen">
      <div className="install-guide-title">Put Your Pool Mate on your home screen</div>
      <p className="install-guide-body">
        It opens in one tap, like any other app, and you won't lose it in your browser.
      </p>
      {platform === 'android-prompt' ? (
        <button className="btn btn-primary" onClick={install}>Add to home screen</button>
      ) : (
        <ol className="install-guide-steps">
          {steps.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
