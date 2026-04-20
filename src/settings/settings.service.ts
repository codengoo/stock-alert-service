import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SettingDocument, SettingEntity } from '../schemas/setting.schema';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import {
  SETTINGS_CONFIG,
  SETTING_KEYS,
  SettingKey,
  SettingsMap,
} from './settings.config';
import { SettingModelService } from './setting-model.service';

@Injectable()
export class SettingsService extends SettingModelService<SettingsMap> {
  constructor(
    @InjectModel(SettingEntity.name) settingModel: Model<SettingDocument>,
  ) {
    super(settingModel);
  }

  async findAll(): Promise<SettingsMap> {
    const entries = await Promise.all(
      SETTING_KEYS.map(async (key) => [
        key,
        await this.get(key, SETTINGS_CONFIG[key].defaultValue as SettingsMap[typeof key]),
      ]),
    );
    return Object.fromEntries(entries) as SettingsMap;
  }

  async getValue<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
    return this.get(key, SETTINGS_CONFIG[key].defaultValue as SettingsMap[K]);
  }

  async upsert(dto: UpsertSettingDto): Promise<SettingsMap> {
    await this.set(
      dto.key,
      dto.value as Partial<SettingsMap[typeof dto.key]>,
      SETTINGS_CONFIG[dto.key].defaultValue as SettingsMap[typeof dto.key],
    );
    return this.findAll();
  }

  async resetAll(): Promise<SettingsMap> {
    const DEFAULT = Object.fromEntries(
      SETTING_KEYS.map((key) => [key, SETTINGS_CONFIG[key].defaultValue]),
    ) as SettingsMap;
    await this.reset(DEFAULT);
    return this.findAll();
  }
}

