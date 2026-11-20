import {
  MAX_WORKBOOK_PAYLOAD_BYTES,
  MAX_STANDARD_PAYLOAD_BYTES,
  MAX_AUTH_PAYLOAD_BYTES,
  checkPayloadSizeLimit,
  readBoundedJsonBody
} from './payload-limiter';

export {
  MAX_WORKBOOK_PAYLOAD_BYTES,
  MAX_STANDARD_PAYLOAD_BYTES,
  MAX_AUTH_PAYLOAD_BYTES,
  checkPayloadSizeLimit,
  readBoundedJsonBody
};

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_TRACKED_KEYS = 4096;
const OVERFLOW_RETRY_SECONDS = 30;
const SAFE_IP_RE = /^[0-9a-fA-F:.]{2,64}$/;

interface RateEntry {
  timestamps: number[];
  lockedUntilMs: number;
  lastSeenMs: number;
  windowMs: number;
}

export interface RateCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  reason?: 'OK' | 'RATE_LIMITED' | 'CAPACITY_OVERFLOW';
}

const rateGlobal = globalThis as unknown as {
  __uteVtvlAuthFailureStore?: Map<string, RateEntry>;
  __uteVtvlAuthOverflowCount?: number;
};

const failureStore = rateGlobal.__uteVtvlAuthFailureStore || new Map<string, RateEntry>();
rateGlobal.__uteVtvlAuthFailureStore = failureStore;
if (typeof rateGlobal.__uteVtvlAuthOverflowCount !== 'number') rateGlobal.__uteVtvlAuthOverflowCount = 0;

function getMaxTrackedKeys(): number {
  const parsed = Number(process.env.VTVL_RATE_LIMIT_MAX_KEYS || DEFAULT_MAX_TRACKED_KEYS);
  if (!Number.isFinite(parsed) || parsed < 10) return DEFAULT_MAX_TRACKED_KEYS;
  return Math.floor(parsed);
}

function sanitizeIpCandidate(raw?: string | null): string {
  const cleaned = (raw || '').trim().replace(/^\[|\]$/g, '');
  if (!cleaned) return '';
  return SAFE_IP_RE.test(cleaned) ? cleaned : '';
}

/**
 * Xác định IP client theo chính sách tin cậy Proxy:
 * - `VTVL_TRUST_PROXY=none`: không tin cậy header chuyển tiếp (khi Node.js đứng trực tiếp).
 * - `VTVL_TRUST_PROXY=legacy`: giữ hành vi cũ lấy phần tử đầu X-Forwarded-For (chỉ dùng để rollback).
 * - Mặc định (`nginx`): tin cậy `X-Real-IP` do Nginx nội bộ ghi đè từ `$remote_addr`;
 *   nếu thiếu `X-Real-IP`, chỉ lấy phần tử CUỐI (bên phải) của `X-Forwarded-For` để chống giả mạo phía client.
 */
export function extractClientIp(req: Request): string {
  const trustMode = (process.env.VTVL_TRUST_PROXY || 'nginx').trim().toLowerCase();
  if (trustMode === 'none') return 'direct-unproxied';

  if (trustMode === 'legacy') {
    const fwd = req.headers.get('x-forwarded-for') || '';
    const first = sanitizeIpCandidate(fwd.split(',')[0]);
    if (first) return first;
    const real = sanitizeIpCandidate(req.headers.get('x-real-ip'));
    return real || '127.0.0.1';
  }

  const realIp = sanitizeIpCandidate(req.headers.get('x-real-ip'));
  if (realIp) return realIp;

  const fwd = req.headers.get('x-forwarded-for') || '';
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    const rightmost = sanitizeIpCandidate(parts[parts.length - 1]);
    if (rightmost) return rightmost;
  }
  return '127.0.0.1';
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

/** Dọn dẹp bộ đếm giữ giới hạn bộ nhớ, tuyệt đối không xóa khóa đang bị chặn (`lockedUntilMs > nowMs`). */
function ensureCapacityForNewKey(nowMs: number, maxKeys: number): boolean {
  if (failureStore.size < maxKeys) return true;

  for (const [k, entry] of failureStore.entries()) {
    const active = pruneExpired(entry.timestamps, nowMs, entry.windowMs);
    entry.timestamps = active;
    if (active.length === 0 && entry.lockedUntilMs <= nowMs) {
      failureStore.delete(k);
    }
  }
  if (failureStore.size < maxKeys) return true;

  // Ưu tiên thu hồi các mục thăm dò 1 lần lỗi chưa bị khóa theo thứ tự ít hoạt động nhất
  const candidates: Array<{ key: string; hits: number; lastSeenMs: number }> = [];
  for (const [k, entry] of failureStore.entries()) {
    if (entry.lockedUntilMs <= nowMs) {
      candidates.push({ key: k, hits: entry.timestamps.length, lastSeenMs: entry.lastSeenMs });
    }
  }
  candidates.sort((a, b) => a.hits - b.hits || a.lastSeenMs - b.lastSeenMs);

  for (const cand of candidates) {
    if (failureStore.size < maxKeys) break;
    failureStore.delete(cand.key);
  }

  return failureStore.size < maxKeys;
}

