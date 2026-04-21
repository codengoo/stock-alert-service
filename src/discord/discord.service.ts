import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ApplicationCommandDataResolvable,
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
  private readonly pendingCommands: ApplicationCommandDataResolvable[] = [];

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

    this.client.once('ready', async () => {
      this.ready = true;
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
      if (this.pendingCommands.length > 0) {
        await this.flushPendingCommands();
      }
    });

    try {
      await this.client.login(token);
    } catch (err) {
      this.logger.error('Failed to login to Discord', err);
    }
  }

  /**
   * Queue application (slash) commands for registration.
   * If the bot is already ready they are registered immediately,
   * otherwise they are flushed once the ready event fires.
   * Set DISCORD_GUILD_ID for instant guild-scoped registration (dev),
   * or leave unset for global registration (up to 1 h propagation).
   */
  registerApplicationCommands(commands: ApplicationCommandDataResolvable[]): void {
    if (this.ready) {
      this.pendingCommands.push(...commands);
      void this.flushPendingCommands();
    } else {
      this.pendingCommands.push(...commands);
    }
  }

  private async flushPendingCommands(): Promise<void> {
    if (!this.pendingCommands.length) return;
    const commands = [...this.pendingCommands];
    this.pendingCommands.length = 0;
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');
    try {
      if (guildId) {
        const guild = await this.client.guilds.fetch(guildId);
        await guild.commands.set(commands);
        this.logger.log(`Registered ${commands.length} slash command(s) for guild ${guildId}.`);
      } else {
        await this.client.application!.commands.set(commands);
        this.logger.log(`Registered ${commands.length} slash command(s) globally.`);
      }
    } catch (err) {
      this.logger.error('Failed to register application commands', err);
    }
  }

  /**
   * Send a message to a Discord channel.
   * @param channelId The ID of the channel.
   * @param payload The message content or options (embeds, components, attachments, etc.).
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
