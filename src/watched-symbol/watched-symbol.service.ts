import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WatchedSymbol, WatchedSymbolDocument } from '../schemas/watched-symbol.schema';
import { DiscordInteractionService } from '../discord/discord-interaction.service';
import { CreateWatchedSymbolDto } from './dto/create-watched-symbol.dto';
import { SNOOZE_DURATION_MS, SNOOZE_LABEL, SnoozeDuration } from './dto/snooze-symbol.dto';
import { UpdateWatchedSymbolDto } from './dto/update-watched-symbol.dto';

@Injectable()
export class WatchedSymbolService implements OnModuleInit {
  constructor(
    @InjectModel(WatchedSymbol.name)
    private readonly watchedSymbolModel: Model<WatchedSymbolDocument>,
    private readonly discordInteractionService: DiscordInteractionService,
  ) {}

  onModuleInit() {
    // Register the snooze select-menu interaction handler.
    // customId format: `snooze:<SYMBOL>`
    this.discordInteractionService.register('snooze', async (interaction) => {
      const symbol = interaction.customId.split(':')[1];
      if (!symbol) return;

      const durationValue = interaction.values[0] as SnoozeDuration;
      const ms = SNOOZE_DURATION_MS[durationValue];
      if (!ms) return;

      const snoozeUntil = new Date(Date.now() + ms);
      await this.watchedSymbolModel.updateOne(
        { symbol: symbol.toUpperCase() },
        { $set: { snoozeUntil } },
      );

      const label = SNOOZE_LABEL[durationValue] ?? durationValue;
      await interaction.reply({
        content: `⏸ Đã snooze cảnh báo **${symbol}** trong **${label}** (đến ${snoozeUntil.toLocaleString('vi-VN')}).`,
        ephemeral: true,
      });
    });
  }

  async create(dto: CreateWatchedSymbolDto): Promise<WatchedSymbol> {
    const symbol = dto.symbol.toUpperCase();
    return this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol },
        {
          $set: {
            active: dto.active ?? true,
            note: dto.note ?? null,
            alertThresholdPercent: dto.alertThresholdPercent ?? null,
            stopLossPercent: dto.stopLossPercent ?? null,
            takeProfitPercent: dto.takeProfitPercent ?? null,
            buyPrice: dto.buyPrice ?? null,
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }

  async findAll(): Promise<WatchedSymbol[]> {
    return this.watchedSymbolModel.find().lean().exec();
  }

  async findOne(symbol: string): Promise<WatchedSymbol> {
    const doc = await this.watchedSymbolModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Symbol ${symbol} not found`);
    return doc;
  }

  async update(symbol: string, dto: UpdateWatchedSymbolDto): Promise<WatchedSymbol> {
    const updateFields: Record<string, unknown> = {};
    if (dto.active !== undefined) updateFields.active = dto.active;
    if (dto.note !== undefined) updateFields.note = dto.note;
    if ('alertThresholdPercent' in dto) updateFields.alertThresholdPercent = dto.alertThresholdPercent ?? null;
    if ('stopLossPercent' in dto) updateFields.stopLossPercent = dto.stopLossPercent ?? null;
    if ('takeProfitPercent' in dto) updateFields.takeProfitPercent = dto.takeProfitPercent ?? null;
    if ('buyPrice' in dto) updateFields.buyPrice = dto.buyPrice ?? null;

    const doc = await this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { $set: updateFields },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Symbol ${symbol} not found`);
    return doc;
  }

  async remove(symbol: string): Promise<void> {
    const result = await this.watchedSymbolModel
      .deleteOne({ symbol: symbol.toUpperCase() })
      .exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Symbol ${symbol} not found`);
  }

  async snooze(symbol: string, duration: SnoozeDuration): Promise<WatchedSymbol> {
    const ms = SNOOZE_DURATION_MS[duration];
    const snoozeUntil = new Date(Date.now() + ms);
    const doc = await this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { $set: { snoozeUntil } },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Symbol ${symbol} not found`);
    return doc;
  }

  async clearSnooze(symbol: string): Promise<WatchedSymbol> {
    const doc = await this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { $set: { snoozeUntil: null } },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Symbol ${symbol} not found`);
    return doc;
  }

  /** Find all active, non-snoozed symbols (used by the cron scanner) */
  async findAllActive(): Promise<WatchedSymbolDocument[]> {
    const now = new Date();
    return this.watchedSymbolModel
      .find({
        active: true,
        $or: [{ snoozeUntil: null }, { snoozeUntil: { $lte: now } }],
      })
      .lean()
      .exec();
  }

  /**
   * Apply a minimum auto-snooze after sending an alert.
   * Will not overwrite a longer user-set snooze.
   */
  async autoSnooze(symbol: string, until: Date): Promise<void> {
    await this.watchedSymbolModel.updateOne(
      {
        symbol: symbol.toUpperCase(),
        $or: [{ snoozeUntil: null }, { snoozeUntil: { $lt: until } }],
      },
      { $set: { snoozeUntil: until } },
    );
  }
}
