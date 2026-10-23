import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { optimizeImage } from '../dist/image-worker.js';
import { processImage } from '../dist/image-processing.js';
import { checkImageSupport } from '../dist/image-support.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-images-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
test('real HEIC/HEVC startup probe succeeds and missing/invalid codec fixture fails', async t => {
  const directory = await fixture(t);
  await checkImageSupport();
  const invalid = join(directory, 'bad.heic'); await writeFile(invalid, 'bad');
  await assert.rejects(checkImageSupport(invalid));
  assert.equal((await sharp('assets/heic-probe.heic').metadata()).compression, 'hevc');
});
test('HEIF selects the primary image rather than first page or auxiliary images', async () => {
  const metadata = await sharp('test/fixtures/primary-second.heic').metadata();
  assert.equal(metadata.hasAlpha, true);
  assert.equal(metadata.pages, 2); assert.equal(metadata.pagePrimary, 1);
  const output = await optimizeImage('test/fixtures/primary-second.heic');
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64); assert.equal(info.height, 32);
  assert.ok(data[2]! > data[0]!, 'primary blue photo must be selected instead of first red photo');
  assert.ok(output.length < 100_000);
});
test('phone orientation and source metadata are applied then discarded without crop or enlargement', async t => {
  const directory = await fixture(t);
  const source = join(directory, 'oriented.jpg');
  await sharp({ create: { width: 80, height: 40, channels: 3, background: '#aa7733' } })
    .withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'fixture author' } }).jpeg().toFile(source);
  const output = await optimizeImage(source);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 40); assert.equal(metadata.height, 80);
  assert.equal(metadata.orientation, undefined); assert.equal(metadata.exif, undefined);
  assert.equal(metadata.format, 'png');
  const heic = await optimizeImage('test/fixtures/oriented.heic');
  const heicMetadata = await sharp(heic).metadata();
  assert.equal(heicMetadata.width, 32); assert.equal(heicMetadata.height, 64);
});
test('PNG alpha is retained and high-entropy phone-sized input is resized before palette encoding', async t => {
  const directory = await fixture(t);
  const alpha = join(directory, 'alpha.png');
  await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.3 } } }).png().toFile(alpha);
  const alphaOutput = await optimizeImage(alpha);
  assert.equal((await sharp(alphaOutput).metadata()).hasAlpha, true);
  const noisy = join(directory, 'noisy.png');
  await sharp(randomBytes(2400 * 1600 * 3), { raw: { width: 2400, height: 1600, channels: 3 } }).png().toFile(noisy);
  const output = await optimizeImage(noisy);
  const metadata = await sharp(output).metadata();
  assert.ok(output.length < 100_000);
  assert.ok(metadata.width! <= 2048); assert.ok(Math.abs(metadata.width! / metadata.height! - 1.5) < 0.01);
});
test('worker rejects corrupt and unsupported content and terminates on deadline/abort', async t => {
  const directory = await fixture(t);
  const output = join(directory, 'out.png'); await (await open(output, 'wx')).close();
  const bad = join(directory, 'fake.png'); await writeFile(bad, '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>');
  await assert.rejects(processImage(bad, output));
  await assert.rejects(processImage('assets/heic-probe.heic', output, undefined, 1));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(processImage('assets/heic-probe.heic', output, controller.signal));
  assert.equal((await stat(output)).size, 0);
  await processImage('assets/heic-probe.heic', output);
  assert.equal((await sharp(await readFile(output)).metadata()).format, 'png');
});
test('declared decoded-pixel excess fails before allocating full image', async t => {
  const directory = await fixture(t);
  const source = join(directory, 'too-many-pixels.png');
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
  png.writeUInt32BE(10001, 16); png.writeUInt32BE(10000, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  await writeFile(source, png);
  await assert.rejects(optimizeImage(source), /pixel limit/i);
});

test('startup fails when the actual HEVC plugin is unavailable', async t => {
  const directory = await fixture(t);
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e', "import { checkImageSupport } from './dist/image-support.js'; await checkImageSupport();"], {
    env: { ...process.env, LIBHEIF_PLUGIN_PATH: directory }
  }));
});
