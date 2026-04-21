import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActionRowBuilder,
  Client,
  GatewayIntentBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from 'discord.js';
import { SNOOZE_DURATION_MS, SnoozeDuration } from '../../watched-symbol/dto/snooze-symbol.dto';

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

type SnoozeHandler = (symbol: string, snoozeUntil: Date) => Promise<void>;

const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration; description: string }[] = [
  { label: '5 phút', value: SnoozeDuration.FIVE_MINUTES, description: 'Snooze trong 5 phút' },
  { label: '15 phút', value: SnoozeDuration.FIFTEEN_MINUTES, description: 'Snooze trong 15 phút' },
  { label: '30 phút', value: SnoozeDuration.THIRTY_MINUTES, description: 'Snooze trong 30 phút' },
  { label: '1 giờ', value: SnoozeDuration.ONE_HOUR, description: 'Snooze trong 1 giờ' },
  { label: '1 ngày', value: SnoozeDuration.ONE_DAY, description: 'Snooze trong 1 ngày' },
];

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client;
  private ready = false;
  private snoozeHandler?: SnoozeHandler;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
  }

  registerSnoozeHandler(handler: SnoozeHandler): void {
    this.snoozeHandler = handler;
  }

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN is not set. Discord notifications are disabled.');
      return;
    }

    this.client.once('ready', () => {
      this.ready = true;
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;

      const [action, symbol] = interaction.customId.split(':');
      if (action !== 'snooze' || !symbol) return;

      const durationValue = interaction.values[0] as SnoozeDuration;
      const ms = SNOOZE_DURATION_MS[durationValue];
      if (!ms) return;

      const snoozeUntil = new Date(Date.now() + ms);

      try {
        if (this.snoozeHandler) {
          await this.snoozeHandler(symbol, snoozeUntil);
        }
        const option = SNOOZE_OPTIONS.find((o) => o.value === durationValue);
        await interaction.reply({
          content: `⏸ Đã snooze cảnh báo **${symbol}** trong **${option?.label ?? durationValue}** (đến ${snoozeUntil.toLocaleString('vi-VN')}).`,
          ephemeral: true,
        });
      } catch (err) {
        this.logger.error(`Failed to handle snooze interaction for ${symbol}`, err);
        await interaction.reply({ content: '❌ Không thể snooze cảnh báo.', ephemeral: true });
      }
    });

    try {
      await this.client.login(token);
    } catch (err) {
      this.logger.error('Failed to login to Discord', err);
    }
  }

  async sendMessage(channelId: string, message: string): Promise<void> {
    if (!this.ready) {
      this.logger.warn('Discord client not ready — message skipped.');
      return;
    }
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        this.logger.warn(`Channel ${channelId} is not a text channel.`);
        return;
      }
      await (channel as TextChannel).send(message);
    } catch (err) {
      this.logger.error(`Failed to send message to channel ${channelId}`, err);
    }
  }

  async sendEmbed(channelId: string, embed: DiscordEmbed): Promise<void> {
    if (!this.ready) {
      this.logger.warn('Discord client not ready — embed skipped.');
      return;
    }
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        this.logger.warn(`Channel ${channelId} is not a text channel.`);
        return;
      }
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (err) {
      this.logger.error(`Failed to send embed to channel ${channelId}`, err);
    }
  }

  /**
   * Send a price-alert embed with an inline snooze select-menu.
   * After the user picks a duration, the bot handles the interaction via `interactionCreate`.
   */
  async sendAlertWithSnooze(
    channelId: string,
    embed: DiscordEmbed,
    symbol: string,
  ): Promise<void> {
    if (!this.ready) {
      this.logger.warn('Discord client not ready — alert skipped.');
      return;
    }
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        this.logger.warn(`Channel ${channelId} is not a text channel.`);
        return;
      }

      const snoozeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
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

      await (channel as TextChannel).send({
        embeds: [embed],
        components: [snoozeMenu],
      });
    } catch (err) {
      this.logger.error(`Failed to send alert for ${symbol} to channel ${channelId}`, err);
    }
  }
}
