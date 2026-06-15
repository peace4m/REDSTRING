# RedString — Deployment Guide

## 0. Bugs Found & Fixed (this pass)

A full audit was run over every backend and mobile file: syntax-checked
all 46 backend JS files, parsed all 27 mobile JS/JSX files, verified every
local import resolve, and loaded every backend module end-to-end. Found
and fixed:

1. **`bcrypt` → `bcryptjs`** — The native `bcrypt` package requires
   `node-gyp`/build tools to compile on installation. Many hosts (and this
   sandbox) don't have them, causing `npm install` to fail completely.
   Switched to `bcryptjs` (pure JS, identical API) in
   `server/routes/auth.routes.js` and `package.json`. **No code changes
   needed elsewhere** — same function signatures.

2. **Duplicate Mongoose indexes** — `room.schema.js` and `user.schema.js`
   declared `unique: true` on a field AND a separate `schema.index()` for
   the same field, causing Mongoose warnings (and a hard error in future
   versions). Removed the redundant `.index()` calls.

3. **Broken import path** — `components/hud/HUDComponents.js` imported
   `../theme` but the file is two directories deep (`mobile/components/hud/`),
   so the correct path is `../../theme`. This would have crashed the app
   immediately on launch with "Unable to resolve module."

4. **Missing audio/icon assets referenced by `require()`** — Metro's
   bundler statically resolves `require('./file.mp3')` at **bundle time**,
   not runtime — a missing file fails the build even if wrapped in
   try/catch. Added placeholder silent `.mp3` files for all 7 jump scare
   sounds and a placeholder `notification-icon.png`. Replace these with
   real assets later (see `mobile/assets/audio/scares/README.md`); the
   app builds and runs correctly with the placeholders in the meantime.

6. **`npm install` ERESOLVE conflict (React 18 vs 19)** — npm was
   resolving `expo` and `@react-three/drei` to their latest majors
   (Expo 54 / React 19 / drei 10.x) despite the `^`/`~` ranges suggesting
   otherwise, which then conflicted with the rest of the stack (React
   Navigation 6, react-native-screens 3.x, etc. — all built for Expo
   51 / React 18). Fixed by:
  - Pinning **exact versions** (no `^`/`~`) for every package so npm
    can't drift to a newer major.
  - Adding an `overrides` block forcing `react`/`react-dom` to `18.2.0`
    everywhere, including inside `@react-three/fiber` and
    `@react-three/drei`.
  - **Removing `expo-three`** — its `peerDependencies` only support
    `three@^0.145.0`, conflicting with the `three@0.162.0` that
    `@react-three/fiber@8.x` requires. `expo-three` is not actually
    used by `CrimeScene3D.js`/`Scene3DContainer.js` — `@react-three/fiber`'s
    native renderer imports `expo-gl` directly, which **is** kept.

   Verified: `npm install` now completes with `added 1278 packages` and
   **zero ERESOLVE errors**, no `--legacy-peer-deps` needed. `npm ls`
   confirms a single deduped `react@18.2.0` and `three@0.162.0` across
   the entire tree.

After these fixes: all backend modules load successfully end-to-end
(verified with dotenv + Redis running), and all mobile files parsed with
zero syntax errors and zero unresolved imports.

---

## 1. Mobile (iOS + Android) via EAS

### One-time setup
```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure
```

### Development build (test on a physical device with native modules)
```bash
eas build --profile development --platform all
```
Install the resulting build, then run `npx expo start --dev-client`.

### Preview build (internal testing — TestFlight / APK)
```bash
eas build --profile preview --platform all
```
Distribute the `.apk` directly or upload to TestFlight via:
```bash
eas submit --profile preview --platform ios
```

### Production build
```bash
eas build --profile production --platform all
eas submit --profile production --platform all
```

Update `eas.json` → `submit.production` with your real Apple/Google credentials
before running `eas submit`.

---

## 2. Web

The same Expo codebase exports to web via Metro's web bundler.

```bash
cd mobile
npx expo export --platform web
```

This outputs static files to `dist/`. Deploy `dist/` to any static host:

- **Vercel**: `vercel deploy dist --prod`
- **Netlify**: `netlify deploy --prod --dir=dist`
- **Cloudflare Pages**: connect repo, set build command to
  `npx expo export --platform web`, output directory `dist`

### Web-specific notes
- `expo-secure-store` falls back to `localStorage` on web automatically.
- The 3D scene (`CrimeScene3D.js`) uses `@react-three/fiber`'s web canvas
  renderer — no extra config needed.
- Voice chat (WebRTC) requires HTTPS in production (browsers block mic
  access on non-secure origins).
- Push notifications via `expo-notifications` have limited web support;
  the in-app Socket.io channels (`/case-events`) remain the primary
  delivery method for web users.

---

## 3. Backend Server

### Environment
Copy `.env.example` → `.env` and fill in:
- `MONGO_URI` — use MongoDB Atlas for production (not the local docker-compose instance)
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` — use a managed Redis (Upstash, ElastiCache)
- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `FIREBASE_*` — from Firebase Console service account
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### Recommended hosting
| Component | Recommended |
|---|---|
| Node server (Express + Socket.io) | Render, Railway, Fly.io, or AWS ECS |
| MongoDB | MongoDB Atlas (M10+ for production — supports replica sets needed for Socket.io scaling) |
| Redis | Upstash or ElastiCache |
| File/asset storage (future: scene models, audio) | Cloudflare R2 or S3 |

### Socket.io scaling note
If you deploy multiple server instances behind a load balancer, add the
Redis adapter so Socket.io rooms work across instances:

```bash
npm install @socket.io/redis-adapter
```

```js
// server.js — after Redis connects
const { createAdapter } = require('@socket.io/redis-adapter');
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

Without this, War Room broadcasts only reach sockets connected to the
same server instance.

### Docker production build
```bash
docker build -t redstring-server -f Dockerfile .
docker run -p 4000:4000 --env-file .env redstring-server
```

---

## 4. Pre-launch checklist

- [ ] Replace `eas.json` placeholder URLs with real production domains
- [ ] Set up Firebase project + download service account JSON
- [ ] Generate and rotate `JWT_SECRET` for production (never reuse dev secret)
- [ ] Add `@socket.io/redis-adapter` if running >1 server instance
- [ ] Add real audio files to `mobile/assets/audio/scares/` (see README there)
- [ ] Add real `.glb` scene models to `ENVIRONMENT_MODELS` in `CrimeScene3D.js` (optional — procedural rooms work without this)
- [ ] Run `npm audit` on both `server/` and `mobile/` before first release
- [ ] Set up error monitoring (Sentry) on both server and mobile
- [ ] Configure App Store / Play Store age ratings to match PG13/R content gating