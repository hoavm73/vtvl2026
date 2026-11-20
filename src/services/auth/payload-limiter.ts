export const MAX_WORKBOOK_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_STANDARD_PAYLOAD_BYTES = 1 * 1024 * 1024;
export const MAX_AUTH_PAYLOAD_BYTES = 64 * 1024;

export interface PayloadSizeCheckResult {
  allowed: boolean;
  actualBytes: number;
  maxBytes: number;
}

export type BoundedJsonResult<T = Record<string, unknown>> =
  | { ok: true; data: T; actualBytes: number }
  | { ok: false; status: 413 | 400; code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON'; error: string; actualBytes: number };

function formatLimitLabel(maxBytes: number): string {
  if (maxBytes >= 1024 * 1024 && maxBytes % (1024 * 1024) === 0) {
    return `${maxBytes / (1024 * 1024)}MB`;
  }
  return `${Math.ceil(maxBytes / 1024)}KB`;
}

export function buildPayloadTooLargeMessage(maxBytes: number): string {
  return `Dung lượng dữ liệu vượt quá giới hạn ${formatLimitLabel(maxBytes)}.`;
}

/** Kiểm tra nhanh header Content-Length trước khi đọc body. */
export function checkPayloadSizeLimit(
  req: Request,
  maxBytes = MAX_WORKBOOK_PAYLOAD_BYTES
): PayloadSizeCheckResult {
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

/**
 * Đọc và phân tích JSON theo stream có trần byte thực tế (`maxBytes`),
 * dừng ngay khi vượt ngưỡng (kể cả request thiếu `Content-Length` / `Transfer-Encoding: chunked`).
 */
export async function readBoundedJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes = MAX_STANDARD_PAYLOAD_BYTES
): Promise<BoundedJsonResult<T>> {
  const headerCheck = checkPayloadSizeLimit(req, maxBytes);
  if (!headerCheck.allowed) {
    return {
      ok: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      error: buildPayloadTooLargeMessage(maxBytes),
      actualBytes: headerCheck.actualBytes
    };
  }

  if (!req.body) {
    return { ok: true, data: {} as T, actualBytes: 0 };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let actualBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      actualBytes += value.byteLength;
      if (actualBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return {
          ok: false,
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          error: buildPayloadTooLargeMessage(maxBytes),
          actualBytes
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_JSON',
      error: 'Không thể đọc dữ liệu JSON gửi lên.',
      actualBytes
    };
  }

  if (actualBytes === 0) {
    return { ok: true, data: {} as T, actualBytes: 0 };
  }

  const merged = new Uint8Array(actualBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(merged);
  if (!rawText.trim()) {
    return { ok: true, data: {} as T, actualBytes };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_JSON',
        error: 'Dữ liệu JSON phải là đối tượng hợp lệ.',
        actualBytes
      };
    }
    return { ok: true, data: parsed, actualBytes };
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_JSON',
      error: 'Định dạng JSON không hợp lệ.',
      actualBytes
    };
  }
}
