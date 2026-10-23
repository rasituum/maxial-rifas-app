import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UploadError, traceUpload } from './upload-errors.js';

/** Isolate native decoding so a deadline or client cancellation can terminate it. */
export async function processImage(source: string, destination: string, signal?: AbortSignal, timeout = 60_000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./image-worker.js', import.meta.url)), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [],
      env: { ...process.env, VIPS_CONCURRENCY: '1' }
    });
    let succeeded = false;
    let failure: UploadError | undefined;
    const stop = () => {
      failure = new UploadError(422, 'Image processing was interrupted. Please try another photo.');
      child.kill('SIGKILL');
    };
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    child.on('message', message => { succeeded = !!(message && typeof message === 'object' && 'ok' in message && message.ok); });
    child.once('error', () => { failure = new UploadError(500, 'Image processing is temporarily unavailable.'); });
    child.once('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', stop);
      if (!failure && code === 0 && succeeded) resolve();
      else { traceUpload('processing-failed'); reject(failure ?? new UploadError(422, 'Cannot decode or reduce this photo. Use a valid PNG, JPEG, or HEIC/HEIF photo.')); }
    });
    child.send({ source, destination });
    if (signal?.aborted) stop();
  });
}
