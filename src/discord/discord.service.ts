import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    Client,
    GatewayIntentBits,
    MessageCreateOptions,
    TextChannel,
} from 'discord.js';

export interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client: Client;
  private ready = false;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
  }

  /** Expose the raw client so other services (e.g. interaction handler) can attach listeners. */
  getClient(): Client {
    return this.client;
  }

  isReady(): boolean {
    return this.ready;
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

    try {
      await this.client.login(token);
    } catch (err) {
      this.logger.error('Failed to login to Discord', err);
    }
  }

  /**
   * Generic send — accepts a plain string or a full discord.js MessageCreateOptions
   * (embeds, components, attachments, etc.).
   */
  async sendMessage(channelId: string, payload: string | MessageCreateOptions): Promise<void> {
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
      await (channel as TextChannel).send(payload);
    } catch (err) {
      this.logger.error(`Failed to send message to channel ${channelId}`, err);
    }
  }
}
