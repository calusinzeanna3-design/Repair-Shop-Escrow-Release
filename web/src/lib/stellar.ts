import { rpc, Networks, Asset } from '@stellar/stellar-sdk';

// Network passphrase comes from the SDK constant, NOT a hardcoded string —
// a wrong passphrase shows up as a misleading `tx_bad_auth` error.
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
export const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER ?? '';
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';

// v15 SDK: use the `rpc` namespace (the old `SorobanRpc` namespace is gone).
export const server = new rpc.Server(RPC_URL);

export const XLM = Asset.native();
export const USDC = USDC_ISSUER ? new Asset('USDC', USDC_ISSUER) : null;

/** Fund a testnet account via Friendbot (~10,000 XLM). */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  // 400 usually means "account already funded" — not a real failure for our flow.
  if (!res.ok && res.status !== 400) {
    throw new Error('Friendbot funding failed. Try again in a moment.');
  }
}
