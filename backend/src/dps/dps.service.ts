import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { WalrusService } from '../walrus/walrus.service';
import { SolanaService } from '../solana/solana.service';
import { Device, DeviceDocument } from './device.schema';
import { v4 as uuidv4 } from 'uuid';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { RewardService } from '../rewards/reward.service';
import { ArciumService } from '../arcium/arcium.service';
import { ensureValidLocation } from '../common/fake-locations';

// ⬇️ NEW (payments)
import { PayFinalizeDto, PayIntentDto } from './pay.dto';

export interface EnrollMetadata {
  deviceName: string;
  model: string;
  location: { latitude: number; longitude: number };
  dataTypes: { type: string; units: string; frequency: string }[];
  pricePerUnit?: number;
  totalDataUnits?: number;
  ekPubkeyHash?: number[];
  accessKeyHash?: number[];
  expiresAt?: number | null;
}

@Injectable()
export class DpsService {
  private readonly logger = new Logger(DpsService.name);
  private readonly marketplaceAdmin: PublicKey;
  private readonly brokerUrl: string;
  private readonly caKey: forge.pki.PrivateKey;
  private readonly caCert: forge.pki.Certificate;

  // ⬇️ NEW: simple payment state
  private connection: Connection;
  private intents = new Map<string, {
    orderId: string;
    sellerPubkey: string;
    contact: Omit<PayIntentDto, 'sellerPubkey'>;
    unsignedTxB64: string;
    txSig?: string;
    paid?: boolean;
  }>();

  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    private readonly walrusService: WalrusService,
    private readonly solanaService: SolanaService,
    private readonly rewardService: RewardService,
    private readonly configService: ConfigService,
    private readonly arciumService: ArciumService,
  ) {
    const adminKey = this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY');
    if (!adminKey) throw new Error('MARKETPLACE_ADMIN_PUBKEY not set');
    this.marketplaceAdmin = new PublicKey(adminKey);

    this.brokerUrl = this.configService.get<string>('BROKER_URL');
    if (!this.brokerUrl) throw new Error('BROKER_URL not set');

    const keyPath = this.configService.get<string>('CA_KEY_PATH');
    const certPath = this.configService.get<string>('CA_CERT_PATH');
    if (!keyPath || !certPath) {
      throw new Error('CA_KEY_PATH and CA_CERT_PATH must be set');
    }
    const caKeyPem = fs.readFileSync(keyPath, 'utf8');
    const caCertPem = fs.readFileSync(certPath, 'utf8');
    this.caKey = forge.pki.privateKeyFromPem(caKeyPem);
    this.caCert = forge.pki.certificateFromPem(caCertPem);

    // ⬇️ NEW: web3 connection for payment intents
    const rpc = this.configService.get<string>('SOLANA_RPC') || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpc, 'confirmed');
  }

  // =======================
  // EXISTING: seller-driven
  // =======================
  async generateRegistrationTransaction(
    csrPem: string,
    metadata: EnrollMetadata,
    sellerPubkey: PublicKey,
  ): Promise<{ deviceId: string; certificatePem: string; unsignedTx: string; brokerUrl: string; }> {
    // 1) CSR → client cert
    let csr: forge.pki.CertificationRequest;
    try { csr = forge.pki.certificationRequestFromPem(csrPem); } catch { throw new BadRequestException('Invalid CSR PEM'); }
    if (!csr.verify()) throw new BadRequestException('CSR signature invalid');

    const cnField = csr.subject.getField('CN');
    const deviceId = (cnField?.value as string) || uuidv4().replace(/-/g, '');
    this.logger.log('generateRegistrationTransaction()', { deviceId, model: metadata.model, deviceName: metadata.deviceName });

    const cert = forge.pki.createCertificate();
    cert.serialNumber = Date.now().toString();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    cert.setSubject(csr.subject.attributes);
    cert.setIssuer(this.caCert.issuer.attributes);
    cert.publicKey = csr.publicKey;
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    ]);
    cert.sign(this.caKey, forge.md.sha256.create());
    const certificatePem = forge.pki.certificateToPem(cert);

    // 2) Generate DEK + seal to MXE + upload capsule (REQUIRED)
    const dek = crypto.randomBytes(32);
    const dekPlaintextB64 = dek.toString('base64');
    this.logger.log('metadata uploaded', { deviceId, dekPlaintextB64 }); // (kept as in your new code)

    this.logger.log('Sealing DEK to MXE and uploading capsule…');
    const mxeCipherBytes = await this.arciumService.sealDekForMxe(dek); // throws on failure
    if (mxeCipherBytes.length !== 144) {
      throw new BadRequestException(`Arcium capsule must be 144 bytes, got ${mxeCipherBytes.length}`);
    }
    const rawBlobId = await this.walrusService.uploadData(mxeCipherBytes);
    const dekCapsuleForMxeCid = this.walrusService.normalizeBlobId(rawBlobId);
    this.logger.log(`Arcium DEK capsule uploaded for ${deviceId}: ${dekCapsuleForMxeCid}`);

    // 3) Upload metadata (includes DEK fields)
    // ✨ Enhance metadata with valid location info
    const validLocation = ensureValidLocation(metadata.location, deviceId);
    
    const fullMeta = {
      ...metadata,
      deviceId,
      // Override location with validated/fake location
      location: {
        latitude: validLocation.latitude,
        longitude: validLocation.longitude,
        name: validLocation.name
      },
      dekPlaintextB64,                 // camelCase
      dek_plaintext_b64: dekPlaintextB64, // snake for legacy readers
      dekCapsuleForMxeCid,             // camelCase
      dek_capsule_for_mxe_cid: dekCapsuleForMxeCid, // snake for legacy readers
    };
    this.logger.log(`Uploading metadata for device ${deviceId}`);
    let metadataCid: string;
    try {
      metadataCid = await this.walrusService.uploadMetadata(fullMeta);
    } catch (e: any) {
      this.logger.error(`Walrus upload failed: ${e?.message}`);
      throw new BadRequestException('Failed to upload device metadata to Walrus');
    }

    this.logger.log('metadata uploaded', { deviceId, metadataCid, hasCapsule: true });

    // 4) Build unsigned on-chain tx to register device (creates the on-chain listing)
    const ekHash = Uint8Array.from(metadata.ekPubkeyHash ?? Array(32).fill(0));
    const accessHash = Uint8Array.from(metadata.accessKeyHash ?? Array(32).fill(0));
    const fd = metadata.dataTypes[0] || { type: '', units: '', frequency: '' };

    const { unsignedTx } = await this.solanaService.registerDevice(
      deviceId,
      Array.from(ekHash),
      metadata.model,
      `${validLocation.latitude},${validLocation.longitude}`,
      fd.type,
      fd.units,
      metadata.pricePerUnit ?? 1,
      metadata.totalDataUnits ?? 1000,
      metadataCid,
      Array.from(accessHash),
      metadata.expiresAt ?? null,
      this.marketplaceAdmin,
      sellerPubkey,
    );

    await this.deviceModel.create({
      deviceId,
      token: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      sellerPubkey: sellerPubkey.toBase58(),
      metadataCid,
      metadata: fullMeta,
      unsignedTx,
      txSignature: null,
      lastSeen: null,
      latestDataCid: null,
      certificatePem,
    } as any);

    return { deviceId, certificatePem, unsignedTx, brokerUrl: this.brokerUrl };
  }

  async finalizeRegistration(
    deviceId: string,
    signedTx: string,
  ): Promise<{ txSignature: string; brokerUrl: string; certificatePem: string; }> {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
    if (!device.unsignedTx) throw new BadRequestException(`No pending tx for ${deviceId}`);

    const txSignature = await this.solanaService.submitSignedTransaction(signedTx);
    device.txSignature = txSignature;
    device.unsignedTx = null;
    device.status = 'complete';
    await device.save();

    await this.rewardService.rewardFor(device.sellerPubkey, 'deviceRegistration');

    this.logger.log('finalizeRegistration()', { deviceId, tx: txSignature });
    return { txSignature, brokerUrl: this.brokerUrl, certificatePem: device.certificatePem };
  }

  // =======================
  // NEW: hardware self-enroll (admin auto registers → immediate listing)
  // =======================
  async enrollHardware(
    csrPem: string,
    metadata: EnrollMetadata,
  ): Promise<{
    deviceId: string; certificatePem: string; brokerUrl: string; mqttTopic: string;
    txSignature: string; metadataCid: string; dekCapsuleForMxeCid: string;
  }> {
    // 1) CSR → client cert
    let csr: forge.pki.CertificationRequest;
    try { csr = forge.pki.certificationRequestFromPem(csrPem); } catch { throw new BadRequestException('Invalid CSR PEM'); }
    if (!csr.verify()) throw new BadRequestException('CSR signature invalid');

    const cnField = csr.subject.getField('CN');
    const deviceId = (cnField?.value as string) || uuidv4().replace(/-/g, '');
    this.logger.log('enrollHardware()', { deviceId, model: metadata.model, deviceName: metadata.deviceName });

    const cert = forge.pki.createCertificate();
    cert.serialNumber = Date.now().toString();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    cert.setSubject(csr.subject.attributes);
    cert.setIssuer(this.caCert.issuer.attributes);
    cert.publicKey = csr.publicKey;
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    ]);
    cert.sign(this.caKey, forge.md.sha256.create());
    const certificatePem = forge.pki.certificateToPem(cert);

    // 2) Generate DEK, seal to MXE, upload capsule (no plaintext stored)
    const dek = crypto.randomBytes(32);
    const mxeCipherBytes = await this.arciumService.sealDekForMxe(dek);
    if (mxeCipherBytes.length !== 144) {
      throw new BadRequestException(`Arcium capsule must be 144 bytes, got ${mxeCipherBytes.length}`);
    }
    const dekCapsuleForMxeCid = this.walrusService.normalizeBlobId(
      await this.walrusService.uploadData(mxeCipherBytes),
    );

    // 3) Upload minimal metadata
    const fullMeta = { ...metadata, deviceId, dekCapsuleForMxeCid };
    const metadataCid = await this.walrusService.uploadMetadata(fullMeta);

    // 4) Register on-chain using admin signer (creates the listing immediately)
    const ekHash = Uint8Array.from(metadata.ekPubkeyHash ?? Array(32).fill(0));
    const accessHash = Uint8Array.from(metadata.accessKeyHash ?? Array(32).fill(0));
    const loc = metadata.location;
    const fd = metadata.dataTypes?.[0] || { type: '', units: '', frequency: '' };

    const txSignature = await this.solanaService.registerDeviceAuto({
      deviceId,
      ekPubkeyHash: Array.from(ekHash),
      deviceType: metadata.model,
      location: `${loc.latitude},${loc.longitude}`,
      dataType: fd.type,
      dataUnit: fd.units,
      pricePerUnit: metadata.pricePerUnit ?? 1,
      totalDataUnits: metadata.totalDataUnits ?? 1000,
      dataCid: metadataCid,
      accessKeyHash: Array.from(accessHash),
      expiresAt: metadata.expiresAt ?? null,
    });

    // 5) persist
    await this.deviceModel.create({
      deviceId,
      token: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      sellerPubkey: this.solanaService.adminPubkeyBase58(),
      metadataCid,
      metadata: fullMeta,
      unsignedTx: null,
      txSignature,
      lastSeen: null,
      latestDataCid: null,
      certificatePem,
      status: 'complete',
    } as any);

    return {
      deviceId,
      certificatePem,
      brokerUrl: this.brokerUrl,
      mqttTopic: `devices/${deviceId}/data`,
      txSignature,
      metadataCid,
      dekCapsuleForMxeCid,
    };
  }

  // =======================
  // NEW: device-first helpers
  // =======================
  async ensureDeviceRecord(deviceId: string, certificatePem: string, partialMeta: any) {
    let dev = await this.deviceModel.findOne({ deviceId });
    if (!dev) {
      dev = await this.deviceModel.create({
        deviceId,
        token: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        sellerPubkey: this.solanaService.adminPubkeyBase58(), // unclaimed → admin by default
        metadataCid: null,
        metadata: partialMeta || {},
        unsignedTx: null,
        txSignature: null,
        lastSeen: null,
        latestDataCid: null,
        certificatePem,
        status: 'provisioned',
      } as any);
    } else {
      if (!dev.certificatePem && certificatePem) dev.certificatePem = certificatePem;
      if (!dev.status) dev.status = 'provisioned';
      await dev.save();
    }
    return dev;
  }

  async assignSeller(deviceId: string, sellerPubkey: string) {
    const dev = await this.deviceModel.findOne({ deviceId });
    if (!dev) throw new NotFoundException(`Device ${deviceId} not found`);
    
    // ✨ Ensure device has valid location metadata
    const currentMeta = dev.metadata || {};
    const validLocation = ensureValidLocation(currentMeta.location, deviceId);
    
    // Update metadata with valid location if it was missing or invalid
    if (!currentMeta.location || 
        currentMeta.location.latitude !== validLocation.latitude ||
        currentMeta.location.longitude !== validLocation.longitude) {
      
      dev.metadata = {
        ...currentMeta,
        location: {
          latitude: validLocation.latitude,
          longitude: validLocation.longitude,
          name: validLocation.name
        }
      };
      this.logger.log(`Enhanced device ${deviceId} with location: ${validLocation.name}`);
    }
    
    dev.sellerPubkey = sellerPubkey;
    dev.status = dev.status === 'provisioned' ? 'complete' : (dev.status || 'complete');
    await dev.save();

    // 🎉 Reward the seller for successfully claiming a device
    try {
      await this.rewardService.rewardFor(sellerPubkey, 'deviceRegistration');
      this.logger.log(`✅ Rewarded seller ${sellerPubkey} for claiming device ${deviceId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to reward seller ${sellerPubkey} for device ${deviceId}:`, error);
      // Don't throw - claiming should succeed even if reward fails
    }

    return { ok: true };
  }

  // =======================
  // OTHER existing helpers
  // =======================
  async updateLastSeen(deviceId: string, dataCid: string) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
    device.lastSeen = new Date();
    device.latestDataCid = dataCid;
    await device.save();
  }

  listDevices(filter: { sellerPubkey?: string } = {}) {
    return this.deviceModel.find(filter).lean().exec();
  }

  getDevice(deviceId: string) {
    return this.deviceModel.findOne({ deviceId }).lean().exec();
  }

  async getDeviceMetadata(deviceId: string) {
    const dev = await this.deviceModel.findOne({ deviceId }).lean().exec();
    if (!dev) throw new NotFoundException(`Device ${deviceId} not found`);
    let walrusMeta: any = null;
    try {
      walrusMeta = await this.walrusService.getMetadata(dev.metadataCid);
    } catch (e) {
      this.logger.warn(`Walrus metadata fetch failed for ${deviceId}: ${dev.metadataCid}`);
    }
    const meta = walrusMeta || dev.metadata || {};
    return {
      deviceId: dev.deviceId,
      metadataCid: dev.metadataCid,
      dekPlaintextB64: meta.dekPlaintextB64 ?? meta.dek_plaintext_b64 ?? null,
      dekCapsuleForMxeCid: meta.dekCapsuleForMxeCid ?? meta.dek_capsule_for_mxe_cid ?? null,
      ...meta,
      txSignature: dev.txSignature ?? null,
      lastSeen: dev.lastSeen ?? null,
      latestDataCid: dev.latestDataCid ?? null,
    };
  }

  // =======================
  // NEW: Payments (SOL → treasury)
  // =======================
  async createPayIntent(dto: PayIntentDto) {
    if (!dto.sellerPubkey) throw new BadRequestException('sellerPubkey required');

    const payer = new PublicKey(dto.sellerPubkey);
    const treasuryStr =
      this.configService.get<string>('TREASURY_PUBKEY') ||
      this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY');
    if (!treasuryStr) throw new BadRequestException('No TREASURY_PUBKEY or MARKETPLACE_ADMIN_PUBKEY configured');
    const treasury = new PublicKey(treasuryStr);

    const lamports = BigInt(
      this.configService.get<string>('REGISTRATION_FEE_LAMPORTS') || `${0.01 * 1e9}` // default 0.01 SOL
    );

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: treasury,
        lamports: Number(lamports),
      }),
    );
    tx.feePayer = payer;
    tx.recentBlockhash = blockhash;

    const unsignedTxB64 = Buffer.from(
      tx.serialize({ requireAllSignatures: false })
    ).toString('base64');

    const orderId = uuidv4();
    this.intents.set(orderId, {
      orderId,
      sellerPubkey: dto.sellerPubkey,
      contact: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
      },
      unsignedTxB64,
    });

    return { orderId, unsignedTxB64 };
  }

  async finalizePayIntent(dto: PayFinalizeDto) {
    const st = this.intents.get(dto.orderId);
    if (!st) throw new BadRequestException('Unknown orderId');

    const raw = Buffer.from(dto.signedTxB64, 'base64');
    const sig = await this.connection.sendRawTransaction(raw, { skipPreflight: false });
    await this.connection.confirmTransaction(sig, 'confirmed');

    st.txSig = sig;
    st.paid = true;
    this.intents.set(dto.orderId, st);

    return { txSignature: sig };
  }
}
