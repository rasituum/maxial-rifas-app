# maxial-rifas-app

A server-rendered Node.js / TypeScript application for finding pre-uploaded PNG photos by number. One shared account protects the search page and every image response.

## Local setup

Use Node.js 24.22.0 (`nvm use` with the supplied `.nvmrc`) and npm.

```sh
npm ci
npm run build
mkdir -p photos
cp .env.example .env
```

Place a PNG at `photos/0007.png`. Edit `.env` to set `APP_USERNAME`, `APP_PASSWORD_HASH`, and `SESSION_SECRET`. Generate a salted scrypt password hash without putting the password in shell history:

```sh
read -r -s -p 'Shared password: ' maxial_password
printf '\n'
printf '%s' "$maxial_password" | npm run --silent hash-password
unset maxial_password
```

Copy the final `scrypt:...` output into `APP_PASSWORD_HASH`. Generate a secret separately:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy that value into `SESSION_SECRET`, then start:

```sh
npm start
```

Open <http://localhost:3000>, sign in, and search for `7`. The image appears beneath the form. Sign out to invalidate that browser's session. Never commit `.env` or real credentials.

## Configuration

| Variable | Meaning |
| --- | --- |
| `APP_USERNAME` | Required shared username |
| `APP_PASSWORD_HASH` | Required `scrypt:<32 hex salt>:<128 hex key>` generated above |
| `SESSION_SECRET` | Required secret, at least 32 bytes; generate 32 random bytes |
| `PHOTO_DIRECTORY` | Required readable directory, resolved at startup |
| `APP_ORIGIN` | Required exact browser origin, no trailing slash; HTTPS in production |
| `PORT` | Loopback listening port, default `3000` |
| `NODE_ENV` | `development`, `test`, or `production` |

A search accepts one to four ASCII digits after trimming whitespace. `7`, `07`, and `0007` all select `0007.png`; limits are `0000.png` through `9999.png`. Empty input, signs, decimals, exponent notation, and longer inputs are rejected. Missing images produce a not-found message. Unexpected storage failures produce a generic availability error.

The photo directory is never public static content. Symbolic links and non-regular files are rejected. Only trusted operators should write photos, preferably by uploading to a temporary filename on the same filesystem and atomically renaming it to its final four-digit name. The app account needs directory traversal/read permission and file read permission, not write permission. Photos are not resized or validated as image content; operators must supply valid PNGs.

## Authentication and sessions

Each browser gets an independent session lasting eight hours from login. Sessions are held in bounded process memory (1,000 sessions), cleared on restart, and invalidated on logout. Capacity exhaustion returns 503. Run one process; multiple workers require a shared session store. The shared account cannot identify individual users or revoke one person's access.

Login allows ten attempts per client address per fifteen minutes, then returns 429. Limiter state is bounded to 10,000 addresses and resets on restart. Login and logout require an `Origin` matching `APP_ORIGIN`; scripted clients must supply it too. Production uses Secure, HttpOnly, SameSite=Lax cookies. Protected responses prohibit caching. The app logs generic failure events without submitted credentials or secrets.

To rotate access, generate a new password hash and session secret, update the environment file, and restart. Every user must then sign in again.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests use Node's built-in runner, real HTTP listeners, temporary filesystem fixtures, and an injectable clock. They cover normalization, configuration, sessions, rate limiting, private image delivery, filesystem confinement, and the login/search/image/logout journey. A browser check additionally verifies visual layout and actual image rendering.

Runtime dependencies are Express (routing and middleware) and express-session (session/cookie lifecycle). TypeScript, type declarations, ESLint and typescript-eslint are development dependencies. There is no database or frontend framework.

## GCP VM deployment

Use a Linux VM with persistent storage, Node.js 24.22.0 at `/usr/bin/node`, systemd, and Caddy. Provisioning infrastructure is outside this repository.

1. Point a DNS name at the VM. Allow inbound TCP 80/443 through GCP and host firewalls; keep Node's port private. Restrict administrative SSH access separately.
2. Create the unprivileged `maxial` account. Put a built release in `/opt/maxial/releases/<release>` and make `/opt/maxial/current` point to it. Run `npm ci`, all checks and build before activation; optionally prune development packages afterward.
3. Store photos in `/srv/maxial/photos` on persistent storage independent of releases. Grant the `maxial` account read/traverse access. Keep deployment and upload credentials separate from the web account.
4. Create `/etc/maxial/app.env`, readable only by the operator/root, using the environment example. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, and `PHOTO_DIRECTORY=/srv/maxial/photos`. systemd supplies these variables directly; `.env` is used only by `npm start` locally.
5. Install `deploy/maxial.service` under `/etc/systemd/system/`. Adapt paths if Node is installed elsewhere. Run `sudo systemd-analyze verify /etc/systemd/system/maxial.service`, `sudo systemctl daemon-reload`, and `sudo systemctl enable --now maxial`.
6. Install `deploy/Caddyfile` as `/etc/caddy/Caddyfile`, replacing the example domain. Validate with `sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, then reload Caddy. Caddy terminates HTTPS and proxies to loopback; it must not serve the photo directory directly. Node trusts forwarding headers only from loopback, and the proxy overwrites client IP information.
7. Verify HTTPS login, an existing photo, a missing photo, logout, and unauthenticated direct-image rejection. Inspect `journalctl -u maxial` for startup failures. Back up the photo disk and environment secrets using your operating procedures.

For rollback, stop the service or point `current` to the preceding built release and restart. Photo storage stays in place. Restart clears sessions and the login limiter. This repository does not perform deployment or verify live DNS, TLS issuance, or GCP firewall rules.

## Optional browser verification

The browser script is kept separate from the runtime dependencies. Install Playwright into a temporary directory and its Chromium browser, then run from the project root:

```sh
npm install --prefix /tmp/maxial-browser --no-save playwright
/tmp/maxial-browser/node_modules/.bin/playwright install chromium
npm run build
PLAYWRIGHT_MODULE=/tmp/maxial-browser/node_modules/playwright/index.mjs node scripts/browser-check.mjs
```

Chromium also needs its Linux shared libraries (`playwright install-deps chromium` on a managed development machine). The script starts an isolated local server on port 31879 with temporary photos and credentials, checks login, actual image rendering below the form, a missing photo, logout, direct URL protection, and mobile width, and writes a screenshot to the OS temporary directory. Do not run it against production.
