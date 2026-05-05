import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as _ from 'lodash';
import { Connection, Model } from 'mongoose';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SettingDocument, SettingEntity } from '../schemas/setting.schema';

@Injectable()
export class SettingModelService<V extends object> {
  constructor(
    @InjectModel(SettingEntity.name)
    private readonly settingModel: Model<SettingDocument>,
    private readonly connection: Connection,
    private readonly auditLogService: AuditLogService,
    private readonly DEFAULT: V,
    private readonly collectionName: string = 'settings',
  ) {}

  async get<K extends keyof V>(key: K): Promise<V[K]> {
    const setting = await this.settingModel
      .findOne({ key: key as string })
      .lean();
    return _.defaultsDeep({}, setting?.value || {}, this.DEFAULT[key]) as V[K];
  }

  async set<K extends keyof V>(key: K, value: Partial<V[K]>) {
    const before = await this.get(key);
    const merge = _.merge({}, this.DEFAULT[key], before, value);
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.settingModel.updateOne(
        { key: key as string },
        { $set: { value: merge, updatedAt: new Date() } },
        { upsert: true, session },
      );
      await this.auditLogService.log(
        {
          action: 'update',
          collection: this.collectionName,
          target: key as string,
          before: before as unknown as Record<string, unknown>,
          after: merge as unknown as Record<string, unknown>,
        },
        session,
      );
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async reset(defaultValue: Partial<V> = {}) {
    const entries = Object.entries(this.DEFAULT).map(([key, value]) => ({
      key,
      value: _.merge({}, value, defaultValue[key as keyof V]),
    }));
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.settingModel.deleteMany({}, { session });
      await this.settingModel.insertMany(entries, { session });
      await this.auditLogService.log(
        {
          action: 'reset',
          collection: this.collectionName,
          after: Object.fromEntries(entries.map((e) => [e.key, e.value])),
        },
        session,
      );
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
