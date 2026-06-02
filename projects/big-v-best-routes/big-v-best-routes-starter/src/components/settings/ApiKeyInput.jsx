/**
 * ApiKeyInput.jsx — Secure API key / token input
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Masks saved value. Validates for blocked secrets before save.
 * Never renders the full saved key back.
 */
import { useState } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { guardBeforeSave, maskSecret } from '../../utils/secretGuards.js';

export default function ApiKeyInput({
  id, label, savedValue, onSave,
  placeholder, hint, fieldLabel, disabled,
}) {
  const [draft,    setDraft]    = useState('');
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState(null);
  const [editing,  setEditing]  = useState(false);

  const hasSaved   = !!savedValue;
  const maskedSaved = hasSaved ? maskSecret(savedValue) : '';

  function handleSave() {
    const guard = guardBeforeSave(draft.trim(), fieldLabel || label);
    if (!guard.ok) { setError(guard.error); return; }
    setError(null);
    onSave(draft.trim());
    setDraft('');
    setEditing(false);
  }

  function handleClear() {
    onSave('');
    setDraft('');
    setEditing(false);
    setError(null);
  }

  if (!editing && hasSaved) {
    return (
      <div className="settingsField">
        <label className="settingsLabel">{label}</label>
        <div className="apiKeyDisplay">
          <code className="maskedKey">{maskedSaved}</code>
          <button className="ghost small" onClick={() => setEditing(true)} type="button" disabled={disabled}>Change</button>
          <button className="ghost small danger" onClick={handleClear} type="button" disabled={disabled}>Clear</button>
        </div>
        {hint && <p className="settingsHint">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="settingsField">
      <label htmlFor={id} className="settingsLabel">{label}</label>
      <div className="apiKeyInputRow">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`settingsInput ${error ? 'inputError' : ''}`}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          placeholder={placeholder || 'Paste key here…'}
          disabled={disabled}
          aria-describedby={`${id}-hint ${id}-err`}
          aria-invalid={!!error}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button" className="ghost icon" title={show ? 'Hide' : 'Show'}
          onClick={() => setShow((v) => !v)} tabIndex={-1} disabled={disabled}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button type="button" className="primary small" onClick={handleSave} disabled={disabled || !draft.trim()}>
          Save
        </button>
        {editing && (
          <button type="button" className="ghost small" onClick={() => { setEditing(false); setDraft(''); setError(null); }} disabled={disabled}>
            Cancel
          </button>
        )}
      </div>
      {hint  && <p id={`${id}-hint`} className="settingsHint">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="settingsError" role="alert">
          <ShieldAlert size={13} style={{ display: 'inline', marginRight: 4 }} />
          {error}
        </p>
      )}
    </div>
  );
}
