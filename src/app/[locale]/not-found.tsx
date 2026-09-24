import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main className="min-h-screen gradient-mesh flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="text-7xl font-black text-primary/80 tabular-nums">404</div>
        <h1 className="mt-4 text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
        <Button asChild className="mt-6">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </main>
  );
}
