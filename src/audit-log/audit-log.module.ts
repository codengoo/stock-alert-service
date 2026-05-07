import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogSlashCommandService } from '../discord/commands/audit-log.interaction';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  providers: [AuditLogService, AuditLogSlashCommandService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
