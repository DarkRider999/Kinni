import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Shield, Clock, RotateCcw, Truck, Star, TrendingDown, Zap, Check } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { featuredProducts } from '@/lib/mockData';
import type { ProductOffer } from '@/lib/types';

const conditionLabels: Record<string, { label: string; desc: string }> = {
  'brand-new-sealed': { label: 'Brand New Sealed', desc: 'Factory sealed, never opened. Full manufacturer warranty.' },
  'open-box': { label: 'Open Box', desc: 'Opened but unused. Original packaging may have minor damage.' },
  'certified-refurbished': { label: 'Certified Refurbished', desc: 'Tested and certified by manufacturer or authorized partner.' },
  'professionally-refurbished': { label: 'Pro Refurbished', desc: 'Fully tested, cleaned and restored by a professional.' },
  'pre-owned-excellent': { label: 'Pre-Owned Excellent', desc: 'Used, minimal to no signs of wear. Fully functional.' },
  'pre-owned-good': { label: 'Pre-Owned Good', desc: 'Used with minor cosmetic wear. Fully functional.' },
  'pre-owned-fair': { label: 'Pre-Owned Fair', desc: 'Noticeable wear. Fully functional.' },
  'unverified': { label: 'Unverified Condition', desc: 'Condition not verified. Buy with caution.' },
};

