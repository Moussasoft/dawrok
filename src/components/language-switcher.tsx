'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { usePathname, useRouter, routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// Sélecteur compact (un drapeau désigne un pays, pas une langue) : tient dans les en-têtes mobiles.
/** `compact` : icône seule (le sélecteur natif, invisible, la recouvre) pour les en-têtes mobiles. */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('language');
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    // Lu au clic (et non via useSearchParams) pour ne pas forcer le rendu dynamique des pages statiques.
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    startTransition(() => {
      router.replace({ pathname, query }, { locale: next });
    });
  }

  return (
    <label
      className={cn(
        'relative inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground',
        isPending && 'opacity-60',
        className
      )}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{t('switch')}</span>
      <select
        value={locale}
        onChange={(e) => switchTo(e.target.value)}
        disabled={isPending}
        aria-label={t('switch')}
        className={
          compact
            ? 'absolute inset-0 h-full w-full cursor-pointer opacity-0'
            : 'cursor-pointer appearance-none bg-transparent pe-1 font-medium text-foreground focus:outline-none'
        }
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
