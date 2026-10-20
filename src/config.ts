import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { validHash } from './password.js';
export interface Config {
  username: string; passwordHash: string; sessionSecret: string;
  photoDirectory: string; port: number; production: boolean; origin: string;
}
export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<Config> {
  function required(name: string): string {
    const value = env[name];
    if (!value?.trim()) throw new Error(`Missing configuration: ${name}`);
    return value;
  }
  const username = required('APP_USERNAME');
  const passwordHash = required('APP_PASSWORD_HASH');
  if (!validHash(passwordHash)) throw new Error('Invalid APP_PASSWORD_HASH');
  const sessionSecret = required('SESSION_SECRET');
  if (Buffer.byteLength(sessionSecret) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes');
  const portText = env.PORT ?? '3000';
  if (!/^\d+$/.test(portText) || +portText < 1 || +portText > 65535) throw new Error('Invalid PORT');
  if (env.NODE_ENV && !['development', 'test', 'production'].includes(env.NODE_ENV)) throw new Error('Invalid NODE_ENV');
  const production = env.NODE_ENV === 'production';
  const originText = required('APP_ORIGIN');
  const url = new URL(originText);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== originText || url.username || url.password || (production && url.protocol !== 'https:')) throw new Error('Invalid APP_ORIGIN');
  const photoDirectory = await realpath(required('PHOTO_DIRECTORY'));
  if (!(await stat(photoDirectory)).isDirectory()) throw new Error('PHOTO_DIRECTORY must be a directory');
  await access(photoDirectory, constants.R_OK | constants.X_OK);
  return { username, passwordHash, sessionSecret, photoDirectory, port: +portText, production, origin: url.origin };
}
