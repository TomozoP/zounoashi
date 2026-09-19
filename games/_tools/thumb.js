/* サムネを、動いているゲームの画面から作る。

     node games/_tools/thumb.js hoge
     node games/_tools/thumb.js hoge -t 6            # 6秒動かしてから撮る
     node games/_tools/thumb.js hoge --top 200       # 切り取り位置をずらす

   games/_hoge/img/thumb.webp （600x600）ができます。

   裏で Edge か Chrome を画面なしで借りて、ゲームを実際に動かし、
   その画面を撮ります。手は要りません。

   カードは正方形に切られる（object-fit: cover）ので、縦長の画面を
   そのまま切ると上下が落ちます。「上のほう」と「下のほう」を選んで
   詰めた正方形にしています。

     -t <秒>      撮るまでに動かす秒数（既定 3）
     -k <キー>    最初に押すキー（既定 スペース）。`-k なし` で押さない
     --top <y>    上の帯の位置（既定 90）
     --toph <h>   上の帯の高さ（既定 170。残りが下の帯）
     -q <数>      画質 0〜100（既定 90） */

var http = require("http");
var fs = require("fs");
var path = require("path");
var os = require("os");
var cp = require("child_process");
var stopBrowser = require("./browser-stop");   /* 借りたブラウザを残さず止める */

/* ---------------- 言われたことを読む ---------------- */
var args = process.argv.slice(2);
var id = null, secs = 3, firstKey = " ", topY = 90, topH = 170, quality = 90, query = "";
for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a === "-t") secs = Number(args[++i]);
  else if (a === "-k") { var k = args[++i]; firstKey = (k === "なし" || k === "none") ? null : k; }
  else if (a === "--top") topY = Number(args[++i]);
  else if (a === "--toph") topH = Number(args[++i]);
  else if (a === "--query") query = args[++i] || "";
  else if (a === "-q") quality = Number(args[++i]);
  else if (a[0] === "-") { console.log("知らない指定: " + a); process.exit(1); }
  else id = a;
}
if (!id) { console.log("使い方: node games/_tools/thumb.js <id> [-t 秒] [--top y] [--toph h]"); process.exit(1); }

var root = path.join(__dirname, "..", "..");
var dir = fs.existsSync(path.join(root, "games", "_" + id)) ? "_" + id : id;
var gamePath = path.join(root, "games", dir, "index.html");
if (!fs.existsSync(gamePath)) { console.log("ゲームが無い: games/" + dir + "/index.html"); process.exit(1); }
var out = path.join(root, "games", dir, "img", "thumb.webp");
fs.mkdirSync(path.dirname(out), { recursive: true });

/* ---------------- ゲームに足す、撮る係 ---------------- */
var shot =
'<script>\n' +
'(function () {\n' +
'  var SEC = __SEC__, KEY = __KEY__, TOPY = __TOPY__, TOPH = __TOPH__, Q = __Q__;\n' +
'  function key(k) {\n' +
'    var o = { key: k, code: k === " " ? "Space" : "", bubbles: true };\n' +
'    window.dispatchEvent(new KeyboardEvent("keydown", o));\n' +
'    setTimeout(function () { window.dispatchEvent(new KeyboardEvent("keyup", o)); }, 60);\n' +
'  }\n' +
'  function shoot() {\n' +
'    var s = document.querySelector("canvas");\n' +
'    if (!s) { fail("canvas が無い"); return; }\n' +
'    var k = s.width / 540;\n' +
'    var top = { y: TOPY, h: TOPH };\n' +
'    var bot = { y: s.height / k - 540 + top.h, h: 540 - top.h };\n' +
'    var cv = document.createElement("canvas");\n' +
'    cv.width = cv.height = 600;\n' +
'    var c = cv.getContext("2d");\n' +
'    c.imageSmoothingQuality = "high";\n' +
'    c.drawImage(s, 0, top.y * k, 540 * k, top.h * k, 0, 0, 600, top.h * 600 / 540);\n' +
'    c.drawImage(s, 0, bot.y * k, 540 * k, bot.h * k, 0, top.h * 600 / 540, 600, bot.h * 600 / 540);\n' +
'    cv.toBlob(function (b) {\n' +
'      if (!b) { fail("書き出せない"); return; }\n' +
'      b.arrayBuffer().then(function (buf) { fetch("/__save", { method: "POST", body: buf }); });\n' +
'    }, "image/webp", Q / 100);\n' +
'  }\n' +
'  function fail(why) { fetch("/__fail", { method: "POST", body: why }); }\n' +
'  window.addEventListener("error", function (e) { fail("ゲームが落ちた: " + e.message); });\n' +
'  setTimeout(function () {\n' +
'    if (KEY) key(KEY);\n' +
'    setTimeout(shoot, SEC * 1000);\n' +
'  }, 400);\n' +
'})();\n' +
'</script>';

