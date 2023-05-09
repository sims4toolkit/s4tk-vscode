/**
 * Messages sent from the renderer to the provider.
 */
export type PackageInMessage = {
  readonly type: 'ready';
} | {
  readonly type: 'view';
  readonly body: number;
};

/**
 * Messages sent from the provider to the renderer.
 */
export type PackageOutMessage = {
  readonly type: 'init';
  readonly body: PackageIndex;
};

/**
 * Information for rendering a single package entry's meta data.
 */
interface PackageIndexEntry {
  id: number;
  key: string;
  details: string;
  warnings?: string[];
}

/**
 * Information for rendering a package's index.
 */
interface PackageIndex {
  size: number;
  groups: {
    group: string;
    entries: PackageIndexEntry[]
  }[];
}
