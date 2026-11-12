import Link from 'next/link';
import { Zap, Shield, Clock, Star, ArrowRight } from 'lucide-react';

const footerLinks = {
  shop: [
    { label: 'Smartphones', href: '/search?category=smartphones' },
    { label: 'Laptops', href: '/search?category=laptops' },
    { label: 'Gaming', href: '/search?category=gaming' },
    { label: 'Televisions', href: '/search?category=televisions' },
    { label: 'Audio', href: '/search?category=audio' },
    { label: 'Wearables', href: '/search?category=wearables' },
  ],
  tools: [
    { label: 'AI Research', href: '/ai-research' },
    { label: 'Price Comparison', href: '/compare' },
    { label: 'Deal Radar', href: '/deal-radar' },
    { label: 'Coupon Finder', href: '/coupons' },
    { label: 'Price History', href: '/price-history' },
    { label: 'Compatibility Check', href: '/compatibility' },
  ],
  condition: [
    { label: 'Brand New', href: '/new-electronics' },
    { label: 'Certified Refurbished', href: '/refurbished' },
    { label: 'Open Box', href: '/search?condition=open-box' },
    { label: 'Pre-Owned', href: '/used-electronics' },
    { label: 'Trade-In Value', href: '/trade-in' },
  ],
  company: [
    { label: 'About ANANVI', href: '/about' },
    { label: 'Retailers', href: '/retailers' },
    { label: 'Partner With Us', href: '/retailers#partner' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Contact Us', href: '/contact' },
  ],
};

const retailers = [
  'Amazon.ae', 'Noon', 'Sharaf DG', 'Jumbo Electronics',
  'Carrefour UAE', 'Virgin Megastore', 'Emax', 'Lulu', 'Revibe', 'Cartlow',
];

const trustBadges = [
  { icon: Shield, label: 'AI-Verified Prices' },
  { icon: Clock, label: 'Updated Every Hour' },
  { icon: Star, label: '10,000+ Products' },
  { icon: Zap, label: '11 UAE Retailers' },
];

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-white/5">
      {/* Newsletter CTA */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-display font-bold text-xl text-white mb-1">
                Get Deal Alerts Before Anyone Else
              </h3>
              <p className="text-silver-400 text-sm">
                AI-powered price drops delivered straight to your inbox. No spam, only savings.
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 md:w-64 bg-navy-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 transition-colors font-mono"
              />
              <button className="flex items-center gap-2 px-4 py-2.5 bg-electric-gradient rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-electric whitespace-nowrap">
                Get Alerts <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {trustBadges.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 glass-card rounded-xl p-4">
              <div className="p-2 bg-electric-blue/10 rounded-lg">
                <Icon size={18} className="text-electric-cyan" />
              </div>
              <span className="text-sm font-mono text-silver-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h4 className="text-xs font-mono font-bold text-electric-cyan uppercase tracking-widest mb-4">
              Shop By Category
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.shop.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-silver-600 hover:text-silver-200 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-electric-cyan uppercase tracking-widest mb-4">
              Smart Tools
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.tools.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-silver-600 hover:text-silver-200 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-electric-cyan uppercase tracking-widest mb-4">
              Shop By Condition
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.condition.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-silver-600 hover:text-silver-200 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-electric-cyan uppercase tracking-widest mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-silver-600 hover:text-silver-200 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Partner retailers */}
        <div className="mb-10 p-5 glass-card rounded-xl border border-white/5">
          <p className="text-xs font-mono text-silver-600 uppercase tracking-widest mb-3">
            Prices compared from
          </p>
          <div className="flex flex-wrap gap-2">
            {retailers.map((r) => (
              <span
                key={r}
                className="px-3 py-1 text-xs font-mono text-silver-400 bg-white/5 rounded-full border border-white/5 hover:border-electric-blue/30 hover:text-silver-200 transition-colors cursor-default"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-electric-gradient flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <div>
              <span className="font-display font-black text-white text-sm">ANANVI</span>
              <span className="font-display font-light text-electric-cyan text-sm ml-1">ElectroDeal</span>
            </div>
          </div>
          <p className="text-xs text-silver-600 font-mono text-center">
            © 2025 ANANVI ElectroDeal · UAE Electronics Price Intelligence · 🇦🇪 Dubai, UAE
          </p>
          <p className="text-xs text-silver-600 font-mono">
            Prices in AED · Updated hourly by AI
          </p>
        </div>
      </div>
    </footer>
  );
}
