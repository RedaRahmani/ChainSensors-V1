
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


import * as dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


import * as anchor from '@coral-xyz/anchor';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import idl from '../solana/idl.json' with { type: 'json' };
import {
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getArciumProgAddress,
} from '@arcium-hq/client';


function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const rpc = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const keypairJson = req('SOLANA_KEYPAIR_JSON');


let secret;
try {
  secret = JSON.parse(keypairJson);
  if (!Array.isArray(secret)) throw new Error('not an array');
} catch (e) {
  throw new Error(`SOLANA_KEYPAIR_JSON is not valid JSON (array of numbers): ${e.message}`);
}

const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
const wallet = new anchor.Wallet(keypair);
const connection = new anchor.web3.Connection(rpc, 'confirmed');
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
anchor.setProvider(provider);


const programId = new PublicKey(process.env.SOLANA_PROGRAM_ID || idl.address);
const program = new anchor.Program(idl, provider);

const compName = process.env.ARCIUM_RESEAL_COMP_NAME || 'reseal_dek';
const offsetBytes = getCompDefAccOffset(compName);
const compDefIdx = Buffer.from(offsetBytes).readUInt32LE();

const mxeAccount = getMXEAccAddress(programId);
const arciumProgram = getArciumProgAddress();

// 👇 prefer explicit PDA from env if provided
const overridePda = process.env.ARCIUM_COMP_DEF_PDA;
const compDefAccount = overridePda
  ? new PublicKey(overridePda)
  : getCompDefAccAddress(programId, compDefIdx);

console.log('Program ID     :', programId.toBase58());
console.log('MXE account    :', mxeAccount.toBase58());
console.log('CompDef account:', compDefAccount.toBase58(),
            overridePda ? '(from ARCIUM_COMP_DEF_PDA)' : '(derived)');
console.log('Comp name      :', compName, `(index ${compDefIdx})`);

const sig = await program.methods
  .initResealDekCompDef()
  .accounts({
    payer: wallet.publicKey,
    mxeAccount,
    compDefAccount,      // ← must match what Arcium expects
    arciumProgram,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
console.log('init_reseal_dek_comp_def tx:', sig);