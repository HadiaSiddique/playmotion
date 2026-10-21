// PlayMotion HTTP API client. Every call has a timeout and a friendly error message for the TV.
import { getPlayMotionConfig } from './config';
import { CheckinResponse, OnboardResponse, PlanResponse, ReportResponse, SessionResult, VoicePack } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: object, timeoutMs = 30_000): Promise<T> {
  const base = getPlayMotionConfig().apiUrl;
  if (!base) throw new ApiError(0, 'NO_BACKEND', 'The backend address is missing. Run scripts/write-env.ps1, then restart Metro.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'HTTP_ERROR', data.message ?? 'Something went wrong. Please try again.');
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'NETWORK', "We couldn't reach PlayMotion. Check the internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

const q = encodeURIComponent;

export const api = {
  onboard: (body: object) => request<OnboardResponse>('POST', '/onboard', body),
  plan: (userId: string) => request<PlanResponse>('GET', `/plan?userId=${q(userId)}`),
  checkin: (body: object) => request<CheckinResponse>('POST', '/checkin', body),
  completeSession: (body: object) => request<SessionResult>('POST', '/session/complete', body),
  voicePack: (style: 'coach' | 'calm' | 'kids', language = 'en-US') =>
    request<VoicePack>('GET', `/voice/pack?style=${style}&language=${encodeURIComponent(language)}`),
  /** Weekly stats; ai=0 skips the Bedrock summary when only the numbers are needed. */
  report: (userId: string, ai = false) => request<ReportResponse>('GET', `/report?userId=${q(userId)}&ai=${ai ? 1 : 0}`),
  shareReport: (userId: string) => request<{ shared: boolean }>('POST', '/report/share', { userId }),
  /** Kids narrator: one chapter (0-4) of a story game, voiced by Polly's child voice. */
  story: (body: { userId: string; game: string; chapter: number }) =>
    request<{ text: string; audioUrl: string | null; move: string | null; lastChapter: boolean; source: string }>('POST', '/story', body, 12_000),
  tts: (body: { userId: string; text: string; style?: string; language?: string }) =>
    request<{ url: string | null }>('POST', '/tts', body, 10_000),
};
