'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { getProducts } from '@/lib/api';
import { CategoryBadge, SkeletonCard, ErrorMessage, EmptyState } from '@/components/ui';
import Link from 'next/link';

const CATEGORIES = [
  'ALL', 'ELECTRONICS', 'FURNITURE', 'VEHICLES', 'TOOLS',
  'OUTDOOR', 'SPORTS', 'MUSIC', 'CAMERAS', 'OFFICE'
];

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('ALL');
  const [limit] = useState(20);

  const fetchProducts = useCallback(async (p = 1, cat = category) => {
    setLoading(true);
    setError('');
    try {
      const params: any = { page: p, limit };
      if (cat !== 'ALL') params.category = cat;
      const res = await getProducts(params);
      setProducts(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [category, limit]);

  useEffect(() => { fetchProducts(1, category); }, [category]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-white">Product Catalog</h1>
          <p className="text-gray-500 mt-1">
            {total > 0 ? `${total.toLocaleString()} products available` : 'Browse our rental catalog'}
          </p>
        </motion.div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category === cat
                  ? 'bg-brand-600 text-white border border-brand-500'
                  : 'glass text-gray-400 hover:text-white border border-white/5 hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchProducts(page, category)} />
        ) : products.length === 0 ? (
          <EmptyState title="No products found" description="Try a different category or page." icon="📦" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass rounded-2xl p-5 hover:border-brand-500/30 transition-all group gradient-border"
                >
                  <div className="flex items-start justify-between mb-3">
                    <CategoryBadge category={product.category} />
                    <span className="text-xs text-gray-500">#{product.id}</span>
                  </div>
                  <h3 className="font-semibold text-white text-sm group-hover:text-brand-300 transition-colors line-clamp-2 mb-2">
                    {product.name}
                  </h3>
                  <p className="text-brand-400 font-bold text-lg">
                    ${product.pricePerDay?.toFixed(2)}<span className="text-xs text-gray-500">/day</span>
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/availability?productId=${product.id}`}
                      className="flex-1 text-center py-2 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 text-xs rounded-lg transition-all border border-brand-500/20"
                    >
                      Check Dates
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => fetchProducts(page - 1, category)}
                disabled={page === 1}
                className="px-5 py-2 glass rounded-lg text-sm disabled:opacity-30 hover:border-brand-500/20 transition-all"
              >
                ← Prev
              </button>
              <span className="text-gray-400 text-sm">
                Page {page} of {totalPages.toLocaleString()}
              </span>
              <button
                onClick={() => fetchProducts(page + 1, category)}
                disabled={page >= totalPages}
                className="px-5 py-2 glass rounded-lg text-sm disabled:opacity-30 hover:border-brand-500/20 transition-all"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
