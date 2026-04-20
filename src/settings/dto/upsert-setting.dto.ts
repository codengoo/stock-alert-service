import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { SETTING_KEYS, SettingKey } from '../settings.config';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Key của setting cần cập nhật',
    enum: SETTING_KEYS,
    example: 'stock.alertThresholdPercent',
  })
  @IsString()
  @IsIn(SETTING_KEYS)
  key: SettingKey;

  @ApiProperty({
    description: 'Giá trị mới của setting (string, number, boolean hoặc object)',
    example: 3,
  })
  @IsNotEmpty()
  value: unknown;
}
