import { WatchedSymbolService } from '@/watched-symbol/watched-symbol.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
} from 'discord.js';
import { DiscordInteractionService } from '../discord-interaction.service';
import { DiscordService } from '../discord.service';

@Injectable()
export class SymbolSlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(SymbolSlashCommandService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly watchedSymbolService: WatchedSymbolService,
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
                required: true,
                min_value: 0,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'stop_loss',
                description: 'Ngưỡng cắt lỗ % (bỏ qua = dùng mặc định hệ thống)',
                required: false,
                min_value: 0,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'take_profit',
                description: 'Ngưỡng chốt lời % (bỏ qua = dùng mặc định hệ thống)',
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
        ],
      },
    ]);

    // ── Đăng ký handler xử lý tương tác ──────────────────────────────────
    this.discordInteractionService.registerSlashHandler('symbol', (i) =>
      this.handleSymbolCommand(i),
    );
  }

  // ─── Dispatcher ──────────────────────────────────────────────────────────

  private async handleSymbolCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      await this.handleAdd(interaction);
    } else if (sub === 'remove') {
      await this.handleRemove(interaction);
    }
  }

  // ─── /symbol add ─────────────────────────────────────────────────────────

  private async handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const symbol = interaction.options.getString('symbol', true).toUpperCase();
    const buyPrice = interaction.options.getNumber('buy_price', true);
    const stopLoss = interaction.options.getNumber('stop_loss') ?? undefined;
    const takeProfit = interaction.options.getNumber('take_profit') ?? undefined;

    try {
      await this.watchedSymbolService.create({
        symbol,
        buyPrice,
        stopLossPercent: stopLoss ?? null,
        takeProfitPercent: takeProfit ?? null,
      });

      const lines: string[] = [
        `✅ Đã thêm **${symbol}** vào danh sách theo dõi.`,
        `💰 Giá mua: **${buyPrice.toLocaleString('vi-VN')}**`,
      ];
      if (stopLoss != null) lines.push(`🔴 Cắt lỗ: **${stopLoss}%**`);
      if (takeProfit != null) lines.push(`🟢 Chốt lời: **${takeProfit}%**`);

      await interaction.editReply(lines.join('\n'));
    } catch (err) {
      this.logger.error(`Failed to add symbol ${symbol}`, err);
      await interaction.editReply(
        `❌ Không thể thêm **${symbol}**: ${err instanceof Error ? err.message : 'Lỗi không xác định.'}`,
      );
    }
  }

  // ─── /symbol remove ───────────────────────────────────────────────────────

  private async handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const symbol = interaction.options.getString('symbol', true).toUpperCase();

    try {
      await this.watchedSymbolService.remove(symbol);
      await interaction.editReply(`🗑️ Đã xóa **${symbol}** khỏi danh sách theo dõi.`);
    } catch (err) {
      this.logger.error(`Failed to remove symbol ${symbol}`, err);
      await interaction.editReply(`❌ Không tìm thấy **${symbol}** trong danh sách.`);
    }
  }
}
