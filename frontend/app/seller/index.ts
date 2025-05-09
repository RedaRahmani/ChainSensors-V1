// frontend/types/index.ts

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
  