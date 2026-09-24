import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';
import { routing } from '@/i18n/routing';

function localizedPath(locale: string | null, path: string) {
  const valid = locale && (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  return valid === routing.defaultLocale ? path : `/${valid}${path}`;
}

// Appelé soit par un <form method="POST"> (on redirige), soit par fetch (on répond en JSON).
// Avant, la soumission du formulaire affichait `{"ok":true}` à l'utilisateur.
export async function POST(req: NextRequest) {
  await clearSession();
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const locale = form?.get('locale');
    return NextResponse.redirect(new URL(localizedPath(typeof locale === 'string' ? locale : null, '/login'), req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
