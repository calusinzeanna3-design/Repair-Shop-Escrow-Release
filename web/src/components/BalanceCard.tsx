'use client';
import { useState, useEffect } from 'react';
import { fetchBalances, type Balances } from '@/lib/balances';

export default function BalanceCard({
  publicKey,
  refreshKey,
}: {
  publicKey: string;
  refreshKey: number;
}) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBalances(publicKey)
      .then((b) => active && setBalances(b))
      .catch(() => active && setBalances(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [publicKey, refreshKey]);

  if (loading) {
    return (
      <div className="mt-4 grid animate-pulse grid-cols-2 gap-4">
        <div className="h-20 rounded bg-gray-200" />
        <div className="h-20 rounded bg-gray-200" />
      </div>
    );
  }

  if (balances && !balances.funded) {
    return (
      <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        This account isn’t funded yet. Click “Fund with Friendbot” above.
      </p>
    );
  }

  if (!balances) {
    return <p className="mt-4 text-sm text-red-500">Failed to load balances.</p>;
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div className="rounded border border-gray-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">XLM</p>
        <p className="text-2xl font-bold text-gray-900">{balances.xlm}</p>
      </div>
      <div className="rounded border border-gray-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">USDC</p>
        <p className="text-2xl font-bold text-gray-900">{balances.usdc}</p>
      </div>
    </div>
  );
}
