import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingDocument = Setting & Document;

@Schema({ collection: 'settings', timestamps: true })
export class Setting {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: unknown;

  @Prop()
  description?: string;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
