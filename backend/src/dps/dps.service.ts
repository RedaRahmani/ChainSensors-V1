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
import { PublicKey } from '@solana/web3.js';
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { RewardService } from '../rewards/reward.service';
import { ArciumService } from '../arcium/arcium.service';

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
  }

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
  this.logger.log('metadata uploaded', { deviceId, dekPlaintextB64 });

    this.logger.log('Sealing DEK to MXE and uploading capsule…');
    const mxeCipherBytes = await this.arciumService.sealDekForMxe(dek); // throws on failure
    if (mxeCipherBytes.length !== 144) {
      throw new BadRequestException(`Arcium capsule must be 144 bytes, got ${mxeCipherBytes.length}`);
    }
    const rawBlobId = await this.walrusService.uploadData(mxeCipherBytes);
    const dekCapsuleForMxeCid = this.walrusService.normalizeBlobId(rawBlobId);
    this.logger.log(`Arcium DEK capsule uploaded for ${deviceId}: ${dekCapsuleForMxeCid}`);

    // 3) Upload metadata (includes DEK fields)
    const fullMeta = {
      ...metadata,
      deviceId,
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

    // 4) Build unsigned on-chain tx to register device
    const ekHash = Uint8Array.from(metadata.ekPubkeyHash ?? Array(32).fill(0));
    const accessHash = Uint8Array.from(metadata.accessKeyHash ?? Array(32).fill(0));
    const loc = metadata.location;
    const fd = metadata.dataTypes[0] || { type: '', units: '', frequency: '' };

    const { unsignedTx } = await this.solanaService.registerDevice(
      deviceId,
      Array.from(ekHash),
      metadata.model,
      `${loc.latitude},${loc.longitude}`,
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
}