import { Injectable, Logger } from '@nestjs/common';

import { PriceBoardItem, StockApiService } from '@/shared/stock';
import { Cron } from '@nestjs/schedule';
import {
  ActionRowBuilder,
  MessageCreateOptions,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { DiscordService } from '../discord/discord.service';
import { SettingsService } from '../settings/settings.service';
import { SNOOZE_OPTIONS } from '../watched-symbol/dto/snooze-symbol.dto';
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
      if (isNaN(currentPrice)) continue;

      if (watchedEntry.snoozeUntil && watchedEntry.snoozeUntil > new Date()) {
        this.logger.debug(
          `Skipping ${sym} due to active snooze until ${watchedEntry.snoozeUntil.toISOString()}`,
        );
        continue;
      }

      // ── Stop-loss / take-profit — chỉ chạy khi có buyPrice ───────────────
      if (watchedEntry.buyPrice != null) {
        const referencePrice = Number(watchedEntry.buyPrice);
        const pctChange =
          ((currentPrice - referencePrice) / referencePrice) * 100;

        const lowerBound =
          watchedEntry.stopLossPercent ?? globalThresholds.stopLossPercent;
        const upperBound =
          watchedEntry.takeProfitPercent ?? globalThresholds.takeProfitPercent;

        if (pctChange < -lowerBound || pctChange > upperBound) {
          const discordSettings = await this.settingsService.getDiscordSettings();
          const channelId = discordSettings.alertChannelId;
          const isStopLoss = pctChange < -lowerBound;

          if (channelId) {
            const embed = await this.buildAlertEmbed(
              sym,
              currentPrice,
              referencePrice,
              pctChange,
              isStopLoss,
              lowerBound,
              upperBound,
            );

            const components = await this.buildSnoozeMenu(sym);
            const payload: MessageCreateOptions = {
              embeds: [embed],
              components: [components],
            };
            await this.discordService.sendMessage(channelId, payload);
          } else {
            this.logger.warn(
              `discord.alertChannelId chưa được cấu hình — bỏ qua cảnh báo cho ${sym}.`,
            );
          }

          const snoozeUntil = new Date(Date.now() + AUTO_SNOOZE_MS);
          await this.watchedSymbolService.autoSnooze(sym, snoozeUntil);

          this.logger.log(
            `Alert fired for ${sym}: ${pctChange.toFixed(2)}% (${isStopLoss ? 'stop-loss' : 'take-profit'}). Auto-snoozed until ${snoozeUntil.toISOString()}.`,
          );
        }
      }

      // ── Buy-signal check ─────────────────────────────────────────────────
      const expectBuyPrice = watchedEntry.expectBuyPrice;
      if (
        expectBuyPrice != null &&
        !isNaN(expectBuyPrice) &&
        currentPrice <= expectBuyPrice
      ) {
        const discordSettings = await this.settingsService.getDiscordSettings();
        const channelId = discordSettings.alertChannelId;

        if (channelId) {
          const embed = this.buildBuySignalEmbed(sym, currentPrice, expectBuyPrice);
          const components = await this.buildSnoozeMenu(sym);
          await this.discordService.sendMessage(channelId, {
            embeds: [embed],
            components: [components],
          });
        } else {
          this.logger.warn(
            `discord.alertChannelId chưa được cấu hình — bỏ qua tín hiệu mua cho ${sym}.`,
          );
        }

        const snoozeUntil = new Date(Date.now() + AUTO_SNOOZE_MS);
        await this.watchedSymbolService.autoSnooze(sym, snoozeUntil);

        this.logger.log(
          `Buy signal fired for ${sym}: currentPrice=${currentPrice} <= expectBuyPrice=${expectBuyPrice}. Auto-snoozed until ${snoozeUntil.toISOString()}.`,
        );
      }
    }
  }

  private async buildAlertEmbed(
    symbol: string,
    currentPrice: number,
    referencePrice: number,
    pctChange: number,
    isStopLoss: boolean,
    lowerBound: number,
    upperBound: number,
  ) {
    const alertLabel = isStopLoss
      ? '🔴 Cảnh báo Cắt Lỗ'
      : '🟢 Cảnh báo Chốt Lời';

    return {
      title: `${alertLabel}: ${symbol}`,
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
      ],
      footer: { text: 'Stock Alert Service' },
      timestamp: new Date().toISOString(),
    };
  }

  private buildBuySignalEmbed(
    symbol: string,
    currentPrice: number,
    expectBuyPrice: number,
  ) {
    return {
      title: `🔵 Tín hiệu Mua: ${symbol}`,
      color: 0x3498db,
      fields: [
        {
          name: 'Giá hiện tại',
          value: currentPrice.toLocaleString('vi-VN'),
          inline: true,
        },
        {
          name: 'Giá kỳ vọng mua',
          value: expectBuyPrice.toLocaleString('vi-VN'),
          inline: true,
        },
      ],
      footer: { text: 'Stock Alert Service' },
      timestamp: new Date().toISOString(),
    };
  }

  private async buildSnoozeMenu(symbol: string) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`snooze:${symbol}`)
        .setPlaceholder('⏸  Snooze cảnh báo...')
        .addOptions(
          SNOOZE_OPTIONS.map((o) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(o.label)
              .setValue(o.value)
              .setDescription(o.description),
          ),
        ),
    );
  }
}
