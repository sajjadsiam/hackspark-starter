'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { sendChat, getSessions, getSessionHistory, deleteSession } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface Session {
  sessionId: string;
  name: string;
  lastMessageAt: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await getSessions();
      setSessions(res.data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    try {
      const res = await getSessionHistory(sessionId);
      setMessages(res.data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(uuidv4());
    setMessages([]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const sid = currentSessionId || uuidv4();
    if (!currentSessionId) setCurrentSessionId(sid);

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChat(sid, input);
      const assistantMsg: Message = { role: 'assistant', content: res.data.reply };
      setMessages(prev => [...prev, assistantMsg]);
      // Refresh sessions list
      fetchSessions();
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error || 'Sorry, something went wrong. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        setCurrentSessionId('');
        setMessages([]);
      }
      fetchSessions();
    } catch {}
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <Navbar />

      <div className="flex flex-1 pt-20 h-screen">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 glass border-r border-white/5 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-semibold text-white mb-3">💬 Chat Sessions</h2>
            <button
              onClick={startNewChat}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl transition-all"
            >
              + New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessionsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))
            ) : sessions.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No sessions yet</p>
            ) : (
              sessions.map(session => (
                <motion.div
                  key={session.sessionId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                    currentSessionId === session.sessionId
                      ? 'bg-brand-600/20 border border-brand-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => loadSession(session.sessionId)}
                >
                  <p className="text-sm font-medium text-white truncate pr-6">{session.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{formatTime(session.lastMessageAt)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.sessionId); }}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs p-1"
                  >
                    ✕
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && !currentSessionId && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-white mb-2">RentPi AI Assistant</h3>
                <p className="text-gray-500 max-w-md">
                  Ask me anything about rentals, products, availability, trends, categories, and pricing.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 max-w-lg">
                  {[
                    'What categories are most popular?',
                    'What\'s trending this week?',
                    'When did rentals peak this year?',
                    'Are there any surge days this month?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="p-3 glass rounded-xl text-sm text-gray-300 hover:text-white hover:border-brand-500/30 transition-all text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-2xl px-5 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-none'
                      : 'glass text-gray-200 rounded-bl-none border border-white/5'
                  }`}>
                    {msg.role === 'assistant' && (
                      <span className="text-xs text-brand-400 block mb-1 font-medium">🤖 RentPi AI</span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="glass px-5 py-3 rounded-2xl rounded-bl-none border border-white/5">
                  <span className="text-xs text-brand-400 block mb-1 font-medium">🤖 RentPi AI</span>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 glass border-t border-white/5">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                id="chat-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                placeholder="Ask about rentals, products, trends..."
                className="flex-1 px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
              />
              <button
                id="chat-send"
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
