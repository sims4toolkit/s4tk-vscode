/**
 * Messages sent from the renderer to the provider.
 */
export type StringTableInMessage = {
  readonly type: 'ready' | 'convertToJson';
};

/**
 * Messages sent from the provider to the renderer.
 */
export type StringTableOutMessage = {
  readonly type: 'init';
  readonly body: {
    key: string;
    value: string;
  }[];
};
