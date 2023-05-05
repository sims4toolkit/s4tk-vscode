// All VS Code identifiers should be defined in this file so that the strings
// are only ever written once, and then referred to in a type-safe way and can
// be easily changed if needed.

export const COMMAND = {
  config: {
    addPackage: "s4tk.config.addPackage",
    build: "s4tk.config.build",
    dryRun: "s4tk.config.dryRun",
  },
  hashing: {
    fnv31: "s4tk.hashing.fnv31",
    fnv32: "s4tk.hashing.fnv32",
    fnv64: "s4tk.hashing.fnv64",
    random31: "s4tk.hashing.random31",
    random32: "s4tk.hashing.random32",
    random64: "s4tk.hashing.random64",
  },
  ts4Files: {
    createStblBinary: "s4tk.ts4Files.createStblBinary",
    createStblJson: "s4tk.ts4Files.createStblJson",
  },
  workspace: {
    createWorkspace: "s4tk.workspace.createWorkspace",
    setDefaultStbl: "s4tk.workspace.setDefaultStbl",
  },
};

export const EDITOR = {
  stblBinary: "s4tk.editor.stblBinary",
};

export const FILES = {
  config: "s4tk.config.json",
};
