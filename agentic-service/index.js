/**
 * RentPi Agentic Service
 * P15: AI chatbot grounded in real data
 * P16: Persistent chat sessions in MongoDB
 */
const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

// ── MongoDB Models ────────────────────────────────────────────────────────────

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

// ── Keyword Guard (P15) ───────────────────────────────────────────────────────

const RENTPI_KEYWORDS = [
  'rental', 'rent', 'product', 'category', 'categories', 'price', 'discount',
  'available', 'availability', 'renter', 'owner', 'rentpi', 'booking', 'gear',
  'surge', 'peak', 'trending', 'recommend', 'season', 'electronics', 'vehicles',
  'tools', 'outdoor', 'sports', 'music', 'furniture', 'cameras', 'office',
  'security score', 'most rented', 'busiest', 'free streak', 'vacation',
];

function isOnTopic(message) {
  const lower = message.toLowerCase();
  return RENTPI_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Data Grounding ────────────────────────────────────────────────────────────

async function fetchJSON(url, opts = {}) {
  try {
    const resp = await fetch(url, { timeout: 10000, ...opts });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function gatherContext(message) {
  const lower = message.toLowerCase();
  let context = '';
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  // Category stats
  if (lower.includes('category') || lower.includes('categor') || lower.includes('most rented') || lower.includes('popular')) {
    const data = await fetchJSON(`${CENTRAL_API_URL}/api/data/rentals/stats?group_by=category`, {
      headers: { 'Authorization': `Bearer ${CENTRAL_API_TOKEN}` }
    });
    if (data?.data) {
      context += `\n[Category Stats]: ${JSON.stringify(data.data.slice(0, 10))}`;
    }
  }

  // Trending / recommendations
  if (lower.includes('trending') || lower.includes('recommend') || lower.includes('season') || lower.includes('popular today')) {
    const data = await fetchJSON(`${ANALYTICS_SERVICE_URL}/analytics/recommendations?date=${today}&limit=5`);
    if (data?.recommendations) {
      context += `\n[Today's Recommendations]: ${JSON.stringify(data.recommendations)}`;
    }
  }

  // Peak window
  if (lower.includes('peak') || lower.includes('busiest') || lower.includes('rush') || lower.includes('7 day') || lower.includes('seven day')) {
    const fromMonth = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000).toISOString().slice(0, 7);
    const data = await fetchJSON(`${ANALYTICS_SERVICE_URL}/analytics/peak-window?from=${fromMonth}&to=${currentMonth}`);
    if (data?.peakWindow) {
      context += `\n[Peak Window]: ${JSON.stringify(data.peakWindow)}`;
    }
  }

  // Surge days
  if (lower.includes('surge') || lower.includes('spike') || lower.includes('pricing')) {
    const data = await fetchJSON(`${ANALYTICS_SERVICE_URL}/analytics/surge-days?month=${currentMonth}`);
    if (data?.data) {
      context += `\n[Surge Days for ${currentMonth}]: ${JSON.stringify(data.data.slice(0, 10))}`;
    }
  }

  // Availability check - parse product ID and dates from message
  if (lower.includes('availab')) {
    const pidMatch = message.match(/product[^\d]*(\d+)/i);
    if (pidMatch) {
      const pid = pidMatch[1];
      const data = await fetchJSON(
        `${RENTAL_SERVICE_URL}/rentals/products/${pid}/availability?from=${today}&to=${new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)}`
      );
      if (data) {
        context += `\n[Product ${pid} Availability]: ${JSON.stringify(data)}`;
      }
    }
  }

  return context;
}

// ── Gemini LLM Call ───────────────────────────────────────────────────────────

async function callGemini(messages, systemPrompt) {
  if (!GEMINI_API_KEY) {
    return "I'm sorry, the AI service is not configured. Please contact the administrator.";
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  // Build contents from message history
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  };

  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 30000,
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'I could not generate a response. Please try again.';
  } catch (err) {
    console.error('[gemini] error:', err.message);
    return 'I encountered an error while processing your request.';
  }
}

async function generateSessionName(firstMessage) {
  if (!GEMINI_API_KEY) return firstMessage.slice(0, 40);

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `Given this first user message: "${firstMessage}" — reply with ONLY a short 3-5 word title for this conversation. No punctuation.` }]
        }],
        generationConfig: { maxOutputTokens: 20 }
      }),
      timeout: 10000,
    });
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || firstMessage.slice(0, 40);
  } catch {
    return firstMessage.slice(0, 40);
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.json({ service: 'agentic-service', status: 'OK' });
});

// ── Chat Endpoint (P15 + P16) ─────────────────────────────────────────────────

app.post('/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: "'sessionId' and 'message' are required." });
  }

  // Keyword guard - refuse off-topic messages without LLM call
  if (!isOnTopic(message)) {
    return res.json({
      sessionId,
      reply: "I'm RentPi's assistant and can only help with rental-related questions like products, availability, categories, pricing, and trends. Please ask something related to RentPi."
    });
  }

  try {
    // Load or create session
    let session = await Session.findOne({ sessionId });
    const isNewSession = !session;

    if (isNewSession) {
      session = new Session({ sessionId });
    }

    // Load message history for this session
    const history = await Message.find({ sessionId }).sort({ timestamp: 1 });

    // Gather data context
    const context = await gatherContext(message);

    // Build system prompt
    const systemPrompt = `You are RentPi's AI assistant. You help users with questions about rentals, products, availability, categories, pricing, and trends on the RentPi platform.
    
You MUST only answer questions related to RentPi (rentals, products, categories, pricing, availability, trends, discounts).
If asked anything unrelated, politely decline.
Never invent or hallucinate numbers. If data is unavailable, say so explicitly.
${context ? `\nHere is relevant real-time data to answer the user's question:\n${context}` : ''}`;

    // Build conversation for LLM
    const llmMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // Call Gemini
    const reply = await callGemini(llmMessages, systemPrompt);

    // Save user message
    await Message.create({ sessionId, role: 'user', content: message });
    // Save assistant reply
    await Message.create({ sessionId, role: 'assistant', content: reply });

    // Update session
    session.lastMessageAt = new Date();
    if (isNewSession) {
      await session.save();
      // Generate session name asynchronously (fire and forget)
      generateSessionName(message).then(async (name) => {
        await Session.updateOne({ sessionId }, { name });
      }).catch(() => {});
    } else {
      await Session.updateOne({ sessionId }, { lastMessageAt: new Date() });
    }

    return res.json({ sessionId, reply });
  } catch (err) {
    console.error('[chat] error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Sessions (P16) ────────────────────────────────────────────────────────────

app.get('/chat/sessions', async (req, res) => {
  try {
    const sessions = await Session.find()
      .sort({ lastMessageAt: -1 })
      .select('sessionId name lastMessageAt -_id');
    res.json({ sessions });
  } catch (err) {
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

    res.json({
      sessionId,
      name: session.name,
      messages,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.delete('/chat/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    await Session.deleteOne({ sessionId });
    await Message.deleteMany({ sessionId });
    res.json({ message: `Session ${sessionId} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

// ── Connect to MongoDB and Start ──────────────────────────────────────────────

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
