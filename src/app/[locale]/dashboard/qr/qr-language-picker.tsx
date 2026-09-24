'use client';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, routing } from '@/i18n/routing';

export function QrLanguagePicker({ label, value }: { label: string; value: string }) {
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => router.replace({ pathname, query: { lang: e.target.value } })}
        className="rounded-lg border bg-background px-2 py-1 font-medium"
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
