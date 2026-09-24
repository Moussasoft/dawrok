import bcrypt from 'bcryptjs';

export const MIN_PASSWORD_LENGTH = 8;
/** Les comptes superadmin exigent un mot de passe plus long. */
export const MIN_SUPERADMIN_PASSWORD_LENGTH = 12;

export function minPasswordLength(isSuperadmin: boolean): number {
  return isSuperadmin ? MIN_SUPERADMIN_PASSWORD_LENGTH : MIN_PASSWORD_LENGTH;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
