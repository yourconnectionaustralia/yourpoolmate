// "Your data" card on Profile: download everything, or delete the account.
// Deleting needs an open "Are you sure" panel and the word DELETE typed in.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  buildMyData, deleteErrorMessage, isDeleteConfirmed, myDataBlob, myDataFileName,
} from '../lib/myData.js';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function AccountData({ email, isPremium, plan, loadMyData, deleteAccount }) {
  const [busy, setBusy] = useState('');       // '' | 'download' | 'delete'
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const download = async () => {
    setBusy('download'); setProblem(''); setNote('');
    try {
      const raw = await loadMyData();
      const data = buildMyData({ email, ...raw });
      saveBlob(myDataBlob(data), myDataFileName());
      setNote('Downloaded. Check your Downloads folder.');
    } catch (err) {
      console.error('Data download failed:', err);
      setProblem("We couldn't put your data together just now. Check your connection and try again.");
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('delete'); setProblem('');
    try {
      await deleteAccount();
      try { sessionStorage.setItem('ypm.accountDeleted', '1'); } catch { /* private mode */ }
      // The account is gone on the server; clear this device's sign-in without calling it.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Account delete failed:', err);
      setProblem(deleteErrorMessage({ code: err.code }));
      setBusy('');
    }
  };

  const lifetime = isPremium && plan !== 'annual';

  return (
    <div className="card-section account-data" style={{ marginTop: 16 }}>
      <h2 className="reminder-title">Your data</h2>
      <p className="record-export-body">
        Your water tests, pool details, equipment and events belong to you. Download a copy any time.
        For a record to hand to a builder or equipment maker, use the PDF on the Chemistry page.
      </p>
      <div className="record-export-actions">
        <button className="btn btn-ghost btn-sm" onClick={download} disabled={busy !== ''}>
          {busy === 'download' ? 'Getting your data…' : 'Download all my data'}
        </button>
      </div>
      <div aria-live="polite">
        {note && <p className="reminder-ok">{note}</p>}
      </div>

      <hr className="account-data-rule" />

      {!confirming ? (
        <>
          <p className="record-export-body">
            Want to leave? You can delete your account and everything in it.
          </p>
          <button className="btn btn-ghost btn-sm btn-danger-outline" onClick={() => { setConfirming(true); setProblem(''); }}>
            Delete my account
          </button>
        </>
      ) : (
        <div className="account-delete-panel" role="group" aria-labelledby="delete-title">
          <h3 id="delete-title" className="account-delete-title">Delete your account?</h3>
          <ul className="account-delete-list">
            <li>Your pool, every water test, equipment, events and saved printout photos are deleted for good.</li>
            <li>This can't be undone. We can't get any of it back.</li>
            {isPremium && (
              <li>
                {lifetime
                  ? 'Your lifetime membership ends with the account and is not refunded here. Email us first if you have a question about that.'
                  : 'Your yearly subscription is cancelled straight away, with no further charges.'}
              </li>
            )}
            <li>Stripe keeps its own payment records, as the law requires.</li>
          </ul>
          <label className="input-label" htmlFor="delete-confirm">Type DELETE to confirm</label>
          <input
            id="delete-confirm"
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={busy !== ''}
          />
          <div className="record-export-actions" style={{ marginTop: 12 }}>
            <button
              className="btn btn-sm btn-danger"
              onClick={remove}
              disabled={busy !== '' || !isDeleteConfirmed(typed)}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setConfirming(false); setTyped(''); setProblem(''); }}
              disabled={busy !== ''}
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
      {problem && <p className="reminder-problem" role="alert">{problem}</p>}
    </div>
  );
}
