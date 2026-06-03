import { Lock } from 'lucide-react';
import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';

export default function VehicleForm({ vehicle, onChangeType, onChangeField, locked }) {
  const template = vehicleTemplates[vehicle?.type] || vehicleTemplates.car;
  const fields = template.fields || [];

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Modular vehicle input</p>
          <h2>Vehicle legal information</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {locked && (
            <span className="badge danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> Locked
            </span>
          )}
          <span className="badge green">Only relevant fields shown</span>
        </div>
      </div>

      {locked && (
        <p className="disclaimer" style={{ color: 'var(--warning)', marginBottom: 14 }}>
          🔒 Vehicle profile is locked during active navigation. Stop navigation to edit.
        </p>
      )}

      {/* Vehicle type selector */}
      <label className="field">
        <span>Vehicle type</span>
        <select
          value={vehicle?.type || 'car'}
          onChange={(e) => onChangeType(e.target.value)}
          disabled={locked}
        >
          {Object.entries(vehicleTemplates).map(([key, item]) => (
            <option key={key} value={key}>{item.label}</option>
          ))}
        </select>
        <small>
          Changing vehicle type resets field values.{' '}
          {fields.length} field{fields.length !== 1 ? 's' : ''} shown for <strong>{template.label}</strong>.
        </small>
      </label>

      {/* Modular fields — driven entirely by vehicleTemplates config */}
      <div className="formGrid">
        {fields.map((fieldKey) => {
          const field = fieldDefinitions[fieldKey];
          if (!field) return null;

          const rawValue = vehicle?.fields?.[fieldKey];
          const value =
            rawValue !== undefined && rawValue !== null
              ? rawValue
              : field.defaultValue !== undefined
              ? field.defaultValue
              : field.type === 'checkbox'
              ? false
              : '';

          return (
            <label className="field" key={fieldKey}>
              <span>
                {field.label}
                {field.required && <b className="required"> *req</b>}
                {field.legalCritical && <b className="critical"> ⚖legal</b>}
              </span>

              {field.type === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => onChangeField(fieldKey, e.target.value)}
                  disabled={locked}
                >
                  <option value="">Select…</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChangeField(fieldKey, e.target.checked)}
                    disabled={locked}
                    style={{ width: 22, height: 22, margin: 0 }}
                  />
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {Boolean(value) ? 'Yes' : 'No'}
                  </span>
                </div>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(e) =>
                    onChangeField(
                      fieldKey,
                      field.type === 'number'
                        ? e.target.value === ''
                          ? ''
                          : Number(e.target.value)
                        : e.target.value,
                    )
                  }
                  disabled={locked}
                  placeholder={
                    field.unit
                      ? `Enter ${field.unit}`
                      : field.defaultValue !== undefined
                      ? String(field.defaultValue)
                      : ''
                  }
                />
              )}

              <small>{field.helper}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
}
