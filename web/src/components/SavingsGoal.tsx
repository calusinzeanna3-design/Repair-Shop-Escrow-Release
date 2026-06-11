'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  contractConfigured,
  readSavingsState,
  buildContributeXDR,
  type SavingsState,
} from '@/lib/contract';
import { submitSignedXDR, pollTransaction } from '@/lib/payment';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

export default function SavingsGoal({ publicKey }: { publicKey: string | null }) {
  const configured = contractConfigured();
  const [state, setState] = useState<SavingsState | null>(null);
  const [loading, setLoading] = useState(configured);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError('');
    try {
      setState(await readSavingsState());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to read contract');
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const contribute = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const xdr = await buildContributeXDR(publicKey, Number(amount));
      const freighter = await import('@stellar/freighter-api');
      const signed = await freighter.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      });
      if (signed.error) {
        throw new Error(
          typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
        );
      }
      const hash = await submitSignedXDR(signed.signedTxXdr);
      await pollTransaction(hash);
      setMsg('Contribution recorded on-chain!');
      setAmount('');
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Contribution failed');
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="mt-6 rounded border border-dashed border-gray-300 bg-gray-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Savings Goal (Soroban)</h2>
        <p className="mt-2 text-sm text-gray-600">
          No contract deployed yet. Deploy the Rust contract and set its ID to
          enable this panel:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
          .\scripts\deploy.ps1
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          The script writes <code>NEXT_PUBLIC_CONTRACT_ID</code> into{' '}
          <code>web/.env.local</code>; restart <code>npm run dev</code> afterward.
        </p>
      </div>
    );
  }

  const pct =
    state && state.target > 0
      ? Math.min(100, Math.round((state.saved / state.target) * 100))
      : 0;

  return (
    <div className="mt-6 rounded border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Savings Goal (Soroban)
      </h2>

      {loading && <p className="text-sm text-gray-400">Reading contract state…</p>}

      {!loading && state && (
        <>
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Saved: {state.saved}</span>
            <span>Target: {state.target}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-gray-500">{pct}%</p>

          <div className="mt-4 flex gap-2">
            <input
              type="number"
              placeholder="Amount to contribute"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-gray-900"
            />
            <button
              onClick={contribute}
              disabled={busy || !publicKey || !amount}
              className="rounded bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Contribute'}
            </button>
          </div>
          {!publicKey && (
            <p className="mt-2 text-xs text-gray-500">
              Connect your wallet to contribute (it signs the Soroban transaction).
            </p>
          )}
        </>
      )}

      {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
