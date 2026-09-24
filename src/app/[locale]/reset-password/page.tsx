import { getTranslations } from 'next-intl/server';
import { ResetPasswordForm } from './reset-password-form';

export async function generateMetadata() {
  const t = await getTranslations('reset');
  return { title: t('title'), robots: { index: false } };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ''} />;
}
