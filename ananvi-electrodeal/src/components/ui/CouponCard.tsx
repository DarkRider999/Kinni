'use client';

import { useState } from 'react';
import { Copy, Check, Clock, Tag, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import type { Coupon } from '@/lib/types';

interface CouponCardProps {
  coupon: Coupon;
}

const statusConfig = {
  verified: { label: 'Verified', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30', icon: Shield },
  'recently-verified': { label: 'Recently Verified', color: 'text-electric-cyan', bg: 'bg-electric-cyan/10', border: 'border-electric-cyan/30', icon: Check },
  unverified: { label: 'Unverified', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', icon: AlertTriangle },
  expired: { label: 'Expired', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', icon: Clock },
  failed: { label: 'Not Working', color: 'text-silver-600', bg: 'bg-silver-600/10', border: 'border-silver-600/30', icon: AlertTriangle },
};

function daysUntilExpiry(date: Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function CouponCard({ coupon }: CouponCardProps) {
  const [copied, setCopied] = useState(false);
  const status = statusConfig[coupon.status];
  const StatusIcon = status.icon;
  const daysLeft = daysUntilExpiry(coupon.expiryDate);
  const isExpiring = daysLeft <= 3 && daysLeft > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden border transition-all duration-300 ${
        coupon.status === 'expired' || coupon.status === 'failed'
          ? 'border-white/5 opacity-60'
          : 'border-white/10 hover:border-electric-blue/30 hover:shadow-glass'
      }`}
    >
      {/* Top stripe */}
      <div
        className={`h-1 w-full ${
          coupon.status === 'verified' ? 'bg-gradient-to-r from-green-400 to-electric-cyan'
          : coupon.status === 'recently-verified' ? 'bg-electric-gradient'
          : 'bg-silver-600/30'
        }`}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-silver-400 uppercase tracking-widest">
                {coupon.retailer.name}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border ${status.color} ${status.bg} ${status.border}`}
              >
                <StatusIcon size={10} />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-silver-200">{coupon.terms}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-display font-black text-white">
              {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `AED ${coupon.discount}`}
            </div>
            <div className="text-xs text-silver-600 font-mono">OFF</div>
          </div>
        </div>

        {/* Coupon code */}
        <div
          className={`flex items-center gap-3 p-3 rounded-xl border border-dashed mb-4 ${
            coupon.status === 'verified' || coupon.status === 'recently-verified'
              ? 'border-electric-blue/40 bg-electric-blue/5'
              : 'border-white/10 bg-white/3'
          }`}
        >
          <div className="flex items-center gap-2 flex-1">
            <Tag size={14} className="text-electric-cyan shrink-0" />
            <span className="font-mono font-bold text-lg tracking-widest text-white">
              {coupon.code}
            </span>
          </div>
          <button
            onClick={handleCopy}
            disabled={coupon.status === 'expired' || coupon.status === 'failed'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              copied
                ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                : coupon.status === 'expired' || coupon.status === 'failed'
                ? 'bg-white/5 text-silver-600 cursor-not-allowed'
                : 'bg-electric-gradient text-white hover:opacity-90 shadow-electric'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-3 text-xs font-mono text-silver-600">
          {coupon.minimumPurchase > 0 && (
            <span className="flex items-center gap-1">
              Min: AED {coupon.minimumPurchase.toLocaleString()}
            </span>
          )}
          <span className={`flex items-center gap-1 ${isExpiring ? 'text-orange-400 font-semibold' : ''}`}>
            <Clock size={10} />
            {daysLeft > 0
              ? isExpiring
                ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} ⚠️`
                : `Expires ${new Date(coupon.expiryDate).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}`
              : 'Expired'}
          </span>
          {coupon.eligibleCategories.length > 0 && (
            <span>For: {coupon.eligibleCategories.join(', ')}</span>
          )}
        </div>

        {/* Success rate */}
        {(coupon.status === 'verified' || coupon.status === 'recently-verified') && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-silver-600 flex items-center gap-1">
                <TrendingUp size={10} />
                Success Rate
              </span>
              <span className="text-xs font-mono font-bold text-green-400">
                {Math.round(coupon.successRate * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-electric-blue to-electric-cyan rounded-full transition-all duration-1000"
                style={{ width: `${coupon.successRate * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
