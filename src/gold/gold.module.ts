import { StockApiModule } from '@/shared/stock/stock.module';
import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GoldAlertService } from './gold-alert.service';

@Module({
  imports: [StockApiModule, SettingsModule],
  providers: [GoldAlertService],
})
export class GoldModule {}
