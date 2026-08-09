'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';

const FLAGS: Record<string, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  ar: '🇸🇦',
};

const LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      {(['fr', 'en', 'ar'] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          disabled={isPending}
          title={LABELS[l]}
          className={`px-2.5 py-1.5 text-sm rounded-lg transition-all font-medium ${
            locale === l
              ? 'bg-primary/10 text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <span className="text-base mr-1">{FLAGS[l]}</span>
          <span className="hidden sm:inline">{LABELS[l]}</span>
        </button>
      ))}
    </div>
  );
}
