import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';

import { DiscordService } from '../shared/discord/discord.service';
import { SettingsService } from '../settings/settings.service';
import { WatchedSymbol, WatchedSymbolDocument } from '../schemas/watched-symbol.schema';
import { AddWatchedSymbolDto } from './dto/add-watched-symbol.dto';

/** Keys stored in the settings collection */
const SETTING_KEYS = {
  STOCK_API_BASE_URL: 'stock.apiBaseUrl',
  STOCK_API_SOURCE: 'stock.apiSource',
  DISCORD_CHANNEL_ID: 'discord.alertChannelId',
  ALERT_THRESHOLD_PERCENT: 'stock.alertThresholdPercent',
};

interface PriceBoardItem {
  symbol: string;
  /** current price (VND) */
  price: number;
  /** reference / base price used for change calculation */
  ref_price: number;
  change: number;
  pct_change: number;
  [key: string]: unknown;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  /** In-memory snapshot of the last known prices { SYMBOL -> price } */
  private lastPrices = new Map<string, number>();

  constructor(
    @InjectModel(WatchedSymbol.name)
    private readonly watchedSymbolModel: Model<WatchedSymbolDocument>,
    private readonly httpService: HttpService,
    private readonly discordService: DiscordService,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Watched-symbol CRUD ──────────────────────────────────────────────────

  async addSymbol(dto: AddWatchedSymbolDto): Promise<WatchedSymbol> {
    const symbol = dto.symbol.toUpperCase();
    return this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol },
        { $set: { active: dto.active ?? true, note: dto.note } },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }

  async removeSymbol(symbol: string): Promise<void> {
    await this.watchedSymbolModel.deleteOne({ symbol: symbol.toUpperCase() }).exec();
  }

  async listSymbols(): Promise<WatchedSymbol[]> {
    return this.watchedSymbolModel.find().lean().exec();
  }

