import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PriceBoardItem } from './interfaces';

@Injectable()
export class StockApiService {
  private readonly logger = new Logger(StockApiService.name);
  private readonly client = axios.create({
    baseURL: 'http://localhost:8000',
    timeout: 30000,
  });
  
  constructor() {}

  public async getPriceBoard(symbols: string[]): Promise<PriceBoardItem[]> {
    const url = `/price-board`;
    const response = await this.client.get<{
      data: PriceBoardItem[];
      source: string;
      symbols: string[];
    }>(url, {
      params: { symbols: symbols.join(',') },
    });
    return response.data.data;
  }
}
