const upper = (v) => String(v ?? '').trim().toUpperCase();
const norm = (v) => String(v ?? '').trim();

function mapByUnitWorkbook(list, getUnit, getWbId) {
  const m = new Map();
  for (const item of list || []) {
    const u = upper(getUnit(item));
    const wbId = norm(getWbId(item));
    if (u || wbId) m.set(`${u}::${wbId}`, item);
  }
  return m;
}

export function compareLocalAndPostgres(params) {
  const { local, pgData } = params;
  if (!pgData.available) {
    return {
      status: 'PG_UNAVAILABLE_FROM_LOCAL',
      reason: pgData.reason,
      localSummary: {
        serverWorkbooksJson: local.rawWbs.filter((e) => !(Array.isArray(e) ? e[1] : e)?.isDeleted).length,
        staffWorkTicketsJson: local.tickets.length,
        workSurveyVersionsJson: Object.keys(local.surveyVersions).length,
        workSurveyMergeLinksJson: Object.keys(local.mergeLinks).length,
        userVtvlAssignmentsJson: 0,
        auditLogsJson: local.auditLogs.length
      },
      pgSummary: null,
      unitDiffs: [],
      tableDrift: []
    };
  }

  const localWbList = (local.rawWbs || [])
    .map((e) => (Array.isArray(e) ? e[1] : e))
    .filter((w) => w && !w.isDeleted);
  const localByKey = mapByUnitWorkbook(localWbList, (w) => w.unitId, (w) => w.id);
  const pgTdByUnit = new Map((pgData.tTienDo || []).map((r) => [upper(r.ma_don_vi), r]));
  const pgWbById = new Map((pgData.workbooks || []).map((w) => [norm(w.id), w]));
  const pgRelA1ByUnit = new Map();
  const pgRelC1ByUnit = new Map();
  for (const r of pgData.relA1 || []) pgRelA1ByUnit.set(upper(r.ma_don_vi), (pgRelA1ByUnit.get(upper(r.ma_don_vi)) || 0) + 1);
  for (const r of pgData.relC1 || []) pgRelC1ByUnit.set(upper(r.ma_don_vi), (pgRelC1ByUnit.get(upper(r.ma_don_vi)) || 0) + 1);

  const pgRevByWb = new Map();
  for (const rv of pgData.wbRevisions || []) {
    const k = norm(rv.workbook_id);
    if (!pgRevByWb.has(k)) pgRevByWb.set(k, { count: 0, maxRev: 0 });
    const entry = pgRevByWb.get(k);
    entry.count += 1;
    entry.maxRev = Math.max(entry.maxRev, Number(rv.revision || 0));
  }

  const allUnits = new Set([
    ...localWbList.map((w) => upper(w.unitId)),
    ...Array.from(pgTdByUnit.keys()),
    ...(pgData.workbooks || []).map((w) => upper(w.unit_id)),
    ...Array.from(pgRelA1ByUnit.keys()),
    ...Array.from(pgRelC1ByUnit.keys())
  ]);

  const unitDiffs = [];
  for (const uc of Array.from(allUnits).sort()) {
    const td = pgTdByUnit.get(uc);
    const swbTd = td?.du_lieu_ho_so_json?.serverWorkbook || null;
    const wbTable = (pgData.workbooks || []).find((w) => upper(w.unit_id) === uc && !w.is_deleted) || null;
    const localWbs = localWbList.filter((w) => upper(w.unitId) === uc);
    const primaryLocal = localWbs.sort((a, b) => Number(b.currentRevision || 0) - Number(a.currentRevision || 0))[0] || null;
    const primaryPgWbId = norm(swbTd?.id || wbTable?.id || '');
    const revStats = pgRevByWb.get(primaryPgWbId) || { count: 0, maxRev: 0 };

    const locA1 = (primaryLocal?.data?.A1 || []).length;
    const locC1 = (primaryLocal?.data?.C1 || []).length;
    const tdA1 = (swbTd?.data?.A1 || []).length;
    const tdC1 = (swbTd?.data?.C1 || []).length;
    const wbA1 = (wbTable?.data?.A1 || []).length;
    const wbC1 = (wbTable?.data?.C1 || []).length;
    const relA1 = pgRelA1ByUnit.get(uc) || 0;
    const relC1 = pgRelC1ByUnit.get(uc) || 0;

    const drifts = [];
    if (!primaryLocal && (td || wbTable || relA1 || relC1)) drifts.push('ONLY_IN_POSTGRES');
    if (primaryLocal && !td && !wbTable) drifts.push('ONLY_IN_LOCAL_JSON');
    if (primaryLocal && (swbTd || wbTable) && Number(primaryLocal.currentRevision || 0) !== Number(swbTd?.currentRevision ?? wbTable?.current_revision ?? 0)) {
      drifts.push(`REV_MISMATCH(local=${primaryLocal.currentRevision},pg=${swbTd?.currentRevision ?? wbTable?.current_revision})`);
    }
    if ((tdA1 !== relA1 || tdC1 !== relC1) && (td || relA1 || relC1)) {
      drifts.push(`JSONB_VS_RELATIONAL(td=${tdA1}/${tdC1},rel=${relA1}/${relC1})`);
    }
    if (wbTable && td && (wbA1 !== tdA1 || wbC1 !== tdC1)) {
      drifts.push(`WORKBOOKS_VS_TIENDO(wb=${wbA1}/${wbC1},td=${tdA1}/${tdC1})`);
    }
    if (primaryLocal && (locA1 !== tdA1 || locC1 !== tdC1) && (td || wbTable)) {
      drifts.push(`LOCAL_VS_PG_COUNTS(local=${locA1}/${locC1},pg=${tdA1}/${tdC1})`);
    }

    unitDiffs.push({
      unitCode: uc,
      localWbId: primaryLocal?.id || null,
      localRev: primaryLocal?.currentRevision ?? null,
      localA1C1: primaryLocal ? `${locA1}/${locC1}` : null,
      pgWbId: primaryPgWbId || null,
      pgRev: swbTd?.currentRevision ?? wbTable?.current_revision ?? null,
      pgRevisionsCount: revStats.count,
      tTienDoA1C1: td ? `${tdA1}/${tdC1}` : null,
      workbooksA1C1: wbTable ? `${wbA1}/${wbC1}` : null,
      relationalA1C1: `${relA1}/${relC1}`,
      drifts
    });
  }

  return {
    status: 'COMPARED',
    localSummary: {
      serverWorkbooksJson: localWbList.length,
      staffWorkTicketsJson: local.tickets.length,
      workSurveyVersionsJson: Object.keys(local.surveyVersions).length,
      workSurveyMergeLinksJson: Object.keys(local.mergeLinks).length,
      userVtvlAssignmentsJson: 0,
      auditLogsJson: local.auditLogs.length
    },
    pgSummary: {
      tTienDo: (pgData.tTienDo || []).length,
      workbooks: (pgData.workbooks || []).length,
      workbookRevisions: (pgData.wbRevisions || []).length,
      a1NhiemVu: (pgData.relA1 || []).length,
      c1Vtvl: (pgData.relC1 || []).length,
      staffWorkTickets: (pgData.tickets || []).length,
      workSurveyVersions: Object.keys(pgData.surveyVersionsMap || {}).length,
      workSurveyMergeLinks: (pgData.mergeLinksRows || []).length,
      userVtvlAssignments: (pgData.vtvlAssigns || []).length,
      auditLogs: (pgData.auditLogsTotal ?? (pgData.auditLogs || []).length)
    },
    unitDiffs,
    tableDrift: unitDiffs.filter((d) => d.drifts.length > 0),
    unusedLocalKeyCount: localByKey.size - localWbList.length + pgWbById.size
  };
}
