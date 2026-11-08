'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, Zap, Brain, TrendingDown, Shield, Clock, ChevronRight, Star } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import CouponCard from '@/components/ui/CouponCard';
import { featuredProducts, featuredCoupons as coupons, categories } from '@/lib/mockData';

const stats = [
  { value: '11', label: 'UAE Retailers', icon: Shield },
  { value: '10K+', label: 'Products Tracked', icon: Zap },
  { value: 'AED 847', label: 'Avg User Savings', icon: TrendingDown },
  { value: '1hr', label: 'Price Update Cycle', icon: Clock },
];

const aiFeatures = [
  {
    icon: Brain,
    title: 'AI Research Reports',
    desc: 'Get a full analysis of any product — specs, reviews, price history, and buy vs wait recommendation.',
    href: '/ai-research',
    gradient: 'from-electric-blue to-electric-cyan',
  },
  {
    icon: TrendingDown,
    title: 'Deal Radar',
    desc: 'Set target prices and get notified the moment a product drops to your budget.',
    href: '/deal-radar',
    gradient: 'from-purple-600 to-electric-blue',
  },
  {
    icon: Zap,
    title: 'Instant Compare',
    desc: 'Side-by-side price and spec comparison across all 11 UAE retailers in one click.',
    href: '/compare',
    gradient: 'from-electric-cyan to-green-400',
  },
];

