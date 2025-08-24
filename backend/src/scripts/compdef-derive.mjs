import { createHash } from "crypto";
import { PublicKey } from "@solana/web3.js";


const APP_PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);
const ARCIUM_PROGRAM_ID = new PublicKey(process.env.ARCIUM_MXE_PROGRAM_ID);
const CONFIDENTIAL_IX_NAME = process.env.ARCIUM_RESEAL_COMP_NAME || "reseal_dek";

const h = createHash("sha256").update(CONFIDENTIAL_IX_NAME).digest();
const offsetLE = h.subarray(0, 4);
const compDefIdx = offsetLE.readUInt32LE(0);

const seeds = [
  Buffer.from("ComputationDefinitionAccount"),
  APP_PROGRAM_ID.toBuffer(),
  offsetLE,
];


const [compDefPda] = PublicKey.findProgramAddressSync(seeds, ARCIUM_PROGRAM_ID);

console.log("conf_ix_name     :", CONFIDENTIAL_IX_NAME);
console.log("comp_def_offset  :", compDefIdx, "(LE bytes:", [...offsetLE], ")");
console.log("expected CompDef :", compDefPda.toBase58());
