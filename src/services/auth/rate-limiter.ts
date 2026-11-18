const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 2000;

export const MAX_WORKBOOK_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_STANDARD_PAYLOAD_BYTES = 1 * 1024 * 1024;

interface RateEntry {
  timestamps: number[];
}

const failureStore = new Map<string, RateEntry>();

export function extractClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = (req.headers.get('x-real-ip') || '').trim();
  return realIp || '127.0.0.1';
}

function buildRateKey(req: Request, scope: string, identifier = ''): string {
  const ip = extractClientIp(req);
  const normId = identifier.trim().toLowerCase() || '_';
  return `${scope}:${ip}:${normId}`;
}

function pruneExpired(timestamps: number[], nowMs: number, windowMs: number): number[] {
  const cutoff = nowMs - windowMs;
  return timestamps.filter((ts) => ts > cutoff);
}

function evictOverflow(nowMs: number, windowMs: number): void {
  if (failureStore.size < MAX_TRACKED_KEYS) return;
  for (const [k, entry] of failureStore.entries()) {
    const active = pruneExpired(entry.timestamps, nowMs, windowMs);
    if (active.length === 0) failureStore.delete(k);
    else entry.timestamps = active;
  }
  if (failureStore.size >= MAX_TRACKED_KEYS) {
    const firstKey = failureStore.keys().next().value;
    if (firstKey) failureStore.delete(firstKey);
  }
}

export function checkAuthRateLimit(
  req: Request,
  scope: string,
  identifier = '',
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  if (process.env.VTVL_DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
  }
  const nowMs = Date.now();
  const key = buildRateKey(req, scope, identifier);
  const existing = failureStore.get(key);
  if (!existing) {
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
  }
  const active = pruneExpired(existing.timestamps, nowMs, windowMs);
  if (active.length === 0) {
    failureStore.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
  }
  existing.timestamps = active;
  if (active.length >= maxAttempts) {
    const oldest = active[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - active.length };
}

export function recordAuthFailure(
  req: Request,
  scope: string,
  identifier = '',
  windowMs = DEFAULT_WINDOW_MS
): void {
  if (process.env.VTVL_DISABLE_RATE_LIMIT === 'true') return;
  const nowMs = Date.now();
  evictOverflow(nowMs, windowMs);
  const key = buildRateKey(req, scope, identifier);
  const existing = failureStore.get(key);
  const active = existing ? pruneExpired(existing.timestamps, nowMs, windowMs) : [];
  active.push(nowMs);
  failureStore.set(key, { timestamps: active });
}

export function clearAuthFailures(req: Request, scope: string, identifier = ''): void {
  const key = buildRateKey(req, scope, identifier);
  failureStore.delete(key);
}

export function resetAllRateLimits(): void {
  failureStore.clear();
}

export function checkPayloadSizeLimit(
  req: Request,
  maxBytes = MAX_WORKBOOK_PAYLOAD_BYTES
): { allowed: boolean; actualBytes: number; maxBytes: number } {
  const rawLen = req.headers.get('content-length');
  if (!rawLen) return { allowed: true, actualBytes: 0, maxBytes };
  const parsed = Number(rawLen);
  if (!Number.isFinite(parsed) || parsed < 0) return { allowed: true, actualBytes: 0, maxBytes };
  return {
    allowed: parsed <= maxBytes,
    actualBytes: parsed,
    maxBytes
  };
}
