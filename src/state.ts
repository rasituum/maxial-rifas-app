import session from 'express-session';
import type { SessionData } from 'express-session';
export const SESSION_LIFETIME = 8 * 60 * 60 * 1000;
declare module 'express-session' {
  interface SessionData { authenticatedAt?: number; role?: 'consultation' | 'administrator' }
}
export class SessionCapacityError extends Error {}
export class BoundedSessionStore extends session.Store {
  private entries = new Map<string, { data: string; expires: number }>();
  private timer: ReturnType<typeof setInterval>;
  constructor(private capacity = 1000, private now = Date.now) {
    super();
    this.timer = setInterval(() => this.prune(), 60_000);
    this.timer.unref();
  }
  private prune() {
    for (const [id, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(id);
  }
  override get(id: string, callback: (error: unknown, data?: SessionData | null) => void) {
    this.prune();
    const entry = this.entries.get(id);
    callback(null, entry ? JSON.parse(entry.data) as SessionData : null);
  }
  override set(id: string, data: SessionData, callback?: (error?: unknown) => void) {
    this.prune();
    if (!this.entries.has(id) && this.entries.size >= this.capacity) {
      callback?.(new SessionCapacityError('Session capacity reached')); return;
    }
    const expires = (data.authenticatedAt ?? this.now()) + SESSION_LIFETIME;
    if (expires > this.now()) this.entries.set(id, { data: JSON.stringify(data), expires });
    callback?.();
  }
  override destroy(id: string, callback?: (error?: unknown) => void) {
    this.entries.delete(id); callback?.();
  }
  close() { clearInterval(this.timer); this.entries.clear(); }
}
export class LoginLimiter {
  private entries = new Map<string, { count: number; expires: number }>();
  constructor(private now = Date.now, private capacity = 10000) {}
  allow(address: string): boolean {
    const time = this.now();
    for (const [key, entry] of this.entries) if (entry.expires <= time) this.entries.delete(key);
    let entry = this.entries.get(address);
    if (!entry) {
      if (this.entries.size >= this.capacity) return false;
      entry = { count: 0, expires: time + 15 * 60 * 1000 };
      this.entries.set(address, entry);
    }
    entry.count++;
    return entry.count <= 10;
  }
}
