# Welcome to your Sims 4 Toolkit project!

Please read (or at least skim...) this file if you are new to the S4TK VS Code
extension. It explains the files that were just generated, and provides tips for
how to use VS Code with the S4TK extension.

If you need more information, read the docs: https://vscode.sims4toolkit.com/

--------------------------------------------------------------------------------

# The Generated Files/Folders

__.gitignore__
  Only needed if you plan on using Git. Feel free to delete.

__HowToUseS4TK.md__
  What you're reading right now. Feel free to delete when you are done.

__s4tk.config.json__
  The S4TK configuration file. This is what makes your folder an S4TK project.
  Do not delete, or you no longer have a project.

__out/__
  Where your built packages will be written to by default. You can add, edit,
  and remove build folders in your s4tk.config.json file.

__src/__
  The folder that contains all of your mods' source files. These can be tuning,
  SimData (as XML), string tables (as binary or JSON), and packages. If you want
  to include any other resources, they either must be in a package, or must be
  using the S4S file naming convention (T!G!I).

__src/strings/__
  A folder where you can keep all of your string tables. If you want to put them
  somewhere else, feel free to rename or delete this folder.

__src/strings/default.stbl.json__
  A sample JSON string table that is set as the default string table in your
  config file. JSON is the recommended format for string tables in S4TK.

__src/strings/sample.stbl__
  A sample binary string table file, which is view-only. This is just here to
  demonstrate what the binary STBL viewer looks like; feel free to delete.

__src/tuning/__
  A folder of example tuning/SimData. You can use any folder structure you want
  in your mod; feel free to delete this one, and organize your files in whatever
  way makes sense to you and works with your build instructions.

__src/tuning/buff_Example.SimData.xml__
  A sample buff SimData, with comments explaining how S4TK processes SimData.

__src/tuning/buff_Example.xml__
  A sample buff tuning, with comments explaining how S4TK processes tuning.

--------------------------------------------------------------------------------

# The S4TK Config (s4tk.config.json)

The S4TK config is what turns your folder into an S4TK project. It contains all
of the info needed for building your files into packages, as well as optional
settings that can be configured. It must be placed in the __root__ of the folder
that you have open with VS Code, otherwise, it will fail to load.

## Loading and Validation

The S4TK config loads when it is detected in your root VS Code folder, and
reloads when you save changes to it. Every time the config is reloaded, it is
validated to ensure that it is structured properly - if it isn't, you will see
an error message telling you how to fix it.

## Helpful Hints

Hover your cursor over any property name or value in your config, and you will
see a tooltip explaining what it is and how to use it. Additionally, hints will
pop up as you type, and any errors detected by the validator will be underlined
to signify that something is wrong.

## Globbing Safeguards

If you're not familiar with glob patterns (the patterns used in each package's
`include` and `exclude` lists), you can relax. When using default settings, the
build script will guarantee that:

- Every package has at least one file being written to it
- Every file in your source folder is being written to a package
- No files are being built to multiple packages, i.e. no duplicates

Advanced users with legitimate reasons for altering this behavior can do so by
setting the `allowEmptyPackages`, `allowPackageOverlap`, and `allowIgnoredFiles`
properties in `buildSettings` to true.

--------------------------------------------------------------------------------

# How to Build Your Project

The build script is completely dictated by the values in `buildInstructions`,
`buildSettings`, and `releaseSettings` in your S4TK config - you do NOT have to
write your own build script or any other code.

## Three Build Options

Build: Builds your project and outputs your built packages to each directory
  listed in `destinations`.

Dry Run: Runs the build process, but does not actually write any files other
  than `BuildSummary.json` (this is useful for debugging to make sure your build
  script is actually running how you intend it to, before it starts overwriting
  your existing built files).

Release: Builds your project, but ZIPs all of your packages together along
  with other optional files (such as ts4scripts, READMEs, etc.).

## How to Run the Build Script

There are several ways to run the build script:
- You will see buttons appear above `buildInstructions` in your S4TK config,
  click one of them to run that type of build.
- You can right-click your S4TK config, either in the file explorer (left side
  of VS Code), or in the editor tabs (top of VS Code), and you will see buttons
  appear within the context menu.
- Open the command palette (Windows: CTRL + SHIFT + P; macOS: CMD + SHIFT + P),
  type "S4TK", use your arrow keys to select the build option to use, and press
  enter to run the command.
