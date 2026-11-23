#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { RESTORE_ORDER_TABLES, computeDatabaseTableDigests } from './lib/a1-c1-backup-plan.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');

const args = process.argv.slice(2);
const getArg = (flag, fallback = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const backupDir = getArg('--backup-dir');
const sha256Text = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const upper = (v) => String(v ?? '').trim().toUpperCase();

async function restoreRowUpsert(pgClient, tbl, row) {
  const cols = Object.keys(row);
  const vals = cols.map((c) => (tbl.jsonCols.includes(c) ? JSON.stringify(row[c] ?? {}) : row[c]));
  const ph = cols.map((c, i) => `$${i + 1}${tbl.jsonCols.includes(c) ? '::jsonb' : ''}`);
  const conflict = tbl.pk.length === 1 ? tbl.pk[0] : tbl.pk.join(', ');
  const updates = cols.filter((c) => !tbl.pk.includes(c)).map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  await pgClient.query(`INSERT INTO public.${tbl.name} (${cols.join(', ')}) VALUES (${ph.join(', ')}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`, vals);
}

async function main() {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) throw new Error('Thiếu DATABASE_URL tới utevtvl_db.');
  if (!backupDir || !fs.existsSync(path.join(backupDir, 'rollback-manifest.json'))) {
    throw new Error('Thiếu --backup-dir hợp lệ chứa rollback-manifest.json.');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'rollback-manifest.json'), 'utf8'));
  const backupRaw = fs.readFileSync(manifest.backupFile, 'utf8');
  if (sha256Text(backupRaw) !== manifest.backupFileSha256) throw new Error('Rollback aborted: backup SHA-256 mismatch.');
  const backup = JSON.parse(backupRaw);
  const units = (manifest.targetUnits || []).map(upper);

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const db = (await client.query(`SELECT current_database() AS db`)).rows[0]?.db;
    if (db !== 'utevtvl_db') throw new Error(`Từ chối rollback: đang kết nối "${db}", không phải "utevtvl_db".`);
    await client.query('BEGIN');
    try {
      for (const tbl of [...RESTORE_ORDER_TABLES].reverse()) {
        if (tbl.unitViaWb) {
          const wbIds = (backup.tables.workbooks || []).map((w) => w.id);
          if (wbIds.length) await client.query(`DELETE FROM public.workbook_revisions WHERE workbook_id = ANY($1::text[])`, [wbIds]);
        } else if (tbl.name !== 'workbooks' && tbl.name !== 't_tien_do') {
          await client.query(`DELETE FROM public.${tbl.name} WHERE UPPER(${tbl.unitCol}) = ANY($1::text[])`, [units]);
        }
      }
      for (const tbl of RESTORE_ORDER_TABLES) {
        for (const row of backup.tables[tbl.name] || []) await restoreRowUpsert(client, tbl, row);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const post = await computeDatabaseTableDigests(client, null);
    const semanticOk = post.semanticOverallSha256 === manifest.allUnitsTableDigests.semanticOverallSha256;
    const fullDiffTables = RESTORE_ORDER_TABLES.filter((t) => post.tables[t.name]?.fullSha256 !== manifest.allUnitsTableDigests.tables[t.name]?.fullSha256).map((t) => t.name);
    console.log('✅ ROLLBACK COMPLETED:', JSON.stringify({ semanticMatchedAll17: semanticOk, fullDiffTables, semanticSha256: post.semanticOverallSha256 }));
    if (!semanticOk) process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((err) => { console.error('❌ ROLLBACK FAILED:', err?.message || err); process.exit(1); });
}
