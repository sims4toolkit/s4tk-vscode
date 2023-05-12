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
  },
  hashing: {
    text: "s4tk.hashing.text",
    text32: "s4tk.hashing.text32",
    text64: "s4tk.hashing.text64",
    random: "s4tk.hashing.randomFnv",
    random32: "s4tk.hashing.randomFnv32",
    random64: "s4tk.hashing.randomFnv64",
  },
  stblJson: {
    addEntry: "s4tk.stblJson.addEntry",
    addMetaData: "s4tk.stblJson.addMetaData",
    copyEntry: "s4tk.stblJson.copyEntry",
    toArray: "s4tk.stblJson.toArray",
    toObject: "s4tk.stblJson.toObject",
  },
  ts4Files: {
    createStblBinary: "s4tk.ts4Files.createStblBinary",
    createStblJson: "s4tk.ts4Files.createStblJson",
  },
  tuning: {
    format: "s4tk.tuning.format",
    overrideGroup: "s4tk.tuning.overrideGroup",
    overrideInstance: "s4tk.tuning.overrideInstance",
    overrideType: "s4tk.tuning.overrideType",
  },
  workspace: {
    build: "s4tk.workspace.build",
    buildDryRun: "s4tk.workspace.buildDryRun",
    buildRelease: "s4tk.workspace.buildRelease",
    createConfig: "s4tk.workspace.createConfig",
    createWorkspace: "s4tk.workspace.createWorkspace",
    reloadConfig: "s4tk.workspace.reloadConfig",
    setDefaultStbl: "s4tk.workspace.setDefaultStbl",
    addNewString: "s4tk.workspace.addNewString",
  },
};

export const EDITOR = {
  package: "s4tk.editor.package",
  stblBinary: "s4tk.editor.stblBinary",
};

export const FILENAME = {
  config: "s4tk.config.json",
};

export const LINK = {
  help: "https://frankkmods.com/#/contact",
  issues: "https://github.com/sims4toolkit/s4tk-vscode/issues",
};
