import { GoldSlashCommandService } from '@/discord/commands/gold.interaction';
import { StockApiModule } from '@/shared/stock/stock.module';
import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GoldAlertService } from './gold-alert.service';
import { GoldController } from './gold.controller';

@Module({
  imports: [StockApiModule, SettingsModule],
  controllers: [GoldController],
  providers: [GoldAlertService, GoldSlashCommandService],
  exports: [GoldAlertService],
})
export class GoldModule {}
