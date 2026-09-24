import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LegalLinks } from '@/components/legal-links';
import { LEGAL_UPDATED_AT, legalInfo } from '@/lib/legal';
import { formatDate } from '@/lib/format';

type Doc = 'privacy' | 'terms';

/** Texte légal découpé en sections dans messages/*.json : legal.<doc>.<section>.{title, p1, p2…}. */
export async function LegalDocument({ doc }: { doc: Doc }) {
  const [t, locale] = await Promise.all([getTranslations('legal'), getLocale()]);
  const info = legalInfo();
  const values = { company: info.company, email: info.email, retention: info.retention };
  const sections = Object.entries(t.raw(doc) as Record<string, Record<string, string>>);

  return (
    <main className="gradient-mesh min-h-screen">
      <div className="container mx-auto max-w-3xl py-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('home')}
          </Link>
          <LanguageSwitcher />
        </div>
        <article className="rounded-2xl border bg-card p-6 shadow-sm md:p-10">
          <h1 className="text-3xl font-bold">{t(`${doc}Title`)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('updated', { date: formatDate(LEGAL_UPDATED_AT, locale) })}</p>
          {sections.map(([key, section]) => (
            <section key={key} className="mt-8">
              <h2 className="text-lg font-semibold">{t(`${doc}.${key}.title`)}</h2>
              {Object.keys(section)
                .filter((p) => p !== 'title')
                .map((p) => (
                  <p key={p} className="mt-2 leading-relaxed text-muted-foreground">
                    {t(`${doc}.${key}.${p}`, values)}
                  </p>
                ))}
            </section>
          ))}
          {(info.address || info.cndp) && (
            <footer className="mt-10 space-y-1 border-t pt-4 text-sm text-muted-foreground">
              {info.address && <p>{t('address', { address: info.address })}</p>}
              {info.cndp && <p>{t('cndpDeclared', { number: info.cndp })}</p>}
            </footer>
          )}
        </article>
        <LegalLinks className="mt-6" />
      </div>
    </main>
  );
}
