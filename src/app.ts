import express from 'express';
import type { ErrorRequestHandler } from 'express';
import session from 'express-session';
import { pipeline } from 'node:stream/promises';
import type { Config } from './config.js';
import { verifyPassword } from './password.js';
import { BoundedSessionStore, LoginLimiter, SESSION_LIFETIME, SessionCapacityError } from './state.js';
import { isMissing, normalizeNumber, openPhoto } from './photos.js';
import { loginView, searchView, stylesheet } from './views.js';
interface Options {
  now?: () => number;
  store?: BoundedSessionStore;
  logger?: (event: string, error: unknown) => void;
}
export function createApp(config: Config, options: Options = {}) {
  const app = express();
  const now = options.now ?? Date.now;
  const store = options.store ?? new BoundedSessionStore(1000, now);
  const limiter = new LoginLimiter(now);
  const log = options.logger ?? ((event: string) => console.error(event));
  app.disable('x-powered-by');
  app.set('trust proxy', config.production ? 'loopback' : false);
  app.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'same-origin' });
    if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.get('/style.css', (_req, res) => { res.type('css').send(stylesheet); });
  app.use(express.urlencoded({ extended: false, limit: '4kb', parameterLimit: 5 }));
  app.use(session({
    name: 'maxial.sid', secret: config.sessionSecret, store,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.production, sameSite: 'lax', maxAge: SESSION_LIFETIME }
  }));
  app.use((req, res, next) => {
    if (req.method === 'POST') {
      // Missing origin also fails closed; modern browsers send it on form POSTs.
      if (req.get('origin') !== config.origin || req.get('sec-fetch-site') === 'cross-site') {
        res.status(403).send('Submission rejected.'); return;
      }
    }
    next();
  });
  app.get('/login', (_req, res) => { res.send(loginView()); });
  app.post('/login', async (req, res, next) => {
    if (!limiter.allow(req.ip ?? 'unknown')) { res.status(429).set('Retry-After', '900').send(loginView('Too many attempts. Try again later.')); return; }
    const { username, password } = req.body as Record<string, unknown>;
    const validPassword = typeof password === 'string' && password.length <= 1024 && await verifyPassword(password, config.passwordHash);
    if (username !== config.username || !validPassword) { res.status(401).send(loginView('Invalid username or password.')); return; }
    req.session.regenerate(error => {
      if (error) { next(error); return; }
      req.session.authenticatedAt = now();
      req.session.save(error => {
        if (error) req.session.destroy(() => next(error));
        else res.redirect(303, '/');
      });
    });
  });
  app.post('/logout', (req, res, next) => {
    req.session.destroy(error => {
      if (error) { next(error); return; }
      res.clearCookie('maxial.sid', { httpOnly: true, secure: config.production, sameSite: 'lax' });
      res.redirect(303, '/login');
    });
  });
  app.use((req, res, next) => {
    if (req.session.authenticatedAt === undefined || now() - req.session.authenticatedAt >= SESSION_LIFETIME) {
      res.redirect(303, '/login'); return;
    }
    next();
  });
  app.get('/', async (req, res) => {
    if (req.query.number === undefined) { res.send(searchView()); return; }
    const number = normalizeNumber(req.query.number);
    if (!number) { res.status(400).send(searchView('', 'Enter one to four digits (0–9999).')); return; }
    try {
      const file = await openPhoto(config.photoDirectory, number);
      await file.close();
      res.send(searchView(number, '', number));
    } catch (error) {
      if (isMissing(error)) res.send(searchView(number, 'No photo exists for this number.'));
      else { log('photo-read-failed', error); res.status(500).send(searchView(number, 'Photo temporarily unavailable.')); }
    }
  });
  app.get('/photos/:number', async (req, res) => {
    const number = normalizeNumber(req.params.number);
    if (!number) { res.status(400).send('Invalid photo number.'); return; }
    try {
      const file = await openPhoto(config.photoDirectory, number);
      res.type('png');
      await pipeline(file.createReadStream(), res);
    } catch (error) {
      if (res.headersSent || res.destroyed) { log('photo-stream-failed', error); return; }
      if (isMissing(error)) res.status(404).type('text').send('Photo not found.');
      else { log('photo-read-failed', error); res.status(500).type('text').send('Photo temporarily unavailable.'); }
    }
  });
  app.use((_req, res) => { res.status(404).send('Not found.'); });
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof SessionCapacityError) { res.status(503).send('Service temporarily unavailable.'); return; }
    if (error instanceof Error && 'status' in error && (error.status === 400 || error.status === 413)) {
      res.status(error.status).send('Invalid request.'); return;
    }
    log('request-failed', error);
    if (!res.headersSent) res.status(500).send('Service temporarily unavailable.');
  };
  app.use(errors);
  return { app, close: () => store.close() };
}
