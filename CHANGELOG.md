# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2023/06/??
### Added
- New command palette commands
  - "Convert Folder to S4TK Project"
  - "Refresh Project Index"
- New context menu commands
  - "Clone With New Name"
  - "Create Fragment for STBL"
- New features in tuning XML
  - Hover over `c="*"` to get link to relevant TDESC
  - CTRL/CMD click on tuning IDs to jump to their definitions, if in the current project
- New properties in S4TK Config
  - `buildInstructions.packages[*].duplicateFilesFrom`: Allows you to include all files from a previously built package in this one
  - `buildSettings.allowResourceKeyOverrides`: Safeguard against writing multiple resources with the same key into the same package
  - `stringTableSettings.allowStringKeyOverrides`: Safeguard against writing multiple string entries with the same key into the same string table
- New properties in STBL JSON
  - `fragment`: Marks a STBL as a part of another STBL, so its entries will either overwrite or be appended to another STBL rather than replacing the STBL entirely (intended for use with `duplicateFilesFrom`)
### Changed
- If two resources being written to the same package have the same resource key, a fatal error will occur if `allowResourceKeyOverrides` is false, or it will override the existing file if `allowResourceKeyOverrides` is true
- `*.package` renderer now displays string tables as the configured STBL JSON type with metadata rather than always as an array without metadata.
### Fixed
- "Copy as XML Reference" command should now show up on all tuning XML files

## [0.1.0] - 2023/05/29
### Added
- First release ([view initial features](https://vscode.sims4toolkit.com/#/updates/0-1-0)).
