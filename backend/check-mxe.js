// save as check-mxe.js
import * as anchor from '@coral-xyz/anchor';
import { getMXEPublicKey, getMXEAccAddress } from '@arcium-hq/client';

const PROGRAM_ID = process.argv[2]; // e.g. DWbGQjpG3aAciCfu...
const rpc = process.env.SOLANA_RPC || anchor.web3.clusterApiUrl('devnet');

(async () => {
  const kp = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.SOLANA_KEYPAIR_JSON))
  );
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(rpc, 'confirmed'),
    new anchor.Wallet(kp),
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);

  const pid = new anchor.web3.PublicKey(PROGRAM_ID);
  const mxePda = getMXEAccAddress(pid);
  console.log('MXEAccount PDA =', mxePda.toBase58());

  const pub = await getMXEPublicKey(provider, pid);
  console.log('On-chain MXE pubkey (base64) =', Buffer.from(pub).toString('base64'));
})();