  async setSymbolActive(symbol: string, active: boolean): Promise<WatchedSymbol> {
    return this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { $set: { active } },
        { new: true },
      )
      .lean()
      .exec();
  }

  // ─── Price-board proxy endpoints ─────────────────────────────────────────

  async getPriceBoard(symbols: string[], source?: string) {
    const baseUrl = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_BASE_URL,
      'http://localhost:8000',
    );
    const defaultSource = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_SOURCE,
      'KBS',
    );

    const params = new URLSearchParams({
      symbols: symbols.map((s) => s.toUpperCase()).join(','),
      source: source ?? defaultSource,
    });

    const { data } = await firstValueFrom(
      this.httpService.get(`${baseUrl}/price-board?${params.toString()}`),
    );
    return data;
  }

  async getIntraday(symbol: string, pageSize = 100, source?: string) {
    const baseUrl = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_BASE_URL,
      'http://localhost:8000',
    );
    const defaultSource = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_SOURCE,
      'KBS',
    );

    const params = new URLSearchParams({
      page_size: String(pageSize),
      source: source ?? defaultSource,
    });

    const { data } = await firstValueFrom(
      this.httpService.get(
        `${baseUrl}/quote/intraday/${symbol.toUpperCase()}?${params.toString()}`,
      ),
    );
    return data;
  }

  async getHistory(
    symbol: string,
    opts: { start?: string; end?: string; length?: number; interval?: string; source?: string },
  ) {
    const baseUrl = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_BASE_URL,
      'http://localhost:8000',
    );
    const defaultSource = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_SOURCE,
      'KBS',
    );

    const params = new URLSearchParams({ source: opts.source ?? defaultSource });
    if (opts.length) params.set('length', String(opts.length));
    if (opts.start) params.set('start', opts.start);
    if (opts.end) params.set('end', opts.end);
    if (opts.interval) params.set('interval', opts.interval);

    const { data } = await firstValueFrom(
      this.httpService.get(
        `${baseUrl}/quote/history/${symbol.toUpperCase()}?${params.toString()}`,
      ),
    );
    return data;
  }

  async getListing(source?: string) {
    const baseUrl = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_BASE_URL,
      'http://localhost:8000',
    );
    const defaultSource = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_SOURCE,
      'KBS',
    );

    const params = new URLSearchParams({ source: source ?? defaultSource });
    const { data } = await firstValueFrom(
      this.httpService.get(`${baseUrl}/listing?${params.toString()}`),
    );
    return data;
  }

  async getCompany(symbol: string, source?: string) {
    const baseUrl = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_BASE_URL,
      'http://localhost:8000',
    );
    const defaultSource = await this.settingsService.getValue<string>(
      SETTING_KEYS.STOCK_API_SOURCE,
      'KBS',
    );

    const params = new URLSearchParams({ source: source ?? defaultSource });
    const { data } = await firstValueFrom(
      this.httpService.get(
        `${baseUrl}/company/${symbol.toUpperCase()}?${params.toString()}`,
      ),
    );
    return data;
  }

  // ─── Scheduled price-alert job ────────────────────────────────────────────

  /** Runs every minute during trading hours (Mon–Fri, 09:00–15:30 ICT = 02:00–08:30 UTC) */
  @Cron('*/1 2-8 * * 1-5')
  async checkPriceAlerts() {
    const activeSymbols = await this.watchedSymbolModel
      .find({ active: true })
      .lean()
      .exec();

    if (activeSymbols.length === 0) return;

    const symbols = activeSymbols.map((s) => s.symbol);

    let board: { data: PriceBoardItem[] };
    try {
      board = await this.getPriceBoard(symbols);
    } catch (err) {
      this.logger.error('Failed to fetch price board for alert check', err);
      return;
    }

    const items: PriceBoardItem[] = board?.data ?? [];
    if (!items.length) return;

    const thresholdPercent = await this.settingsService.getValue<number>(
      SETTING_KEYS.ALERT_THRESHOLD_PERCENT,
      3,
    );
    const channelId = await this.settingsService.getValue<string>(
      SETTING_KEYS.DISCORD_CHANNEL_ID,
      '',
    );

    for (const item of items) {
      const sym = String(item.symbol).toUpperCase();
      const currentPrice: number = Number(item.price);
      const pctChange: number = Number(item.pct_change);
      const absChange = Math.abs(pctChange);

      if (isNaN(currentPrice) || isNaN(pctChange)) continue;

      const last = this.lastPrices.get(sym);

      // Calculate pct change from last known price if available, otherwise use API value
      let effectivePct = pctChange;
      if (last !== undefined && last !== 0) {
        effectivePct = ((currentPrice - last) / last) * 100;
      }

      const effectiveAbs = Math.abs(effectivePct);

      if (effectiveAbs >= thresholdPercent) {
        const direction = effectivePct >= 0 ? '📈 TĂNG' : '📉 GIẢM';
        const color = effectivePct >= 0 ? 0x00c853 : 0xd50000;
        const sign = effectivePct >= 0 ? '+' : '';

        if (channelId) {
          await this.discordService.sendEmbed(channelId, {
            title: `${direction} — ${sym}`,
            color,
            fields: [
              {
                name: 'Giá hiện tại',
                value: `${currentPrice.toLocaleString('vi-VN')} VND`,
                inline: true,
              },
              {
                name: '% Thay đổi',
                value: `${sign}${effectivePct.toFixed(2)}%`,
                inline: true,
              },
              {
                name: 'Ngưỡng cảnh báo',
                value: `±${thresholdPercent}%`,
                inline: true,
              },
              ...(last !== undefined
                ? [
                    {
                      name: 'Giá trước',
                      value: `${last.toLocaleString('vi-VN')} VND`,
                      inline: true,
                    },
                  ]
                : []),
            ],
          });
        }

        this.logger.warn(
          `Alert: ${sym} ${sign}${effectivePct.toFixed(2)}% | price=${currentPrice}`,
        );
      }

      // Update last known price
      this.lastPrices.set(sym, currentPrice);
    }
  }

  /** Manual trigger for price-alert check (useful for testing) */
  async triggerPriceCheck() {
    await this.checkPriceAlerts();
    return { triggered: true };
  }
}
