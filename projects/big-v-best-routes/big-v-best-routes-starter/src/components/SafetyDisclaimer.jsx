import { ShieldCheck, TriangleAlert } from 'lucide-react';

export default function SafetyDisclaimer({ onAccept }) {
  return (
    <div className="disclaimerOverlay">
      <div className="disclaimerCard">
        <div className="disclaimerIcon">
          <ShieldCheck size={36} />
        </div>
        <p className="eyebrow">Safety-critical notice</p>
        <h2>Big V's Best Routes — Advisory Guidance Only</h2>

        <div className="disclaimerBody">
          <p>
            <strong>This app provides advisory route guidance only.</strong> It does not guarantee
            legal route suitability or compliance with traffic law.
          </p>

          <div className="disclaimerWarning">
            <TriangleAlert size={16} />
            <p>
              Road signs, local restrictions, police instructions, and your own driver judgement
              <strong> override all app guidance at all times.</strong>
            </p>
          </div>

          <ul>
            <li>Always verify bridge heights, weight limits, and width restrictions using physical road signs.</li>
            <li>Vehicle dimensions and weights you enter are your responsibility to confirm.</li>
            <li>Restriction data may be incomplete, outdated, or unavailable for some roads.</li>
            <li>The driver remains legally responsible for route legality and vehicle safety.</li>
            <li>Do not use this app as your sole source of route compliance information.</li>
          </ul>
        </div>

        <button className="primary" style={{ width: '100%', justifyContent: 'center', padding: 16 }} onClick={onAccept}>
          <ShieldCheck size={18} /> I understand — continue to Big V's Best Routes
        </button>
      </div>
    </div>
  );
}
