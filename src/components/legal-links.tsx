import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Liens vers la politique de confidentialité et les conditions (pieds de page publics). */
export function LegalLinks({ className }: { className?: string }) {
  const t = useTranslations('legal');
  return (
    <nav aria-label={t('navLabel')} className={cn('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <Link href="/privacy" className="hover:text-foreground hover:underline">
        {t('privacyLink')}
      </Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="hover:text-foreground hover:underline">
        {t('termsLink')}
      </Link>
    </nav>
  );
}
