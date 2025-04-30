import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WalrusService {
  private walrusUrl: string;

  constructor(private configService: ConfigService) {
    this.walrusUrl = this.configService.get<string>('WALRUS_URL');
  }

  async uploadMetadata(metadata: any): Promise<string> {
    const response = await axios.post(`${this.walrusUrl}/upload/metadata`, metadata);
    return response.data.cid; // Assuming Walrus returns a CID
  }

  async uploadData(data: Buffer): Promise<string> {
    const response = await axios.post(`${this.walrusUrl}/upload/data`, data, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    return response.data.cid;
  }

  async getMetadata(cid: string): Promise<any> {
    const response = await axios.get(`${this.walrusUrl}/metadata/${cid}`);
    return response.data;
  }
}