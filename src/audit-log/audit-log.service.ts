import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

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
}
