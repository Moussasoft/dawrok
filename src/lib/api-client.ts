'use client';
// Appels API côté client : renvoie un code d'erreur stable, traduit via `errors.<code>`.
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; details: Record<string, unknown> };

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  init: Omit<RequestInit, 'body'> & { json?: unknown } = {}
): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: 'network', details: {} };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { error, ...details } = body;
    return { ok: false, status: res.status, error: typeof error === 'string' ? error : 'generic', details };
  }
  return { ok: true, data: body as T };
}

/** Traduit un code d'erreur API (avec ses paramètres, ex. `limit`). */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return useCallback(
    (result: { error: string; details?: Record<string, unknown> }) => {
      const params = Object.fromEntries(
        Object.entries(result.details ?? {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      ) as Record<string, string | number>;
      return t.has(result.error) ? t(result.error, params) : t('generic');
    },
    [t]
  );
}
