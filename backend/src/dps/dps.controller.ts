// import {
//   Controller,
//   Post,
//   Body,
//   HttpException,
//   HttpStatus,
//   Get,
//   Query,
//   Param,
//   Logger,
//   Headers,
//   UnauthorizedException,
//   BadRequestException,
//   HttpCode,
// } from '@nestjs/common';
// import { PublicKey } from '@solana/web3.js';
// import { DpsService, EnrollMetadata } from './dps.service';

// // ⬇️ NEW (for /dps/metadata upsert)
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Device, DeviceDocument } from './device.schema';
// import { WalrusService } from '../walrus/walrus.service';

// import * as fs from 'fs';
// import * as os from 'os';
// import * as path from 'path';
// import { execFileSync } from 'child_process';
// import { randomBytes } from 'crypto';

// interface GenerateTxDto {
//   csrPem: string;
//   metadata: EnrollMetadata;
//   sellerPubkey: string;
// }
// interface GenerateTxResponse {
//   deviceId: string;
//   certificatePem: string;
//   unsignedTx: string;
//   brokerUrl: string;
// }
// interface FinalizeDto {
//   deviceId: string;
//   signedTx: string;
// }
// interface FinalizeResponse {
//   txSignature: string;
//   brokerUrl: string;
//   certificatePem: string;
// }

// // ⬇️ NEW types for device-first claims/bootstrap
// interface HwEnrollDto {
//   csrPem: string;
//   metadata: EnrollMetadata;
// }
// interface HwEnrollResponse {
//   deviceId: string;
//   certificatePem: string;
//   brokerUrl: string;
//   mqttTopic: string;
//   txSignature: string;
//   metadataCid: string;
//   dekCapsuleForMxeCid: string;
// }

// type BootstrapDto = { deviceId: string; code: string; model: string; fwVersion: string };
// type BootstrapResp = { ephemeralToken: string; brokerUrl: string };

// type CsrDto = { deviceId: string; model: string; csrPem: string };
// type CsrResp = { certificatePem: string; brokerCaPem: string; brokerUrl: string };

// type ClaimDto = { deviceId: string; code: string; sellerPubkey: string };
// type ClaimResp = { ok: true };

// // ⬇️ In-memory short-lived maps (dev-mode flow, safe to keep)
// const pending = new Map<string, { token: string; exp: number }>();
// const claimCodes = new Map<string, { code: string; exp: number }>();

// function resolveCaPath(file: 'ca-key.pem' | 'ca-cert.pem') {
//   const envKey = file === 'ca-key.pem' ? process.env.CA_KEY_PATH : process.env.CA_CERT_PATH;
//   if (envKey && fs.existsSync(envKey)) return envKey;
//   return path.resolve(process.cwd(), 'SSL Certificates', file);
// }

// @Controller('dps')
// export class DpsController {
//   private readonly logger = new Logger(DpsController.name);

//   constructor(
//     private readonly dpsService: DpsService,

//     // ⬇️ NEW for /dps/metadata
//     @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
//     private readonly walrus: WalrusService,
//   ) {}

//   // ===========================================================
//   // EXISTING: SELLER ENROLL + FINALIZE + QUERIES (kept as is)
//   // ===========================================================
//   @Post('enroll')
//   async generateRegistrationTransaction(
//     @Body() dto: GenerateTxDto,
//   ): Promise<GenerateTxResponse> {
//     this.logger.log('POST /dps/enroll', {
//       sellerPubkey: dto?.sellerPubkey,
//       model: dto?.metadata?.model,
//       deviceName: dto?.metadata?.deviceName,
//     });

