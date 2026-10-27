/* ゲームの題名を、出てくる場所まとめて変える（公開後の改題用）。

     node games/_tools/rename.js atari "あたり引くだけくじ"          # 変える
     node games/_tools/rename.js atari "あたり引くだけくじ" --dry    # どこが変わるかだけ見る

   旧題は一覧（index.html の GAMES、下書きなら games/_local.js）から読みます。
   変える場所: 一覧の title、ゲーム本体（<title>・OGP・シェアのハッシュタグ・コメント）、
   共有ページ share/<id>/、固定リンク /shisaku-…/（そのゲームが載っているときだけ）、
   週報動画の ep_<id>.py（/mnt/project-files/weekly-video/ep/ にあれば）。
   ハッシュタグは空白を抜いた形（#旧題 → #新題）。英語などほかの言語の題名とタグは変えません。
   旧題がゲームの中の言葉にも出てくる（例: ハズレの言葉）ときは --dry の行を見て確かめる。
   読み上げの読み（ep の「〜。」）は変わらないので、出てきたら手で直す。 */
var fs = require("fs");
var path = require("path");
var workflow = require("./workflow");

var args = process.argv.slice(2), dry = args.indexOf("--dry") >= 0;
args = args.filter(function (a) { return a !== "--dry"; });
var id = args[0], next = args[1];
if (!id || !next) { console.error('使い方: node games/_tools/rename.js <id> "新しい題名" [--dry]'); process.exit(1); }
var root = workflow.root, gameDir;
try { gameDir = workflow.game(id); } catch (e) { console.error(e.message); process.exit(1); }
var draft = path.basename(gameDir).charAt(0) === "_";

/* 一覧から旧題を読む */
var listFile = path.join(root, draft ? "games/_local.js" : "index.html");
var list = fs.readFileSync(listFile, "utf8");
var m = draft ? list.match(new RegExp('"id": "' + id + '",\\s*"title": "([^"]+)"')) : list.match(new RegExp('id: "' + id + '",title: "([^"]+)"'));
if (!m) { console.error("一覧に " + id + " が見つかりません: " + path.relative(root, listFile)); process.exit(1); }
var old = m[1];
if (old === next) { console.log("題名は既に「" + next + "」です"); process.exit(0); }
var tagOld = "#" + old.replace(/\s+/g, ""), tagNew = "#" + next.replace(/\s+/g, "");

var changes = [];
function edit(file, fn) {
  if (!fs.existsSync(file)) return;
  var before = fs.readFileSync(file, "utf8"), after = fn(before);
  if (after === before) return;
  var lines = before.split("\n"), now = after.split("\n");
  lines.forEach(function (l, i) { if (now[i] !== l) changes.push(path.relative(root, file).replace(/\\/g, "/") + ":" + (i + 1) + "  " + now[i].trim().slice(0, 110)); });
  if (!dry) fs.writeFileSync(file, after);
}
function all(text) { return text.split(tagOld).join(tagNew).split(old).join(next); }

edit(listFile, function (t) { return t.replace(m[0], m[0].replace(old, next)); });
edit(path.join(gameDir, "index.html"), all);
edit(path.join(root, "share", id, "index.html"), all);
fs.readdirSync(root).filter(function (d) { return /^shisaku-/.test(d); }).forEach(function (d) {
  var f = path.join(root, d, "index.html");
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8").indexOf(old) >= 0 && fs.readFileSync(f, "utf8").indexOf(id) >= 0) edit(f, all);
});
edit("/mnt/project-files/weekly-video/ep/ep_" + id + ".py", all);

console.log((dry ? "（--dry 何も書いていません）" : "") + "「" + old + "」→「" + next + "」 " + changes.length + "行");
changes.forEach(function (c) { console.log("  " + c); });
if (!dry && changes.length) console.log("ほかの言語の題名（index.html の EN/KO/ZH/TW titles）は必要なら手で。commit と push はしていません。");
