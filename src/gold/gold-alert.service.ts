import { StockApiService } from '@/shared/stock';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APIEmbed, ColorResolvable, EmbedBuilder } from 'discord.js';
import { DiscordService } from '../discord/discord.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class GoldAlertService {
  private readonly logger = new Logger(GoldAlertService.name);

  constructor(
    private readonly stockApiService: StockApiService,
    private readonly discordService: DiscordService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Fetch gold data and build Discord embeds. Returns empty array if no data available. */
  async buildGoldEmbeds(): Promise<APIEmbed[]> {
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

    if (!localData && !globalData) return [];

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

      const avg = (vals: (number | null | undefined)[]) => {
        const valid = vals.filter((v): v is number => v != null);
        return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
      };

      const fmtPrice = (val: number | null) =>
        val != null
          ? (val / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
          : 'N/A';

      const avgBarBuy  = avg(orgs.map((o) => o.gold_bar.buy_price));
      const avgBarSell = avg(orgs.map((o) => o.gold_bar.sell_price));
      const avgRingBuy  = avg(orgs.map((o) => o.gold_ring.buy_price));
      const avgRingSell = avg(orgs.map((o) => o.gold_ring.sell_price));

      const localEmbed = new EmbedBuilder()
        .setTitle('🇻🇳 Giá Vàng Trong Nước')
        .setColor(0xf39c12)
        .addFields(
          { name: '🪙 Miếng Mua TB',  value: fmtPrice(avgBarBuy),  inline: true },
          { name: '🪙 Miếng Bán TB',  value: fmtPrice(avgBarSell), inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '💍 Nhẫn Mua TB',   value: fmtPrice(avgRingBuy),  inline: true },
          { name: '💍 Nhẫn Bán TB',   value: fmtPrice(avgRingSell), inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
        )
        .setFooter({ text: `Đơn vị: triệu VNĐ/lượng  •  Báo cáo lúc ${now}` });

      embeds.push(localEmbed.toJSON());
    }

    return embeds;
  }

  /** Daily gold price report — every day at 10:00 AM ICT */
  @Cron('0 10 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDailyGoldReport() {
    this.logger.log('Fetching daily gold prices...');

    const discordSettings = await this.settingsService.getDiscordSettings();
    const channelId = discordSettings.goldChannelId || discordSettings.alertChannelId;
    if (!channelId) {
      this.logger.warn('Không có goldChannelId hoặc alertChannelId — bỏ qua báo cáo giá vàng.');
      return;
    }

    const embeds = await this.buildGoldEmbeds();
    if (embeds.length === 0) {
      this.logger.warn('Không lấy được dữ liệu giá vàng — bỏ qua.');
      return;
    }

    await this.discordService.sendMessage(channelId, { embeds });
    this.logger.log('Đã gửi báo cáo giá vàng hàng ngày lên Discord.');
  }
}
