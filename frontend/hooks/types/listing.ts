

export enum ListingStatus {
    Pending = 0,
    Active = 1,
    Cancelled = 2,
    Sold = 3,
  }
  
  export interface Listing {
    sellerPubkey: any;
    dataCid: any;
    _id: string;
    listingId: string;
    deviceId: string;
    pricePerUnit: number;
    totalDataUnits: number;
    expiresAt?: number | null;
    txSignature?: string;
    status: ListingStatus;
    createdAt: string;
    updatedAt: string;
    deviceMetadata?: {
      deviceName: string;
      model: string;
      location: { city: string; latitude: number; longitude: number };
      dataTypes: { type: string; units: string; frequency: string }[];
    };
  }

