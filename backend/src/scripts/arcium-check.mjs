import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../solana/idl.json' with { type: 'json' };
import {
  getMXEPublicKey,
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
} from '@arcium-hq/client';

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const rpc = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const keypairJson = req('SOLANA_KEYPAIR_JSON');
const secret = Uint8Array.from(JSON.parse(keypairJson));
const kp = anchor.web3.Keypair.fromSecretKey(secret);
const provider = new anchor.AnchorProvider(
  new anchor.web3.Connection(rpc, 'confirmed'),
  new anchor.Wallet(kp),
  { commitment: 'confirmed' }
);
anchor.setProvider(provider);

const appProgramId = new PublicKey(process.env.SOLANA_PROGRAM_ID || idl.address);

const mxePk = await getMXEPublicKey(provider, appProgramId);
console.log('MXE X25519 pubkey (b64):', Buffer.from(mxePk).toString('base64'));

const compName = process.env.ARCIUM_RESEAL_COMP_NAME || 'reseal_dek';
const idx = Buffer.from(getCompDefAccOffset(compName)).readUInt32LE();
const compDef = getCompDefAccAddress(appProgramId, idx);
const info = await provider.connection.getAccountInfo(compDef, 'confirmed');

console.log('CompDef PDA:', compDef.toBase58());
console.log('CompDef exists?', !!(info && info.data && info.data.length > 0));