function OfferRow({ offer, rank }: { offer: ProductOffer; rank: number }) {
  const isBest = rank === 0;
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isBest ? 'border-electric-blue/40 bg-electric-blue/5 shadow-glass' : 'border-white/5 glass-card hover:border-electric-blue/20'}`}>
      {isBest && (
        <div className="absolute -top-2.5 left-4">
          <span className="px-2 py-0.5 bg-electric-gradient rounded-full text-xs font-bold text-white shadow-electric">
            Best Price
          </span>
        </div>
      )}
      {/* Retailer */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-silver-100 truncate">{offer.retailer.name}</span>
          {offer.retailer.verified && <Shield size={12} className="text-green-400 shrink-0" />}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-silver-600 font-mono">
          <span className={`px-2 py-0.5 rounded-full border text-xs ${
            offer.condition === 'brand-new-sealed' ? 'condition-brand-new'
            : offer.condition === 'open-box' ? 'condition-open-box'
            : offer.condition.includes('refurbished') ? 'condition-certified-refurb'
            : 'condition-preowned'
          }`}>
            {conditionLabels[offer.condition]?.label}
          </span>
          <span className="flex items-center gap-1"><Truck size={10} /> {offer.deliveryFee === 0 ? 'Free delivery' : `AED ${offer.deliveryFee}`}</span>
          <span className="flex items-center gap-1"><Clock size={10} /> {offer.deliveryDays}d</span>
          <span className="flex items-center gap-1"><RotateCcw size={10} /> {offer.returnDays}d returns</span>
        </div>
      </div>
      {/* Price */}
      <div className="text-right shrink-0">
        {offer.discount > 0 && (
          <div className="text-xs text-silver-600 line-through font-mono">AED {offer.originalPrice.toLocaleString()}</div>
        )}
        <div className="text-xl font-display font-black text-white">
          <span className="text-xs font-mono text-electric-cyan">AED </span>
          {offer.price.toLocaleString()}
        </div>
        {offer.discount > 0 && (
          <div className="text-xs text-green-400 font-mono flex items-center gap-0.5 justify-end">
            <TrendingDown size={10} /> Save AED {(offer.originalPrice - offer.price).toLocaleString()}
          </div>
        )}
        {offer.couponCode && (
          <div className="text-xs font-mono text-electric-cyan mt-1">🏷️ Code: {offer.couponCode}</div>
        )}
      </div>
      {/* CTA */}
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
          isBest
            ? 'bg-electric-gradient text-white hover:opacity-90 shadow-electric'
            : 'glass-card border border-white/10 text-silver-400 hover:text-white hover:border-electric-blue/40'
        }`}
      >
        Buy <ExternalLink size={12} />
      </a>
    </div>
  );
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const product = featuredProducts.find((p) => p.id === params.id);
  if (!product) notFound();

  const sortedOffers = [...product.offers]
    .filter((o) => o.availability !== 'out-of-stock')
    .sort((a, b) => a.price - b.price);

  const bestOffer = sortedOffers[0];
  const savings = bestOffer ? bestOffer.originalPrice - bestOffer.price : 0;

  const categoryEmoji: Record<string, string> = {
    smartphones: '📱', laptops: '💻', gaming: '🎮', televisions: '📺',
    audio: '🎧', cameras: '📷', wearables: '⌚', 'smart-home': '🏠', accessories: '🔌',
  };

  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-silver-600 mb-6">
          <Link href="/" className="hover:text-silver-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href={`/search?category=${product.category}`} className="hover:text-silver-400 transition-colors capitalize">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-silver-400 truncate max-w-48">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Product image + info */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl aspect-square flex items-center justify-center mb-4 border border-white/5">
              <span className="text-9xl opacity-60">
                {categoryEmoji[product.category] || '📦'}
              </span>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-white/5">
              <h1 className="font-display font-bold text-xl text-white mb-1 leading-tight">{product.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-electric-cyan font-bold uppercase">{product.brand}</span>
                <span className="text-xs text-silver-600 font-mono">Model: {product.model}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={12} className={s <= Math.round(product.rating) ? 'star-filled' : 'star-empty'} fill={s <= Math.round(product.rating) ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <span className="text-xs text-silver-400 font-mono">{product.rating} ({product.reviewCount.toLocaleString()} reviews)</span>
              </div>
              <p className="text-sm text-silver-400 leading-relaxed mb-4">{product.description}</p>
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 glass-card text-xs font-mono text-silver-600 rounded-full border border-white/5">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Offers */}
          <div className="lg:col-span-3">
            {/* Price summary */}
            {bestOffer && (
              <div className="glass-card rounded-2xl p-5 border border-electric-blue/20 mb-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-card-glow opacity-30" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-mono text-silver-600 mb-1">Best available price</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-black text-white">
                          <span className="text-sm font-mono text-electric-cyan">AED </span>
                          {bestOffer.price.toLocaleString()}
                        </span>
                        {savings > 0 && (
                          <span className="text-sm text-silver-500 line-through font-mono">
                            {bestOffer.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {savings > 0 && (
                        <p className="text-sm text-green-400 font-mono flex items-center gap-1 mt-1">
                          <TrendingDown size={12} /> Save AED {savings.toLocaleString()} ({bestOffer.discount}% off)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-silver-600 font-mono">{sortedOffers.length} offers available</p>
                      <p className="text-xs text-electric-cyan font-mono mt-1">At {bestOffer.retailer.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-mono text-silver-400">
                    <span className="flex items-center gap-1"><Check size={10} className="text-green-400" /> {bestOffer.warranty}</span>
                    <span className="flex items-center gap-1"><RotateCcw size={10} className="text-electric-cyan" /> {bestOffer.returnDays}-day returns</span>
                    <span className="flex items-center gap-1"><Truck size={10} className="text-electric-cyan" /> Delivery in {bestOffer.deliveryDays} days</span>
                  </div>
                </div>
              </div>
            )}

            {/* All offers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-display font-bold text-white">Compare All Offers</h2>
                <span className="text-xs font-mono text-silver-600">{sortedOffers.length} in stock</span>
              </div>
              {sortedOffers.map((offer, i) => (
                <div key={offer.id} className="relative">
                  <OfferRow offer={offer} rank={i} />
                </div>
              ))}
            </div>

            {/* Specs */}
            {product.specs.length > 0 && (
              <div className="mt-6 glass-card rounded-2xl p-5 border border-white/5">
                <h2 className="font-display font-bold text-sm text-white mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-electric-cyan" /> Key Specifications
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {product.specs.map((spec) => (
                    <div key={spec.name} className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-silver-600 uppercase tracking-wider">{spec.name}</span>
                      <span className="text-sm text-silver-200 font-medium">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Research CTA */}
            <Link href={`/ai-research?product=${product.id}`} className="mt-4 flex items-center gap-3 p-4 glass-card rounded-xl border border-electric-blue/20 hover:border-electric-blue/40 transition-all group">
              <div className="p-2 bg-electric-blue/10 rounded-lg">
                <Zap size={18} className="text-electric-cyan" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Get AI Research Report</p>
                <p className="text-xs text-silver-500 font-mono">Should you buy now or wait? Full analysis in 10 seconds.</p>
              </div>
              <ArrowLeft size={14} className="text-electric-cyan rotate-180 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export function generateStaticParams() {
  return featuredProducts.map((p) => ({ id: p.id }));
}
