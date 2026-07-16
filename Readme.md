# PixelPlaza — a tiny multiplayer metaverse

A Zep-style 2D metaverse with **real multiplayer**: create a space, share the invite
link, and meet people in a pixel town. 100% original pixel art drawn in code.
Not affiliated with ZEP Co., Ltd.

Architecture inspired by [hkirat/2d-metaverse](https://github.com/hkirat/2d-metaverse):
a monorepo with an HTTP API, a WebSocket realtime server, and a web client.

```
apps/
  http/       Express API — signup/signin (scrypt + JWT), avatar metadata, space CRUD   :3000
  ws/         WebSocket server — rooms, movement validation, chat, Coin Rush, WebRTC signaling   :3001
  frontend/   Vite web client — canvas engine, dashboard, networked world   :5173
packages/
  maps/       shared map grids + collision (used by ws server AND client)
  db/         JSON-file datastore with a Prisma-shaped client API
legacy/       the original single-file offline demo
tests/        end-to-end smoke test (HTTP + WS protocol)
```

## Run it (development)

```bash
npm install
npm run dev        # starts http (3000) + ws (3001) + web (5173)
```

Open **http://localhost:5173**, sign up, create a space — then open a second
browser (or send a friend the 🔗 invite link) and walk up to each other.

```bash
npm run test:e2e      # protocol smoke test (needs the servers running)
npm run test:browser  # 4-player voice/share test in headless Chrome (needs `npm run serve`)
```

## Host it for friends

Production mode is **one server on one port** (static site + API + WebSocket on `/ws`):

```bash
npm run serve      # = npm run build && node server.js  → http://localhost:3000
```

**Instant & free (no account): Cloudflare quick tunnel.** Runs while your machine is on:

```bash
brew install cloudflared
npm run serve                                    # terminal 1
cloudflared tunnel --url http://localhost:3000   # terminal 2 → prints https://….trycloudflare.com
```

Share that `https://` URL (or a `#join-<spaceId>` invite link on it) — HTTPS means
webcam/mic work for everyone. You get a fresh random URL each run.

**Permanent free URL: [Render](https://render.com) free tier.** Push the repo to GitHub,
create a *Web Service* from it with build command `npm install && npm run build`, start
command `npm start`, and a `JWT_PASSWORD` env var. Caveats of the free tier: the server
sleeps after ~15 min idle (first visit takes ~a minute to wake) and the filesystem is
ephemeral, so the JSON datastore (accounts/spaces) resets on deploys and restarts —
fine for playing with friends, swap in a real database if you want persistence.

## What's inside

- **Accounts & spaces** — sign up, create named spaces, invite via link (`#join-<id>`), delete your own.
- **Real multiplayer** — server-validated movement (collision + speed checked server-side), join/leave toasts, live participant list across both maps.
- **Two maps + portals** — Plaza Park and Pixel Office; step through the house door / glowing pad and the server teleports you.
- **Voice & video for the whole room** — everyone in a space is mesh-connected over WebRTC; voice fades with distance Zep-style (never fully silent on your map — toggle "Spatial voice" in ⚙️). Walk near someone and call tiles appear with live speaking indicators; connections self-heal (ICE restart + rebuild).
- **Screen share to the room** — 🖥️ streams your screen to everyone in the space over WebRTC; it pops up in a floating panel for them.
- **Chat history** — the last 50 messages replay when you join, so late arrivals have context. Incoming messages blip.
- **Sit on chairs** — press `E` next to an office chair; moving stands you up. Everyone sees the pose.
- **Away status** — switch tabs and your avatar shows 💤; the participant list also shows who has 🎤 on and who's sharing 🖥️.
- **Chat & emotes** — space-wide chat with speech bubbles, quick emotes `1–6`.
- **Coin Rush** — press `E` at the arcade; the server owns the coins, everyone races for 30 seconds.
- **Avatar dressing room** — skin/shirt/hair persisted to your account.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move (hold `Shift` to run) |
| `E` / `Space` | Interact with nearby objects |
| `Enter` | Open chat / send message |
| `1–6` | Quick emotes |
| `M` | Toggle minimap |

Touch devices get an on-screen joystick automatically.

## API (mirrors the reference repo)

`POST /api/v1/signup` · `POST /api/v1/signin` · `GET /api/v1/avatars` ·
`POST /api/v1/user/metadata` · `GET /api/v1/user/metadata/bulk?ids=[…]` ·
`POST /api/v1/space` · `GET /api/v1/space/all` · `GET /api/v1/space/:id` · `DELETE /api/v1/space/:id`

WS messages: `join` → `space-joined` (incl. chat history), `move` → `movement`/`movement-rejected`
(carries `sit`), `map-switch`, `chat`, `emote`, `media` (mic/cam/share + share stream id),
`status` (away), `rtc` (WebRTC signaling relay), `game-start`/`coin-taken`/`game-end`,
`user-joined`/`user-left`/`user-moved-map`.

## Notes

- The datastore is a JSON file (`packages/db/data/db.json`) behind a Prisma-shaped
  client — swap in Prisma + Postgres without touching route code if you outgrow it.
- Dev secret is hardcoded fallback `pixelplaza-dev-secret`; set `JWT_PASSWORD` in production.
- The original offline single-file version lives in `legacy/index.html`.
