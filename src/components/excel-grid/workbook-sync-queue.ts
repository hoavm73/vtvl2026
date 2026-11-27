/**
 * Hàng đợi lưu tuần tự (Single-Flight Save Queue) và bộ quyết định đồng bộ an toàn
 * giúp loại bỏ hoàn toàn lỗi race-condition 409 và nguy cơ mất dữ liệu cục bộ.
 */

export interface SerializedSaveQueue<T> {
  enqueue: (payload: T, executor: (p: T) => Promise<boolean>) => Promise<boolean>;
  clear: () => void;
  isBusy: () => boolean;
}

export function createSerializedSaveQueue<T>(): SerializedSaveQueue<T> {
  let busy = false;
  let pending: {
    payload: T;
    executor: (p: T) => Promise<boolean>;
    resolvers: Array<(ok: boolean) => void>;
  } | null = null;

  const drain = async (
    initialPayload: T,
    initialExecutor: (p: T) => Promise<boolean>,
    initialResolvers: Array<(ok: boolean) => void>
  ) => {
    busy = true;
    let currentPayload = initialPayload;
    let currentExecutor = initialExecutor;
    let currentResolvers = initialResolvers;

    try {
      while (true) {
        let ok = false;
        try {
          ok = await currentExecutor(currentPayload);
        } catch {
          ok = false;
        }
        for (const resolve of currentResolvers) resolve(ok);

        if (!ok) {
          // Nếu lần lưu này thất bại (vd: 409 / 400), không bắn tiếp payload cũ gây lỗi dây chuyền
          if (pending) {
            const dropped = pending;
            pending = null;
            for (const resolve of dropped.resolvers) resolve(false);
          }
          break;
        }

        if (!pending) break;
        const next = pending;
        pending = null;
        currentPayload = next.payload;
        currentExecutor = next.executor;
        currentResolvers = next.resolvers;
      }
    } finally {
      busy = false;
    }
  };

  return {
    enqueue(payload, executor) {
      return new Promise<boolean>((resolve) => {
        if (busy) {
          if (pending) {
            pending.payload = payload;
            pending.executor = executor;
            pending.resolvers.push(resolve);
          } else {
            pending = { payload, executor, resolvers: [resolve] };
          }
          return;
        }
        void drain(payload, executor, [resolve]);
      });
    },
    clear() {
      if (pending) {
        const dropped = pending;
        pending = null;
        for (const resolve of dropped.resolvers) resolve(false);
      }
    },
    isBusy() {
      return busy;
    }
  };
}

export interface RemoteSyncDecisionInput {
  isReadOnlyViewer: boolean;
  hasDirtySheets: boolean;
  isSavingOrUnsaved: boolean;
  hasLocalGrid: boolean;
  savedRev: number;
  remoteRev: number;
  serverTicketDiff: boolean;
  forceReload?: boolean;
}

/**
 * Quyết định có áp dụng dữ liệu từ máy chủ đè lên lưới cục bộ hay không.
 * Nguyên tắc: KHÔNG BAO GIỜ ghi đè khi người dùng đang có dữ liệu chưa lưu,
 * hoặc khi phiên bản máy chủ không mới hơn phiên bản cục bộ (tránh mất dữ liệu C1/A1).
 */
export function shouldApplyRemoteWorkbook(
  input: RemoteSyncDecisionInput
): 'apply' | 'mark_stale' | 'ignore' {
  if (input.forceReload || input.isReadOnlyViewer) return 'apply';

  if (input.hasDirtySheets || input.isSavingOrUnsaved) {
    if (input.hasLocalGrid && input.remoteRev > input.savedRev) {
      return 'mark_stale';
    }
    return 'ignore';
  }

  if (!input.hasLocalGrid) return 'apply';
  if (input.remoteRev > input.savedRev) return 'apply';
  if (input.serverTicketDiff && input.remoteRev >= input.savedRev) return 'apply';
  return 'ignore';
}

export function buildWorkbookAuthHeaders(
  op?: { accessToken?: string; email?: string } | null,
  withJson = false
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (withJson) headers['Content-Type'] = 'application/json';
  if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
  if (op?.email) headers['x-actor-email'] = op.email;
  return headers;
}

export function persistUnitGridCache(unitCode: string, data: unknown, revision: number): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`hcmute_vtvl_grid_${unitCode}`, JSON.stringify(data));
    localStorage.setItem(`hcmute_vtvl_grid_rev_${unitCode}`, String(revision));
  } catch { /* ignore quota */ }
}
