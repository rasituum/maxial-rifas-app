import { Router } from 'express';
import type { Request } from 'express';
import { readFile } from 'node:fs/promises';
import { receiveUpload } from './upload-ingestion.js';
import { processImage } from './image-processing.js';
import { UploadStorage } from './upload-storage.js';
import { UploadError, traceUpload } from './upload-errors.js';
import { SESSION_LIFETIME } from './state.js';
import { uploadView, confirmationView } from './views.js';

/** Reload the live session after slow work so logout/expiry cannot publish a photo. */
async function requireLiveAdmin(req: Request, now: () => number): Promise<number> {
  await new Promise<void>((resolve, reject) => req.session.reload(error => error ? reject(new UploadError(403, 'Session ended. Sign in and upload again.')) : resolve()));
  if (req.session.role !== 'administrator' || req.session.authenticatedAt === undefined || req.session.authenticatedAt + SESSION_LIFETIME <= now()) {
    throw new UploadError(403, 'Session ended. Sign in and upload again.');
  }
  return req.session.authenticatedAt + SESSION_LIFETIME;
}

/** Bind administrator upload, private preview, confirmation, and cancellation endpoints. */
export function uploadRoutes(storage: UploadStorage, now = Date.now) {
  const router = Router();
  router.get('/upload', (_req, res) => { res.send(uploadView()); });
  router.post('/upload', async (req, res, next) => {
    let failure: unknown;
    let release: (() => void) | undefined;
    let source: string | undefined;
    let destination: string | undefined;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    try {
      release = await storage.acquire(req.sessionID);
      source = await storage.temporary('src');
      const number = await receiveUpload(req, source);
      destination = await storage.temporary('png');
      await processImage(source, destination, controller.signal);
      const expires = await requireLiveAdmin(req, now);
      const result = await storage.publish(req.sessionID, expires, number, destination);
      destination = undefined;
      await storage.discard(source).catch(() => traceUpload('cleanup-failed')); source = undefined;
      release(); release = undefined;
      if (result.pending) res.send(confirmationView(result.pending, false));
      else res.redirect(303, `/?number=${number}`);
    } catch (error) { failure = error; }
    finally {
      res.off('close', disconnected);
      for (const path of [source, destination]) if (path) await storage.discard(path).catch(() => traceUpload('cleanup-failed'));
      release?.();
    }
    if (failure) next(failure);
  });
  router.get('/upload/:token/preview', async (req, res) => {
    const pending = await storage.get(req.params.token as string, req.sessionID);
    res.type('png').send(await readFile(pending.path));
  });
  router.post('/upload/:token/confirm', async (req, res) => {
    await requireLiveAdmin(req, now);
    const result = await storage.confirm(req.params.token as string, req.sessionID);
    if (result.pending) res.status(409).send(confirmationView(result.pending, true));
    else res.redirect(303, `/?number=${result.number}`);
  });
  router.post('/upload/:token/cancel', async (req, res) => {
    await storage.cancel(req.params.token as string, req.sessionID);
    res.redirect(303, '/admin/upload');
  });
  router.use((error: unknown, _req: Request, res: import('express').Response, next: import('express').NextFunction) => {
    traceUpload(error instanceof UploadError ? `rejected-${error.status}` : 'storage-failed');
    if (res.headersSent || res.destroyed) { next(error); return; }
    const status = error instanceof UploadError ? error.status : 500;
    if (status === 503) res.set('Retry-After', '5');
    res.status(status).send(uploadView(error instanceof UploadError ? error.message : 'Photo temporarily unavailable. Please retry.'));
  });
  return router;
}
