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

export const SNOOZE_LABEL: Record<SnoozeDuration, string> = {
  [SnoozeDuration.FIVE_MINUTES]: '5 phút',
  [SnoozeDuration.FIFTEEN_MINUTES]: '15 phút',
  [SnoozeDuration.THIRTY_MINUTES]: '30 phút',
  [SnoozeDuration.ONE_HOUR]: '1 giờ',
  [SnoozeDuration.ONE_DAY]: '1 ngày',
};

export const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration; description: string }[] = [
  { label: '5 phút', value: SnoozeDuration.FIVE_MINUTES, description: 'Snooze trong 5 phút' },
  { label: '15 phút', value: SnoozeDuration.FIFTEEN_MINUTES, description: 'Snooze trong 15 phút' },
  { label: '30 phút', value: SnoozeDuration.THIRTY_MINUTES, description: 'Snooze trong 30 phút' },
  { label: '1 giờ', value: SnoozeDuration.ONE_HOUR, description: 'Snooze trong 1 giờ' },
  { label: '1 ngày', value: SnoozeDuration.ONE_DAY, description: 'Snooze trong 1 ngày' },
];

export class SnoozeSymbolDto {
  @ApiProperty({
    enum: SnoozeDuration,
    description: 'Thời gian snooze cảnh báo',
    example: SnoozeDuration.FIFTEEN_MINUTES,
  })
  @IsEnum(SnoozeDuration)
  duration: SnoozeDuration;
}
