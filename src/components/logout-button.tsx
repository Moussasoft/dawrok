import { useLocale, useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';

/** Déconnexion par formulaire (fonctionne sans JS) ; la langue est conservée à la redirection. */
export function LogoutButton() {
  const locale = useLocale();
  const t = useTranslations('nav');
  return (
    <form action="/api/auth/logout" method="POST">
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        aria-label={t('logout')}
        title={t('logout')}
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-5 w-5 rtl:-scale-x-100" />
      </button>
    </form>
  );
}
