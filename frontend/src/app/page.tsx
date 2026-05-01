'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { getRecommendations } from '@/lib/api';
import { useEffect, useState } from 'react';
import { CategoryBadge, SkeletonCard, ErrorMessage } from '@/components/ui';

const features = [
  { icon: '🔍', title: 'Smart Search', desc: 'Filter by category across 500K+ products' },
  { icon: '📅', title: 'Live Availability', desc: 'Real-time busy periods and free windows' },
  { icon: '🤖', title: 'AI Assistant', desc: 'Chat with RentPi AI for personalized help' },
  { icon: '📊', title: 'Analytics', desc: 'Surge detection and peak window analysis' },
  { icon: '💎', title: 'Loyalty Discounts', desc: 'Earn up to 20% based on security score' },
  { icon: '🌟', title: 'Trending Today', desc: 'Seasonal recommendations updated daily' },
];

export default function HomePage() {
  const [trending, setTrending] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState('');

  const fetchTrending = async () => {
    setTrendingLoading(true);
    setTrendingError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await getRecommendations(today, 6);
      setTrending(res.data.recommendations || []);
    } catch {
      setTrendingError('Failed to load trending products.');
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => { fetchTrending(); }, []);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-brand-600/20 text-brand-400 border border-brand-500/30 mb-6">
              🚀 Series A Funded — Rebuilding from Scratch
            </span>
            <h1 className="text-5xl sm:text-7xl font-extrabold leading-tight mb-6">
              Rent{' '}
              <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Anything
              </span>
              <br />
              Seamlessly
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              RentPi is the next-generation rental marketplace with AI-powered recommendations,
              real-time availability, and intelligent pricing for 500,000+ products.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/products"
                className="px-8 py-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all glow-blue text-lg"
              >
                Browse Products →
              </Link>
              <Link
                href="/chat"
                className="px-8 py-4 glass border border-white/10 hover:border-brand-500/30 text-white font-semibold rounded-xl transition-all text-lg"
              >
                Ask AI Assistant
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trending Today (P18) */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">🔥 Trending Today</h2>
            <p className="text-gray-500 text-sm mt-1">Seasonal picks based on historical data</p>
          </div>
          <button
            onClick={fetchTrending}
            className="px-4 py-2 glass rounded-lg text-sm text-brand-400 hover:text-brand-300 border border-brand-500/20 transition-all"
          >
            ↻ Refresh
          </button>
        </div>

        {trendingLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : trendingError ? (
          <ErrorMessage message={trendingError} onRetry={fetchTrending} />
        ) : trending.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No trending products found for today.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.map((item, i) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-2xl p-6 hover:border-brand-500/30 transition-all group cursor-pointer gradient-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <CategoryBadge category={item.category} />
                  <span className="text-xs text-brand-400 font-semibold bg-brand-600/10 px-2 py-1 rounded-full">
                    Score: {item.score}
                  </span>
                </div>
                <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors">
                  {item.name}
                </h3>
                <p className="text-gray-500 text-xs mt-1">Product #{item.productId}</p>
                <Link
                  href={`/availability?productId=${item.productId}`}
                  className="mt-4 inline-flex items-center text-xs text-brand-400 hover:text-brand-300"
                >
                  Check Availability →
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Platform Features</h2>
        <p className="text-gray-500 text-center mb-10">Everything you need in one place</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-6 hover:border-brand-500/20 transition-all"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-gray-600 text-sm">
        <p>© 2024 RentPi — Built with ❤️ for HACKSPARK</p>
      </footer>
    </div>
  );
}
