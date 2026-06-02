/**
 * EndpointInput.jsx — URL endpoint input with validation
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 */
import { useState, useEffect } from 'react';
import { validateUrl } from '../../utils/urlValidators.js';

export default function EndpointInput({
  id, label, value, onChange, placeholder,
  hint, disabled, required, allowMapbox = false,
}) {
  const [touched, setTouched] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!touched || !value) { setError(null); return; }
    const { valid, error: e } = validateUrl(value, { allowMapbox });
    setError(valid ? null : e);
  }, [value, touched, allowMapbox]);

  return (
    <div className="settingsField">
      <label htmlFor={id} className="settingsLabel">
        {label}
        {required && <span className="requiredMark" aria-hidden>*</span>}
      </label>
      <input
        id={id}
        type="url"
        className={`settingsInput ${error ? 'inputError' : ''}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder || 'https://...'}
        disabled={disabled}
        aria-describedby={`${id}-hint ${id}-err`}
        aria-invalid={!!error}
      />
      {hint && <p id={`${id}-hint`} className="settingsHint">{hint}</p>}
      {error && <p id={`${id}-err`}  className="settingsError" role="alert">{error}</p>}
    </div>
  );
}
