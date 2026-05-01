/**
 * RentPi Agentic Service
 * P15: AI chatbot grounded in real data (keyword guard + data grounding + Gemini)
 * P16: Persistent chat sessions in MongoDB
 */
const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getRecommendations } = require('./grpc_client/client');

const app = express();
const PORT = process.env.PORT || 8004;

const MONGO_URI             = process.env.MONGO_URI             || 'mongodb://mongodb:27017/rentpi_agentic';
const GEMINI_API_KEY        = process.env.GEMINI_API_KEY        || '';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8003';
const RENTAL_SERVICE_URL    = process.env.RENTAL_SERVICE_URL    || 'http://rental-service:8002';
const CENTRAL_API_URL       = process.env.CENTRAL_API_URL       || 'https://technocracy.brittoo.xyz';
const CENTRAL_API_TOKEN     = process.env.CENTRAL_API_TOKEN     || '';

app.use(cors());
app.use(express.json());

// ── MongoDB Models ─────────────────────────────────────────────────────────────

const SessionSchema = new mongoose.Schema({
  sessionId:     { type: String, unique: true, index: true, required: true },
  name:          { type: String, default: 'New Chat' },
  createdAt:     { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
});

const MessageSchema = new mongoose.Schema({
  sessionId: { type: String, index: true, required: true },
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', SessionSchema);
const Message = mongoose.model('Message', MessageSchema);

// ── Keyword Guard (P15) ────────────────────────────────────────────────────────

const RENTPI_KEYWORDS = [
  'rental', 'rent', 'product', 'category', 'categories', 'price', 'discount',
  'available', 'availability', 'renter', 'owner', 'rentpi', 'booking', 'gear',
  'surge', 'peak', 'trending', 'recommend', 'season', 'electronics', 'vehicles',
  'tools', 'outdoor', 'sports', 'music', 'furniture', 'cameras', 'office',
  'security score', 'most rented', 'busiest', 'free streak', 'vacation',
  'how many', 'when', 'which', 'what category', 'top', 'popular',
];

function isOnTopic(message) {
  const lower = message.toLowerCase();
  return RENTPI_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Fetch with timeout helper ─────────────────────────────────────────────────

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchJSON(url, opts = {}) {
  try {
    const resp = await fetchWithTimeout(url, opts, 10000);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// ── Data Grounding (P15) ──────────────────────────────────────────────────────

async function gatherContext(message) {
  const lower = message.toLowerCase();
  let context = '';
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const centralHeaders = { 'Authorization': `Bearer ${CENTRAL_API_TOKEN}` };

  // Category stats
  if (lower.includes('category') || lower.includes('most rented') || lower.includes('popular')) {
    const data = await fetchJSON(
      `${CENTRAL_API_URL}/api/data/rentals/stats?group_by=category`,
      { headers: centralHeaders }
    );
    if (data?.data) {
      context += `\n[Category Rental Stats]: ${JSON.stringify(data.data.slice(0, 10))}`;
    }
  }

  // Trending / recommendations
  if (lower.includes('trending') || lower.includes('recommend') || lower.includes('season') || lower.includes('what to rent')) {
    try {
      const recommendations = await getRecommendations(today, 5);
      if (recommendations && recommendations.length > 0) {
        context += `\n[Today's Top Recommendations (${today}) (via gRPC)]: ${JSON.stringify(recommendations)}`;
      }
    } catch (err) {
      console.error('[gRPC] Failed to get recommendations:', err.message);
      // Fallback or skip
    }
  }

  // Peak window
  if (lower.includes('peak') || lower.includes('busiest') || lower.includes('rush') || lower.includes('seven day') || lower.includes('7-day') || lower.includes('7 day')) {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 7);
    const data = await fetchJSON(`${ANALYTICS_SERVICE_URL}/analytics/peak-window?from=${sixMonthsAgo}&to=${currentMonth}`);
    if (data?.peakWindow) {
      context += `\n[Peak 7-Day Window]: ${JSON.stringify(data.peakWindow)}`;
    }
  }

  // Surge days
  if (lower.includes('surge') || lower.includes('spike') || lower.includes('pricing day')) {
    const data = await fetchJSON(`${ANALYTICS_SERVICE_URL}/analytics/surge-days?month=${currentMonth}`);
    if (data?.data) {
      context += `\n[Surge Days for ${currentMonth}]: ${JSON.stringify(data.data.slice(0, 10))}`;
    }
  }

  // Availability check
  if (lower.includes('availab')) {
    const pidMatch = message.match(/(?:product|id)[^\d]*(\d+)/i) || message.match(/(\d{2,6})/);
    if (pidMatch) {
      const pid = pidMatch[1];
      const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const data = await fetchJSON(
        `${RENTAL_SERVICE_URL}/rentals/products/${pid}/availability?from=${today}&to=${nextMonth}`
      );
      if (data) {
        context += `\n[Product ${pid} Availability (next 30 days)]: ${JSON.stringify(data)}`;
      }
    }
  }

  return context;
}

// ── Gemini LLM ────────────────────────────────────────────────────────────────

async function callGemini(messages, systemPrompt) {
  const validKey = GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here';
  if (!validKey) {
    return "I'm sorry, the AI service is not configured. Please contact the administrator.";
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const reqBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  };

  try {
    const resp = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    }, 30000);
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'I could not generate a response. Please try again.';
  } catch (err) {
    console.error('[gemini] error:', err.message);
    return 'I encountered an error while processing your request. Please try again.';
  }
}

async function generateSessionName(firstMessage) {
  const validKey = GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here';
  if (!validKey) return firstMessage.slice(0, 40);

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const resp = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Given this first user message: "${firstMessage}" — reply with ONLY a short 3-5 word title for this conversation. No punctuation.` }]
        }],
        generationConfig: { maxOutputTokens: 20 }
      }),
    }, 10000);
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || firstMessage.slice(0, 40);
  } catch {
    return firstMessage.slice(0, 40);
  }
}

// ── Status (P1) ───────────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.json({ service: 'agentic-service', status: 'OK' });
});

// Alias for when gateway forwards /chat/status without stripping prefix
app.get('/chat/status', (req, res) => {
  res.json({ service: 'agentic-service', status: 'OK' });
});

// ── Chat Endpoint (P15 + P16) ─────────────────────────────────────────────────

app.post('/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "'sessionId' and 'message' are required." });
  }

  // Keyword guard — refuse off-topic without LLM call (P15)
  if (!isOnTopic(message)) {
    return res.json({
      sessionId,
      reply: "I'm RentPi's assistant and can only help with rental-related questions — products, availability, categories, pricing, trends, and discounts. Please ask something related to RentPi!"
    });
  }

  try {
    let session = await Session.findOne({ sessionId });
    const isNewSession = !session;

    if (isNewSession) {
      session = new Session({ sessionId });
      await session.save();
    }

    // Load history for multi-turn context (P16)
    const history = await Message.find({ sessionId }).sort({ timestamp: 1 });

    // Gather grounding data
    const context = await gatherContext(message);

    const systemPrompt = `You are RentPi's AI assistant. Answer questions about rentals, products, availability, categories, pricing, and trends on the RentPi platform.
Only answer RentPi-related questions. For anything else, politely decline.
Never invent or hallucinate numbers — only use data provided below.
If no data is available, say so explicitly.${context ? `\n\nREAL-TIME DATA:\n${context}` : ''}`;

    const llmMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const reply = await callGemini(llmMessages, systemPrompt);

    // Persist messages
    await Message.create({ sessionId, role: 'user', content: message });
    await Message.create({ sessionId, role: 'assistant', content: reply });

    // Update session timestamp
    const updateData = { lastMessageAt: new Date() };
    await Session.updateOne({ sessionId }, updateData);

    // Generate session name if new (async, fire-and-forget)
    if (isNewSession) {
      generateSessionName(message).then(name =>
        Session.updateOne({ sessionId }, { name })
      ).catch(() => {});
    }

    return res.json({ sessionId, reply });
  } catch (err) {
    console.error('[chat] error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Sessions CRUD (P16) ───────────────────────────────────────────────────────

app.get('/chat/sessions', async (req, res) => {
  try {
    const sessions = await Session.find()
      .sort({ lastMessageAt: -1 })
      .select('sessionId name lastMessageAt -_id');
    res.json({ sessions });
  } catch {
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

app.get('/chat/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await Session.findOne({ sessionId }).select('sessionId name -_id');
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const messages = await Message.find({ sessionId })
      .sort({ timestamp: 1 })
      .select('role content timestamp -_id');

    res.json({ sessionId, name: session.name, messages });
  } catch {
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.delete('/chat/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    await Session.deleteOne({ sessionId });
    await Message.deleteMany({ sessionId });
    res.json({ message: `Session ${sessionId} deleted.` });
  } catch {
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

// ── Connect MongoDB and Start ─────────────────────────────────────────────────

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('[agentic-service] MongoDB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[agentic-service] listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('[agentic-service] MongoDB connection failed:', err.message);
    process.exit(1);
  });
