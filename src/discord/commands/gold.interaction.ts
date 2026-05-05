import { GoldAlertService } from '@/gold/gold-alert.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
} from 'discord.js';
import { DiscordInteractionService } from '../discord-interaction.service';
import { DiscordService } from '../discord.service';

@Injectable()
export class GoldSlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(GoldSlashCommandService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly goldAlertService: GoldAlertService,
  ) {}

  onModuleInit() {
    this.discordService.registerApplicationCommands([
      {
        type: ApplicationCommandType.ChatInput,
        name: 'gold',
        description: 'Thông tin giá vàng',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: 'Xem giá vàng trong nước và thế giới ngay bây giờ',
          },
        ],
      },
    ]);

    this.discordInteractionService.registerSlashHandler('gold', (i) =>
      this.handleGoldCommand(i),
    );
  }

  private async handleGoldCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      await this.handleList(interaction);
    }
  }

  private async handleList(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const embeds = await this.goldAlertService.buildGoldEmbeds();

      if (embeds.length === 0) {
        await interaction.editReply('⚠️ Không lấy được dữ liệu giá vàng. Vui lòng thử lại sau.');
        return;
      }

      await interaction.editReply({ embeds });
    } catch (err) {
      this.logger.error('Failed to fetch gold prices for slash command', err);
      await interaction.editReply('❌ Đã xảy ra lỗi khi lấy dữ liệu giá vàng.');
    }
  }
}
