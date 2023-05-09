import * as vscode from 'vscode';
import { COMMAND } from '#constants';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import BaseCodeLensProvider from './base-codelens';
import { XmlMetaData, getXmlKeyOverrides, inferXmlMetaData } from '#helpers/xml';
import { formatAsHexString } from '@s4tk/hashing/formatting';
import { TuningResourceType } from '@s4tk/models/enums';

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

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
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

    this._addKeyOverrideCodeLenses(editor);

    return this._codeLenses;
  }

  private _addKeyOverrideCodeLenses(editor: vscode.TextEditor) {
    if (!S4TKWorkspace.showXmlKeyOverrideButtons) return;
    const metadata = inferXmlMetaData(editor.document);
    if (metadata.root === "unknown") return;
    const overrides = getXmlKeyOverrides(editor.document);
    const rangeZero = new vscode.Range(0, 0, 0, 0);

    if (overrides?.type == undefined) this._codeLenses.push(
      new vscode.CodeLens(rangeZero, {
        title: "Type",
        tooltip: this._getTypeOverrideTooltip(metadata),
        command: COMMAND.tuning.overrideType,
        arguments: [editor],
      })
    );

    if (overrides?.group == undefined) this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Group",
        tooltip: this._getGroupOverrideTooltip(metadata),
        command: COMMAND.tuning.overrideGroup,
        arguments: [editor],
      })
    );

    if (overrides?.instance == undefined) this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Instance",
        tooltip: this._getInstanceOverrideTooltip(metadata),
        command: COMMAND.tuning.overrideInstance,
        arguments: [editor],
      })
    );
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
        return "S4TK will infer this SimData's group based on its tuning's type at build time. If the output is incorrect, you can override it.";
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
        return "S4TK will infer this SimData's instance based on its tuning's instance at build time. If the output is incorrect, you can override it.";
    }
  }
}
