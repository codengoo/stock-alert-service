import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { DEFAULT_SETTING } from '../constants';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Key của setting cần cập nhật',
    example: 'threshold',
  })
  @IsString()
  key:  keyof typeof DEFAULT_SETTING;

  @ApiProperty({
    description: 'Giá trị mới của setting (string, number, boolean hoặc object)',
    example: 3,
  })
  @IsNotEmpty()
  value: unknown;
}
