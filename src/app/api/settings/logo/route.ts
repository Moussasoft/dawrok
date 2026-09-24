import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, route } from '@/lib/api';
import { requireOrgRole } from '@/lib/guards';
import { assertFeature } from '@/lib/plans';
import { InvalidImageError, MAX_UPLOAD_BYTES, processLogo } from '@/lib/images';
import { publishBranchUpdate } from '@/lib/queue';
import { audit } from '@/lib/audit';

async function republish(orgId: string) {
  const branches = await prisma.branch.findMany({ where: { orgId }, select: { id: true } });
  await Promise.all(branches.map((b) => publishBranchUpdate(b.id)));
}

// Envoi du logo (multipart, champ « logo ») : réservé au propriétaire, selon l'offre.
export const POST = route(async (req) => {
  const auth = await requireOrgRole('owner');
  await assertFeature(auth.orgId, 'allowCustomBrand');
  const form = await req.formData().catch(() => null);
  const file = form?.get('logo');
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, 'invalid_image');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'image_too_large', { max: 2 });

  let processed;
  try {
    processed = await processLogo(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof InvalidImageError) throw new ApiError(400, 'invalid_image');
    throw e;
  }
  const logoUrl = `/api/orgs/${auth.orgId}/logo?v=${Date.now()}`;
  await prisma.organization.update({
    where: { id: auth.orgId },
    data: { logoData: processed.data, logoMime: processed.mime, logoUrl },
  });
  await audit({ action: 'org.logo', actor: auth, orgId: auth.orgId, targetType: 'organization', targetId: auth.orgId });
  await republish(auth.orgId);
  return NextResponse.json({ ok: true, logoUrl });
});

export const DELETE = route(async () => {
  const auth = await requireOrgRole('owner');
  await prisma.organization.update({ where: { id: auth.orgId }, data: { logoData: null, logoMime: null, logoUrl: null } });
  await republish(auth.orgId);
  return NextResponse.json({ ok: true });
});