//     const { csrPem, metadata, sellerPubkey } = dto;
//     if (!csrPem || !metadata || !sellerPubkey) {
//       throw new HttpException(
//         'Missing csrPem, metadata, or sellerPubkey',
//         HttpStatus.BAD_REQUEST,
//       );
//     }
//     let sellerKey: PublicKey;
//     try {
//       sellerKey = new PublicKey(sellerPubkey);
//     } catch {
//       throw new HttpException('Invalid sellerPubkey format', HttpStatus.BAD_REQUEST);
//     }
//     try {
//       const out = await this.dpsService.generateRegistrationTransaction(
//         csrPem,
//         metadata,
//         sellerKey,
//       );
//       this.logger.log('enroll -> OK', { deviceId: out.deviceId, metadataCid: (out as any).metadataCid });
//       return out;
//     } catch (err: any) {
//       this.logger.error('enroll -> FAIL', { err: err?.message });
//       throw new HttpException(
//         err.message || 'Enrollment failed',
//         err.status || HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Post('finalize')
//   async finalizeRegistration(@Body() dto: FinalizeDto): Promise<FinalizeResponse> {
//     this.logger.log('POST /dps/finalize', { deviceId: dto?.deviceId });
//     const { deviceId, signedTx } = dto;
//     if (!deviceId || !signedTx) {
//       throw new HttpException('Missing deviceId or signedTx', HttpStatus.BAD_REQUEST);
//     }
//     try {
//       const out = await this.dpsService.finalizeRegistration(deviceId, signedTx);
//       this.logger.log('finalize -> OK', { deviceId, tx: out.txSignature });
//       return out;
//     } catch (err: any) {
//       this.logger.error('finalize -> FAIL', { err: err?.message });
//       throw new HttpException(
//         err.message || 'Finalization failed',
//         err.status || HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Get('my-devices')
//   async myDevices(@Query('sellerPubkey') seller: string) {
//     this.logger.log('GET /dps/my-devices', { seller });
//     return this.dpsService.listDevices({ sellerPubkey: seller });
//   }

//   @Get('device/:deviceId')
//   async getDeviceMetadata(@Param('deviceId') deviceId: string) {
//     this.logger.log('GET /dps/device/:deviceId', { deviceId });
//     return this.dpsService.getDeviceMetadata(deviceId);
//   }

//   // ===========================================================
//   // NEW: PAY ON CONTACT (order intent + finalize)
//   // ===========================================================
//   @Post('pay-intent')
//   async createPayIntent(@Body() dto: any) {
//     return this.dpsService.createPayIntent(dto);
//   }

//   @Post('pay-finalize')
//   async finalizePay(@Body() dto: any) {
//     return this.dpsService.finalizePayIntent(dto);
//   }

//   // ===========================================================
//   // NEW: DEVICE-FIRST BOOTSTRAP → CSR SIGN → CLAIM
//   // ===========================================================
//   @Post('bootstrap')
//   async bootstrap(@Body() dto: BootstrapDto): Promise<BootstrapResp> {
//     this.logger.log('POST /dps/bootstrap', {
//       deviceId: dto?.deviceId,
//       model: dto?.model,
//       fw: dto?.fwVersion,
//     });

//     if (!dto?.deviceId || !dto?.code) {
//       throw new BadRequestException('deviceId and code are required');
//     }
//     // record claim code (1h)
//     claimCodes.set(dto.deviceId, { code: dto.code, exp: Date.now() + 60 * 60 * 1000 });

//     const token = randomBytes(24).toString('hex');
//     // token valid 10 min
//     pending.set(dto.deviceId, { token, exp: Date.now() + 10 * 60 * 1000 });

//     const brokerUrl = process.env.BROKER_URL;
//     if (!brokerUrl) throw new BadRequestException('BROKER_URL is not set in environment');

//     return { ephemeralToken: token, brokerUrl };
//   }

//   @Post('csr')
//   async csr(@Headers('authorization') auth: string, @Body() dto: CsrDto): Promise<CsrResp> {
//     this.logger.log('POST /dps/csr', { deviceId: dto?.deviceId, model: dto?.model });

//     if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing Bearer token');
//     if (!dto?.deviceId || !dto?.csrPem) throw new BadRequestException('deviceId and csrPem are required');

//     const token = auth.slice(7);
//     const rec = pending.get(dto.deviceId);
//     if (!rec || rec.token !== token || rec.exp < Date.now()) {
//       throw new UnauthorizedException('Token invalid or expired');
//     }

//     const caKeyPath = resolveCaPath('ca-key.pem');
//     const caCertPath = resolveCaPath('ca-cert.pem');
//     if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
//       throw new BadRequestException('CA files not found (check CA_KEY_PATH / CA_CERT_PATH or SSL Certificates folder)');
//     }

