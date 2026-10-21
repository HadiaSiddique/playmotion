// Meal photo → gentle balance tips (Amazon Bedrock vision on the backend, template fallback).
// Calorie counting is off unless chosen at onboarding; body-neutral by default. The photo is never stored.
import { useRef, useState } from 'react';
import { postJson } from '../lib/api.js';
import { photoToJpegDataUrl } from '../lib/image.js';

export default function MealSheet({ userId, onResult, onClose }) {
  const input = useRef(null);
  const [state, setState] = useState('pick'); // pick | sending | result | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const send = async (file) => {
    if (!file) return;
    setState('sending');
    setError(null);
    try {
      const image = await photoToJpegDataUrl(file);
      setPreview(image);
      const res = await postJson('/meal', { userId, image });
      setResult(res);
      setState('result');
      if (res.isFood) onResult?.(res);
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  return (
    <div className="sheet" role="dialog" aria-labelledby="meal-title">
      <h2 id="meal-title">Meal tip</h2>

      {!userId ? (
        <p className="muted">Connect to your TV first, so tips can match your food habits.</p>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // so choosing the same photo again still triggers a change
              send(file);
            }}
          />

          {state === 'pick' ? (
            <>
              <p>Take a photo of your meal and get a few gentle ideas for balance.</p>
              <ul className="checklist small">
                <li>Your photo is shrunk on this phone, used once for the tip, and never stored.</li>
                <li>No calorie counting unless you turned it on. We never talk about weight.</li>
              </ul>
              <button className="btn-primary wide" onClick={() => input.current?.click()}>
                📷 Take or choose a photo
              </button>
            </>
          ) : null}

          {state === 'sending' ? (
            <div className="meal-row">
              {preview ? <img className="meal-thumb" src={preview} alt="Your meal" /> : null}
              <p className="muted">Looking at your meal…</p>
            </div>
          ) : null}

          {state === 'result' && result ? (
            result.isFood === false ? (
              <p>{result.message ?? "That doesn't look like a meal. Want to try another photo?"}</p>
            ) : (
              <div className="meal-result">
                <div className="meal-row">
                  {preview ? <img className="meal-thumb" src={preview} alt="Your meal" /> : null}
                  <div>
                    {result.looksLike ? <p className="meal-name">{result.looksLike}</p> : null}
                    {result.positives?.map((p) => (
                      <p key={p} className="meal-good">
                        ✓ {p}
                      </p>
                    ))}
                  </div>
                </div>
                <ul className="meal-tips">
                  {result.tips?.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {result.swap ? <p>🔁 {result.swap}</p> : null}
                {result.waterNudge ? <p>💧 {result.waterNudge}</p> : null}
                {result.calories ? <p className="muted">Rough estimate: {result.calories}</p> : null}
                <p className="fineprint">
                  {result.disclaimer} {result.source === 'ai' ? 'Tips by PlayMotion AI (Amazon Bedrock).' : ''} Also shown on your TV.
                </p>
              </div>
            )
          ) : null}

          {state === 'error' ? <p className="status error">{error}</p> : null}

          {state === 'result' || state === 'error' ? (
            <button className="btn-secondary wide" onClick={() => input.current?.click()}>
              Try another photo
            </button>
          ) : null}
        </>
      )}

      <button className="btn-link" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
