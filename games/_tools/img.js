/* 画像を webp にする。

     node games/_tools/img.js "C:/Users/megus/Downloads/image (2).png"
     node games/_tools/img.js 拾った絵/ -o games/_hoge/img -w 1080
     node games/_tools/img.js *.png --q 90

   まとめて渡してよい（フォルダを渡すと中の画像を全部）。
   出す先を書かなければ、元と同じ場所に同じ名前の .webp ができる。
   元のファイルは消さない。

     -o <場所>   出す先のフォルダ
     -w <数>     横幅の上限。これより大きい絵は縮める（既定 なし）
     -h <数>     高さの上限
     -q <数>     画質 0〜100（既定 82）
     --png       webp ではなく png で出す（透過の一枚絵をそのまま縮めたいとき）

   Node だけでは webp を作れないので、裏で Edge か Chrome を画面なしで
   立ち上げ、canvas に描いて書き出してもらっている。手は要らない。 */

var http = require("http");
var fs = require("fs");
var path = require("path");
var os = require("os");
var cp = require("child_process");

/* ---------------- 言われたことを読む ---------------- */
var args = process.argv.slice(2);
var inputs = [], outDir = null, maxW = 0, maxH = 0, quality = 82, type = "image/webp", ext = ".webp";

for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a === "-o") outDir = args[++i];
  else if (a === "-w") maxW = Number(args[++i]);
  else if (a === "-h") maxH = Number(args[++i]);
  else if (a === "-q" || a === "--q") quality = Number(args[++i]);
  else if (a === "--png") { type = "image/png"; ext = ".png"; }
  else if (a[0] === "-") { console.log("知らない指定: " + a); process.exit(1); }
  else inputs.push(a);
}
if (!inputs.length) {
  console.log("使い方: node games/_tools/img.js <画像かフォルダ…> [-o 出す先] [-w 横幅] [-q 画質]");
  process.exit(1);
}

var OK = /\.(png|jpe?g|webp|gif|bmp)$/i;
var files = [];
inputs.forEach(function (p) {
  var full = path.resolve(p);
  if (!fs.existsSync(full)) { console.log("見つからない: " + p); return; }
  if (fs.statSync(full).isDirectory()) {
    fs.readdirSync(full).forEach(function (n) {
      if (OK.test(n)) files.push(path.join(full, n));
    });
  } else if (OK.test(full)) files.push(full);
  else console.log("画像じゃなさそう: " + p);
});
if (!files.length) { console.log("変換する画像がない"); process.exit(1); }

var jobs = files.map(function (f, n) {
  var base = path.basename(f).replace(/\.[^.]+$/, "") + ext;
  var dir = outDir ? path.resolve(outDir) : path.dirname(f);
  return { n: n, src: f, out: path.join(dir, base), was: fs.statSync(f).size };
});
jobs.forEach(function (j) { fs.mkdirSync(path.dirname(j.out), { recursive: true }); });

/* 上書きになるものは先に言う */
var over = jobs.filter(function (j) { return fs.existsSync(j.out); });
if (over.length) {
  console.log("※ 上書きになるもの: " + over.map(function (j) { return path.basename(j.out); }).join(", "));
}

/* ---------------- 受け取る側 ---------------- */
var MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
             ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" };

var page =
'<!doctype html><meta charset="utf-8"><body style="background:#111">\n' +
'<script>\n' +
'var JOBS = __JOBS__, MAXW = __MAXW__, MAXH = __MAXH__, Q = __Q__, TYPE = "__TYPE__";\n' +
'function one(j) {\n' +
'  return new Promise(function (done) {\n' +
'    var im = new Image();\n' +
'    im.onerror = function () { done({ n: j.n, err: "読めない" }); };\n' +
'    im.onload = function () {\n' +
'      var w = im.naturalWidth, h = im.naturalHeight, s = 1;\n' +
'      if (MAXW && w > MAXW) s = Math.min(s, MAXW / w);\n' +
'      if (MAXH && h > MAXH) s = Math.min(s, MAXH / h);\n' +
'      var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));\n' +
'      var cv = document.createElement("canvas");\n' +
'      cv.width = cw; cv.height = ch;\n' +
'      var c = cv.getContext("2d");\n' +
'      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";\n' +
'      c.drawImage(im, 0, 0, cw, ch);\n' +
'      cv.toBlob(function (b) {\n' +
'        if (!b) { done({ n: j.n, err: "書き出せない" }); return; }\n' +
'        b.arrayBuffer().then(function (buf) {\n' +
'          fetch("/out/" + j.n, { method: "POST", body: buf })\n' +
'            .then(function () { done({ n: j.n, w: cw, h: ch, ow: w, oh: h }); });\n' +
'        });\n' +
'      }, TYPE, Q / 100);\n' +
'    };\n' +
'    im.src = "/src/" + j.n;\n' +
'  });\n' +
'}\n' +
'(async function () {\n' +
'  var out = [];\n' +
'  for (var i = 0; i < JOBS.length; i++) out.push(await one(JOBS[i]));\n' +
'  await fetch("/done", { method: "POST", body: JSON.stringify(out) });\n' +
'})();\n' +
'</script>';

