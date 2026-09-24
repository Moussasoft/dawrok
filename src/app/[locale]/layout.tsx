import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Noto_Kufi_Arabic } from 'next/font/google';
import { routing } from '@/i18n/routing';
import '../globals.css';
import { Providers } from '@/components/providers';
import { pickClientMessages } from '@/i18n/client-messages';

// Polices auto-hébergées par Next (aucune requête vers Google côté visiteur, pas de décalage de mise en page).
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const kufi = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const th = await getTranslations({ locale, namespace: 'hero' });
  return {
    title: { default: `${t('siteName')} — ${t('tagline')}`, template: `%s · ${t('siteName')}` },
    description: th('description'),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: t('siteName'), statusBarStyle: 'default' },
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  };
}

// Le zoom reste autorisé (accessibilité — WCAG 1.4.4).
export const viewport: Viewport = {
  themeColor: '#6366F1',
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${kufi.variable}`} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={pickClientMessages(messages)}>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
