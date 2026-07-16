/* ============================================================
   Production entry: ONE server, ONE port.
   Serves the built frontend, the /api/v1 REST API, and the
   realtime WebSocket on /ws — so a single free host or tunnel
   (Render, cloudflared, ngrok…) carries the whole app.

     npm run build && npm start
   ============================================================ */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './apps/http/src/app.js';
import { createWss } from './apps/ws/src/wss.js';

const PORT = Number(process.env.PORT || 3000);
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'apps/frontend/dist');

const app = createApp();
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));   // SPA fallback

const server = http.createServer(app);
createWss({ server, path: '/ws' });

server.listen(PORT, () => {
  console.log(`[pixelplaza] http + ws + web on http://localhost:${PORT}`);
  if (!process.env.JWT_PASSWORD) console.log('[pixelplaza] tip: set JWT_PASSWORD in production');
});
