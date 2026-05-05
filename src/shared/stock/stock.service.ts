import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  ESymbolHistoryInterval,
  IGlobalGoldResponse,
  ILocalGoldResponse,
  ISymbolHistory,
  ISymbolHistoryFilter,
  ISymbolName,
  PriceBoardItem,
} from './interfaces';

@Injectable()
export class StockApiService {
  private readonly logger = new Logger(StockApiService.name);
  private readonly client = axios.create({
    baseURL: process.env.STOCK_API_URL || 'http://localhost:8000',
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

  public async listSymbols() {
    const url = `/listing`;
    const response = await this.client.get<{
      data: ISymbolName[];
      source: string;
    }>(url);

    return response.data.data;
  }

  public async checkExist(symbols: string[]) {
    const response = await this.listSymbols();
    const existMap: { [symbol: string]: ISymbolName } = {};

    symbols.forEach((symbol) => {
      existMap[symbol] = response.find(
        (item) => item.symbol === symbol && item.organ_name !== '',
      );
    });

    return existMap;
  }

  public async getHistoricalData(symbol: string, filter: ISymbolHistoryFilter) {
    const url = `/quote/history/${symbol}`;

    const response = await this.client.get<{
      data: ISymbolHistory[];
      interval: ESymbolHistoryInterval;
      source: string;
      symbol: string;
    }>(url, {
      params: filter,
    });

    return response.data.data;
  }

  public async getLocalGold(): Promise<ILocalGoldResponse> {
    const response = await this.client.get<ILocalGoldResponse>('/gold/local');
    return response.data;
  }

  public async getGlobalGold(): Promise<IGlobalGoldResponse> {
    const response = await this.client.get<IGlobalGoldResponse>('/gold/global');
    return response.data;
  }
}
