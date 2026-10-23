import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { UploadStorage } from '../dist/upload-storage.js';
import { createApp } from '../dist/app.js';
import { hashPassword } from '../dist/password.js';
import { SESSION_LIFETIME, BoundedSessionStore } from '../dist/state.js';
import type { Config } from '../dist/config.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
async function fixture(t: Parameters<Parameters<typeof test>[1]>[0], overrides: Partial<Config> = {}, capacity = 1000) {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-http-'));
  await writeFile(join(directory, '0007.png'), png);
  let now = Date.now();
  const config = { adminUsername: 'admin', adminPasswordHash: await hashPassword('admin-test'), username: 'shared', passwordHash: await hashPassword('test-password'), sessionSecret: 'test-secret-'.repeat(4), photoDirectory: directory, port: 3000, production: false, origin: 'http://localhost', ...overrides };
  const store = new BoundedSessionStore(capacity, () => now);
  const uploads = await UploadStorage.create(directory, () => now);
  const instance = createApp(config, { uploads, now: () => now, store, logger: () => {} });
  const server = instance.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing listener');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await instance.close(); await rm(directory, { recursive: true, force: true }); });
  const request = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: 'manual', ...init });
  const login = (cookie = '', headers: Record<string, string> = {}) => request('/login', { method: 'POST', headers: { origin: config.origin, 'content-type': 'application/x-www-form-urlencoded', cookie, ...headers }, body: 'username=shared&password=test-password' });
  return { directory, request, login, store, advance: (milliseconds: number) => { now += milliseconds; }, config };
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

