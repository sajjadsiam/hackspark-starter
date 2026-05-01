'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { getRecommendations } from '@/lib/api';
import { CategoryBadge, SkeletonCard, ErrorMessage } from '@/components/ui';
import Link from 'next/link';

export default function TrendingPage() {
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTrending = async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await getRecommendations(today, 12);
      setTrending(res.data.recommendations || []);
    } catch {
      setError('Failed to load trending products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrending(); }, []);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">🔥 Trending Today</h1>
              <p className="text-gray-500 mt-1">
                Seasonal recommendations for {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={fetchTrending}
              className="px-5 py-2.5 glass rounded-xl text-sm text-brand-400 hover:text-brand-300 border border-brand-500/20 transition-all"
            >
              ↻ Refresh
            </button>
          </div>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <ErrorMessage message={error} onRetry={fetchTrending} />
        ) : trending.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <div className="text-5xl">🌙</div>
            <h3 className="text-lg font-semibold text-gray-300">No seasonal data available</h3>
            <p className="text-gray-600 text-sm">Historical data might not be available for this date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.map((item, i) => (
              <motion.div
                key={item.productId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-2xl p-6 hover:border-brand-500/30 gradient-border transition-all group"
              >
                {/* Rank badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <CategoryBadge category={item.category} />
                  </div>
                  <div className="text-right">
                    <div className="text-brand-400 font-bold text-lg">{item.score}</div>
                    <div className="text-gray-600 text-xs">rentals</div>
                  </div>
                </div>

                <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors">
                  {item.name}
                </h3>
                <p className="text-gray-600 text-xs mt-1">Product ID: {item.productId}</p>

                {/* Score bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Seasonal Score</span>
                    <span>{item.score}</span>
                  </div>
                  <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (item.score / (trending[0]?.score || 1)) * 100)}%` }}
                      transition={{ delay: i * 0.06 + 0.3, duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-brand-600 to-purple-600 rounded-full"
                    />
                  </div>
                </div>

                <Link
                  href={`/availability?productId=${item.productId}`}
                  className="mt-4 block text-center py-2 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 text-xs rounded-lg transition-all border border-brand-500/20"
                >
                  Check Availability
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
