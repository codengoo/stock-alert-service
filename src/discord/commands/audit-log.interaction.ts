import { AuditLogService } from '@/audit-log/audit-log.service';
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
export class AuditLogSlashCommandService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogSlashCommandService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  onModuleInit() {
    this.discordService.registerApplicationCommands([
      {
        type: ApplicationCommandType.ChatInput,
        name: 'audit',
        description: 'Xem lịch sử hoạt động hệ thống',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'recent',
            description: 'Xem 5 sự kiện audit gần nhất',
          },
        ],
      },
    ]);

    this.discordInteractionService.registerSlashHandler('audit', (i) =>
      this.handleAuditCommand(i),
    );
  }

  private async handleAuditCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'recent') {
      await this.handleRecent(interaction);
    }
  }

  private formatValue(val: unknown, maxLen = 20): string {
    if (val === undefined || val === null) return '-';
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  private async handleRecent(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const logs = await this.auditLogService.findAll(5);

      if (logs.length === 0) {
        await interaction.editReply('📋 Chưa có sự kiện audit nào được ghi nhận.');
        return;
      }

      const rows: string[][] = [];
      for (const log of logs) {
        const raw = log as typeof log & { createdAt?: Date };
        const time = raw.createdAt
          ? new Date(raw.createdAt).toLocaleString('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-';

        const action =
          `${log.collection}:${log.action}` +
          (log.target ? ` (${log.target})` : '');

        const diffs = this.auditLogService.diffRecords(log.before, log.after);

        if (diffs.length === 0) {
          rows.push([action, time, '-', '-', '-']);
        } else {
          diffs.forEach((d, idx) => {
            rows.push([
              idx === 0 ? action : '',
              idx === 0 ? time : '',
              d.key,
              this.formatValue(d.before),
              this.formatValue(d.after),
            ]);
          });
        }
      }

      const table = buildTable(['Action', 'Thời gian', 'Field', 'Trước', 'Sau'], rows);
      const header = '📋 **5 sự kiện audit gần nhất**\n```\n';
      const footer = '\n```';
      const maxTableLen = 1990 - header.length - footer.length;
      const tableStr =
        table.length > maxTableLen
          ? table.slice(0, maxTableLen - 4) + '\n...'
          : table;
      await interaction.editReply(`${header}${tableStr}${footer}`);
    } catch (err) {
      this.logger.error('Failed to fetch audit logs for slash command', err);
      await interaction.editReply('❌ Đã xảy ra lỗi khi lấy dữ liệu audit log.');
    }
  }
}
