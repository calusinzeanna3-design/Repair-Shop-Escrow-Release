'use client';
import { useState } from 'react';
import {
  buildPaymentXDR,
  submitSignedXDR,
  pollTransaction,
  type AssetCode,
} from '@/lib/payment';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

type Status =
  | 'idle'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'error';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Send',
  building: 'Building transaction…',
  signing: 'Waiting for Freighter…',
  submitting: 'Submitting…',
  polling: 'Confirming on-chain…',
  success: 'Send',
  error: 'Send',
};

export default function SendPayment({
  publicKey,
  onSent,
}: {
  publicKey: string;
  onSent: () => void;
}) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<AssetCode>('XLM');
  const [status, setStatus] = useState<Status>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const busy = ['building', 'signing', 'submitting', 'polling'].includes(status);

  const handleSend = async () => {
    setStatus('building');
    setErrorMsg('');
    setTxHash('');
    try {
      const xdr = await buildPaymentXDR(publicKey, destination.trim(), amount, asset);

      setStatus('signing');
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

      setStatus('submitting');
      const hash = await submitSignedXDR(signed.signedTxXdr);
      setTxHash(hash);

      setStatus('polling');
      await pollTransaction(hash);
      setStatus('success');
      onSent();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Payment failed');
      setStatus('error');
    }
  };

  return (
    <div className="mt-6 rounded border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Send Payment</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as AssetCode)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
          >
            <option value="XLM">XLM</option>
            <option value="USDC">USDC (needs a trustline)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">
            Destination address
          </label>
          <input
            type="text"
            placeholder="G… (must be an existing funded testnet account)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Amount</label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={busy || !destination || !amount}
          className="w-full rounded bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {STATUS_LABEL[status]}
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3">
          <p className="font-medium text-emerald-700">Payment confirmed!</p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-indigo-600 hover:underline"
          >
            View on Stellar Expert →
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
