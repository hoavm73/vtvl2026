'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WorkbookReviewProgressStepper } from '@/components/workbooks/WorkbookReviewProgressStepper';
import { UnitSummaryRow } from '@/components/overview/UnitMonitoringTypes';
import { getCanonicalWorkbookId } from '@/services/context/workbook-context';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

interface UnitReviewStatusWidgetProps {
  unitCode: string;
}

export function UnitReviewStatusWidget({ unitCode }: UnitReviewStatusWidgetProps) {
  const [summary, setSummary] = useState<UnitSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    const clean = (unitCode || '').trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      if (op?.email) headers['x-actor-email'] = op.email;
      const wbId = getCanonicalWorkbookId(clean);
      const res = await fetch(`/api/workbooks/${encodeURIComponent(wbId)}/history`, {
        headers,
        cache: 'no-store'
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.unitSummary) setSummary(json.unitSummary);
    } catch {
      // ignore network error
    } finally {
      setLoading(false);
    }
  }, [unitCode]);

  useEffect(() => {
    void loadStatus();
    const onRefresh = () => void loadStatus();
    window.addEventListener('vtvl-unit-session-updated', onRefresh);
    window.addEventListener('vtvl-operator-changed', onRefresh);
    return () => {
      window.removeEventListener('vtvl-unit-session-updated', onRefresh);
      window.removeEventListener('vtvl-operator-changed', onRefresh);
    };
  }, [loadStatus]);

  return (
    <WorkbookReviewProgressStepper
      status={summary?.reviewStatus}
      statusLabel={summary?.reviewStatusLabel}
      submittedBy={summary?.submittedBy}
      submittedAt={summary?.submittedAt}
      reviewerEmail={summary?.reviewerEmail}
      reviewedAt={summary?.reviewedAt}
      reviewNote={summary?.reviewNote}
      loading={loading}
    />
  );
}
