import {
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, USDC_ISSUER } from './stellar';

export type AssetCode = 'XLM' | 'USDC';

/** Build an unsigned classic payment transaction and return its XDR. */
export async function buildPaymentXDR(
  sender: string,
  destination: string,
  amount: string,
  assetCode: AssetCode,
): Promise<string> {
  const asset =
    assetCode === 'XLM' ? Asset.native() : new Asset('USDC', USDC_ISSUER);

  // Always load the account fresh so we have the current sequence number.
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({ destination, asset, amount }))
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

/** Submit a Freighter-signed XDR. Returns the transaction hash. */
export async function submitSignedXDR(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const res = await server.sendTransaction(tx);
  if (res.status === 'ERROR') {
    throw new Error(`Submit rejected: ${JSON.stringify(res.errorResult ?? res)}`);
  }
  return res.hash;
}

/**
 * Poll until the transaction reaches finality.
 * `sendTransaction` returning PENDING is NOT success — you must poll.
 */
export async function pollTransaction(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await server.getTransaction(hash);
    if (res.status !== 'NOT_FOUND') {
      if (res.status === 'SUCCESS') return;
      throw new Error(`Transaction ${res.status}`);
    }
  }
  throw new Error('Transaction timed out after 60s');
}
