import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WatchedSymbol, WatchedSymbolSchema } from '../schemas/watched-symbol.schema';
import { WatchedSymbolService } from './watched-symbol.service';
import { WatchedSymbolController } from './watched-symbol.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WatchedSymbol.name, schema: WatchedSymbolSchema },
    ]),
  ],
  controllers: [WatchedSymbolController],
  providers: [WatchedSymbolService],
  exports: [WatchedSymbolService],
})
export class WatchedSymbolModule {}
