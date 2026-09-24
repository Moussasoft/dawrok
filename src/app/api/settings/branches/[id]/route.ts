import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, parseBody, route } from '@/lib/api';
import { requireOrg } from '@/lib/guards';
import { requireOwnBranch } from '@/lib/branch';
import { openHoursSchema } from '@/lib/opening-hours';
import { isValidTimeZone } from '@/lib/time';
import { publishBranchUpdate } from '@/lib/queue';
import { assertCanAdd } from '@/lib/plans';

const schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  timezone: z.string().min(1).max(60).optional(),
  openHours: openHoursSchema.nullable().optional(),
  allowBooking: z.boolean().optional(),
  bookingSlotMin: z.number().int().min(5).max(120).optional(),
  active: z.boolean().optional(),
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const auth = await requireOrg();
  const { id } = await ctx.params;
  const branch = await requireOwnBranch(auth, id);
  const { openHours, timezone, ...rest } = await parseBody(req, schema);
  if (timezone && !isValidTimeZone(timezone)) throw new ApiError(400, 'invalid_timezone');
  if (rest.active === true && !branch.active) await assertCanAdd(auth.orgId, 'branches');

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      ...rest,
      ...(timezone && { timezone }),
      ...(openHours !== undefined && { openHours: openHours ? JSON.stringify(openHours) : null }),
    },
  });
  await publishBranchUpdate(id);
  return NextResponse.json(updated);
});
