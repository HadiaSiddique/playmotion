// "Place your phone 2-3 metres away" guide with a live full-body check. Closes itself once you're in view.
export default function PlacementGuide({ bodyView, onClose }) {
  return (
    <div className="sheet" role="dialog" aria-labelledby="guide-title">
      <h2 id="guide-title">Set up your phone</h2>
      <svg className="guide-art" viewBox="0 0 320 120" aria-hidden="true">
        <rect x="18" y="52" width="22" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <line x1="10" y1="96" x2="310" y2="96" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
        <line x1="56" y1="70" x2="226" y2="70" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 6" />
        <text x="141" y="60" textAnchor="middle" fill="var(--accent)" fontSize="15" fontWeight="700">2–3 metres</text>
        <circle cx="262" cy="22" r="9" fill="currentColor" />
        <line x1="262" y1="31" x2="262" y2="64" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="262" y1="40" x2="246" y2="56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="262" y1="40" x2="278" y2="56" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="262" y1="64" x2="252" y2="94" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="262" y1="64" x2="272" y2="94" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <ol className="steps">
        <li>Stand your phone upright at about hip height, on a shelf or against some books.</li>
        <li>Step back 2–3 metres, about three big steps.</li>
        <li>Check that your head and feet are both in the picture. For seated moves, head to hands is enough.</li>
        <li>Light in front of you works best. Keep a sturdy chair nearby.</li>
      </ol>
      <p className={`body-check ${bodyView !== 'none' ? 'ok' : ''}`} role="status">
        {bodyView === 'full'
          ? 'Great, your whole body is in view ✓'
          : bodyView === 'upper'
            ? 'Your upper body is in view ✓ Good for seated moves.'
            : 'Waiting to see you…'}
      </p>
      <button className="btn-secondary wide" onClick={onClose}>
        {bodyView !== 'none' ? 'Start' : 'Skip for now'}
      </button>
    </div>
  );
}
