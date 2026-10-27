/* push したあと、GitHub Pages の公開処理が終わったかを見る（サイトを開けない環境でも確かめられる）。

     node games/_tools/pages-status.js          # 手元の最新コミット（HEAD）の公開を待つ（最大5分）
     node games/_tools/pages-status.js abc1234  # コミットを指定

   成功で 0、失敗・時間切れで 1 を返します。GitHub の公開API（ログイン不要）を curl で読みます。 */
var cp = require("child_process");
var workflow = require("./workflow");

var REPO = "TomozoP/zounoashi";
var sha = process.argv[2] || cp.execSync("git rev-parse HEAD", { cwd: workflow.root }).toString().trim();
var limit = Date.now() + 5 * 60 * 1000;

function runs() {
  var out = cp.execFileSync("curl", ["-sS", "-m", "20", "https://api.github.com/repos/" + REPO + "/actions/runs?per_page=15"]).toString();
  return (JSON.parse(out).workflow_runs || []).filter(function (r) { return r.head_sha.indexOf(sha) === 0 && /pages/i.test(r.name); });
}

(function check() {
  var r;
  try { r = runs()[0]; } catch (e) { console.log("読めませんでした: " + e.message); }
  if (r && r.status === "completed") {
    var ok = r.conclusion === "success";
    console.log((ok ? "OK  公開済み " : "失敗 ") + sha.slice(0, 7) + "（" + r.conclusion + "） " + r.html_url);
    process.exit(ok ? 0 : 1);
  }
  if (Date.now() > limit) { console.log("時間切れ: " + sha.slice(0, 7) + " の公開処理が5分で終わりませんでした" + (r ? "（" + r.status + "）" : "（まだ始まっていない）")); process.exit(1); }
  setTimeout(check, 10000);
})();
