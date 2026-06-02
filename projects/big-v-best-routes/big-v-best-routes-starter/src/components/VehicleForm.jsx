import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';

export default function VehicleForm({ vehicle, onChangeType, onChangeField }) {
  const template = vehicleTemplates[vehicle.type] || vehicleTemplates.car;

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Modular vehicle input</p>
          <h2>Vehicle legal information</h2>
        </div>
        <span className="badge green">Only relevant fields shown</span>
      </div>

      <label className="field">
        <span>Vehicle type</span>
        <select value={vehicle.type} onChange={(e) => onChangeType(e.target.value)}>
          {Object.entries(vehicleTemplates).map(([key, item]) => (
            <option key={key} value={key}>{item.label}</option>
          ))}
        </select>
      </label>

      <div className="formGrid">
        {template.fields.map((fieldKey) => {
          const field = fieldDefinitions[fieldKey];
          const value = vehicle.fields?.[fieldKey] ?? (field.type === 'checkbox' ? false : '');
          return (
            <label className="field" key={fieldKey}>
              <span>
                {field.label}
                {field.required && <b className="required"> required</b>}
                {field.legalCritical && <b className="critical"> legal-critical</b>}
              </span>
              {field.type === 'select' ? (
                <select value={value} onChange={(e) => onChangeField(fieldKey, e.target.value)}>
                  <option value="">Select...</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChangeField(fieldKey, e.target.checked)} />
              ) : (
                <input type={field.type} min={field.min} step={field.step} value={value} onChange={(e) => onChangeField(fieldKey, field.type === 'number' ? Number(e.target.value) : e.target.value)} />
              )}
              <small>{field.helper}</small>
            </label>
          );
        })}
      </div>
    </section>
  );
}
