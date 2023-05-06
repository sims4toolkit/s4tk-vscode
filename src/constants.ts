// All VS Code identifiers should be defined in this file so that the strings
// are only ever written once, and then referred to in a type-safe way and can
// be easily changed if needed.

export const CONTEXT = {
  workspace: {
    active: "s4tk.workspace.active",
  },
};

export const COMMAND = {
  config: {
    addPackage: "s4tk.config.addPackage",
    build: "s4tk.config.build",
    dryRun: "s4tk.config.dryRun",
  },
  hashing: {
    text: "s4tk.hashing.text",
    text32: "s4tk.hashing.text32",
    text64: "s4tk.hashing.text64",
    random: "s4tk.hashing.randomFnv",
    random32: "s4tk.hashing.randomFnv32",
    random64: "s4tk.hashing.randomFnv64",
  },
  ts4Files: {
    createStblBinary: "s4tk.ts4Files.createStblBinary",
    createStblJson: "s4tk.ts4Files.createStblJson",
  },
  workspace: {
    createWorkspace: "s4tk.workspace.createWorkspace",
    reloadConfig: "s4tk.workspace.reloadConfig",
    setDefaultStbl: "s4tk.workspace.setDefaultStbl",
  },
};

export const EDITOR = {
  stblBinary: "s4tk.editor.stblBinary",
};

export const FILENAME = {
  config: "s4tk.config.json",
};

export const LINK = {
  help: "https://frankkmods.com/#/contact",
};
