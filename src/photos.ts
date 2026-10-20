import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
export function normalizeNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[0-9]{1,4}$/.test(trimmed) ? trimmed.padStart(4, '0') : null;
}
export async function openPhoto(directory: string, number: string) {
  if (!/^[0-9]{4}$/.test(number)) throw new Error('Invalid normalized number');
  const handle = await open(join(directory, `${number}.png`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!(await handle.stat()).isFile()) throw new Error('Photo is not a regular file');
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}
export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
