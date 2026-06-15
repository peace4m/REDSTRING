# RedString

**Connect the dots. Catch the killer.**

RedString is a cross-platform (iOS, Android, Web) detective investigation game.
Players choose a case file — from a 2-day petty theft to a 2-month serial-killer
investigation — explore crime scenes, interrogate AI-driven suspects, analyze
forensic evidence over real-world passive timers, and collaborate with friends
in a shared "War Room" with a red-string evidence corkboard. Realistic weather,
jump scares, and narratively twists the scale with case difficulty and player age rating.

---

## Project Structure

```
redstring/
├── schema/              MongoDB/Mongoose schemas (case files, sessions, rooms, users)
├── game-engine/          Core game logic: clue trees, alibis, twists, timers, weather, scoring
├── server/               Express + Socket.io backend
│   ├── routes/           REST API (auth, cases, rooms, sessions, users)
│   ├── sockets/          War Room + solo case-event real-time handlers
│   ├── services/         Redis cache, cron jobs, push notifications
│   ├── ai/               Claude-powered suspect dialogue & jump scare narration
│   └── middleware/        JWT auth (REST + Socket.io)
├── mobile/               React Native (Expo) app — iOS, Android, Web
│   ├── screens/          All game screens (case select → conclusion)
│   ├── components/       HUD overlays, evidence modals, 3D scene renderer
│   ├── store/            Zustand global state (auth, game session)
│   └── services/         API client, Socket.io client
└── docs/                 Architecture notes & deployment guide
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile/Web client | React Native + Expo (single codebase for iOS, Android, Web) |
| 3D crime scenes | Three.js via `@react-three/fiber` + `@react-three/drei` (procedural rooms, no external assets required) |
| State management | Zustand |
| Backend | Node.js + Express |
| Real-time | Socket.io (`/war-room` multiplayer, `/case-events` solo push) |
| Database | MongoDB (Mongoose) |
| Cache / timers | Redis (ioredis) |
| AI dialogue & narration | Anthropic Claude API |
| Push notifications | Firebase Cloud Messaging |
| Auth | JWT (access + refresh tokens) |

---

## Core Gameplay Systems

### Case Files
Each case is a single MongoDB document containing suspects (with multi-layer
alibis), a branching clue tree, scenes, scripted narrative twists, passive lab
timers, and a weather seed. A full working example — **"The Midnight
Conductor"** — ships in `schema/seed_case_midnight_conductor.js`.

### Clue Trees & Alibi Chains
Clues unlock hierarchically: examining a parent clue reveals its children
(e.g., a flask → lab analysis → fingerprint match). Suspects have ordered
alibi layers that crack only when the correct evidence is presented,
triggering an AI-generated in-character reaction.

### Passive Timers ("The Waiting Mechanic")
Submitting evidence to the lab starts a real-world timer (minutes to days,
scaled by difficulty). A cron job processes expired timers, unlocks results,
and sends push notifications — so harder cases genuinely take longer to solve.

### Weather Engine
Weather is gameplay, not decoration. Rain can wash away outdoor evidence;
night reduces visibility and raises jump scare probability; storms trigger
screen shake and lightning. Twists can script weather shifts (e.g., murder
confirmed → sudden rain).

### War Room (Multiplayer)
Up to 8 players share a real-time evidence corkboard: pin clues, connect them
with red string, assign investigation roles (Lead Detective, Forensics,
Analyst, Field Investigator), vote on a consensus accusation, and chat —
all synced via Socket.io.

### AI-Driven Suspects
Suspect interrogation dialogue is generated live by Claude, in-character,
based on personality traits, lies, and whether the player's evidence just
broke their alibi. Jump scares get a one-line AI-generated cinematic
narration matched to the scene.

### Content Rating
Date-of-birth at registration sets a PG13 or R content rating. R-rated
cases (graphic content, intense jump scares, mature themes) are hidden
from PG13 accounts at both the API and UI level.

---

## Getting Started

### 1. Backend
```bash
cd redstring
cp .env.example .env        # fill in MongoDB, Redis, Firebase, Anthropic keys
docker-compose up -d         # starts local MongoDB + Redis
npm install
npm run dev                  # starts Express + Socket.io on :4000
```

### 2. Mobile / Web
```bash
cd mobile
npm install
npx expo start                # scan QR for iOS/Android, or press 'w' for web
```

### 3. Seed a Case
```bash
node -e "
  const mongoose = require('mongoose');
  const seed = require('./schema/seed_case_midnight_conductor.js');
  const CaseFile = require('./schema/caseFile.schema.js');
  mongoose.connect('mongodb://localhost/redstring').then(async () => {
    await CaseFile.create({ ...seed, isPublished: true });
    console.log('Case seeded');
    process.exit(0);
  });
"
```

---

## Documentation

- [`docs/STEP1_README.md`](docs/STEP1_README.md) — Database schema & game engine deep dive
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — EAS builds, web hosting, backend deployment, scaling notes
- [`mobile/assets/audio/scares/README.md`](mobile/assets/audio/scares/README.md) — Jump scare audio asset requirements

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Required services:

- **MongoDB** — case data, sessions, rooms, users
- **Redis** — room state cache, timer scheduling, jump scare throttling
- **Firebase** — push notifications (lab results, room invites, twists)
- **Anthropic API** — suspect dialogue and jump scare narration

---

## Status

All core systems are implemented end-to-end:

- ✅ Database schema + game engine (clue trees, alibis, twists, weather, scoring)
- ✅ REST API + Socket.io War Room + cron jobs (lab timers, weather, jump scares)
- ✅ Mobile/web UI (auth → case select → crime scene → interrogation → evidence board → War Room → conclusion)
- ✅ AI dialogue & jump scare narration (Claude)
- ✅ 3D procedural crime scene renderer (Three.js)
- ✅ EAS build config for iOS/Android/Web deployment

**Pre-launch TODO**: real audio assets for jump scares, optional `.glb` scene
models, production secrets, Socket.io Redis adapter for multi-instance scaling
(see `docs/DEPLOYMENT.md` checklist).