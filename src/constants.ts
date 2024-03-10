/**
 * VSCode identifiers for S4TK contexts.
 */
export namespace S4TKContext {
  export const workspace = {
    active: "s4tk.workspace.active",
  };
}

/**
 * VSCode identifiers for S4TK commands.
 */
export namespace S4TKCommand {
  export const config = {
    addPackage: "s4tk.config.addPackage",
  };

  export const hashing = {
    text: "s4tk.hashing.text",
    text32: "s4tk.hashing.text32",
    text64: "s4tk.hashing.text64",
    random: "s4tk.hashing.random",
    random32: "s4tk.hashing.random32",
    random64: "s4tk.hashing.random64",
  };

  export const stblJson = {
    addEntry: "s4tk.stblJson.addEntry",
    addMetaData: "s4tk.stblJson.addMetaData",
    copyEntry: "s4tk.stblJson.copyEntry",
    toArray: "s4tk.stblJson.toArray",
    toObject: "s4tk.stblJson.toObject",
  };

  export const ts4Files = {
    createStblBinary: "s4tk.ts4Files.createStblBinary",
    createStblJson: "s4tk.ts4Files.createStblJson",
  };

  export const tuning = {
    copyAsXml: "s4tk.tuning.copyAsXml",
    cloneNewName: "s4tk.tuning.cloneNewName",
    format: "s4tk.tuning.format",
    overrideGroup: "s4tk.tuning.overrideGroup",
    overrideInstance: "s4tk.tuning.overrideInstance",
    overrideType: "s4tk.tuning.overrideType",
    renameTuning: "s4tk.tuning.renameTuning",
  };

  export const workspace = {
    build: "s4tk.workspace.build",
    buildDryRun: "s4tk.workspace.buildDryRun",
    buildRelease: "s4tk.workspace.buildRelease",
    createConfig: "s4tk.workspace.createConfig",
    createWorkspace: "s4tk.workspace.createWorkspace",
    reloadConfig: "s4tk.workspace.reloadConfig",
    setDefaultStbl: "s4tk.workspace.setDefaultStbl",
    createStblFragment: "s4tk.workspace.createStblFragment",
    addNewString: "s4tk.workspace.addNewString",
    folderToProject: "s4tk.workspace.folderToProject",
    refreshIndex: "s4tk.workspace.refreshIndex",
  };
}

/**
 * VSCode identifiers for S4TK custom editors.
 */
export namespace S4TKEditor {
  export const dbpf = "s4tk.editor.package";
  export const stbl = "s4tk.editor.stblBinary";
}

/**
 * Constants for unique file names.
 */
export namespace S4TKFilename {
  export const config = "s4tk.config.json";
  export const buildSummary = "BuildSummary.json";
}

/**
 * Constants for links.
 */
export namespace S4TKLink {
  export const help = "https://frankkmods.com/#/contact";
  export const issues = "https://github.com/sims4toolkit/s4tk-vscode/issues";
}
