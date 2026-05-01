'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { getMe, getDiscount, getTopCategories } from '@/lib/api';
import { CategoryBadge } from '@/components/ui';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [discount, setDiscount] = useState<any>(null);
  const [topCats, setTopCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('rentpi_token');
    if (!token) { router.push('/login'); return; }

    const u = localStorage.getItem('rentpi_user');
    const localUser = u ? JSON.parse(u) : null;
    if (localUser) setUser(localUser);

    const fetchData = async () => {
      setLoading(true);
      try {
        const meRes = await getMe();
        setUser(meRes.data);
        const uid = meRes.data.id;
        // Fetch discount
        try {
          const discRes = await getDiscount(uid);
          setDiscount(discRes.data);
        } catch {}
        // Fetch top categories
        try {
          const catRes = await getTopCategories(uid, 5);
          setTopCats(catRes.data.topCategories || []);
        } catch {}
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDiscountColor = (pct: number) => {
    if (pct >= 20) return 'text-green-400';
    if (pct >= 15) return 'text-brand-400';
    if (pct >= 10) return 'text-yellow-400';
    if (pct >= 5) return 'text-orange-400';
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white mb-8">👤 My Profile</h1>

          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-40 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="glass-strong rounded-2xl p-8">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white">
                    {user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
                    <p className="text-gray-400">{user?.email}</p>
                    <p className="text-gray-600 text-sm mt-1">
                      Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Discount Tier */}
              {discount && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-semibold text-white mb-4">💎 Loyalty Discount</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Security Score</p>
                      <p className="text-3xl font-bold text-white">{discount.securityScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-sm">Your Discount</p>
                      <p className={`text-4xl font-bold ${getDiscountColor(discount.discountPercent)}`}>
                        {discount.discountPercent}%
                      </p>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="mt-4">
                    <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${discount.securityScore}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-brand-600 to-green-500 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>0</span>
                      <span>Score: {discount.securityScore}/100</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Categories */}
              {topCats.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="font-semibold text-white mb-4">🎯 Favorite Categories</h3>
                  <div className="space-y-3">
                    {topCats.map((cat, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <CategoryBadge category={cat.category} />
                        <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-600 to-purple-600 rounded-full"
                            style={{ width: `${(cat.rentalCount / topCats[0].rentalCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-20 text-right">{cat.rentalCount} rentals</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-4">
                <Link href="/products" className="glass rounded-2xl p-5 text-center hover:border-brand-500/30 transition-all">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-sm font-medium text-white">Browse Products</div>
                </Link>
                <Link href="/chat" className="glass rounded-2xl p-5 text-center hover:border-purple-500/30 transition-all">
                  <div className="text-2xl mb-1">🤖</div>
                  <div className="text-sm font-medium text-white">Ask AI Assistant</div>
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
