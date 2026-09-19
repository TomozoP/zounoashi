/* 裏で借りたブラウザ（画面なしの Edge / Chrome）を止める。

     var stopBrowser = require("./browser-stop");
     stopBrowser(child, profile);   // child は cp.spawn の戻り値、profile は --user-data-dir に渡した一時フォルダ

   Windows では、立ち上げた入口のプロセスを child.kill() で止めても、その先で動く本体と
   子プロセスが残り続ける（2026-09-19、確認用に何度も借りたら msedge.exe が452個たまって
   新しく立ち上がらなくなった）。そこで、同じ一時フォルダを使うプロセスをまとめて止め、
   一時フォルダも消す。ユーザーがふだん使っているブラウザは、この一時フォルダを使わないので巻き込まない。 */
var cp = require("child_process");
var fs = require("fs");

module.exports = function stopBrowser(child, profile) {
  if (child) { try { child.kill(); } catch (e) {} }
  if (process.platform === "win32") {
    if (child && child.pid) {
      try { cp.spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true }); } catch (e) {}
    }
    if (profile) {
      /* 入口から離れて残った本体も、一時フォルダの名前で探して止める */
      var script =
        "$p = '" + String(profile).replace(/'/g, "''") + "';" +
        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) } |" +
        " ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
      try { cp.spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore", windowsHide: true, timeout: 20000 }); } catch (e) {}
    }
  }
  if (profile) {
    /* 止まりきるまで少し掛かることがあるので、消せなければそのままにする（次回に困ることはない） */
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (e) {}
  }
};
