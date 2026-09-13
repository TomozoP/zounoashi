/* 下書きを公開できる形にする。commit・push は別に行う。
   node games/_tools/publish.js hoge --unlisted  一覧に出さない制作中の公開
   node games/_tools/publish.js hoge             正式に一覧へ載せる */
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var vm = require("vm");
var id = process.argv[2];
var unlisted = process.argv[3] === "--unlisted";
function fail(message) { console.error(message); process.exit(1); }
if (!id || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) || process.argv.length > 4 ||
    (process.argv[3] && !unlisted)) fail("使い方: node games/_tools/publish.js <id> [--unlisted]");
var root = path.resolve(__dirname, "../..");
var from = path.join(root, "games", "_" + id);
var to = path.join(root, "games", id);
var localPath = path.join(root, "games/_local.js");
var idxPath = path.join(root, "index.html");
var local = fs.readFileSync(localPath, "utf8");
var idx = fs.readFileSync(idxPath, "utf8");
var context = { window: {} };
vm.runInNewContext(local, context);
var entries = context.window.DRAFT_GAMES;
var matches = entries.filter(function (g) { return g.id === id; });
if (matches.length !== 1) fail("games/_local.js に対象の行が1つ必要です: " + id);
var entry = matches[0];
var listed = vm.runInNewContext(idx.match(/var GAMES = (\[[\s\S]*?\n\]);/)[1], { UR: "", KY: "" });
if (listed.some(function (g) { return g.id === id; })) fail("すでに正式公開されています: " + id);
var anchor = idx.match(/^[ \t]*\{ type: "lab".*$/m);
if (!unlisted && !anchor) fail("index.html の実験場の行が見つかりません");
if (fs.existsSync(from) && fs.existsSync(to)) fail("移動先がすでにあります: " + to);
var source = fs.existsSync(from) ? from : to;
if (!fs.existsSync(path.join(source, "index.html"))) fail("ゲームが見つかりません: " + id);
var html = fs.readFileSync(path.join(source, "index.html"), "utf8");
if (!/<\/head>/i.test(html)) fail("ゲームの </head> が見つかりません");
var marker = '<meta name="zounoashi-unlisted" content="true">\n<meta name="robots" content="noindex, nofollow">\n';
if (source === to && !html.includes(marker)) fail("制作中の公開として登録されていません: " + id);
if (!unlisted && (!entry.img || !fs.existsSync(path.join(root, entry.img)))) fail("正式公開にはサムネが必要です: " + entry.img);
/* 確認が済んでから移動する。制作中は手元の一覧に登録を残す。 */
if (source === from) fs.renameSync(from, to);
["play", "img"].forEach(function (key) {
  if (entry[key]) entry[key] = entry[key].split("games/_" + id + "/").join("games/" + id + "/");
});
html = html.replace(marker, "");
if (unlisted) html = html.replace(/<\/head>/i, marker + "</head>");
fs.writeFileSync(path.join(to, "index.html"), html);
if (!unlisted) {
  /* 既存の一覧と同じ表記を保つ。 */
  var line = JSON.stringify(entry).replace(/"([a-zA-Z]+)":/g, "$1: ");
  fs.writeFileSync(idxPath, idx.replace(anchor[0], "  " + line + ",\n" + anchor[0]));
  entries = entries.filter(function (g) { return g.id !== id; });
}
var start = local.indexOf("window.DRAFT_GAMES");
fs.writeFileSync(localPath, local.slice(0, start) + "window.DRAFT_GAMES = " + JSON.stringify(entries, null, 2) + ";\n");
if (!unlisted) cp.execFileSync(process.execPath, [path.join(__dirname, "ogp.js"), id], { cwd: root, stdio: "inherit" });
console.log(unlisted ? "一覧に出さない公開の形にしました:" : "正式公開の形にしました:");
console.log("  https://www.zounoashi.com/" + (unlisted ? "games/" + id + "/" : "#/game/" + id));
console.log("動作と変更内容を確認し、commit・push すると反映されます。");
