import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Tên định danh duy nhất của setting (dot-notation)',
    example: 'stock.alertThresholdPercent',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Giá trị của setting (string, number, boolean hoặc object)',
    example: 3,
  })
  @IsNotEmpty()
  value: unknown;

  @ApiPropertyOptional({
    description: 'Mô tả ý nghĩa của setting',
    example: 'Ngưỡng % biến động giá để kích hoạt cảnh báo Discord',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
