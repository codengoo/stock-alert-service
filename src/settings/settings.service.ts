import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from '../schemas/setting.schema';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
  ) {}

  async findAll(): Promise<Setting[]> {
    return this.settingModel.find().lean().exec();
  }

  async findByKey(key: string): Promise<Setting> {
    const setting = await this.settingModel.findOne({ key }).lean().exec();
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return setting;
  }

  async getValue<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.settingModel.findOne({ key }).lean().exec();
    if (!setting) return defaultValue as T;
    return setting.value as T;
  }

  async upsert(dto: UpsertSettingDto): Promise<Setting> {
    return this.settingModel
      .findOneAndUpdate(
        { key: dto.key },
        { $set: { value: dto.value, description: dto.description } },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
  }

  async delete(key: string): Promise<void> {
    const result = await this.settingModel.deleteOne({ key }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Setting "${key}" not found`);
  }
}
