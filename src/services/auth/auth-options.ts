import dns from 'dns';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/services/storage/prisma';
import {
  getUserAccountByEmail,
  syncAccountsFromSupabase,
  upsertUserAccount,
  UserRole
} from '@/services/storage/server-account-store';
import { getAuthSecret } from '@/services/storage/account-crypto';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore if unsupported
}

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const ALLOWED_DOMAINS = (process.env.GOOGLE_ALLOWED_HD || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function normalizeRole(role?: string | null, isTcnsAdmin = false): UserRole {
  if (isTcnsAdmin || role === 'admin') return 'admin';
  if (role === 'unit_leader') return 'unit_leader';
  return 'staff';
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: (process.env.NEXTAUTH_SECRET || '').trim() || getAuthSecret(),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  providers: isGoogleOAuthConfigured()
    ? [
        GoogleProvider({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
          authorization: {
            params: {
              prompt: 'select_account',
              access_type: 'offline',
              response_type: 'code'
            }
          }
        })
      ]
    : [],
  callbacks: {
    async signIn({ user }) {
      const email = normalizeEmail(user?.email || '');
      if (!email) return false;

      await syncAccountsFromSupabase();
      const existing = getUserAccountByEmail(email);
      if (existing?.status === 'suspended') {
        return '/login?error=AccountSuspended';
      }

      if (!existing && ALLOWED_DOMAINS.length > 0 && !ALLOWED_DOMAINS.includes('*')) {
        const domain = email.split('@')[1] || '';
        if (!ALLOWED_DOMAINS.includes(domain)) {
          return '/login?error=AccessDeniedDomain';
        }
      }

      const isTcns = email === 'tcns@hcmute.edu.vn';
      await upsertUserAccount({
        email,
        displayName: user.name || existing?.displayName || email.split('@')[0],
        unitCode: isTcns ? 'TCNS' : existing?.unitCode || 'CNTT',
        title: isTcns ? 'Phòng Tổ chức – Nhân sự' : existing?.title || 'Cán bộ – Giảng viên',
        role: normalizeRole(existing?.role, isTcns),
        authProvider: 'google',
        avatarUrl: user.image || existing?.avatarUrl || '',
        hasSelectedUnit: isTcns ? true : Boolean(existing?.hasSelectedUnit)
      });

      return true;
    },
    async jwt({ token, user }) {
      const email = normalizeEmail((user?.email || token?.email || '') as string);
      if (!email) return token;

      await syncAccountsFromSupabase();
      const acc = getUserAccountByEmail(email);
      const isTcns = email === 'tcns@hcmute.edu.vn';
      const role = normalizeRole(acc?.role, isTcns);
      const unitCode = (isTcns ? 'TCNS' : acc?.unitCode || 'CNTT').toUpperCase();

      token.email = email;
      token.role = role;
      token.unitCode = unitCode;
      token.title = acc?.title || (isTcns ? 'Phòng Tổ chức – Nhân sự' : 'Cán bộ – Giảng viên');
      token.hasSelectedUnit = isTcns ? true : Boolean(acc?.hasSelectedUnit);
      if (user?.image) token.picture = user.image;
      token.sessionToken = generateUserSessionToken({ email, role, unitCode, ttlHours: 24 });
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.id = (token.sub || token.id || token.email) as string;
        session.user.email = token.email;
        session.user.role = token.role || 'staff';
        session.user.unitCode = token.unitCode || 'CNTT';
        session.user.title = token.title || 'Cán bộ – Giảng viên';
        session.user.hasSelectedUnit = Boolean(token.hasSelectedUnit);
        session.user.sessionToken = token.sessionToken;
        if (token.picture && !session.user.image) {
          session.user.image = token.picture;
        }
      }
      return session;
    }
  }
};
