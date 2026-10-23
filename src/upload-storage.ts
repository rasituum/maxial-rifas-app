import { randomBytes, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, lstat, chmod, readdir, unlink, open, link, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { openPhoto, isMissing } from './photos.js';
import { UploadError, traceUpload } from './upload-errors.js';

export const PENDING_LIFETIME = 10 * 60 * 1000;
const OWNED_FILE = /^maxial-[a-f0-9]{32}\.(src|png)$/;
export interface PendingPhoto { token: string; session: string; number: string; path: string; digest: string; expires: number }
export type PublishResult = { number: string; pending?: PendingPhoto; conflict?: boolean };

/** Own private staging and serialize atomic publication in this single server process. */
export class UploadStorage {
  private pending = new Map<string, PendingPhoto>();
  private committing = new Set<string>();
  private directory: string;
  private timer: ReturnType<typeof setInterval>;
  private active = false;
  /** Establish the process-owned staging location and expiry timer. */
  private constructor(private photos: string, private now: () => number) {
    this.directory = join(photos, '.uploads');
    this.timer = setInterval(() => { void this.prune().catch(() => traceUpload('cleanup-failed')); }, 30_000);
    this.timer.unref();
  }
  /** Validate private staging and remove only application-owned leftovers from a prior run. */
  static async create(photos: string, now = Date.now): Promise<UploadStorage> {
    const storage = new UploadStorage(photos, now);
    try {
      await mkdir(storage.directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const info = await lstat(storage.directory);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe staging directory');
      await chmod(storage.directory, 0o700);
      for (const name of await readdir(storage.directory)) if (OWNED_FILE.test(name)) await unlink(join(storage.directory, name));
      return storage;
    } catch (error) { clearInterval(storage.timer); traceUpload('staging-initialization-failed'); throw error; }
  }
  /** Reserve the one ingestion/processing slot without building an unbounded queue. */
  async acquire(session: string): Promise<() => void> {
    await this.prune();
    if (this.active || (this.pending.size >= 10 && ![...this.pending.values()].some(item => item.session === session))) {
      throw new UploadError(503, 'Upload capacity reached. Please try again shortly.');
    }
    this.active = true;
    return () => { this.active = false; };
  }
  /** Create a random, exclusive, private temporary file on the photo filesystem. */
  async temporary(extension: 'src' | 'png'): Promise<string> {
    const path = join(this.directory, `maxial-${randomBytes(16).toString('hex')}.${extension}`);
    const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await file.close(); return path;
  }
  /** Remove a known temporary file; absent files are already cleaned. */
  async discard(path: string): Promise<void> {
    if (!OWNED_FILE.test(path.slice(this.directory.length + 1)) || !path.startsWith(this.directory + '/')) throw new Error('Unsafe temporary path');
    try { await unlink(path); } catch (error) { if (!isMissing(error)) { traceUpload('cleanup-failed'); throw error; } }
  }
  /** Hash a safely opened existing regular target; absence is distinct from an unsafe target. */
  private async digest(number: string): Promise<string | null> {
    try {
      const file = await openPhoto(this.photos, number);
      try {
        const hash = createHash('sha256');
        for await (const chunk of file.createReadStream()) hash.update(chunk);
        return hash.digest('hex');
      } finally { await file.close(); }
    } catch (error) {
      if (isMissing(error)) return null;
      traceUpload('unsafe-or-unreadable-target');
      throw new UploadError(422, 'The target photo cannot safely be replaced. Contact the operator.');
    }
  }
  /** Fail promptly on concurrent commits rather than queuing unlimited requests. */
  private async locked<T>(number: string, action: () => Promise<T>): Promise<T> {
    if (this.committing.has(number)) throw new UploadError(503, 'This photo is being updated. Please retry.');
    this.committing.add(number);
    try { return await action(); } finally { this.committing.delete(number); }
  }
  /** Publish an absent target without overwriting, or prepare a session-bound replacement. */
  async publish(session: string, sessionExpires: number, number: string, path: string): Promise<PublishResult> {
    if (!/^\d{4}$/.test(number)) throw new UploadError(400, 'Invalid photo number.');
    return this.locked(number, async () => {
      const digest = await this.digest(number);
      if (digest === null) {
        try {
          await link(path, join(this.photos, `${number}.png`));
          await this.discard(path).catch(() => traceUpload('post-commit-cleanup-failed')); console.info(`upload:published:${number}`); return { number };
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
        }
      }
      await this.cancelSession(session);
      if (this.pending.size >= 10) throw new UploadError(503, 'Pending upload capacity reached.');
      const pending: PendingPhoto = { token: randomBytes(32).toString('hex'), session, number, path,
        digest: (await this.digest(number)) ?? '', expires: Math.min(this.now() + PENDING_LIFETIME, sessionExpires) };
      this.pending.set(pending.token, pending);
      return { number, pending };
    });
  }
  /** Retrieve a live pending photo only for its owning authenticated browser session. */
  async get(token: string, session: string): Promise<PendingPhoto> {
    await this.prune();
    const pending = this.pending.get(token);
    if (!pending || pending.session !== session) throw new UploadError(404, 'Pending photo expired or is unavailable. Upload it again.');
    return pending;
  }
  /** Confirm the exact target version, renewing consent when another commit changed it. */
  async confirm(token: string, session: string): Promise<PublishResult> {
    const pending = await this.get(token, session);
    return this.locked(pending.number, async () => {
      if (this.pending.get(token) !== pending || pending.expires <= this.now()) throw new UploadError(409, 'Confirmation expired. Upload the photo again.');
      const digest = (await this.digest(pending.number)) ?? '';
      if (digest !== pending.digest) {
        this.pending.delete(token);
        const renewed = { ...pending, token: randomBytes(32).toString('hex'), digest };
        this.pending.set(renewed.token, renewed);
        return { number: pending.number, pending: renewed, conflict: true };
      }
      await rename(pending.path, join(this.photos, `${pending.number}.png`));
      this.pending.delete(token);
      console.info(`upload:published:${pending.number}`);
      return { number: pending.number };
    });
  }
  /** Cancel one pending item without touching its numbered target. */
  async cancel(token: string, session: string): Promise<void> {
    const pending = await this.get(token, session);
    await this.discard(pending.path); this.pending.delete(token);
  }
  /** Remove all prepared images owned by a session during logout or renewed login. */
  async cancelSession(session: string): Promise<void> {
    for (const [token, item] of this.pending) if (item.session === session) { await this.discard(item.path); this.pending.delete(token); }
  }
  /** Expire private prepared images even when no new requests arrive. */
  async prune(): Promise<void> {
    for (const [token, item] of this.pending) if (item.expires <= this.now()) { await this.discard(item.path); this.pending.delete(token); }
  }
  /** Stop cleanup and remove staged pending images during graceful shutdown. */
  async close(): Promise<void> {
    clearInterval(this.timer);
    for (const item of this.pending.values()) await this.discard(item.path);
    this.pending.clear();
  }
}
