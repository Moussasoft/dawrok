// Supervision des erreurs serveur : une ligne JSON par erreur en production (collectée par la plateforme
// d'hébergement) et, si ERROR_WEBHOOK_URL est défini, une alerte (Slack, Discord ou tout collecteur JSON).
// Les chemins sont journalisés sans leur query string (jetons de réinitialisation, d'invitation…).

export type ErrorContext = { source: string; method?: string; path?: string; routePath?: string; digest?: string };

const WINDOW_MS = 60_000;
const MAX_ALERTS_PER_WINDOW = 20;
const lastSent = new Map<string, number>();
let windowStart = 0;
let sentInWindow = 0;

export function stripQuery(path: string | undefined): string | undefined {
  return path?.split('?')[0];
}

/** Anti-tempête : une même erreur au plus une fois par minute, 20 alertes par minute au total. */
export function shouldAlert(key: string, now = Date.now()): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    sentInWindow = 0;
  }
  const last = lastSent.get(key);
  if ((last !== undefined && now - last < WINDOW_MS) || sentInWindow >= MAX_ALERTS_PER_WINDOW) return false;
  lastSent.set(key, now);
  sentInWindow++;
  if (lastSent.size > 500) for (const [k, t] of lastSent) if (now - t >= WINDOW_MS) lastSent.delete(k);
  return true;
}

export function reportError(error: unknown, context: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry = {
    level: 'error',
    time: new Date().toISOString(),
    message: err.message.trim(),
    ...context,
    path: stripQuery(context.path),
    stack: err.stack,
  };
  if (process.env.NODE_ENV === 'production') console.error(JSON.stringify(entry));
  else console.error(`[${context.source}] ${context.method ?? ''} ${entry.path ?? ''}`.trim(), err);

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url || !shouldAlert(`${context.source}:${entry.path}:${err.message}`)) return;
  const text = `🚨 Daourak — ${entry.message}\n${context.method ?? ''} ${entry.routePath ?? entry.path ?? ''} (${context.source})${context.digest ? ` · digest ${context.digest}` : ''}`;
  // `text` pour Slack, `content` pour Discord, `error` pour un collecteur générique. Jamais bloquant.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text, error: { ...entry, stack: undefined } }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}
