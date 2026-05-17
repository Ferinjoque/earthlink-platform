import { Entity } from './Entity';
import type { AnomalyDetector, AnomalySeverity } from '../types/database';

export class AnomalyFlag extends Entity {
  readonly activityEntryId: string;
  readonly detector: AnomalyDetector;
  readonly severity: AnomalySeverity;
  readonly zScore: number | null;
  readonly thresholdUsed: number | null;
  readonly message: string;
  readonly isResolved: boolean;
  readonly resolvedBy: string | null;
  readonly resolvedAt: Date | null;
  readonly flaggedAt: Date;

  constructor(props: {
    id: string;
    activityEntryId: string;
    detector: AnomalyDetector;
    severity: AnomalySeverity;
    zScore: number | null;
    thresholdUsed: number | null;
    message: string;
    isResolved: boolean;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    flaggedAt: Date;
    createdAt: Date;
  }) {
    super(props.id, props.createdAt);
    this.activityEntryId = props.activityEntryId;
    this.detector = props.detector;
    this.severity = props.severity;
    this.zScore = props.zScore;
    this.thresholdUsed = props.thresholdUsed;
    this.message = props.message;
    this.isResolved = props.isResolved;
    this.resolvedBy = props.resolvedBy;
    this.resolvedAt = props.resolvedAt;
    this.flaggedAt = props.flaggedAt;
  }

  isHigh(): boolean {
    return this.severity === 'high';
  }

  needsReview(): boolean {
    return !this.isResolved && this.severity !== 'low';
  }
}
