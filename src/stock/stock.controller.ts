import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StockService } from './stock.service';
import { AddWatchedSymbolDto } from './dto/add-watched-symbol.dto';

@ApiTags('Stock')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'Header x-api-key thiếu hoặc không hợp lệ' })
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ─── Watched symbols ──────────────────────────────────────────────────────

  @Get('watched')
  @ApiOperation({
    summary: 'Lấy danh sách mã theo dõi',
    description: 'Trả về tất cả mã cổ phiếu đang được lưu trong DB (bao gồm cả inactive).',
  })
  @ApiOkResponse({ description: 'Danh sách watched symbols' })
  listSymbols() {
    return this.stockService.listSymbols();
  }

  @Post('watched')
  @ApiOperation({
    summary: 'Thêm hoặc cập nhật mã theo dõi',
    description:
      'Thêm mã cổ phiếu vào danh sách theo dõi. Nếu mã đã tồn tại thì cập nhật thông tin (upsert). ' +
      'Mã tự động được chuyển thành chữ hoa.',
  })
  @ApiBody({ type: AddWatchedSymbolDto })
  @ApiCreatedResponse({ description: 'Mã đã được thêm/cập nhật' })
  addSymbol(@Body() dto: AddWatchedSymbolDto) {
    return this.stockService.addSymbol(dto);
  }

  @Patch('watched/:symbol/active')
  @ApiOperation({
    summary: 'Bật/tắt theo dõi một mã',
    description:
      'Cập nhật trạng thái active của mã. Mã bị tắt (active=false) sẽ không được kiểm tra trong cron job.',
  })
  @ApiParam({ name: 'symbol', description: 'Mã cổ phiếu', example: 'VCB' })
  @ApiQuery({
    name: 'value',
    description: 'Trạng thái mong muốn (`true` hoặc `false`)',
    example: 'false',
    required: false,
  })
  @ApiOkResponse({ description: 'Trạng thái đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  setActive(
    @Param('symbol') symbol: string,
    @Query('value') value: string,
  ) {
    return this.stockService.setSymbolActive(symbol, value !== 'false');
  }

  @Delete('watched/:symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa mã khỏi danh sách theo dõi',
    description: 'Xóa vĩnh viễn mã cổ phiếu khỏi DB. Cron job sẽ ngừng kiểm tra mã này.',
  })
  @ApiParam({ name: 'symbol', description: 'Mã cổ phiếu cần xóa', example: 'VCB' })
  @ApiNoContentResponse({ description: 'Xóa thành công' })
  removeSymbol(@Param('symbol') symbol: string) {
    return this.stockService.removeSymbol(symbol);
  }

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
    description:
      'Proxy tới stock-alert FastAPI `/price-board`. ' +
      'Trả về snapshot giá hiện tại cho danh sách mã được cung cấp.',
  })
  @ApiQuery({
    name: 'symbols',
    description: 'Danh sách mã phân cách bởi dấu phẩy',
    example: 'VCB,ACB,TCB',
  })
  @ApiQuery({
    name: 'source',
    description: 'Nguồn dữ liệu (`KBS`, `VCI`). Mặc định lấy từ setting `stock.apiSource`.',
    required: false,
    example: 'KBS',
  })
  @ApiOkResponse({ description: 'Dữ liệu bảng giá từ vnstock' })
  getPriceBoard(
    @Query('symbols') symbols: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getPriceBoard(symbols.split(','), source);
  }

  @Get('intraday/:symbol')
  @ApiOperation({
    summary: 'Dữ liệu khớp lệnh trong phiên của một mã',
    description:
      'Proxy tới stock-alert FastAPI `/quote/intraday/{symbol}`. ' +
      'Trả về danh sách các lệnh khớp trong phiên hôm nay.',
  })
  @ApiParam({ name: 'symbol', description: 'Mã cổ phiếu', example: 'VCB' })
  @ApiQuery({
    name: 'page_size',
    description: 'Số lượng bản ghi tối đa (mặc định 100, tối đa 10000)',
    required: false,
    example: 100,
  })
  @ApiQuery({
    name: 'source',
    description: 'Nguồn dữ liệu',
    required: false,
    example: 'KBS',
  })
  @ApiOkResponse({ description: 'Danh sách lệnh khớp intraday' })
  getIntraday(
    @Param('symbol') symbol: string,
    @Query('page_size') pageSize?: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getIntraday(
      symbol,
      pageSize ? Number(pageSize) : 100,
      source,
    );
  }

  @Get('history/:symbol')
  @ApiOperation({
    summary: 'Lịch sử giá theo ngày/tuần/tháng',
    description:
      'Proxy tới stock-alert FastAPI `/quote/history/{symbol}`.\n\n' +
      '**Thứ tự ưu tiên tham số:**\n' +
      '1. `length` — N phiên gần nhất\n' +
      '2. `start` + `end` — khoảng thời gian cụ thể\n' +
      '3. `start` — từ ngày start đến hôm nay\n' +
      '4. Không truyền gì — 90 phiên gần nhất',
  })
  @ApiParam({ name: 'symbol', description: 'Mã cổ phiếu', example: 'VCB' })
  @ApiQuery({ name: 'start', description: 'Ngày bắt đầu (YYYY-MM-DD)', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'end', description: 'Ngày kết thúc (YYYY-MM-DD)', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'length', description: 'Số phiên gần nhất', required: false, example: 30 })
  @ApiQuery({
    name: 'interval',
    description: 'Chu kỳ: `d` (ngày), `w` (tuần), `m` (tháng)',
    required: false,
    example: 'd',
  })
  @ApiQuery({ name: 'source', description: 'Nguồn dữ liệu', required: false, example: 'KBS' })
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
  @ApiOperation({
    summary: 'Danh sách mã niêm yết',
    description: 'Proxy tới stock-alert FastAPI `/listing`. Trả về toàn bộ danh sách mã đang niêm yết.',
  })
  @ApiQuery({ name: 'source', description: 'Nguồn dữ liệu', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Danh sách mã niêm yết' })
  getListing(@Query('source') source?: string) {
    return this.stockService.getListing(source);
  }

  @Get('company/:symbol')
  @ApiOperation({
    summary: 'Thông tin tổng quan doanh nghiệp',
    description: 'Proxy tới stock-alert FastAPI `/company/{symbol}`. Trả về tổng quan về công ty niêm yết.',
  })
  @ApiParam({ name: 'symbol', description: 'Mã cổ phiếu', example: 'FPT' })
  @ApiQuery({ name: 'source', description: 'Nguồn dữ liệu', required: false, example: 'KBS' })
  @ApiOkResponse({ description: 'Thông tin tổng quan doanh nghiệp' })
  getCompany(
    @Param('symbol') symbol: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getCompany(symbol, source);
  }
}

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ─── Watched symbols ──────────────────────────────────────────────────────

  @Get('watched')
  listSymbols() {
    return this.stockService.listSymbols();
  }

  @Post('watched')
  addSymbol(@Body() dto: AddWatchedSymbolDto) {
    return this.stockService.addSymbol(dto);
  }

  @Patch('watched/:symbol/active')
  setActive(
    @Param('symbol') symbol: string,
    @Query('value') value: string,
  ) {
    return this.stockService.setSymbolActive(symbol, value !== 'false');
  }

  @Delete('watched/:symbol')
  removeSymbol(@Param('symbol') symbol: string) {
    return this.stockService.removeSymbol(symbol);
  }

  // ─── Manual alert trigger ─────────────────────────────────────────────────

  @Post('check-prices')
  triggerCheck() {
    return this.stockService.triggerPriceCheck();
  }

  // ─── Proxy endpoints to stock-alert API ──────────────────────────────────

  @Get('price-board')
  getPriceBoard(
    @Query('symbols') symbols: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getPriceBoard(symbols.split(','), source);
  }

  @Get('intraday/:symbol')
  getIntraday(
    @Param('symbol') symbol: string,
    @Query('page_size') pageSize?: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getIntraday(
      symbol,
      pageSize ? Number(pageSize) : 100,
      source,
    );
  }

  @Get('history/:symbol')
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
  getListing(@Query('source') source?: string) {
    return this.stockService.getListing(source);
  }

  @Get('company/:symbol')
  getCompany(
    @Param('symbol') symbol: string,
    @Query('source') source?: string,
  ) {
    return this.stockService.getCompany(symbol, source);
  }
}
