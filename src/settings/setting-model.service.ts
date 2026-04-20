import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as _ from 'lodash';
import { Model } from 'mongoose';
import { SettingDocument, SettingEntity } from '../schemas/setting.schema';

@Injectable()
export class SettingModelService<V extends object> {
  constructor(
    @InjectModel(SettingEntity.name)
    private readonly settingModel: Model<SettingDocument>,
    private readonly DEFAULT: V,
  ) {}

  async get<K extends keyof V>(key: K): Promise<V[K]> {
    const setting = await this.settingModel
      .findOne({ key: key as string })
      .lean();
    return _.defaultsDeep({}, setting?.value || {}, this.DEFAULT[key]) as V[K];
  }

  async set<K extends keyof V>(key: K, value: Partial<V[K]>) {
    const old = await this.get(key);
    const merge = _.merge({}, this.DEFAULT[key], old, value);
    await this.settingModel.updateOne(
      { key: key as string },
      { $set: { value: merge, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async reset(defaultValue: Partial<V> = {}) {
    await this.settingModel.deleteMany({});
    const entries = Object.entries(this.DEFAULT).map(([key, value]) => ({
      key,
      value: _.merge({}, value, defaultValue[key as keyof V]),
    }));
    await this.settingModel.insertMany(entries);
  }
}
