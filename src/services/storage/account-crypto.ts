import crypto from 'crypto';

export type UserRole = 'admin' | 'unit_leader' | 'staff';

export interface UserAccountRecord {
  email: string; displayName: string; unitCode: string; unitNameVi: string; title: string;
  role: UserRole; authProvider: 'google' | 'email'; avatarUrl?: string; status: 'active' | 'suspended';
  hasSelectedUnit?: boolean; passwordHash?: string; createdAt: string; lastActiveAt: string;
}

export const VALID_ROLES: UserRole[] = ['admin', 'unit_leader', 'staff'];

export function getRoleTitle(role: UserRole): string {
  return role === 'admin' ? 'Phòng Tổ chức – Nhân sự' : role === 'unit_leader' ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên';
}

export function getRoleFromTitle(title?: string): UserRole {
  const t = (title || '').trim().toLowerCase();
  if (t.includes('tổ chức') || t.includes('nhân sự') || t === 'admin') return 'admin';
  return (t.includes('lãnh đạo') || t.includes('trưởng') || t.includes('phó') || t === 'unit_leader') ? 'unit_leader' : 'staff';
}

export function hashAccountPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

export function verifyPasswordHash(password: string, storedHash?: string): boolean {
  if (!storedHash || !password) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, expectedKey] = parts;
    const key = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(expectedKey, 'hex'));
    } catch {
      return false;
    }
  }
  const legacyPrefix = crypto.createHash('sha256').update(`hcmute_vtvl_${password}`).digest('hex');
  const legacyRaw = crypto.createHash('sha256').update(password).digest('hex');
  return storedHash === legacyPrefix || storedHash === legacyRaw;
}

export function stripAccountSensitiveFields(acc: UserAccountRecord): UserAccountRecord {
  const { passwordHash: _ignored, ...safe } = acc;
  return safe;
}

export function getAuthSecret(): string {
  const secret = (process.env.ADMIN_SERVER_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[SECURITY FATAL] ADMIN_SERVER_SECRET must be configured in production environment.');
    }
    return 'hcmute_vtvl_jwt_dev_secret_only';
  }
  return secret;
}

export function safeCompareSignature(sigA: string, sigB: string): boolean {
  if (!sigA || !sigB || sigA.length !== sigB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sigA), Buffer.from(sigB));
  } catch {
    return false;
  }
}
