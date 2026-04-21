import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StringSelectMenuInteraction } from 'discord.js';
import { DiscordService } from './discord.service';

type SelectMenuHandler = (interaction: StringSelectMenuInteraction) => Promise<void>;

@Injectable()
export class DiscordInteractionService implements OnModuleInit {
  private readonly logger = new Logger(DiscordInteractionService.name);
  private readonly handlers = new Map<string, SelectMenuHandler>();

  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.getClient().on('interactionCreate', async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;

      const colonIdx = interaction.customId.indexOf(':');
      const prefix = colonIdx === -1 ? interaction.customId : interaction.customId.slice(0, colonIdx);

      const handler = this.handlers.get(prefix);
      if (!handler) return;

      try {
        await handler(interaction);
      } catch (err) {
        this.logger.error(`Error in interaction handler for prefix "${prefix}"`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Đã xảy ra lỗi xử lý.', ephemeral: true });
        }
      }
    });
  }

  register(customIdPrefix: string, handler: SelectMenuHandler): void {
    this.handlers.set(customIdPrefix, handler);
    this.logger.debug(`Registered interaction handler for prefix "${customIdPrefix}"`);
  }
}
