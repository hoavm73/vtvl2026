import { NextRequest, NextResponse } from 'next/server';
import { isGoogleOAuthConfigured } from '@/services/auth/auth-options';

export async function GET(request: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'MISSING_CONFIG',
        message:
          'Chưa cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên máy chủ cho NextAuth Google OAuth.'
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const redirectPath = searchParams.get('redirect') || '/bang-tinh';
  const safePath = redirectPath.startsWith('/') ? redirectPath : '/bang-tinh';

  return NextResponse.json({
    ok: true,
    provider: 'nextauth-google',
    callbackUrl: safePath
  });
}
