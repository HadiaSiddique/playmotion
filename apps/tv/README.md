# PlayMotion TV app (Fire TV / Android TV)

Forked from Amazon's [react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (`apps/expo-multi-tv`, Expo SDK 54, react-native-tvos). See [UPSTREAM.md](UPSTREAM.md) for the exact commit. The sample's shared screens, navigation and remote-control handling live in [packages/shared-ui](../../packages/shared-ui/src); PlayMotion code is in [packages/shared-ui/src/movewell](../../packages/shared-ui/src/movewell).

## What's here today
- **Onboarding** (first launch): 15 questions answered with the remote (who, goal, mobility, pain, activity, food habits, sleep, mood, session length, coach language, name, sharing, reminder time), plus a **Kids** branch (hero nickname, avatar, parent PIN). Optional questions have a **Skip** button (the backend fills a sensible default; reminders can be turned off). The name is typed on an on-screen keyboard with the remote, or on a laptop keyboard. Calls `POST /onboard` and shows **"Your plan is ready"**: mode, reasons, the week of games, safety notes.
- **Coach languages**: English, Hindi/Urdu (Hindi written in Devanagari, read by Polly's Kajal voice, understood by Urdu speakers), Spanish and Arabic. The voice, in-game cues, check-in and celebration lines and the weekly summary are translated; screens stay in English. Kids mode is English only.
- **Demo coach**: an animated figure shows every move during its intro (big, with "stand 2–3 m from your phone" and what must be in the picture), then stays small next to your live skeleton ("Coach" and "You") while you move. Built from plain Views with keyframes, no video or SVG ([DemoCoach.tsx](../../packages/shared-ui/src/movewell/DemoCoach.tsx)).
- **Laptop camera (no phone needed)**: in a browser, **💻 Use this laptop's camera** (Home, pairing screen, a game's connect screen, or the **📷 Laptop camera** button that stays in the corner) opens the camera page in a panel, already paired. Pose detection runs inside that panel exactly as on a phone, so video never leaves the laptop. Drag it anywhere by its title bar (the spot is remembered; ↺ puts it back), ⤢ resizes, ✕ closes. During games it sits in the "You" spot next to the demo coach. Not shown on a real TV.
- **Say "stop"**: in a browser the TV page itself listens (Chrome/Edge), in the coach language, and shows whether it is listening or needs the microphone allowed. "Stop" pauses; "it hurts" pauses with the seated option. The phone page listens too (except inside the laptop panel, where two listeners would fight over the mic).
- **🎯 Choose my workout** (Home, and after the check-in): any game or just one move instead of the recommendation (⭐). Choices are filtered like planned sessions (seated when needed, nothing that loads a sore joint, no jumping for older adults); the check-in still screens mood and pain first.
- **Fits any browser window**: screens scroll when the window is shorter than a TV (the weekly report especially).
- **Demo gallery**: `http://localhost:8082/?demo-gallery` shows every demo-coach move at once (for checks and screenshots).
- **Voice cues don't nag**: "step back" is spoken at most every 20 s and the same form tip at most every 10 s; the text stays on screen.
- **Home**: greeting, streak, level/XP, weekly garden, badges, today's session (adapted to the check-in), the modes (Steady, Fit, Calm, Recover; Kids for kid profiles), phone status, "Start over".
- **Daily check-in**: mood, energy, sleep, pain → `POST /checkin` → coach line (Polly voice) and today's adapted session. Very low mood / worrying answers → calm **support screen** with helplines and a 2-minute **breathing circle**.
- **Boss Battle** (first game): connect phone → how-to + countdown per move → every rep counted on the phone hits the **Couch Monster** (HP bar, damage numbers, combo ×5, power score, voice cues) → pause menu (Back key, STOP/pain from the phone: resume, seated version, skip, end) → mood/energy after → `POST /session/complete` → results with XP, streak, badges, garden and the **mood-lift graph**.
- **Calm River** (Calm mode; low-mood check-ins route here): a boat drifts to a calm lake as you breathe; a pacing ring (4 s in, 6 s out) guides slow arm raises, soft calm-voice cues, no fail state.
- **Balance Bridge** (Steady mode): hold one foot up to walk across a rope bridge (wobble shakes it, foot down pauses), sit-tall hold for seated users, then the **30-second chair-stand test** (skipped for knee/hip pain). Results show the chair-stand trend from `GET /report`.
- **Jungle Quest** (Kids mode): a 5-chapter story narrated by Polly's child voice (`POST /story`; the nickname is filled in on the server, never sent to the model). Frog jumps → flamingo balance → bear stomps → crab steps walk the child's avatar across a jungle map to the treasure; a star at each stop, a new sticker and the sticker book at the end; grown-up-nearby reminder throughout. All five chapters are fetched up front so each starts instantly. Seated children get arm-based versions of each chapter.
- **Weekly report** (Home → 📊): `GET /report` summary (Bedrock, template fallback) read aloud by Polly; active minutes vs the WHO's 150 a week; minutes per day with a 21-min/day line; mood before → after per day (colours validated for colour-blind and normal vision on the dark surface, plus legend and direct labels); chair-stand trend or food swaps; **Share with family** (`POST /report/share`, when a family circle exists). Kids profiles get a **Parent view**: minutes moved, stars, sticker book.
- **Meal tips on the TV**: when the phone gets a meal-photo tip, the tip text (never the photo) pops up on the TV for 20 seconds over any screen.
- **Pairing screen**: QR + code, Connected ✓, live skeleton, rep test buttons.
- The user id is saved on the device (AsyncStorage); voice lines play with expo-audio on TV and the Audio element on web.
- **Pop the Bubbles**: one bubble per rep; the next bubble swells as you reach (live signal) and pops with a sparkle.
- **Garden Grow**: one plant per move; each rep rains on it and it grows from seed to sunflower.
- **Freeze Dance** (kids, narrated): a disco floor flashes while you dance, then "FREEZE!" and the phone counts seconds held still (new `freeze` detector). No music, so no copyright issues.
- **Floor Is Lava** (kids, narrated): side-steps and small soft hops move the avatar from stone to stone to the cool river.
- **Home**: a hero card for today's recommendation in the game's colour, plus an **All workouts** row: every game one click away (⭐ = recommended). All moves pass one shared safety filter (seated when needed, sore joints, no jumping for seniors, "Full body" aches = gentlest, low impact).
- **Look**: gradient backdrop with soft glows, glassy cards, gradient focus states, coloured game tiles (CSS gradients: `backgroundImage` on web, `experimental_backgroundImage` on react-native-tvos 0.81).

