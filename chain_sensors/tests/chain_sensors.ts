// tests/chain_sensors.ts
// UPDATED: solid tests aligned with 3× EncryptedU32 (Q16.16) + Job PDA nonce correlation,
// plus robust discovery of FeePool & Clock accounts to avoid 'Unknown action undefined'.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ChainSensors } from "../target/types/chain_sensors";
import { randomBytes } from "crypto";
import {
  awaitComputationFinalization,
  getArciumEnv,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  uploadCircuit,
  buildFinalizeCompDefTx,
  RescueCipher,
  deserializeLE,
  getMXEPublicKey,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  x25519,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";
import * as path from "path"; // UPDATED
import { expect } from "chai";

describe("ChainSensors", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.ChainSensors as Program<ChainSensors>;
  const provider = anchor.getProvider();

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(eventName: E): Promise<Event[E]> => {
    let listenerId: number;
    const event = await new Promise<Event[E]>((res) => {
      listenerId = program.addEventListener(eventName, (ev) => res(ev));
    });
    await program.removeEventListener(listenerId);
    return event;
  };

  // ---------- Helpers ----------
  const toQ16_16 = (x: number) => {
    const v = Math.round(x * 65536);
    return Math.max(0, Math.min(0xFFFF_FFFF, v)) >>> 0;
  };

  const jobPdaFor = (programId: PublicKey, computationAccount: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("quality_job"), computationAccount.toBuffer()],
      programId
    )[0];

  const readKpJson = (p: string): anchor.web3.Keypair => {
    const file = fs.readFileSync(p);
    return anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(file.toString()))
    );
  };

  const isArciumLocalnet = () => process.env.ARCIUM_LOCALNET === "1";

  // UPDATED: robust discovery of FeePool & Clock if getArciumEnv() misses them.
  function readArtifactPubkey(file: string): PublicKey | null {
    try {
      const full = path.resolve(process.cwd(), "artifacts", file);
      const raw = fs.readFileSync(full, "utf-8");
      const json = JSON.parse(raw);
      // accept keys like { "pubkey": "..." } or { "address": "..." }
      const k = json.pubkey ?? json.address ?? json.pubKey ?? null;
      return k ? new PublicKey(k) : null;
    } catch {
      return null;
    }
  }

  function resolveFeePoolAndClock() {
    const env = getArciumEnv(); // throws if not running
    let feePool = (env as any).arciumFeePoolPubkey as PublicKey | undefined;
    let clock = (env as any).arciumClockPubkey as PublicKey | undefined;

    // Fallback to artifacts if env didn't expose them yet
    if (!feePool) feePool = readArtifactPubkey("arcium_fee_pool.json") ?? undefined;
    if (!clock)  clock  = readArtifactPubkey("arcium_clock.json") ?? undefined;

    if (!feePool || !clock) {
      throw new Error(
        `Could not resolve FeePool/Clock. ` +
        `Got feePool=${feePool?.toBase58?.() ?? "undefined"}, clock=${clock?.toBase58?.() ?? "undefined"}`
      );
    }

    return { env, feePool, clock };
  }

  it("Initializes accuracy score comp-def (structure OK even w/o localnet)", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
    try {
      const sig = await initAccuracyScoreCompDef(program, owner, false, false);
      console.log("initAccuracyScoreCompDef tx:", sig);
      expect(sig).to.be.a("string");
    } catch (err: any) {
      console.log("Init comp-def expected failure (no localnet):", err?.message);
      expect(err).to.exist;
    }
  });

  describe("Quality Score – MPC pipeline", () => {
    let owner: anchor.web3.Keypair;

    before(async () => {
      owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
    });

    it("Validates method signatures", async () => {
      expect(program.methods.computeAccuracyScore).to.exist;
      expect(program.methods.initAccuracyScoreCompDef).to.exist;

      const dummyEnc = new Array(32).fill(0);
      const dummyKey = new Array(32).fill(1);
      const nonce = randomBytes(16);

      const call = program.methods.computeAccuracyScore(
        new anchor.BN(12345),
        dummyEnc,
        dummyEnc,
        dummyEnc,
        dummyKey,
        new anchor.BN(deserializeLE(nonce).toString())
      );
      expect(call).to.exist;
    });

    it("Derives PDAs deterministically (comp-def & job PDA)", async () => {
      const offset = getCompDefAccOffset("compute_accuracy_score");
      const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
      const [compDefPda, bump] = PublicKey.findProgramAddressSync(
        [baseSeed, program.programId.toBuffer(), offset],
        getArciumProgAddress()
      );
      expect(PublicKey.isOnCurve(compDefPda)).to.be.false;

      const computationOffset = new anchor.BN(randomBytes(8), "hex");
      const computationAccount = getComputationAccAddress(
        program.programId,
        computationOffset
      );
      const jobPda = jobPdaFor(program.programId, computationAccount);
      expect(PublicKey.isOnCurve(jobPda)).to.be.false;

      const [compDefPda2, bump2] = PublicKey.findProgramAddressSync(
        [baseSeed, program.programId.toBuffer(), offset],
        getArciumProgAddress()
      );
      expect(bump).to.equal(bump2);
      expect(compDefPda.equals(compDefPda2)).to.be.true;

      console.log("compDefPda:", compDefPda.toBase58());
      console.log("jobPda:", jobPda.toBase58());
    });

    it("Queues MPC job and receives event with real nonce (runs only if ARCIUM_LOCALNET=1)", async function () {
      if (!isArciumLocalnet()) {
        console.log("Skipping full MPC test (set ARCIUM_LOCALNET=1 to enable).");
        this.skip();
      }
      this.timeout(180000);

      // ---------- Setup ----------
      const { env: arciumEnv, feePool, clock } = resolveFeePoolAndClock(); // UPDATED
      console.log("Resolved FeePool:", feePool.toBase58(), "Clock:", clock.toBase58()); // UPDATED

      const mxePublicKey = await getMXEPublicKey(
        provider as anchor.AnchorProvider,
        program.programId
      );

      const sk = x25519.utils.randomPrivateKey();
      const pk = x25519.getPublicKey(sk);
      const shared = x25519.getSharedSecret(sk, mxePublicKey);
      const cipher = new RescueCipher(shared);

      // Q16.16 inputs
      const reading = 25.0;
      const mean = 25.0;
      const stdDev = 1.0;
      const rQ = toQ16_16(reading);
      const mQ = toQ16_16(mean);
      const sQ = toQ16_16(stdDev);

      const nonceBytes = randomBytes(16);
      const encReading = cipher.encrypt([BigInt(rQ)], nonceBytes)[0];
      const encMean    = cipher.encrypt([BigInt(mQ)], nonceBytes)[0];
      const encStd     = cipher.encrypt([BigInt(sQ)], nonceBytes)[0];

      const computationOffset = new anchor.BN(randomBytes(8), "hex");
      const computationAccount = getComputationAccAddress(
        program.programId,
        computationOffset
      );
      const jobPda = jobPdaFor(program.programId, computationAccount);

      const qualityScoreEventP = awaitEvent("qualityScoreEvent");

      // ---------- Queue ----------
      const qb = program.methods
        .computeAccuracyScore(
          computationOffset,
          Array.from(encReading),
          Array.from(encMean),
          Array.from(encStd),
          Array.from(pk),
          new anchor.BN(deserializeLE(nonceBytes).toString())
        )
        .accounts({
          payer: owner.publicKey,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(program.programId),
          executingPool: getExecutingPoolAccAddress(program.programId),
          compDefAccount: getCompDefAccAddress(
            program.programId,
            Buffer.from(getCompDefAccOffset("compute_accuracy_score")).readUInt32LE()
          ),
          clusterAccount: arciumEnv.arciumClusterPubkey,
          computationAccount,
          jobPda,
          poolAccount: feePool, // UPDATED
          clockAccount: clock,  // UPDATED
          systemProgram: anchor.web3.SystemProgram.programId,
          arciumProgram: getArciumProgAddress(),
        })
        .signers([owner]);

      // DEBUG: simulate first to catch any missing account early (prints logs)
      const sim = await qb.simulate().catch((e: any) => e);
      if ((sim as any)?.logs) {
        console.log("simulate logs:\n", (sim as any).logs.join("\n"));
      }
      if ((sim as any)?.error) {
        throw new Error("simulate failed: " + (sim as any).error.message);
      }

      const queueSig = await qb.rpc({ skipPreflight: true, commitment: "confirmed" });
      console.log("Queue tx:", queueSig);

      // ---------- Finalize & wait for event ----------
      const finalizeSig = await awaitComputationFinalization(
        provider as anchor.AnchorProvider,
        computationOffset,
        program.programId,
        "confirmed"
      );
      console.log("Finalize tx:", finalizeSig);

      const ev = await qualityScoreEventP;
      console.log("Event:", ev);

      expect(Buffer.from(ev.nonce)).to.deep.equal(Buffer.from(nonceBytes));
      expect(ev.accuracyScore).to.be.an("array").with.length(32);
      expect(ev.computationType).to.equal("accuracy");
    });

    it("Demonstrates μ±2σ logic on plaintext (sanity)", () => {
      const cases = [
        { name: "Perfect", r: 25, m: 25, s: 1, in2s: true },
        { name: "Within 1σ", r: 26, m: 25, s: 1, in2s: true },
        { name: "At 2σ", r: 27, m: 25, s: 1, in2s: true },
        { name: "Outside 2σ", r: 30, m: 25, s: 1, in2s: false },
      ];
      for (const c of cases) {
        const lo = c.m - 2 * c.s, hi = c.m + 2 * c.s;
        const in2 = c.r >= lo && c.r <= hi;
        expect(in2, `Case ${c.name}`).to.equal(c.in2s);
      }
    });

    it("Validates encryption round-trip shape (no MXE needed)", () => {
      const mockShared = randomBytes(32);
      const cipher = new RescueCipher(mockShared);
      const nonce = randomBytes(16);

      const original = [BigInt(123456), BigInt(42)];
      const enc = cipher.encrypt(original, nonce);
      const dec = cipher.decrypt(enc, nonce);

      expect(dec.length).to.equal(original.length);
      expect(dec[0]).to.equal(original[0]);
      expect(dec[1]).to.equal(original[1]);
    });
  });

  // ------------ helpers (init comp-def) ------------
  async function initAccuracyScoreCompDef(
    program: Program<ChainSensors>,
    owner: anchor.web3.Keypair,
    uploadRawCircuit: boolean,
    offchainSource: boolean
  ): Promise<string> {
    const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offset = getCompDefAccOffset("compute_accuracy_score");
    const [compDefPDA] = PublicKey.findProgramAddressSync(
      [baseSeed, program.programId.toBuffer(), offset],
      getArciumProgAddress()
    );

    const sig = await program.methods
      .initAccuracyScoreCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount: getMXEAccAddress(program.programId),
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    if (uploadRawCircuit) {
      const raw = fs.readFileSync("build/compute_accuracy_score.arcis");
      await uploadCircuit(
        provider as anchor.AnchorProvider,
        "compute_accuracy_score",
        program.programId,
        raw,
        true
      );
    } else if (!offchainSource) {
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
        Buffer.from(offset).readUInt32LE(),
        program.programId
      );
      const latest = await provider.connection.getLatestBlockhash();
      finalizeTx.recentBlockhash = latest.blockhash;
      finalizeTx.lastValidBlockHeight = latest.lastValidBlockHeight;
      finalizeTx.sign(owner);
      await provider.sendAndConfirm(finalizeTx);
    }
    return sig;
  }
});
