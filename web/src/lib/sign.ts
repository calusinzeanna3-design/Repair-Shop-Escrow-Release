import { NETWORK_PASSPHRASE } from './stellar';
import { submitSignedXDR, pollTransaction } from './payment';

/**
 * Sign an unsigned XDR with Freighter, submit it, and poll to finality.
 * Returns the transaction hash. Use for simple "one-shot" actions
 * (trustlines, contract calls) that don't need granular status UI.
 */
export async function signAndSubmit(xdr: string, address: string): Promise<string> {
  // Dynamic import only — static import of freighter-api breaks SSR.
  const freighter = await import('@stellar/freighter-api');
  const signed = await freighter.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  if (signed.error) {
    throw new Error(
      typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
    );
  }
  const hash = await submitSignedXDR(signed.signedTxXdr);
  await pollTransaction(hash);
  return hash;
}
