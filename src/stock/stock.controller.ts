import {
  Controller
} from '@nestjs/common';
import {
  ApiTags
} from '@nestjs/swagger';
import { StockService } from './stock.service';

@ApiTags('Stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}
}
