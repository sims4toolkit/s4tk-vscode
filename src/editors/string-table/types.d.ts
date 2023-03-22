type StringTableOperation = 'create' | 'update' | 'delete';

export interface StringTableEdit {
  readonly op: StringTableOperation;
  readonly id: number;
  readonly key?: number;
  readonly value?: string;
}
