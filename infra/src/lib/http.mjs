// HTTP API helpers (payload format 2.0).

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'The request body must be JSON.');
  }
}

export const query = (event) => event.queryStringParameters ?? {};

export function requireUserId(value) {
  if (typeof value !== 'string' || !/^u_[A-Za-z0-9_-]{8,40}$/.test(value)) {
    throw new HttpError(400, 'BAD_USER_ID', 'A valid userId is required.');
  }
  return value;
}
