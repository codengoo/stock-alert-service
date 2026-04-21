import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChatInputCommandInteraction, StringSelectMenuInteraction } from 'discord.js';
import { DiscordService } from './discord.service';

type SelectMenuHandler = (interaction: StringSelectMenuInteraction) => Promise<void>;
type SlashCommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

@Injectable()
export class DiscordInteractionService implements OnModuleInit {
  private readonly logger = new Logger(DiscordInteractionService.name);
  private readonly selectHandlers = new Map<string, SelectMenuHandler>();
  private readonly slashHandlers = new Map<string, SlashCommandHandler>();

  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.getClient().on('interactionCreate', async (interaction) => {
      // ── Select-menu ──────────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        const colonIdx = interaction.customId.indexOf(':');
        const prefix =
          colonIdx === -1 ? interaction.customId : interaction.customId.slice(0, colonIdx);

        const handler = this.selectHandlers.get(prefix);
        if (!handler) return;

        try {
          await handler(interaction);
        } catch (err) {
          this.logger.error(`Error in select-menu handler for prefix "${prefix}"`, err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Đã xảy ra lỗi xử lý.', ephemeral: true });
          }
        }
        return;
      }

      // ── Slash command ────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const handler = this.slashHandlers.get(interaction.commandName);
        if (!handler) return;

        try {
          await handler(interaction);
        } catch (err) {
          this.logger.error(`Error in slash handler for command "${interaction.commandName}"`, err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Đã xảy ra lỗi xử lý.', ephemeral: true });
          }
        }
      }
    });
  }

  /** Register a select-menu handler by customId prefix (e.g. `"snooze"` for `snooze:<SYMBOL>`). */
  register(customIdPrefix: string, handler: SelectMenuHandler): void {
    this.selectHandlers.set(customIdPrefix, handler);
    this.logger.debug(`Registered select-menu handler for prefix "${customIdPrefix}"`);
  }

  /** Register a slash command handler by command name (e.g. `"symbol"`). */
  registerSlashHandler(commandName: string, handler: SlashCommandHandler): void {
    this.slashHandlers.set(commandName, handler);
    this.logger.debug(`Registered slash command handler for "${commandName}"`);
  }
}
