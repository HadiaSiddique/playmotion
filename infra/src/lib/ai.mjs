// Amazon Bedrock (Converse API) with a model fallback chain and a hard deadline.
// Callers always have a template fallback for when this returns null.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { extractJson } from './util.mjs';

const client = new BedrockRuntimeClient({ maxAttempts: 1 });

const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
export const TEXT_MODELS = list(process.env.BEDROCK_MODEL_IDS);
export const VISION_MODELS = list(process.env.BEDROCK_VISION_MODEL_IDS);

export const COACH_SYSTEM =
  'You are the voice of PlayMotion, a warm, upbeat, energetic movement coach on a TV who sounds genuinely excited for the person. ' +
  'PlayMotion is wellness coaching, not a medical device: never diagnose, never promise medical outcomes, ' +
  'never give medication advice, never shame. Use short, simple sentences that sound natural when read aloud.';

const isAnthropic = (modelId) => modelId.includes('anthropic.');

/**
 * Returns { text, modelId, ms } or null. Tries each model in order until the shared deadline runs out.
 * images: [{ format: 'jpeg' | 'png' | 'webp', bytes: Uint8Array }]
 */
export async function converse({ system = COACH_SYSTEM, prompt, images = [], maxTokens = 500, timeoutMs = 6000, models = TEXT_MODELS, temperature = 0.6 }) {
  const started = Date.now();
  const deadline = started + timeoutMs;
  for (const modelId of models) {
    const remaining = deadline - Date.now();
    if (remaining < 300) break;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), remaining);
    try {
      const content = [...images.map((img) => ({ image: { format: img.format, source: { bytes: img.bytes } } })), { text: prompt }];
      const res = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: system }],
          messages: [{ role: 'user', content }],
          // Newer Claude models reject non-default sampling params; keep replies fast with thinking off.
          inferenceConfig: isAnthropic(modelId) ? { maxTokens } : { maxTokens, temperature },
          additionalModelRequestFields: isAnthropic(modelId) ? { thinking: { type: 'disabled' } } : undefined,
        }),
        { abortSignal: abort.signal },
      );
      const text = (res.output?.message?.content ?? []).map((c) => c.text ?? '').join('').trim();
      if (text) {
        const ms = Date.now() - started;
        console.log(JSON.stringify({ msg: 'bedrock_ok', modelId, ms, inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens }));
        return { text, modelId, ms };
      }
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'bedrock_failed', modelId, error: err.name, detail: String(err.message).slice(0, 300) }));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Like converse, but parses a JSON object and runs `clean(obj)`; returns { data, modelId } or null. */
export async function converseJson(options, clean = (o) => o) {
  const res = await converse(options);
  if (!res) return null;
  const data = clean(extractJson(res.text));
  if (!data) {
    console.warn(JSON.stringify({ msg: 'bedrock_bad_json', modelId: res.modelId, sample: res.text.slice(0, 200) }));
    return null;
  }
  return { data, modelId: res.modelId };
}

/** One spoken line: strips quotes and markdown, caps length. */
export function cleanLine(text, max = 200) {
  if (typeof text !== 'string') return null;
  const line = text.replace(/[*_#`]/g, '').replace(/^["'“”\s]+|["'“”\s]+$/g, '').split('\n')[0].trim();
  return line ? line.slice(0, max) : null;
}
