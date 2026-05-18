import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function requireSuperadmin() {
  const session = await getSession();
  if (!session || !session.isSuperadmin) {
    return { session: null, response: NextResponse.json({ error: 'Interdit' }, { status: 403 }) };
  }
  return { session, response: null as null | NextResponse };
}
