'use client';
// Le navigateur du client mémorise SON ticket pour le retrouver (au lieu d'un
// « ticket existant » renvoyé par numéro de téléphone, qui exposait celui des autres).

type Stored = { code: string; until: number };

const key = (qrToken: string) => `daourak:ticket:${qrToken}`;

export function rememberTicket(qrToken: string, code: string, scheduledFor?: string | null) {
  const base = scheduledFor ? Date.parse(scheduledFor) : Date.now();
  const until = base + 24 * 3600_000;
  try {
    localStorage.setItem(key(qrToken), JSON.stringify({ code, until } satisfies Stored));
  } catch {
    /* stockage indisponible (navigation privée) */
  }
}

export function recallTicket(qrToken: string): string | null {
  try {
    const raw = localStorage.getItem(key(qrToken));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (!stored.code || stored.until < Date.now()) {
      localStorage.removeItem(key(qrToken));
      return null;
    }
    return stored.code;
  } catch {
    return null;
  }
}
