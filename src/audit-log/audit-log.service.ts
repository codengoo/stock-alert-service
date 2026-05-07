import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

export interface AuditLogDiff {
  key: string;
  before: unknown;
  after: unknown;
}

const SKIP_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

export interface AuditLogEntry {
  action: string;
  collection: string;
  target?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(entry: AuditLogEntry, session?: ClientSession): Promise<void> {
    if (session) {
      await this.auditLogModel.create([entry], { session });
    } else {
      await this.auditLogModel.create(entry);
    }
  }

  async findAll(limit = 100): Promise<AuditLog[]> {
    return this.auditLogModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findByCollection(collection: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ collection })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findByTarget(collection: string, target: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ collection, target })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  diffRecords(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined,
  ): AuditLogDiff[] {
    const isObj = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === 'object' && !Array.isArray(v);

    if (!isObj(before) && !isObj(after)) return [];

    const keys = new Set([
      ...Object.keys(isObj(before) ? before : {}),
      ...Object.keys(isObj(after) ? after : {}),
    ]);

    const diffs: AuditLogDiff[] = [];
    for (const key of keys) {
      if (SKIP_FIELDS.has(key)) continue;
      const bVal = isObj(before) ? before[key] : undefined;
      const aVal = isObj(after) ? after[key] : undefined;
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        // Skip if both sides are null/undefined
        if (bVal == null && aVal == null) continue;
        diffs.push({ key, before: bVal, after: aVal });
      }
    }
    return diffs;
  }
}
