// Shown after STOP / "It hurts" (tap or voice) or when the TV pauses. The TV gets the same safety event.
const COPY = {
  stop: { title: 'Paused', text: 'Take a breath. You did well.' },
  pain: {
    title: "Let's stop that move",
    text: "Your comfort comes first. If the pain doesn't settle, please talk to a health professional.",
  },
  tv: { title: 'Paused on your TV', text: 'Carry on from the TV when you are ready.' },
};

export default function PauseSheet({ kind, canGoSeated, onResume, onSeated, onEnd }) {
  const copy = COPY[kind] ?? COPY.stop;
  return (
    <div className="sheet pause" role="alertdialog" aria-labelledby="pause-title">
      <h2 id="pause-title">{copy.title}</h2>
      <p>{copy.text}</p>
      {kind !== 'tv' && (
        <div className="sheet-actions">
          {canGoSeated && (
            <button className="btn-primary wide" onClick={onSeated}>
              Try the seated version
            </button>
          )}
          {kind === 'stop' && (
            <button className="btn-secondary wide" onClick={onResume}>
              I'm okay, carry on
            </button>
          )}
          <button className="btn-link" onClick={onEnd}>
            End for today
          </button>
        </div>
      )}
    </div>
  );
}
