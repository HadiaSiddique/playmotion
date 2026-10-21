# PlayMotion phone app (camera page)

Vite + React page the TV's QR code opens (`/?code=123456`). MediaPipe PoseLandmarker runs on the phone; only landmark points and rep/form/game/safety events go over the WebSocket. **No video or images are ever sent.**

What it does today:
- Pairing: code auto-filled from the QR link (or typed), "Connected ✓" on the phone; the TV gets `peer.joined`.
- Privacy screen, then a placement guide ("2–3 metres away, full body in frame") with a live full-body check.
- Front/rear camera switch, mirrored skeleton preview, fps readout, screen kept awake, continuous autofocus/exposure where the phone supports it.
- MediaPipe's **full** pose model (9 MB, more reliable at 2–3 m than lite). "Out of view" is only reported after 1.5 s without the needed body parts, so a lost knee for a few frames doesn't trigger a warning; the "step back" cue repeats at most every 15 s.
- Rep counting: **sit to stand**, **arm raises**, **seated arm raises**, and a **30-second chair-stand test**.
- Big **STOP** button, "It hurts" button and (Chrome on Android) saying "stop" pause instantly and tell the TV.
- Practice chips so you can test counting without the TV app.
- **🍽️ Meal tip**: take or choose a photo → it is shrunk on the phone (≤1024 px JPEG, EXIF dropped) → `POST /meal` (Bedrock vision, template fallback) → gentle balance tips, a small swap and a water nudge. No calories unless chosen at onboarding, never weight talk, photo never stored. The tip text is also shown on the TV.

## Run locally (HTTPS on your Wi-Fi)

Phones only allow the camera on HTTPS, so the dev server uses a self-signed certificate (`@vitejs/plugin-basic-ssl`).

```powershell
cd apps\phone
npm install
npm run dev
```

Vite prints a `Network: https://192.168.x.x:5173/` address. Open it on your phone (same Wi-Fi), tap **Advanced → Proceed** on the certificate warning, and allow the camera. If Windows Firewall asks, allow Node.js on private networks.

To pair with a pretend TV (from the repo root, in a second terminal):

```powershell
node scripts\fake-tv.mjs
```

It prints a code and a link. Add `?code=<code>` to your local address, or type the code. Press `1` / `2` / `3` in the fake TV to start sit-to-stand / arm raises / seated arm raises and watch the rep events arrive.

## Deploy (S3 + CloudFront)

```powershell
.\scripts\deploy-phone.ps1
```

## Tests

```powershell
npm test
```

Synthetic-skeleton tests for the rep counters ([test/detectors.test.js](test/detectors.test.js)); no camera needed.

Protocol: [docs/PROTOCOL.md](../../docs/PROTOCOL.md).
