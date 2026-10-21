# Product feedback

Feedback on every Amazon / AWS tool used to build PlayMotion. For each: what worked well, what was hard, and one concrete suggestion. Fill in as you go; the backend notes below are from 2026-10-18.

## Fire TV: react-native-multi-tv-app-sample (Expo SDK 54)
- Worked well: _(fill in after forking: D-pad focus handling, project structure)_
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## Android TV emulator (as Fire OS stand-in)
- Worked well: _(fill in)_
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## Amazon Bedrock (Converse API)
- Worked well: one request shape (Converse) for Claude and Nova, text and images, so a model fallback chain is a simple loop.
- Hard: finding the right inference-profile ID for on-demand use; the Anthropic first-use form is easy to miss.
- Suggestion: show a "Copy ID for Converse" button with the inference-profile ID on each model card, and return a clear "complete the use-case form" error.

## Amazon Polly
- Worked well: generative voices (Matthew for the coach, Ruth for the kids' storyteller) sound far livelier than neural ones, with the same API call and only the `Engine` changed. SSML prosody makes a slow calm voice easy on the neural engine.
- Hard: generative voices reject every `<prosody>` tag (`InvalidSsmlException`, even `rate="fast"`), so the calm voice has to stay neural. No Urdu voice (our first users speak Urdu); we use the Hindi/Indian-English voice Kajal as the closest option.
- Hard: a first-time generative sentence can take several seconds, far longer than neural; easy to mistake for "no audio" behind a short timeout.
- Suggestion: prosody rate support on generative voices, published latency guidance for the generative engine, and an Urdu voice.

## API Gateway (WebSocket + HTTP API)
- Worked well: the WebSocket API plus `@connections` makes a serverless TV/phone relay possible with no servers to run.
- Hard: no send during `$connect`; 30 s HTTP integration cap.
- Suggestion: a sample for "pair two devices by short code" would save every multi-screen app team time.

## AWS Lambda
- Worked well: Node.js 22 on arm64; one code folder shared by three functions.
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## Amazon DynamoDB
- Worked well: single-table design with TTL for pairing codes and connections that clean themselves up.
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## Amazon EventBridge Scheduler
- Worked well: per-user schedules with a time zone (`ScheduleExpressionTimezone`) — no cron maths for users in Pakistan vs the US.
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## Amazon SNS
- Worked well: one topic + subscription filter policies route family updates and personal reminders without a topic per user.
- Hard: email subscribers must click a confirmation link that comes from "AWS Notifications", which can look like spam to family members.
- Suggestion: customisable confirmation email sender name and text.

## Amazon S3 + CloudFront
- Worked well: free HTTPS for the phone camera page (browsers require HTTPS for camera access).
- Hard: _(fill in)_
- Suggestion: _(fill in)_

## AWS SAM CLI (Windows)
- Worked well: _(fill in after first deploy)_
- Hard: _(fill in)_
- Suggestion: _(fill in)_
