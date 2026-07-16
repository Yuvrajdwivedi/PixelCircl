# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PixelPlaza — a Zep-style 2D metaverse with real multiplayer. npm-workspaces monorepo modeled on hkirat/2d-metaverse: `apps/http` (Express API, port 3000), `apps/ws` (WebSocket realtime server, port 3001), `apps/frontend` (Vite vanilla-JS client, port 5173), `packages/maps` (shared map/collision code), `packages/db` (JSON-file datastore with a Prisma-shaped client). Plain ESM JavaScript throughout — no TypeScript, no build step for the servers. The pre-multiplayer single-file version is preserved at `legacy/index.html`.

Deployment shape: dev runs the three services separately; production is root `server.js` — one port serving the built frontend, `/api/v1`, and the WS on path `/ws` (frontend picks the WS URL by `import.meta.env.DEV` in `apps/frontend/src/config.js`). Both entrypoints share `apps/http/src/app.js` (`createApp`) and `apps/ws/src/wss.js` (`createWss`) — keep standalone and combined modes working when touching either.

## Commands

```bash
npm install            # once, at the repo root
npm run dev            # all three services via concurrently (http, ws, web)
npm run dev -w apps/ws # a single service (node --watch)
npm run build          # vite build of the frontend
npm run serve          # production: build + single combined server on :3000 (server.js)
npm run test:e2e       # tests/e2e.js — needs the servers running; covers API auth/spaces + full WS protocol
                       # against the combined server: WS_URL=ws://localhost:3000/ws node tests/e2e.js
npm run test:browser   # tests/browser.mjs — 4 headless-Chrome players; voice mesh, spatial fade,
                       # screen share, robustness. Needs `npm run serve` up and local Chrome.
```

There is no lint or unit-test setup; `tests/e2e.js` is the test suite (37 protocol checks, prints ✅/❌ per check, exit code 1 on failure).

## Architecture

**Server owns truth.** The ws server validates every `move` against the shared map collision (`@repo/maps`) plus a 64px-per-message speed cap (`MAX_STEP` in `apps/ws/src/User.js`), and answers cheating with `movement-rejected` (client snaps back). Coin Rush coins live server-side so two players can't take the same coin. Anything gameplay-authoritative belongs in `User.handle()` on the server, not the client.

**Rooms** (`apps/ws/src/RoomManager.js`): singleton, keyed by spaceId — one room per space, matching the reference repo. Users carry a `mapKey` (`park`/`office`/`plains`/`beach`); movement/emotes broadcast map-scoped, chat/joins space-wide. `move`/`movement` carry pose flags (`sit`, `ride` — the plains kart); `ride` resets server-side on every map switch. Portals are a `map-switch` round-trip: server repositions the user at `portalLand(from, to)` (per-origin overrides live in `PORTAL_LAND` as `'from>to'` keys) and confirms with `map-switched` before the client rebuilds the world.

**Shared maps** (`packages/maps`): char-grid maps (one char = one 16px tile; `SOLID` set = impassable), `OBJECTS`/`SPAWNS`/`PORTAL_LAND`, and the `collides()` feet-box check — imported by both the ws server (validation) and the frontend (rendering + client prediction). Map changes must work for both; never fork this logic. Objects without a `label` are decorative (skipped by the interact prompt); `sprite` overrides which sprite `drawObjectSprite` uses when several object types share art.

**DB** (`packages/db`): JSON file with a Prisma-shaped async API (`client.user.create({data})`, `findUnique({where})`, …), models User/Space. http and ws are separate processes sharing the file, so every read `load()`s when the file's mtime changed — keep that when adding tables. Swap target is real Prisma; route code should stay compatible.

**HTTP API** (`apps/http`): mirrors the reference — `/api/v1` signup/signin (scrypt hash, JWT with `{userId, role}`), `user/metadata` (avatar cfg JSON, zod-validated), space CRUD. JWT secret shared with ws via `JWT_PASSWORD` env (dev fallback in both `config.js` files — keep them identical).

**Frontend** (`apps/frontend/src`): `engine/` is the ported original renderer (draw.js pixel art, world.js render/camera/minimap + remote-entity lerp); `ui/` holds one module per screen (landing hero demo with client-only bots, auth, dashboard, select, world). `ui/world.js` is the network hub: single rAF loop lives in `main.js` and calls `worldTick(dt)`; local input applies immediately (client prediction) and syncs at ~12Hz only-on-change; remote players glide via `tx/ty` lerp. `rtc.js` is a space-wide WebRTC mesh (perfect-negotiation with implicit rollback, polite = smaller session id, early-candidate buffering, ICE-restart/rebuild self-healing) signaled over the game WS as `rtc {to, data}`. Connections are per co-present user and live for the whole visit — proximity shapes *volume*, not connectivity: audio plays through persistent hidden sinks in `#audioSinks` (`ensureSink`/`volumeFor` in `ui/world.js`), attenuated by avatar distance with a 0.25 floor on the same map, muted across maps. Tile `<video>` elements are always muted — never let a tile play audio or it doubles with the sinks. Speaking indicators come from WebAudio analysers (`makeMeter`/`levelOf`). Screen share is a second outgoing MediaStream on the same connections (`peers.setStreams([localStream, shareStream])`); the receiver tells share from cam/mic by stream id announced in the `media` message, and `routeStreams()` re-derives that mapping idempotently from `peerStreams` — always route through it (never assign `remoteStreams`/`activeShares` directly) because share tracks can arrive before their `media` announcement.

**WS protocol**: `join {spaceId, token}` → `space-joined {sessionId, spawn, users}`; then `move`, `map-switch`, `chat`, `emote`, `sfx`, `typing`, `media`, `rtc`, `game-start`/`coin-taken`/`game-end`; server pushes `user-joined`/`user-left`/`user-moved-map`. When adding a message type: handler in `User.handle()`, client handler in `enterSpace()`'s `.on()` chain, and a check in `tests/e2e.js`. The soundboard (`sfx`) is fully procedural — browser TTS + WebAudio, registry in `apps/frontend/src/engine/sfx.js`, ids duplicated in `SFX_IDS` in `apps/ws/src/User.js` (keep in sync); server rate-limits to one sfx per 1.5s per user.

## Conventions

- Compact code style (single-letter helpers `$`, `T`, `Z`, dense expressions) — match it.
- All artwork stays procedural — no image assets; no ZEP-affiliated content (see footer disclaimer).
- User-visible strings go through `esc()` before `innerHTML`.
- Invite links are `#join-<spaceId>`; keep `dashboard.js parseSpaceId()` accepting both raw ids and full links.
