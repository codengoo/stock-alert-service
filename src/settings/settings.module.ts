import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingEntity, SettingSchema } from '../schemas/setting.schema';
import { SettingModelService } from './setting-model.service';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SettingEntity.name, schema: SettingSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingModelService, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
