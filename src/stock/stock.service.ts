import { Injectable, Logger } from '@nestjs/common';

import { PriceBoardItem, StockApiService } from '@/shared/stock';
import { Cron } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';
import { DiscordEmbed, DiscordService } from '../shared/discord/discord.service';
import { WatchedSymbolService } from '../watched-symbol/watched-symbol.service';

/** Minimum auto-snooze applied after any alert fires (prevents per-minute spam) */
const AUTO_SNOOZE_MS = 5 * 60_000;

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly settingsService: SettingsService,
    private readonly watchedSymbolService: WatchedSymbolService,
    private readonly stockApiService: StockApiService,
  ) {}

  // ─── Scheduled price-alert job ────────────────────────────────────────────
  /** Runs every minute during trading hours (Mon–Fri, 09:00–15:30 ICT = 02:00–08:30 UTC) */
  @Cron('*/1 9-11,13-15 * * 1-5')
  async checkPriceAlerts() {
    this.logger.debug('Running scheduled price alert check...');
    const activeSymbols = await this.watchedSymbolService.findAllActive();
    if (activeSymbols.length === 0) return;

    const symbolNames = activeSymbols.map((s) => s.symbol);
    const board = await this.stockApiService.getPriceBoard(symbolNames);

    const items: PriceBoardItem[] = board ?? [];
    if (!items.length) return;

    // Load global threshold defaults once per cron tick
    const globalThresholds = await this.settingsService.getThresholdSettings();

    for (const item of items) {
      const sym = item.symbol.toUpperCase();
      const watchedEntry = activeSymbols.find((s) => s.symbol === sym);
      if (!watchedEntry) continue;

      const currentPrice = Number(item.close_price);
      const referencePrice = Number(watchedEntry.buyPrice);
      if (isNaN(currentPrice) || isNaN(referencePrice)) continue;
      const pctChange =
        ((currentPrice - referencePrice) / referencePrice) * 100;

      const lowerBound =
        watchedEntry.stopLossPercent ?? globalThresholds.stopLossPercent;
      const upperBound =
        watchedEntry.takeProfitPercent ?? globalThresholds.takeProfitPercent;

      if (watchedEntry.snoozeUntil && watchedEntry.snoozeUntil > new Date()) {
        this.logger.debug(
          `Skipping ${sym} due to active snooze until ${watchedEntry.snoozeUntil.toISOString()}`,
        );
        continue;
      }

      if (pctChange < -lowerBound || pctChange > upperBound) {
        const isStopLoss = pctChange < -lowerBound;
        const alertLabel = isStopLoss ? '🔴 Cảnh báo Cắt Lỗ' : '🟢 Cảnh báo Chốt Lời';

        const embed: DiscordEmbed = {
          title: `${alertLabel}: ${sym}`,
          color: isStopLoss ? 0xe74c3c : 0x2ecc71,
          fields: [
            {
              name: 'Giá hiện tại',
              value: currentPrice.toLocaleString('vi-VN'),
              inline: true,
            },
            {
              name: 'Giá mua',
              value: referencePrice.toLocaleString('vi-VN'),
              inline: true,
            },
            {
              name: 'Thay đổi',
              value: `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`,
              inline: true,
            },
            {
              name: 'Ngưỡng',
              value: isStopLoss ? `-${lowerBound}%` : `+${upperBound}%`,
              inline: true,
            },
            ...(watchedEntry.note
              ? [{ name: 'Ghi chú', value: watchedEntry.note, inline: false }]
              : []),
          ],
          footer: { text: 'Stock Alert Service' },
          timestamp: new Date().toISOString(),
        };

        const discordSettings = await this.settingsService.getDiscordSettings();
        const channelId = discordSettings.alertChannelId;

        if (channelId) {
          await this.discordService.sendAlertWithSnooze(channelId, embed, sym);
        } else {
          this.logger.warn(
            `discord.alertChannelId chưa được cấu hình — bỏ qua cảnh báo cho ${sym}.`,
          );
        }

        // Áp dụng auto-snooze tối thiểu để tránh spam mỗi phút
        const snoozeUntil = new Date(Date.now() + AUTO_SNOOZE_MS);
        await this.watchedSymbolService.autoSnooze(sym, snoozeUntil);

        this.logger.log(
          `Alert fired for ${sym}: ${pctChange.toFixed(2)}% (${isStopLoss ? 'stop-loss' : 'take-profit'}). Auto-snoozed until ${snoozeUntil.toISOString()}.`,
        );
      }
    }
  }
}
