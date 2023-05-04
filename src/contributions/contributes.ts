// These should match everything listed in "contributes"
// This is just so that identifiers for contributions can be type-safe

export const COMMAND = {
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
