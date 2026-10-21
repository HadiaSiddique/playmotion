import { useState } from 'react';

const STATUS_TEXT = {
  idle: 'Getting ready…',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  open: 'Ready to connect',
  error: 'Connection problem',
};

export default function JoinScreen({ code, link, onSubmit, onPractice }) {
  const [draft, setDraft] = useState(code);
  const joining = Boolean(code) && !link.error;
  const valid = /^\d{6}$/.test(draft);

  return (
    <main className="screen center">
      <div className="brand">
        <span className="logo" aria-hidden="true">●</span> PlayMotion
      </div>
      <h1>Connect to your TV</h1>
      <p className="lead">Enter the 6-digit code shown on your TV. If you scanned the QR code, it's already filled in.</p>

      <form
        className="card join-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(draft);
        }}
      >
        <label htmlFor="code" className="visually-hidden">
          6-digit code
        </label>
        <input
          id="code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus={!code}
        />
        <button className="btn-primary" type="submit" disabled={!valid || joining}>
          {joining ? 'Connecting…' : 'Connect'}
        </button>
        <p className={`status ${link.error ? 'error' : ''}`} role="status">
          {link.error ?? (joining ? 'Connecting to your TV…' : STATUS_TEXT[link.status] ?? '')}
        </p>
      </form>

      <button className="btn-link" onClick={onPractice}>
        Practise without a TV
      </button>
    </main>
  );
}
