const vscode = require("vscode");

const PREVIOUS_SETTINGS_KEY = "workspaceLock.previousReadonlySettings";
const LOCK_PATTERN = "**/*";
const SETTINGS_PATTERN = "**/.vscode/settings.json";
const WORKSPACE_FILE_PATTERN = "**/*.code-workspace";

let statusItem;

function activate(context) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = "workspaceLock.toggle";
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("workspaceLock.toggle", () => toggleWorkspaceLock(context)),
    vscode.commands.registerCommand("workspaceLock.lock", () => lockWorkspace(context)),
    vscode.commands.registerCommand("workspaceLock.unlock", () => unlockWorkspace(context))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("files.readonlyInclude") ||
        event.affectsConfiguration("files.readonlyExclude")
      ) {
        updateStatusItem();
      }
    })
  );

  updateStatusItem();
}

function deactivate() {}

async function toggleWorkspaceLock(context) {
  if (isWorkspaceLocked()) {
    await unlockWorkspace(context);
  } else {
    await lockWorkspace(context);
  }
}

async function lockWorkspace(context) {
  if (!hasWorkspace()) {
    vscode.window.showWarningMessage("Open a workspace folder before using Workspace Lock.");
    return;
  }

  if (isWorkspaceLocked()) {
    updateStatusItem();
    vscode.window.showInformationMessage("Workspace is already locked.");
    return;
  }

  const shouldContinue = await confirmUnsavedDocuments();
  if (!shouldContinue) {
    return;
  }

  const filesConfig = vscode.workspace.getConfiguration("files");
  const includeInspection = filesConfig.inspect("readonlyInclude");
  const excludeInspection = filesConfig.inspect("readonlyExclude");
  const workspaceInclude = includeInspection?.workspaceValue;
  const workspaceExclude = excludeInspection?.workspaceValue;

  await context.workspaceState.update(PREVIOUS_SETTINGS_KEY, {
    hasInclude: workspaceInclude !== undefined,
    include: clonePlainObject(workspaceInclude),
    hasExclude: workspaceExclude !== undefined,
    exclude: clonePlainObject(workspaceExclude)
  });

  // Exclude settings files before locking the workspace, otherwise the lock can
  // make the settings file read-only before the exclusion is written.
  await filesConfig.update(
    "readonlyExclude",
    {
      ...asPlainObject(workspaceExclude),
      [SETTINGS_PATTERN]: true,
      [WORKSPACE_FILE_PATTERN]: true
    },
    vscode.ConfigurationTarget.Workspace
  );

  await filesConfig.update(
    "readonlyInclude",
    {
      ...asPlainObject(workspaceInclude),
      [LOCK_PATTERN]: true
    },
    vscode.ConfigurationTarget.Workspace
  );

  updateStatusItem();
  vscode.window.showInformationMessage("Workspace locked.");
}

async function unlockWorkspace(context) {
  if (!hasWorkspace()) {
    vscode.window.showWarningMessage("Open a workspace folder before using Workspace Lock.");
    return;
  }

  if (!isWorkspaceLocked()) {
    updateStatusItem();
    vscode.window.showInformationMessage("Workspace is already editable.");
    return;
  }

  const previousSettings = context.workspaceState.get(PREVIOUS_SETTINGS_KEY);
  const filesConfig = vscode.workspace.getConfiguration("files");

  if (previousSettings) {
    await filesConfig.update(
      "readonlyInclude",
      previousSettings.hasInclude ? previousSettings.include : undefined,
      vscode.ConfigurationTarget.Workspace
    );

    await filesConfig.update(
      "readonlyExclude",
      previousSettings.hasExclude ? previousSettings.exclude : undefined,
      vscode.ConfigurationTarget.Workspace
    );
  } else {
    await removeLockPatterns(filesConfig);
  }

  await context.workspaceState.update(PREVIOUS_SETTINGS_KEY, undefined);

  updateStatusItem();
  vscode.window.showInformationMessage("Workspace unlocked.");
}

async function removeLockPatterns(filesConfig) {
  const includeInspection = filesConfig.inspect("readonlyInclude");
  const excludeInspection = filesConfig.inspect("readonlyExclude");
  const workspaceInclude = asPlainObject(includeInspection?.workspaceValue);
  const workspaceExclude = asPlainObject(excludeInspection?.workspaceValue);

  delete workspaceInclude[LOCK_PATTERN];
  delete workspaceExclude[SETTINGS_PATTERN];
  delete workspaceExclude[WORKSPACE_FILE_PATTERN];

  await filesConfig.update(
    "readonlyInclude",
    emptyObjectToUndefined(workspaceInclude),
    vscode.ConfigurationTarget.Workspace
  );

  await filesConfig.update(
    "readonlyExclude",
    emptyObjectToUndefined(workspaceExclude),
    vscode.ConfigurationTarget.Workspace
  );
}

async function confirmUnsavedDocuments() {
  const dirtyFileDocuments = vscode.workspace.textDocuments.filter(
    (document) => document.uri.scheme === "file" && document.isDirty
  );

  if (dirtyFileDocuments.length === 0) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    `${dirtyFileDocuments.length} unsaved file(s). Lock workspace anyway?`,
    { modal: true },
    "Save All and Lock",
    "Lock Anyway"
  );

  if (choice === "Save All and Lock") {
    return vscode.workspace.saveAll(false);
  }

  return choice === "Lock Anyway";
}

function isWorkspaceLocked() {
  const readonlyInclude = vscode.workspace.getConfiguration("files").get("readonlyInclude");
  return Boolean(readonlyInclude && readonlyInclude[LOCK_PATTERN] === true);
}

function updateStatusItem() {
  if (!statusItem) {
    return;
  }

  if (!hasWorkspace()) {
    statusItem.text = "$(circle-slash) Workspace Lock";
    statusItem.tooltip = "Open a workspace folder to use Workspace Lock";
    statusItem.show();
    return;
  }

  if (isWorkspaceLocked()) {
    statusItem.text = "$(lock) Workspace Locked";
    statusItem.tooltip = "Click to unlock workspace editing";
  } else {
    statusItem.text = "$(unlock) Workspace Editable";
    statusItem.tooltip = "Click to lock workspace editing";
  }

  statusItem.show();
}

function hasWorkspace() {
  return Boolean(vscode.workspace.workspaceFolders?.length);
}

function asPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function clonePlainObject(value) {
  if (value === undefined) {
    return undefined;
  }

  return asPlainObject(value);
}

function emptyObjectToUndefined(value) {
  return Object.keys(value).length === 0 ? undefined : value;
}

module.exports = {
  activate,
  deactivate
};
