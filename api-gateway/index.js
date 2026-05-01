/**
 * RentPi API Gateway v2
 * - Routes requests to downstream services (NO body parsing here)
 * - Aggregates /status from all services in parallel (P1)
 * - Adds security headers (P4/security)
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

const USER_SERVICE_URL      = process.env.USER_SERVICE_URL      || 'http://user-service:8001';
const RENTAL_SERVICE_URL    = process.env.RENTAL_SERVICE_URL    || 'http://rental-service:8002';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003';
const AGENTIC_SERVICE_URL   = process.env.AGENTIC_SERVICE_URL   || 'http://agentic-service:8004';

// ── Security Headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());

// IMPORTANT: Do NOT add express.json() / body-parser here.
// express.json() consumes the request body stream before http-proxy-middleware
// can forward it to downstream services, causing all POST/PUT requests to hang
// or fail with 400 Bad Request.

// ── Health Aggregator (P1) ────────────────────────────────────────────────────
async function checkService(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(`${url}/status`, { signal: controller.signal });
    clearTimeout(timer);
    return resp.ok ? 'OK' : 'UNREACHABLE';
  } catch {
    clearTimeout(timer);
    return 'UNREACHABLE';
  }
}

app.get('/status', async (req, res) => {
  const [userStatus, rentalStatus, analyticsStatus, agenticStatus] = await Promise.all([
    checkService(USER_SERVICE_URL),
    checkService(RENTAL_SERVICE_URL),
    checkService(ANALYTICS_SERVICE_URL),
    checkService(AGENTIC_SERVICE_URL),
  ]);

  res.json({
    service: 'api-gateway',
    status: 'OK',
    downstream: {
      'user-service':      userStatus,
      'rental-service':    rentalStatus,
      'analytics-service': analyticsStatus,
      'agentic-service':   agenticStatus,
    }
  });
});

// ── Proxy Error Handler ───────────────────────────────────────────────────────
function onError(err, req, res) {
  console.error(`[gateway] proxy error:`, err.message);
  if (res && !res.headersSent) {
    res.status(502).json({ error: 'Bad Gateway', detail: err.message });
  }
}

// ── Proxy Routes ──────────────────────────────────────────────────────────────
// Using pathFilter at root: does NOT strip the matched prefix.
// All services define routes WITH their prefix (e.g. /users/register).
// The agentic-service is special: its routes are already prefixed with /chat
// (e.g. POST /chat, GET /chat/sessions) so no stripping needed.

app.use(createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/users',
  on: { error: onError }
}));

app.use(createProxyMiddleware({
  target: RENTAL_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/rentals',
  on: { error: onError }
}));

app.use(createProxyMiddleware({
  target: ANALYTICS_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/analytics',
  on: { error: onError }
}));

app.use(createProxyMiddleware({
  target: AGENTIC_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/chat',
  on: { error: onError }
}));

// ── Fallback ──────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
  console.log(`  → user-service:      ${USER_SERVICE_URL}`);
  console.log(`  → rental-service:    ${RENTAL_SERVICE_URL}`);
  console.log(`  → analytics-service: ${ANALYTICS_SERVICE_URL}`);
  console.log(`  → agentic-service:   ${AGENTIC_SERVICE_URL}`);
});
