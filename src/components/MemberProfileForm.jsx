import { useRef, useState } from 'react';
import { MEMBER_LIMITS, memberFormFromRow, validateMemberProfile } from '../lib/memberProfile.js';
import styles from './MemberProfileForm.module.css';

const FIELD_IDS = {
  firstName: 'member-first-name',
  lastName: 'member-last-name',
  address: 'member-address',
  suburb: 'member-suburb',
  postcode: 'member-postcode',
};

function TextField({
  id,
  name,
  label,
  flag,
  value,
  onChange,
  autoComplete,
  inputMode,
  maxLength,
  error,
  describedBy,
}) {
  const errorId = `${id}-error`;
  const described = [describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="input-group">
      <div className={styles.labelRow}>
        <label className="input-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        <span className={flag === 'Required' ? styles.required : styles.optional}>{flag}</span>
      </div>
      <input
        id={id}
        name={name}
        className={error ? `input ${styles.invalid}` : 'input'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={flag === 'Required' ? 'true' : 'false'}
        aria-describedby={described}
        required={flag === 'Required'}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">{error}</p>
      )}
    </div>
  );
}

export default function MemberProfileForm({ initial, onSave }) {
  const [form, setForm] = useState(() => ({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    address: initial?.address ?? '',
    suburb: initial?.suburb ?? '',
    postcode: initial?.postcode ?? '',
  }));
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const setField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setSaved(false);
    setError((current) => (current?.field === key ? null : current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    const problem = validateMemberProfile(form);
    if (problem) {
      setError(problem);
      setSaved(false);
      document.getElementById(FIELD_IDS[problem.field])?.focus();
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const savedRow = await onSave(form);
      if (savedRow && typeof savedRow === 'object') {
        setForm(memberFormFromRow(savedRow));
      }
      setSaved(true);
    } catch (err) {
      console.error('Failed to save profile details:', err);
      setSaved(false);
      if (err?.field) {
        setError({ field: err.field, message: err.message });
        document.getElementById(FIELD_IDS[err.field])?.focus();
      } else {
        setError({ field: 'form', message: "Couldn't save your details. Try again." });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const messageFor = (field) => (error?.field === field ? error.message : '');

  return (
    <form className="card-section" onSubmit={handleSubmit} noValidate autoComplete="on">
      <input type="hidden" name="country" autoComplete="country" value="AU" readOnly />
      <div className="eyebrow" style={{ marginBottom: 12 }}>Your details</div>
      <p id="member-details-hint" className={styles.hint}>
        Add your postcode so local tips can use it later, like heavy rain where you live.
        First name, last name, address, and suburb can be left blank.
      </p>

      <TextField
        id={FIELD_IDS.firstName}
        name="given-name"
        label="First name"
        flag="Optional"
        value={form.firstName}
        onChange={setField('firstName')}
        autoComplete="given-name"
        maxLength={MEMBER_LIMITS.firstName}
        error={messageFor('firstName')}
      />
      <TextField
        id={FIELD_IDS.lastName}
        name="family-name"
        label="Last name"
        flag="Optional"
        value={form.lastName}
        onChange={setField('lastName')}
        autoComplete="family-name"
        maxLength={MEMBER_LIMITS.lastName}
        error={messageFor('lastName')}
      />
      <TextField
        id={FIELD_IDS.address}
        name="street-address"
        label="Address"
        flag="Optional"
        value={form.address}
        onChange={setField('address')}
        autoComplete="street-address"
        maxLength={MEMBER_LIMITS.address}
        error={messageFor('address')}
      />
      <TextField
        id={FIELD_IDS.suburb}
        name="address-level2"
        label="Suburb"
        flag="Optional"
        value={form.suburb}
        onChange={setField('suburb')}
        autoComplete="address-level2"
        maxLength={MEMBER_LIMITS.suburb}
        error={messageFor('suburb')}
      />
      <TextField
        id={FIELD_IDS.postcode}
        name="postal-code"
        label="Postcode"
        flag="Required"
        value={form.postcode}
        onChange={setField('postcode')}
        autoComplete="postal-code"
        inputMode="numeric"
        maxLength={8}
        error={messageFor('postcode')}
        describedBy="member-details-hint"
      />

      {error?.field === 'form' && (
        <p className={styles.formError} role="alert">{error.message}</p>
      )}

      <div className={styles.actions}>
        {saved && <p className={styles.saved} role="status">Saved</p>}
        <button type="submit" className={`btn btn-primary ${styles.save}`} disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}
