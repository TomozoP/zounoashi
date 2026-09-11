/* 下書きのゲームを公開する形にする。

     node games/_tools/publish.js hoge

   やること
     1. games/_hoge → games/hoge （_ を外すと GitHub Pages が配信する）
     2. index.html の GAMES に1行入れる（実験場の先頭）
     3. games/_local.js から下書きの行を消す
   ここまでで止まる。git の commit と push は自分でやる。 */

var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var id = process.argv[2];
if (!id) { console.log("使い方: node games/_tools/publish.js <id>"); process.exit(1); }

var root = path.join(__dirname, "..", "..");
var from = path.join(root, "games", "_" + id);
var to = path.join(root, "games", id);
if (!fs.existsSync(from)) { console.log("見つかりません: games/_" + id); process.exit(1); }

/* 1) 一覧用の1行を、下書きから取り出す */
var localPath = path.join(root, "games", "_local.js");
var local = fs.readFileSync(localPath, "utf8");
var re = new RegExp("^[ \\t]*\\{[^]*?id: \"" + id + "\"[^]*?\\},[ \\t]*$", "m");
var m = local.match(re);
if (!m) { console.log("games/_local.js に " + id + " の行がありません"); process.exit(1); }
var entry = m[0].replace(new RegExp("_" + id, "g"), id).replace(/\s*\n\s*/g, " ").trim();

/* 2) フォルダを動かす（git が知っているものは git mv で） */
try { cp.execSync("git mv games/_" + id + " games/" + id, { cwd: root, stdio: "pipe" }); }
catch (e) { fs.renameSync(from, to); }

/* 3) index.html の実験場の先頭に入れる */
var idxPath = path.join(root, "index.html");
var idx = fs.readFileSync(idxPath, "utf8");
var anchor = idx.match(/^[ \t]*\{ type: "lab".*$/m);
if (!anchor) { console.log("index.html の実験場の行が見つかりません"); process.exit(1); }
if (idx.indexOf('id: "' + id + '"') >= 0) console.log("※ index.html にはもう入っていました");
else idx = idx.replace(anchor[0], "  " + entry + "\n" + anchor[0]);
fs.writeFileSync(idxPath, idx);

/* 4) 下書きの行を消す */
fs.writeFileSync(localPath, local.replace(re, "").replace(/\n{3,}/g, "\n\n"));

console.log("公開の形にしました:");
console.log("  games/" + id + "/");
console.log("  index.html の GAMES に追加");
console.log("  games/_local.js から下書きを削除");
console.log("");
console.log("確認してから:");
console.log("  git add -A && git commit && git push origin main");
