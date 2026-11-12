import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Brain, Zap, Shield, Users } from 'lucide-react';

export const metadata = { title: 'About ANANVI ElectroDeal | UAE Smart Shopping Platform' };

const stats = [
  { value: '11', label: 'UAE Retailers Monitored' },
  { value: '50K+', label: 'Products Tracked' },
  { value: '1M+', label: 'Price Updates Daily' },
  { value: '100K+', label: 'UAE Shoppers Served' },
];

const values = [
  { icon: Brain, title: 'AI-First Approach', desc: 'We use advanced AI to analyze prices, detect patterns, and give you personalized buying recommendations based on real UAE market data.' },
  { icon: Zap, title: 'Real-Time Data', desc: 'Our crawlers check prices across 11 UAE retailers every hour — so you always see the most accurate, up-to-date pricing information.' },
  { icon: Shield, title: 'Consumer Trust', desc: 'We never accept payment for placement. Every ranking and recommendation is based purely on price, quality, and consumer value.' },
  { icon: Users, title: 'Built for the UAE', desc: 'Designed specifically for UAE shoppers — AED pricing, Arabic support, local retailer focus, and understanding of the UAE electronics market.' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-electric-gradient mb-6 shadow-electric">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="font-display font-black text-5xl text-white mb-4">
            About <span className="bg-electric-gradient bg-clip-text text-transparent">ANANVI ElectroDeal</span>
          </h1>
          <p className="text-silver-400 text-lg max-w-2xl mx-auto leading-relaxed">
            The UAE&apos;s most intelligent electronics price comparison platform. We use AI to help you buy smarter, not harder.
          </p>
        </div>

        {/* Mission */}
        <div className="glass-card rounded-2xl p-8 border border-electric-blue/20 mb-12">
          <h2 className="font-display font-bold text-2xl text-white mb-4">Our Mission</h2>
          <p className="text-silver-300 leading-relaxed text-base mb-4">
            In a market with over 11 major electronics retailers, finding the best deal for any product can take hours
            of research. We built ANANVI ElectroDeal to solve that problem for UAE shoppers.
          </p>
          <p className="text-silver-400 leading-relaxed">
            Our AI monitors prices 24/7, analyzes historical trends, verifies coupon codes, and generates
            personalized research reports — so you can make confident buying decisions in minutes, not hours.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map(({ value, label }) => (
            <div key={label} className="glass-card rounded-xl p-5 border border-white/8 text-center">
              <div className="font-display font-black text-3xl bg-electric-gradient bg-clip-text text-transparent mb-1">{value}</div>
              <div className="text-xs text-silver-500 font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Values */}
        <h2 className="font-display font-bold text-2xl text-white mb-6">What We Stand For</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-12">
          {values.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-xl p-5 border border-white/8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-electric-cyan" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-silver-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legal */}
        <div className="glass-card rounded-xl p-5 border border-white/5">
          <p className="text-xs text-silver-600 font-mono leading-relaxed">
            ANANVI ElectroDeal is a price comparison service. We do not sell products directly. All prices and
            availability are sourced from partner retailers and updated regularly. Prices may vary at the time
            of purchase. ANANVI is not responsible for price discrepancies between our listings and retailer
            websites. All trademarks belong to their respective owners.
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}
