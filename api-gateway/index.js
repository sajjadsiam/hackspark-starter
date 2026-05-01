/**
 * RentPi API Gateway
 * - Routes all traffic to downstream services
 * - Aggregates /status from all services in parallel
 * - Single entry point at :8000
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

// ── Health Aggregator ────────────────────────────────────────────────────────

async function checkService(name, url) {
  try {
    const resp = await fetch(`${url}/status`, { timeout: 5000 });
    if (resp.ok) return 'OK';
    return 'UNREACHABLE';
  } catch {
    return 'UNREACHABLE';
  }
}

app.get('/status', async (req, res) => {
  const [userStatus, rentalStatus, analyticsStatus, agenticStatus] = await Promise.all([
    checkService('user-service',      USER_SERVICE_URL),
    checkService('rental-service',    RENTAL_SERVICE_URL),
    checkService('analytics-service', ANALYTICS_SERVICE_URL),
    checkService('agentic-service',   AGENTIC_SERVICE_URL),
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

const proxyOpts = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error(`[gateway] proxy error to ${target}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad Gateway', service: target });
      }
    }
  }
});

// User service routes
app.use('/users',   createProxyMiddleware(proxyOpts(USER_SERVICE_URL)));

// Rental service routes
app.use('/rentals', createProxyMiddleware(proxyOpts(RENTAL_SERVICE_URL)));

// Analytics service routes
app.use('/analytics', createProxyMiddleware(proxyOpts(ANALYTICS_SERVICE_URL)));

// Agentic service routes
app.use('/chat', createProxyMiddleware(proxyOpts(AGENTIC_SERVICE_URL)));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
});
