import { Module } from '@nestjs/common';
import { StockApiService } from './stock.service';

@Module({
  imports: [],
  controllers: [],
  providers: [StockApiService],
  exports: [StockApiService],
})
export class StockApiModule {}
