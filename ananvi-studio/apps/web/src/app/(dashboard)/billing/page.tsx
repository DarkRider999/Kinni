'use client';

import { useState } from 'react';
import { useCredits, useTransactions, usePackages, useCheckout } from '@/hooks/useCredits';

interface Package {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_popular?: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function BillingPage() {
  const [txPage, setTxPage] = useState(1);
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: txData } = useTransactions(txPage);
  const { data: packages } = usePackages();
  const checkout = useCheckout();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const transactions: Transaction[] = txData?.data ?? [];

  const handleCheckout = async (pkgId: string) => {
    setCheckoutLoading(pkgId);
    try {
      const result = await checkout.mutateAsync(pkgId);
      if (result.url) window.location.href = result.url;
    } catch (err: any) {
      alert(err.response?.data?.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Credits</h1>
        <p className="text-gray-400 mt-1">Manage your credit balance</p>
      </div>

      {/* Balance card */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
        <p className="text-sm text-gray-400">Current Balance</p>
        {creditsLoading ? (
          <div className="h-12 w-32 bg-[#1a1a1a] rounded animate-pulse mt-2" />
        ) : (
          <p className="text-5xl font-bold text-[#f5c518] mt-2">
            {credits?.balance ?? 0}
            <span className="text-xl text-gray-400 ml-2 font-normal">credits</span>
          </p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          1 credit = 1 clip generated
        </p>
      </div>

      {/* Packages */}
      {packages && packages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Top Up Credits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg: Package) => (
              <div
                key={pkg.id}
                className={`bg-[#111] border rounded-xl p-5 relative transition hover:border-[#f5c518]/50
                  ${pkg.is_popular ? 'border-[#f5c518]' : 'border-[#2a2a2a]'}`}
              >
                {pkg.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f5c518] text-black
                                   text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-white font-semibold">{pkg.name}</h3>
                <p className="text-3xl font-bold text-[#f5c518] mt-2">{pkg.credits.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">credits</p>
                <p className="text-xl font-semibold text-white mt-3">{formatCents(pkg.price_cents)}</p>
                <button
                  onClick={() => handleCheckout(pkg.id)}
                  disabled={checkoutLoading === pkg.id}
                  className="mt-4 w-full py-2.5 bg-[#f5c518] text-black font-semibold rounded-lg
                             hover:bg-[#d4a800] disabled:opacity-50 transition text-sm"
                >
                  {checkoutLoading === pkg.id ? 'Redirecting…' : 'Buy Now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8 text-center text-gray-500">
            No transactions yet
          </div>
        ) : (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Description</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Type</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Credits</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-[#1a1a1a] transition">
                    <td className="px-5 py-3 text-gray-300">{tx.description}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        tx.type === 'credit' || tx.type === 'refund' || tx.type === 'purchase'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-right font-mono font-medium ${
                      tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {txData?.total > 10 && (
              <div className="p-4 border-t border-[#2a2a2a] flex justify-between items-center">
                <button
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                  className="text-sm text-gray-400 hover:text-white disabled:opacity-40 transition"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">Page {txPage}</span>
                <button
                  onClick={() => setTxPage(p => p + 1)}
                  disabled={transactions.length < 10}
                  className="text-sm text-gray-400 hover:text-white disabled:opacity-40 transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
