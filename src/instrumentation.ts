// Démarrage du serveur Node : contrôles de configuration, tâches de fond, supervision des erreurs.
import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // Mieux vaut refuser de démarrer que de servir des sessions forgeables.
  if (process.env.NODE_ENV === 'production') {
    const { isWeakJwtSecret } = await import('./lib/secrets');
    if (isWeakJwtSecret(process.env.JWT_SECRET)) {
      console.error('[config] JWT_SECRET absent ou trop faible : 32 caractères aléatoires minimum (openssl rand -base64 48).');
      process.exit(1);
    }
  }

  const { hasOutdatedZoneRules } = await import('./lib/time');
  if (hasOutdatedZoneRules()) {
    console.warn(`[time] Base tz de Node dépassée (${process.versions.tz}) : l'heure du Maroc est corrigée par l'application. Mettre Node à jour.`);
  }

  if (process.env.RETENTION_SCHEDULER !== 'off') {
    const { startRetentionScheduler } = await import('./lib/retention-scheduler');
    startRetentionScheduler();
  }
}

// Erreurs non interceptées des pages, routes et middleware (les routes API passent par route()).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportError } = await import('./lib/monitoring');
  reportError(error, {
    source: context.routeType,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    digest: (error as { digest?: string }).digest,
  });
};
