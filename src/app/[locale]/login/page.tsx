import { getTranslations } from 'next-intl/server';
import { getAuth } from '@/lib/auth';
import { redirectTo } from '@/i18n/server';
import { LoginForm } from './login-form';

export async function generateMetadata() {
  const t = await getTranslations('login');
  return { title: t('title') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const [auth, sp] = await Promise.all([getAuth(), searchParams]);
  // Déjà connecté (et non suspendu) : inutile de revoir le formulaire.
  if (auth && !(auth.orgSuspended && !auth.isSuperadmin) && (auth.orgId || auth.isSuperadmin)) {
    return redirectTo(auth.orgId ? '/dashboard' : '/admin');
  }
  return <LoginForm suspended={sp.reason === 'suspended'} />;
}
