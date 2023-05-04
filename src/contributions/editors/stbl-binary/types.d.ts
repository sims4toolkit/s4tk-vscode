export type StringTableInMessage = {
  readonly type: 'ready' | 'convertToJson';
};

export type StringTableOutMessage = {
  readonly type: 'init';
  readonly body: object;
};