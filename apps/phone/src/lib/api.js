// PlayMotion HTTP API from the phone (only used for meal tips; everything else goes over the WebSocket).
import { API_URL } from './config.js';

export async function postJson(path, body, timeoutMs = 25_000) {
  if (!API_URL) throw new Error('This page is missing its server address (VITE_API_URL).');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? 'Something went wrong. Please try again.');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('That took too long. Check your connection and try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
