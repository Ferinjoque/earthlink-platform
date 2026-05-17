import { Entity } from './Entity';

export class Supplier extends Entity {
  readonly organizationId: string;
  readonly name: string;
  readonly category: string;
  readonly contactEmail: string;

  constructor(props: {
    id: string;
    organizationId: string;
    name: string;
    category: string;
    contactEmail: string;
    createdAt: Date;
  }) {
    super(props.id, props.createdAt);
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.category = props.category;
    this.contactEmail = props.contactEmail;
  }
}
