import Busboy from 'busboy';
import type { Request } from 'express';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { normalizeNumber } from './photos.js';
import { UploadError } from './upload-errors.js';

export const MAX_UPLOAD_BYTES = 30_000_000;
export const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 65_536;

/** Stream a single multipart source to an exclusively created private file with hard byte/time limits. */
export async function receiveUpload(req: Request, destination: string, timeout = 120_000): Promise<string> {
  let parser: ReturnType<typeof Busboy>;
  try { parser = Busboy({ headers: req.headers, limits: { files: 1, fields: 1, fieldSize: 32, fileSize: MAX_UPLOAD_BYTES + 1, parts: 3 } }); }
  catch { throw new UploadError(400, 'Use the upload form to send exactly one photo.'); }
  let number: string | null = null;
  let files = 0;
  let bytes = 0;
  let fileBytes = 0;
  let invalid: UploadError | undefined;
  const writes: Promise<void>[] = [];
  const fileStreams: Readable[] = [];
  const problem = (message: string, status = 400) => { invalid ??= new UploadError(status, message); };
  let stop: (error: UploadError) => void = () => {};
  const count = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) stop(new UploadError(413, 'Upload exceeds the request size limit.'));
  };
  const aborted = () => stop(new UploadError(400, 'Upload was interrupted. Try again.'));
  const timer = setTimeout(() => stop(new UploadError(408, 'Upload timed out. Try again.')), timeout);
  try {
    await new Promise<void>((resolve, reject) => {
      stop = error => {
        req.unpipe(parser);
        for (const file of fileStreams) file.destroy();
        parser.destroy(); req.resume(); reject(error);
      };
      parser.on('field', (name, value, info) => {
        if (name !== 'number' || number !== null || info.valueTruncated) problem('Supply one valid photo number.');
        else { number = normalizeNumber(value); if (!number) problem('Enter one to four digits (0–9999).'); }
      });
      parser.on('file', (name, file, info) => {
        files++; fileStreams.push(file);
        if (name !== 'photo' || !info.filename || files !== 1) { problem('Choose exactly one photo.'); file.resume(); return; }
        const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          fileBytes += chunk.length;
          if (fileBytes > MAX_UPLOAD_BYTES) problem('Photo must be at most 30 MB.', 413);
          callback(null, chunk);
        } });
        file.on('limit', () => problem('Photo must be at most 30 MB.', 413));
        const writing = pipeline(file, counter, createWriteStream(destination, { flags: 'r+', mode: 0o600 }));
        writing.catch(() => problem('Cannot receive this photo. Please retry.'));
        writes.push(writing);
      });
      for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => problem('Supply one number and exactly one photo.'));
      parser.once('error', () => { problem('Malformed or interrupted upload.'); resolve(); });
      parser.once('close', resolve);
      req.on('data', count); req.once('aborted', aborted); req.once('error', aborted);
      if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES) { stop(new UploadError(413, 'Upload exceeds the request size limit.')); return; }
      req.pipe(parser);
    });
    const results = await Promise.allSettled(writes);
    if (results.some(result => result.status === 'rejected')) problem('Cannot receive this photo. Please retry.');
    if (invalid) throw invalid;
    if (files !== 1 || !fileBytes || !number) throw new UploadError(400, 'Choose one photo and enter a valid number.');
    return number;
  } finally {
    clearTimeout(timer);
    req.off('data', count); req.off('aborted', aborted); req.off('error', aborted);
    await Promise.allSettled(writes);
  }
}