var results = {};
var server = http.createServer(function (req, res) {
  var u = req.url.split("?")[0];

  if (u === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page
      .replace("__JOBS__", JSON.stringify(jobs.map(function (j) { return { n: j.n }; })))
      .replace("__MAXW__", String(maxW))
      .replace("__MAXH__", String(maxH))
      .replace("__Q__", String(quality))
      .replace("__TYPE__", type));
    return;
  }

  var m = u.match(/^\/src\/(\d+)$/);
  if (m) {
    var j = jobs[Number(m[1])];
    res.writeHead(200, { "Content-Type": MIME[path.extname(j.src).toLowerCase()] || "image/png" });
    fs.createReadStream(j.src).pipe(res);
    return;
  }

  m = u.match(/^\/out\/(\d+)$/);
  if (m) {
    var k = Number(m[1]), bits = [];
    req.on("data", function (d) { bits.push(d); });
    req.on("end", function () {
      fs.writeFileSync(jobs[k].out, Buffer.concat(bits));
      res.writeHead(200); res.end("ok");
    });
    return;
  }

  if (u === "/done") {
    var s = [];
    req.on("data", function (d) { s.push(d); });
    req.on("end", function () {
      try { JSON.parse(Buffer.concat(s).toString()).forEach(function (r) { results[r.n] = r; }); }
      catch (e) {}
      res.writeHead(200); res.end("ok");
      finish();
    });
    return;
  }

  res.writeHead(404); res.end();
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

var child = null, timer = null, ended = false;

server.listen(0, "127.0.0.1", function () {
  var url = "http://127.0.0.1:" + server.address().port + "/";
  var exe = browser();
  if (!exe) {
    console.log("EdgeもChromeも見つからないので、自分でここを開いてください: " + url);
    return;
  }
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), "zimg-"));
  child = cp.spawn(exe, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + profile, url
  ], { stdio: "ignore" });
  child.on("error", function (e) {
    console.log("ブラウザを立ち上げられない: " + e.message);
    console.log("自分でここを開いてください: " + url);
  });
  timer = setTimeout(function () {
    console.log("時間がかかりすぎ。やめます（" + url + " を自分で開けば続きます）");
    finish();
  }, 120000);
});

function finish() {
  if (ended) return;
  ended = true;
  if (timer) clearTimeout(timer);
  if (child) { try { child.kill(); } catch (e) {} }
  server.close();

  var wasAll = 0, nowAll = 0, ng = 0;
  console.log("");
  jobs.forEach(function (j) {
    var r = results[j.n];
    if (!r || r.err || !fs.existsSync(j.out)) {
      console.log("NG  " + path.basename(j.src) + "  " + ((r && r.err) || "出てこない"));
      ng++;
      return;
    }
    var now = fs.statSync(j.out).size;
    wasAll += j.was; nowAll += now;
    var size = r.ow === r.w ? (r.w + "x" + r.h)
                            : (r.ow + "x" + r.oh + " → " + r.w + "x" + r.h);
    console.log("OK  " + path.basename(j.out) + "  " + kb(j.was) + " → " + kb(now) +
                "（" + Math.round(now / j.was * 100) + "%）  " + size);
  });
  if (jobs.length > 1) console.log("計  " + kb(wasAll) + " → " + kb(nowAll));
  console.log("出す先: " + path.dirname(jobs[0].out));
  process.exit(ng ? 1 : 0);
}

function kb(n) {
  return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + "MB" : Math.round(n / 1024) + "KB";
}
