import { getTranslations } from 'next-intl/server';
import { requireOrgPage } from '@/lib/guards';
import { AccountView } from './account-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('title') };
}

// Accessible à tous les rôles : chacun gère son propre compte.
export default async function AccountPage() {
  const auth = await requireOrgPage();
  const t = await getTranslations('account');
  return (
    <div className="container max-w-3xl py-6">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      {auth.impersonating ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t('impersonatingNote')}</p>
      ) : (
        <AccountView account={{ name: auth.actorName, email: auth.actorEmail }} />
      )}
    </div>
  );
}
