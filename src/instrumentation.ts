// Démarrage du serveur Node : tâches de fond (purge quotidienne des données expirées).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.RETENTION_SCHEDULER !== 'off') {
    const { startRetentionScheduler } = await import('./lib/retention-scheduler');
    startRetentionScheduler();
  }
}
