import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { request as httpRequest } from 'node:http';
import { once, EventEmitter } from 'node:events';
import { mkdtemp, open, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { receiveUpload, MAX_UPLOAD_BYTES, MAX_REQUEST_BYTES } from '../dist/upload-ingestion.js';

async function fixture(t, timeout = 120000) {
  const directory = await mkdtemp(join(tmpdir(), 'maxial-ingest-'));
  const path = join(directory, 'source');
  await (await open(path, 'wx')).close();
  const app = express();
  const outcomes = new EventEmitter();
  app.post('/', async (req, res) => {
    try { res.send(await receiveUpload(req, path, timeout)); }
    catch (error) { outcomes.emit('outcome', error.status ?? 500); res.status(error.status ?? 500).send(error.message); }
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  return { base, path, outcomes };
}
function multipart(bytes, fields = [['number', '7']], files = 1) {
  const parts = fields.map(([name, value]) => Buffer.from(`--b\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  for (let i = 0; i < files; i++) parts.push(Buffer.from('--b\r\nContent-Disposition: form-data; name="photo"; filename="../../camera.png"\r\nContent-Type: image/png\r\n\r\n'), Buffer.alloc(bytes, 1), Buffer.from('\r\n'));
  parts.push(Buffer.from('--b--\r\n')); return Buffer.concat(parts);
}
const headers = { 'content-type': 'multipart/form-data; boundary=b' };
test('streamed ingestion accepts exact 30 MB and rejects one extra byte', async t => {
  const f = await fixture(t);
  const accepted = await fetch(f.base, { method: 'POST', headers, body: multipart(MAX_UPLOAD_BYTES) });
  assert.equal(accepted.status, 200); assert.equal(await accepted.text(), '0007');
  assert.equal((await stat(f.path)).size, MAX_UPLOAD_BYTES);
  const rejected = await fetch(f.base, { method: 'POST', headers, body: multipart(MAX_UPLOAD_BYTES + 1) });
  assert.equal(rejected.status, 413);
});
test('duplicates, missing/extra files, malformed bodies, invalid numbers and total overhead are rejected', async t => {
  const f = await fixture(t);
  for (const body of [multipart(1, [['number', '7'], ['number', '8']]), multipart(0), multipart(1, [['number', '7']], 2), multipart(1, [['number', '../x']]), Buffer.from('broken')]) {
    assert.equal((await fetch(f.base, { method: 'POST', headers, body })).status, 400);
  }
  const response = await fetch(f.base, { method: 'POST', headers, body: Buffer.alloc(MAX_REQUEST_BYTES + 1) });
  assert.equal(response.status, 413);
});
test('chunked uploads without Content-Length succeed and a stalled source times out', async t => {
  const f = await fixture(t, 100);
  const payload = multipart(100);
  const send = (slow = false) => new Promise<number>((resolve, reject) => {
    const req = httpRequest(f.base, { method: 'POST', headers }, res => { res.resume(); res.on('end', () => { resolve(res.statusCode!); req.destroy(); }); });
    req.on('error', reject);
    if (slow) req.write(payload.subarray(0, payload.length - 7));
    else { req.write(payload.subarray(0, 50)); req.end(payload.subarray(50)); }
  });
  assert.equal(await send(), 200); assert.equal(await send(true), 408);
});

test('client disconnects and deceptive Content-Length fail bounded ingestion', async t => {
  const f = await fixture(t);
  const outcome = once(f.outcomes, 'outcome');
  const req = httpRequest(f.base, { method: 'POST', headers });
  req.on('error', () => {});
  req.write(multipart(100).subarray(0, 180));
  await new Promise(resolve => setTimeout(resolve, 20));
  req.destroy();
  assert.equal((await outcome)[0], 400);
  const body = multipart(100);
  const status = await new Promise<number>((resolve, reject) => {
    const wrong = httpRequest(f.base, { method: 'POST', headers: { ...headers, 'content-length': String(body.length - 20) } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode!));
    });
    wrong.on('error', reject); wrong.end(body);
  });
  assert.equal(status, 400);
});
