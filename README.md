# Workspace Lock

Workspace Lock is a small VS Code extension that adds a status bar button for toggling the current workspace between editable and read-only.

It is designed for reviewing generated code without accidentally typing, deleting, pasting, or undoing changes in the editor.

## Features

- Status bar button:
  - `Workspace Editable`
  - `Workspace Locked`
- Commands:
  - `Workspace Lock: Toggle`
  - `Workspace Lock: Lock Workspace`
  - `Workspace Lock: Unlock Workspace`
- Default shortcut:
  - macOS: `Cmd+Alt+L`
  - Windows/Linux: `Ctrl+Alt+L`
- Restores previous workspace `files.readonlyInclude` and `files.readonlyExclude` settings when unlocked.

## How It Works

Locking writes these workspace settings through the VS Code configuration API:

```json
{
  "files.readonlyInclude": {
    "**/*": true
  },
  "files.readonlyExclude": {
    "**/.vscode/settings.json": true,
    "**/*.code-workspace": true
  }
}
```

This only affects editing inside VS Code. It does not change file system permissions, so terminals, build tools, tests, and coding agents can still write files.

For a single-folder workspace, VS Code usually stores these settings in `.vscode/settings.json`. That file may appear in git changes while the workspace is locked.

## Development

Open this folder in VS Code, press `F5`, and choose `Run Extension` to start an Extension Development Host.

To package a local installable VSIX:

```sh
npm install -g @vscode/vsce
vsce package
```

Then install the generated `.vsix` from VS Code with `Extensions: Install from VSIX...`.
