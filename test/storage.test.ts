import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, symlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UploadStorage, PENDING_LIFETIME } from '../dist/upload-storage.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-storage-'));
  let now = 100;
  const storage = await UploadStorage.create(directory, () => now);
  t.after(async () => { await storage.close(); await rm(directory, { force: true, recursive: true }); });
  const prepared = async (content = 'new') => { const path = await storage.temporary('png'); await writeFile(path, content); return path; };
  return { directory, storage, prepared, advance: () => { now += PENDING_LIFETIME; } };
}
test('first publication and explicit confirmation preserve old bytes until commit', async t => {
  const f = await fixture(t);
  await f.storage.publish('owner', Infinity, '0007', await f.prepared('old'));
  const result = await f.storage.publish('owner', Infinity, '0007', await f.prepared());
  assert.ok(result.pending);
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'old');
  assert.equal((await f.storage.get(result.pending.token, 'owner')).number, '0007');
  await assert.rejects(f.storage.get(result.pending.token, 'other'), { status: 404 });
  await f.storage.confirm(result.pending.token, 'owner');
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'new');
  await assert.rejects(f.storage.confirm(result.pending.token, 'owner'), { status: 404 });
  assert.deepEqual(await readdir(join(f.directory, '.uploads')), []);
});
test('cancel, logout, expiry, replacement of pending state and restart discard staging only', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, '0007.png'), 'old');
  const a = (await f.storage.publish('s', Infinity, '0007', await f.prepared())).pending!;
  const b = (await f.storage.publish('s', Infinity, '0007', await f.prepared())).pending!;
  await assert.rejects(f.storage.get(a.token, 's'), { status: 404 });
  await f.storage.cancel(b.token, 's');
  const c = (await f.storage.publish('s', Infinity, '0007', await f.prepared())).pending!;
  await f.storage.cancelSession('s');
  await assert.rejects(f.storage.get(c.token, 's'), { status: 404 });
  const d = (await f.storage.publish('s', Infinity, '0007', await f.prepared())).pending!;
  f.advance(); await assert.rejects(f.storage.get(d.token, 's'), { status: 404 });
  await f.storage.temporary('src');
  await writeFile(join(f.directory, '.uploads', 'operator-file'), 'keep');
  const restarted = await UploadStorage.create(f.directory);
  await restarted.close();
  assert.deepEqual(await readdir(join(f.directory, '.uploads')), ['operator-file']);
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'old');
});
test('stale confirmation renews consent and concurrent confirms cannot both write', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, '0007.png'), 'old');
  const a = (await f.storage.publish('a', Infinity, '0007', await f.prepared('a'))).pending!;
  const b = (await f.storage.publish('b', Infinity, '0007', await f.prepared('b'))).pending!;
  const results = await Promise.allSettled([f.storage.confirm(a.token, 'a'), f.storage.confirm(b.token, 'b')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const renewed = await f.storage.confirm(b.token, 'b');
  assert.equal(renewed.conflict, true);
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'a');
  await f.storage.confirm(renewed.pending!.token, 'b');
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'b');
});
test('capacity, invalid paths, symlinks and write failures never damage numbered files', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, '0007.png'), 'old');
  const release = await f.storage.acquire('a');
  await assert.rejects(f.storage.acquire('b'), { status: 503 }); release();
  const unsafe = await f.prepared();
  await assert.rejects(f.storage.publish('s', Infinity, '../x', unsafe)); await f.storage.discard(unsafe);
  await symlink('/etc/passwd', join(f.directory, '0008.png'));
  const staged = await f.prepared();
  await assert.rejects(f.storage.publish('s', Infinity, '0008', staged), { status: 422 }); await f.storage.discard(staged);
  for (let i = 0; i < 10; i++) await f.storage.publish(String(i), Infinity, '0007', await f.prepared());
  await assert.rejects(f.storage.acquire('other'), { status: 503 });
  await f.storage.cancelSession('0');
  const pending = (await f.storage.publish('failure', Infinity, '0007', await f.prepared())).pending!;
  await chmod(f.directory, 0o500);
  await assert.rejects(f.storage.confirm(pending.token, 'failure'));
  await chmod(f.directory, 0o700);
  assert.equal(await readFile(join(f.directory, '0007.png'), 'utf8'), 'old');
});
test('staging symlinks are rejected rather than followed', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-unsafe-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await symlink(tmpdir(), join(directory, '.uploads'));
  await assert.rejects(UploadStorage.create(directory));
});
