'use client';

import React, { useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import {
  getCurrentOperatorSession,
  normalizeEmail,
  saveCurrentOperatorSession
} from '@/services/telemetry/operator-session';
import { markEmailAsOnboarded } from '@/services/auth/account-client';

function NextAuthOperatorBridge({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;

    const email = normalizeEmail(session.user.email);
    if (!email) return;

    const existing = getCurrentOperatorSession();
    const isTcns = email === 'tcns@hcmute.edu.vn';
    const unitCode = isTcns
      ? 'TCNS'
      : session.user.unitCode || (existing?.email === email ? existing.unitCode : 'CNTT');
    const title = isTcns
      ? 'Phòng Tổ chức – Nhân sự'
      : session.user.title || (existing?.email === email ? existing.title : 'Cán bộ – Giảng viên');
    const role = isTcns ? 'admin' : session.user.role || 'staff';
    const hasSelectedUnit = isTcns || Boolean(session.user.hasSelectedUnit) || Boolean(existing?.email === email && existing?.hasSelectedUnit);

    if (hasSelectedUnit) {
      markEmailAsOnboarded(email);
    }

    if (
      !existing ||
      existing.email !== email ||
      existing.unitCode !== unitCode ||
      existing.role !== role ||
      existing.accessToken !== session.user.sessionToken
    ) {
      saveCurrentOperatorSession(email, unitCode, title, {
        displayName: session.user.name || email.split('@')[0],
        avatarUrl: session.user.image || '',
        authProvider: 'google',
        accessToken: session.user.sessionToken,
        role,
        hasSelectedUnit
      });
    }
  }, [session, status]);

  return <>{children}</>;
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <NextAuthOperatorBridge>{children}</NextAuthOperatorBridge>
    </SessionProvider>
  );
}

