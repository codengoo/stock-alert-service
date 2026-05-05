import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SettingEntity, SettingSchema } from '../schemas/setting.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SettingEntity.name, schema: SettingSchema }]),
    AuditLogModule,
  ],
  controllers: [SettingsController],
  providers: [ SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
