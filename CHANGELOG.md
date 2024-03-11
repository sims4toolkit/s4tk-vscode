# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4] - 2024/03/11
### Fixed
- Fixed issue with "Add New String" command on Windows

## [0.2.3] - 2024/03/10
### Changed
- Updated dependency on @s4tk/models (again)

## [0.2.2] - 2024/03/10
### Added
- Add command for renaming tuning files
### Changed
- Updated dependency on @s4tk/models

## [0.2.1] - 2024/02/07
### Changed
- Updated dependencies on @s4tk/models and @s4tk/xml-dom
### Fixed
- Fixed issue where formatting XML would sometimes erraneously put nodes on same line
- Fixed issue where certain SimDatas with adjacent booleans would serialize incorrectly

## [0.2.0] - 2023/06/03
### Added
- New command palette commands
  - "Convert Folder to S4TK Project"
  - "Refresh Project Index"
- New context menu commands
  - "Clone With New Name"
  - "Create Fragment for STBL"
- New features in tuning XML and SimData
  - Hover over `c="*"` to get link to relevant TDESC
  - CTRL/CMD click on tuning IDs to jump to their definitions, if in the current project
  - Diagnostics related to file meta data and structure
- New properties in S4TK Config
  - `buildInstructions.packages[*].duplicateFilesFrom`: Allows you to include all files from a previously built package in this one
  - `buildInstructions.packages[*].doNotGenerate`: Allows you to 'comment out' a package without causing build errors
  - `buildInstructions.packages[*].doNotWrite`: Allows you to still generate a file so it can be used by others, but not written itself
  - `buildSettings.allowResourceKeyOverrides`: Safeguard against writing multiple resources with the same key into the same package
  - `releaseSettings.zips`: List of ZIP files to build for release.
  - `stringTableSettings.allowStringKeyOverrides`: Safeguard against writing multiple string entries with the same key into the same string table
  - `workspaceSettings`: Object containing settings related to the workspace itself, but not the build script
  - `workspaceSettings.overrideIndexRoot`: Allows you to override which folder is used as the root for indexing
- New properties in STBL JSON
  - `fragment`: Marks a STBL as a part of another STBL, so its entries will either overwrite or be appended to another STBL rather than replacing the STBL entirely (intended for use with `duplicateFilesFrom`)
- New supported file types
  - TGI file types with the extension `.deleted` will now be built with the deleted record compression, and will be rendered in `*.package` files
### Changed
- If two resources being written to the same package have the same resource key, a fatal error will occur if `allowResourceKeyOverrides` is false, or it will override the existing file if `allowResourceKeyOverrides` is true
- `*.package` renderer now displays string tables as the configured STBL JSON type with metadata rather than always as an array without metadata
- Multiple ZIPs are now supported in release mode, this is a breaking change due to a different required setup within `releaseSettings`
### Fixed
- "Copy as XML Reference" command should now show up on all tuning XML files
- Content-changing CodeLenses will no longer appear in read-only documents
- S4TK configs and all related commands now work properly with multiple workspace folders
### Removed
- All properties of `releaseSettings` in the S4TK config except for `overrideDestinations`

## [0.1.0] - 2023/05/29
### Added
- First release ([view initial features](https://vscode.sims4toolkit.com/#/updates/0-1-0)).
