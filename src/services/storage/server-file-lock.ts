import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const LOCKS_DIR = path.join(DATA_DIR, '.locks');
const inProcessQueues = new Map<string, Promise<unknown>>();
const cacheInvalidators: Array<() => void> = [];

export function registerCacheInvalidator(fn: () => void): void {
  if (!cacheInvalidators.includes(fn)) {
    cacheInvalidators.push(fn);
  }
}

export function invalidateAllLocalCaches(): void {
  for (const fn of cacheInvalidators) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireFileLock(lockName: string, timeoutMs = 15000): Promise<{ release: () => void; crossProcessChanged: boolean }> {
  try {
    if (!fs.existsSync(LOCKS_DIR)) fs.mkdirSync(LOCKS_DIR, { recursive: true });
  } catch {
    // ignore
  }
  const safeName = sanitizeKey(lockName);
  const lockFile = path.join(LOCKS_DIR, `${safeName}.lock`);
  const pidFile = path.join(LOCKS_DIR, `${safeName}.pid`);
  const start = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8');
      fs.closeSync(fd);
      let crossProcessChanged = false;
      try {
        if (fs.existsSync(pidFile)) {
          const prevPid = fs.readFileSync(pidFile, 'utf8').trim();
          if (prevPid && prevPid !== String(process.pid)) crossProcessChanged = true;
        }
        fs.writeFileSync(pidFile, String(process.pid), 'utf8');
      } catch {
        // ignore
      }
      return {
        crossProcessChanged,
        release: () => {
          try {
            if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
          } catch {
            // ignore
          }
        }
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'EEXIST') {
        return { crossProcessChanged: false, release: () => {} };
      }
      try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > 12000) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - start > timeoutMs) {
        try {
          fs.unlinkSync(lockFile);
        } catch {
          // ignore
        }
        continue;
      }
      await sleepMs(15 + Math.floor(Math.random() * 20));
    }
  }
}

export async function withCrossProcessLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = inProcessQueues.get(lockKey) || Promise.resolve();
  let releaseInProcess!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });
  inProcessQueues.set(lockKey, prev.then(() => current));

  await prev;
  const { release: releaseFile, crossProcessChanged } = await acquireFileLock(lockKey);
  try {
    if (crossProcessChanged && process.env.VTVL_BENCHMARK_MEMORY_ONLY !== 'true') {
      invalidateAllLocalCaches();
    }
    return await fn();
  } finally {
    releaseFile();
    releaseInProcess();
    if (inProcessQueues.get(lockKey) === current) {
      inProcessQueues.delete(lockKey);
    }
  }
}
