import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { InvalidImageError, processLogo } from './images';

describe('processLogo', () => {
  it('redimensionne en WebP 512 px max en conservant les proportions', async () => {
    const png = await sharp({ create: { width: 1200, height: 600, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 1 } } })
      .png()
      .toBuffer();
    const { data, mime } = await processLogo(png);
    const meta = await sharp(data).metadata();
    expect(mime).toBe('image/webp');
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(256);
  });

  it('refuse un SVG (vecteur de XSS) et un fichier non image', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(processLogo(svg)).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processLogo(Buffer.from('pas une image'))).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('n’agrandit pas une petite image', async () => {
    const small = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const meta = await sharp((await processLogo(small)).data).metadata();
    expect(meta.width).toBe(64);
  });
});
