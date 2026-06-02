import { ShieldCheck, ShieldAlert, ShieldX, Info, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const STATUS_META = {
  appears_suitable: { icon: CheckCircle,  color: 'var(--green)',   label: 'Appears suitable' },
  needs_review:     { icon: AlertTriangle, color: 'var(--warning)', label: 'Needs review' },
  high_risk:        { icon: ShieldAlert,   color: 'var(--danger)',  label: 'High risk' },
  missing_data:     { icon: ShieldX,       color: 'var(--danger)',  label: 'Missing data' },
  blocked:          { icon: ShieldX,       color: 'var(--danger)',  label: 'Blocked' },
};

export default function CompliancePanel({ compliance, onRunCheck, locked }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const meta = STATUS_META[compliance?.status] || STATUS_META.needs_review;
  const StatusIcon = meta.icon;

  return (
    <section className="panel compliancePanel" style={{ marginTop: 18 }}>
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Compliance AI</p>
          <h2>Advisory route suitability</h2>
        </div>
        <button className="primary" onClick={onRunCheck} disabled={locked}>
          <ShieldCheck size={16} /> Run check
        </button>
      </div>

      {/* Score card */}
      <div className="scoreCard">
        <div>
          <span className="score" style={{ color: scoreColor(compliance.score) }}>
            {compliance.score}%
          </span>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>Route confidence score</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={`status ${compliance.status}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusIcon size={14} />
            {meta.label}
          </span>
          {compliance.dataFreshness && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Data: {compliance.dataFreshness}
            </span>
          )}
          {compliance.lastCheckedAt && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Checked {new Date(compliance.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Plain-English explanation */}
      {compliance.explanation && (
        <div style={{
          border: '1px solid var(--line)',
          borderLeft: `4px solid ${meta.color}`,
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 12,
          background: 'rgba(0,0,0,.15)',
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          <Info size={13} style={{ display: 'inline', marginRight: 6, color: meta.color }} />
          {compliance.explanation}
        </div>
      )}

      {/* Warnings list */}
      <div className="warningList">
        {(compliance.warnings || []).map((warning) => (
          <article className={`warning ${warning.level}`} key={warning.id}>
            <strong>{warning.title}</strong>
            <p>{warning.detail}</p>
          </article>
        ))}
      </div>

      {/* Missing data toggle */}
      {compliance.missingData?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            className="ghost"
            style={{ width: '100%', justifyContent: 'space-between', fontSize: 13 }}
            onClick={() => setShowMissing((v) => !v)}
          >
            <span>Missing data ({compliance.missingData.length})</span>
            {showMissing ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showMissing && (
            <ul style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0 0', paddingLeft: 18 }}>
              {compliance.missingData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Evidence toggle */}
      {compliance.evidence?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            className="ghost"
            style={{ width: '100%', justifyContent: 'space-between', fontSize: 13 }}
            onClick={() => setShowEvidence((v) => !v)}
          >
            <span>Evidence ({compliance.evidence.length})</span>
            {showEvidence ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showEvidence && (
            <div className="evidenceGrid" style={{ marginTop: 8 }}>
              {compliance.evidence.map((item) => (
                <div className="evidence" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mandatory disclaimer — always visible */}
      <p className="disclaimer" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {compliance.disclaimer ||
          "Big V's Best Routes provides advisory route guidance only. It does not guarantee legal route suitability. " +
          "Road signs, local restrictions, police instructions, and driver judgement override app guidance. " +
          "The driver remains responsible for route legality and vehicle safety."}
      </p>
    </section>
  );
}

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}
