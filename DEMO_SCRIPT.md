# PlayMotion demo script (2:45)

The story: one family, one TV. A grown-up who wants to get stronger, a parent who needs to stay steady on their feet, a low day that the coach notices, and a child who just wants to play.

Record each scene separately and cut them together. Every scene below is short on purpose; the voice-over (VO) lines fit the times given if read at a relaxed pace.

## Before you record

**Accounts and services**
- [ ] AWS is signed in and the backend is live. In PowerShell, from the project folder: `aws sts get-caller-identity` (it should print your account, not "session has expired").
- [ ] The phone page opens: `https://dtpn7hdiphoh4.cloudfront.net`.
- [ ] The TV app is running: `yarn.cmd tv:web` (open `http://localhost:8082`), or on the Android TV emulator: `yarn.cmd tv:android` [verify: emulator not yet tested].

**Sound and camera**
- [ ] Laptop **not muted**, volume about 70%. Each voice line is generated once and then cached, so play every scene through once before recording.
- [ ] Phone: on a stand, upright, 2–3 m away, at about hip height, so head to feet are in the picture. Good light in front of you, not behind.
- [ ] Laptop camera instead of a phone: tilt the screen back, stand 2–3 m away, and press ⤢ until the camera box is big enough to see your feet.
- [ ] Chrome asked for the microphone and you clicked **Allow** (needed for saying "stop").

**Profiles** (each scene needs its own profile because the daily check-in happens once a day; use a normal Chrome window, an Incognito window and a second browser profile)
- [ ] **Adult** ("Hadia", Fit mode, no pain): for scenes 1–3.
- [ ] **Low day** (any adult): for scenes 4–5.
- [ ] **Steady** (Senior, "I hold a chair for support"): for scene 6.
- [ ] **Child** (nickname "Rocket", fox avatar, parent PIN): for scene 7.
- [ ] One finished session on the adult profile before recording, so the weekly report has data.

**Backup**: if the camera misbehaves on the day, pair a pretend phone instead: `node scripts\fake-phone.mjs <code>` (it does real-looking reps). Use it only for B-roll; show the real camera in at least scenes 3 and 6.

## Shot list

| Time | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00–0:10 | **Hook** | Title card "PlayMotion", then the Home screen with the colourful *All workouts* row. | "Nearly one in three adults doesn't move enough, and falls kill 684,000 people a year. PlayMotion turns the TV you already own into a coach, and every workout into a game." |
| 0:10–0:25 | **1. Onboarding** | With the remote: *Who will be exercising? → Adult*, goal *Get stronger*, pain *No pain*, type the name on the on-screen keyboard, pick *Español* or *English*. Show the **"Your plan is ready"** reveal with the reasons. | "Setup takes a minute with the remote. PlayMotion asks about goals, mobility, pain, sleep and mood, and builds a plan that explains itself. Safety rules decide the moves; AI only writes the words." |
| 0:25–0:38 | **2. Pairing** | TV shows the QR code. Phone scans it → privacy screen ("Your video stays on this phone") → **Connected ✓** on both. Quick cut: the *💻 Use this laptop's camera* button. | "Scan the code and your phone becomes the camera. Pose tracking runs on the phone, so only 33 body points reach the TV, never video. No phone? Use the laptop's webcam." |
| 0:38–1:05 | **3. Boss Battle** | Intro card: the animated **demo coach** shows squats and "Stand 2–3 m from the camera". Do squats: count goes up, each rep hits the Couch Monster, combo ×3, voice *"Halfway there! You're crushing it!"*. Do two squats very fast on purpose → form cue *"Nice and slow. Control the move."* (text and voice). Say **"stop"** → game pauses, voice offers the seated version → *Resume*. | "Every rep the phone counts lands a hit. The demo coach shows the move, the voice cheers you on and corrects form. And at any moment, saying 'stop' or reporting pain pauses everything and offers a seated version." |
| 1:05–1:15 | **4. Low-mood check-in** | Low-day profile: check-in mood *Low*, energy *Low*. The coach answers out loud and today's plan changes to **Calm River, 5 min**. Point at *🎯 Choose something else*. | "Before each session, a 10-second check-in. On a low day the coach doesn't push. It offers five calm minutes, but you can still choose." |
| 1:15–1:35 | **5. Calm River → mood lift** | Breathing ring (4 s in, 6 s out), arms float up and down, the boat drifts to the calm lake. After: *How do you feel now?* → *Good* → results with the **Mood lift** bars (before vs after). | "Calm River paces your breathing with gentle arm moves, with no score and no way to fail. Afterwards PlayMotion shows the mood lift, the reason to come back tomorrow." |
| 1:35–1:55 | **6. Balance Bridge + chair-stand test** | Steady profile: lift one foot, the character walks across the bridge and wobbles when you sway. Then the **30-second chair-stand test** counts stands, and the results show the **chair-stand trend**. | "For older adults: Balance Bridge trains balance, and a 30-second chair-stand test, a standard check of leg strength, tracks progress week by week." |
| 1:55–2:15 | **7. Kids: Jungle Quest** | Child profile (show the parent PIN for a second). Narrator reads chapter 1 with the child's nickname; frog jumps move the fox across the jungle map; a star; at the end the **sticker book**. *"Make sure a grown-up is nearby"* is visible. | "Kids get story games read by a narrator. Parents set it up with a PIN; we keep a nickname and an avatar, and nothing else. No ads, no chat." |
| 2:15–2:30 | **8. Weekly report** | Adult profile: *📊 Weekly report*: active minutes vs the WHO's 150, minutes per day, mood before vs after, food swaps; the summary is read aloud. Scroll down to show the whole page. | "Every week, a plain-language report: minutes against the WHO's 150, mood lift and streak, read aloud in your own language." |
| 2:30–2:40 | **9. Meal photo tip** | Phone: *🍽️ Meal tip* → take a photo of a plate → gentle tips on the phone, and the **"Meal tip from your phone"** pop-up on the TV. | "Snap a meal and get gentle balance tips, with no calorie counting unless you ask, no weight talk, and the photo is never stored." |
| 2:40–2:45 | **Close** | Home screen, then end card: "PlayMotion · Built on AWS: Bedrock, Polly, Lambda, API Gateway, DynamoDB, EventBridge, SNS, S3, CloudFront". | "PlayMotion. Move a little, every day, together." |

## Tips
- Record the TV screen with OBS or the Xbox Game Bar (Win + G); record the phone with its own screen recorder and show it picture-in-picture for pairing and the meal tip.
- Keep the remote/keyboard visible or add on-screen captions such as "Remote: OK".
- If a voice line plays late the first time, record that scene again: the second time it plays from the cache instantly.
- Captions: burn in the VO as subtitles; judges often watch muted.
