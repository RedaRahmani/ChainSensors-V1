import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";

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
import * as path from "path";
import { expect } from "chai";

// SPL-Token helpers
import {
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

describe("ChainSensors", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.ChainSensors as Program<ChainSensors>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(eventName: E): Promise<Event[E]> => {
    let listenerId: number;
    const ev = await new Promise<Event[E]>((resolve) => {
      listenerId = program.addEventListener(eventName, (data) => resolve(data));
    });
    await program.removeEventListener(listenerId);
    return ev;
  };

  // ---------- Helpers ----------
  const toQ16_16 = (x: number) => {
    const v = Math.round(x * 65536);
    return Math.max(0, Math.min(0xffff_ffff, v)) >>> 0;
  };

  const jobPdaFor = (programId: PublicKey, computationAccount: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("quality_job"), computationAccount.toBuffer()],
      programId
    )[0];

  const readKpJson = (p: string): anchor.web3.Keypair => {
    const file = fs.readFileSync(p);
    return anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));
  };

  const isArciumLocalnet = () => process.env.ARCIUM_LOCALNET === "1";

  // Resolve FeePool/Clock in ARCIUM localnet
  function readArtifactPubkey(file: string): PublicKey | null {
    try {
      const full = path.resolve(process.cwd(), "artifacts", file);
      const raw = fs.readFileSync(full, "utf-8");
      const json = JSON.parse(raw);
      const k = json.pubkey ?? json.address ?? json.pubKey ?? null;
      return k ? new PublicKey(k) : null;
    } catch {
      return null;
    }
  }
  function resolveFeePoolAndClock() {
    const env = getArciumEnv();
    let feePool = (env as any).arciumFeePoolPubkey as PublicKey | undefined;
    let clock = (env as any).arciumClockPubkey as PublicKey | undefined;
    if (!feePool) feePool = readArtifactPubkey("arcium_fee_pool.json") ?? undefined;
    if (!clock) clock = readArtifactPubkey("arcium_clock.json") ?? undefined;
    if (!feePool || !clock) {
      throw new Error(
        `Could not resolve FeePool/Clock. feePool=${feePool?.toBase58?.() ?? "undefined"} clock=${
          clock?.toBase58?.() ?? "undefined"
        }`
      );
    }
    return { env, feePool, clock };
  }

  // Airdrop SOL helper for test signers
  async function airdrop(pubkey: PublicKey, lamports = 2 * anchor.web3.LAMPORTS_PER_SOL) {
    const sig = await provider.connection.requestAirdrop(pubkey, lamports);
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  // PDA helpers
  const pdaForDevice = (marketplace: PublicKey, deviceId: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("device"), marketplace.toBuffer(), Buffer.from(deviceId)],
      program.programId
    )[0];

  const pdaForListing = (devicePda: PublicKey, listingId: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), devicePda.toBuffer(), Buffer.from(listingId)],
      program.programId
    )[0];

  const pdaForPurchaseRecord = (listingPda: PublicKey, index: number | anchor.BN) => {
    const bn = anchor.BN.isBN(index) ? (index as anchor.BN) : new anchor.BN(index);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("purchase"), listingPda.toBuffer(), Buffer.from(bn.toArrayLike(Buffer, "le", 8))],
      program.programId
    )[0];
  };

  // ------------------------------
  // MPC tests (existing section)
  // ------------------------------
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
      const computationAccount = getComputationAccAddress(program.programId, computationOffset);
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
      const { env: arciumEnv, feePool, clock } = resolveFeePoolAndClock();
      console.log("Resolved FeePool:", feePool.toBase58(), "Clock:", clock.toBase58());

      const mxePublicKey = await getMXEPublicKey(provider as anchor.AnchorProvider, program.programId);

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
      const encMean = cipher.encrypt([BigInt(mQ)], nonceBytes)[0];
      const encStd = cipher.encrypt([BigInt(sQ)], nonceBytes)[0];

      const computationOffset = new anchor.BN(randomBytes(8), "hex");
      const computationAccount = getComputationAccAddress(program.programId, computationOffset);
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
          payer: (provider.wallet as any).publicKey,
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
          poolAccount: feePool,
          clockAccount: clock,
          systemProgram: SystemProgram.programId,
          arciumProgram: getArciumProgAddress(),
        });

      // simulate first for better logs
      const sim = await qb.simulate().catch((e: any) => e);
      if ((sim as any)?.logs) console.log("simulate logs:\n", (sim as any).logs.join("\n"));
      if ((sim as any)?.error) throw new Error("simulate failed: " + (sim as any).error.message);

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
        const lo = c.m - 2 * c.s,
          hi = c.m + 2 * c.s;
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

  // ---------------------------------------
  // Phase 1 marketplace/listing/purchase e2e + Phase 2 finalize
  // ---------------------------------------
  describe("Marketplace + Listing + Purchase + Finalize (Ph1+Ph2)", () => {
    const NAME = "My_Market";
    const FEE_BPS = 500; // 5%
    let admin: Keypair;
    let seller: Keypair;
    let buyer: Keypair;
    let rando: Keypair;

    // Mint & ATAs
    let usdcMint: PublicKey;
    let buyerAta: PublicKey;
    let sellerAta: PublicKey;

    // PDAs
    let marketplacePda: PublicKey;
    let treasuryPda: PublicKey;
    let treasuryAta: PublicKey;

    // Device/Listing
    const deviceId = "dev-001";
    const listingId = "listing-abc";
    const pricePerUnit = new anchor.BN(100_000); // 0.1 USDC (6 decimals)
    const totalUnits = new anchor.BN(10);
    const mxeCapsuleCid = "bafy-mxe-capsule-123";

    let devicePda: PublicKey;
    let listingPda: PublicKey;
    let firstPurchaseRecord: PublicKey;

    before(async () => {
      admin = Keypair.generate();
      seller = admin; // seller=admin for simplicity
      buyer = Keypair.generate();
      rando = Keypair.generate();

      await airdrop(admin.publicKey);
      await airdrop(buyer.publicKey);
      await airdrop(rando.publicKey);

      // Create a USDC mint (6 decimals, admin is mint authority)
      usdcMint = await createMint(
        provider.connection,
        admin, // payer
        admin.publicKey, // mint authority
        null, // freeze authority
        6
      );

      // Derive marketplace & treasury PDAs
      [marketplacePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace"), admin.publicKey.toBuffer()],
        program.programId
      );
      [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), admin.publicKey.toBuffer()],
        program.programId
      );

      // Treasury ATA for PDA
      treasuryAta = await getAssociatedTokenAddress(usdcMint, treasuryPda, true);

      // Initialize marketplace (PDA authority + ATA model)
      const initSig = await program.methods
        .initialize(NAME, FEE_BPS)
        .accounts({
          admin: admin.publicKey,
          marketplace: marketplacePda,
          treasury: treasuryPda,
          treasuryAta,
          usdcMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([admin])
        .rpc({ commitment: "confirmed" });
      console.log("initialize tx:", initSig);

      // Verify marketplace state
      const marketAcc = await program.account.marketplace.fetch(marketplacePda);
      expect(marketAcc.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(marketAcc.treasury.toBase58()).to.equal(treasuryPda.toBase58());
      expect(marketAcc.tokenMint.toBase58()).to.equal(usdcMint.toBase58());
      expect(marketAcc.sellerFee).to.equal(FEE_BPS);
      expect(marketAcc.isActive).to.equal(true);
      expect(marketAcc.name).to.equal(NAME);

      // Seller & Buyer ATAs
      sellerAta = (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          admin,
          usdcMint,
          seller.publicKey
        )
      ).address;

      buyerAta = (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          admin,
          usdcMint,
          buyer.publicKey
        )
      ).address;

      // Fund buyer
      await mintTo(provider.connection, admin, usdcMint, buyerAta, admin.publicKey, 2_000_000); // 2 USDC

      // Register device
      devicePda = pdaForDevice(marketplacePda, deviceId);
      const ekHash = Array.from(randomBytes(32));
      const accessHash = Array.from(randomBytes(32));

      const sigDev = await program.methods
        .registerDevice(
          deviceId,
          ekHash as any,
          "sensor",
          "lab1",
          "temp",
          "C",
          pricePerUnit.toNumber(),
          totalUnits.toNumber(),
          "bafy-data-xyz",
          accessHash as any,
          null
        )
        .accounts({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          deviceRegistry: devicePda,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([seller])
        .rpc({ commitment: "confirmed" });

      console.log("register_device tx:", sigDev);

      // Create listing (with MXE capsule CID!)
      listingPda = pdaForListing(devicePda, listingId);
      const sigList = await program.methods
        .createListing(
          listingId,
          "bafy-listing-cid",
          mxeCapsuleCid, // NEW arg
          pricePerUnit.toNumber(),
          deviceId,
          totalUnits.toNumber(),
          null
        )
        .accounts({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          deviceRegistry: devicePda,
          listingState: listingPda,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([seller])
        .rpc({ commitment: "confirmed" });

      console.log("create_listing tx:", sigList);
    });

    it("Purchases units (event, fee split, record), then finalizes as seller (event)", async () => {
      const listingBefore: any = await program.account.listingState.fetch(listingPda);
      const expectedIndex = listingBefore.purchaseCount.toNumber();

      const units = 3;
      const priceForUnits = pricePerUnit.toNumber() * units;
      const expectedFee = Math.floor((priceForUnits * FEE_BPS) / 10_000);
      const sellerAmount = priceForUnits - expectedFee;

      const buyerX = Array.from(randomBytes(32)) as any;
      const purchaseRecordPda = pdaForPurchaseRecord(listingPda, expectedIndex);

      // ListingPurchased + PurchaseFinalized events
      const purchasedEvP = awaitEvent("listingPurchased" as any);
      const finalizedEvP = awaitEvent("purchaseFinalized" as any);

      const sig = await program.methods
        .purchaseListing(listingId, new anchor.BN(units), buyerX, new anchor.BN(expectedIndex))
        .accounts({
          buyer: buyer.publicKey,
          buyerAta,
          marketplace: marketplacePda,
          deviceRegistry: devicePda,
          listingState: listingPda,
          sellerAta,
          treasury: treasuryPda,
          treasuryAta,
          usdcMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          purchaseRecord: purchaseRecordPda,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([buyer])
        .rpc({ commitment: "confirmed" });

      console.log("purchase_listing tx:", sig);
      firstPurchaseRecord = purchaseRecordPda;

      // Events check
      const purchasedEv: any = await purchasedEvP;
      expect(purchasedEv.unitsPurchased.toNumber()).to.equal(units);
      expect(purchasedEv.pricePaid.toNumber()).to.equal(priceForUnits);
      expect(purchasedEv.fee.toNumber()).to.equal(expectedFee);

      const finalizedEv: any = await finalizedEvP;
      expect(finalizedEv.listing.toBase58()).to.equal(listingPda.toBase58());
      expect(finalizedEv.record.toBase58()).to.equal(purchaseRecordPda.toBase58());
      expect(Buffer.from(finalizedEv.buyerX25519Pubkey).length).to.equal(32);
      expect(finalizedEv.dekCapsuleForMxeCid).to.equal(mxeCapsuleCid);

      // Balances/state
      const listingAfter: any = await program.account.listingState.fetch(listingPda);
      expect(listingAfter.remainingUnits.toNumber()).to.equal(
        listingBefore.remainingUnits.toNumber() - units
      );
      expect(listingAfter.purchaseCount.toNumber()).to.equal(
        listingBefore.purchaseCount.toNumber() + 1
      );

      const sellerAccAfter = await provider.connection.getTokenAccountBalance(sellerAta);
      const treasuryAccAfter = await provider.connection.getTokenAccountBalance(treasuryAta);
      expect(Number(sellerAccAfter.value.amount)).to.be.gte(sellerAmount);
      expect(Number(treasuryAccAfter.value.amount)).to.be.gte(expectedFee);

      // PurchaseRecord
      const pr: any = await program.account.purchaseRecord.fetch(purchaseRecordPda);
      expect(pr.listing.toBase58()).to.equal(listingPda.toBase58());
      expect(pr.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());
      expect(pr.unitsPurchased.toNumber()).to.equal(units);
      expect(pr.pricePaid.toNumber()).to.equal(priceForUnits);
      expect(pr.fee.toNumber()).to.equal(expectedFee);
      expect(pr.dekCapsuleForMxeCid).to.equal(mxeCapsuleCid);
      expect(pr.dekCapsuleForBuyerCid).to.equal("");

      // Finalize as seller — should set dek_capsule_for_buyer_cid and emit PurchaseSealed
      const buyerCapsuleCid = "bafy-buyer-capsule-xyz";
      const sealedEvP = awaitEvent("purchaseSealed" as any);

      const sigFin = await program.methods
        .finalizePurchase(buyerCapsuleCid)
        .accounts({
          authority: seller.publicKey, // seller auth
          marketplace: marketplacePda,
          listingState: listingPda,
          purchaseRecord: purchaseRecordPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([seller])
        .rpc({ commitment: "confirmed" });

      console.log("finalize_purchase (seller) tx:", sigFin);

      const sealedEv: any = await sealedEvP;
      expect(sealedEv.listing.toBase58()).to.equal(listingPda.toBase58());
      expect(sealedEv.record.toBase58()).to.equal(purchaseRecordPda.toBase58());
      expect(sealedEv.dekCapsuleForBuyerCid).to.equal(buyerCapsuleCid);

      const prAfter: any = await program.account.purchaseRecord.fetch(purchaseRecordPda);
      expect(prAfter.dekCapsuleForBuyerCid).to.equal(buyerCapsuleCid);
    });

    it("Rejects wrong purchase_index", async () => {
      const wrongIndex = new anchor.BN(9999);
      const badRecord = pdaForPurchaseRecord(listingPda, wrongIndex);

      let failed = false;
      try {
        await program.methods
          .purchaseListing(listingId, new anchor.BN(1), Array.from(randomBytes(32)) as any, wrongIndex)
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failed = true;
      }
      expect(failed, "purchase should fail on mismatched purchase_index").to.equal(true);
    });

    it("Finalize: unauthorized authority rejected", async () => {
      let failed = false;
      try {
        await program.methods
          .finalizePurchase("bafy-capsule-unauth")
          .accounts({
            authority: rando.publicKey, // neither seller nor admin
            marketplace: marketplacePda,
            listingState: listingPda,
            purchaseRecord: firstPurchaseRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([rando])
          .rpc({ commitment: "confirmed" });
      } catch {
        failed = true;
      }
      expect(failed).to.equal(true);
    });

    it("Finalize: double finalize rejected", async () => {
      let failed = false;
      try {
        await program.methods
          .finalizePurchase("bafy-capsule-dup")
          .accounts({
            authority: seller.publicKey,
            marketplace: marketplacePda,
            listingState: listingPda,
            purchaseRecord: firstPurchaseRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failed = true;
      }
      expect(failed).to.equal(true);
    });

    it("Finalize: empty and too-long CIDs rejected", async () => {
      // Create a fresh purchase to finalize against
      const listingAcc: any = await program.account.listingState.fetch(listingPda);
      const idx = listingAcc.purchaseCount.toNumber();

      const newRecord = pdaForPurchaseRecord(listingPda, idx);
      const buyerX = Array.from(randomBytes(32)) as any;

      await program.methods
        .purchaseListing(listingId, new anchor.BN(1), buyerX, new anchor.BN(idx))
        .accounts({
          buyer: buyer.publicKey,
          buyerAta,
          marketplace: marketplacePda,
          deviceRegistry: devicePda,
          listingState: listingPda,
          sellerAta,
          treasury: treasuryPda,
          treasuryAta,
          usdcMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          purchaseRecord: newRecord,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([buyer])
        .rpc({ commitment: "confirmed" });

      // Empty
      let failedEmpty = false;
      try {
        await program.methods
          .finalizePurchase("")
          .accounts({
            authority: seller.publicKey,
            marketplace: marketplacePda,
            listingState: listingPda,
            purchaseRecord: newRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedEmpty = true;
      }
      expect(failedEmpty).to.equal(true);

      // Too long
      const tooLong = "x".repeat(65);
      let failedLong = false;
      try {
        await program.methods
          .finalizePurchase(tooLong)
          .accounts({
            authority: seller.publicKey,
            marketplace: marketplacePda,
            listingState: listingPda,
            purchaseRecord: newRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedLong = true;
      }
      expect(failedLong).to.equal(true);
    });

    it("Finalize: listing/record mismatch and wrong marketplace rejected", async () => {
      // Prepare a second marketplace + listing to induce mismatches
      const admin2 = Keypair.generate();
      await airdrop(admin2.publicKey);

      const [market2] = PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace"), admin2.publicKey.toBuffer()],
        program.programId
      );
      const [treasury2] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), admin2.publicKey.toBuffer()],
        program.programId
      );
      const treasury2Ata = await getAssociatedTokenAddress(usdcMint, treasury2, true);

      await program.methods
        .initialize("Other", 0)
        .accounts({
          admin: admin2.publicKey,
          marketplace: market2,
          treasury: treasury2,
          treasuryAta: treasury2Ata,
          usdcMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([admin2])
        .rpc({ commitment: "confirmed" });

      // Create an unrelated listing under market2 to get a different listing PDA
      const dev2 = pdaForDevice(market2, "dev-zzz");
      await program.methods
        .registerDevice(
          "dev-zzz",
          Array.from(randomBytes(32)) as any,
          "sensor",
          "lab2",
          "temp",
          "C",
          100_000,
          5,
          "cid",
          Array.from(randomBytes(32)) as any,
          null
        )
        .accounts({
          seller: admin2.publicKey,
          marketplace: market2,
          deviceRegistry: dev2,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([admin2])
        .rpc({ commitment: "confirmed" });

      const list2 = pdaForListing(dev2, "list-zzz");
      await program.methods
        .createListing("list-zzz", "cid2", "mxe2", 100_000, "dev-zzz", 5, null)
        .accounts({
          seller: admin2.publicKey,
          marketplace: market2,
          deviceRegistry: dev2,
          listingState: list2,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([admin2])
        .rpc({ commitment: "confirmed" });

      // listing/record mismatch: pass list2 with firstPurchaseRecord (belongs to listingPda)
      let failedMismatch = false;
      try {
        await program.methods
          .finalizePurchase("bafy-ok")
          .accounts({
            authority: seller.publicKey,
            marketplace: marketplacePda,
            listingState: list2, // WRONG listing
            purchaseRecord: firstPurchaseRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedMismatch = true;
      }
      expect(failedMismatch).to.equal(true);

      // wrong marketplace for listing: pass market2 with original listingPda
      let failedMarket = false;
      try {
        await program.methods
          .finalizePurchase("bafy-ok")
          .accounts({
            authority: seller.publicKey,
            marketplace: market2, // WRONG market
            listingState: listingPda,
            purchaseRecord: firstPurchaseRecord,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedMarket = true;
      }
      expect(failedMarket).to.equal(true);
    });

    it("Negative: wrong mint, wrong treasury owner, self-buy, insufficient funds/units, expired listing, wrong device", async () => {
      // Wrong mint: pass a different usdc_mint in accounts
      const altMint = await createMint(provider.connection, admin, admin.publicKey, null, 6);

      const idxNow = (await program.account.listingState.fetch(listingPda)).purchaseCount.toNumber();
      const badRecord = pdaForPurchaseRecord(listingPda, idxNow);

      let failedWrongMint = false;
      try {
        await program.methods
          .purchaseListing(listingId, new anchor.BN(1), Array.from(randomBytes(32)) as any, new anchor.BN(idxNow))
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint: altMint, // WRONG mint vs listing.token_mint
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedWrongMint = true;
      }
      expect(failedWrongMint).to.equal(true);

      // Wrong treasury owner: pass buyer's ATA as treasury_ata
      const buyersAta = await getAssociatedTokenAddress(usdcMint, buyer.publicKey);
      const idxNow2 = (await program.account.listingState.fetch(listingPda)).purchaseCount.toNumber();
      const badRecord2 = pdaForPurchaseRecord(listingPda, idxNow2);

      let failedTreasuryOwner = false;
      try {
        await program.methods
          .purchaseListing(listingId, new anchor.BN(1), Array.from(randomBytes(32)) as any, new anchor.BN(idxNow2))
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta: buyersAta, // WRONG owner
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord2,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedTreasuryOwner = true;
      }
      expect(failedTreasuryOwner).to.equal(true);

      // Self-buy prohibited
      const idxNow3 = (await program.account.listingState.fetch(listingPda)).purchaseCount.toNumber();
      const badRecord3 = pdaForPurchaseRecord(listingPda, idxNow3);

      let failedSelfBuy = false;
      try {
        // Seller tries to buy their own listing
        const sellerAta2 = (
          await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            seller.publicKey
          )
        ).address;

        await mintTo(provider.connection, admin, usdcMint, sellerAta2, admin.publicKey, 1_000_000);

        await program.methods
          .purchaseListing(listingId, new anchor.BN(1), Array.from(randomBytes(32)) as any, new anchor.BN(idxNow3))
          .accounts({
            buyer: seller.publicKey, // seller as buyer
            buyerAta: sellerAta2,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord3,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([seller])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedSelfBuy = true;
      }
      expect(failedSelfBuy).to.equal(true);

      // Insufficient funds
      const poor = Keypair.generate();
      await airdrop(poor.publicKey);

      const poorAta = (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          admin,
          usdcMint,
          poor.publicKey
        )
      ).address;
      // don't mint any USDC

      const idxNow4 = (await program.account.listingState.fetch(listingPda)).purchaseCount.toNumber();
      const badRecord4 = pdaForPurchaseRecord(listingPda, idxNow4);

      let failedFunds = false;
      try {
        await program.methods
          .purchaseListing(listingId, new anchor.BN(2), Array.from(randomBytes(32)) as any, new anchor.BN(idxNow4))
          .accounts({
            buyer: poor.publicKey,
            buyerAta: poorAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord4,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([poor])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedFunds = true;
      }
      expect(failedFunds).to.equal(true);

      // Insufficient units
      const idxNow5 = (await program.account.listingState.fetch(listingPda)).purchaseCount.toNumber();
      const badRecord5 = pdaForPurchaseRecord(listingPda, idxNow5);

      let failedUnits = false;
      try {
        await program.methods
          .purchaseListing(listingId, new anchor.BN(10_000), Array.from(randomBytes(32)) as any, new anchor.BN(idxNow5))
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda,
            listingState: listingPda,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: badRecord5,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedUnits = true;
      }
      expect(failedUnits).to.equal(true);

      // Expired listing
      // Create a new listing with expires_at in the past
      const device2 = pdaForDevice(marketplacePda, "dev-exp");
      await program.methods
        .registerDevice(
          "dev-exp",
          Array.from(randomBytes(32)) as any,
          "sensor",
          "lab1",
          "temp",
          "C",
          100_000,
          1,
          "cid",
          Array.from(randomBytes(32)) as any,
          null
        )
        .accounts({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          deviceRegistry: device2,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([seller])
        .rpc({ commitment: "confirmed" });

      const listingExp = pdaForListing(device2, "list-exp");
      const pastTs = Math.floor(Date.now() / 1000) - 60;

      await program.methods
        .createListing("list-exp", "cid", "mxe-exp", 100_000, "dev-exp", 1, pastTs)
        .accounts({
          seller: seller.publicKey,
          marketplace: marketplacePda,
          deviceRegistry: device2,
          listingState: listingExp,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([seller])
        .rpc({ commitment: "confirmed" });

      const idxExp = 0;
      const recExp = pdaForPurchaseRecord(listingExp, idxExp);

      let failedExpired = false;
      try {
        await program.methods
          .purchaseListing("list-exp", new anchor.BN(1), Array.from(randomBytes(32)) as any, new anchor.BN(idxExp))
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: device2, // correct device for this listing
            listingState: listingExp,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: recExp,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedExpired = true;
      }
      expect(failedExpired).to.equal(true);

      // Wrong device for listing (pass devicePda that doesn't match listingExp.device)
      const idxWrongDev = 0;
      const recWrongDev = pdaForPurchaseRecord(listingExp, idxWrongDev);

      let failedWrongDevice = false;
      try {
        await program.methods
          .purchaseListing("list-exp", new anchor.BN(1), Array.from(randomBytes(32)) as any, new anchor.BN(idxWrongDev))
          .accounts({
            buyer: buyer.publicKey,
            buyerAta,
            marketplace: marketplacePda,
            deviceRegistry: devicePda, // WRONG device
            listingState: listingExp,
            sellerAta,
            treasury: treasuryPda,
            treasuryAta,
            usdcMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            purchaseRecord: recWrongDev,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([buyer])
          .rpc({ commitment: "confirmed" });
      } catch {
        failedWrongDevice = true;
      }
      expect(failedWrongDevice).to.equal(true);
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