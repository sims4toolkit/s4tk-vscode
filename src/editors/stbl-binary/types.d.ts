export type StringTableEdit = {
  readonly op: 'create';
  readonly id?: number;
} | {
  readonly op: 'update';
  readonly id: number;
  readonly key?: string;
  readonly value?: string;
} | {
  readonly op: 'delete';
  readonly id: number;
};

export type StringTableJson = {
  readonly id: number;
  readonly key: string;
  readonly value: string;
}[];

export type StringTableInMessage = {
  readonly type: 'edit';
  readonly body: StringTableEdit;
};

export type StringTableOutMessage = {
  readonly type: 'edit';
  readonly body: StringTableEdit;
} | {
  readonly type: 'init';
  readonly body: StringTableJson;
};
