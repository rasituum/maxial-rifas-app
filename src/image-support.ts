import { mkdtemp, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processImage } from './image-processing.js';

/** Decode real HEIC pixels at startup; an advertised HEIF loader alone is insufficient. */
export async function checkImageSupport(source = fileURLToPath(new URL('../assets/heic-probe.heic', import.meta.url))): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-codec-'));
  const destination = join(directory, 'probe.png');
  try {
    await (await open(destination, 'wx', 0o600)).close();
    await processImage(source, destination);
  } catch (error) {
    console.error('HEIC startup check failed: install Sharp against HEIC/HEVC-enabled libvips. See docs/image-processing.md.');
    throw error;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
