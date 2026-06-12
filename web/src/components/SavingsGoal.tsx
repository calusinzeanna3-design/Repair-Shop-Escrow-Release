'use client';
import { useState } from 'react';
import {
  JOB_STATUS,
  buildApproveReleaseXDR,
  buildCreateJobXDR,
  buildFundJobXDR,
  buildMarkCompleteXDR,
  buildOpenDisputeXDR,
  buildRefundXDR,
  contractConfigured,
  readRepairJob,
  type RepairJob,
} from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';

const STATUS_LABELS: Record<number, string> = {
  [JOB_STATUS.Created]: 'Created',
  [JOB_STATUS.Funded]: 'Funded',
  [JOB_STATUS.Completed]: 'Completed',
  [JOB_STATUS.Released]: 'Released',
  [JOB_STATUS.Disputed]: 'Disputed',
  [JOB_STATUS.Refunded]: 'Refunded',
};

export default function SavingsGoal({ publicKey }: { publicKey: string | null }) {
  const configured = contractConfigured();
  const [technician, setTechnician] = useState('');
  const [token, setToken] = useState('');
  const [amount, setAmount] = useState('');
  const [metadataUri, setMetadataUri] = useState('quote://repair-001');
  const [jobId, setJobId] = useState('1');
  const [job, setJob] = useState<RepairJob | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const runSigned = async (label: string, build: () => Promise<string>) => {
    if (!publicKey) return;
    setBusy(label);
    setMsg('');
    setError('');
    try {
      const xdr = await build();
      await signAndSubmit(xdr, publicKey);
      setMsg(`${label} confirmed on-chain.`);
      if (jobId) {
        await loadJob(Number(jobId));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy('');
    }
  };

  const loadJob = async (id = Number(jobId)) => {
    setBusy('Reading job');
    setMsg('');
    setError('');
    try {
      const nextJob = await readRepairJob(id);
      setJob(nextJob);
      setJobId(String(nextJob.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load job');
    } finally {
      setBusy('');
    }
  };

  const createJob = async () => {
    if (!publicKey) return;
    await runSigned('Create job', () =>
      buildCreateJobXDR({
        sender: publicKey,
        customer: publicKey,
        technician,
        token,
        amount: Number(amount),
        metadataUri,
      }),
    );
  };

  if (!configured) {
    return (
      <div className="mt-6 rounded border border-dashed border-gray-300 bg-gray-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Repair Escrow Contract</h2>
        <p className="mt-2 text-sm text-gray-600">
          No contract deployed yet. Deploy the Rust contract and set{' '}
          <code>NEXT_PUBLIC_CONTRACT_ID</code> to enable escrow actions.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
          .\scripts\deploy.ps1
        </pre>
      </div>
    );
  }

  const canAct = Boolean(publicKey) && !busy;

  return (
    <div className="mt-6 rounded border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Repair Escrow</h2>
      <p className="mt-1 text-sm text-gray-500">
        Create a quoted repair job, fund escrow, mark it complete, then approve
        release or open a dispute.
      </p>

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Create quoted job</h3>
        <input
          placeholder="Technician public key"
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          placeholder="Token contract address"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Quoted amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            placeholder="Metadata URI"
            value={metadataUri}
            onChange={(e) => setMetadataUri(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <button
          onClick={createJob}
          disabled={!canAct || !technician || !token || !amount}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === 'Create job' ? 'Creating...' : 'Create job'}
        </button>
      </div>

      <div className="mt-6 space-y-3 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-800">Manage job</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Job ID"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <button
            onClick={() => loadJob()}
            disabled={!jobId || Boolean(busy)}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Load
          </button>
        </div>

        {job && (
          <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
            <div className="flex justify-between gap-3">
              <span>Job #{job.id}</span>
              <span className="font-medium">{STATUS_LABELS[job.status] ?? job.status}</span>
            </div>
            <p className="mt-1">Amount: {job.amount}</p>
            <p className="truncate">Technician: {job.technician}</p>
            <p className="truncate">Token: {job.token}</p>
            <p className="truncate">Metadata: {job.metadataUri}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => runSigned('Fund job', () => buildFundJobXDR(publicKey!, Number(jobId)))}
            disabled={!canAct || !jobId}
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Fund job
          </button>
          <button
            onClick={() =>
              runSigned('Mark complete', () => buildMarkCompleteXDR(publicKey!, Number(jobId)))
            }
            disabled={!canAct || !jobId}
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Mark complete
          </button>
          <button
            onClick={() =>
              runSigned('Approve release', () => buildApproveReleaseXDR(publicKey!, Number(jobId)))
            }
            disabled={!canAct || !jobId}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Approve release
          </button>
          <button
            onClick={() =>
              runSigned('Open dispute', () => buildOpenDisputeXDR(publicKey!, Number(jobId)))
            }
            disabled={!canAct || !jobId}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Open dispute
          </button>
          <button
            onClick={() => runSigned('Refund', () => buildRefundXDR(publicKey!, Number(jobId)))}
            disabled={!canAct || !jobId}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Admin refund
          </button>
        </div>
      </div>

      {!publicKey && (
        <p className="mt-3 text-xs text-gray-500">
          Connect Freighter to sign escrow transactions.
        </p>
      )}
      {busy && <p className="mt-3 text-sm text-gray-500">{busy}...</p>}
      {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
