import * as vscode from 'vscode';
import { formatAsHexString } from '@s4tk/hashing/formatting';
import { SimDataGroup, TuningResourceType } from '@s4tk/models/enums';
import { COMMAND } from '#constants';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import { XmlMetaData, getXmlKeyOverrides, inferXmlMetaData } from '#helpers/xml';
import BaseCodeLensProvider from './base-codelens';

/**
 * Provides CodeLenses for XML files, including:
 * - Override Type
 * - Override Group
 * - Override Instance
 */
export default class TuningCodeLensProvider extends BaseCodeLensProvider {
  constructor() { super(); }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/*.xml",
      },
      new TuningCodeLensProvider()
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const editor = vscode.window.activeTextEditor;
    if (!(S4TKWorkspace.active && editor)) return [];
    if (editor.document.uri.scheme === "s4tk") return [];

    this._codeLenses = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Format",
        tooltip: "Format this XML document.",
        command: COMMAND.tuning.format,
        arguments: [editor],
      }),
    ];

    await this._addKeyOverrideCodeLenses(editor);

    return this._codeLenses;
  }

  private async _addKeyOverrideCodeLenses(editor: vscode.TextEditor) {
    const metadata = inferXmlMetaData(editor.document);
    if (metadata.root === "unknown") return;
    await this._fillDefaultMetaData(metadata, editor.document.uri);
    const overrides = getXmlKeyOverrides(editor.document);
    const rangeZero = new vscode.Range(0, 0, 0, 0);

    if (overrides?.type == undefined) {
      const typeDisplay = metadata.key.type != undefined
        ? formatAsHexString(metadata.key.type, 8, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(rangeZero, {
          title: `Type (${typeDisplay})`,
          tooltip: this._getTypeOverrideTooltip(metadata),
          command: COMMAND.tuning.overrideType,
          arguments: [editor, metadata.key.type],
        })
      );
    }

    if (overrides?.group == undefined) {
      const groupDisplay = metadata.key.group != undefined
        ? formatAsHexString(metadata.key.group, 8, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `Group (${groupDisplay})`,
          tooltip: this._getGroupOverrideTooltip(metadata),
          command: COMMAND.tuning.overrideGroup,
          arguments: [editor, metadata.key.group],
        })
      );
    }

    if (overrides?.instance == undefined) {
      const instDisplay = metadata.key.instance != undefined
        ? formatAsHexString(metadata.key.instance, 16, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `Instance (${instDisplay})`,
          tooltip: this._getInstanceOverrideTooltip(metadata),
          command: COMMAND.tuning.overrideInstance,
          arguments: [editor, metadata.key.instance],
        })
      );
    }
  }

  private async _fillDefaultMetaData(metadata: XmlMetaData, uri: vscode.Uri) {
    try {
      if (metadata.root === "instance" || metadata.root === "module") {
        metadata.key.group = 0;
      } else if (metadata.root === "simdata") {
        const tuningUri = uri.with({ path: uri.path.replace(/\.SimData\.xml$/, ".xml") });
        const tuningContent = (await vscode.workspace.fs.readFile(tuningUri)).toString();
        const tuningKey = getXmlKeyOverrides(tuningContent) ?? {};
        const inferredKey = inferXmlMetaData(tuningContent).key;
        tuningKey.type ??= inferredKey.type;
        if (tuningKey.type) metadata.key.group = SimDataGroup.getForTuning(tuningKey.type);
        tuningKey.instance ??= inferredKey.instance;
        if (tuningKey.instance) metadata.key.instance = tuningKey.instance;
      }
    } catch (_) { }
  }

  private _getTypeOverrideTooltip(metadata: XmlMetaData): string | undefined {
    switch (metadata.root) {
      case "instance":
        return metadata.key.type && (metadata.key.type in TuningResourceType)
          ? `S4TK has inferred the type ${formatAsHexString(metadata.key.type, 8, false)} (${TuningResourceType[metadata.key.type]}) for this file. If this is incorrect, you can override it.`
          : "S4TK could not infer a valid type for this file. This is either because your `i` attribute is missing or incorrect, or because a new tuning type has been added that S4TK does not yet recognize. If you are sure that your `i` is valid, you can override the type until S4TK gets updated.";
      case "simdata":
        return "S4TK will use the type 545AC67A (SimData) for this file. If this is incorrect, you can override it.";
      case "module":
        return "S4TK will use the type 03B33DDF (Tuning) for this file. If this is incorrect, you can override it.";
    }
  }

  private _getGroupOverrideTooltip(metadata: XmlMetaData): string | undefined {
    switch (metadata.root) {
      case "instance":
      case "module":
        return "S4TK will use the group 00000000 for this file. If this is incorrect, you can override it.";
      case "simdata":
        return metadata.key.group && (metadata.key.group in SimDataGroup)
          ? `S4TK has inferred the group ${formatAsHexString(metadata.key.group, 8, false)} (${SimDataGroup[metadata.key.group]}) for this SimData, based on its paired tuning. If this is incorrect, you can override it.`
          : "Either this SimData does not have a paired tuning, or its type could not be resolved to a valid SimData group. You should ensure that a paired tuning with a valid type exists, and if this error does not go away, you can override the group.";
    }
  }

  private _getInstanceOverrideTooltip(metadata: XmlMetaData): string | undefined {
    switch (metadata.root) {
      case "instance":
      case "module":
        return metadata.key.instance != undefined
          ? `S4TK has inferred the instance ${formatAsHexString(metadata.key.instance, 16, false)} for this file. If this is incorrect, you can override it.`
          : "S4TK could not infer a valid instance for this file. This is likely because your `s` attribute is missing or incorrect. If you are sure that your `s` attribute is valid, you can override the instance.";
      case "simdata":
        return metadata.key.instance != undefined
          ? `S4TK has inferred the instance ${formatAsHexString(metadata.key.instance, 16, false)} for this SimData, based on its paired tuning. If this is incorrect, you can override it.`
          : "Either this SimData does not have a paired tuning, or its tuning ID could not be resolved. You should ensure that a paired tuning with a valid type exists, and if this error does not go away, you can override the instance.";
    }
  }
}
