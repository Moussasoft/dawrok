// Contrôles d'accès à appeler dans CHAQUE page et CHAQUE route handler protégés
// (un layout seul ne suffit pas : il n'est pas réexécuté à chaque navigation).
import { getAuth, type AuthContext } from './auth';
import { ApiError } from './api';
import { hasRole, type Role } from './roles';
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

/** Membre de l'organisation avec au moins ce rôle (un superadmin qui imite agit en propriétaire). */
export async function requireOrgRole(min: Role): Promise<OrgAuth> {
  const auth = await requireOrg();
  if (!hasRole(auth.role, min)) throw new ApiError(403, 'forbidden_role');
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

export async function requireOrgPageRole(min: Role): Promise<OrgAuth> {
  const auth = await requireOrgPage();
  if (!hasRole(auth.role, min)) return redirectTo('/dashboard');
  return auth;
}

export async function requireSuperadminPage(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) return redirectTo('/login');
  if (!auth.isSuperadmin) return redirectTo('/dashboard');
  return auth;
}
