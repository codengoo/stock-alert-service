import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WatchedSymbolDocument = WatchedSymbol & Document;

@Schema({ collection: 'watched_symbols', timestamps: true })
export class WatchedSymbol {
  @Prop({ required: true, unique: true, uppercase: true, index: true })
  symbol: string;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  note?: string;
}

export const WatchedSymbolSchema = SchemaFactory.createForClass(WatchedSymbol);
