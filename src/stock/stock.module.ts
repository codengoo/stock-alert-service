import { StockApiModule } from '@/shared/stock';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { WatchedSymbolModule } from '../watched-symbol/watched-symbol.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [
    HttpModule,
    SettingsModule,
    WatchedSymbolModule,
    StockApiModule
  ],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
