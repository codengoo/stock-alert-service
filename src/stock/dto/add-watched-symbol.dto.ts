import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddWatchedSymbolDto {
  @ApiProperty({
    description: 'Mã cổ phiếu (tự động chuyển thành chữ hoa)',
    example: 'VCB',
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiPropertyOptional({
    description: 'Bật/tắt theo dõi mã này',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Ghi chú tùy chọn',
    example: 'Ngân hàng Vietcombank',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
