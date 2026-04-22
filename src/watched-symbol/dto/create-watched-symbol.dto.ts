import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateWatchedSymbolDto {
  @ApiProperty({ description: 'Mã cổ phiếu (tự động viết hoa)', example: 'VCB' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiPropertyOptional({ description: 'Bật/tắt theo dõi mã này', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú tùy chọn', example: 'Ngân hàng Vietcombank' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    description: 'Ngưỡng % biến động để cảnh báo (null = dùng global setting)',
    example: 3,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  alertThresholdPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Ngưỡng % lỗ từ giá mua để kích hoạt stop-loss (null = dùng global setting)',
    example: 7,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  stopLossPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Ngưỡng % lời từ giá mua để kích hoạt take-profit (null = dùng global setting)',
    example: 15,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  takeProfitPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Giá mua tham chiếu dùng để tính stop-loss / take-profit',
    example: 85000,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  buyPrice?: number | null;

  @ApiPropertyOptional({
    description: 'Giá kỳ vọng mua vào — khi giá thị trường ≤ giá này sẽ gửi tín hiệu mua (null = không theo dõi)',
    example: 80000,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  expectBuyPrice?: number | null;
}
