import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts } from '@/lib/mockData';
import { Sparkles, Package, Truck, Shield } from 'lucide-react';

export const metadata = { title: 'New Electronics UAE | ANANVI ElectroDeal' };

export default function NewElectronicsPage() {
  const products = featuredProducts;

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-electric-blue/30 mb-6">
            <Sparkles size={14} className="text-electric-cyan" />
            <span className="text-xs font-mono text-electric-cyan uppercase tracking-widest">Brand New · Sealed</span>
          </div>
          <h1 className="font-display font-black text-5xl text-white mb-4">
            New Electronics
            <br />
            <span className="bg-electric-gradient bg-clip-text text-transparent">Best Prices in UAE</span>
          </h1>
          <p className="text-silver-400 max-w-2xl mx-auto text-base leading-relaxed">
            Brand-new sealed electronics from 11 authorised UAE retailers. Full manufacturer warranty,
            original accessories included, with AI-powered price comparison to find you the best deal.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Package, title: 'Factory Sealed', desc: 'All items brand new in original box' },
            { icon: Shield, title: 'Full Warranty', desc: 'Official manufacturer warranty' },
            { icon: Truck, title: 'Fast Delivery', desc: 'Same-day delivery in Dubai & Abu Dhabi' },
            { icon: Sparkles, title: 'Best Price', desc: 'AI finds the lowest price across all retailers' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-xl p-4 border border-white/8 text-center">
              <div className="w-10 h-10 rounded-lg bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center mx-auto mb-3">
                <Icon size={18} className="text-electric-cyan" />
              </div>
              <h3 className="font-display font-semibold text-sm text-white mb-1">{title}</h3>
              <p className="text-xs text-silver-500 leading-snug">{desc}</p>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['All', 'Smartphones', 'Laptops', 'Gaming', 'Audio', 'Televisions', 'Cameras', 'Wearables'].map((cat) => (
            <button
              key={cat}
              className={`px-4 py-1.5 rounded-full text-xs font-mono border transition-all ${
                cat === 'All'
                  ? 'bg-electric-gradient text-white border-transparent shadow-electric'
                  : 'glass-card text-silver-400 border-white/10 hover:border-electric-blue/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product count */}
        <div className="mb-6">
          <p className="text-xs text-silver-600 font-mono">{products.length} products found · Prices updated 23 minutes ago</p>
        </div>

        {/* Products */}
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
