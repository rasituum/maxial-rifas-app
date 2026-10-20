import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeNumber, openPhoto } from '../dist/photos.js';
import { hashPassword, verifyPassword } from '../dist/password.js';
import { loadConfig } from '../dist/config.js';
import { BoundedSessionStore, LoginLimiter, SESSION_LIFETIME } from '../dist/state.js';
import type { SessionData } from 'express-session';

test('normalizes only one-to-four ASCII digits', () => {
  for (const value of ['7', '07', '0007']) assert.equal(normalizeNumber(value), '0007');
  assert.equal(normalizeNumber(' 42 '), '0042');
  assert.equal(normalizeNumber('0'), '0000');
  assert.equal(normalizeNumber('9999'), '9999');
  for (const value of ['', ' ', '00007', '10000', '-1', '+1', '1.0', '1e2', '../secret', '１２', ['7'], undefined]) assert.equal(normalizeNumber(value), null);
});
test('salted hashes verify without accepting malformed values', async () => {
  const hash = await hashPassword('test-password');
  assert.equal(await verifyPassword('test-password', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.equal(await verifyPassword('test-password', 'bad'), false);
  assert.notEqual(hash, await hashPassword('test-password'));
});
test('configuration validates required values and real directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { APP_USERNAME: 'test', APP_PASSWORD_HASH: await hashPassword('test'), SESSION_SECRET: 'a'.repeat(32), PHOTO_DIRECTORY: directory, APP_ORIGIN: 'http://localhost:3000' };
  assert.equal((await loadConfig(env)).photoDirectory, directory);
  for (const name of Object.keys(env)) await assert.rejects(loadConfig({ ...env, [name]: '' }));
  for (const change of [{ PORT: '0' }, { PORT: '1e3' }, { APP_PASSWORD_HASH: 'bad' }, { SESSION_SECRET: 'short' }, { NODE_ENV: 'bad' }, { APP_ORIGIN: 'http://localhost/path' }, { NODE_ENV: 'production' }]) await assert.rejects(loadConfig({ ...env, ...change }));
  await writeFile(join(directory, 'file'), 'x');
  await assert.rejects(loadConfig({ ...env, PHOTO_DIRECTORY: join(directory, 'file') }));
  await assert.rejects(loadConfig({ ...env, PHOTO_DIRECTORY: join(directory, 'missing') }));
});
test('filesystem opens regular files and rejects missing, symlink and directory entries', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-files-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, '0007.png'), 'png-bytes');
  const handle = await openPhoto(directory, '0007');
  assert.equal(await handle.readFile('utf8'), 'png-bytes');
  await handle.close();
  await assert.rejects(openPhoto(directory, '0008'), { code: 'ENOENT' });
  await mkdir(join(directory, '0009.png'));
  await assert.rejects(openPhoto(directory, '0009'), /regular file/);
  await symlink('/etc/passwd', join(directory, '0010.png'));
  await assert.rejects(openPhoto(directory, '0010'));
  await assert.rejects(openPhoto(directory, '../secret'));
  await writeFile(join(directory, '0011.png'), 'private');
  await chmod(join(directory, '0011.png'), 0);
  await assert.rejects(openPhoto(directory, '0011'), { code: 'EACCES' });
});
test('sessions are bounded, expire absolutely and disappear on restart', t => {
  let now = 1000;
  const store = new BoundedSessionStore(1, () => now);
  t.after(() => store.close());
  const data = { cookie: {}, authenticatedAt: now } as SessionData;
  store.set('first', data, error => assert.equal(error, undefined));
  store.get('first', (error, value) => { assert.equal(error, null); assert.equal(value?.authenticatedAt, 1000); });
  store.set('second', data, error => assert.ok(error));
  now += SESSION_LIFETIME;
  store.get('first', (_error, value) => assert.equal(value, null));
  store.set('second', { ...data, authenticatedAt: now }, error => assert.equal(error, undefined));
  store.destroy('second');
  store.get('second', (_error, value) => assert.equal(value, null));
  const fresh = new BoundedSessionStore();
  fresh.get('first', (_error, value) => assert.equal(value, null));
  fresh.close();
});
test('limiter enforces ten attempts, expires entries and caps memory', () => {
  let now = 0;
  const limiter = new LoginLimiter(() => now, 1);
  for (let index = 0; index < 10; index++) assert.equal(limiter.allow('client'), true);
  assert.equal(limiter.allow('client'), false);
  assert.equal(limiter.allow('other'), false);
  now = 15 * 60 * 1000;
  assert.equal(limiter.allow('other'), true);
});
