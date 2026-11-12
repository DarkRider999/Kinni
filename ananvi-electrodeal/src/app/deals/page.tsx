import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts } from '@/lib/mockData';

export const metadata = { title: 'Best Deals | ANANVI ElectroDeal' };

export default function DealsPage() {
  const deals = [...featuredProducts].sort((a, b) => {
    const aSavings = a.offers[0]?.originalPrice - a.offers[0]?.price || 0;
    const bSavings = b.offers[0]?.originalPrice - b.offers[0]?.price || 0;
    return bSavings - aSavings;
  });

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-12">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">🔥 Hot Right Now</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Today&apos;s Best Deals</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm">
            AI-curated deals updated every hour from 11 UAE retailers. Biggest savings first.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
