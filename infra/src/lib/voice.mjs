// Amazon Polly generative + neural voices, cached in S3 and served through CloudFront.
// Same text + voice = same file, so repeated coaching lines cost nothing after the first time.
// On any failure the caller gets { url: null } and the TV falls back to on-device TTS.
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sha1 } from './util.mjs';

const polly = new PollyClient({ maxAttempts: 2 });
const s3 = new S3Client({});
const BUCKET = process.env.ASSET_BUCKET;
const BASE_URL = process.env.ASSET_BASE_URL;

// style -> language -> 'Voice' (neural) or 'Voice:generative'. Generative voices sound livelier and more
// natural but ignore SSML prosody, so the slow calm voice stays neural. If a generative call fails we retry
// the neural fallback below. Polly has no Urdu voice; hi-IN (Kajal) is the closest spoken match.
const VOICES = {
  coach: { 'en-US': 'Matthew:generative', 'en-IN': 'Kajal:generative', 'hi-IN': 'Kajal', 'es-US': 'Lupe:generative', 'ar-AE': 'Hala' },
  calm: { 'en-US': 'Ruth', 'en-IN': 'Kajal', 'hi-IN': 'Kajal', 'es-US': 'Lupe', 'ar-AE': 'Hala' },
  kids: { 'en-US': 'Ruth:generative', 'en-IN': 'Kajal:generative', 'hi-IN': 'Kajal', 'es-US': 'Lupe:generative', 'ar-AE': 'Hala' },
};
const NEURAL_FALLBACK = { coach: 'Joanna', kids: 'Ivy' };

export function pickVoice(style = 'coach', language = 'en-US') {
  const table = VOICES[style] ?? VOICES.coach;
  const languageCode = table[language] ? language : 'en-US';
  const [voiceId, engine = 'neural'] = table[languageCode].split(':');
  return { voiceId, engine, languageCode };
}

const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

// Generative voices take a few seconds for a new sentence (cached lines are instant), so allow 9 s.
export async function speak({ text, style = 'coach', language = 'en-US', timeoutMs = 9000 }) {
  const clean = String(text ?? '').trim().slice(0, 600);
  if (!clean) return { url: null, text: clean, fallback: 'device-tts' };
  const { voiceId, engine, languageCode } = pickVoice(style, language);
  const key = `tts/${voiceId}-${engine}/${style}/${sha1(`${languageCode}|${clean}`)}.mp3`;
  const url = `${BASE_URL}/${key}`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }), { abortSignal: abort.signal });
      return { url, text: clean, voiceId, cached: true };
    } catch (err) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) throw err;
    }
    // Calm voice speaks a little slower.
    const ssml = style === 'calm' && engine === 'neural' ? `<speak><prosody rate="90%">${escapeXml(clean)}</prosody></speak>` : null;
    const synth = (VoiceId, Engine) =>
      polly.send(
        new SynthesizeSpeechCommand({
          Engine,
          OutputFormat: 'mp3',
          VoiceId,
          LanguageCode: languageCode,
          TextType: ssml ? 'ssml' : 'text',
          Text: ssml ?? clean,
        }),
        { abortSignal: abort.signal },
      );
    let out;
    try {
      out = await synth(voiceId, engine);
    } catch (err) {
      if (engine !== 'generative' || abort.signal.aborted) throw err;
      console.warn(JSON.stringify({ msg: 'polly_generative_failed', voiceId, error: err.name }));
      out = await synth(languageCode === 'en-US' ? (NEURAL_FALLBACK[style] ?? voiceId) : voiceId, 'neural');
    }
    const bytes = await out.AudioStream.transformToByteArray();
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: 'audio/mpeg', CacheControl: 'public, max-age=31536000, immutable' }),
      { abortSignal: abort.signal },
    );
    return { url, text: clean, voiceId, cached: false };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'polly_failed', voiceId, error: err.name, detail: String(err.message).slice(0, 200) }));
    return { url: null, text: clean, fallback: 'device-tts' };
  } finally {
    clearTimeout(timer);
  }
}
