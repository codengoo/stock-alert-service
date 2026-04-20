import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SETTINGS_CONFIG, SettingsMap } from './settings.config';
import { SettingsService } from './settings.service';
@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy toàn bộ settings',
    description:
      'Trả về tất cả settings dưới dạng key-value object. ' +
      'Các key chưa có trong DB sẽ được điền giá trị mặc định.\n\n' +
      '| Key | Mô tả | Mặc định |\n' +
      '|-----|-------|----------|\n' +
      Object.entries(SETTINGS_CONFIG)
        .map(([k, v]) => `| \`${k}\` | ${v.description} | \`${v.defaultValue}\` |`)
        .join('\n'),
  })
  @ApiOkResponse({ description: 'Settings map với đầy đủ tất cả key' })
  findAll(): Promise<SettingsMap> {
    return this.settingsService.findAll();
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
  upsert(@Body() dto: UpsertSettingDto): Promise<SettingsMap> {
    return this.settingsService.upsert(dto);
  }

  @Delete('reset')
  @ApiOperation({
    summary: 'Reset tất cả settings về mặc định',
    description: 'Xóa tất cả settings trong DB và khởi tạo lại với giá trị mặc định.',
  })
  @ApiOkResponse({ description: 'Settings map sau khi reset' })
  resetAll(): Promise<SettingsMap> {
    return this.settingsService.resetAll();
  }
}
