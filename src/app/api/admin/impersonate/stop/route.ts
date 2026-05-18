import { NextResponse } from 'next/server';
import { getSession, createSession, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';

// Restore the original superadmin session.
export async function POST() {
  const session = await getSession();
  if (!session?.impersonatedFromUserId) {
    return NextResponse.redirect(new URL('/admin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
  const original = await prisma.user.findUnique({ where: { id: session.impersonatedFromUserId } });
  if (!original) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
  const token = await createSession({
    userId: original.id,
    orgId: original.orgId,
    email: original.email,
    name: original.name,
    role: original.role,
    isSuperadmin: original.isSuperadmin,
  });
  await setSessionCookie(token);
  await audit({
    action: 'impersonate.stop',
    session: { ...session, userId: original.id, isSuperadmin: original.isSuperadmin },
    orgId: session.orgId,
    metadata: { stoppedFromOrgId: session.orgId },
  });
  return NextResponse.redirect(new URL('/admin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