export function checkDirectRateKey(
  key: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): RateCheckResult {
  if (process.env.VTVL_DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts, reason: 'OK' };
  }
  const nowMs = Date.now();
  const existing = failureStore.get(key);
  if (!existing) {
    if (!ensureCapacityForNewKey(nowMs, getMaxTrackedKeys())) {
      rateGlobal.__uteVtvlAuthOverflowCount = (rateGlobal.__uteVtvlAuthOverflowCount || 0) + 1;
      return {
        allowed: false,
        retryAfterSeconds: OVERFLOW_RETRY_SECONDS,
        remaining: 0,
        reason: 'CAPACITY_OVERFLOW'
      };
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts, reason: 'OK' };
  }

  existing.lastSeenMs = nowMs;
  const active = pruneExpired(existing.timestamps, nowMs, windowMs);
  existing.timestamps = active;

  if (existing.lockedUntilMs > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.lockedUntilMs - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds, remaining: 0, reason: 'RATE_LIMITED' };
  }

  if (active.length === 0) {
    failureStore.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts, reason: 'OK' };
  }

  if (active.length >= maxAttempts) {
    const lockUntil = active[0] + windowMs;
    existing.lockedUntilMs = lockUntil;
    const retryAfterSeconds = Math.max(1, Math.ceil((lockUntil - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds, remaining: 0, reason: 'RATE_LIMITED' };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - active.length, reason: 'OK' };
}

export function recordDirectFailure(
  key: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): void {
  if (process.env.VTVL_DISABLE_RATE_LIMIT === 'true') return;
  const nowMs = Date.now();
  const existing = failureStore.get(key);
  if (!existing && !ensureCapacityForNewKey(nowMs, getMaxTrackedKeys())) {
    rateGlobal.__uteVtvlAuthOverflowCount = (rateGlobal.__uteVtvlAuthOverflowCount || 0) + 1;
    return;
  }

  const prev = existing?.timestamps ? pruneExpired(existing.timestamps, nowMs, windowMs) : [];
  prev.push(nowMs);
  const bounded = prev.length > maxAttempts ? prev.slice(prev.length - maxAttempts) : prev;
  const lockedUntilMs = bounded.length >= maxAttempts ? bounded[0] + windowMs : (existing?.lockedUntilMs || 0);

  failureStore.set(key, {
    timestamps: bounded,
    lockedUntilMs: lockedUntilMs > nowMs ? lockedUntilMs : 0,
    lastSeenMs: nowMs,
    windowMs
  });
}

export function clearDirectRateKey(key: string): void {
  failureStore.delete(key);
}

export function checkAuthRateLimit(
  req: Request,
  scope: string,
  identifier = '',
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): RateCheckResult {
  return checkDirectRateKey(buildRateKey(req, scope, identifier), maxAttempts, windowMs);
}

export function recordAuthFailure(
  req: Request,
  scope: string,
  identifier = '',
  windowMs = DEFAULT_WINDOW_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): void {
  recordDirectFailure(buildRateKey(req, scope, identifier), maxAttempts, windowMs);
}

export function clearAuthFailures(req: Request, scope: string, identifier = ''): void {
  clearDirectRateKey(buildRateKey(req, scope, identifier));
}

export function resetAllRateLimits(): void {
  failureStore.clear();
  rateGlobal.__uteVtvlAuthOverflowCount = 0;
}

export function getAuthRateLimiterStats() {
  const nowMs = Date.now();
  let lockedKeys = 0;
  for (const entry of failureStore.values()) {
    if (entry.lockedUntilMs > nowMs) lockedKeys += 1;
  }
  return {
    trackedKeys: failureStore.size,
    lockedKeys,
    maxKeys: getMaxTrackedKeys(),
    overflowRejections: rateGlobal.__uteVtvlAuthOverflowCount || 0,
    persistenceMode: 'in_memory_process_ram',
    trustProxyMode: (process.env.VTVL_TRUST_PROXY || 'nginx').trim().toLowerCase()
  };
}
