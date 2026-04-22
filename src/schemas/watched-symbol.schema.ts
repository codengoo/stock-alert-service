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

  /** Per-symbol threshold overrides — null means use global default from Settings */
  @Prop({ type: Number, default: null })
  alertThresholdPercent?: number | null;

  @Prop({ type: Number, default: null })
  stopLossPercent?: number | null;

  @Prop({ type: Number, default: null })
  takeProfitPercent?: number | null;

  /** Reference buy-price used for stop-loss / take-profit calculation */
  @Prop({ type: Number, default: null })
  buyPrice?: number | null;

  /** Expected buy price — triggers a buy-signal alert when market price ≤ this value */
  @Prop({ type: Number, default: null })
  expectBuyPrice?: number | null;

  /** Suppress alerts until this timestamp (set by user snooze or auto-snooze after alert) */
  @Prop({ type: Date, default: null })
  snoozeUntil?: Date | null;
}

export const WatchedSymbolSchema = SchemaFactory.createForClass(WatchedSymbol);
