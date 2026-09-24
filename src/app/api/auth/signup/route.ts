import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { ApiError, parseBody, route } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { SECTORS, getSectorPreset } from '@/lib/sectors';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { routing } from '@/i18n/routing';

const schema = z.object({
  orgName: z.string().trim().min(2).max(100),
  sector: z.enum(SECTORS).default('other'),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(100),
  locale: z.enum(routing.locales).optional(),
});

export const POST = route(async (req) => {
  enforceRateLimit(`signup:ip:${clientIp(req)}`, 5, 60 * 60_000);
  const { orgName, sector, name, email: rawEmail, password, locale } = await parseBody(req, schema);
  const email = rawEmail.toLowerCase();

  const taken = await prisma.user.findFirst({ where: { email: { in: Array.from(new Set([rawEmail, email])) } } });
  if (taken) throw new ApiError(409, 'email_taken');

  // Prestations de départ nommées dans la langue de l'inscription.
  const preset = getSectorPreset(sector, locale ?? routing.defaultLocale);
  const passwordHash = await bcrypt.hash(password, 12);
  // Un nom en arabe donne un slug vide : on complète par un suffixe aléatoire plutôt que
  // de produire « org », « org-2 »… jusqu'à épuisement des tentatives.
  const baseSlug = slugify(orgName);
  const suffix = () => crypto.randomBytes(3).toString('hex');

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = attempt === 0 && baseSlug ? baseSlug : `${baseSlug || 'org'}-${suffix()}`;
    try {
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
      await setSessionCookie(await createSession({ userId: org.users[0].id }));
      return NextResponse.json({ ok: true, slug });
    } catch (e) {
      // Collision de slug (ou d'email en concurrence) : on réessaie / on signale.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String((e.meta as { target?: unknown })?.target ?? '');
        if (target.includes('email')) throw new ApiError(409, 'email_taken');
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(409, 'slug_unavailable');
});
