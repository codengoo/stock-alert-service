import { SymbolSlashCommandService } from '@/discord/commands/watch-symbold.interaction';
import { StockApiModule } from '@/shared/stock/stock.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchedSymbol, WatchedSymbolSchema } from '../schemas/watched-symbol.schema';
import { WatchedSymbolController } from './watched-symbol.controller';
import { WatchedSymbolService } from './watched-symbol.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WatchedSymbol.name, schema: WatchedSymbolSchema },
    ]),
    StockApiModule,
  ],
  controllers: [WatchedSymbolController],
  providers: [WatchedSymbolService, SymbolSlashCommandService],
  exports: [WatchedSymbolService],
})
export class WatchedSymbolModule {}
