export type PackageInMessage = {
  readonly type: 'ready';
} | {
  readonly type: 'view';
  readonly body: number;
};

export type PackageOutMessage = {
  readonly type: 'init';
  readonly body: PackageIndex;
};

interface PackageIndex {
  size: number;
  groups: PackageIndexGroup[];
}

interface PackageIndexGroup {
  title: string;
  entries: PackageIndexEntry[];
}

interface PackageIndexEntry {
  id: number;
  key: string;
  filename: string;
  linked?: PackageIndexEntry[];
}
