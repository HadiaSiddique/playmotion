# PlayMotion: AI Movement Games for Whole Family on your TV

**Elevator pitch (Devpost, 200 max):** Nearly 1 in 3 adults doesn't move enough. PlayMotion turns your TV into an AI coach: your phone tracks your body, every rep powers a game, and video never leaves your phone. *(173 characters)*

**Tagline:** An AI health coach that turns every workout into a game on your TV. Your phone (or laptop) is the camera; the TV is the coach and the game.

**Track:** Fire TV · AWS Builder mini challenge

> Items marked **[verify]** must be checked before submitting. Every other number in this file comes from the sources listed under "Sources", or is a count from our own code.

---

## Inspiration

Falls are the second leading cause of unintentional injury deaths worldwide [verify]: **684,000 people die from falls every year** (WHO). Yet **31% of adults and about 80% of adolescents are not active enough** (WHO). The fix is well known. **Exercise cuts falls in older people by 23%** (Cochrane, 2019), and **walking, yoga and strength training reduce depression** (BMJ, 2024). The hard part is doing it, at home, every day.

Games help. People who trained with **exergames were 25% less likely to fall than with usual care** (JMIR Aging, 2026). **Gamification adds about 1,600 steps a day** (JMIR, 2022). **Exergames improve children's balance and motor skills** (PLOS ONE, 2024). And short is fine: **"exercise snacks" of 5 minutes or less reached 91% adherence** (BJSM, 2025).

Most homes already have the two things a coach needs: a big screen everyone can see, and a phone with a good camera. We wanted one app that works for the whole family: a parent who needs to stay steady on their feet, an adult who wants to get stronger, someone having a low day, and a child who just wants to play.

## What it does

**Set up in a minute, with the remote.** Onboarding asks who is exercising (adult, senior or child), goal, mobility (standing, holding a chair, seated, wheelchair), pain areas (including "full body"), activity, food habits, sleep, mood, session length, coach language and reminders. Optional questions can be skipped. PlayMotion builds a week of games and explains *why* ("We left out moves that load your knees").

**Scan and play.** The TV shows a QR code; the phone opens the camera page (no app to install) and both show **Connected ✓**. Pose tracking (MediaPipe) runs **on the phone**: only 33 body points and rep counts reach the TV, **never video**. No phone? In a browser, **"Use this laptop's camera"** opens the same camera page in a movable panel.

