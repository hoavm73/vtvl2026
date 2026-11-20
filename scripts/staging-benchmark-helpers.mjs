import assert from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import { execSync } from 'node:child_process';

export function hashPasswordScrypt(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

export function signUserToken(email, role, unitCode, secret) {
  const body = Buffer.from(
    JSON.stringify({
      email: email.toLowerCase(),
      role,
      unitCode: unitCode.toUpperCase(),
      issuedAt: new Date().toISOString(),
      expiresAt: Date.now() + 24 * 3600 * 1000
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function execQuiet(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

export function withDeadline(promise, ms, label) {
  let timer = null;
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`DEADLINE_EXCEEDED (${ms}ms): ${label}`)), ms);
    })
  ]);
}

export function httpRequest(agent, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const deadlineMs = Math.max(1000, Number(options.timeout || 15000));
    let settled = false;
    let ended = false;
    let req = null;

    const finish = (ok, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (ok) resolve(val);
      else reject(val);
    };

    const hardTimer = setTimeout(() => {
      try { req?.destroy(new Error(`HTTP_HARD_DEADLINE_${deadlineMs}ms`)); } catch { /* ignore */ }
      finish(false, new Error(`HTTP_HARD_DEADLINE_${deadlineMs}ms`));
    }, deadlineMs);
    hardTimer.unref?.();

    req = http.request({ ...options, agent }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', (err) => finish(false, err));
      res.on('aborted', () => finish(false, new Error('HTTP_RESPONSE_ABORTED')));
      res.on('close', () => {
        if (!ended && !settled) finish(false, new Error('HTTP_PREMATURE_CLOSE'));
      });
      res.on('end', () => {
        ended = true;
        const elapsedMs = performance.now() - t0;
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
        finish(true, { status: res.statusCode || 0, headers: res.headers, text, json, elapsedMs });
      });
    });

    req.setTimeout(deadlineMs, () => {
      try { req.destroy(new Error(`HTTP_SOCKET_TIMEOUT_${deadlineMs}ms`)); } catch { /* ignore */ }
      finish(false, new Error(`HTTP_SOCKET_TIMEOUT_${deadlineMs}ms`));
    });
    req.on('error', (err) => finish(false, err));

    if (bodyData && typeof bodyData.pipe === 'function') {
      bodyData.on('error', (err) => finish(false, err));
      bodyData.pipe(req);
    } else if (bodyData !== null) {
      req.end(bodyData);
    } else {
      req.end();
    }
  });
}

export async function waitForHttp200(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch { /* retry */ }
    await sleep(100);
  }
  throw new Error(`Timeout waiting HTTP 200 at ${url}`);
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return Number(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(2));
}

