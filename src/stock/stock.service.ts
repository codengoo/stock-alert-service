import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

import { SettingsService } from '../settings/settings.service';
import { DiscordService } from '../shared/discord/discord.service';
import { WatchedSymbolService } from '../watched-symbol/watched-symbol.service';

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

/** Minimum auto-snooze applied after any alert fires (prevents per-minute spam) */
const AUTO_SNOOZE_MS = 5 * 60_000;

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  /** In-memory snapshot of the last known prices { SYMBOL -> price } */
  private lastPrices = new Map<string, number>();

  constructor(
    private readonly httpService: HttpService,
    private readonly discordService: DiscordService,
    private readonly settingsService: SettingsService,
    private readonly watchedSymbolService: WatchedSymbolService,
  ) {}

  // ─── Scheduled price-alert job ────────────────────────────────────────────

  /** Runs every minute during trading hours (Mon–Fri, 09:00–15:30 ICT = 02:00–08:30 UTC) */
  @Cron('*/1 2-8 * * 1-5')
  async checkPriceAlerts() {
    const activeSymbols = await this.watchedSymbolService.findAllActive();
    if (activeSymbols.length === 0) return;

    const symbolNames = activeSymbols.map((s) => s.symbol);

    let board: { data: PriceBoardItem[] };
    try {
      board = await this.getPriceBoard(symbolNames);
    } catch (err) {
      this.logger.error('Failed to fetch price board for alert check', err);
      return;
    }

    const items: PriceBoardItem[] = board?.data ?? [];
    if (!items.length) return;

    // Load global threshold defaults once per cron tick
    const globalThresholds = await this.settingsService.getThresholdSettings();
    const channelId = await this.settingsService.getValue('discord.alertChannelId');

    for (const item of items) {
      const sym = String(item.symbol).toUpperCase();
      const currentPrice = Number(item.price);
      const pctChange = Number(item.pct_change);

      if (isNaN(currentPrice) || isNaN(pctChange)) continue;

      const watchedEntry = activeSymbols.find((s) => s.symbol === sym);
      if (!watchedEntry) continue;

      const last = this.lastPrices.get(sym);

      // Use delta from last-known price when available; otherwise use API value
      let effectivePct = pctChange;
      if (last !== undefined && last !== 0) {
        effectivePct = ((currentPrice - last) / last) * 100;
      }

      // ── 1. Alert threshold ──────────────────────────────────────────────
      const alertThreshold =
        watchedEntry.alertThresholdPercent ?? globalThresholds.alertThresholdPercent;

      if (Math.abs(effectivePct) >= alertThreshold) {
        const direction = effectivePct >= 0 ? '📈 TĂNG' : '📉 GIẢM';
        const color = effectivePct >= 0 ? 0x00c853 : 0xd50000;
        const sign = effectivePct >= 0 ? '+' : '';

        if (channelId) {
          await this.discordService.sendAlertWithSnooze(
            channelId,
            {
              title: `${direction} — ${sym}`,
              color,
              fields: [
                { name: 'Giá hiện tại', value: `${currentPrice.toLocaleString('vi-VN')} VND`, inline: true },
                { name: '% Thay đổi', value: `${sign}${effectivePct.toFixed(2)}%`, inline: true },
                { name: 'Ngưỡng cảnh báo', value: `±${alertThreshold}%`, inline: true },
                ...(last !== undefined
                  ? [{ name: 'Giá trước', value: `${last.toLocaleString('vi-VN')} VND`, inline: true }]
                  : []),
              ],
              footer: { text: 'Stock Alert' },
              timestamp: new Date().toISOString(),
            },
            sym,
          );
        }

        this.logger.warn(`Alert: ${sym} ${sign}${effectivePct.toFixed(2)}% | price=${currentPrice}`);
        await this.watchedSymbolService.autoSnooze(sym, new Date(Date.now() + AUTO_SNOOZE_MS));
      }

      // ── 2. Stop-loss / Take-profit (only when buyPrice is configured) ───
      const buyPrice = watchedEntry.buyPrice;
      if (buyPrice && buyPrice > 0) {
        const pctFromBuy = ((currentPrice - buyPrice) / buyPrice) * 100;

        const stopLossThreshold =
          watchedEntry.stopLossPercent ?? globalThresholds.stopLossPercent;
        const takeProfitThreshold =
          watchedEntry.takeProfitPercent ?? globalThresholds.takeProfitPercent;

        if (pctFromBuy <= -stopLossThreshold) {
          if (channelId) {
            await this.discordService.sendAlertWithSnooze(
              channelId,
              {
                title: `⛔ STOP LOSS — ${sym}`,
                color: 0xb71c1c,
                fields: [
                  { name: 'Giá hiện tại', value: `${currentPrice.toLocaleString('vi-VN')} VND`, inline: true },
                  { name: 'Giá mua', value: `${buyPrice.toLocaleString('vi-VN')} VND`, inline: true },
                  { name: '% Từ giá mua', value: `${pctFromBuy.toFixed(2)}%`, inline: true },
                  { name: 'Ngưỡng stop-loss', value: `-${stopLossThreshold}%`, inline: true },
                ],
                footer: { text: 'Stock Alert — Stop Loss' },
                timestamp: new Date().toISOString(),
              },
              sym,
            );
          }
          this.logger.warn(`StopLoss: ${sym} pctFromBuy=${pctFromBuy.toFixed(2)}%`);
          await this.watchedSymbolService.autoSnooze(sym, new Date(Date.now() + AUTO_SNOOZE_MS));
        } else if (pctFromBuy >= takeProfitThreshold) {
          if (channelId) {
            await this.discordService.sendAlertWithSnooze(
              channelId,
              {
                title: `💰 TAKE PROFIT — ${sym}`,
                color: 0x1b5e20,
                fields: [
                  { name: 'Giá hiện tại', value: `${currentPrice.toLocaleString('vi-VN')} VND`, inline: true },
                  { name: 'Giá mua', value: `${buyPrice.toLocaleString('vi-VN')} VND`, inline: true },
                  { name: '% Từ giá mua', value: `+${pctFromBuy.toFixed(2)}%`, inline: true },
                  { name: 'Ngưỡng take-profit', value: `+${takeProfitThreshold}%`, inline: true },
                ],
                footer: { text: 'Stock Alert — Take Profit' },
                timestamp: new Date().toISOString(),
              },
              sym,
            );
          }
          this.logger.warn(`TakeProfit: ${sym} pctFromBuy=+${pctFromBuy.toFixed(2)}%`);
          await this.watchedSymbolService.autoSnooze(sym, new Date(Date.now() + AUTO_SNOOZE_MS));
        }
      }

      this.lastPrices.set(sym, currentPrice);
    }
  }

  /** Manual trigger for price-alert check (useful for testing) */
  async triggerPriceCheck() {
    await this.checkPriceAlerts();
    return { triggered: true };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async getPriceBoard(symbols: string[], source?: string): Promise<{ data: PriceBoardItem[] }> {
    const baseUrl = await this.settingsService.getValue('stock.apiBaseUrl');
    const defaultSource = await this.settingsService.getValue('stock.apiSource');
    const url = `${baseUrl}/price-board`;
    const response = await firstValueFrom(
      this.httpService.get<{ data: PriceBoardItem[] }>(url, {
        params: { symbols: symbols.join(','), source: source ?? defaultSource },
      }),
    );
    return response.data;
  }

  async getPriceBoardPublic(symbols: string[], source?: string) {
    return this.getPriceBoard(symbols, source);
  }

  async getIntraday(symbol: string, pageSize = 100, source?: string) {
    const baseUrl = await this.settingsService.getValue('stock.apiBaseUrl');
    const defaultSource = await this.settingsService.getValue('stock.apiSource');
    const url = `${baseUrl}/quote/intraday/${symbol.toUpperCase()}`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: { page_size: pageSize, source: source ?? defaultSource },
      }),
    );
    return response.data;
  }

  async getHistory(
    symbol: string,
    opts: { start?: string; end?: string; length?: number; interval?: string; source?: string },
  ) {
    const baseUrl = await this.settingsService.getValue('stock.apiBaseUrl');
    const defaultSource = await this.settingsService.getValue('stock.apiSource');
    const url = `${baseUrl}/quote/history/${symbol.toUpperCase()}`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        params: {
          start: opts.start,
          end: opts.end,
          length: opts.length,
          interval: opts.interval ?? 'd',
          source: opts.source ?? defaultSource,
        },
      }),
    );
    return response.data;
  }

  async getListing(source?: string) {
    const baseUrl = await this.settingsService.getValue('stock.apiBaseUrl');
    const defaultSource = await this.settingsService.getValue('stock.apiSource');
    const response = await firstValueFrom(
      this.httpService.get(`${baseUrl}/listing`, {
        params: { source: source ?? defaultSource },
      }),
    );
    return response.data;
  }

  async getCompany(symbol: string, source?: string) {
    const baseUrl = await this.settingsService.getValue('stock.apiBaseUrl');
    const defaultSource = await this.settingsService.getValue('stock.apiSource');
    const response = await firstValueFrom(
      this.httpService.get(`${baseUrl}/company/${symbol.toUpperCase()}`, {
        params: { source: source ?? defaultSource },
      }),
    );
    return response.data;
  }
}
