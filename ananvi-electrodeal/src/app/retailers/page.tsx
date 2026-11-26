import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { retailers } from '@/lib/mockData';
import { ExternalLink, Store, Star, Shield } from 'lucide-react';

export const metadata = { title: 'UAE Electronics Retailers | ANANVI ElectroDeal' };

export default function RetailersPage() {
  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-white/15 mb-6">
            <Store size={14} className="text-electric-cyan" />
            <span className="text-xs font-mono text-electric-cyan uppercase tracking-widest">Our Retail Partners</span>
          </div>
          <h1 className="font-display font-black text-5xl text-white mb-4">UAE Retailer Directory</h1>
          <p className="text-silver-400 max-w-2xl mx-auto text-base leading-relaxed">
            We monitor prices across {retailers.length} authorised UAE electronics retailers in real-time.
            All retailers are verified and rated for reliability, pricing, and customer service.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { value: retailers.length.toString(), label: 'Partner Retailers' },
            { value: '24/7', label: 'Price Monitoring' },
            { value: '11', label: 'UAE Cities Covered' },
          ].map(({ value, label }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <div className="font-display font-black text-2xl text-electric-cyan mb-1">{value}</div>
              <div className="text-xs text-silver-500 font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Retailer grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {retailers.map((retailer) => (
            <div key={retailer.id} className="glass-card rounded-2xl border border-white/8 p-6 hover:border-electric-blue/30 transition-all group">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-navy-800 border border-white/10 flex items-center justify-center text-2xl font-display font-black text-electric-cyan">
                    {retailer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white">{retailer.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${retailer.verified ? 'bg-green-400' : 'bg-silver-600'}`} />
                      <span className={`text-xs font-mono ${retailer.verified ? 'text-green-400' : 'text-silver-600'}`}>
                        {retailer.verified ? 'Verified Partner' : 'Listed Retailer'}
                      </span>
                    </div>
                  </div>
                </div>
                {retailer.url && (
                  <a
                    href={retailer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 glass-card rounded-lg border border-white/10 text-silver-500 hover:text-electric-cyan transition-colors"
                    aria-label={`Visit ${retailer.name}`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              {/* Logo URL pill */}
              {retailer.logo && (
                <div className="mb-4">
                  <span className="text-xs font-mono text-silver-600 bg-navy-800 px-3 py-1 rounded-lg">
                    {retailer.logo.replace('https://', '')}
                  </span>
                </div>
              )}

              {/* Features */}
              <div className="space-y-2">
                {[
                  { icon: Shield, text: 'Official UAE retailer' },
                  { icon: Star, text: 'Price tracked 24/7' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-silver-500">
                    <Icon size={12} className="text-electric-cyan" />
                    {text}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-white/5">
                {retailer.url ? (
                  <a
                    href={retailer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 glass-card rounded-xl border border-white/10 text-xs font-mono text-silver-400 hover:text-electric-cyan hover:border-electric-blue/30 transition-all"
                  >
                    <ExternalLink size={12} />
                    Shop at {retailer.name}
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-2 w-full py-2 glass-card rounded-xl border border-white/5 text-xs font-mono text-silver-600">
                    <Store size={12} />
                    In-store only
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Partner CTA */}
        <div className="mt-16 glass-card rounded-2xl p-8 border border-electric-blue/20 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-card-glow opacity-20" />
          <div className="relative z-10">
            <h2 className="font-display font-bold text-2xl text-white mb-3">Are You a UAE Retailer?</h2>
            <p className="text-silver-400 text-sm max-w-lg mx-auto mb-6">
              Join our platform and reach thousands of price-conscious UAE shoppers. Get featured placement,
              performance analytics, and AI-powered pricing insights.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-electric-gradient rounded-xl text-sm font-bold text-white shadow-electric hover:opacity-90 transition-opacity"
            >
              <Store size={16} />
              Become a Partner Retailer
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
