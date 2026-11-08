'use client';

import { useState } from 'react';
import { Bell, Heart, TrendingDown, Package, ChevronRight, Zap, Star, AlertCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts, featuredCoupons as coupons } from '@/lib/mockData';

const mockAlerts = [
  { id: '1', product: 'iPhone 17 Pro Max 256GB', target: 3899, current: 4299, status: 'waiting' },
  { id: '2', product: 'Samsung Galaxy S26 Ultra', target: 3600, current: 3799, status: 'waiting' },
  { id: '3', product: 'MacBook Pro M4 14"', target: 5500, current: 5299, status: 'triggered' },
];

const mockWishlist = featuredProducts.slice(0, 3);

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'wishlist' | 'history'>('alerts');

  const stats = [
    { label: 'Active Alerts', value: '3', icon: Bell, color: 'text-electric-cyan' },
    { label: 'Wishlist Items', value: '3', icon: Heart, color: 'text-pink-400' },
    { label: 'Price Drops Caught', value: '7', icon: TrendingDown, color: 'text-green-400' },
    { label: 'Products Tracked', value: '12', icon: Package, color: 'text-electric-blue' },
  ];

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">My Account</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Deal Dashboard</h1>
          <p className="text-silver-400 text-sm">Track your alerts, wishlist, and savings in one place.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <Icon size={20} className={`${color} mx-auto mb-2`} />
              <p className={`font-display font-black text-2xl ${color}`}>{value}</p>
              <p className="text-xs font-mono text-silver-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass-card rounded-xl p-1 border border-white/8 w-fit">
          {(['alerts', 'wishlist', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-electric-blue/20 text-electric-cyan border border-electric-blue/30' : 'text-silver-500 hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {mockAlerts.map((alert) => (
              <div key={alert.id} className="glass-card rounded-xl p-4 border border-white/8 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.status === 'triggered' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{alert.product}</p>
                  <p className="text-xs font-mono text-silver-500">
                    Target: AED {alert.target.toLocaleString()} · Current: AED {alert.current.toLocaleString()}
                  </p>
                </div>
                {alert.status === 'triggered' ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400 whitespace-nowrap">
                    <Zap size={10} /> Price met!
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-xs font-mono text-yellow-400 whitespace-nowrap">
                    Watching
                  </span>
                )}
              </div>
            ))}
            <div className="glass-card rounded-xl p-4 border border-dashed border-white/10 flex items-center gap-3 cursor-pointer hover:border-electric-blue/30 transition-colors">
              <Bell size={16} className="text-silver-600" />
              <span className="text-sm text-silver-500">Set a new price alert</span>
              <ChevronRight size={14} className="text-silver-600 ml-auto" />
            </div>
          </div>
        )}

        {/* Wishlist Tab */}
        {activeTab === 'wishlist' && (
          <div className="space-y-3">
            {mockWishlist.map((product) => {
              const bestOffer = product.offers.reduce((a, b) => a.price < b.price ? a : b, product.offers[0]);
              return (
                <div key={product.id} className="glass-card rounded-xl p-4 border border-white/8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-navy-800 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {product.name.includes('iPhone') ? '📱' : product.name.includes('Samsung S') ? '📱' : product.name.includes('MacBook') ? '💻' : product.name.includes('Sony') ? '🎧' : product.name.includes('PS5') ? '🎮' : '📺'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{product.name}</p>
                    <p className="text-xs font-mono text-electric-cyan">AED {bestOffer?.price.toLocaleString()}</p>
                  </div>
                  <Heart size={16} className="text-pink-400 fill-pink-400 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {[
              { action: 'Price drop detected', product: 'MacBook Pro M4 14"', delta: '-AED 300', time: '2 hours ago', positive: true },
              { action: 'Coupon used', product: 'NOON10 — 10% off', delta: '-AED 429', time: '3 days ago', positive: true },
              { action: 'Price increased', product: 'Samsung Galaxy S26 Ultra', delta: '+AED 200', time: '5 days ago', positive: false },
              { action: 'Alert triggered', product: 'Sony WH-1000XM6', delta: '-AED 150', time: '1 week ago', positive: true },
            ].map((item, i) => (
              <div key={i} className="glass-card rounded-xl p-4 border border-white/8 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.positive ? 'bg-green-400/10' : 'bg-red-400/10'}`}>
                  {item.positive ? <TrendingDown size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{item.action}</p>
                  <p className="text-xs font-mono text-silver-500">{item.product}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-mono font-bold ${item.positive ? 'text-green-400' : 'text-red-400'}`}>{item.delta}</p>
                  <p className="text-xs text-silver-600">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommended coupons */}
        <div className="mt-10">
          <h2 className="font-display font-bold text-white text-sm mb-4 flex items-center gap-2">
            <Star size={14} className="text-electric-cyan" /> Recommended Coupons
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {coupons.slice(0, 3).map((coupon) => (
              <div key={coupon.id} className="glass-card rounded-xl p-4 border border-white/8">
                <p className="font-mono font-bold text-electric-cyan text-sm mb-1">{coupon.code}</p>
                <p className="text-xs text-silver-400">{coupon.discount}{coupon.discountType === 'percentage' ? '%' : ' AED'} off — {coupon.terms.slice(0, 60)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
