// tools/fetchMxePubkey.ts
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getArciumProgramReadonly, getMXEAccAddresses, getMXEAccInfo } from '@arcium-hq/reader';

async function main() {
  const rpc = 'https://api.devnet.solana.com';
  const conn = new Connection(rpc, 'confirmed');

  // A simple read-only provider (no tx signing needed)
  const dummy = anchor.web3.Keypair.generate();
  const wallet = new anchor.Wallet(dummy);
  const provider = new anchor.AnchorProvider(conn, wallet, {});
  const arciumProgram = await getArciumProgramReadonly(provider);

  // Discover MXE accounts available on this cluster
  const mxeAddresses = await getMXEAccAddresses(conn);
  if (mxeAddresses.length === 0) {
    throw new Error(
      `No Arcium MXE accounts found on ${rpc}. You’re likely pointed at the wrong cluster or your MXE wasn’t provisioned yet.`
    );
  }

  // If your MXE Program ID is known, you can optionally filter here;
  // otherwise just use the first MXE account for the cluster:
  // (You can iterate and print them to choose the correct one.)
  const mxeInfo = await getMXEAccInfo(arciumProgram, mxeAddresses[0]);

  // mxeInfo.x25519Pubkey is a union { set: Uint8Array } | { unset: {} }
  // Reader docs show checking `'set' in mxeInfo.x25519Pubkey`
  if (!('set' in mxeInfo.x25519Pubkey)) {
    throw new Error('MXE x25519 public key is unset for this MXE account.');
  }

  // Handle the case where set might be an array-like object with numeric properties
  const setData = mxeInfo.x25519Pubkey.set as any;
  let pubkeyBytes: number[];
  
  if (Array.isArray(setData)) {
    pubkeyBytes = setData;
  } else if (setData && typeof setData === 'object' && '0' in setData) {
    // Convert object with numeric keys to array
    pubkeyBytes = Object.values(setData).flat() as number[];
  } else {
    pubkeyBytes = Array.from(setData as Uint8Array);
  }
  
  const b64 = Buffer.from(pubkeyBytes).toString('base64');
  console.log('MXE_X25519_PUBKEY_BASE64=', b64);
}

main().catch((e) => {
  console.error('Failed to fetch MXE pubkey:', e.message || e);
  process.exit(1);
});
