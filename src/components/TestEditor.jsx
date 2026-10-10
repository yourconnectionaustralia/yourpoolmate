// Edit a saved water test, or add a past result with its real date.
//
// Used from the History screen. An edit is recorded by the database (the
// original readings are kept and an "edited" stamp is added), so the owner
// is told that up front. Deleting asks first, inline, with no browser dialog.

import { useEffect, useRef, useState } from 'react';
import {
  formFromTest, isoFromDateInput, testFormFields, testFromForm, toDateInput, validateReadings, EMPTY_TEST_FORM,
} from '../lib/testFields.js';

export default function TestEditor({
  mode, test, saltPool, saltRange, auditTracked = true, onSave, onDelete, onCancel,
}) {
  const isEdit = mode === 'edit';
  const today = toDateInput(new Date().toISOString());
  const [form, setForm] = useState(() => (isEdit ? formFromTest(test) : { ...EMPTY_TEST_FORM }));
  const [date, setDate] = useState(() => (isEdit ? toDateInput(test.createdAt) : today));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const confirmRef = useRef(null);
  useEffect(() => { if (confirmDelete) confirmRef.current?.scrollIntoView({ block: 'nearest' }); }, [confirmDelete]);

  const fields = testFormFields(saltPool || (isEdit && test.salt != null), saltRange);

  const save = async () => {
    const issue = validateReadings(form);
    if (issue) { setProblem(issue); return; }
    if (!date || date > today) { setProblem('Pick a test date that is today or earlier.'); return; }
    setProblem('');
    setBusy(true);
    try {
      await onSave({
        ...(isEdit ? { id: test.id } : {}),
        ...testFromForm(form),
        createdAt: isoFromDateInput(date, isEdit ? test.createdAt : null),
      });
    } catch (err) {
      setProblem(err?.message || "That didn't save. Check your connection and try again.");
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await onDelete(test); } catch (err) {
      setProblem(err?.message || "That didn't delete. Check your connection and try again.");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="modal-panel modal-panel-tall" role="dialog" aria-modal="true"
           aria-labelledby="te-title" onClick={e => e.stopPropagation()}>
        <div className="modal-title" id="te-title">{isEdit ? 'Edit this test' : 'Add a past result'}</div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          {isEdit
            ? (auditTracked
              ? 'If you change a reading or the date, your record will show it was edited, and keep the readings as first saved.'
              : 'Changes replace the saved readings.')
            : 'Add a result from your pool shop or an old test, with the date it was done.'}
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label" htmlFor="te-date">Date of test</label>
          <input id="te-date" className="input" type="date" max={today} value={date}
                 onChange={e => setDate(e.target.value)} />
        </div>

        <div className="test-editor-grid">
          {fields.map(f => (
            <div key={f.key} className="input-group">
              <label className="input-label" htmlFor={`te-${f.key}`}>{f.label}{f.unit ? ` (${f.unit})` : ''}</label>
              <input id={`te-${f.key}`} className="input" type="number" inputMode="decimal"
                     placeholder={f.placeholder} value={form[f.key]}
                     onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>

        {problem && <p role="alert" className="test-editor-problem">{problem}</p>}

        {confirmDelete ? (
          <div ref={confirmRef} className="callout callout-alert" role="alertdialog" style={{ marginTop: 12 }}>
            <div className="callout-body">
              <strong>Delete this test?</strong> It is removed from your history and can't be brought back.
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep it</button>
                <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>
                  {busy ? 'Deleting…' : 'Yes, delete it'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-actions test-editor-actions">
            {isEdit && (
              <button className="btn btn-ghost btn-sm test-editor-delete" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Delete test
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : (isEdit ? 'Save changes' : 'Add to my record')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
