import { getLocale, getTranslations } from 'next-intl/server';
import { Download, Printer, Tv, Lightbulb } from 'lucide-react';
import { requireOrgPage } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { redirectTo } from '@/i18n/server';
import { Link, routing } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { CopyLink } from './copy-link';
import { QrLanguagePicker } from './qr-language-picker';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('qr');
  return { title: t('title') };
}

export default async function QrPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const auth = await requireOrgPage();
  const [branch, t, locale, sp] = await Promise.all([getActiveBranch(auth), getTranslations('qr'), getLocale(), searchParams]);
  if (!branch) return redirectTo('/dashboard');

  // Langue de la page client encodée dans le QR (par défaut : langue par défaut du site).
  const qrLang = (routing.locales as readonly string[]).includes(sp.lang ?? '') ? sp.lang! : routing.defaultLocale;
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const prefix = qrLang === routing.defaultLocale ? '' : `/${qrLang}`;
  const url = `${base}${prefix}/q/${branch.qrToken}`;
  const qrSrc = `/api/qr/${branch.qrToken}?locale=${qrLang}`;

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-6 text-muted-foreground">{t('description')}</p>

      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <QrLanguagePicker label={t('language')} value={qrLang} />
          <div className="overflow-hidden rounded-2xl border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR code" width={320} height={320} className="block h-72 w-72 sm:h-80 sm:w-80" />
          </div>
          <div className="w-full text-center">
            <div className="text-sm text-muted-foreground">{t('publicLink')}</div>
            <CopyLink url={url} copyLabel={t('copy')} copiedLabel={t('copied')} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={qrSrc}
              download={`daourak-qr-${qrLang}.png`}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" /> {t('download')}
            </a>
            <Link
              href={{ pathname: '/poster', query: { lang: qrLang } }}
              locale={qrLang as (typeof routing.locales)[number]}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Printer className="h-4 w-4" /> {t('poster')}
            </Link>
            <Link
              href={`/screen/${branch.qrToken}`}
              locale={locale as (typeof routing.locales)[number]}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Tv className="h-4 w-4" /> {t('tvScreen')}
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2 rounded-xl bg-muted p-4 text-sm">
        <Lightbulb className="h-5 w-5 flex-shrink-0 text-amber-500" />
        <p>
          <strong>{t('tipTitle')}</strong> {t('tip')}
        </p>
      </div>
    </div>
  );
}
