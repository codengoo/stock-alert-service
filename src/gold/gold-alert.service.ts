import { StockApiService } from '@/shared/stock';
import { ILocalGoldOrganization } from '@/shared/stock/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APIEmbed, ColorResolvable, EmbedBuilder } from 'discord.js';
import { DiscordService } from '../discord/discord.service';
import { buildTable } from '../discord/utils/table.util';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class GoldAlertService {
  private readonly logger = new Logger(GoldAlertService.name);

  constructor(
    private readonly stockApiService: StockApiService,
    private readonly discordService: DiscordService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Daily gold price report — every day at 10:00 AM (ICT = UTC+7, so 03:00 UTC) */
  @Cron('0 3 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDailyGoldReport() {
    this.logger.log('Fetching daily gold prices...');

    const discordSettings = await this.settingsService.getDiscordSettings();
    const channelId = discordSettings.goldChannelId || discordSettings.alertChannelId;
    if (!channelId) {
      this.logger.warn('Không có goldChannelId hoặc alertChannelId — bỏ qua báo cáo giá vàng.');
      return;
    }

    const [localData, globalData] = await Promise.all([
      this.stockApiService.getLocalGold().catch((err) => {
        this.logger.error('Lỗi lấy giá vàng trong nước', err);
        return null;
      }),
      this.stockApiService.getGlobalGold().catch((err) => {
        this.logger.error('Lỗi lấy giá vàng thế giới', err);
        return null;
      }),
    ]);

    if (!localData && !globalData) {
      this.logger.warn('Không lấy được dữ liệu giá vàng — bỏ qua.');
      return;
    }

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const embeds: APIEmbed[] = [];

    // ── Embed 1: Giá vàng thế giới ───────────────────────────────────────────
    if (globalData) {
      const changeSign = (globalData.change_usd ?? 0) >= 0 ? '▲' : '▼';
      const changeColor: ColorResolvable = (globalData.change_usd ?? 0) >= 0 ? 0x2ecc71 : 0xe74c3c;
      const pctStr = globalData.change_pct != null
        ? `${changeSign} ${Math.abs(globalData.change_pct).toFixed(2)}%`
        : 'N/A';
      const usdStr = globalData.price_usd_per_ounce != null
        ? `$${globalData.price_usd_per_ounce.toLocaleString('en-US')}`
        : 'N/A';
      const vndLuongStr = globalData.price_vnd_per_luong != null
        ? `${(globalData.price_vnd_per_luong / 1_000_000).toFixed(2)} triệu VNĐ/lượng`
        : 'N/A';

      const globalEmbed = new EmbedBuilder()
        .setTitle('🌐 Giá Vàng Thế Giới (XAU/USD)')
        .setColor(changeColor)
        .addFields(
          { name: 'Giá (USD/ounce)', value: usdStr, inline: true },
          {
            name: 'Thay đổi 24h',
            value: globalData.change_usd != null
              ? `${changeSign} $${Math.abs(globalData.change_usd).toFixed(2)} (${pctStr})`
              : 'N/A',
            inline: true,
          },
          { name: 'Quy đổi VNĐ', value: vndLuongStr, inline: true },
        )
        .setFooter({ text: `Cập nhật: ${globalData.updated_at}` });

      embeds.push(globalEmbed.toJSON());
    }

    // ── Embed 2: Bảng giá vàng trong nước ────────────────────────────────────
    if (localData?.organizations?.length) {
      const orgs = localData.organizations;

      // Find best buy / best sell across all organizations (gold_bar)
      const bestBuy = orgs.reduce((best: ILocalGoldOrganization | null, org) => {
        if (org.gold_bar.buy_price == null) return best;
        if (!best || (best.gold_bar.buy_price ?? 0) < org.gold_bar.buy_price) return org;
        return best;
      }, null as ILocalGoldOrganization | null);
      const bestSell = orgs.reduce((best: ILocalGoldOrganization | null, org) => {
        if (org.gold_bar.sell_price == null) return best;
        if (!best || (best.gold_bar.sell_price ?? Infinity) > org.gold_bar.sell_price) return org;
        return best;
      }, null as ILocalGoldOrganization | null);

      // Build table rows
      const rows = orgs.map((org) => [
        org.organization,
        org.gold_bar.buy_price != null ? org.gold_bar.buy_price.toLocaleString('vi-VN') : '-',
        org.gold_bar.sell_price != null ? org.gold_bar.sell_price.toLocaleString('vi-VN') : '-',
        org.gold_ring.buy_price != null ? org.gold_ring.buy_price.toLocaleString('vi-VN') : '-',
        org.gold_ring.sell_price != null ? org.gold_ring.sell_price.toLocaleString('vi-VN') : '-',
      ]);

      const table = buildTable(
        ['Tổ chức', 'Miếng Mua', 'Miếng Bán', 'Nhẫn Mua', 'Nhẫn Bán'],
        rows,
      );

      const localEmbed = new EmbedBuilder()
        .setTitle('🇻🇳 Giá Vàng Trong Nước')
        .setColor(0xf39c12)
        .setDescription('```\n' + table + '\n```')
        .addFields(
          {
            name: '🏆 Mua vào tốt nhất (vàng miếng)',
            value: bestBuy
              ? `**${bestBuy.organization}** — ${bestBuy.gold_bar.buy_price!.toLocaleString('vi-VN')} (×1000 VNĐ/lượng)`
              : 'N/A',
            inline: false,
          },
          {
            name: '💰 Bán ra thấp nhất (vàng miếng)',
            value: bestSell
              ? `**${bestSell.organization}** — ${bestSell.gold_bar.sell_price!.toLocaleString('vi-VN')} (×1000 VNĐ/lượng)`
              : 'N/A',
            inline: false,
          },
        )
        .setFooter({ text: `Đơn vị: ×1000 VNĐ/lượng  •  Báo cáo lúc ${now}` });

      embeds.push(localEmbed.toJSON());
    }

    if (embeds.length === 0) return;

    await this.discordService.sendMessage(channelId, { embeds });
    this.logger.log('Đã gửi báo cáo giá vàng hàng ngày lên Discord.');
  }
}
