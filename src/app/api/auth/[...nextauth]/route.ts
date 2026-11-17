import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { getAuthOptions } from '@/services/auth/auth-options';

const TRUSTED_HOSTS = new Set([
  'kekhaivtvl.hcmute.edu.vn',
  'vtvl.utehub.vn'
]);

async function handler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const fwdHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim().toLowerCase();
  if (TRUSTED_HOSTS.has(fwdHost)) {
    process.env.NEXTAUTH_URL = `https://${fwdHost}`;
  }
  const nextAuthHandler = NextAuth(getAuthOptions());
  return (nextAuthHandler as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(req, ctx);
}

export { handler as GET, handler as POST };
