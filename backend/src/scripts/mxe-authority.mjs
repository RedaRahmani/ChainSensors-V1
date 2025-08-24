import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getMXEAccAddress } from '@arcium-hq/client';
import idl from '../solana/idl.json' with { type: 'json' };

const rpc = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const conn = new anchor.web3.Connection(rpc, 'confirmed');

const programId = new PublicKey(process.env.SOLANA_PROGRAM_ID || idl.address);
const mxePda = getMXEAccAddress(programId);

const ai = await conn.getAccountInfo(mxePda);
if (!ai) {
  console.error('❌ MXE account not found at', mxePda.toBase58());
  process.exit(1);
}

const data = Buffer.from(ai.data);
const disc = data.subarray(0, 8).toString('hex');
const tag = data[8]; // Option<Pubkey>: 0=None, 1=Some
let authority = null;
if (tag === 1) {
  authority = new PublicKey(data.subarray(9, 41));
}

console.log('MXE PDA        :', mxePda.toBase58());
console.log('Authority tag  :', tag === 1 ? 'Some' : 'None');
if (authority) console.log('Authority pubkey:', authority.toBase58());
