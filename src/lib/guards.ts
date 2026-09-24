// Contrôles d'accès à appeler dans CHAQUE page et CHAQUE route handler protégés
// (un layout seul ne suffit pas : il n'est pas réexécuté à chaque navigation).
import { getAuth, type AuthContext } from './auth';
import { ApiError } from './api';
import { redirectTo } from '@/i18n/server';

export type OrgAuth = AuthContext & { orgId: string };

// ─── Route handlers (lèvent une ApiError) ────────────────────────────────────

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, 'unauthenticated');
  return auth;
}

export async function requireOrg(): Promise<OrgAuth> {
  const auth = await requireAuth();
  if (!auth.orgId) throw new ApiError(403, 'no_org');
  if (auth.orgSuspended && !auth.isSuperadmin) throw new ApiError(403, 'org_suspended');
  return auth as OrgAuth;
}

export async function requireSuperadmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.isSuperadmin) throw new ApiError(403, 'forbidden');
  return auth;
}

// ─── Pages serveur (redirigent en conservant la langue) ──────────────────────

export async function requireOrgPage(): Promise<OrgAuth> {
  const auth = await getAuth();
  if (!auth) return redirectTo('/login');
  if (!auth.orgId) return redirectTo(auth.isSuperadmin ? '/admin' : '/login');
  if (auth.orgSuspended && !auth.isSuperadmin) return redirectTo('/login?reason=suspended');
  return auth as OrgAuth;
}

export async function requireSuperadminPage(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) return redirectTo('/login');
  if (!auth.isSuperadmin) return redirectTo('/dashboard');
  return auth;
}
