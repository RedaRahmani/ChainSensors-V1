// backend/src/scripts/test.mjs  (Node 24 ESM)
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import {
  getArciumProgAddress,
  getCompDefAccOffset,
  getCompDefAccAddress,
} from "@arcium-hq/client";

// 1) Provider
const rpc = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const keypair = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.SOLANA_KEYPAIR_JSON ?? fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf8")))
);
const provider = new anchor.AnchorProvider(new anchor.web3.Connection(rpc, "confirmed"), new anchor.Wallet(keypair), { commitment: "confirmed" });
anchor.setProvider(provider);

// 2) Program ID (from SDK)
const arciumPid = getArciumProgAddress();

// 3) Load Arcium IDL from the SDK package (static JSON import)
const { default: arciumIdl } = await import("@arcium-hq/client/idl/arcium.json", { with: { type: "json" } });

// 4) Construct program client + check comp-def
const arcium = new anchor.Program(arciumIdl, new PublicKey(arciumPid), provider);
const idx = Buffer.from(getCompDefAccOffset("reseal_dek")).readUInt32LE();
const compDef = getCompDefAccAddress(arcium.programId, idx);

const acc = await arcium.account.computationDefinitionAccount.fetchNullable(compDef);
console.log("Arcium PID:", arcium.programId.toBase58());
console.log("compDef PDA:", compDef.toBase58());
console.log("exists:", !!acc, "completed:", acc?.completed ?? null);
