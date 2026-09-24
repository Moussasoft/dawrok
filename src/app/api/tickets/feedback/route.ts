import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { FEEDBACK_COMMENT_MAX, isFeedbackOpen } from '@/lib/feedback';

const postSchema = z.object({
  publicCode: z.string().min(8).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(FEEDBACK_COMMENT_MAX)
    .optional()
    .transform((v) => v || null),
});

// Le client note son passage depuis sa page de suivi (le publicCode fait office de clé) : un avis par ticket.
export const POST = route(async (req) => {
  enforceRateLimit(`feedback:ip:${clientIp(req)}`, 10, 10 * 60_000);
  const { publicCode, rating, comment } = await parseBody(req, postSchema);

  const ticket = await prisma.ticket.findUnique({
    where: { publicCode },
    select: { id: true, branchId: true, status: true, completedAt: true, feedback: { select: { id: true } } },
  });
  if (!ticket) throw new ApiError(404, 'not_found');
  if (ticket.feedback) throw new ApiError(409, 'feedback_exists');
  if (!isFeedbackOpen(ticket)) throw new ApiError(409, 'feedback_closed');

  try {
    // La contrainte unique couvre le double envoi simultané.
    await prisma.feedback.create({ data: { ticketId: ticket.id, branchId: ticket.branchId, rating, comment } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ApiError(409, 'feedback_exists');
    throw e;
  }
  return NextResponse.json({ ok: true, rating });
});
