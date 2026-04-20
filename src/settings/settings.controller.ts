import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingsService } from './settings.service';
@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy toàn bộ settings',
    description: 'Trả về tất cả settings dưới dạng key-value object. ',
  })
  @ApiOkResponse({ description: 'Settings map với đầy đủ tất cả key' })
  findAll() {
    return this.settingsService.getAll();
  }

  @Put()
  @ApiOperation({
    summary: 'Cập nhật một setting',
    description:
      'Cập nhật giá trị của một setting theo key. ' +
      'Chỉ các key được định nghĩa trong hệ thống mới được chấp nhận.',
  })
  @ApiBody({ type: UpsertSettingDto })
  @ApiOkResponse({ description: 'Settings map sau khi cập nhật' })
  upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.set(dto.key, dto.value);
  }

  @Delete('reset')
  @ApiOperation({
    summary: 'Reset tất cả settings về mặc định',
    description:
      'Xóa tất cả settings trong DB và khởi tạo lại với giá trị mặc định.',
  })
  @ApiOkResponse({ description: 'Settings map sau khi reset' })
  resetAll() {
    return this.settingsService.resetAll();
  }
}
