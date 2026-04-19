import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@ApiTags('Settings')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'Header x-api-key thiếu hoặc không hợp lệ' })
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy toàn bộ danh sách settings',
    description: 'Trả về tất cả key-value settings đang được lưu trong MongoDB.',
  })
  @ApiOkResponse({ description: 'Danh sách settings' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Lấy setting theo key',
    description: 'Tìm một setting theo tên key. Trả về 404 nếu không tồn tại.',
  })
  @ApiParam({
    name: 'key',
    description: 'Tên key của setting',
    example: 'stock.alertThresholdPercent',
  })
  @ApiOkResponse({ description: 'Setting tìm thấy' })
  @ApiNotFoundResponse({ description: 'Setting không tồn tại' })
  findOne(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Put()
  @ApiOperation({
    summary: 'Tạo hoặc cập nhật setting (upsert)',
    description:
      'Nếu key đã tồn tại thì cập nhật value, nếu chưa thì tạo mới.\n\n' +
      '**Các key hệ thống:**\n' +
      '| Key | Mô tả | Mặc định |\n' +
      '|-----|-------|----------|\n' +
      '| `stock.apiBaseUrl` | URL của stock-alert FastAPI | `http://localhost:8000` |\n' +
      '| `stock.apiSource` | Nguồn dữ liệu mặc định | `KBS` |\n' +
      '| `stock.alertThresholdPercent` | Ngưỡng % biến động giá để gửi cảnh báo | `3` |\n' +
      '| `discord.alertChannelId` | Channel ID Discord nhận cảnh báo | — |',
  })
  @ApiBody({ type: UpsertSettingDto })
  @ApiOkResponse({ description: 'Setting sau khi upsert' })
  upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(dto);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa setting theo key',
    description: 'Xóa vĩnh viễn một setting. Trả về 404 nếu key không tồn tại.',
  })
  @ApiParam({
    name: 'key',
    description: 'Tên key của setting cần xóa',
    example: 'stock.alertThresholdPercent',
  })
  @ApiNoContentResponse({ description: 'Xóa thành công' })
  @ApiNotFoundResponse({ description: 'Setting không tồn tại' })
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
