import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Shield } from 'lucide-react';

/** Bandeau affiché tant qu'un superadmin navigue « en tant que » une organisation. */
export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-medium">
        <Shield className="h-5 w-5 shrink-0" />
        <span>
          {t('impersonating')} — {t('connectedAs')} <strong>{orgName}</strong>
        </span>
      </div>
      <form action="/api/admin/impersonate/stop" method="POST">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md bg-amber-950 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('exitImpersonation')}
        </button>
      </form>
    </div>
  );
}
