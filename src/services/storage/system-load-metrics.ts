import { getApiRateLimiterStats, resetApiRateLimits } from '../auth/api-rate-limiter';
import { getAuthRateLimiterStats } from '../auth/rate-limiter';
import { getHeavyGateMetrics, resetHeavyGateMetrics } from './heavy-mutation-gate';
import { getPgPoolMetrics, resetPgPoolMetrics } from './prisma';
import { getLockTelemetry, resetLockTelemetry } from './server-file-lock';

export function collectSystemLoadMetrics() {
  return {
    timestamp: new Date().toISOString(),
    pgPool: getPgPoolMetrics(),
    heavyGate: getHeavyGateMetrics(),
    fileLocks: getLockTelemetry(),
    authRateLimiter: getAuthRateLimiterStats(),
    apiRateLimiter: getApiRateLimiterStats()
  };
}

export function resetSystemLoadMetrics(includeApiRateBuckets = false): void {
  resetPgPoolMetrics();
  resetHeavyGateMetrics();
  resetLockTelemetry();
  if (includeApiRateBuckets) {
    resetApiRateLimits();
  }
}
