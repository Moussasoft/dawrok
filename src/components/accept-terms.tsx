'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/** Case d'acceptation des conditions et de la politique de confidentialité (liens dans un nouvel onglet). */
export function AcceptTerms({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useTranslations('legal');
  const link = (href: '/terms' | '/privacy') =>
    function LegalLink(chunks: React.ReactNode) {
      return (
        <Link href={href} target="_blank" className="text-primary underline-offset-2 hover:underline">
          {chunks}
        </Link>
      );
    };
  return (
    <label className="flex items-start gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-input accent-primary"
      />
      <span>{t.rich('acceptTerms', { terms: link('/terms'), privacy: link('/privacy') })}</span>
    </label>
  );
}
