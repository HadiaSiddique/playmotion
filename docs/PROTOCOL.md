# PlayMotion API and WebSocket protocol

IDs for exercises, games, badges and avatars live in [packages/shared/catalog.mjs](../packages/shared/catalog.mjs).
URLs come from `apps/*/.env.local` (written by `scripts/write-env.ps1`).

## WebSocket (pairing + real-time relay)

Connect: `wss://<id>.execute-api.us-east-1.amazonaws.com/prod?role=tv|phone|guest`

| Direction | Message | Reply / effect |
|---|---|---|
| TV → | `{"action":"host","userId":"u_..."}` | `{"type":"paired.code","code":"482913","joinUrl":"https://<cloudfront>/?code=482913"}` → show QR of `joinUrl` + the code |
| TV → (reconnect) | `{"action":"host","userId":"u_...","deviceId":"tv_...","code":"482913"}` | same code back with `"resumed":true,"peers":1` when `userId` or `deviceId` matches the TV that created it |
| phone → | `{"action":"join","code":"482913","role":"phone"}` | phone: `{"type":"joined","code":"482913","userId":"u_..."}`; TV: `{"type":"peer.joined","role":"phone"}` → "Connected ✓" on both |
| any → | `{"action":"relay","type":"rep","payload":{...},"to":"tv"}` | others get `{"type":"event","event":"rep","from":"phone","payload":{...},"t":1729...}` |
| any → | `{"action":"ping"}` | `{"type":"pong"}` (send every ~5 min; idle sockets close after 10 min) |
| server → | `{"type":"peer.left","role":"phone"}` | phone closed / lost connection |
| server → | `{"type":"error","code":"CODE_NOT_FOUND","message":"..."}` | friendly message for the UI |

`to` is optional (`tv`, `phone`, `guest`); default is everyone else in the session. Max message 16 KB, max 6 devices.

### Relay event types

| type | from | payload |
|---|---|---|
| `pose` | phone | `{ "lm": [[x,y,z,visibility], ...33], "ar": 0.75, "mirrored": true }` normalised landmarks (x, y in 0..1 of the picture), ~12 fps, ~1 KB. `ar` = width/height of the camera picture; `mirrored` = front camera (draw it mirrored). Never video. |
| `rep` | phone | `{ "exercise": "sit_to_stand", "count": 7, "formScore": 86 }` |
| `form` | phone | `{ "exercise": "arm_raise", "cue": "arms_higher", "severity": "tip" }` (cue IDs = keys of `CUE_LINES.coach`: `slow_down`, `stand_tall`, `arms_higher`, `step_in_frame`, …) |
| `game` | phone | `{ "kind": "signal", "exercise": "arm_raise", "signal": 0.62 }` at 5 Hz: 0 = rest position, 1 = top of the move (drives the TV game between reps). Holds (`balance_hold`, `seated_tall_hold`) send `{ "kind": "balance", "holding": true, "seconds": 12, "wobble": 0.3 }` instead, and their `rep` events count whole seconds held. `{ "kind": "chair_stand_result", "exercise": "sit_to_stand", "stands": 11, "seconds": 30 }` when the phone-run chair-stand test ends. |
| `safety` | either | `{ "kind": "stop" \| "pain", "source": "voice" \| "tap" \| "remote", "exercise": "..." }` → pause instantly, offer seated version. Phone follow-ups: `"ok"` (carry on), `"seated_switch"` (now tracking the seated version, `exercise` = new ID), `"end"` (end for today). |
| `control` | TV | `{ "cmd": "start", "exercise": "sit_to_stand", "seated": false, "target": 10 }`, `{ "cmd": "pause" \| "resume" \| "end" }`. With `seated: true` the phone tracks the catalog's `seatedAlt`. |
| `mood` | phone | `{ "when": "before" \| "after", "mood": 4, "energy": 3 }` |
| `meal` | phone | `{ "looksLike": "Rice and daal", "positives": [...], "tips": [...], "swap": "...", "waterNudge": "..." }` tip text only, shown as a pop-up on the TV. Never the photo. |
| `status` | phone | `{ "camera": "ready", "facing": "user" }` once the model is loaded; `{ "inFrame": false }` / `{ "inFrame": true }` when the person leaves/enters the picture during an exercise |
| `hello` | TV | `{ "userId": "u_..." }` lets the phone know the user after onboarding (if it paired before onboarding) |

