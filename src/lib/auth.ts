import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from './db';
import { isSessionStale } from './tokens';

const COOKIE = 'daourak_session';
const SESSION_DAYS = 30;
const DEV_FALLBACK_SECRET = 'dev-only-secret-never-use-in-production-0000';

let cachedSecret: Uint8Array | null = null;

/**
 * Secret de signature. En production, un secret absent, trop court ou laissé à sa valeur
 * d'exemple est refusé : sinon n'importe qui pourrait forger une session superadmin.
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET ?? '';
  const weak = secret.length < 32 || secret.startsWith('change-me');
  if (weak && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET absent ou trop faible (≥ 32 caractères aléatoires requis en production).');
  }
  cachedSecret = new TextEncoder().encode(weak ? secret || DEV_FALLBACK_SECRET : secret);
  return cachedSecret;
}

export type SessionPayload = {
  userId: string;
  /** Renseigné quand un superadmin imite un propriétaire : id du superadmin. */
  impersonatedFromUserId?: string;
  /** Date d'émission (secondes), comparée au dernier changement de mot de passe. */
  iat?: number;
};

export async function createSession({ userId, impersonatedFromUserId }: SessionPayload): Promise<string> {
  return await new SignJWT({ userId, ...(impersonatedFromUserId && { impersonatedFromUserId }) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== 'string') return null;
    return {
      userId: payload.userId,
      impersonatedFromUserId:
        typeof payload.impersonatedFromUserId === 'string' ? payload.impersonatedFromUserId : undefined,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export type AuthContext = {
  /** Utilisateur effectif (le propriétaire imité le cas échéant). */
  userId: string;
  name: string;
  email: string;
  role: string;
  orgId: string | null;
  /** Personne réellement connectée (le superadmin pendant une imitation). */
  actorId: string;
  actorName: string;
  actorEmail: string;
  isSuperadmin: boolean;
  impersonating: boolean;
  orgSuspended: boolean;
};

/**
 * Contexte d'authentification revérifié en base : un compte supprimé, un superadmin
 * révoqué ou une organisation suspendue perdent l'accès immédiatement, sans attendre
 * l'expiration du jeton. Utilisable hors requête (revérification des flux SSE).
 */
export async function resolveAuth(session: SessionPayload): Promise<AuthContext | null> {
  if (session.impersonatedFromUserId) {
    const [actor, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.impersonatedFromUserId } }),
      prisma.user.findUnique({ where: { id: session.userId }, include: { organization: true } }),
    ]);
    if (!actor?.isSuperadmin || !target) return null;
    // La personne réellement connectée est le superadmin : c'est son mot de passe qui compte.
    if (isSessionStale(session.iat, actor.passwordChangedAt)) return null;
    return {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      orgId: target.orgId,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      isSuperadmin: true,
      impersonating: true,
      orgSuspended: !!target.organization?.suspended,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, include: { organization: true } });
  if (!user) return null;
  if (isSessionStale(session.iat, user.passwordChangedAt)) return null;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    isSuperadmin: user.isSuperadmin,
    impersonating: false,
    orgSuspended: !!user.organization?.suspended,
  };
}

/** Contexte de la requête courante (mis en cache le temps du rendu). */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const session = await getSession();
  return session ? resolveAuth(session) : null;
});
