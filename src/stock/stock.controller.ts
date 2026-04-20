import {
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { StockService } from './stock.service';

@ApiTags('Stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ─── Manual alert trigger ─────────────────────────────────────────────────

  @Post('check-prices')
  @ApiOperation({
    summary: 'Kích hoạt kiểm tra giá thủ công',
    description:
      'Chạy ngay lập tức job kiểm tra giá cho tất cả mã đang active. ' +
      'Hữu ích để test alert Discord mà không cần chờ cron chạy.',
  })
  @ApiOkResponse({ description: '`{ triggered: true }`' })
  triggerCheck() {
    return this.stockService.triggerPriceCheck();
  }

  // ─── Proxy endpoints to stock-alert FastAPI ───────────────────────────────

  @Get('price-board')
  @ApiOperation({
    summary: 'Bảng giá real-time nhiều mã',
    description: 'Proxy tới stock-alert FastAPI `/price-board`.',
  })
  @ApiQuery({ name: 'symbols', description: 'Danh sách mã phân cách bởi dấu phẩy', example: 'VCB,ACB,TCB' })
  @ApiQuery({ name: 'source', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Dữ liệu bảng giá từ vnstock' })
  getPriceBoard(
    @Query('symbols') symbols: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getPriceBoardPublic(symbols.split(','), source);
  }

  @Get('intraday/:symbol')
  @ApiOperation({ summary: 'Dữ liệu khớp lệnh trong phiên của một mã' })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiQuery({ name: 'page_size', required: false, example: 100 })
  @ApiQuery({ name: 'source', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Danh sách lệnh khớp intraday' })
  getIntraday(
    @Param('symbol') symbol: string,
    @Query('page_size') pageSize?: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getIntraday(symbol, pageSize ? Number(pageSize) : 100, source);
  }

  @Get('history/:symbol')
  @ApiOperation({ summary: 'Lịch sử giá theo ngày/tuần/tháng' })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiQuery({ name: 'start', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'end', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'length', required: false, example: 30 })
  @ApiQuery({ name: 'interval', required: false, example: 'd' })
  @ApiQuery({ name: 'source', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Lịch sử giá' })
  getHistory(
    @Param('symbol') symbol: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('length') length?: string,
    @Query('interval') interval?: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getHistory(symbol, {
      start,
      end,
      length: length ? Number(length) : undefined,
      interval,
      source,
    });
  }

  @Get('listing')
  @ApiOperation({ summary: 'Danh sách mã niêm yết' })
  @ApiQuery({ name: 'source', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Danh sách mã niêm yết' })
  getListing(@Query('source') source?: string) {
    return this.stockService.getListing(source);
  }

  @Get('company/:symbol')
  @ApiOperation({ summary: 'Thông tin tổng quan doanh nghiệp' })
  @ApiParam({ name: 'symbol', example: 'FPT' })
  @ApiQuery({ name: 'source', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Thông tin tổng quan doanh nghiệp' })
  getCompany(
    @Param('symbol') symbol: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getCompany(symbol, source);
  }
}
