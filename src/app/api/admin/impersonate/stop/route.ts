import { NextRequest, NextResponse } from 'next/server';
import { getAuth, createSession, setSessionCookie, clearSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { routing } from '@/i18n/routing';

function localized(req: NextRequest, locale: string | null, path: string) {
  const valid = locale && (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  return new URL(valid === routing.defaultLocale ? path : `/${valid}${path}`, req.url);
}

// Retour à la session superadmin d'origine (formulaire POST depuis la bannière d'imitation).
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const locale = typeof form?.get('locale') === 'string' ? (form!.get('locale') as string) : null;

  const auth = await getAuth();
  if (!auth?.impersonating) {
    if (!auth) await clearSession();
    return NextResponse.redirect(localized(req, locale, auth ? '/admin' : '/login'), 303);
  }

  await setSessionCookie(await createSession({ userId: auth.actorId }));
  await audit({
    action: 'impersonate.stop',
    actor: auth,
    orgId: auth.orgId,
    targetType: 'organization',
    targetId: auth.orgId ?? undefined,
  });
  return NextResponse.redirect(localized(req, locale, '/admin/orgs'), 303);
}
