import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  /** Hành động: create | update | delete | snooze | clear_snooze | list | reset */
  @Prop({ required: true, index: true })
  action: string;

  /** Collection bị tác động: watched_symbols | settings */
  @Prop({ required: true, index: true })
  collection: string;

  /** Đối tượng bị tác động (symbol name, settings key, ...) */
  @Prop({ index: true })
  target?: string;

  /** Trạng thái trước khi thay đổi */
  @Prop({ type: Object })
  before?: Record<string, unknown>;

  /** Trạng thái sau khi thay đổi */
  @Prop({ type: Object })
  after?: Record<string, unknown>;

  /** Thông tin bổ sung */
  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
