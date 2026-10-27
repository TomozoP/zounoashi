/* 確認用ページを出す前に、場面をまとめて撮って1枚に並べる（絵の破綻を自分で見つけるため）。

     node games/_tools/shots.js hoge                 # 開始・遊び中・数字キー1〜9の場面
     node games/_tools/shots.js hoge -k 1,3,5        # 数字キーを選ぶ
     node games/_tools/shots.js hoge -w 2.5          # キーを押してから撮るまでの秒数（既定 1.5）
     node games/_tools/shots.js hoge -p 5            # 始めてから「遊び中」を撮り・キーを押すまでの秒数（既定 4。立体は撮影中の動きが遅いので長め）
     node games/_tools/shots.js hoge --size 844x390  # 横長の画面で撮る

   Playwright の Chromium で撮ります（Claude のクラウドには入っています）。
   games/_tools/_bin/shots/hoge.png ができます（スマホの縦長、1場面ずつ番号つき）。
   場面ごとにページを読み直すので、前の場面の続きにはなりません。
   見るところ: めり込み・突き抜け・離れた部品（首など）・描く順番（奥が手前に出る）・
   見切れた文字・余計な線・背景に溶ける色・くすんだ明るさ。 */
var http = require("http");
var fs = require("fs");
var path = require("path");
var workflow = require("./workflow");

var args = process.argv.slice(2), id = args[0];
function opt(name, def) { var i = args.indexOf(name); return i > 0 && args[i + 1] ? args[i + 1] : def; }
var gameDir;
try { gameDir = workflow.game(id); } catch (e) { console.error(e.message || "使い方: node games/_tools/shots.js <id> [-k 1,2,3] [-w 秒] [--size 390x844]"); process.exit(1); }
var keys = opt("-k", "1,2,3,4,5,6,7,8,9").split(",").filter(Boolean);
var wait = parseFloat(opt("-w", "1.5")) * 1000;
var play = parseFloat(opt("-p", "4")) * 1000;
var size = opt("--size", "390x844").split("x").map(Number);
var root = workflow.root, rel = path.relative(root, gameDir).replace(/\\/g, "/");
var outDir = path.join(root, "games/_tools/_bin/shots");
fs.mkdirSync(outDir, { recursive: true });

var types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".glb": "model/gltf-binary" };
var server = http.createServer(function (req, res) {
  var p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  fs.readFile(p, function (err, data) {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(p).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(0, "127.0.0.1", async function () {
  var url = "http://127.0.0.1:" + server.address().port + "/" + rel + "/index.html";
  var chromium;
  try { chromium = require("playwright").chromium; } catch (e) { console.error("playwright が要ります（Claude のクラウドには入っています）。"); process.exit(1); }
  var browser = await chromium.launch(), shots = [], errors = [];
  async function scene(label, key) {
    var page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, locale: "ja-JP" });
    page.on("pageerror", function (e) { errors.push(label + ": " + e.message); });
    try {
      await page.goto(url); await page.waitForTimeout(900);
      if (label !== "開始") {
        /* スペースで始める（始まらないゲームだけ画面をタップ） */
        await page.keyboard.press("Space"); await page.waitForTimeout(400);
        if (await page.evaluate(function () { var b = document.querySelector("button"); return !!(b && b.offsetParent && /start|スタート/i.test(b.textContent)); })) await page.mouse.click(size[0] / 2, size[1] * 0.6);
        await page.waitForTimeout(play - 400);
        if (key) { await page.keyboard.press(key); await page.waitForTimeout(wait); }
      }
      shots.push({ label: label, img: (await page.screenshot({ type: "jpeg", quality: 80 })).toString("base64") });
    } catch (e) { errors.push(label + ": " + e.message); }
    await page.close();
  }
  await scene("開始"); await scene("遊び中");
  for (var i = 0; i < keys.length; i++) await scene("キー" + keys[i], keys[i]);

  /* 1枚に並べる */
  var cols = Math.min(4, shots.length), w = 300, h = Math.round(w * size[1] / size[0]);
  var html = '<body style="margin:0;background:#222;font:700 22px sans-serif;color:#fff;display:grid;grid-template-columns:repeat(' + cols + ',' + w + 'px);gap:10px;padding:10px;width:max-content">' +
    shots.map(function (s) { return '<div><div style="padding:4px 2px">' + s.label + '</div><img src="data:image/jpeg;base64,' + s.img + '" style="width:' + w + 'px;height:' + h + 'px;display:block"></div>'; }).join("") + "</body>";
  var rows = Math.ceil(shots.length / cols);
  /* 立体のゲームのあとは描画が固まることがあるので、まとめ用は別のブラウザで開く */
  await browser.close(); browser = await chromium.launch();
  var sheet = await browser.newPage({ viewport: { width: cols * (w + 10) + 10, height: rows * (h + 44) + 10 } });
  await sheet.setContent(html); await sheet.waitForTimeout(300);
  var out = path.join(outDir, id + ".png");
  await sheet.screenshot({ path: out });
  await browser.close(); server.close();
  errors.forEach(function (e) { console.log("エラー " + e); });
  console.log("OK  " + path.relative(root, out) + "（" + shots.length + "場面）。破綻がないか見てから確認用ページを出す。");
});