## One-time setup (Windows)

1. Move the repo to a **short path** such as `C:\dev\movewell`. Android native builds fail on Windows when paths get longer than 260 characters.
2. Yarn 4 through Corepack (bundled with Node 22). This puts the `yarn` command in your npm folder, so no admin rights are needed:
   ```powershell
   corepack enable --install-directory "$env:APPDATA\npm"
   ```
3. Android Studio's Java and SDK for this terminal session (adjust the paths if you installed elsewhere):
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
   ```
4. From the repo root:
   ```powershell
   yarn install
   ```
5. Backend URLs: `scripts\write-env.ps1` (run by `deploy.ps1`) writes `apps/tv/.env.local` with `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL` and `EXPO_PUBLIC_PHONE_URL`. Restart Metro after it changes.

## Run on the Android TV emulator

Start the emulator from Android Studio (Device Manager), then from the repo root:

```powershell
yarn tv:android
```

The first build takes several minutes. After that, `yarn tv` starts Metro only (press `a` to open on the emulator).

Quick check without the emulator: `yarn tv:web` opens the same app in a browser at http://localhost:8082 (use arrow keys + Enter as the remote).

## Test the full loop
1. TV shows the QR + code.
2. Phone: scan the QR (or open the phone link and type the code) → both show **Connected ✓**.
3. On the TV, choose **Test sit to stand** with the remote. Do a few stands: the count, form score and skeleton update on the TV.
4. Tap **STOP** on the phone: the TV shows the alert; **Resume** on the TV continues.

Protocol: [docs/PROTOCOL.md](../../docs/PROTOCOL.md).
