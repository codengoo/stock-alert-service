import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SettingDocument, SettingEntity } from '../schemas/setting.schema';
import { DEFAULT_SETTING } from './constants';
import { ISettings } from './interfaces';
import { SettingModelService } from './setting-model.service';

@Injectable()
export class SettingsService extends SettingModelService<ISettings> {
  constructor(
    @InjectModel(SettingEntity.name) settingModel: Model<SettingDocument>,
  ) {
    super(settingModel, DEFAULT_SETTING);
  }

  async getAll(): Promise<ISettings> {
    const [thresholdSettings, discordSettings] = await Promise.all([
      this.getThresholdSettings(),
      this.getDiscordSettings(),
    ]);
    return {
      threshold: thresholdSettings,
      discord: discordSettings,
    };
  }

  async getThresholdSettings() {
    return this.get('threshold');
  }

  async getDiscordSettings() {
    return this.get('discord');
  }

  async updateThresholdSettings(value: Partial<ISettings['threshold']>) {
    return this.set('threshold', value);
  }

  async updateDiscordSettings(value: Partial<ISettings['discord']>) {
    return this.set('discord', value);
  }

  async resetAll() {
    await this.reset();
    return this.getAll();
  }
}
