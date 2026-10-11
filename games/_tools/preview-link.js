/* 制作中の固定リンク（/shisaku-i87mixcr/、Cake Cut が中に開くページ）を、指定のゲームに差し替える。

     node games/_tools/preview-link.js hoge

   games/_hoge/（公開済みなら games/hoge/）の index.html を写して、次を整える。
   - 検索除外・版（preview-version）・題名の【プレビュー】・上部の「プレビュー」表示
   - 公開用のOGPは外し、目印だけ残す
   - ../start.js などの共通の部品は ../games/ から読む。手元の参照にはすべて同じ版の ?v= を付ける
   - 録画パネル（F9・録画ボタン）は、この場所の recorder-ui.js の写しから読む
   - 自動更新（auto-reload.js）と上部のボタン（preview-header.js）を読む
   ゲームの絵や部品は shisaku-i87mixcr/ の同じ位置へ写す（前のゲームの素材は消さない）。
   commit・push は別に行う。 */
var fs = require("fs");
var path = require("path");
var workflow = require("./workflow");
var refs = require("./refs");

function fail(message) { console.error("NG  " + message); process.exit(1); }
var id = process.argv[2];
var gameDir;
try { gameDir = workflow.game(id); } catch (e) { fail(e.message); }
var root = workflow.root;
var out = path.join(root, "shisaku-i87mixcr");
var version = id + "-" + Date.now();

var html = fs.readFileSync(path.join(gameDir, "index.html"), "utf8");
function must(pattern, label) { if (!pattern.test(html)) fail("ゲームの " + label + " が見つかりません"); }
must(/<meta charset="UTF-8">\r?\n/i, '<meta charset="UTF-8">');
must(/<title>[^<]*<\/title>/, "<title>");
must(/<\/style>/, "</style>");
must(/<body[^>]*>/, "<body>");
must(/<\/body>/, "</body>");

/* 公開用のOGPは外し、目印だけ残す（目印の外のOGPは publish.js 以前の古い形なので消す） */
var OGP_START = "<!-- ゲームのOGP：道具で更新 -->", OGP_END = "<!-- ゲームのOGPここまで -->";
html = html.replace(/<!-- ゲームのOGP：道具で更新 -->[\s\S]*?<!-- ゲームのOGPここまで -->\r?\n?/, "");
html = html.replace(/^<meta (?:property="og:|name="twitter:)[^>]*>\r?\n/gm, "");
html = html.replace(/^<meta name="zounoashi-unlisted"[^>]*>\r?\n|^<meta name="robots"[^>]*>\r?\n/gm, "");
html = html.replace(/<meta charset="UTF-8">\r?\n/i, function (m) {
  return m + '<meta name="robots" content="noindex,nofollow">\n<meta name="preview-version" content="' + version + '">\n';
});
html = html.replace(/<title>([^<]*)<\/title>/, function (m, t) { return "<title>【プレビュー】" + t.replace(/^【プレビュー】/, "") + "</title>"; });
/* 「プレビュー」表示の見た目は、head の最後の </style> の直前に入れる（OGPの位置に左右されない） */
var lastStyle = html.lastIndexOf("</style>", html.search(/<\/head>/i));
if (lastStyle < 0) fail("head の中に </style> が見つかりません");
html = html.slice(0, lastStyle) +
  "  /* 制作中の確認ページであることを常に見せる。canvasの外なので録画には入らない */\n" +
  "  #preview-label { position:fixed; left:0; right:0; top:0; z-index:10; padding:4px 0; background:#e8443a; color:#fff; font:bold 14px sans-serif; text-align:center; letter-spacing:.2em; pointer-events:none; }\n" +
  html.slice(lastStyle);
html = html.replace(/<\/head>/i, OGP_START + "\n" + OGP_END + "\n</head>");
html = html.replace(/<body[^>]*>\r?\n?/, function (m) { return m.replace(/\r?\n?$/, "\n") + '<div id="preview-label">プレビュー</div>\n'; });

/* 録画パネルは、手元なら道具の原本、それ以外はこの場所の写しから読む */
var recorderTest = /if \(document\.head && \/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$\/\.test\(location\.hostname\) && /;
if (recorderTest.test(html)) {
  html = html.replace(recorderTest, "/* 制作中の固定リンクでは、F9の録画パネルを使えるようにする */\nif (document.head && ");
  html = html.replace(/recorderScript\.src = "\.\.\/_tools\/recorder-ui\.js";/,
    'recorderScript.src = /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) ? "../games/_tools/recorder-ui.js?v=' + version + '" : "./recorder-ui.js?v=' + version + '";');
} else console.log("注意: 録画パネルの読み込みが見つかりません。録画ボタンを使うなら雛形の形に揃えてください");

/* 置き場所。ゲームのフォルダの中はそのまま、外の部品は ../games/ などから読む */
var copies = [];
function placed(target) {
  var rel = path.relative(gameDir, target).replace(/\\/g, "/");
  if (!rel.startsWith("..")) { copies.push(target); return rel; }
  return "../" + path.relative(root, target).replace(/\\/g, "/");
}
function versioned(text, fromDir) {
  return refs.rewrite(text, fromDir, function (target) {
    if (path.basename(target) === "recorder-ui.js") return null;   /* 上で書き換え済み */
    return placed(target) + "?v=" + version;
  });
}
html = versioned(html, gameDir);
html = html.replace(/<\/body>/i, '<script src="./auto-reload.js?v=' + version + '"></script>\n<script src="./preview-header.js?v=' + version + '"></script>\n</body>');

/* ゲームのフォルダの部品を写す（JS・CSS の中の参照も同じ版にする） */
var written = ["shisaku-i87mixcr/index.html"];
var done = new Set();
while (copies.length) {
  var src = copies.shift();
  if (done.has(src)) continue;
  done.add(src);
  var rel = path.relative(gameDir, src);
  if (rel.split(path.sep).some(function (p) { return p.startsWith("_"); })) continue;
  var dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (/\.(css|js)$/i.test(src)) fs.writeFileSync(dest, versioned(fs.readFileSync(src, "utf8"), path.dirname(src)));
  else fs.copyFileSync(src, dest);
  written.push(path.relative(root, dest).replace(/\\/g, "/"));
}
/* 録画パネルの写しを原本に揃える */
fs.copyFileSync(path.join(__dirname, "recorder-ui.js"), path.join(out, "recorder-ui.js"));
written.push("shisaku-i87mixcr/recorder-ui.js");
fs.writeFileSync(path.join(out, "index.html"), html);

/* 取り違え防止の決まりを最後に確かめる */
var check = fs.readFileSync(path.join(out, "index.html"), "utf8");
[['name="preview-version"', "版"], ['id="preview-label"', "プレビュー表示"], ["<title>【プレビュー】", "題名"],
 ["./auto-reload.js?", "自動更新"], ["./preview-header.js?", "上部のボタン"], ['content="noindex,nofollow"', "検索除外"]]
  .forEach(function (c) { if (check.indexOf(c[0]) < 0) fail(c[1] + "が入っていません"); });
if (/og:title|games\/_(?!tools\/)/.test(check.replace(/<!--[\s\S]*?-->/g, ""))) fail("公開用のOGPか、配信されない下書きへの参照が残っています");

console.log("OK  固定リンクを " + id + " に差し替えました（版 " + version + "）");
console.log("更新: " + written.join(", "));
