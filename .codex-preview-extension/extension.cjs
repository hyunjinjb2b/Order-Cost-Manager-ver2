const vscode = require('vscode');

async function activate() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await vscode.commands.executeCommand(
    'simpleBrowser.show',
    'http://127.0.0.1:3000',
  );
}

function deactivate() {}

module.exports = {activate, deactivate};
