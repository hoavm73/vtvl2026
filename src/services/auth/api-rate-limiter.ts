import { NextResponse } from 'next/server';

export type ApiRateGroup = 'read' | 'ticket_write' | 'ticket_review' | 'unit_reconcile' | 'workbook_write';

interface TokenBucketConfig {
  sustainedMax: number;
  windowMs: number;
  burst: number;
  label: string;
}

interface TokenBucketEntry {
  tokens: number;
  lastRefillMs: number;
}

const MAX_BUCKETS = 5000;

const GROUP_CONFIGS: Record<ApiRateGroup, TokenBucketConfig> = {
  read: { sustainedMax: 180, windowMs: 60_000, burst: 60, label: 'đọc dữ liệu phiếu' },
  ticket_write: { sustainedMax: 45, windowMs: 60_000, burst: 15, label: 'lưu/nộp phiếu công việc' },
  ticket_review: { sustainedMax: 90, windowMs: 60_000, burst: 25, label: 'duyệt/gộp phiếu đơn vị' },
  unit_reconcile: { sustainedMax: 12, windowMs: 60_000, burst: 4, label: 'đối soát gộp lô đơn vị' },
  workbook_write: { sustainedMax: 24, windowMs: 60_000, burst: 6, label: 'lưu/đồng bộ bảng tính' }
};

const apiRateGlobal = globalThis as unknown as {
  __uteVtvlApiRateBuckets?: Map<string, TokenBucketEntry>;
  __uteVtvlApiTotalBlocked?: number;
};

const buckets = apiRateGlobal.__uteVtvlApiRateBuckets || new Map<string, TokenBucketEntry>();
apiRateGlobal.__uteVtvlApiRateBuckets = buckets;
if (typeof apiRateGlobal.__uteVtvlApiTotalBlocked !== 'number') apiRateGlobal.__uteVtvlApiTotalBlocked = 0;

function isLimiterDisabled(): boolean {
  return process.env.VTVL_API_RATE_LIMIT_ENABLED === 'false' || process.env.VTVL_DISABLE_RATE_LIMIT === 'true';
}

function pruneBucketsIfNeeded(nowMs: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, entry] of buckets.entries()) {
    if (nowMs - entry.lastRefillMs > 10 * 60_000) {
      buckets.delete(k);
    }
  }
  if (buckets.size >= MAX_BUCKETS) {
    const entries = Array.from(buckets.entries()).sort((a, b) => a[1].lastRefillMs - b[1].lastRefillMs);
    const removeCount = Math.ceil(MAX_BUCKETS * 0.1);
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      buckets.delete(entries[i][0]);
    }
  }
}

export interface ApiRateDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  group: ApiRateGroup;
}

/**
 * Giới hạn tần suất API nghiệp vụ bằng Token Bucket theo danh tính đã xác thực (`email` hoặc `unitCode`),
 * tuyệt đối không khóa chéo các cán bộ dùng chung IP mạng trường.
 */
export function checkApiRateLimit(group: ApiRateGroup, authenticatedSubject: string): ApiRateDecision {
  if (isLimiterDisabled()) {
    const cfg = GROUP_CONFIGS[group];
    return { allowed: true, retryAfterSeconds: 0, remaining: cfg.burst, group };
  }

  const cfg = GROUP_CONFIGS[group];
  const normSubject = (authenticatedSubject || '_').trim().toLowerCase();
  const key = `${group}:${normSubject}`;
  const nowMs = Date.now();
  const refillPerMs = cfg.sustainedMax / cfg.windowMs;

  let entry = buckets.get(key);
  if (!entry) {
    pruneBucketsIfNeeded(nowMs);
    entry = { tokens: cfg.burst, lastRefillMs: nowMs };
    buckets.set(key, entry);
  } else {
    const elapsed = Math.max(0, nowMs - entry.lastRefillMs);
    entry.tokens = Math.min(cfg.burst, entry.tokens + elapsed * refillPerMs);
    entry.lastRefillMs = nowMs;
  }

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.floor(entry.tokens),
      group
    };
  }

  const deficit = 1 - entry.tokens;
  const retryAfterSeconds = Math.max(1, Math.ceil(deficit / (refillPerMs * 1000)));
  apiRateGlobal.__uteVtvlApiTotalBlocked = (apiRateGlobal.__uteVtvlApiTotalBlocked || 0) + 1;
  return { allowed: false, retryAfterSeconds, remaining: 0, group };
}

/** Kiểm tra và trả về HTTP 429 kèm Retry-After nếu vượt tần suất của nhóm API. */
export function enforceApiRateLimit(group: ApiRateGroup, authenticatedSubject: string): NextResponse | null {
  const decision = checkApiRateLimit(group, authenticatedSubject);
  if (decision.allowed) return null;

  const cfg = GROUP_CONFIGS[group];
  return NextResponse.json(
    {
      error: `Tốc độ gửi yêu cầu ${cfg.label} đang vượt ngưỡng an toàn. Vui lòng thử lại sau ${decision.retryAfterSeconds} giây.`,
      code: 'RATE_LIMITED',
      scope: group,
      retryAfterSeconds: decision.retryAfterSeconds
    },
    { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } }
  );
}

export function resetApiRateLimits(): void {
  buckets.clear();
  apiRateGlobal.__uteVtvlApiTotalBlocked = 0;
}

export function getApiRateLimiterStats() {
  return {
    enabled: !isLimiterDisabled(),
    activeBuckets: buckets.size,
    maxBuckets: MAX_BUCKETS,
    totalBlocked: apiRateGlobal.__uteVtvlApiTotalBlocked || 0
  };
}
