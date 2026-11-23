import { registerCacheInvalidator } from './server-file-lock';

export type CacheTag =
  | 'tickets'
  | 'workbooks'
  | 'accounts'
  | 'units'
  | 'overview-stats'
  | 'unit-monitor'
  | 'coordination'
  | 'audit-history'
  | 'review-submission'
  | 'check-results'
  | 'c1-catalog';

export function buildScopedCacheKey(
  prefix: string,
  scope: {
    unitCode?: string;
    workbookId?: string;
    revision?: number;
    role?: string;
    email?: string;
  }
): string {
  const parts = [
    prefix,
    scope.unitCode ? `u:${scope.unitCode.toUpperCase()}` : '',
    scope.workbookId ? `wb:${scope.workbookId}` : '',
    typeof scope.revision === 'number' ? `r:${scope.revision}` : '',
    scope.role ? `role:${scope.role}` : '',
    scope.email ? `e:${scope.email.toLowerCase()}` : ''
  ].filter(Boolean);
  return parts.join('|');
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: Set<CacheTag>;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightPromises = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 2000;

function isTestBypass(): boolean {
  return process.env.VTVL_ISOLATED_LOCAL_STORE === 'true';
}

function evictExpiredOrOverflow(): void {
  const now = Date.now();
  for (const [k, entry] of memoryCache.entries()) {
    if (now >= entry.expiresAt) memoryCache.delete(k);
  }
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
}

export interface CacheOptions {
  /** Bật singleflight + cache ngắn hạn ngay cả khi VTVL_ISOLATED_LOCAL_STORE=true (phục vụ kiểm thử chống cache stampede). */
  forceSingleFlight?: boolean;
}

export function getCachedValue<T>(key: string, force = false): T | undefined {
  if (!force && isTestBypass()) return undefined;
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, tags: CacheTag[], ttlMs = 5000, force = false): T {
  if ((!force && isTestBypass()) || ttlMs <= 0) return value;
  evictExpiredOrOverflow();
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    tags: new Set(tags)
  });
  return value;
}

/**
 * Truy xuất dữ liệu từ Runtime Cache kết hợp Singleflight (gộp các truy vấn đồng thời)
 * và tự động hủy theo Tag khi có thay đổi dữ liệu.
 */
export async function cacheGetOrSet<T>(
  key: string,
  tags: CacheTag[],
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  const force = Boolean(options?.forceSingleFlight);
  const hit = getCachedValue<T>(key, force);
  if (hit !== undefined) return hit;

  const existingPromise = inFlightPromises.get(key) as Promise<T> | undefined;
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const fresh = await fetcher();
      return setCachedValue(key, fresh, tags, ttlMs, force);
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

export function invalidateCacheTags(tags: CacheTag[]): void {
  if (!tags.length) return;
  const tagSet = new Set(tags);
  if (tagSet.has('workbooks') || tagSet.has('tickets') || tagSet.has('unit-monitor')) {
    tagSet.add('audit-history');
    tagSet.add('review-submission');
  }
  for (const [key, entry] of memoryCache.entries()) {
    for (const t of entry.tags) {
      if (tagSet.has(t)) {
        memoryCache.delete(key);
        break;
      }
    }
  }
}

export function invalidateUnitMutationCache(unitCode?: string, workbookId?: string): void {
  const cleanUnit = unitCode ? unitCode.trim().toUpperCase() : '';
  const target = cleanUnit ? `|u:${cleanUnit}` : '';
  const wbTarget = workbookId ? `|wb:${workbookId.trim()}` : '';
  const allTags = new Set<CacheTag>([
    'workbooks',
    'tickets',
    'coordination',
    'overview-stats',
    'unit-monitor',
    'audit-history',
    'review-submission',
    'check-results'
  ]);
  for (const [key, entry] of memoryCache.entries()) {
    const matchesTag = Array.from(entry.tags).some((t) => allTags.has(t));
    if (!matchesTag && !(wbTarget && key.includes(wbTarget))) continue;
    if (target && key === 'coord:sources:sync') continue;
    const isSameWb = Boolean(wbTarget && key.includes(wbTarget));
    const isScopedOtherUnit = Boolean(target && key.includes('|u:') && !key.includes(target));
    if (isSameWb || !isScopedOtherUnit) {
      memoryCache.delete(key);
      inFlightPromises.delete(key);
    }
  }
}

export function clearAllRuntimeCache(): void {
  memoryCache.clear();
  inFlightPromises.clear();
}

registerCacheInvalidator((lockKey?: string) => {
  const m = lockKey?.match(/^(?:unit_wb_|ticket_unit_)(.+)$/i);
  if (m) invalidateUnitMutationCache(m[1]);
  else clearAllRuntimeCache();
});
