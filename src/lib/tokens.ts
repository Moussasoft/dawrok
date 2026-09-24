// Jetons à usage unique (réinitialisation, invitations) : seul le hash est stocké en base,
// une fuite de la base ne donne donc pas de lien exploitable.
import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createToken(bytes = 32): { token: string; hash: string } {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

/**
 * Une session émise avant un changement de mot de passe est révoquée.
 * Tolérance d'1 s : `iat` est en secondes, `changedAt` en millisecondes.
 */
export function isSessionStale(issuedAtSec: number | undefined, changedAt: Date | null | undefined): boolean {
  if (!issuedAtSec || !changedAt) return false;
  return issuedAtSec * 1000 < changedAt.getTime() - 1000;
}
