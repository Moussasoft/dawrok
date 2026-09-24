import { getLocale, getTranslations } from 'next-intl/server';
import { requireOrgPage } from '@/lib/guards';
import { getActiveBranch } from '@/lib/branch';
import { prisma } from '@/lib/db';
import { redirectTo } from '@/i18n/server';
import { routing } from '@/i18n/routing';
import { DEFAULT_BRAND_COLOR } from '@/lib/plans';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

// Affiche A4 imprimable, dans la langue de la page (choisie depuis l'écran « QR code »).
export default async function PosterPage() {
  const auth = await requireOrgPage();
  const [branch, t, locale] = await Promise.all([getActiveBranch(auth), getTranslations('poster'), getLocale()]);
  if (!branch) return redirectTo('/dashboard');
  const org = await prisma.organization.findUnique({ where: { id: auth.orgId }, select: { name: true, brandColor: true, logoUrl: true } });

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${base}${locale === routing.defaultLocale ? '' : `/${locale}`}/q/${branch.qrToken}`;
  const brand = org?.brandColor || DEFAULT_BRAND_COLOR;
  const steps = [
    ['1', t('step1Title'), t('step1Desc')],
    ['2', t('step2Title'), t('step2Desc')],
    ['3', t('step3Title'), t('step3Desc')],
  ];

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '20px 0' }}>
      <div className="no-print" style={{ position: 'fixed', top: 12, insetInlineEnd: 12, zIndex: 50 }}>
        <PrintButton color={brand} label={t('print')} />
      </div>

      <div
        className="poster-page"
        style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          background: 'white',
          position: 'relative',
          boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20mm 15mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          color: '#111',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 0% 0%, ${brand}22, transparent 50%), radial-gradient(circle at 100% 100%, ${brand}22, transparent 50%)`,
            pointerEvents: 'none',
          }}
        />

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {org?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" style={{ display: 'block', height: '22mm', margin: '0 auto 12px', objectFit: 'contain' }} />
          )}
          <div
            style={{
              display: 'inline-block',
              padding: '6px 18px',
              borderRadius: '999px',
              background: brand,
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: locale === 'ar' ? 0 : '0.1em',
              textTransform: 'uppercase',
              marginBottom: '20px',
            }}
          >
            {org?.name} · {branch.name}
          </div>
          <h1 style={{ fontSize: '60px', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.15 }}>{t('title')}</h1>
          <p style={{ fontSize: '22px', color: '#555', margin: 0 }}>{t('subtitle')}</p>
        </div>

        <div
          style={{
            padding: '16px',
            background: 'white',
            border: `4px solid ${brand}`,
            borderRadius: '24px',
            boxShadow: `0 0 0 16px ${brand}11`,
            position: 'relative',
            zIndex: 1,
            margin: '12px 0',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr/${branch.qrToken}?locale=${locale}`}
            alt="QR"
            style={{ display: 'block', width: '110mm', height: '110mm' }}
          />
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', width: '100%', position: 'relative', zIndex: 1 }}
        >
          {steps.map(([n, title, desc]) => (
            <div key={n} style={{ textAlign: 'center', padding: '12px', background: '#f9fafb', borderRadius: '14px' }}>
              <div
                style={{
                  margin: '0 auto 6px',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: brand,
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {n}
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, marginTop: 12 }}>
          <div style={{ fontSize: '13px', color: '#444' }}>{t('orOpen')}</div>
          <div dir="ltr" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px', marginTop: '4px' }}>
            {url}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', color: '#999', letterSpacing: '0.1em' }}>Powered by Daourak</div>
        </div>
      </div>
    </div>
  );
}
