import { getTranslations } from 'next-intl/server';
import { LegalDocument } from '@/components/legal-document';

// Rendu à la demande : l'éditeur, le contact et le n° CNDP viennent des variables d'environnement d'exécution.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('legal');
  return { title: t('privacyTitle') };
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}
