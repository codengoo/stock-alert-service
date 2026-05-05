import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DiscordInteractionService } from '../discord/discord-interaction.service';
import { WatchedSymbol, WatchedSymbolDocument } from '../schemas/watched-symbol.schema';
import { CreateWatchedSymbolDto } from './dto/create-watched-symbol.dto';
import { SNOOZE_DURATION_MS, SNOOZE_LABEL, SnoozeDuration } from './dto/snooze-symbol.dto';
import { UpdateWatchedSymbolDto } from './dto/update-watched-symbol.dto';

@Injectable()
export class WatchedSymbolService implements OnModuleInit {
  constructor(
    @InjectModel(WatchedSymbol.name)
    private readonly watchedSymbolModel: Model<WatchedSymbolDocument>,
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly auditLogService: AuditLogService,
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
      await this.auditLogService.log({
        action: 'snooze',
        collection: 'watched_symbols',
        target: symbol.toUpperCase(),
        after: { snoozeUntil, duration: durationValue },
        meta: { source: 'discord' },
      });

      const label = SNOOZE_LABEL[durationValue] ?? durationValue;
      await interaction.reply({
        content: `⏸ Đã snooze cảnh báo **${symbol}** trong **${label}** (đến ${snoozeUntil.toLocaleString('vi-VN')}).`,
        ephemeral: true,
      });
    });
  }

  async create(dto: CreateWatchedSymbolDto): Promise<WatchedSymbol> {
    const symbol = dto.symbol.toUpperCase();
    const existing = await this.watchedSymbolModel
      .findOne({ symbol })
      .lean()
      .exec();
    const result = await this.watchedSymbolModel
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
            expectBuyPrice: dto.expectBuyPrice ?? null,
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
    await this.auditLogService.log({
      action: existing ? 'update' : 'create',
      collection: 'watched_symbols',
      target: symbol,
      before: existing ? (existing as unknown as Record<string, unknown>) : undefined,
      after: result as unknown as Record<string, unknown>,
    });
    return result;
  }

  async findAll(): Promise<WatchedSymbol[]> {
    const docs = await this.watchedSymbolModel.find().lean().exec();
    await this.auditLogService.log({
      action: 'list',
      collection: 'watched_symbols',
      meta: { count: docs.length },
    });
    return docs;
  }

  async findOneOrNull(symbol: string): Promise<WatchedSymbol | null> {
    return this.watchedSymbolModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();
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
    if ('expectBuyPrice' in dto) updateFields.expectBuyPrice = dto.expectBuyPrice ?? null;

    const before = await this.watchedSymbolModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();
    const doc = await this.watchedSymbolModel
      .findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { $set: updateFields },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) throw new NotFoundException(`Symbol ${symbol} not found`);
    await this.auditLogService.log({
      action: 'update',
      collection: 'watched_symbols',
      target: symbol.toUpperCase(),
      before: before ? (before as unknown as Record<string, unknown>) : undefined,
      after: doc as unknown as Record<string, unknown>,
    });
    return doc;
  }

  async remove(symbol: string): Promise<void> {
    const before = await this.watchedSymbolModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();
    const result = await this.watchedSymbolModel
      .deleteOne({ symbol: symbol.toUpperCase() })
      .exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Symbol ${symbol} not found`);
    await this.auditLogService.log({
      action: 'delete',
      collection: 'watched_symbols',
      target: symbol.toUpperCase(),
      before: before ? (before as unknown as Record<string, unknown>) : undefined,
    });
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
    await this.auditLogService.log({
      action: 'snooze',
      collection: 'watched_symbols',
      target: symbol.toUpperCase(),
      after: { snoozeUntil, duration },
    });
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
    await this.auditLogService.log({
      action: 'clear_snooze',
      collection: 'watched_symbols',
      target: symbol.toUpperCase(),
    });
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
