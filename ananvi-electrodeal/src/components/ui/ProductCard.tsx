'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, ExternalLink, TrendingDown, Shield, Star, Zap } from 'lucide-react';
import type { Product, ProductOffer } from '@/lib/types';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact' | 'featured';
}

const conditionLabels: Record<string, { label: string; className: string }> = {
  'brand-new-sealed': { label: 'Brand New', className: 'condition-brand-new' },
  'open-box': { label: 'Open Box', className: 'condition-open-box' },
  'certified-refurbished': { label: 'Certified Refurb', className: 'condition-certified-refurb' },
  'professionally-refurbished': { label: 'Pro Refurb', className: 'condition-refurb' },
  'pre-owned-excellent': { label: 'Pre-Owned A+', className: 'condition-preowned' },
  'pre-owned-good': { label: 'Pre-Owned B', className: 'condition-preowned' },
  'pre-owned-fair': { label: 'Pre-Owned C', className: 'condition-preowned' },
  'unverified': { label: 'Unverified', className: 'condition-unverified' },
};

function getBestOffer(offers: ProductOffer[]): ProductOffer | null {
  const inStock = offers.filter((o) => o.availability !== 'out-of-stock');
  if (!inStock.length) return null;
  return inStock.reduce((best, o) => (o.price < best.price ? o : best));
}

export default function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const bestOffer = getBestOffer(product.offers);
  const inStockOffers = product.offers.filter((o) => o.availability !== 'out-of-stock');
  const condition = bestOffer ? conditionLabels[bestOffer.condition] : null;
  const savings = bestOffer ? bestOffer.originalPrice - bestOffer.price : 0;

  return (
    <div className="group relative glass-card rounded-2xl overflow-hidden border border-white/8 hover:border-electric-blue/30 transition-all duration-300 hover:shadow-electric hover:-translate-y-1">
      {/* Wishlist button */}
      <button
        onClick={() => setWishlisted(!wishlisted)}
        className="absolute top-3 right-3 z-10 p-2 rounded-full glass-card border border-white/10 hover:border-electric-blue/40 transition-all"
      >
        <Heart
          size={14}
          className={wishlisted ? 'fill-red-400 text-red-400' : 'text-silver-400'}
        />
      </button>

      {/* Discount badge */}
      {bestOffer && bestOffer.discount > 0 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 bg-electric-gradient rounded-full text-xs font-bold text-white shadow-electric">
          <TrendingDown size={10} />
          {bestOffer.discount}% OFF
        </div>
      )}

      {/* Product image */}
      <div className="relative aspect-square bg-gradient-to-br from-navy-800 to-navy-700 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-7xl opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500 select-none">
            {product.category === 'smartphones' ? '📱'
              : product.category === 'laptops' ? '💻'
              : product.category === 'gaming' ? '🎮'
              : product.category === 'televisions' ? '📺'
              : product.category === 'audio' ? '🎧'
              : product.category === 'wearables' ? '⌚'
              : '📦'}
          </span>
        </div>
        {/* Glow effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-card-glow" />
      </div>

      {/* Product info */}
      <div className="p-4">
        {/* Brand + condition */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold text-electric-cyan uppercase tracking-widest">
            {product.brand}
          </span>
          {condition && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-full border ${condition.className}`}
            >
              {condition.label}
            </span>
          )}
        </div>

        {/* Product name */}
        <h3 className="text-sm font-semibold text-silver-100 leading-snug mb-1 line-clamp-2">
          {product.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex">
            {[1,2,3,4,5].map((s) => (
              <Star
                key={s}
                size={10}
                className={s <= Math.round(product.rating) ? 'star-filled' : 'star-empty'}
                fill={s <= Math.round(product.rating) ? 'currentColor' : 'none'}
              />
            ))}
          </div>
          <span className="text-xs text-silver-600 font-mono">
            {product.rating.toFixed(1)} ({product.reviewCount.toLocaleString()})
          </span>
        </div>

        {/* Price */}
        {bestOffer ? (
          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-black text-white">
                <span className="text-sm font-mono text-electric-cyan mr-1">AED</span>
                {bestOffer.price.toLocaleString()}
              </span>
              {savings > 0 && (
                <span className="text-sm text-silver-600 line-through font-mono">
                  {bestOffer.originalPrice.toLocaleString()}
                </span>
              )}
            </div>
            {savings > 0 && (
              <p className="text-xs text-green-400 font-mono mt-0.5 flex items-center gap-1">
                <TrendingDown size={10} />
                Save AED {savings.toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <span className="text-sm text-silver-600 font-mono">Out of Stock</span>
          </div>
        )}

        {/* Offers count + best retailer */}
        {bestOffer && (
          <div className="flex items-center gap-2 mb-4 text-xs text-silver-600 font-mono">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-electric-cyan" />
              {inStockOffers.length} offer{inStockOffers.length !== 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>Best: {bestOffer.retailer.name}</span>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex gap-2">
          <Link
            href={`/product/${product.id}`}
            className="flex-1 py-2 text-xs font-semibold text-center bg-electric-gradient rounded-lg text-white hover:opacity-90 transition-opacity shadow-electric"
          >
            Compare Prices
          </Link>
          {bestOffer && (
            <a
              href={bestOffer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 glass-card rounded-lg border border-white/10 hover:border-electric-blue/40 text-silver-400 hover:text-white transition-all"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Verified badge */}
        {bestOffer?.retailer.verified && (
          <div className="flex items-center gap-1 mt-2 text-xs text-silver-600 font-mono">
            <Shield size={10} className="text-green-400" />
            Verified retailer · {bestOffer.warranty} warranty
          </div>
        )}
      </div>
    </div>
  );
}
