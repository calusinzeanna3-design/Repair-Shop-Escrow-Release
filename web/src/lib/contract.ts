import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, CONTRACT_ID } from './stellar';

const READ_SOURCE = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const JOB_STATUS = {
  Created: 0,
  Funded: 1,
  Completed: 2,
  Released: 3,
  Disputed: 4,
  Refunded: 5,
} as const;

export interface RepairJob {
  id: number;
  customer: string;
  technician: string;
  token: string;
  amount: number;
  status: number;
  metadataUri: string;
  createdAt: number;
  completedAt: number;
}

export function contractConfigured(): boolean {
  return Boolean(CONTRACT_ID);
}

function addressScVal(publicKey: string) {
  return new Address(publicKey).toScVal();
}

function i128ScVal(value: number) {
  return nativeToScVal(BigInt(Math.trunc(value)), { type: 'i128' });
}

function u32ScVal(value: number) {
  return nativeToScVal(value, { type: 'u32' });
}

function stringScVal(value: string) {
  return nativeToScVal(value, { type: 'string' });
}

async function buildContractCallXDR(
  sender: string,
  method: string,
  ...args: ReturnType<typeof nativeToScVal>[]
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed; ${method} would not succeed.`);
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

function normalizeJob(raw: Record<string, unknown>): RepairJob {
  return {
    id: Number(raw.id),
    customer: String(raw.customer),
    technician: String(raw.technician),
    token: String(raw.token),
    amount: Number(raw.amount),
    status: Number(raw.status),
    metadataUri: String(raw.metadata_uri ?? raw.metadataUri ?? ''),
    createdAt: Number(raw.created_at ?? raw.createdAt ?? 0),
    completedAt: Number(raw.completed_at ?? raw.completedAt ?? 0),
  };
}

export async function readRepairJob(jobId: number): Promise<RepairJob> {
  const contract = new Contract(CONTRACT_ID);
  const source = new Account(READ_SOURCE, '0');

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_job', u32ScVal(jobId)))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error('Could not read job. Check the contract ID and job number.');
  }

  return normalizeJob(scValToNative(sim.result.retval) as Record<string, unknown>);
}

export async function buildCreateJobXDR(input: {
  sender: string;
  customer: string;
  technician: string;
  token: string;
  amount: number;
  metadataUri: string;
}): Promise<string> {
  return buildContractCallXDR(
    input.sender,
    'create_job',
    addressScVal(input.customer),
    addressScVal(input.technician),
    addressScVal(input.token),
    i128ScVal(input.amount),
    stringScVal(input.metadataUri),
  );
}

export async function buildFundJobXDR(sender: string, jobId: number): Promise<string> {
  return buildContractCallXDR(sender, 'fund_job', u32ScVal(jobId));
}

export async function buildMarkCompleteXDR(
  sender: string,
  jobId: number,
): Promise<string> {
  return buildContractCallXDR(sender, 'mark_complete', u32ScVal(jobId));
}

export async function buildApproveReleaseXDR(
  sender: string,
  jobId: number,
): Promise<string> {
  return buildContractCallXDR(sender, 'approve_release', u32ScVal(jobId));
}

export async function buildOpenDisputeXDR(
  sender: string,
  jobId: number,
): Promise<string> {
  return buildContractCallXDR(sender, 'open_dispute', u32ScVal(jobId));
}

export async function buildRefundXDR(sender: string, jobId: number): Promise<string> {
  return buildContractCallXDR(sender, 'refund', u32ScVal(jobId));
}
