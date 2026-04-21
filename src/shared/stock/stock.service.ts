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

  public async checkExist(
    symbols: string[],
  ): Promise<{ [symbol: string]: boolean }> {
    const response = await this.getPriceBoard(symbols);
    const existMap: { [symbol: string]: boolean } = {};

    symbols.forEach((symbol) => {
      existMap[symbol] = response.some((item) => item.symbol === symbol && item.close_price !== 0);
    });
    
    return existMap;
  }
}
