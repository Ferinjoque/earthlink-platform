import { Entity } from './Entity';

export class Organization extends Entity {
  readonly name: string;
  readonly industry: string;
  readonly ruc: string;

  constructor(props: { id: string; name: string; industry: string; ruc: string; createdAt: Date }) {
    super(props.id, props.createdAt);
    this.name = props.name;
    this.industry = props.industry;
    this.ruc = props.ruc;
  }
}
