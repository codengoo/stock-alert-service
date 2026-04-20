import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateWatchedSymbolDto } from './create-watched-symbol.dto';

export class UpdateWatchedSymbolDto extends PartialType(
  OmitType(CreateWatchedSymbolDto, ['symbol'] as const),
) {}