//     // Sign CSR via openssl (one-liner)
//     const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-dps-'));
//     const csrPath = path.join(tmpDir, 'req.csr');
//     const crtPath = path.join(tmpDir, 'dev.crt');
//     fs.writeFileSync(csrPath, dto.csrPem, 'utf8');
//     try {
//       execFileSync('openssl', [
//         'x509', '-req', '-in', csrPath,
//         '-CA', caCertPath, '-CAkey', caKeyPath, '-CAcreateserial',
//         '-out', crtPath, '-days', '365', '-sha256',
//       ]);
//     } catch (e: any) {
//       this.logger.error('OpenSSL signing failed', { err: String(e?.message || e) });
//       throw new HttpException('CSR signing failed', HttpStatus.INTERNAL_SERVER_ERROR);
//     }

//     const certificatePem = fs.readFileSync(crtPath, 'utf8');
//     const brokerCaPem    = fs.readFileSync(caCertPath, 'utf8');
//     const brokerUrl      = process.env.BROKER_URL!;

//     // one-time use
//     pending.delete(dto.deviceId);

//     // ensure DB row for immediate ingest visibility
//     await this.dpsService.ensureDeviceRecord(dto.deviceId, certificatePem, { model: dto.model });

//     return { certificatePem, brokerCaPem, brokerUrl };
//   }

//   @Post('claim')
//   async claim(@Body() body: ClaimDto): Promise<ClaimResp> {
//     this.logger.log('POST /dps/claim', { deviceId: body?.deviceId, sellerPubkey: body?.sellerPubkey });
//     if (!body?.deviceId || !body?.code || !body?.sellerPubkey)
//       throw new BadRequestException('deviceId, code, sellerPubkey required');

//     const rec = claimCodes.get(body.deviceId);
//     if (!rec || rec.code !== body.code || rec.exp < Date.now())
//       throw new UnauthorizedException('Claim code invalid or expired');

//     try {
//       new PublicKey(body.sellerPubkey);
//     } catch {
//       throw new BadRequestException('sellerPubkey is not a valid base58 public key');
//     }

//     await this.dpsService.assignSeller(body.deviceId, body.sellerPubkey);
//     claimCodes.delete(body.deviceId);
//     return { ok: true };
//   }

//   // ===========================================================
//   // NEW: HARDWARE SELF-ENROLL (admin signs on-chain)
//   // ===========================================================
//   @Post('enroll-hw')
//   async enrollHardware(@Body() body: HwEnrollDto): Promise<HwEnrollResponse> {
//     this.logger.log('POST /dps/enroll-hw', {
//       model: body?.metadata?.model,
//       deviceName: body?.metadata?.deviceName,
//     });
//     if (!body?.csrPem || !body?.metadata) {
//       throw new HttpException('csrPem and metadata required', HttpStatus.BAD_REQUEST);
//     }
//     try {
//       return await this.dpsService.enrollHardware(body.csrPem, body.metadata);
//     } catch (err: any) {
//       this.logger.error('enroll-hw -> FAIL', { err: err?.message });
//       throw new HttpException(
//         err.message || 'Hardware enrollment failed',
//         err.status || HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   // ===========================================================
//   // NEW: DEVICE REPORTS METADATA (includes { location })
//   // ===========================================================
//   @Post('metadata')
//   @HttpCode(HttpStatus.CREATED)
//   async reportMetadata(@Body() body: any) {
//     const deviceId: string = body?.deviceId;
//     if (!deviceId) {
//       throw new BadRequestException('deviceId required');
//     }

//     // Merge existing metadata with latest body (prefer latest)
//     const doc = await this.deviceModel.findOne({ deviceId }).lean().exec();
//     const prev = doc?.metadata || {};
//     const merged = { ...prev, ...body, deviceId };

//     // Push to Walrus and capture CID
//     const metadataCid = await this.walrus.uploadMetadata(merged);

//     // Upsert device record with latest metadata + CID
//     await this.deviceModel
//       .updateOne(
//         { deviceId },
//         { $set: { metadataCid, metadata: merged } },
//         { upsert: true },
//       )
//       .exec();

