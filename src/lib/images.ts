// Traitement des images envoyées (logo) : formats bitmap uniquement (pas de SVG, vecteur de XSS),
// réorientation EXIF, redimensionnement et conversion en WebP (transparence conservée).
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif']);

export class InvalidImageError extends Error {}

export async function processLogo(input: Buffer): Promise<{ data: Buffer; mime: string }> {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new InvalidImageError('unreadable');
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new InvalidImageError(`format ${format}`);
  const data = await sharp(input, { animated: false })
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  return { data, mime: 'image/webp' };
}
