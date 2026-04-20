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
} from '@nestjs/common';
import {
    ApiBody,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { CreateWatchedSymbolDto } from './dto/create-watched-symbol.dto';
import { SnoozeSymbolDto } from './dto/snooze-symbol.dto';
import { UpdateWatchedSymbolDto } from './dto/update-watched-symbol.dto';
import { WatchedSymbolService } from './watched-symbol.service';

@ApiTags('Watched Symbols')
@Controller('watched-symbols')
export class WatchedSymbolController {
  constructor(private readonly watchedSymbolService: WatchedSymbolService) {}

  @Post()
  @ApiOperation({
    summary: 'Thêm hoặc cập nhật mã theo dõi',
    description: 'Upsert mã cổ phiếu vào danh sách theo dõi kèm cấu hình ngưỡng riêng.',
  })
  @ApiBody({ type: CreateWatchedSymbolDto })
  @ApiCreatedResponse({ description: 'Mã đã được thêm/cập nhật' })
  create(@Body() dto: CreateWatchedSymbolDto) {
    return this.watchedSymbolService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả mã theo dõi' })
  @ApiOkResponse({ description: 'Danh sách watched symbols' })
  findAll() {
    return this.watchedSymbolService.findAll();
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một mã' })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiOkResponse({ description: 'Thông tin mã theo dõi' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  findOne(@Param('symbol') symbol: string) {
    return this.watchedSymbolService.findOne(symbol);
  }

  @Patch(':symbol')
  @ApiOperation({
    summary: 'Cập nhật cấu hình mã theo dõi',
    description: 'Cập nhật các trường active, note, ngưỡng giá, buyPrice.',
  })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiBody({ type: UpdateWatchedSymbolDto })
  @ApiOkResponse({ description: 'Đã cập nhật' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  update(@Param('symbol') symbol: string, @Body() dto: UpdateWatchedSymbolDto) {
    return this.watchedSymbolService.update(symbol, dto);
  }

  @Delete(':symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa mã khỏi danh sách theo dõi' })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiNoContentResponse({ description: 'Đã xóa' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  remove(@Param('symbol') symbol: string) {
    return this.watchedSymbolService.remove(symbol);
  }

  @Post(':symbol/snooze')
  @ApiOperation({
    summary: 'Snooze cảnh báo cho mã',
    description: 'Tạm dừng cảnh báo trong khoảng thời gian chỉ định (5p, 15p, 30p, 1h, 1 ngày).',
  })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiBody({ type: SnoozeSymbolDto })
  @ApiOkResponse({ description: 'Đã snooze' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  snooze(@Param('symbol') symbol: string, @Body() dto: SnoozeSymbolDto) {
    return this.watchedSymbolService.snooze(symbol, dto.duration);
  }

  @Delete(':symbol/snooze')
  @ApiOperation({ summary: 'Hủy snooze — kích hoạt lại cảnh báo ngay' })
  @ApiParam({ name: 'symbol', example: 'VCB' })
  @ApiOkResponse({ description: 'Đã hủy snooze' })
  @ApiNotFoundResponse({ description: 'Mã không tồn tại' })
  clearSnooze(@Param('symbol') symbol: string) {
    return this.watchedSymbolService.clearSnooze(symbol);
  }
}
