# Welcome to your Sims 4 Toolkit project!

This file walks you through the files that were just generated, but if you have
any futher questions, please read the docs: https://vscode.sims4toolkit.com/

--------------------------------------------------------------------------------

## The S4TK Config (s4tk.config.json)

The S4TK config is what turns your folder into an S4TK project. It contains all
of the info needed for building your files into packages, as well as optional
settings that can be configured. It must be placed in the **root** of the folder
that you have open with VS Code, otherwise, it will fail to load.

### Loading and Validation

The S4TK config loads when it is detected in your root VS Code folder, and
reloads when you save changes to it. Every time the config is reloaded, it is
validated to ensure that it is structured properly - if it isn't, you will see
an error message telling you how to fix it.

### Helpful Hints

Hover your cursor over any property name or value in your config, and you will
see a tooltip explaining what it is and how to use it. Additionally, hints will
pop up as you type, and any errors detected by the validator will be underlined
to signify that something is wrong.

--------------------------------------------------------------------------------

## TODO: How to structure project

--------------------------------------------------------------------------------

## How to Build Your Project

The build script is completely dictated by the values in `buildInstructions`,
`buildSettings`, and `releaseSettings` in your S4TK config - you do NOT have to
write your own build script or any other code.

### Three Build Options

Build: Builds your project and outputs your built packages to each directory
  listed in `destinations`.

Dry Run: Runs the build process, but does not actually write any files other
  than `BuildSummary.txt` (this is useful for debugging to make sure your build
  script is actually running how you intend it to, before it starts overwriting
  your existing built files).

Release: Builds your project, but ZIPs all of your packages together along
  with other optional files (such as ts4scripts, READMEs, etc.).

### How to Run the Build Script

There are several ways to run the build script:
- You will see buttons appear above `buildInstructions` in your S4TK config,
  click one of them to run that type of build.
- You can right-click your S4TK config, either in the file explorer (left side
  of VS Code), or in the editor tabs (top of VS Code), and you will see buttons
  appear within the context menu.
- Open the command palette (Windows: CTRL + SHIFT + P; macOS: CMD + SHIFT + P),
  type "S4TK", use your arrow keys to select the build option to use, and press
  enter to run the command.
