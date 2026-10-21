## Inspiration

Falls kill **684,000 people every year**, and **31% of adults and around 80% of adolescents** are not active enough (WHO). We already know what helps: exercise reduces falls in older adults by **23%** (Cochrane, 2019), and walking, yoga and strength training reduce depression (BMJ, 2024). The hard part is doing it, at home, every day.

Games change that. Exergame users were **25% less likely to fall** than people receiving usual care (JMIR Aging, 2026), gamification adds **about 1,600 steps a day** (JMIR, 2022), and exergames improve children's balance and motor skills (PLOS ONE, 2024). Sessions don't have to be long either: "exercise snacks" of five minutes or less reached **91% adherence** (BJSM, 2025).

Most homes already have what a personal coach needs: a big screen the whole family can see, and a phone with a good camera. We built **PlayMotion** so a grandparent working on balance, a parent trying to get stronger, someone having a low day and a child who just wants to play can all move together, in front of the TV they already own.

## What it does

PlayMotion turns the TV into an AI movement coach and the phone into its camera. **No app install, no wearables, and no video ever leaves the phone.**

- **Personal plan in a minute.** Onboarding is answered with the TV remote: who is exercising (adult, senior or child), goal, mobility (standing, holding a chair, seated or wheelchair), pain areas, activity, sleep, mood, food habits and coach language. PlayMotion builds a weekly plan and explains *why* each choice was made.
- **Scan and play.** The TV shows a QR code; the phone opens a camera page in the browser and both screens show **Connected ✓**. Pose tracking runs on the phone, so only 33 body points and rep counts reach the TV. On a laptop, the built-in webcam works too.
- **Nine games driven by your body.**
  - **Boss Battle:** squats, punches and jumping jacks power attacks on a cartoon monster.
  - **Pop the Bubbles:** reaching up and out pops floating bubbles.
  - **Garden Grow:** every rep waters a plant until it blooms.
  - **Balance Bridge:** one-leg balance walks a character across a wobbling bridge, followed by a 30-second chair-stand test with a weekly trend.
  - **Calm River:** paced breathing and slow arm movements guide a boat to a calm lake.
  - **For kids:** Jungle Quest, Freeze Dance and Floor Is Lava are narrated story games, and Superhero Training turns punches and squats into powers.
- **A real coach, not just a counter.** An animated demo coach shows every move before you start, live form cues appear on screen and are spoken by an energetic voice, and progress shows up as XP, levels, streaks, badges and a weekly garden. The coach speaks **English, Hindi/Urdu, Spanish and Arabic**.
- **Adapts to how you feel.** A 10-second daily check-in (mood, energy, sleep, pain) shapes each session: a low day becomes five calm minutes, a good day is a little harder, and pain switches to seated moves. The coach recommends, but you can always **choose your own workout**.
- **Shows that it works.** A before-and-after mood graph after every session, and a weekly report that compares active minutes with the WHO's 150-minute guideline, read aloud in your language.
- **Healthy habits beyond exercise.** Photograph a meal for gentle balance tips (no calorie counting unless you turn it on, no weight talk, photo never stored), plus session and water reminders and optional family updates.

### Safety by design
- Saying **"stop"**, tapping STOP or reporting pain pauses the game immediately and offers a seated version.
- A rule engine chooses every exercise from age, mobility and pain; AI only writes the words.
- A very low mood check-in leads to a calm support screen with helplines instead of a workout.
- Kids mode is parent-controlled with a PIN and stores only a nickname and an avatar: no ads, no chat, and only safe, low-impact moves.
- PlayMotion is wellness coaching, not a medical device, and says so clearly.

## How we built it

- **TV app:** forked from Amazon's **react-native-multi-tv-app-sample** (React Native for TV, Expo SDK 54), with D-pad focus navigation designed for the remote. Game scenes and the animated demo coach are built from React Native views and animations, so they run on TV hardware and in a browser from one codebase.
- **Phone camera page:** Vite + React with **MediaPipe Tasks Vision PoseLandmarker** running entirely in the browser. We wrote joint-angle state machines that track 20 moves (repetitions and timed holds with a wobble measure), with seated versions for chair and wheelchair users.
- **Backend on AWS (one SAM template):**
  - **Amazon API Gateway WebSocket API + AWS Lambda** pair the TV and phone with a 6-digit code and relay movement events in real time.
  - **API Gateway HTTP API + Lambda** handle onboarding, plans, check-ins, session results, weekly reports, meal tips and family updates.
  - **Amazon DynamoDB** stores profiles, plans, sessions and progress in a single table.
  - **Amazon Bedrock (Converse API)** writes plan explanations, coaching lines, kids' story narration, weekly reports and meal feedback, with a model fallback chain.
  - **Amazon Polly** gives the coach its voice (generative voices for an energetic coach and storyteller), with every clip cached in **Amazon S3** behind **Amazon CloudFront**.
  - **Amazon EventBridge Scheduler** sends reminders, and **Amazon SNS** delivers family updates.
- **Built to never stall:** every AI and voice call has a deadline and a written fallback, so the coach always responds, even if a service is slow.

## Challenges we ran into

- **Pose tracking in real living rooms.** People sit close to the camera, stand half out of view or hold a chair. We added seated versions of every move, let arm exercises work with only the upper body visible, and only warn about framing after a sustained loss of tracking, so the coach doesn't nag.
- **Real-time pairing over WebSockets.** API Gateway can't send a message during the connect handshake, so we redesigned pairing around a "host" message sent right after connecting.
- **A voice that sounds alive.** Polly's generative voices are far more energetic but handle speech-rate tags differently, and new sentences take a few seconds to synthesise. We kept a neural voice for the slow, calming coach and cache every clip so repeated lines are instant.
- **One experience across remote, browser and webcam.** We supported D-pad focus, mouse and keyboard, browser navigation, and a movable laptop camera panel that never covers the game.

## Accomplishments that we're proud of

- Nine playable games for seniors, adults and kids, all driven by one on-device pose engine.
- Privacy by design: video never leaves the camera device.
- Safety rules, not the AI, decide every exercise, with a seated option everywhere.
- A coach that speaks four languages, including Hindi/Urdu, so grandparents can be coached in the language they think in.
- A serverless backend that costs almost nothing when idle and keeps working when AI services are slow.

## What we learned

- Short and kind beats long and hard: five calm minutes on a low day keeps a habit alive.
- The most important AI feature is often the guardrail around it.
- On a TV, small details matter most: big focus states, a demo before every move, and a voice that encourages without nagging.

## What's next for PlayMotion

- **Move Together:** family members join the same game from their own phones.
- **More fall-risk checks:** the timed up-and-go and 4-stage balance tests.
- **Family circle and physio portal:** a family-circle screen on the TV, and a physiotherapist portal for Recover mode.
- **Sign-in:** secure accounts with Amazon Cognito.
- **Voice launch:** "Alexa, open PlayMotion".
- **Fire TV Store:** publish the app.