shot = shot.replace("__SEC__", String(secs))
           .replace("__KEY__", firstKey == null ? "null" : JSON.stringify(firstKey))
           .replace("__TOPY__", String(topY))
           .replace("__TOPH__", String(topH))
           .replace("__Q__", String(quality));

/* ---------------- 配る側 ---------------- */
var MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
             ".css": "text/css; charset=utf-8", ".json": "application/json",
             ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
             ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
             ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

var gameUrl = "/games/" + dir + "/index.html";
var pageUrl = gameUrl + (query ? "?" + query.replace(/^\?/, "") : "");
var ended = false, why = null;

var server = http.createServer(function (req, res) {
  var u = decodeURIComponent(req.url.split("?")[0]);

  if (u === "/__save") {
    var bits = [];
    req.on("data", function (d) { bits.push(d); });
    req.on("end", function () {
      fs.writeFileSync(out, Buffer.concat(bits));
      res.writeHead(200); res.end("ok");
      finish();
    });
    return;
  }
  if (u === "/__fail") {
    var s = [];
    req.on("data", function (d) { s.push(d); });
    req.on("end", function () {
      why = Buffer.concat(s).toString();
      res.writeHead(200); res.end("ok");
      finish();
    });
    return;
  }

  var file = path.join(root, u.replace(/^\/+/, ""));
  if (file.indexOf(root) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  var ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });

  if (u === gameUrl) {                         /* ゲームの本体にだけ、撮る係を足す */
    var html = fs.readFileSync(file, "utf8");
    res.end(html.indexOf("</body>") >= 0 ? html.replace("</body>", shot + "\n</body>") : html + shot);
    return;
  }
  fs.createReadStream(file).pipe(res);
});

/* ---------------- 裏でブラウザを借りる ---------------- */
function browser() {
  var cands = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
  ];
  for (var i = 0; i < cands.length; i++) if (fs.existsSync(cands[i])) return cands[i];
  return null;
}

var child = null, timer = null, usedProfile = null;

server.listen(0, "127.0.0.1", function () {
  var url = "http://127.0.0.1:" + server.address().port + pageUrl;
  var exe = browser();
  if (!exe) {
    console.log("EdgeもChromeも見つかりません。");
    console.log("自分でここを開けば、" + secs + "秒後に撮れます: " + url);
    return;
  }
  var profile = usedProfile = fs.mkdtempSync(path.join(os.tmpdir(), "zthumb-"));
  child = cp.spawn(exe, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=430,900",                   /* タテ画面で動かす */
    "--user-data-dir=" + profile, url
  ], { stdio: "ignore" });
  child.on("error", function (e) {
    why = "ブラウザを立ち上げられない: " + e.message;
    console.log(why);
    console.log("自分でここを開いてください: " + url);
  });
  console.log(secs + "秒ぶん動かして撮ります…");
  timer = setTimeout(function () { why = why || "時間切れ"; finish(); }, (secs + 25) * 1000);
});

function finish() {
  if (ended) return;
  ended = true;
  if (timer) clearTimeout(timer);
  stopBrowser(child, usedProfile);
  server.close();

  if (why || !fs.existsSync(out)) {
    console.log("NG  " + (why || "撮れなかった"));
    process.exit(1);
  }
  var n = fs.statSync(out).size;
  console.log("OK  games/" + dir + "/img/thumb.webp  600x600  " + Math.round(n / 1024) + "KB");
  console.log("※ 切り取り位置は --top / --toph で調整できます");
  process.exit(0);
}
