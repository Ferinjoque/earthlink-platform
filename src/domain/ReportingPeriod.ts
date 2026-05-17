import { Entity } from './Entity';

export type PeriodStatus = 'open' | 'calculating' | 'under_review' | 'locked';

export class ReportingPeriod extends Entity {
  readonly supplierId: string;
  readonly label: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: PeriodStatus;

  constructor(props: {
    id: string;
    supplierId: string;
    label: string;
    startDate: Date;
    endDate: Date;
    status: PeriodStatus;
    createdAt: Date;
  }) {
    super(props.id, props.createdAt);
    this.supplierId = props.supplierId;
    this.label = props.label;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status;
  }

  isEditable(): boolean {
    return this.status === 'open';
  }

  isLocked(): boolean {
    return this.status === 'locked';
  }
}