export function summarizeLatencies(samples) {
  if (!samples.length) return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    avgMs: Number((sum / sorted.length).toFixed(2)),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

/**
 * Nạp dữ liệu thử quy mô đầy đủ: đạt đúng 20.000 phiếu công việc, 60.000 phiên bản & 40.000 lịch sử (= 100.000 bản ghi)
 * phân bổ đều trên 39 đơn vị HCM-UTE bằng câu lệnh unnest() theo lô vào PostgreSQL 16.
 */
export async function seedFullScaleDataset({
  pgClient,
  activeUnits,
  sessions,
  leaderByUnit,
  unitMetaMap,
  targetTickets = 20000,
  targetVersions = 60000,
  targetHistory = 40000
}) {
  const existingTicketsRes = await pgClient.query(`SELECT count(*)::int AS cnt FROM public.staff_work_tickets`);
  const existingVerRes = await pgClient.query(`SELECT count(*)::int AS cnt FROM public.work_survey_versions`);
  const existingHistRes = await pgClient.query(`SELECT count(*)::int AS cnt FROM public.work_survey_status_history`);

  const baseTickets = existingTicketsRes.rows[0].cnt;
  const baseVersions = existingVerRes.rows[0].cnt;
  const baseHistory = existingHistRes.rows[0].cnt;

  const ticketsToInsert = Math.max(0, targetTickets - baseTickets);
  const staffByUnit = new Map();
  for (const s of sessions) {
    if (!staffByUnit.has(s.unitCode)) staffByUnit.set(s.unitCode, []);
    staffByUnit.get(s.unitCode).push(s.email);
  }

  const insertedTicketMeta = [];
  const now = new Date();
  const batchSize = 2000;

  for (let offset = 0; offset < ticketsToInsert; offset += batchSize) {
    const end = Math.min(ticketsToInsert, offset + batchSize);
    const ids = [], unitCodes = [], ownerEmails = [], ownerNames = [], statuses = [];
    const missions = [], taskCodes = [], taskNames = [], vtvls = [], spCounts = [], mins = [], bonusHrs = [];
    const mergedFlags = [], curVers = [], createdAts = [], updatedAts = [];

    for (let idx = offset; idx < end; idx++) {
      const unit = activeUnits[idx % activeUnits.length];
      const uc = unit.ma_don_vi;
      const meta = unitMetaMap.get(uc);
      const owners = staffByUnit.get(uc) || [leaderByUnit.get(uc).email];
      const ownerEmail = owners[idx % owners.length];
      const mod = idx % 20;
      let status = 'approved';
      let isMerged = true;
      let verNo = 3;
      if (mod >= 12 && mod < 15) {
        status = 'approved';
        isMerged = false; // 15% (~3.000 phiếu = ~77/đơn vị) dành cho đợt dồn tải 39 đơn vị gộp đồng thời
        verNo = 3;
      } else if (mod >= 15 && mod < 18) {
        status = 'submitted';
        isMerged = false;
        verNo = 2;
      } else if (mod >= 18) {
        status = 'draft';
        isMerged = false;
        verNo = 1;
      }
      const seq = 1000 + idx + 1;
      const tId = `tkt-seed-${uc}-${String(seq).padStart(5, '0')}`;
      const missionCode = meta.missionCode;
      const taskCode = `${missionCode}.CV${seq}`;
      const ts = new Date(now.getTime() - (ticketsToInsert - idx) * 100).toISOString();

      ids.push(tId);
      unitCodes.push(uc);
      ownerEmails.push(ownerEmail);
      ownerNames.push(`Cán bộ ${uc} #${seq}`);
      statuses.push(status);
      missions.push(missionCode);
      taskCodes.push(taskCode);
      taskNames.push(`Nhiệm vụ chuyên môn định mức 2026 #${seq}`);
      vtvls.push(meta.vtvlCode);
      spCounts.push(10 + (idx % 15));
      mins.push(30 + (idx % 4) * 15);
      bonusHrs.push(idx % 3 === 0 ? 1 : 0);
      mergedFlags.push(isMerged);
      curVers.push(verNo);
      createdAts.push(ts);
      updatedAts.push(ts);

      insertedTicketMeta.push({ id: tId, unitCode: uc, ownerEmail, status, missionCode, taskCode, vtvlCode: meta.vtvlCode, verNo, ts });
    }

    await pgClient.query(
      `INSERT INTO public.staff_work_tickets (
        id, unit_code, unit_id, owner_email, owner_id, owner_name, owner_title, status,
        ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, san_pham, chat_luong, can_cu,
        so_sp_nam, nguon_so_lieu, phut_thuc_te, gio_bo_sung, source_ticket_id,
        is_merged_to_b1_b2, current_version_no, is_test_data, is_archived, created_at, updated_at
      )
      SELECT
        u.id, u.uc, u.uc, u.oe, u.oe, u.oname, 'Cán bộ – Giảng viên', u.st,
        u.mv, u.cv, u.tname, u.vtvl, 'Hồ sơ nghiệm thu chuẩn', 'Đạt chuẩn HCM-UTE', 'QĐ 2266/QĐ-ĐHCNKT',
        u.sp, 'Thống kê hệ thống', u.phut, u.gio, u.id,
        u.merged, u.ver, false, false, u.ca, u.ua
      FROM unnest(
        $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[],
        $6::varchar[], $7::varchar[], $8::text[], $9::varchar[],
        $10::numeric[], $11::numeric[], $12::numeric[], $13::bool[], $14::int4[],
        $15::timestamptz[], $16::timestamptz[]
      ) AS u(id, uc, oe, oname, st, mv, cv, tname, vtvl, sp, phut, gio, merged, ver, ca, ua)`,
      [
        ids, unitCodes, ownerEmails, ownerNames, statuses,
        missions, taskCodes, taskNames, vtvls,
        spCounts, mins, bonusHrs, mergedFlags, curVers,
        createdAts, updatedAts
      ]
    );
  }

  // Đặt watermark counter lên 2000 để tránh trùng mã khi tạo phiếu mới trong benchmark tải
  for (const unit of activeUnits) {
    const meta = unitMetaMap.get(unit.ma_don_vi);
    await pgClient.query(
      `INSERT INTO public.unit_mission_counters (unit_code, mission_code, last_seq)
       VALUES ($1, $2, $3)
       ON CONFLICT (unit_code, mission_code) DO UPDATE SET last_seq = GREATEST(public.unit_mission_counters.last_seq, EXCLUDED.last_seq)`,
      [unit.ma_don_vi, meta.missionCode, ticketsToInsert + 2000]
    );
  }

  // Nạp chính xác targetVersions bản ghi vào work_survey_versions
  const versionsNeeded = Math.max(0, targetVersions - baseVersions);
  const verRows = [];
  let cursor = 0;
  while (verRows.length < versionsNeeded && insertedTicketMeta.length > 0) {
    const t = insertedTicketMeta[cursor % insertedTicketMeta.length];
    const round = Math.floor(cursor / insertedTicketMeta.length) + 1;
    verRows.push({
      surveyId: t.id,
      versionNo: 10 + round, // tránh đụng 1..3 nếu vòng nhiều lần; vẫn unique theo (survey_id, version_no)
      snapshot: JSON.stringify({
        tenCongViec: `Snapshot v${10 + round} ${t.taskCode}`,
        maNhiemVu: t.missionCode,
        maCongViec: t.taskCode,
        maVtvl: t.vtvlCode,
        soSpNam: 12,
        phutThucTe: 45
      }),
      submittedBy: t.ownerEmail,
      submittedAt: t.ts,
      changeSummary: `Phiên bản thử tải v${10 + round}`
    });
    cursor += 1;
  }

  for (let offset = 0; offset < verRows.length; offset += batchSize) {
    const chunk = verRows.slice(offset, offset + batchSize);
    await pgClient.query(
      `INSERT INTO public.work_survey_versions (survey_id, version_no, snapshot, submitted_by, submitted_at, change_summary, is_migration_baseline)
       SELECT u.sid, u.vno, u.snap, u.sb, u.sa, u.cs, false
       FROM unnest($1::varchar[], $2::int4[], $3::jsonb[], $4::varchar[], $5::timestamptz[], $6::text[])
         AS u(sid, vno, snap, sb, sa, cs)
       ON CONFLICT (survey_id, version_no) DO NOTHING`,
      [
        chunk.map((r) => r.surveyId),
        chunk.map((r) => r.versionNo),
        chunk.map((r) => r.snapshot),
        chunk.map((r) => r.submittedBy),
        chunk.map((r) => r.submittedAt),
        chunk.map((r) => r.changeSummary)
      ]
    );
  }

  // Nạp chính xác targetHistory bản ghi vào work_survey_status_history
  const historyNeeded = Math.max(0, targetHistory - baseHistory);
  const histRows = [];
  for (let idx = 0; idx < historyNeeded && insertedTicketMeta.length > 0; idx++) {
    const t = insertedTicketMeta[idx % insertedTicketMeta.length];
    const isApprove = idx >= insertedTicketMeta.length;
    histRows.push({
      surveyId: t.id,
      fromStatus: isApprove ? 'submitted' : 'draft',
      toStatus: isApprove ? 'approved' : 'submitted',
      action: isApprove ? 'APPROVE' : 'SUBMIT',
      reason: isApprove ? 'Phê duyệt dữ liệu thử quy mô lớn' : 'Nộp phiếu thử quy mô lớn',
      actorId: isApprove ? leaderByUnit.get(t.unitCode).email : t.ownerEmail,
      actorRole: isApprove ? 'unit_leader' : 'staff',
      unitId: t.unitCode,
      createdAt: t.ts
    });
  }

  for (let offset = 0; offset < histRows.length; offset += batchSize) {
    const chunk = histRows.slice(offset, offset + batchSize);
    await pgClient.query(
      `INSERT INTO public.work_survey_status_history (survey_id, from_status, to_status, action, reason, actor_id, actor_role, unit_id, created_at)
       SELECT u.sid, u.fs, u.ts, u.act, u.rsn, u.aid, u.arole, u.uid, u.ca
       FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::text[], $6::varchar[], $7::varchar[], $8::varchar[], $9::timestamptz[])
         AS u(sid, fs, ts, act, rsn, aid, arole, uid, ca)`,
      [
        chunk.map((r) => r.surveyId),
        chunk.map((r) => r.fromStatus),
        chunk.map((r) => r.toStatus),
        chunk.map((r) => r.action),
        chunk.map((r) => r.reason),
        chunk.map((r) => r.actorId),
        chunk.map((r) => r.actorRole),
        chunk.map((r) => r.unitId),
        chunk.map((r) => r.createdAt)
      ]
    );
  }

  await pgClient.query('ANALYZE public.staff_work_tickets');
  await pgClient.query('ANALYZE public.work_survey_versions');
  await pgClient.query('ANALYZE public.work_survey_status_history');

  const verifyTickets = (await pgClient.query(`SELECT count(*)::int AS cnt FROM public.staff_work_tickets`)).rows[0].cnt;
  const verifyVersions = (await pgClient.query(`SELECT count(*)::int AS cnt FROM public.work_survey_versions`)).rows[0].cnt;
  const verifyHistory = (await pgClient.query(`SELECT count(*)::int AS cnt FROM public.work_survey_status_history`)).rows[0].cnt;

  assert.strictEqual(verifyTickets, targetTickets, `Phải đạt đúng ${targetTickets} phiếu, thực tế: ${verifyTickets}`);
  assert.strictEqual(verifyVersions, targetVersions, `Phải đạt đúng ${targetVersions} phiên bản, thực tế: ${verifyVersions}`);
  assert.strictEqual(verifyHistory, targetHistory, `Phải đạt đúng ${targetHistory} lịch sử, thực tế: ${verifyHistory}`);

  return {
    totalTickets: verifyTickets,
    totalVersions: verifyVersions,
    totalHistory: verifyHistory,
    totalVersionAndHistory: verifyVersions + verifyHistory,
    sampleIdsByUnit: Object.fromEntries(
      activeUnits.map((u) => {
        const hit = insertedTicketMeta.find((m) => m.unitCode === u.ma_don_vi && m.status !== 'draft');
        return [u.ma_don_vi, hit ? hit.id : ''];
      })
    )
  };
}

/**
 * Đối soát nghiêm ngặt TỪNG ID phiếu `approved` trên cả 39 đơn vị giữa PostgreSQL (`staff_work_tickets`),
 * dữ liệu biểu `A2`/`B1` trong `public.t_tien_do` và bảng `public.work_survey_merge_links`.
 */
export async function verifyPerIdApprovedTicketReconciliation({ pgClient, activeUnits, phaseLabel }) {
  const approvedRows = (
    await pgClient.query(`
      SELECT id, unit_code, ma_cong_viec, is_merged_to_b1_b2, a2_row_id, b1_row_id
      FROM public.staff_work_tickets
      WHERE status = 'approved' AND is_archived = false AND is_test_data = false
      ORDER BY unit_code, id
    `)
  ).rows;

  const tdRows = (await pgClient.query(`SELECT ma_don_vi, du_lieu_ho_so_json FROM public.t_tien_do`)).rows;
  const linkRows = (
    await pgClient.query(`
      SELECT survey_id, target_sheet, target_record_id
      FROM public.work_survey_merge_links
      WHERE target_sheet IN ('A2', 'B1')
    `)
  ).rows;

  const wbIndexByUnit = new Map();
  for (const row of tdRows) {
    const uc = String(row.ma_don_vi || '').trim().toUpperCase();
    const wbData = row.du_lieu_ho_so_json?.serverWorkbook?.data || {};
    const a2Rows = Array.isArray(wbData.A2) ? wbData.A2 : [];
    const b1Rows = Array.isArray(wbData.B1) ? wbData.B1 : [];
    const a2Ids = new Set();
    const a2Src = new Set();
    const a2SrcCounts = new Map();
    for (const r of a2Rows) {
      const rid = String(r?.id || '').trim();
      const sid = String(r?.sourceTicketId || '').trim();
      if (rid) a2Ids.add(rid);
      if (sid) {
        a2Src.add(sid);
        a2SrcCounts.set(sid, (a2SrcCounts.get(sid) || 0) + 1);
      }
    }
    const b1Ids = new Set();
    const b1Src = new Set();
    const b1SrcCounts = new Map();
    for (const r of b1Rows) {
      const rid = String(r?.id || '').trim();
      const sid = String(r?.sourceTicketId || '').trim();
      if (rid) b1Ids.add(rid);
      if (sid) {
        b1Src.add(sid);
        b1SrcCounts.set(sid, (b1SrcCounts.get(sid) || 0) + 1);
      }
    }
    wbIndexByUnit.set(uc, { a2Ids, a2Src, a2SrcCounts, b1Ids, b1Src, b1SrcCounts });
  }

  const a2LinkBySurvey = new Set();
  const b1LinkBySurvey = new Set();
  for (const lr of linkRows) {
    if (lr.target_sheet === 'A2') a2LinkBySurvey.add(lr.survey_id);
    else if (lr.target_sheet === 'B1') b1LinkBySurvey.add(lr.survey_id);
  }

  const unmergedFlagIds = [];
  const missingInA2 = [];
  const missingInB1 = [];
  const missingMergeLinks = [];
  const approvedIdsByUnit = new Map();
  let matchedA2Ids = 0;
  let matchedB1Ids = 0;
  let matchedMergeLinkPairs = 0;

  for (const t of approvedRows) {
    const uc = String(t.unit_code || '').trim().toUpperCase();
    if (!approvedIdsByUnit.has(uc)) approvedIdsByUnit.set(uc, new Set());
    approvedIdsByUnit.get(uc).add(t.id);

    if (t.is_merged_to_b1_b2 !== true) {
      unmergedFlagIds.push(`${uc}:${t.id}`);
    }

    const wbIdx = wbIndexByUnit.get(uc);
    const hasA2 = Boolean(wbIdx && (wbIdx.a2Ids.has(`a2-${t.id}`) || wbIdx.a2Src.has(t.id)));
    const hasB1 = Boolean(wbIdx && (wbIdx.b1Ids.has(`b1-${t.id}`) || wbIdx.b1Src.has(t.id)));
    if (hasA2) matchedA2Ids += 1;
    else missingInA2.push(`${uc}:${t.id}`);

    if (hasB1) matchedB1Ids += 1;
    else missingInB1.push(`${uc}:${t.id}`);

    if (a2LinkBySurvey.has(t.id) && b1LinkBySurvey.has(t.id)) matchedMergeLinkPairs += 1;
    else missingMergeLinks.push(`${uc}:${t.id}`);
  }

  const duplicateInA2 = [];
  const duplicateInB1 = [];
  const orphanSourceIdsInSheets = [];
  for (const u of activeUnits) {
    const uc = String(u.ma_don_vi || '').trim().toUpperCase();
    const wbIdx = wbIndexByUnit.get(uc);
    if (!wbIdx) continue;
    const validIds = approvedIdsByUnit.get(uc) || new Set();
    for (const [sid, cnt] of wbIdx.a2SrcCounts.entries()) {
      if (cnt > 1) duplicateInA2.push(`${uc}:${sid}(x${cnt})`);
      if (!validIds.has(sid)) orphanSourceIdsInSheets.push(`${uc}:A2:${sid}`);
    }
    for (const [sid, cnt] of wbIdx.b1SrcCounts.entries()) {
      if (cnt > 1) duplicateInB1.push(`${uc}:${sid}(x${cnt})`);
      if (!validIds.has(sid)) orphanSourceIdsInSheets.push(`${uc}:B1:${sid}`);
    }
  }

  if (
    unmergedFlagIds.length ||
    missingInA2.length ||
    missingInB1.length ||
    duplicateInA2.length ||
    duplicateInB1.length ||
    orphanSourceIdsInSheets.length ||
    missingMergeLinks.length
  ) {
    console.error(`[PER-ID RECONCILIATION FAIL @ ${phaseLabel}]`, {
      unmergedFlagSample: unmergedFlagIds.slice(0, 10),
      missingInA2Sample: missingInA2.slice(0, 10),
      missingInB1Sample: missingInB1.slice(0, 10),
      duplicateInA2Sample: duplicateInA2.slice(0, 10),
      duplicateInB1Sample: duplicateInB1.slice(0, 10),
      orphanSample: orphanSourceIdsInSheets.slice(0, 10),
      missingMergeLinksSample: missingMergeLinks.slice(0, 10)
    });
  }

  assert.strictEqual(unmergedFlagIds.length, 0, `[${phaseLabel}] Còn ${unmergedFlagIds.length} phiếu approved có is_merged_to_b1_b2 !== true`);
  assert.strictEqual(missingInA2.length, 0, `[${phaseLabel}] Còn ${missingInA2.length} phiếu approved thiếu dòng trong Biểu A2`);
  assert.strictEqual(missingInB1.length, 0, `[${phaseLabel}] Còn ${missingInB1.length} phiếu approved thiếu dòng trong Biểu B1`);
  assert.strictEqual(duplicateInA2.length, 0, `[${phaseLabel}] Phát hiện ${duplicateInA2.length} ID bị trùng trong Biểu A2`);
  assert.strictEqual(duplicateInB1.length, 0, `[${phaseLabel}] Phát hiện ${duplicateInB1.length} ID bị trùng trong Biểu B1`);
  assert.strictEqual(orphanSourceIdsInSheets.length, 0, `[${phaseLabel}] Phát hiện ${orphanSourceIdsInSheets.length} dòng A2/B1 mồ côi`);
  assert.strictEqual(missingMergeLinks.length, 0, `[${phaseLabel}] Còn ${missingMergeLinks.length} phiếu thiếu liên kết work_survey_merge_links`);

  return {
    phaseLabel,
    unitsChecked: activeUnits.length,
    totalApprovedDbIds: approvedRows.length,
    matchedA2Ids,
    matchedB1Ids,
    matchedMergeLinkPairs,
    unmergedFlagCount: 0,
    missingInA2Count: 0,
    missingInB1Count: 0,
    duplicateInA2Count: 0,
    duplicateInB1Count: 0,
    orphanSourceIdsCount: 0,
    missingMergeLinksCount: 0
  };
}
