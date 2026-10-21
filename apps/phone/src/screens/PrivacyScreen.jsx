// In the TV app's laptop-camera panel (?embed=1) the camera is the laptop's, so say "device".
const DEVICE = new URLSearchParams(window.location.search).get('embed') === '1' ? 'device' : 'phone';

export default function PrivacyScreen({ connected, onAccept }) {
  return (
    <main className="screen">
      {connected ? <p className="connected-banner">Connected ✓ to your TV</p> : null}
      <h1>Your video stays on this {DEVICE}</h1>
      <div className="card">
        <ul className="checklist">
          <li>The camera picture is turned into 33 dots on your body (your skeleton) right here, on this {DEVICE}.</li>
          <li>Only those dots and your rep counts go to your TV.</li>
          <li>No video or photos of you are recorded, uploaded or stored.</li>
          <li>Tap the big STOP button, or say "stop", any time.</li>
        </ul>
      </div>
      <p className="fineprint">PlayMotion is wellness coaching, not a medical device. If you have a health condition, check with your doctor before starting new exercise.</p>
      <button className="btn-primary wide" onClick={onAccept}>
        Turn on the camera
      </button>
    </main>
  );
}
