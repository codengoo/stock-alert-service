import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoldAlertService } from './gold-alert.service';

@ApiTags('Gold')
@Controller('gold')
export class GoldController {
  constructor(private readonly goldAlertService: GoldAlertService) {}

  @Post('send-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi báo cáo giá vàng thủ công',
    description: 'Trigger gửi ngay báo cáo giá vàng lên Discord (dùng để test).',
  })
  @ApiOkResponse({ description: 'Đã gửi báo cáo giá vàng lên Discord.' })
  async sendReport() {
    await this.goldAlertService.sendDailyGoldReport();
    return { message: 'Đã gửi báo cáo giá vàng lên Discord.' };
  }
}
