import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingDocument = SettingEntity & Document;

@Schema({ collection: 'settings', timestamps: true })
export class SettingEntity {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: unknown;

  @Prop()
  description?: string;
}

export const SettingSchema = SchemaFactory.createForClass(SettingEntity);
