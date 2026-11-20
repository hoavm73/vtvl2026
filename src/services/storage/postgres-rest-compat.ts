import { getDbTestHook, isDatabaseConfigured, pgQuery, withPgTransaction } from './prisma';

const SAFE_IDENT_RE = /^[a-z][a-z0-9_]*$/;

function assertSafeIdent(ident: string): string {
  const trimmed = ident.trim();
  if (!SAFE_IDENT_RE.test(trimmed)) {
    throw new Error(`[SECURITY] Invalid SQL identifier: ${ident}`);
  }
  return trimmed;
}

export async function pgUpsertRows(
  table: string,
  payload: unknown,
  upsertConflictCol?: string
): Promise<{ ok: boolean; status: number; table: string; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, status: 503, table, error: 'Chưa cấu hình PostgreSQL DATABASE_URL' };
  }

  const safeTable = assertSafeIdent(table);
  const rows = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
  if (rows.length === 0) return { ok: true, status: 200, table: safeTable };

  const hook = getDbTestHook();
  if (hook?.upsert) {
    const res = await hook.upsert(safeTable, rows, upsertConflictCol);
    return { ...res, table: safeTable };
  }

  const cols = Object.keys(rows[0]).filter((c) => SAFE_IDENT_RE.test(c));
  if (cols.length === 0) return { ok: false, status: 400, table: safeTable, error: 'Payload trống' };

  const conflictCols = (upsertConflictCol || '')
    .split(',')
    .map((s) => s.trim())
    .filter((c) => SAFE_IDENT_RE.test(c));

  let dedupedRows = rows;
  if (conflictCols.length > 0 && rows.length > 1) {
    const keyed = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const k = JSON.stringify(conflictCols.map((c) => r[c] ?? null));
      if (keyed.has(k)) keyed.delete(k);
      keyed.set(k, r);
    }
    dedupedRows = Array.from(keyed.values());
  }

  const colList = cols.map((c) => `"${c}"`).join(', ');
  let conflictSuffix = '';
  if (conflictCols.length > 0) {
    const target = conflictCols.map((c) => `"${c}"`).join(', ');
    const updates = cols.filter((c) => !conflictCols.includes(c));
    conflictSuffix =
      updates.length > 0
        ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')}`
        : ` ON CONFLICT (${target}) DO NOTHING`;
  }

  const BATCH_SIZE = 250;
  try {
    await withPgTransaction(async (client) => {
      for (let offset = 0; offset < dedupedRows.length; offset += BATCH_SIZE) {
        const chunk = dedupedRows.slice(offset, offset + BATCH_SIZE);
        const valueGroups: string[] = [];
        const values: unknown[] = [];
        let paramIdx = 1;
        for (const row of chunk) {
          const placeholders: string[] = [];
          for (const c of cols) {
            const v = row[c];
            values.push(v === undefined ? null : (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v));
            placeholders.push(`$${paramIdx++}`);
          }
          valueGroups.push(`(${placeholders.join(', ')})`);
        }
        const sql = `INSERT INTO public."${safeTable}" (${colList}) VALUES ${valueGroups.join(', ')}${conflictSuffix}`;
        await client.query(sql, values);
      }
    });
    return { ok: true, status: 201, table: safeTable };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 500, table: safeTable, error: msg };
  }
}

export async function pgCallSurveyRpc<T = Record<string, unknown>>(
  rpcName: string,
  params: Record<string, unknown>
): Promise<{ ok: boolean; status: number; row?: T; errorText?: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, status: 503, errorText: 'DATABASE_URL not configured' };
  }
  const safeFn = assertSafeIdent(rpcName);

  const hook = getDbTestHook();
  if (hook?.rpc) {
    const res = await hook.rpc(safeFn, params);
    return res as { ok: boolean; status: number; row?: T; errorText?: string };
  }

  const keys = Object.keys(params).filter((k) => SAFE_IDENT_RE.test(k));
  const namedArgs = keys
    .map((k, idx) => {
      const v = params[k];
      const isJson = v !== null && typeof v === 'object' && !(v instanceof Date);
      return `${k} := $${idx + 1}${isJson ? '::jsonb' : ''}`;
    })
    .join(', ');
  const values = keys.map((k) => {
    const v = params[k];
    if (v === undefined) return null;
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
    return v;
  });

  try {
    const row = await withPgTransaction(async (client) => {
      const res = await client.query(`SELECT * FROM public."${safeFn}"(${namedArgs})`, values);
      const first = res.rows[0];
      if (!first) return undefined;
      if (Object.keys(first).length === 1 && first[safeFn] && typeof first[safeFn] === 'object') {
        return first[safeFn] as T;
      }
      return first as T;
    });
    return { ok: true, status: 200, row };
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr?.code === '42883') {
      return { ok: false, status: 404, errorText: `PGRST202: function ${safeFn} not found` };
    }
    return { ok: false, status: 400, errorText: `${pgErr?.code || 'ERR'}: ${pgErr?.message || String(err)}` };
  }
}

export { pgQuery };
