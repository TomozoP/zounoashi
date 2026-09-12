/* OneDriveなどに移動された場合も、Windowsが使っているデスクトップを選ぶ。 */
var cp = require('child_process');
var path = require('path');
var os = require('os');
module.exports = function () {
  if (process.platform !== 'win32') return path.join(os.homedir(), 'Desktop');
  var folder = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath("DesktopDirectory")'
  ], { encoding: 'utf8', windowsHide: true }).trim();
  if (!folder || !path.isAbsolute(folder)) throw Error('デスクトップの場所を確認できませんでした');
  return folder;
};
