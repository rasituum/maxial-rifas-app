import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../dist/app.js';
import { hashPassword } from '../dist/password.js';
import { SESSION_LIFETIME, BoundedSessionStore } from '../dist/state.js';
import type { Config } from '../dist/config.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
async function fixture(t: Parameters<Parameters<typeof test>[1]>[0], overrides: Partial<Config> = {}, capacity = 1000) {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-http-'));
  await writeFile(join(directory, '0007.png'), png);
  let now = Date.now();
  const config = { username: 'shared', passwordHash: await hashPassword('test-password'), sessionSecret: 'test-secret-'.repeat(4), photoDirectory: directory, port: 3000, production: false, origin: 'http://localhost', ...overrides };
  const instance = createApp(config, { now: () => now, store: new BoundedSessionStore(capacity, () => now), logger: () => {} });
  const server = instance.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); instance.close(); await rm(directory, { recursive: true, force: true }); });
  const request = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: 'manual', ...init });
  const login = (cookie = '', headers: Record<string, string> = {}) => request('/login', { method: 'POST', headers: { origin: config.origin, 'content-type': 'application/x-www-form-urlencoded', cookie, ...headers }, body: 'username=shared&password=test-password' });
  return { directory, request, login, advance: (milliseconds: number) => { now += milliseconds; }, config };
}
function cookie(response: Response) { return response.headers.get('set-cookie')!.split(';')[0]!; }

test('complete login, search, exact image and logout flow', async t => {
  const f = await fixture(t);
  for (const path of ['/', '/photos/7']) {
    const response = await f.request(path);
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/login');
  }
  const login = await f.login();
  assert.equal(login.status, 303);
  const session = cookie(login);
  assert.match(login.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(login.headers.get('set-cookie')!, /SameSite=Lax/);
  const page = await f.request('/?number=07', { headers: { cookie: session } });
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.indexOf('Photo number') < html.indexOf('<img'));
  assert.match(html, /src="\/photos\/0007"/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('referrer-policy'), 'same-origin');
  const image = await f.request('/photos/7', { headers: { cookie: session } });
  assert.equal(image.status, 200); assert.match(image.headers.get('content-type')!, /image\/png/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  assert.match(await (await f.request('/?number=8', { headers: { cookie: session } })).text(), /No photo exists/);
  assert.equal((await f.request('/photos/8', { headers: { cookie: session } })).status, 404);
  for (const value of ['', '-1', '10000', '1e2', '../secret', '<script>']) assert.equal((await f.request('/?number=' + encodeURIComponent(value), { headers: { cookie: session } })).status, 400);
  assert.equal((await f.request('/photos/..%2Fsecret', { headers: { cookie: session } })).status, 400);
  const logout = await f.request('/logout', { method: 'POST', headers: { origin: f.config.origin, cookie: session } });
  assert.equal(logout.status, 303);
  assert.equal((await f.request('/photos/7', { headers: { cookie: session } })).status, 303);
});
test('login failures, origin protection, regeneration and absolute expiry', async t => {
  const f = await fixture(t);
  assert.equal((await f.login('', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/login', { method: 'POST' })).status, 403);
  const failed = await f.request('/login', { method: 'POST', headers: { origin: f.config.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=wrong&password=wrong' });
  assert.equal(failed.status, 401); assert.equal(failed.headers.get('set-cookie'), null);
  const first = cookie(await f.login());
  const second = cookie(await f.login(first));
  assert.notEqual(first, second);
  assert.equal((await f.request('/', { headers: { cookie: first } })).status, 303);
  assert.equal((await f.request('/logout', { method: 'POST', headers: { origin: 'https://evil.example', cookie: second } })).status, 403);
  assert.equal((await f.request('/', { headers: { cookie: second } })).status, 200);
  f.advance(SESSION_LIFETIME);
  assert.equal((await f.request('/', { headers: { cookie: second } })).status, 303);
});
test('production cookies and trusted proxy HTTPS', async t => {
  const f = await fixture(t, { production: true, origin: 'https://photos.example.com' });
  const response = await f.login('', { 'x-forwarded-proto': 'https' });
  assert.match(response.headers.get('set-cookie')!, /Secure/);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(response.headers.get('set-cookie')!, /SameSite=Lax/);
});
test('rate limit ignores untrusted forwarding headers and resets', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await f.login('', { 'x-forwarded-for': `192.0.2.${i}` })).status, 303);
  assert.equal((await f.login('', { 'x-forwarded-for': '192.0.2.100' })).status, 429);
  f.advance(15 * 60 * 1000);
  assert.equal((await f.login()).status, 303);
});
test('capacity gracefully rejects login and restart rejects old sessions', async t => {
  const f = await fixture(t, {}, 1);
  const session = cookie(await f.login());
  const full = await f.login();
  assert.equal(full.status, 503);
  assert.equal(full.headers.get('set-cookie'), null);
  const restarted = await fixture(t);
  assert.equal((await restarted.request('/', { headers: { cookie: session } })).status, 303);
});
test('file errors and escaping links never expose paths or bytes', async t => {
  const f = await fixture(t);
  const session = cookie(await f.login());
  await mkdir(join(f.directory, '0008.png'));
  await symlink('/etc/passwd', join(f.directory, '0009.png'));
  await writeFile(join(f.directory, '0010.png'), 'unreadable');
  await chmod(join(f.directory, '0010.png'), 0);
  for (const number of ['8', '9', '10']) {
    const response = await f.request('/photos/' + number, { headers: { cookie: session } });
    assert.equal(response.status, 500);
    assert.equal(await response.text(), 'Photo temporarily unavailable.');
    const page = await f.request('/?number=' + number, { headers: { cookie: session } });
    assert.equal(page.status, 500); assert.ok(!(await page.text()).includes(f.directory));
  }
});
