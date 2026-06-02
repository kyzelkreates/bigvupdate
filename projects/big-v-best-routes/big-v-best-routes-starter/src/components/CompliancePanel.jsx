export default function CompliancePanel({ compliance, onRunCheck }) {
  return (
    <section className="panel compliancePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Compliance AI</p>
          <h2>Advisory route suitability check</h2>
        </div>
        <button className="primary" onClick={onRunCheck}>Run check</button>
      </div>

      <div className="scoreCard">
        <div>
          <span className="score">{compliance.score}%</span>
          <p>Route confidence score</p>
        </div>
        <span className={`status ${compliance.status}`}>{compliance.status.replaceAll('_', ' ')}</span>
      </div>

      <div className="warningList">
        {compliance.warnings.map((warning) => (
          <article className={`warning ${warning.level}`} key={warning.id}>
            <strong>{warning.title}</strong>
            <p>{warning.detail}</p>
          </article>
        ))}
      </div>

      <div className="evidenceGrid">
        {compliance.evidence.map((item) => (
          <div className="evidence" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <p className="disclaimer">Advisory only. Road signs, local restrictions, police instructions, and driver judgement override app guidance. Big V’s Best Routes does not guarantee legal route certainty.</p>
    </section>
  );
}
