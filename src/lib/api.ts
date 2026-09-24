// Helpers communs aux route handlers : erreurs typées avec un code stable
// (traduit côté client via `errors.<code>`), validation Zod et gestion d'exceptions.
import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra?: Record<string, unknown>
  ) {
    super(code);
  }
}

export function jsonError(status: number, code: string, extra?: Record<string, unknown>) {
  const headers: Record<string, string> = {};
  if (status === 429 && typeof extra?.retryAfter === 'number') headers['Retry-After'] = String(extra.retryAfter);
  return NextResponse.json({ error: code, ...extra }, { status, headers });
}

/** Enveloppe un handler : convertit les ApiError en réponses JSON et journalise le reste. */
export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return jsonError(e.status, e.code, e.extra);
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, e);
      return jsonError(500, 'server_error');
    }
  };
}

export async function parseBody<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'invalid_data', { fields: Object.keys(parsed.error.flatten().fieldErrors) });
  }
  return parsed.data;
}

export function appUrl(req?: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || req?.nextUrl.origin || 'http://localhost:3000';
}
