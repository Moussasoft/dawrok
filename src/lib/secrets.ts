// Contrôle des secrets, partagé entre la vérification au démarrage (instrumentation) et l'authentification.

/** Secret de session trop faible : absent, court ou laissé à sa valeur d'exemple. */
export function isWeakJwtSecret(secret: string | undefined): boolean {
  const s = secret ?? '';
  return s.length < 32 || s.startsWith('change-me');
}
