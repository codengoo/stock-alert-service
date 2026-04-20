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
  ) {}

  async get<K extends keyof V>(key: K, DEFAULT: V[K]): Promise<V[K]> {
    const setting = await this.settingModel.findOne({ key: key as string }).lean();
    return _.defaultsDeep({}, setting?.value || {}, DEFAULT) as V[K];
  }

  async set<K extends keyof V>(key: K, value: Partial<V[K]>, DEFAULT: V[K]) {
    const old = await this.get(key, DEFAULT);
    const merge = _.merge({}, DEFAULT, old, value);
    await this.settingModel.updateOne(
      { key: key as string },
      { $set: { value: merge, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async reset(DEFAULT: V) {
    await this.settingModel.deleteMany({});
    await this.settingModel.insertMany(
      Object.keys(DEFAULT).map((key) => ({
        key,
        value: DEFAULT[key as keyof V],
      })),
    );
  }
}