**Nine games, all driven by your body:**
- **Boss Battle** (Fit): squats, punches and jumping jacks hit the Couch Monster, with combos and a "power" score instead of calories.
- **Pop the Bubbles**: reach up and out; the next bubble swells as you reach and pops on each rep.
- **Garden Grow**: every rep waters a plant until it blooms. There's no way to fail.
- **Balance Bridge** (Steady): hold your balance to walk across; sway makes the bridge wobble. Ends with the **30-second chair-stand test** and a weekly trend.
- **Calm River** (Calm): a breathing ring (4 s in, 6 s out) and slow arm moves guide a boat to a calm lake. No score.
- **Kids** (5–12): story games read by a narrator, **Jungle Quest**, **Freeze Dance** (dance, then freeze like a statue; the phone checks you're still) and **Floor Is Lava**, plus **Superhero Training**, where punches and squats unlock powers. Kids earn stars and stickers.

**A coach, not just a counter.**
- An animated demo coach shows every move first, then stays next to your live skeleton.
- Form cues (for example "Nice and slow") appear on screen and are spoken in a lively voice.
- XP, levels, streaks, a weekly garden and gentle badges.
- The coach speaks **English, Hindi/Urdu, Spanish or Arabic**.

**It adapts every day.**
- **Check-in:** a 10-second check-in (mood, energy, sleep, pain) adjusts the session. A low day becomes 5 calm minutes; a good day gets a little harder; pain switches to seated moves.
- **Your choice:** the coach recommends, but **🎯 Choose my workout** lets you pick any game or a single move.
- **Safety still applies:** every option goes through the same safety rules.

**It shows progress.**
- **Mood lift:** a before/after mood graph after each session.
- **Weekly report:** a plain-language summary, read aloud, with:
  - active minutes against the WHO's 150 a week
  - minutes per day and mood before vs after
  - chair-stand trend
  - small food swaps that fit your habits

**Meal tips.** Photograph a meal on the phone and get gentle balance tips (Bedrock vision). No calorie counting unless you turn it on, no weight talk, and the photo is never stored. The tip also pops up on the TV.

**Reminders and family.** EventBridge Scheduler sends session and water reminders. An SNS family circle can get "Ammi finished today's PlayMotion session ✓", plus a gentle alert after 3 days without a session (backend built; the TV screen for managing family members is next).

### Safety by design
- **"Stop" pauses everything.** Saying **"stop"**, tapping STOP or reporting pain pauses immediately and offers a seated version.
- **Rules choose the moves.** A rule engine decides every exercise from mobility, age and pain; AI only writes the words.
- **Low days get support, not a workout.** Very low mood or worrying answers lead to a calm support screen with helplines: "PlayMotion is not therapy."
- **Kids' privacy.** A parent PIN; only a nickname and an avatar are stored; no ads, no chat; safe moves only (no flips or high jumps); a reminder that a grown-up should be nearby.
- **Clear limits.** "Wellness coaching, not a medical device" appears on onboarding; a privacy screen explains that video stays on the phone.

## How we built it

```
TV (Fire TV / Android TV / browser)          Phone (browser, no install)
React Native for TV + Expo SDK 54           Vite + React + MediaPipe PoseLandmarker
        │   WebSocket (6-digit code, real-time events)   │
        └────────── API Gateway WebSocket ───────────────┘
                         │
              Lambda (Node.js 22, arm64)
   ┌────────────┬────────┴─────┬──────────────┬─────────────────┐
DynamoDB     Bedrock        Polly          EventBridge      SNS
(one table)  (Converse)   (voices, S3+     Scheduler       (family
                           CloudFront cache) (reminders)     alerts)
```

- **TV app:** a fork of Amazon's **react-native-multi-tv-app-sample** (react-native-tvos 0.81, Expo SDK 54), with D-pad focus navigation for the remote.
  - **Built without extra libraries:** game scenes and the animated demo coach are plain Views and the Animated API, and the gradients are CSS gradients.
  - **Runs in a browser too:** the same code runs as a web app with a laptop webcam.
  - **Not yet tested on the emulator:** [verify: tested on the Android TV emulator / Fire TV].
- **Phone camera page:** Vite + React + **MediaPipe Tasks Vision PoseLandmarker** (full model on the GPU, lite model on the CPU).
  - **Hand-written counters:** joint-angle state machines track 20 moves: reps, and seconds held with a wobble measure.
  - **Steadier tracking:** "out of view" is only reported after 1.5 s, so brief tracking glitches don't trigger warnings.
  - **Hosting:** S3 + CloudFront.
- **Backend:** one **AWS SAM** template in us-east-1, holding everything below:
  - **API Gateway WebSocket API** (pairing and real-time relay) and an **HTTP API** (onboard, plan, check-in, session complete, report, meal, family, tts, voice pack, story).
  - **Lambda** functions on Node.js 22 (arm64).
  - **DynamoDB** single table with TTLs.
  - **Amazon Bedrock Converse:** writes the plan explanation, daily coaching line, kids' story chapters, weekly report and meal feedback. It uses a model fallback chain (Claude Haiku, then Amazon Nova Lite) with a deadline on every call.
  - **Amazon Polly:** generative voices (Matthew for the coach, Ruth for kids, Lupe for Spanish) and neural voices (calm, Hindi, Arabic). Clips are cached in S3 behind CloudFront, so a repeated line costs nothing.
  - **EventBridge Scheduler** for reminders, **SNS** with filter policies for family alerts.
- **Never breaks:** every Bedrock and Polly call has a timeout and a written backup, so the coach always answers and the demo never stalls.
- **Low cost:** everything is serverless and pay-per-use, so idle cost is close to zero [verify: monthly cost from AWS Billing].
- **Tests:** 21 automated tests for the phone rep counters (synthetic skeletons, no camera needed) and 16 backend logic tests.

## Challenges we ran into
- **Bedrock access on a new account.** Anthropic models need a one-time use-case form, and Nova had a low daily quota, so for most of the build the coach ran on its backup lines. That's why every AI call has a deadline and a template behind it. [verify: Bedrock model answering live in the final demo]
- **Real-time over API Gateway WebSockets.** You can't message a client inside `$connect`, so the TV asks for its pairing code right after connecting.
- **Making pose tracking forgiving at home.** People sit close, stand half out of view, or use a chair.
  - We added seated versions of every move.
  - Arm moves only need shoulders and hands in view.
  - A torso-length fallback works when the hips are hidden.
  - A debounce stops the coach repeating "step back".
- **Voices that sound alive.** Polly's generative voices sound far more energetic but reject SSML `<prosody>`, so the slow calm voice stays neural. New generative lines also take a few seconds, so we raised timeouts and cache every clip.
- **One codebase for a TV remote, a browser and a webcam.** Focus navigation, scroll, browser Back/Forward, and a draggable camera panel that never covers the coach.

## Accomplishments that we're proud of
- **Nine playable games** on one pose engine, for adults, seniors and kids.
- **Privacy by design:** video never leaves the camera device.
- **Safety rules, not the AI, decide the moves,** with a seated option everywhere.
- **The coach speaks four languages**, including Hindi/Urdu for our first users.
- **It never stalls:** with every AI service off, the app still works end to end.

## What we learned
- Short and kind beats long and hard: a 5-minute calm session on a low day keeps the streak alive.
- The best "AI" feature is often the guardrail around it.
- Small UX details matter more on a TV than on a phone: big focus states, a demo before every move, and a voice that doesn't nag.

## What's next
- **Move Together:** a family member joins the same Boss Battle from their own phone.
- **More fall-risk checks:** timed up-and-go and the 4-stage balance test.
- **Family circle and physio portal:** a family-circle screen on the TV, and the physio portal for Recover mode.
- **Sign-in:** Amazon Cognito accounts.
- **Voice launch:** "Alexa, open PlayMotion".
- **Fire TV Store:** publish the app [verify: current status].

## Built with
Amazon Bedrock · Amazon Polly · AWS Lambda · Amazon API Gateway (WebSocket + HTTP) · Amazon DynamoDB · Amazon EventBridge Scheduler · Amazon SNS · Amazon S3 · Amazon CloudFront · AWS SAM · React Native for TV (react-native-tvos) · Expo · react-tv-space-navigation · React · Vite · MediaPipe Tasks Vision · Node.js

## Sources
- WHO: 684,000 deaths from falls each year; 31% of adults and about 80% of adolescents insufficiently physically active.
- Cochrane Review (2019): exercise reduces the rate of falls in older people by 23%.
- JMIR Aging (2026): exergame users 25% less likely to fall compared with usual care.
- JMIR (2022): gamification interventions add about 1,600 steps per day.
- BMJ (2024): walking, yoga and strength training reduce depression.
- BJSM (2025): exercise snacks of 5 minutes or less, 91% adherence.
- PLOS ONE (2024): exergames improve children's balance and motor skills.

## Links
- Code: [verify: public GitHub repository URL] (MIT licence)
- Demo video: [verify: YouTube/Vimeo link]
- Try the camera page: https://dtpn7hdiphoh4.cloudfront.net
