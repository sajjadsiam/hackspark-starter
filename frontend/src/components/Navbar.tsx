'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const navLinks = [
  { href: '/products', label: 'Products' },
  { href: '/availability', label: 'Availability' },
  { href: '/trending', label: 'Trending' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/chat', label: 'AI Chat' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('rentpi_user');
    if (u) setUser(JSON.parse(u));

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rentpi_token');
    localStorage.removeItem('rentpi_user');
    router.push('/login');
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/10 py-3' : 'py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            RentPi
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === link.href
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/profile"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                <span className="hidden sm:inline">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-sm rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all glow-blue"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
