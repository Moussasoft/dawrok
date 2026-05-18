import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export default async function PosterPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branch = await prisma.branch.findFirst({
    where: { orgId: session.orgId },
    include: { organization: true },
  });
  if (!branch) redirect('/dashboard');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/q/${branch.qrToken}`;
  const brand = branch.organization.brandColor || '#6366F1';

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '20px 0' }}>
      <div className="no-print" style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}>
        <PrintButton color={brand} />
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
          fontFamily: 'Inter, system-ui, sans-serif',
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
          <div
            style={{
              display: 'inline-block',
              padding: '6px 18px',
              borderRadius: '999px',
              background: brand,
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '20px',
            }}
          >
            {branch.organization.name}
          </div>
          <h1 style={{ fontSize: '60px', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.05 }}>
            Plus jamais de file !
          </h1>
          <p style={{ fontSize: '22px', color: '#555', margin: 0 }}>
            Scannez et prenez votre tour à distance.
          </p>
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
            src={`/api/qr/${branch.qrToken}`}
            alt="QR"
            style={{ display: 'block', width: '110mm', height: '110mm' }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {[
            ['1', 'Scannez', 'Le QR ci-dessus avec votre téléphone'],
            ['2', 'Patientez', 'Suivez votre tour en direct'],
            ['3', 'Soyez prévenu', 'Notification dès que c\u2019est votre tour'],
          ].map(([n, t, d]) => (
            <div
              key={n}
              style={{
                textAlign: 'center',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '14px',
              }}
            >
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
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{t}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{d}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, marginTop: 12 }}>
          <div style={{ fontSize: '13px', color: '#444' }}>
            Ou ouvrez cette adresse dans votre navigateur :
          </div>
          <div
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px', marginTop: '4px' }}
          >
            {url}
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#999',
              letterSpacing: '0.1em',
            }}
          >
            Powered by Daourak
          </div>
        </div>
      </div>
    </div>
  );
}
