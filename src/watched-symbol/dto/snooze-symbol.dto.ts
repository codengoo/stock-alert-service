import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SnoozeDuration {
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d',
}

export const SNOOZE_DURATION_MS: Record<SnoozeDuration, number> = {
  [SnoozeDuration.FIVE_MINUTES]: 5 * 60_000,
  [SnoozeDuration.FIFTEEN_MINUTES]: 15 * 60_000,
  [SnoozeDuration.THIRTY_MINUTES]: 30 * 60_000,
  [SnoozeDuration.ONE_HOUR]: 60 * 60_000,
  [SnoozeDuration.ONE_DAY]: 24 * 60 * 60_000,
};

export class SnoozeSymbolDto {
  @ApiProperty({
    enum: SnoozeDuration,
    description: 'Thời gian snooze cảnh báo',
    example: SnoozeDuration.FIFTEEN_MINUTES,
  })
  @IsEnum(SnoozeDuration)
  duration: SnoozeDuration;
}
