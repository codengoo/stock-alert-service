import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchedSymbol, WatchedSymbolSchema } from '../schemas/watched-symbol.schema';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: WatchedSymbol.name, schema: WatchedSymbolSchema },
    ]),
    SettingsModule,
  ],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
