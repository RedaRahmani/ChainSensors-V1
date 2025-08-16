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
import { RewardService } from '../rewards/reward.service';
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
  ): Promise<{
    deviceId: string;
    certificatePem: string;
    unsignedTx: string;
    brokerUrl: string;
  }> {
    let csr: forge.pki.CertificationRequest;
    try {
      csr = forge.pki.certificationRequestFromPem(csrPem);
      console.log('inside dps service this is the certificate', csr);
    } catch {
      throw new BadRequestException('Invalid CSR PEM');
    }
    if (!csr.verify()) {
      throw new BadRequestException('CSR signature invalid');
    }

    const cnField = csr.subject.getField('CN');
    const deviceId = (cnField?.value as string) || uuidv4().replace(/-/g, '');

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

    const fullMeta = { ...metadata, deviceId };
    console.log('this is the full metadataaaa', fullMeta);
        this.logger.log(`Uploading metadata for device ${deviceId}`);
    let metadataCid: string;
    try {
      metadataCid = await this.walrusService.uploadMetadata(fullMeta);
    } catch (e: any) {
      // Print the structured error from WalrusService so we can see status/code/body
      this.logger.error(`Walrus upload failed: ${e?.message}`);
      throw new BadRequestException('Failed to upload to Walrus');
    }


    const ekHash = Uint8Array.from(metadata.ekPubkeyHash ?? Array(32).fill(0));
    const accessHash = Uint8Array.from(
      metadata.accessKeyHash ?? Array(32).fill(0),
    );
    const loc = metadata.location;
    const fd = metadata.dataTypes[0] || {
      type: '',
      units: '',
      frequency: '',
    };

    this.logger.log(`Building unsigned tx for device ${deviceId}`);
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
    console.log(
      'we talk with solana service to get the unsigned tx , and this is it ',
      unsignedTx,
    );
    this.logger.log(
      `device id: ${deviceId}   certification pem ${certificatePem}   unsignedtx ${unsignedTx}    brokerurl ${this.brokerUrl}`,
    );
    const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await this.deviceModel.create({
      deviceId,
      token,
      sellerPubkey: sellerPubkey.toBase58(),
      metadataCid,
      metadata,
      unsignedTx,
      txSignature: null,
      lastSeen: null,
      latestDataCid: null,
      certificatePem: certificatePem,
    } as any);
    this.logger.log(
      `device id: ${deviceId}   certification pem ${certificatePem}   unsignedtx ${unsignedTx}    brokerurl ${this.brokerUrl}`,
    );
    return { deviceId, certificatePem, unsignedTx, brokerUrl: this.brokerUrl };
  }

  async finalizeRegistration(
    deviceId: string,
    signedTx: string,
  ): Promise<{
    txSignature: string;
    brokerUrl: string;
    certificatePem: string;
  }> {
    console.log('we areeeee inside finalizeee ');
    const device = await this.deviceModel.findOne({ deviceId });
    console.log(`this issss the device ${device}`);
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    if (!device.unsignedTx) {
      throw new BadRequestException(`No pending tx for ${deviceId}`);
    }
    console.log(`this is the insigned tx${device.unsignedTx}`);
    console.log('send the unsigned tx to solana service to sign it');

    const txSignature =
      await this.solanaService.submitSignedTransaction(signedTx);
    console.log(
      `the unsigned was signed and this is the returne from the solana service ${txSignature}`,
    );

    device.txSignature = txSignature;
    device.unsignedTx = null;
    device.status = 'complete';
    await device.save();
    // 2️⃣ Reward the user for registering a device:
    await this.rewardService.rewardFor(
      device.sellerPubkey, // their wallet address
      'deviceRegistration', // matches reward.rules.ts key
    );

    return {
      txSignature,
      brokerUrl: this.brokerUrl,
      certificatePem: device.certificatePem,
    };
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
}