//     this.logger.log('metadata -> OK', { deviceId, metadataCid });
//     return { ok: true, metadataCid };
//   }
// }
import {
  Controller, Post, Body, HttpException, HttpStatus, Get, Query, Param,
  Logger, Headers, UnauthorizedException, BadRequestException, HttpCode,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { DpsService, EnrollMetadata } from './dps.service';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './device.schema';
import { WalrusService } from '../walrus/walrus.service';

import { randomBytes } from 'crypto';

interface GenerateTxDto { csrPem: string; metadata: EnrollMetadata; sellerPubkey: string; }
interface GenerateTxResponse { deviceId: string; certificatePem: string; unsignedTx: string; brokerUrl: string; }
interface FinalizeDto { deviceId: string; signedTx: string; }
interface FinalizeResponse { txSignature: string; brokerUrl: string; certificatePem: string; }

interface HwEnrollDto { csrPem: string; metadata: EnrollMetadata; }
interface HwEnrollResponse {
  deviceId: string; certificatePem: string; brokerUrl: string; mqttTopic: string;
  txSignature: string; metadataCid: string; dekCapsuleForMxeCid: string;
}

type BootstrapDto = { deviceId: string; code: string; model: string; fwVersion: string };
type BootstrapResp = { ephemeralToken: string; brokerUrl: string };

type CsrDto = { deviceId: string; model: string; csrPem: string };
type CsrResp = { certificatePem: string; brokerCaPem: string; brokerUrl: string };

type ClaimDto = { deviceId: string; code: string; sellerPubkey: string };
type ClaimResp = { ok: true };

const pending = new Map<string, { token: string; exp: number }>();
const claimCodes = new Map<string, { code: string; exp: number }>();

@Controller('dps')
export class DpsController {
  private readonly logger = new Logger(DpsController.name);

  constructor(
    private readonly dpsService: DpsService,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    private readonly walrus: WalrusService,
  ) {}

  // -------- SELLER ENROLL / FINALIZE --------
  @Post('enroll')
  async generateRegistrationTransaction(@Body() dto: GenerateTxDto): Promise<GenerateTxResponse> {
    this.logger.log('POST /dps/enroll', {
      sellerPubkey: dto?.sellerPubkey,
      model: dto?.metadata?.model,
      deviceName: dto?.metadata?.deviceName,
    });
    const { csrPem, metadata, sellerPubkey } = dto;
    if (!csrPem || !metadata || !sellerPubkey) {
      throw new HttpException('Missing csrPem, metadata, or sellerPubkey', HttpStatus.BAD_REQUEST);
    }
    let sellerKey: PublicKey;
    try { sellerKey = new PublicKey(sellerPubkey); } catch { throw new HttpException('Invalid sellerPubkey format', HttpStatus.BAD_REQUEST); }
    try {
      const out = await this.dpsService.generateRegistrationTransaction(csrPem, metadata, sellerKey);
      this.logger.log('enroll -> OK', { deviceId: out.deviceId });
      return out;
    } catch (err: any) {
      this.logger.error('enroll -> FAIL', { err: err?.message });
      throw new HttpException(err.message || 'Enrollment failed', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('finalize')
  async finalizeRegistration(@Body() dto: FinalizeDto): Promise<FinalizeResponse> {
    this.logger.log('POST /dps/finalize', { deviceId: dto?.deviceId });
    const { deviceId, signedTx } = dto;
    if (!deviceId || !signedTx) throw new HttpException('Missing deviceId or signedTx', HttpStatus.BAD_REQUEST);
    try {
      const out = await this.dpsService.finalizeRegistration(deviceId, signedTx);
      this.logger.log('finalize -> OK', { deviceId, tx: out.txSignature });
      return out;
    } catch (err: any) {
      this.logger.error('finalize -> FAIL', { err: err?.message });
      throw new HttpException(err.message || 'Finalization failed', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('my-devices')
  async myDevices(@Query('sellerPubkey') seller: string) {
    this.logger.log('GET /dps/my-devices', { seller });
    return this.dpsService.listDevices({ sellerPubkey: seller });
  }

  @Get('device/:deviceId')
  async getDeviceMetadata(@Param('deviceId') deviceId: string) {
    this.logger.log('GET /dps/device/:deviceId', { deviceId });
    return this.dpsService.getDeviceMetadata(deviceId);
  }

  // -------- PAYMENTS --------
  @Post('pay-intent')
  async createPayIntent(@Body() dto: any) {
    return this.dpsService.createPayIntent(dto);
  }

  @Post('pay-finalize')
  async finalizePay(@Body() dto: any) {
    return this.dpsService.finalizePayIntent(dto);
  }

  // -------- DEVICE-FIRST BOOTSTRAP / CSR / CLAIM --------
  @Post('bootstrap')
  async bootstrap(@Body() dto: BootstrapDto): Promise<BootstrapResp> {
    this.logger.log('POST /dps/bootstrap', {
      deviceId: dto?.deviceId, model: dto?.model, fw: dto?.fwVersion,
    });
    if (!dto?.deviceId || !dto?.code) throw new BadRequestException('deviceId and code are required');

    // 1h claim code
    claimCodes.set(dto.deviceId, { code: dto.code, exp: Date.now() + 60 * 60 * 1000 });

    const token = randomBytes(24).toString('hex');
    // 10 min token
    pending.set(dto.deviceId, { token, exp: Date.now() + 10 * 60 * 1000 });

    const brokerUrl = this.dpsService.getBrokerUrl();
    return { ephemeralToken: token, brokerUrl };
  }

  @Post('csr')
  async csr(@Headers('authorization') auth: string, @Body() dto: CsrDto): Promise<CsrResp> {
    this.logger.log('POST /dps/csr', { deviceId: dto?.deviceId, model: dto?.model });

    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing Bearer token');
    if (!dto?.deviceId || !dto?.csrPem) throw new BadRequestException('deviceId and csrPem are required');

    const token = auth.slice(7);
    const rec = pending.get(dto.deviceId);
    if (!rec || rec.token !== token || rec.exp < Date.now()) {
      throw new UnauthorizedException('Token invalid or expired');
    }
    // One-time use
    pending.delete(dto.deviceId);

    // Sign CSR in-process (no openssl)
    const certificatePem = this.dpsService.signCsr(dto.csrPem);

    // Broker CA that ESP must trust (from EMQX console → “CA Certificate”)
    const brokerCaPem = (process.env.BROKER_CA_PEM || '').replace(/\\n/g, '\n');
    if (!brokerCaPem) {
      // We keep this explicit so deploys don’t silently succeed with devices failing TLS
      throw new HttpException('BROKER_CA_PEM is not set in environment', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const brokerUrl = this.dpsService.getBrokerUrl();

    // ensure DB row for immediate ingest visibility
    await this.dpsService.ensureDeviceRecord(dto.deviceId, certificatePem, { model: dto.model });

    return { certificatePem, brokerCaPem, brokerUrl };
  }

  @Post('claim')
  async claim(@Body() body: { deviceId: string; code: string; sellerPubkey: string }): Promise<ClaimResp> {
    this.logger.log('POST /dps/claim', { deviceId: body?.deviceId, sellerPubkey: body?.sellerPubkey });
    if (!body?.deviceId || !body?.code || !body?.sellerPubkey)
      throw new BadRequestException('deviceId, code, sellerPubkey required');

    const rec = claimCodes.get(body.deviceId);
    if (!rec || rec.code !== body.code || rec.exp < Date.now())
      throw new UnauthorizedException('Claim code invalid or expired');

    try { new PublicKey(body.sellerPubkey); } catch { throw new BadRequestException('sellerPubkey is not a valid base58 public key'); }

    await this.dpsService.assignSeller(body.deviceId, body.sellerPubkey);
    claimCodes.delete(body.deviceId);
    return { ok: true };
  }

  @Post('enroll-hw')
  async enrollHardware(@Body() body: HwEnrollDto): Promise<HwEnrollResponse> {
    this.logger.log('POST /dps/enroll-hw', {
      model: body?.metadata?.model, deviceName: body?.metadata?.deviceName,
    });
    if (!body?.csrPem || !body?.metadata) throw new HttpException('csrPem and metadata required', HttpStatus.BAD_REQUEST);
    try {
      return await this.dpsService.enrollHardware(body.csrPem, body.metadata);
    } catch (err: any) {
      this.logger.error('enroll-hw -> FAIL', { err: err?.message });
      throw new HttpException(err.message || 'Hardware enrollment failed', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Device reports metadata (idempotent)
  @Post('metadata')
  @HttpCode(HttpStatus.CREATED)
  async reportMetadata(@Body() body: any) {
    const deviceId: string = body?.deviceId;
    if (!deviceId) throw new BadRequestException('deviceId required');

    const doc = await this.deviceModel.findOne({ deviceId }).lean().exec();
    const prev = doc?.metadata || {};
    const merged = { ...prev, ...body, deviceId };

    const metadataCid = await this.walrus.uploadMetadata(merged);
    await this.deviceModel.updateOne({ deviceId }, { $set: { metadataCid, metadata: merged } }, { upsert: true }).exec();

    this.logger.log('metadata -> OK', { deviceId, metadataCid });
    return { ok: true, metadataCid };
  }
}