const heroKeywords = ['Smartphones', 'Laptops', 'Gaming', 'TVs', 'Audio', 'Cameras', 'Wearables'];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentKeyword, setCurrentKeyword] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentKeyword((prev) => (prev + 1) % heroKeywords.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <main className="min-h-screen bg-navy-950">
      <Navbar />

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
        {/* Animated background */}
        <div className="absolute inset-0 bg-navy-gradient" />
        <div className="absolute inset-0 overflow-hidden">
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,102,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,102,255,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          {/* Glow orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl animate-glow-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-electric-cyan/8 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
          {/* Scan line */}
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-cyan/30 to-transparent animate-scan" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-electric-blue/20 text-xs font-mono text-electric-cyan mb-8">
            <Zap size={12} className="animate-glow-pulse" />
            🇦🇪 UAE&apos;s AI-Powered Electronics Price Intelligence
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>

          {/* Headline */}
          <h1 className="font-display font-black text-5xl sm:text-6xl md:text-7xl text-white leading-none mb-4">
            THE FUTURE OF
            <br />
            <span className="electric-text">SMART SHOPPING</span>
            <br />
            STARTS HERE
          </h1>

          <p className="text-silver-400 text-lg sm:text-xl max-w-2xl mx-auto mb-3 font-light leading-relaxed">
            AI-powered price comparison across{' '}
            <span className="text-electric-cyan font-semibold">11 UAE retailers</span>.
            Find the best deals on{' '}
            <span
              className="text-white font-semibold transition-all duration-500"
              key={currentKeyword}
            >
              {mounted ? heroKeywords[currentKeyword] : heroKeywords[0]}
            </span>
            .
          </p>

          <p className="text-silver-600 text-sm font-mono mb-10 tracking-wide">
            COMPARE SMART · RESEARCH BETTER · SAVE MORE
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-electric-gradient rounded-2xl opacity-30 blur group-focus-within:opacity-60 transition-opacity duration-300" />
              <div className="relative flex items-center glass-card rounded-2xl overflow-hidden border border-white/10 group-focus-within:border-electric-blue/50 transition-colors p-1">
                <Search size={18} className="ml-4 text-electric-cyan shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="iPhone 17 Pro, Samsung Galaxy S26, MacBook Pro..."
                  className="flex-1 bg-transparent px-4 py-4 text-base text-silver-100 placeholder-silver-600 outline-none font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-electric shrink-0"
                >
                  <Zap size={15} />
                  Search
                </button>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {['iPhone 17 Pro', 'PS5 Slim', 'MacBook M4', 'Samsung S26', 'AirPods Pro'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSearchQuery(q)}
                  className="px-3 py-1 text-xs font-mono text-silver-500 glass-card rounded-full border border-white/8 hover:border-electric-blue/30 hover:text-silver-200 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </form>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="glass-card rounded-xl p-3 border border-white/5">
                <Icon size={16} className="text-electric-cyan mx-auto mb-1" />
                <div className="text-xl font-display font-black text-white">{value}</div>
                <div className="text-xs text-silver-600 font-mono">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-silver-600 animate-bounce">
          <span className="text-xs font-mono tracking-widest">SCROLL</span>
          <div className="w-px h-10 bg-gradient-to-b from-electric-cyan to-transparent" />
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Browse By Type</p>
            <h2 className="font-display font-bold text-2xl text-white">Shop Categories</h2>
          </div>
          <Link href="/search" className="flex items-center gap-1 text-xs font-mono text-silver-400 hover:text-electric-cyan transition-colors">
            All categories <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/search?category=${cat.id}`}
              className="group flex flex-col items-center gap-2 p-3 glass-card rounded-xl border border-white/5 hover:border-electric-blue/30 hover:shadow-glass transition-all duration-300 hover:-translate-y-1"
            >
              <span className="text-3xl group-hover:scale-125 transition-transform duration-300">{cat.icon}</span>
              <span className="text-xs font-mono text-silver-400 group-hover:text-white transition-colors text-center leading-tight">
                {cat.label}
              </span>
              <span className="text-xs text-silver-600 font-mono">{cat.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Today's Best Deals ── */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-electric-cyan uppercase tracking-widest">🔥 Hot Right Now</span>
              <span className="flex items-center gap-1 text-xs font-mono text-silver-600">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Updated 23 min ago
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl text-white">Today&apos;s Best Deals</h2>
          </div>
          <Link href="/deals" className="flex items-center gap-1 text-xs font-mono text-silver-400 hover:text-electric-cyan transition-colors">
            All deals <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProducts.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ── AI Features Banner ── */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Powered by AI</p>
            <h2 className="font-display font-bold text-3xl text-white mb-3">
              Shop Smarter with AI Intelligence
            </h2>
            <p className="text-silver-400 max-w-xl mx-auto text-sm leading-relaxed">
              Not just a price aggregator. ANANVI ElectroDeal uses AI to research, analyze,
              and guide every buying decision.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {aiFeatures.map(({ icon: Icon, title, desc, href, gradient }) => (
              <Link
                key={href}
                href={href}
                className="group glass-card rounded-2xl p-6 border border-white/8 hover:border-electric-blue/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-electric"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-20 flex items-center justify-center mb-4 shadow-electric group-hover:scale-110 transition-transform`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">{title}</h3>
                <p className="text-sm text-silver-400 leading-relaxed mb-4">{desc}</p>
                <div className="flex items-center gap-1 text-xs font-mono text-electric-cyan group-hover:gap-2 transition-all">
                  Try it free <ArrowRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coupons ── */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">AI-Verified Codes</p>
            <h2 className="font-display font-bold text-2xl text-white">Active Coupons</h2>
          </div>
          <Link href="/coupons" className="flex items-center gap-1 text-xs font-mono text-silver-400 hover:text-electric-cyan transition-colors">
            All coupons <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {coupons.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} />
          ))}
        </div>
      </section>

      {/* ── UAE Retailers Trust Strip ── */}
      <section className="py-10 px-4 sm:px-6 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-mono text-silver-600 uppercase tracking-widest mb-6">
            Prices sourced from UAE&apos;s top retailers
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Amazon.ae', 'Noon', 'Sharaf DG', 'Jumbo Electronics', 'Carrefour UAE', 'Virgin Megastore', 'Emax', 'Lulu Hypermarket', 'Revibe', 'Cartlow', 'Dubizzle'].map((r) => (
              <span
                key={r}
                className="px-4 py-2 glass-card rounded-full text-sm font-mono text-silver-400 border border-white/5 hover:border-electric-blue/30 hover:text-white transition-all cursor-default"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative glass-card rounded-3xl p-10 border border-electric-blue/20 overflow-hidden">
            <div className="absolute inset-0 bg-card-glow opacity-50" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-electric-gradient mx-auto mb-6 flex items-center justify-center shadow-electric">
                <Brain size={28} className="text-white" />
              </div>
              <h2 className="font-display font-black text-3xl text-white mb-3">
                Start Your AI Research Session
              </h2>
              <p className="text-silver-400 mb-8 leading-relaxed">
                Tell our AI what you need. It researches across all retailers, reads thousands of
                reviews, checks compatibility, and gives you a final buy recommendation — in seconds.
              </p>
              <Link
                href="/ai-research"
                className="inline-flex items-center gap-2 px-8 py-4 bg-electric-gradient rounded-xl text-base font-bold text-white hover:opacity-90 transition-opacity shadow-electric"
              >
                <Zap size={18} />
                Start AI Research — It&apos;s Free
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
