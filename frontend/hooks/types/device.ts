// types/device.ts
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
  
  export interface DeviceRecord {
    _id: string;
    deviceId: string;
    token: string;
    sellerPubkey: string;
    metadataCid: string;
    metadata: EnrollMetadata;
    unsignedTx?: string | null;
    txSignature?: string | null;
    lastSeen?: Date | null;
    latestDataCid?: string | null;
    certificatePem: string;
    status?: string;
  }