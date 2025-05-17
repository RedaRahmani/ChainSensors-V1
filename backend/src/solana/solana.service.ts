import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from '@solana/web3.js';
import { BN, Idl, Program, Wallet } from '@coral-xyz/anchor';
import {
  createCompressedAccount,
  accountCompressionProgram,
  noopProgram,
  getAccountCompressionAuthority,
  createRpc,
  CompressedProof,
  CompressedAccountData,
  LightSystemProgram,
  
} from '@lightprotocol/stateless.js';
import {
   SendTransactionError,
   SystemProgram,
   SYSVAR_RENT_PUBKEY,
 } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';



import axios from 'axios';
import * as bs58 from 'bs58';
import idl from './idl.json';
import { createHash } from 'crypto';
import { buildPoseidon } from 'circomlibjs';

  function accountDiscriminator(accountName: string): Buffer {
    const preimage = Buffer.from(`account:${accountName}`);
    const hash = createHash('sha256').update(preimage).digest();
    return hash.slice(0, 8);
  }

import { serialize, Schema } from 'borsh';



class DeviceMetadata {
  device_type: string;
  location: string;
  data_type: string;
  data_unit: string;

  constructor(fields: {
    device_type: string;
    location: string;
    data_type: string;
    data_unit: string;
  }) {
    this.device_type = fields.device_type;
    this.location    = fields.location;
    this.data_type   = fields.data_type;
    this.data_unit   = fields.data_unit;
  }
}

class DeviceRegistry {
  owner: Uint8Array;
  marketplace: Uint8Array;
  device_id: string;
  ek_pubkey_hash: Uint8Array;
  is_active: number;
  price_per_unit: BN;
  total_data_units: BN;
  data_cid: string;
  access_key_hash: Uint8Array;
  metadata: DeviceMetadata;

  constructor(fields: {
    owner: Uint8Array;
    marketplace: Uint8Array;
    device_id: string;
    ek_pubkey_hash: Uint8Array;
    is_active: number;
    price_per_unit: BN;
    total_data_units: BN;
    data_cid: string;
    access_key_hash: Uint8Array;
    metadata: DeviceMetadata;
  }) {
    Object.assign(this, fields);
  }
}

const DeviceRegistrySchema: Schema = (new Map<any, any>([
  [DeviceMetadata, {
    kind: 'struct',
    fields: [
      ['device_type', 'string'],
      ['location',    'string'],
      ['data_type',   'string'],
      ['data_unit',   'string'],
    ],
  }],
  [DeviceRegistry, {
    kind: 'struct',
    fields: [
      ['owner',            [32]],
      ['marketplace',      [32]],
      ['device_id',        'string'],
      ['ek_pubkey_hash',   [32]],
      ['is_active',        'u8'],
      ['price_per_unit',   'u64'],
      ['total_data_units', 'u64'],
      ['data_cid',         'string'],
      ['access_key_hash',  [32]],
      ['metadata',         DeviceMetadata],
    ],
  }],
]) as unknown) as Schema;


@Injectable()
export class SolanaService {
  private program: Program<Idl>;
  private provider: anchor.AnchorProvider;
  private rpcEndpoint: string;
  private logger = new Logger(SolanaService.name);
  private rpcClient: ReturnType<typeof createRpc>;

  private merkleTreePubkey = new PublicKey(
    'smt1NamzXdq4AMqS2fS2F1i5KTYPZRhoHgWx38d8WsT'
  );
  private queuePubkey = new PublicKey(
    'aq1S9z4reTSQAdgWHGD2zDaS39sjGrAxbR31vxJ2F4F'
  );

