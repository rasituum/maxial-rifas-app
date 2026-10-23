import sharp from 'sharp';
import { open } from 'node:fs/promises';

sharp.cache(false);
sharp.concurrency(1);
export const MAX_PIXELS = 100_000_000;
export const OUTPUT_LIMIT = 100_000;

/** Decode the primary still image and optimize from the source on every attempt. */
export async function optimizeImage(source: string): Promise<Buffer> {
  const options = { limitInputPixels: MAX_PIXELS, failOn: 'warning' as const };
  const metadata = await sharp(source, options).metadata();
  if (!['png', 'jpeg', 'heif'].includes(metadata.format ?? '') ||
      (metadata.format === 'heif' && metadata.compression !== 'hevc')) {
    throw new Error('Unsupported image');
  }
  const selected = { ...options, page: metadata.pagePrimary ?? 0, pages: 1 };
  const attempts: { size: number; colours?: number }[] = [2048, 1600, 1280, 1024].map(size => ({ size }));
  for (const size of [1024, 768, 512, 320]) for (const colours of [256, 128, 64]) attempts.push({ size, colours });
  for (const { size, colours } of attempts) {
    const output = await sharp(source, selected).autoOrient().toColourspace('srgb')
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, ...(colours ? { palette: true, colours, effort: 7 } : {}) }).toBuffer();
    if (output.length < OUTPUT_LIMIT) return output;
  }
  throw new Error('No compliant output');
}

if (process.send) {
  process.once('message', async (message: { source: string; destination: string }) => {
    try {
      const buffer = await optimizeImage(message.source);
      const file = await open(message.destination, 'r+');
      try { await file.writeFile(buffer); await file.sync(); } finally { await file.close(); }
      process.send?.({ ok: true }, () => process.exit(0));
    } catch {
      console.error('upload:image-processing-failed');
      process.send?.({ ok: false }, () => process.exit(1));
    }
  });
}
