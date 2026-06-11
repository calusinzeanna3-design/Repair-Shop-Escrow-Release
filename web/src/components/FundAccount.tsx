'use client';
import { useState } from 'react';
import { fundTestnetAccount } from '@/lib/stellar';

export default function FundAccount({
  publicKey,
  onFunded,
}: {
  publicKey: string;
  onFunded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fund = async () => {
    setLoading(true);
    setError('');
    try {
      await fundTestnetAccount(publicKey);
      onFunded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Funding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={fund}
        disabled={loading}
        className="rounded bg-amber-400 px-3 py-1.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? 'Funding…' : 'Fund with Friendbot (testnet)'}
      </button>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
