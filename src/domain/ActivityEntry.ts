import { Entity } from './Entity';
import type { ActivityKind, ActivityRecord, Unit } from '../calc/types';
import type { ActivityEntryStatus, EmissionSourceType } from '../types/database';

export class ActivityEntry extends Entity {
  readonly reportingPeriodId: string;
  readonly sourceType: EmissionSourceType;
  readonly activityKind: ActivityKind;
  readonly rawQuantity: number;
  readonly rawUnit: Unit;
  readonly status: ActivityEntryStatus;
  readonly submittedAt: Date | null;
  readonly submittedBy: string | null;

  constructor(props: {
    id: string;
    reportingPeriodId: string;
    sourceType: EmissionSourceType;
    activityKind: ActivityKind;
    rawQuantity: number;
    rawUnit: Unit;
    status: ActivityEntryStatus;
    submittedAt: Date | null;
    submittedBy: string | null;
    createdAt: Date;
  }) {
    super(props.id, props.createdAt);
    this.reportingPeriodId = props.reportingPeriodId;
    this.sourceType = props.sourceType;
    this.activityKind = props.activityKind;
    this.rawQuantity = props.rawQuantity;
    this.rawUnit = props.rawUnit;
    this.status = props.status;
    this.submittedAt = props.submittedAt;
    this.submittedBy = props.submittedBy;
  }

  toActivityRecord(supplierId: string): ActivityRecord {
    return {
      id: this.id,
      periodId: this.reportingPeriodId,
      supplierId,
      activity: this.activityKind,
      rawValue: this.rawQuantity,
      rawUnit: this.rawUnit,
      submittedAt: this.submittedAt ?? this.createdAt,
    };
  }
}
