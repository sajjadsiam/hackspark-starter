'use client';
import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getAvailability } from '@/lib/api';
import { ErrorMessage } from '@/components/ui';

function AvailabilityContent() {
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState(searchParams.get('productId') || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !fromDate || !toDate) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await getAvailability(parseInt(productId), fromDate, toDate);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check availability.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-white mb-2">Availability Checker</h1>
        <p className="text-gray-500 mb-8">Check if a product is free during your desired dates</p>

        <div className="glass-strong rounded-2xl p-8 mb-8">
          <form onSubmit={handleCheck} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Product ID</label>
              <input
                id="avail-product-id"
                type="number"
                required
                value={productId}
                onChange={e => setProductId(e.target.value)}
                placeholder="e.g. 42"
                className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">From Date</label>
                <input
                  id="avail-from"
                  type="date"
                  required
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">To Date</label>
                <input
                  id="avail-to"
                  type="date"
                  required
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
            <button
              id="avail-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
            >
              {loading ? 'Checking...' : 'Check Availability'}
            </button>
          </form>
        </div>

        {error && <ErrorMessage message={error} />}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status */}
            <div className={`glass-strong rounded-2xl p-6 text-center border ${
              result.available
                ? 'border-green-500/30'
                : 'border-red-500/30'
            }`}>
              <div className="text-5xl mb-3">{result.available ? '✅' : '❌'}</div>
              <h2 className="text-2xl font-bold">
                {result.available ? (
                  <span className="text-green-400">Product is Available!</span>
                ) : (
                  <span className="text-red-400">Not Available</span>
                )}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Product #{result.productId} · {result.from} to {result.to}
              </p>
            </div>

            {/* Busy Periods */}
            {result.busyPeriods?.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4">🔴 Busy Periods</h3>
                <div className="space-y-2">
                  {result.busyPeriods.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 px-4 bg-red-500/10 rounded-lg border border-red-500/20">
                      <span className="text-red-400 text-sm">{p.start}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-red-400 text-sm">{p.end}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Free Windows */}
            {result.freeWindows?.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4">🟢 Free Windows</h3>
                <div className="space-y-2">
                  {result.freeWindows.map((w: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 px-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <span className="text-green-400 text-sm">{w.start}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-green-400 text-sm">{w.end}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <Suspense fallback={<div className="pt-28 text-center text-gray-500">Loading...</div>}>
        <AvailabilityContent />
      </Suspense>
    </div>
  );
}
