import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalrusService } from '../walrus/walrus.service';
import { SolanaService } from '../solana/solana.service';
import { Device, DeviceDocument } from './device.schema';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';
import * as forge from 'node-forge';
import * as fs from 'fs';

interface EnrollMetadata {
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
    private readonly configService: ConfigService,
  ) {
    // marketplace admin pubkey
    const adminKey = this.configService.get<string>('MARKETPLACE_ADMIN_PUBKEY');
    if (!adminKey) throw new Error('MARKETPLACE_ADMIN_PUBKEY not set');
    this.marketplaceAdmin = new PublicKey(adminKey);

    // broker URL
    this.brokerUrl = this.configService.get<string>('BROKER_URL');
    if (!this.brokerUrl) throw new Error('BROKER_URL not set');

    // load CA key & cert
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

  /**
   * Enroll a new device using a CSR and metadata:
   * 1) verify CSR
   * 2) sign cert
   * 3) upload metadata
   * 4) build unsigned on-chain tx
   * 5) store metadata and cert
   * 6) return device info + unsignedTx + certificate
   */
  async enrollDevice(csrPem: string, metadata: EnrollMetadata) {
    // parse & verify CSR
    let csr: forge.pki.CertificationRequest;
    try {
      csr = forge.pki.certificationRequestFromPem(csrPem);
    } catch {
      throw new Error('Invalid CSR PEM');
    }
    if (!csr.verify()) {
      throw new Error('CSR signature invalid');
    }

    // derive deviceId (from CN or new UUID)
    const cnField = csr.subject.getField('CN');
    const deviceId = (cnField?.value as string) || uuidv4().replace(/-/g, '');
    const fullMeta = { ...metadata, deviceId };

    this.logger.log(`Uploading metadata for device ${deviceId}`);
    const metadataCid = await this.walrusService.uploadMetadata(fullMeta);

    // sign the certificate
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

    // prepare on-chain args
    const ekHash = Uint8Array.from(metadata.ekPubkeyHash ?? Array(32).fill(0));
    const accessHash = Uint8Array.from(metadata.accessKeyHash ?? Array(32).fill(0));
    const loc = metadata.location;
    const fd = metadata.dataTypes[0] || { type: '', units: '', frequency: '' };

    this.logger.log(`Building unsigned tx for registering device ${deviceId}`);
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
    );

    // persist metadata & cert
    await this.deviceModel.create({
      deviceId,
      metadataCid,
      lastSeen: new Date(),
      latestDataCid: null,
      certificatePem,
    });

    return { deviceId, brokerUrl: this.brokerUrl, unsignedTx, certificatePem };
  }

  async updateLastSeen(deviceId: string, dataCid: string) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);
    device.lastSeen = new Date();
    device.latestDataCid = dataCid;
    await device.save();
  }

  listDevices() {
    return this.deviceModel.find().lean();
  }

  getDevice(deviceId: string) {
    return this.deviceModel.findOne({ deviceId }).lean();
  }
}
