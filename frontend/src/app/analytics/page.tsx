'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { getPeakWindow, getSurgeDays } from '@/lib/api';
import { ErrorMessage } from '@/components/ui';

export default function AnalyticsPage() {
  const [peakFrom, setPeakFrom] = useState('2024-01');
  const [peakTo, setPeakTo] = useState('2024-06');
  const [peakResult, setPeakResult] = useState<any>(null);
  const [peakLoading, setPeakLoading] = useState(false);
  const [peakError, setPeakError] = useState('');

  const [surgeMonth, setSurgeMonth] = useState('2024-03');
  const [surgeResult, setSurgeResult] = useState<any>(null);
  const [surgeLoading, setSurgeLoading] = useState(false);
  const [surgeError, setSurgeError] = useState('');

  const fetchPeak = async (e: React.FormEvent) => {
    e.preventDefault();
    setPeakLoading(true);
    setPeakError('');
    try {
      const res = await getPeakWindow(peakFrom, peakTo);
      setPeakResult(res.data);
    } catch (err: any) {
      setPeakError(err.response?.data?.error || 'Failed to fetch peak window.');
    } finally {
      setPeakLoading(false);
    }
  };

  const fetchSurge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSurgeLoading(true);
    setSurgeError('');
    try {
      const res = await getSurgeDays(surgeMonth);
      setSurgeResult(res.data);
    } catch (err: any) {
      setSurgeError(err.response?.data?.error || 'Failed to fetch surge days.');
    } finally {
      setSurgeLoading(false);
    }
  };

  const maxCount = surgeResult?.data
    ? Math.max(...surgeResult.data.map((d: any) => d.count), 1)
    : 1;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 pt-28 pb-16 space-y-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white mb-1">📊 Analytics Dashboard</h1>
          <p className="text-gray-500">Peak windows, surge detection, and rental trends</p>
        </motion.div>

        {/* Peak Window (P11) */}
        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">⚡ 7-Day Peak Window</h2>
          <p className="text-gray-500 text-sm mb-6">Find the 7-day window with the highest rental activity</p>

          <form onSubmit={fetchPeak} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">From Month</label>
              <input
                type="month"
                value={peakFrom}
                onChange={e => setPeakFrom(e.target.value)}
                className="px-4 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">To Month</label>
              <input
                type="month"
                value={peakTo}
                onChange={e => setPeakTo(e.target.value)}
                className="px-4 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={peakLoading}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
            >
              {peakLoading ? 'Analyzing...' : 'Find Peak Window'}
            </button>
          </form>

          {peakError && <div className="mt-4"><ErrorMessage message={peakError} /></div>}

          {peakResult?.peakWindow && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <div className="p-6 bg-brand-600/10 border border-brand-500/20 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <h3 className="font-bold text-white text-lg">Peak 7-Day Window Found</h3>
                    <p className="text-gray-400 text-sm">
                      {peakResult.peakWindow.from} → {peakResult.peakWindow.to}
                    </p>
                  </div>
                </div>
                <div className="text-brand-400 text-3xl font-bold">
                  {peakResult.peakWindow.totalRentals?.toLocaleString()}
                  <span className="text-sm text-gray-500 font-normal ml-2">total rentals</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Surge Days (P13) */}
        <div className="glass-strong rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">📈 Surge Day Calendar</h2>
          <p className="text-gray-500 text-sm mb-6">For each day, see the next surge date with higher activity</p>

          <form onSubmit={fetchSurge} className="flex flex-wrap gap-4 items-end mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Month</label>
              <input
                type="month"
                value={surgeMonth}
                onChange={e => setSurgeMonth(e.target.value)}
                className="px-4 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={surgeLoading}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
            >
              {surgeLoading ? 'Analyzing...' : 'Analyze Surges'}
            </button>
          </form>

          {surgeError && <ErrorMessage message={surgeError} />}

          {surgeResult?.data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {surgeResult.data.map((day: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-3 glass rounded-xl">
                  <span className="text-sm text-gray-400 w-24 flex-shrink-0">{day.date}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-brand-600 rounded-full"
                          style={{ width: `${(day.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{day.count} rentals</span>
                    </div>
                  </div>
                  <div className="text-xs text-right w-40">
                    {day.nextSurgeDate ? (
                      <span className="text-green-400">
                        ↑ {day.nextSurgeDate} (+{day.daysUntil}d)
                      </span>
                    ) : (
                      <span className="text-gray-600">No surge ahead</span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
