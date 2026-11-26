'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/ui/ProductCard';
import { featuredProducts, categories } from '@/lib/mockData';
import type { SearchFilters, ProductCategory } from '@/lib/types';

const sortOptions = [
  { value: 'lowest-price', label: 'Lowest Price' },
  { value: 'best-value', label: 'Best Value' },
  { value: 'best-warranty', label: 'Best Warranty' },
  { value: 'seller-reliability', label: 'Seller Reliability' },
  { value: 'fastest-delivery', label: 'Fastest Delivery' },
];

const conditionOptions = [
  { value: 'brand-new-sealed', label: 'Brand New' },
  { value: 'open-box', label: 'Open Box' },
  { value: 'certified-refurbished', label: 'Certified Refurb' },
  { value: 'professionally-refurbished', label: 'Pro Refurb' },
  { value: 'pre-owned-excellent', label: 'Pre-Owned Excellent' },
  { value: 'pre-owned-good', label: 'Pre-Owned Good' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') as ProductCategory | null;

  const [filters, setFilters] = useState<SearchFilters>({
    category: categoryParam || undefined,
    sortBy: 'lowest-price',
    inStockOnly: true,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = featuredProducts.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-navy-950 pt-28">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-electric-cyan" />
            <input
              type="text"
              defaultValue={query}
              placeholder="Search electronics, brands, models..."
              className="w-full bg-navy-800 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-silver-100 placeholder-silver-600 outline-none focus:border-electric-blue/50 font-mono"
            />
          </div>
        </div>

        {/* Result summary + controls */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-display font-bold text-white">
              {query ? `Results for "${query}"` : filters.category ? `${categories.find(c => c.id === filters.category)?.label || 'Category'}` : 'All Electronics'}
            </h1>
            <p className="text-xs text-silver-600 font-mono mt-0.5">{filtered.length} products found</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 px-4 py-2 glass-card rounded-lg border border-white/10 text-sm text-silver-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal size={15} />
              Filters
            </button>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as SearchFilters['sortBy'] })}
              className="bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-silver-400 outline-none focus:border-electric-blue/50 font-mono"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilters({ ...filters, category: undefined })}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${!filters.category ? 'bg-electric-gradient text-white border-transparent shadow-electric' : 'glass-card text-silver-400 border-white/10 hover:border-electric-blue/30'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilters({ ...filters, category: cat.id as ProductCategory })}
              className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${filters.category === cat.id ? 'bg-electric-gradient text-white border-transparent shadow-electric' : 'glass-card text-silver-400 border-white/10 hover:border-electric-blue/30'}`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Results grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="font-display font-bold text-xl text-white mb-2">No results found</h3>
            <p className="text-silver-400 text-sm mb-6">Try a different search or browse all categories</p>
            <button
              onClick={() => setFilters({ sortBy: 'lowest-price', inStockOnly: true })}
              className="px-6 py-2.5 bg-electric-gradient rounded-lg text-sm font-semibold text-white"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-navy-950 pt-28 flex items-center justify-center">
        <div className="text-silver-400 font-mono">Loading search...</div>
      </main>
    }>
      <SearchContent />
    </Suspense>
  );
}
