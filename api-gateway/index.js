/**
 * RentPi API Gateway
 * Routes all traffic to downstream services.
 * Aggregates /status from all services in parallel (P1).
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

app.use(cors());
app.use(express.json());

// ── Health Aggregator (P1) ────────────────────────────────────────────────────

async function checkService(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(`${url}/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) return 'OK';
    return 'UNREACHABLE';
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

// ── Proxy Routes ─────────────────────────────────────────────────────────────

function makeProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        console.error(`[gateway] proxy error to ${target}:`, err.message);
        if (res && !res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', target });
        }
      }
    }
  });
}

// Routes must be set BEFORE proxy middleware
app.use('/users',     makeProxy(USER_SERVICE_URL));
app.use('/rentals',   makeProxy(RENTAL_SERVICE_URL));
app.use('/analytics', makeProxy(ANALYTICS_SERVICE_URL));
app.use('/chat',      makeProxy(AGENTIC_SERVICE_URL));

// ── Fallback ──────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
  console.log(`  user-service:      ${USER_SERVICE_URL}`);
  console.log(`  rental-service:    ${RENTAL_SERVICE_URL}`);
  console.log(`  analytics-service: ${ANALYTICS_SERVICE_URL}`);
  console.log(`  agentic-service:   ${AGENTIC_SERVICE_URL}`);
});