Phone counting today: `sit_to_stand`, `chair_stand_test`, `arm_raise`, `seated_arm_raise`, `breathing` (slow arm raises), `squats`, `frog_jump`, `jumping_jacks`, `star_jumps`, `seated_arm_jacks`, `punches`, `seated_punches`, `standing_march` / `bear_steps` (knee lifts), `side_steps` / `crab_walk` (sideways steps), and holds `balance_hold`, `flamingo_balance`, `seated_tall_hold`. For other exercises the phone reports `supported: false` and the TV offers a "+1" remote button.

## HTTP API

Base: `https://<id>.execute-api.us-east-1.amazonaws.com`. JSON in, JSON out. Errors: `{ "error": "CODE", "message": "friendly text" }`.
Every response that uses AI says `"source": "ai" | "template"`.

| Route | Body / query | Returns |
|---|---|---|
| `GET /health` | | `{ ok }` |
| `POST /onboard` | `{ userId?, timezone, country?, answers: {who, goal, mobility, painAreas[], activityLevel, food:{mealsPerDay, sugaryDrinks, eatingOut}, sleep, mood, sessionMinutes, language, shareWith, displayName?, reminderTime, waterReminders, calorieCounting, bodyNeutral}, kid?: {nickname, avatar, ageBand?, parentPin} }` | `{ userId, profile, plan: {mode, week[7], explanation{summary, why[], swaps[], firstCoachLine, source}, safetyNotes[], nutrition}, reminders }` |
| `GET /plan?userId=` | | home dashboard: `{ profile, plan, today, checkedInToday, progress{xp, level, streak, badges, garden, stars, stickers}, notices[] }` |
| `POST /checkin` | `{ userId, mood 1-5, energy 1-5, sleep 1-5, pain?, painAreas?, note?, withVoice? }` | `{ safety:{level:'ok'\|'gentle'\|'support', helplines?...}, today:{game, minutes, intensity, exercises[{id,target}], adapted}, coach:{line, audioUrl} }` |
| `POST /session/complete` | `{ userId, game, durationSec, exercises:[{id, reps, seconds, formScore}], moodBefore, moodAfter, energyBefore, energyAfter, balanceSeconds?, fallTest?:{type:'chair_stand_30s', stands}, stoppedEarly?, stopReason? }` | `{ gained:{xp, level, levelUp, streak, newBadges[], gardenStage, moodLift, sticker}, progress, celebration:{line, audioUrl}, sharedWithFamily }` |
| `GET /report?userId=&voice=1` | | `{ stats:{activeMinutes, whoPercent, moodLift, byDay[7], chairStand{latest, change, history[]}, ...}, summary, audioUrl }` |
| `POST /report/share` | `{ userId }` | `{ shared }` (SNS email to the family circle) |
| `POST /meal` | `{ userId, image: base64 or data URL (≤1024 px JPEG), mediaType? }` | `{ isFood, looksLike, positives[], tips[], swap, waterNudge }` (photo never stored) |
| `GET /family?userId=` | | `{ familyEnabled, members[], feed[] }` |
| `POST /family` | `{ userId, name, relation?, email?, isMe? }` | `{ member, note }` (email gets an AWS confirmation link) |
| `POST /tts` | `{ userId, text ≤600, style:'coach'\|'calm'\|'kids', language? }` | `{ url, text }` (`url:null` → use on-device TTS) |
| `GET /voice/pack?style=coach` | | `{ cues: { great_rep: {text, url}, ... } }` — preload at session start |
| `POST /story` | `{ userId, game, chapter 0-4 }` | `{ text, audioUrl, move, lastChapter }` (kids profiles only) |
| `POST /kids/verify-pin` | `{ userId, pin }` | `{ ok, attemptsLeft }` (locks for 5 min after 5 wrong tries) |
