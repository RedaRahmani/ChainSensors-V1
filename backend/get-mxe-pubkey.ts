// get-mxe-pubkey.ts
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as client from '@arcium-hq/client';

(async () => {
  const rpc = 'https://devnet.helius-rpc.com/?api-key=718fc0bb-1714-477b-b2fe-23472a4727c5';
  const keypair = anchor.web3.Keypair.generate(); // read-only provider is fine
  const wallet = new anchor.Wallet(keypair);
  const conn = new anchor.web3.Connection(rpc, 'confirmed');
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: 'confirmed' });

  const programId = new PublicKey(process.env.ARCIUM_MXE_PROGRAM_ID!); // same one in your env
  const pub = await (client as any).getMXEPublicKey(provider as any, programId);
  const b64 = Buffer.from(pub).toString('base64');
  console.log('MXE_X25519_PUBKEY_B64=', b64);
})();
