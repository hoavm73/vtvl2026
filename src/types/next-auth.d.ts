import 'next-auth';
import 'next-auth/jwt';

export type VtvlUserRole = 'admin' | 'unit_leader' | 'staff';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: VtvlUserRole;
      unitCode?: string;
      title?: string;
      hasSelectedUnit?: boolean;
      sessionToken?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    email?: string | null;
    role?: VtvlUserRole;
    unitCode?: string;
    title?: string;
    hasSelectedUnit?: boolean;
    picture?: string | null;
    sessionToken?: string;
  }
}

