'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Bell, Heart, User, Menu, X, Zap, Shield, Tag } from 'lucide-react';

const navLinks = [
  {
    label: 'Shop',
    href: '#',
    children: [
      { label: 'New Electronics', href: '/new-electronics', icon: '✨' },
      { label: 'Refurbished', href: '/refurbished', icon: '♻️' },
      { label: 'Used Electronics', href: '/used-electronics', icon: '🏷️' },
      { label: 'All Deals', href: '/deals', icon: '🔥' },
    ],
  },
  {
    label: 'AI Research',
    href: '/ai-research',
    children: null,
  },
  {
    label: 'Compare',
    href: '/compare',
    children: null,
  },
  {
    label: 'Coupons',
    href: '/coupons',
    children: null,
  },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy-900/95 backdrop-blur-xl border-b border-white/10 shadow-glass'
          : 'bg-transparent'
      }`}
    >
      {/* Top announcement bar */}
      <div className="bg-gradient-to-r from-electric-blue via-electric-glow to-electric-cyan py-1.5 px-4 text-center">
        <p className="text-xs font-mono text-navy-950 font-semibold tracking-wide">
          🇦🇪 Free delivery across UAE on orders over AED 199 · AI-verified prices updated every hour
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-electric-gradient flex items-center justify-center shadow-electric">
              <Zap size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-black text-white text-lg tracking-tight">ANANVI</span>
              <span className="font-display font-light text-electric-cyan text-lg tracking-widest ml-1">
                ElectroDeal
              </span>
            </div>
          </Link>

          {/* Search bar — desktop */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full group">
              <div className="absolute inset-0 rounded-xl bg-electric-gradient opacity-0 group-focus-within:opacity-20 blur-sm transition-opacity duration-300" />
              <div className="relative flex items-center glass-card rounded-xl overflow-hidden border border-white/10 group-focus-within:border-electric-blue/50 transition-colors">
                <input
                  type="text"
                  placeholder="Search electronics, brands, models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none font-mono"
                />
                <button className="px-4 py-2.5 text-electric-cyan hover:text-white transition-colors">
                  <Search size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Nav links — desktop */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="relative">
                {link.children ? (
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm text-silver-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.label}
                    <ChevronDown size={12} />
                    {openDropdown === link.label && (
                      <div className="absolute top-full left-0 mt-2 w-52 glass-card rounded-xl overflow-hidden z-50">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-silver-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <span>{child.icon}</span>
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    className="px-3 py-2 text-sm text-silver-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/coupons"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 glass-card rounded-lg text-xs font-mono text-electric-cyan border border-electric-cyan/20 hover:border-electric-cyan/50 hover:bg-electric-cyan/10 transition-all"
            >
              <Tag size={12} />
              Coupons
            </Link>

            <button className="p-2 rounded-lg text-silver-400 hover:text-white hover:bg-white/5 transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-electric-blue rounded-full" />
            </button>

            <button className="p-2 rounded-lg text-silver-400 hover:text-white hover:bg-white/5 transition-colors">
              <Heart size={18} />
            </button>

            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 bg-electric-gradient rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-electric"
            >
              <User size={14} />
              <span className="hidden sm:inline">My Deals</span>
            </Link>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg text-silver-400 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-3">
          <div className="relative flex items-center glass-card rounded-xl overflow-hidden border border-white/10">
            <input
              type="text"
              placeholder="Search electronics..."
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none"
            />
            <button className="px-4 py-2.5 text-electric-cyan">
              <Search size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-navy-900/98 backdrop-blur-xl border-t border-white/10">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <div key={link.label}>
                <Link
                  href={link.href}
                  className="block px-3 py-2.5 text-sm text-silver-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
                {link.children && (
                  <div className="pl-4">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-silver-600 hover:text-silver-400 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span>{child.icon}</span>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-silver-600">
                <Shield size={12} />
                <span>Prices verified by AI · Updated hourly</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
