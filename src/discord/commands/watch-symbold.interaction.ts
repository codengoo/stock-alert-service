import { SettingsService } from '@/settings/settings.service';
import { StockApiService } from '@/shared/stock/stock.service';
import { WatchedSymbolService } from '@/watched-symbol/watched-symbol.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
} from 'discord.js';
import { DiscordInteractionService } from '../discord-interaction.service';
import { DiscordService } from '../discord.service';
import { buildTable } from '../utils/table.util';

@Injectable()
export class SymbolSlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(SymbolSlashCommandService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly watchedSymbolService: WatchedSymbolService,
    private readonly stockApiService: StockApiService,
    private readonly settingsService: SettingsService,
  ) {}

  onModuleInit() {
    // ── Đăng ký định nghĩa slash command với Discord API ─────────────────
    this.discordService.registerApplicationCommands([
      {
        type: ApplicationCommandType.ChatInput,
        name: 'symbol',
        description: 'Quản lý danh sách cổ phiếu theo dõi',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'add',
            description: 'Thêm hoặc cập nhật cổ phiếu theo dõi',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'symbol',
                description: 'Mã cổ phiếu (VD: VCB)',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'buy_price',
                description: 'Giá mua tham chiếu',
                required: false,
                min_value: 0,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'stop_loss',
                description:
                  'Ngưỡng cắt lỗ % (bỏ qua = dùng mặc định hệ thống)',
                required: false,
                min_value: 0,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'take_profit',
                description:
                  'Ngưỡng chốt lời % (bỏ qua = dùng mặc định hệ thống)',
                required: false,
                min_value: 0,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'expect_buy_price',
                description:
                  'Giá kỳ vọng mua vào (×1000) — nhận tín hiệu mua khi giá ≤ mức này (bỏ qua = không theo dõi)',
                required: false,
                min_value: 0,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'remove',
            description: 'Xóa cổ phiếu khỏi danh sách theo dõi',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'symbol',
                description: 'Mã cổ phiếu cần xóa (VD: VCB)',
                required: true,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: 'Liệt kê danh sách cổ phiếu đang theo dõi',
          },
        ],
      },
    ]);

    // ── Đăng ký handler xử lý tương tác ──────────────────────────────────
    this.discordInteractionService.registerSlashHandler('symbol', (i) =>
      this.handleSymbolCommand(i),
    );
  }

  // ─── Dispatcher ──────────────────────────────────────────────────────────

  private async handleSymbolCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      await this.handleAdd(interaction);
    } else if (sub === 'remove') {
      await this.handleRemove(interaction);
    } else if (sub === 'list') {
      await this.handleList(interaction);
    }
  }

  // ─── /symbol add ─────────────────────────────────────────────────────────

  private async handleAdd(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const symbol = interaction.options.getString('symbol', true).toUpperCase();
    const buyPriceRaw = interaction.options.getNumber('buy_price');
    const buyPrice = buyPriceRaw != null ? buyPriceRaw * 1000 : null;
    const stopLoss = interaction.options.getNumber('stop_loss') ?? undefined;
    const takeProfit =
      interaction.options.getNumber('take_profit') ?? undefined;
    const expectBuyPriceRaw = interaction.options.getNumber('expect_buy_price');
    const expectBuyPrice =
      expectBuyPriceRaw != null ? expectBuyPriceRaw * 1000 : null;

    try {
      // Kiểm tra symbol có tồn tại trên sàn không
      const existMap = await this.stockApiService.checkExist([symbol]);
      if (!existMap[symbol]) {
        await interaction.editReply(
          `❌ Mã **${symbol}** không tồn tại hoặc không có dữ liệu giá.`,
        );
        return;
      }

      const existing = await this.watchedSymbolService.findOneOrNull(symbol);
      const isUpdate = existing != null;

      if (isUpdate) {
        // Chỉ update những trường được truyền vào
        const dto: Record<string, unknown> = {};
        if (buyPrice !== null) dto.buyPrice = buyPrice;
        if (stopLoss !== undefined) dto.stopLossPercent = stopLoss;
        if (takeProfit !== undefined) dto.takeProfitPercent = takeProfit;
        if (expectBuyPrice !== null) dto.expectBuyPrice = expectBuyPrice;
        await this.watchedSymbolService.update(symbol, dto);
      } else {
        await this.watchedSymbolService.create({
          symbol,
          buyPrice,
          stopLossPercent: stopLoss ?? null,
          takeProfitPercent: takeProfit ?? null,
          expectBuyPrice: expectBuyPrice,
        });
      }

      const verb = isUpdate ? 'Đã cập nhật' : 'Đã thêm';
      const lines: string[] = [
        `✅ ${verb} **${symbol}** (${existMap[symbol].organ_name}) vào danh sách theo dõi.`,
      ];
      if (buyPrice != null)
        lines.push(
          `💰 Giá mua: **${buyPrice.toLocaleString('vi-VN')}** (${buyPriceRaw!.toLocaleString('vi-VN')} × 1000)`,
        );
      if (stopLoss != null)
        lines.push(
          stopLoss === 0
            ? `🔴 Cắt lỗ: **tắt** (bỏ qua cảnh báo cắt lỗ)`
            : `🔴 Cắt lỗ: **${stopLoss}%**`,
        );
      if (takeProfit != null)
        lines.push(
          takeProfit === 0
            ? `🟢 Chốt lời: **tắt** (bỏ qua cảnh báo chốt lời)`
            : `🟢 Chốt lời: **${takeProfit}%**`,
        );
      if (expectBuyPriceRaw != null)
        lines.push(
          `🔵 Giá kỳ vọng mua: **${expectBuyPrice!.toLocaleString('vi-VN')}** (${expectBuyPriceRaw.toLocaleString('vi-VN')} × 1000)`,
        );

      await interaction.editReply(lines.join('\n'));
    } catch (err) {
      this.logger.error(`Failed to add symbol ${symbol}`, err);
      await interaction.editReply(
        `❌ Không thể thêm **${symbol}**: ${err instanceof Error ? err.message : 'Lỗi không xác định.'}`,
      );
    }
  }

  // ─── /symbol list ────────────────────────────────────────────────────────

  private async handleList(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const symbols = await this.watchedSymbolService.findAll();

    if (symbols.length === 0) {
      await interaction.editReply('📭 Danh sách theo dõi đang trống.');
      return;
    }

    const sorted = [...symbols].sort((a, b) => a.symbol.localeCompare(b.symbol));

    const [thresholds, priceBoard] = await Promise.all([
      this.settingsService.getThresholdSettings(),
      this.stockApiService.getPriceBoard(sorted.map((s) => s.symbol)),
    ]);

    const priceMap = new Map(priceBoard.map((p) => [p.symbol, p.close_price]));

    const resolvePercent = (
      symbolVal: number | null | undefined,
      globalVal: number,
    ): string => {
      const val = symbolVal ?? globalVal;
      return val === 0 ? '/' : `${val}%`;
    };

    const fmt = (val: number | null | undefined) =>
      val != null ? (val / 1000).toLocaleString('vi-VN') : '-';

    const fmtPrice = (val: number | undefined) =>
      val != null ? (val / 1000).toLocaleString('vi-VN') : '-';

    const headers = ['CP', 'Stop loss', 'Take profit', 'Expect price', 'Buy price', 'Current price'];
    const rows = sorted.map((s) => [
      s.symbol,
      resolvePercent(s.stopLossPercent, thresholds.stopLossPercent),
      resolvePercent(s.takeProfitPercent, thresholds.takeProfitPercent),
      fmt(s.expectBuyPrice),
      fmt(s.buyPrice),
      fmtPrice(priceMap.get(s.symbol)),
    ]);

    const table = ['```', buildTable(headers, rows), '```'].join('\n');
    await interaction.editReply(`📋 **Danh sách cổ phiếu theo dõi (${sorted.length})**\n${table}`);
  }

  // ─── /symbol remove ───────────────────────────────────────────────────────

  private async handleRemove(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const symbol = interaction.options.getString('symbol', true).toUpperCase();

    try {
      await this.watchedSymbolService.remove(symbol);
      await interaction.editReply(
        `🗑️ Đã xóa **${symbol}** khỏi danh sách theo dõi.`,
      );
    } catch (err) {
      this.logger.error(`Failed to remove symbol ${symbol}`, err);
      await interaction.editReply(
        `❌ Không tìm thấy **${symbol}** trong danh sách.`,
      );
    }
  }
}
