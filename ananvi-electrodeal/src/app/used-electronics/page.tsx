import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts } from '@/lib/mockData';
import { Tag, Star, Info } from 'lucide-react';

export const metadata = { title: 'Used Electronics UAE | ANANVI ElectroDeal' };

export default function UsedElectronicsPage() {
  const products = featuredProducts;

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-amber-400/30 mb-6">
            <Tag size={14} className="text-amber-400" />
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Pre-Owned Electronics</span>
          </div>
          <h1 className="font-display font-black text-5xl text-white mb-4">
            Used Electronics
            <br />
            <span className="text-amber-400">Best Value in UAE</span>
          </h1>
          <p className="text-silver-400 max-w-2xl mx-auto text-base leading-relaxed">
            Find pre-owned electronics from trusted UAE sellers. Verified condition ratings, honest descriptions,
            and competitive prices across 11 retailers.
          </p>
        </div>

        {/* Condition guide */}
        <div className="glass-card rounded-2xl border border-white/8 p-6 mb-10">
          <div className="flex items-start gap-3 mb-4">
            <Info size={16} className="text-electric-cyan mt-0.5 shrink-0" />
            <h2 className="font-display font-bold text-white">Pre-Owned Condition Guide</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { grade: 'Pre-Owned: Excellent', emoji: '⭐', color: 'text-green-400 border-green-400/20 bg-green-400/5', desc: 'Minimal signs of use. All functions perfect. Original accessories may not be included.' },
              { grade: 'Pre-Owned: Good', emoji: '👍', color: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5', desc: 'Light scratches or scuffs. Fully functional. Normal wear from regular use.' },
              { grade: 'Pre-Owned: Fair', emoji: '✓', color: 'text-orange-400 border-orange-400/20 bg-orange-400/5', desc: 'Visible signs of use. Works as intended. Best value for budget shoppers.' },
            ].map(({ grade, emoji, color, desc }) => (
              <div key={grade} className={`rounded-xl p-4 border ${color}`}>
                <div className="text-2xl mb-2">{emoji}</div>
                <span className={`text-xs font-mono font-bold mb-2 block ${color.split(' ')[0]}`}>{grade}</span>
                <p className="text-xs text-silver-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { value: '500+', label: 'Used Listings' },
            { value: '11', label: 'UAE Retailers' },
            { value: '30 Days', label: 'Return Window' },
          ].map(({ value, label }) => (
            <div key={label} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <div className="font-display font-black text-2xl text-electric-cyan mb-1">{value}</div>
              <div className="text-xs text-silver-500 font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Product grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-white">
            Available Now <span className="text-silver-500 font-normal text-sm">({products.length} products)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs font-mono text-silver-500">
            <Star size={12} className="text-amber-400" />
            Sorted by best value
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