test('administrator credentials assign roles server-side and consultation cannot upload', async t => {
  const f = await fixture(t);
  const visitor = await f.request('/admin/upload');
  assert.equal(visitor.status, 303);
  const forged = await f.request('/login', { method: 'POST', headers: { origin: f.config.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=shared&password=test-password&role=administrator' });
  const consultation = cookie(forged);
  for (const method of ['GET', 'POST']) {
    assert.equal((await f.request('/admin/upload', { method, headers: { cookie: consultation, origin: f.config.origin } })).status, 403);
  }
  assert.equal((await f.request('/', { headers: { cookie: consultation } })).status, 200);
  const admin = await f.request('/login', { method: 'POST', headers: { origin: f.config.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=admin&password=admin-test' });
  assert.equal(admin.status, 303);
  const adminPage = await f.request('/', { headers: { cookie: cookie(admin) } });
  assert.match(await adminPage.text(), /Upload a photo/);
  const ordinary = await f.request('/', { headers: { cookie: consultation } });
  assert.doesNotMatch(await ordinary.text(), /Upload a photo/);
  assert.equal((await f.request('/admin/upload', { method: 'POST', headers: { cookie: cookie(admin), origin: 'https://evil.example' } })).status, 403);
});

 test('sessions without a recognized role must authenticate again', async t => {
  const f = await fixture(t);
  const session = cookie(await f.login());
  const id = decodeURIComponent(session.split('=')[1]!).slice(2).split('.')[0]!;
  await new Promise<void>((resolve, reject) => f.store.get(id, (error, data) => {
    if (error || !data) { reject(error ?? new Error('Missing session')); return; }
    delete data.role;
    f.store.set(id, data, error => error ? reject(error) : resolve());
  }));
  assert.equal((await f.request('/', { headers: { cookie: session } })).status, 303);
});

async function adminSession(f) {
  return cookie(await f.request('/login', { method: 'POST', headers: { origin: f.config.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=admin&password=admin-test' }));
}
async function sendPhoto(f, session, number, bytes) {
  const form = new FormData(); form.set('number', number);
  form.set('photo', new Blob([bytes], { type: 'application/octet-stream' }), '../../phone.heic');
  return f.request('/admin/upload', { method: 'POST', headers: { origin: f.config.origin, cookie: session }, body: form });
}
function token(html: string): string {
  const match = html.match(/action="\/admin\/upload\/([a-f0-9]{64})\/confirm"/);
  assert.ok(match, html); return match[1]!;
}
async function colourImage(colour = 'red') {
  return sharp({ create: { width: 80, height: 40, channels: 3, background: colour } }).png().toBuffer();
}
test('actual PNG/JPEG/HEIC uploads publish private four-digit optimized PNGs', async t => {
  const f = await fixture(t); const session = await adminSession(f);
  const jpeg = await sharp(await colourImage()).jpeg().toBuffer();
  for (const [index, bytes] of [await colourImage(), jpeg, await readFile('assets/heic-probe.heic')].entries()) {
    const response = await sendPhoto(f, session, String(20 + index), bytes);
    assert.equal(response.status, 303, await response.text());
    const image = await f.request('/photos/' + (20 + index), { headers: { cookie: session } });
    const output = Buffer.from(await image.arrayBuffer());
    assert.equal(image.status, 200); assert.ok(output.length < 100000);
    assert.equal((await sharp(output).metadata()).format, 'png');
    assert.equal((await f.request('/photos/' + (20 + index))).status, 303);
  }
  assert.deepEqual(await readdir(join(f.directory, '.uploads')), []);
});
test('replacement confirmation, private preview, cancellation, expiry, conflict renewal and replay', async t => {
  const f = await fixture(t); const session = await adminSession(f);
  const consultation = cookie(await f.login());
  const pending = token(await (await sendPhoto(f, session, '7', await colourImage())).text());
  assert.deepEqual(await readFile(join(f.directory, '0007.png')), png);
  assert.equal((await f.request(`/admin/upload/${pending}/preview`, { headers: { cookie: session } })).status, 200);
  assert.equal((await f.request(`/admin/upload/${pending}/preview`, { headers: { cookie: consultation } })).status, 403);
  const other = await adminSession(f);
  assert.equal((await f.request(`/admin/upload/${pending}/preview`, { headers: { cookie: other } })).status, 404);
  const post = (id, action, owner = session) => f.request(`/admin/upload/${id}/${action}`, { method: 'POST', headers: { cookie: owner, origin: f.config.origin } });
  const competing = token(await (await sendPhoto(f, other, '7', await colourImage('blue'))).text());
  assert.equal((await post(competing, 'confirm', other)).status, 303);
  const changed = await readFile(join(f.directory, '0007.png'));
  const stale = await post(pending, 'confirm');
  assert.equal(stale.status, 409);
  const renewed = token(await stale.text());
  assert.deepEqual(await readFile(join(f.directory, '0007.png')), changed);
  assert.equal((await post(renewed, 'confirm')).status, 303);
  assert.equal((await post(renewed, 'confirm')).status, 404);
  const current = await readFile(join(f.directory, '0007.png'));
  const cancel = token(await (await sendPhoto(f, session, '7', await colourImage('green'))).text());
  assert.equal((await post(cancel, 'cancel')).status, 303);
  assert.deepEqual(await readFile(join(f.directory, '0007.png')), current);
  const expired = token(await (await sendPhoto(f, session, '7', await colourImage('green'))).text());
  f.advance(10 * 60 * 1000);
  assert.equal((await post(expired, 'confirm')).status, 404);
  assert.deepEqual(await readdir(join(f.directory, '.uploads')), []);
});
test('invalid uploads, safe targets and role/origin rejection leave existing image and staging unchanged', async t => {
  const f = await fixture(t); const session = await adminSession(f);
  const consultation = cookie(await f.login());
  const bytes = await colourImage();
  assert.equal((await sendPhoto(f, consultation, '7', bytes)).status, 403);
  assert.equal((await sendPhoto(f, session, '../secret', bytes)).status, 400);
  assert.equal((await sendPhoto(f, session, '7', Buffer.from('not an image'))).status, 422);
  await symlink('/etc/passwd', join(f.directory, '0020.png'));
  assert.equal((await sendPhoto(f, session, '20', bytes)).status, 422);
  const foreign = await f.request('/admin/upload', { method: 'POST', headers: { cookie: session, origin: 'https://evil.example' }, body: 'not-multipart' });
  assert.equal(foreign.status, 403);
  assert.deepEqual(await readFile(join(f.directory, '0007.png')), png);
  assert.deepEqual(await readdir(join(f.directory, '.uploads')), []);
  // A failed conversion must release the slot for the next valid upload.
  assert.equal((await sendPhoto(f, session, '21', bytes)).status, 303);
});
test('logout during slow image optimization prevents publication', async t => {
  const f = await fixture(t); const session = await adminSession(f);
  const bytes = await colourImage();
  const inflight = sendPhoto(f, session, '25', bytes);
  await f.request('/logout', { method: 'POST', headers: { cookie: session, origin: f.config.origin } });
  assert.ok([303, 403].includes((await inflight).status));
  await assert.rejects(readFile(join(f.directory, '0025.png')), { code: 'ENOENT' });
});
