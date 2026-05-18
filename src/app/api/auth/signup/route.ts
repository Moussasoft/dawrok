import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { slugify } from '@/lib/utils';

const schema = z.object({
  orgName: z.string().min(2).max(100),
  sector: z.string().default('other'),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const SECTOR_PRESETS: Record<string, { services: { name: string; durationMin: number }[]; branchName: string }> = {
  hairdresser: {
    branchName: 'Salon principal',
    services: [
      { name: 'Coupe homme', durationMin: 25 },
      { name: 'Coupe + barbe', durationMin: 40 },
      { name: 'Coloration', durationMin: 60 },
    ],
  },
  doctor: {
    branchName: 'Cabinet',
    services: [
      { name: 'Consultation', durationMin: 20 },
      { name: 'Renouvellement', durationMin: 10 },
    ],
  },
  vehicle_inspection: {
    branchName: 'Centre de visite',
    services: [
      { name: 'Auto', durationMin: 25 },
      { name: 'Moto', durationMin: 15 },
      { name: 'Poids lourd', durationMin: 45 },
    ],
  },
  bank: {
    branchName: 'Agence',
    services: [
      { name: 'Caisse', durationMin: 8 },
      { name: 'Conseiller', durationMin: 25 },
    ],
  },
  restaurant: {
    branchName: 'Service',
    services: [{ name: 'Table', durationMin: 60 }],
  },
  other: {
    branchName: 'Point de service',
    services: [{ name: 'Service standard', durationMin: 20 }],
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }
  const { orgName, sector, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 });
  }

  const baseSlug = slugify(orgName) || 'org';
  let slug = baseSlug;
  let i = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const preset = SECTOR_PRESETS[sector] ?? SECTOR_PRESETS.other;
  const passwordHash = await bcrypt.hash(password, 10);

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      sector,
      users: { create: { email, passwordHash, name, role: 'owner' } },
      branches: {
        create: {
          name: preset.branchName,
          services: { create: preset.services.map((s) => ({ name: s.name, avgDurationMin: s.durationMin })) },
          employees: { create: { name } },
        },
      },
    },
    include: { users: true },
  });

  const user = org.users[0];
  const token = await createSession({
    userId: user.id,
    orgId: org.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, slug });
}