  constructor(private configService: ConfigService) {
    const rpcUrl = configService.get<string>('SOLANA_RPC');
    const heliusKey = configService.get<string>('HELIUS_API_KEY');
    if (!rpcUrl || !heliusKey) {
      throw new Error('SOLANA_RPC or HELIUS_API_KEY missing');
    }
    this.rpcEndpoint = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
    this.rpcClient = createRpc(this.rpcEndpoint, this.rpcEndpoint, this.rpcEndpoint);

    const keypairJson = process.env.SOLANA_KEYPAIR_JSON;
    if (!keypairJson) throw new Error('SOLANA_KEYPAIR_JSON not set');
    const secret = Uint8Array.from(JSON.parse(keypairJson));
    const wallet = new Wallet(Keypair.fromSecretKey(secret));

    const connection = new Connection(this.rpcEndpoint, 'confirmed');
    this.provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(this.provider);

    const programId = new PublicKey(configService.get<string>('SOLANA_PROGRAM_ID')!);
    this.program = new anchor.Program(idl as Idl, programId, this.provider);

    this.verifyStateTree().catch(err => this.logger.error(err));
  }

  private async verifyStateTree() {
    const [merkleInfo, queueInfo] = await Promise.all([
      this.provider.connection.getAccountInfo(this.merkleTreePubkey),
      this.provider.connection.getAccountInfo(this.queuePubkey),
    ]);
    if (!merkleInfo || !queueInfo) {
      throw new Error('Compression tree or queue account not found');
    }
    this.logger.log('Compression state tree & queue verified');
  }


  
  /**
   * Build and insert a compressed account leaf, then fetch a zk proof.
   */
  async generateZkProof(
    deviceId: string,
    marketplacePda: PublicKey,
    ekPubkeyHash: number[],     
    accessKeyHash: number[],    
    deviceType: string,        
    location: string,      
    dataType: string,  
    dataUnit: string,  
    pricePerUnit: number,  
    totalDataUnits: number, 
    dataCid: string   
  ): Promise<CompressedProof> {

    const [devicePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      this.program.programId
    );

    const discriminator = accountDiscriminator('DeviceRegistry');

    const registry = new DeviceRegistry({
      owner: this.provider.wallet.publicKey.toBytes(),
      marketplace: marketplacePda.toBytes(),
      device_id: deviceId,
      ek_pubkey_hash: Uint8Array.from(ekPubkeyHash),
      is_active: 1,
      price_per_unit: new BN(pricePerUnit),
      total_data_units: new BN(totalDataUnits),
      data_cid: dataCid,
      access_key_hash: Uint8Array.from(accessKeyHash),
      metadata: new DeviceMetadata({
        device_type : deviceType,
        location,
        data_type: dataType,
        data_unit: dataUnit,
      }),
    });
    this.logger.log(`Device Registry:`);
    this.logger.log(` owner ${registry.owner}`);
    this.logger.log(` marketplace ${registry.marketplace}`);
    this.logger.log(` device id : ${registry.device_id}`);
    this.logger.log(` ek pk hash  ${registry.ek_pubkey_hash}`);
    this.logger.log(` status :${registry.is_active}`);
    this.logger.log(` price per unit: ${registry.price_per_unit}`);
    this.logger.log(` data total unit  ${registry.total_data_units}`);
    this.logger.log(` data cid ${registry.data_cid}`);
    this.logger.log(` key access hash : ${registry.access_key_hash}`);
    this.logger.log(` device type : ${registry.metadata.device_type}`);
    this.logger.log(` ${registry.metadata.location}`);
    this.logger.log(` data type ${registry.metadata.data_type}`);
    this.logger.log(` dataa unit  ${registry.metadata.data_unit}`);
    const dataBuf = Buffer.from(serialize(DeviceRegistrySchema, registry));

    const fullBuf = Buffer.concat([discriminator, dataBuf]);

    const CHUNK_SIZE = 32;
    const chunks: bigint[] = [];
    for (let i = 0; i < fullBuf.length; i += CHUNK_SIZE) {
      let slice = fullBuf.slice(i, i + CHUNK_SIZE);
      if (slice.length < CHUNK_SIZE) {
        slice = Buffer.concat([slice, Buffer.alloc(CHUNK_SIZE - slice.length)]);
      }
      const hex = '0x' + [...slice].reverse().map(b => b.toString(16).padStart(2, '0')).join('');
      chunks.push(BigInt(hex));
    }
    const poseidon = await buildPoseidon();
    const rootHash = await poseidon(chunks);
    const hashBuf = Buffer.from(rootHash);
      console.log('rootHash type:', typeof rootHash, 'value:', rootHash);

if (hashBuf.length !== 32) {
  throw new Error(`Expected 32-byte hash, got ${hashBuf.length} bytes`);
}
  const hashBigInt = BigInt('0x' + hashBuf.toString('hex'));
  const bitLength = hashBigInt.toString(2).length;
  console.log('Hash bit length:', bitLength);
  let finalHashBuf;
  if (bitLength > 248) {
    console.warn('Hash exceeds 248 bits, masking to 31 bytes');
    const max248Bits = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    const maskedHash = hashBigInt & max248Bits;
    finalHashBuf = Buffer.alloc(31);
    for (let i = 0; i < 31; i++) {
      finalHashBuf[30 - i] = Number((maskedHash >> BigInt(8 * i)) & BigInt(0xff));
    }
  } else {
    finalHashBuf = hashBuf; 
  }

    const leafData: CompressedAccountData = {
      discriminator: Array.from(discriminator),
      data: dataBuf,
      dataHash: Array.from(finalHashBuf),
    };

    try {
      await createCompressedAccount(
        this.provider.wallet.publicKey,
        new BN(0),
        leafData,
        [] as number[]
      );
      this.logger.log(`Leaf inserted: ${devicePda.toBase58()}`);
    } catch (e: any) {
      if (!/already in tree|AccountExists/.test(e.message)) throw e;
      this.logger.debug('Leaf already exists, skipping');
    }

    const leafHex = '0x' + finalHashBuf.toString('hex');
    console.log('LeafHex:', leafHex, 'length:', leafHex.length);


    try {
          console.log('Light RPC input:', [leafHex]);
          const { compressedProof } = await this.rpcClient.getValidityProof(
              [leafHex]         
              );

      if (!compressedProof) {
        throw new Error('No proof returned from Light RPC');
      }
        return compressedProof;

    } catch (lightErr) {
    this.logger.warn('Light RPC proof failed, falling back to Helius:', lightErr.message);
    const HELIUS_COMPRESSION_URL = `https://devnet.helius-rpc.com/?api-key=${this.configService.get<string>('HELIUS_API_KEY')}`;

      console.log('Hash buffer:', hashBuf);
      console.log('Hex string:', hashBuf.toString('hex'));
      console.log('LeafHex:', leafHex);
      console.log('Length (leafHex):', leafHex.length);
      console.log('LeafHex:', leafHex, 'length:', leafHex.length)

    let resp;
    try {
      resp = await axios.post(
        HELIUS_COMPRESSION_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getValidityProof',
          params: {
            hashes: [leafHex],
            newAddressesWithTrees: [
            { address: devicePda.toBase58(), tree: this.merkleTreePubkey.toBase58() }
          ],   
          },
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (httpErr) {
      this.logger.error('Helius HTTP call failed:', httpErr.message);
      throw httpErr;
    }
      this.logger.debug('Helius response payload:', resp.data);

    if (!resp.data?.result?.value?.proof) {
      const errMsg = `No proof in Helius response: ${JSON.stringify(resp.data)}`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }

      const p = resp.data.result.value.proof;
      return {
        a: Array.from(Buffer.from(p[0], 'base64')),
        b: Array.from(Buffer.from(p[1], 'base64')),
        c: Array.from(Buffer.from(p[2], 'base64')),
      };
    }
  }

  async initializeMarketplace(): Promise<void> {
    const name = this.configService.get<string>('MARKETPLACE_NAME');
    const feeBpsStr = this.configService.get<string>('SELLER_FEE_BASIS');
    const usdcMintStr = this.configService.get<string>('USDC_MINT');
    if (!name || !feeBpsStr || !usdcMintStr) {
      throw new Error('Marketplace config (NAME, SELLER_FEE_BASIS, USDC_MINT) missing');
    }
    const sellerFee = Number(feeBpsStr);
    const usdcMint = new PublicKey(usdcMintStr);

    const adminPubkey = this.provider.wallet.publicKey;
    const programId = this.program.programId;

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), adminPubkey.toBuffer()],
      programId,
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), adminPubkey.toBuffer()],
      programId,
    );

    try {
      await (this.program.account as any)['marketplace'].fetch(marketplacePda);
      this.logger.log('Marketplace already initialized at ' + marketplacePda.toBase58());
      return;
    } catch {
      this.logger.log('Marketplace not found, proceeding with initialization');
    }

    this.logger.log('Initializing marketplace on-chain');
    const tx = await this.program.methods
      .initialize(name, sellerFee)
      .accounts({
        admin: adminPubkey,
        marketplace: marketplacePda,
        treasury: treasuryPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    this.logger.log(`Marketplace initialized (tx: ${tx}) at PDA ${marketplacePda.toBase58()}`);
  }

  private async buildUnsignedTx(txPromise: Promise<Transaction>, feePayer: PublicKey): Promise<string> {
    const tx = await txPromise;
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = feePayer;
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    return serialized.toString('base64');
  }

  async registerDevice(
    deviceId: string,
    ekPubkeyHash: number[],
    deviceType: string,
    location: string,
    dataType: string,
    dataUnit: string,
    pricePerUnit: number,
    totalDataUnits: number,
    dataCid: string,
    accessKeyHash: number[],
    marketplaceAdmin: PublicKey,
    sellerPubkey: PublicKey,
  ): Promise<{ unsignedTx: string }> {
    const programId = this.program.programId;
        this.logger.debug('RegisterDevice accounts:');

    const [marketplacePda] = PublicKey.findProgramAddressSync([Buffer.from('marketplace'), marketplaceAdmin.toBuffer()], programId);
        this.logger.debug('RegisterDevice accounts:');

    const [cpiSignerPda, cpiAuthorityBump] = PublicKey.findProgramAddressSync([Buffer.from('cpi_authority')], programId);
    this.logger.debug('RegisterDevice accounts:');

    const proof = await this.generateZkProof(deviceId, marketplacePda, ekPubkeyHash,
  accessKeyHash,
  deviceType,
  location,
  dataType,
  dataUnit,
  pricePerUnit,
  totalDataUnits,
  dataCid);
    const anchorProof = { a: Uint8Array.from(proof.a), b0: Uint8Array.from(proof.b.slice(0,32)), b1: Uint8Array.from(proof.b.slice(32,64)), c: Uint8Array.from(proof.c) };
    const remainingAccounts = [
      { pubkey: this.merkleTreePubkey, isWritable: false, isSigner: false },
      { pubkey: this.queuePubkey, isWritable: true, isSigner: false },
    ];

    // 🔍 Logging account context before building tx
    this.logger.debug('RegisterDevice accounts:');
    this.logger.debug(` owner: ${sellerPubkey.toBase58()}`);
    this.logger.debug(` marketplace: ${marketplacePda.toBase58()}`);
    this.logger.debug(` cpiSigner: ${cpiSignerPda.toBase58()}`);
    this.logger.debug(` selfProgram: ${programId.toBase58()}`);
    this.logger.debug(` lightSystemProgram: ${LightSystemProgram.programId.toBase58()}`);
    this.logger.debug(` systemProgram: ${SystemProgram.programId.toBase58()}`);
    this.logger.debug(` accountCompressionProgram: ${accountCompressionProgram}`);
    this.logger.debug(` registeredProgramPda: ${programId.toBase58()}`);
    this.logger.debug(` noopProgram: ${noopProgram}`);
    this.logger.debug(` accountCompressionAuthority: ${getAccountCompressionAuthority().toBase58()}`);

    const unsignedTx = await this.buildUnsignedTx(
      this.program.methods.registerDevice(
        deviceId,
        Uint8Array.from(ekPubkeyHash),
        deviceType,
        location,
        dataType,
        dataUnit,
        new BN(pricePerUnit),
        new BN(totalDataUnits),
        dataCid,
        Uint8Array.from(accessKeyHash),
        anchorProof,
        0,
        { addressMerkleTreePubkeyIndex: 0, addressQueuePubkeyIndex: 1 },
        0,
        cpiAuthorityBump,
      )
      .accounts({
        owner: sellerPubkey,
        marketplace: marketplacePda,
        cpiSigner: cpiSignerPda,
        selfProgram: programId,
        lightSystemProgram: LightSystemProgram.programId,
        systemProgram: SystemProgram.programId,
        accountCompressionProgram: accountCompressionProgram,
        registeredProgramPda: programId,
        noopProgram: noopProgram,
        accountCompressionAuthority: getAccountCompressionAuthority(),
      })
      .remainingAccounts(remainingAccounts)
      .transaction(),
      sellerPubkey,
    );

    this.logger.log(`Built unsigned zk registerDevice tx for ${deviceId}`);
    return { unsignedTx };
  }

  async submitSignedTransaction(signedTxBase64: string): Promise<string> {
    const raw = Buffer.from(signedTxBase64, 'base64');
    const signature = await this.provider.connection.sendRawTransaction(
      raw,
      { skipPreflight: false, preflightCommitment: 'confirmed' },
    );

    await this.provider.connection.confirmTransaction(signature, 'confirmed');
    this.logger.log(`Submitted & confirmed tx ${signature}`);
    return signature;
  }

  private async buildUnsignedTxListing(txPromise: Promise<Transaction>, feePayer: PublicKey): Promise<string> {
    const tx = await txPromise;
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = feePayer;
    return tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');
  }

  async buildCreateListingTransaction(args: {
    listingId: string;
    dataCid: string;
    pricePerUnit: number;
    deviceId: string;
    totalDataUnits: number;
    expiresAt: number | null;
    sellerPubkey: PublicKey;
  }): Promise<{ unsignedTx: string }> {
    const {
      listingId,
      dataCid,
      pricePerUnit,
      deviceId,
      totalDataUnits,
      expiresAt,
      sellerPubkey,
    } = args;
    const pid = this.program.programId;
    const marketplaceAdmin = new PublicKey(
      this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY')!,
    );

    const [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), marketplaceAdmin.toBuffer()],
      pid,
    );
    const [deviceRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('device'), marketplacePda.toBuffer(), Buffer.from(deviceId)],
      pid,
    );
    const [listingStatePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('listing'),
        deviceRegistryPda.toBuffer(),
        Buffer.from(listingId),
      ],
      pid,
    );

    const builder = this.program.methods
      .createListing(
        listingId,
        dataCid,
        new BN(pricePerUnit),
        deviceId,
        new BN(totalDataUnits),
        expiresAt !== null ? new BN(expiresAt) : null,
      )
      .accounts({
        seller: sellerPubkey,
        marketplace: marketplacePda,
        deviceRegistry: deviceRegistryPda,
        listingState: listingStatePda,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      });

    this.logger.debug('IDL args:', this.program.idl.instructions.find(i => i.name === 'createListing')?.args);
    this.logger.debug('Call values:', [listingId, dataCid, pricePerUnit, deviceId, totalDataUnits, expiresAt]);

    const txPromise = builder.transaction();
    const unsignedTx = await this.buildUnsignedTxListing(txPromise, sellerPubkey);
    this.logger.log(`Built unsigned createListing tx`);
    return { unsignedTx };
  }

  async submitSignedTransactionListing(signedTxBase64: string): Promise<string> {
    const raw = Buffer.from(signedTxBase64, 'base64');
    const sig = await this.provider.connection.sendRawTransaction(raw, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await this.provider.connection.confirmTransaction(sig, 'confirmed');
    this.logger.log(`Transaction confirmed: ${sig}`);
    return sig;
  }
}
