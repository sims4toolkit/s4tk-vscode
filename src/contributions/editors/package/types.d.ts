/**
 * Messages sent from the renderer to the provider.
 */
export type PackageInMessage = {
  readonly type: 'ready';
};

/**
 * Messages sent from the provider to the renderer.
 */
export type PackageOutMessage = {
  readonly type: 'init';
  readonly body: PackageEntryInfo[];
};

/**
 * Information to display for each entry in a package.
 */
interface PackageEntryInfo {
  key: string;
  details: string;
  warnings?: string[];
}
