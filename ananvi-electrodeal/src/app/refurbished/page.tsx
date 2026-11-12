import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts } from '@/lib/mockData';
import { RefreshCw, Shield, CheckCircle, Award } from 'lucide-react';

export const metadata = { title: 'Certified Refurbished Electronics UAE | ANANVI ElectroDeal' };

const trustBadges = [
  { icon: Shield, title: 'Certified Quality', desc: 'Each device inspected by certified technicians' },
  { icon: CheckCircle, title: 'Warranty Included', desc: 'Up to 12-month warranty on all refurbished items' },
  { icon: RefreshCw, title: 'Return Policy', desc: '30-day hassle-free returns guaranteed' },
  { icon: Award, title: 'Grade Guaranteed', desc: 'Accurate grading by independent assessors' },
];

export default function RefurbishedPage() {
  const refurbishedProducts = featuredProducts.filter((p) =>
    p.offers.some((o) =>
      o.condition === 'certified-refurbished' || o.condition === 'professionally-refurbished'
    )
  );

  const allProducts = featuredProducts;

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-green-400/30 mb-6">
              <RefreshCw size={14} className="text-green-400" />
              <span className="text-xs font-mono text-green-400 uppercase tracking-widest">Certified Refurbished</span>
            </div>
            <h1 className="font-display font-black text-5xl text-white mb-4">
              Refurbished Electronics
              <br />
              <span className="text-green-400">Save Up to 40%</span>
            </h1>
            <p className="text-silver-400 max-w-2xl mx-auto text-base leading-relaxed">
              Shop certified refurbished electronics in the UAE. Every device thoroughly tested, restored to factory
              standards, and backed by warranty — at a fraction of the original price.
            </p>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {trustBadges.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card rounded-xl p-4 border border-green-400/15 text-center">
                <div className="w-10 h-10 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-3">
                  <Icon size={18} className="text-green-400" />
                </div>
                <h3 className="font-display font-semibold text-sm text-white mb-1">{title}</h3>
                <p className="text-xs text-silver-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>

          {/* Grade guide */}
          <div className="glass-card rounded-2xl border border-white/8 p-6 mb-10">
            <h2 className="font-display font-bold text-white mb-4 text-center">Understanding Refurbished Grades</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { grade: 'Certified Refurbished', color: 'text-blue-400 border-blue-400/30 bg-blue-400/5', desc: 'Manufacturer or authorized dealer refurbished. Meets exact factory specs. Often indistinguishable from new.' },
                { grade: 'Professionally Refurbished', color: 'text-purple-400 border-purple-400/30 bg-purple-400/5', desc: 'Refurbished by a qualified third-party technician. Fully tested, minor cosmetic imperfections may be present.' },
                { grade: 'Open Box', color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5', desc: 'Opened but never used or returned quickly. Essentially new condition, all original accessories included.' },
              ].map(({ grade, color, desc }) => (
                <div key={grade} className={`rounded-xl p-4 border ${color}`}>
                  <span className={`inline-block text-xs font-mono font-bold mb-2 ${color.split(' ')[0]}`}>{grade}</span>
                  <p className="text-xs text-silver-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-white">
              Available Refurbished Deals <span className="text-silver-500 font-normal text-sm">({allProducts.length} products)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
