'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X, ArrowRight, Check, Minus } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';
import type { Product } from '@/lib/types';

const categoryEmoji: Record<string, string> = {
  smartphones: '📱', laptops: '💻', gaming: '🎮', televisions: '📺',
  audio: '🎧', cameras: '📷', wearables: '⌚', 'smart-home': '🏠', accessories: '🔌',
};

export default function ComparePage() {
  const [selected, setSelected] = useState<Product[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const addProduct = (product: Product) => {
    if (selected.length < 3 && !selected.find((p) => p.id === product.id)) {
      setSelected([...selected, product]);
      setShowPicker(false);
    }
  };

  const removeProduct = (id: string) => setSelected(selected.filter((p) => p.id !== id));

  const getBestPrice = (p: Product) =>
    Math.min(...p.offers.filter((o) => o.availability !== 'out-of-stock').map((o) => o.price));

  const allSpecs = selected.length > 0
    ? [...new Set(selected.flatMap((p) => p.specs.map((s) => s.name)))]
    : [];

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-2">Side-by-Side</p>
          <h1 className="font-display font-black text-4xl text-white mb-3">Compare Products</h1>
          <p className="text-silver-400 max-w-lg mx-auto text-sm">
            Add up to 3 products to compare specs, prices, and retailer offers side by side.
          </p>
        </div>

        {/* Product slots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((slot) => {
            const product = selected[slot];
            return (
              <div key={slot} className="glass-card rounded-2xl border border-white/8 p-5 min-h-48 flex flex-col">
                {product ? (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-4xl">{categoryEmoji[product.category] || '📦'}</span>
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="p-1.5 glass-card rounded-lg border border-white/10 text-silver-500 hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <h3 className="font-display font-bold text-sm text-white mb-1 leading-tight">{product.name}</h3>
                    <p className="text-xs font-mono text-electric-cyan mb-2">{product.brand}</p>
                    <div className="mt-auto">
                      <div className="text-lg font-display font-black text-white">
                        <span className="text-xs font-mono text-electric-cyan">AED </span>
                        {getBestPrice(product).toLocaleString()}
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowPicker(true)}
                    className="flex flex-col items-center justify-center h-full gap-2 text-silver-600 hover:text-silver-300 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-mono">Add Product</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Product picker modal */}
        {showPicker && (
          <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl border border-white/10 p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-white">Select a product</h3>
                <button onClick={() => setShowPicker(false)} className="text-silver-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {featuredProducts
                  .filter((p) => !selected.find((s) => s.id === p.id))
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="w-full flex items-center gap-3 p-3 glass-card rounded-xl border border-white/5 hover:border-electric-blue/30 transition-all text-left"
                    >
                      <span className="text-2xl">{categoryEmoji[product.category] || '📦'}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{product.name}</p>
                        <p className="text-xs text-silver-400 font-mono">
                          From AED {getBestPrice(product).toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Comparison table */}
        {selected.length >= 2 && (
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h2 className="font-display font-bold text-white">Specification Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left p-4 text-xs font-mono text-silver-600 uppercase tracking-wider">Spec</th>
                    {selected.map((p) => (
                      <th key={p.id} className="text-left p-4 text-xs font-mono text-electric-cyan uppercase tracking-wider">
                        {p.brand}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="p-4 text-xs font-mono text-silver-600 uppercase tracking-wider">Best Price</td>
                    {selected.map((p) => (
                      <td key={p.id} className="p-4 font-display font-bold text-white">
                        AED {getBestPrice(p).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-4 text-xs font-mono text-silver-600 uppercase tracking-wider">Offers</td>
                    {selected.map((p) => (
                      <td key={p.id} className="p-4 text-sm text-silver-200">
                        {p.offers.filter((o) => o.availability !== 'out-of-stock').length} available
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-4 text-xs font-mono text-silver-600 uppercase tracking-wider">Rating</td>
                    {selected.map((p) => (
                      <td key={p.id} className="p-4 text-sm text-silver-200">
                        ⭐ {p.rating} ({p.reviewCount.toLocaleString()})
                      </td>
                    ))}
                  </tr>
                  {allSpecs.map((specName) => (
                    <tr key={specName} className="border-b border-white/5">
                      <td className="p-4 text-xs font-mono text-silver-600 uppercase tracking-wider">{specName}</td>
                      {selected.map((p) => {
                        const spec = p.specs.find((s) => s.name === specName);
                        return (
                          <td key={p.id} className="p-4 text-sm text-silver-200">
                            {spec ? `${spec.value}${spec.unit ? ` ${spec.unit}` : ''}` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selected.length === 0 && (
          <div className="text-center py-16">
            <p className="text-silver-400 text-sm mb-4">Add products above to start comparing</p>
            <Link href="/search" className="inline-flex items-center gap-2 px-5 py-2.5 bg-electric-gradient rounded-lg text-sm font-semibold text-white">
              Browse Products <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
