/* =========================================================================
   editor.html の「保存」を受けて、scenario.js をその場で書き換える小さな番人。

   使い方（このフォルダで）:
     node save-server.js

   立ち上げっぱなしにしておけば、editor.html の「保存」を押すたびに
   scenario.js が書き換わります。止めるときは Ctrl+C。

   書き換えるのは、このフォルダの scenario.js だけです。
   外からは触れないよう、127.0.0.1（自分のパソコン）だけで待ち受けます。
   ========================================================================= */
var http = require("http");
var fs   = require("fs");
var path = require("path");

var ROOT  = __dirname;
var ALLOW = ["scenario.js"];      // 書き換えてよいファイル
var PORT  = 8736;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

http.createServer(function (req, res) {
  cors(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/ping") {                       // 動いているかの確認用
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, root: ROOT }));
    return;
  }

  /* 画面から作った絵（サムネ）を受け取って置く */
  if (req.method === "POST" && req.url === "/save-image") {
    var raw = "";
    req.on("data", function (c) { raw += c; });
    req.on("end", function () {
      try {
        var d = JSON.parse(raw);
        if (!/^img\/[\w.-]+\.(png|jpg|webp)$/.test(d.file)) throw new Error("その名前では置けません: " + d.file);
        var body = String(d.data).replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(path.join(ROOT, d.file), Buffer.from(body, "base64"));
        console.log(new Date().toLocaleTimeString("ja-JP") + "  " + d.file + " を置きました");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/save") { res.writeHead(404); res.end(); return; }

  var body = "";
  req.on("data", function (c) { body += c; });
  req.on("end", function () {
    try {
      var data = JSON.parse(body);
      if (ALLOW.indexOf(data.file) < 0) throw new Error("そのファイルは書き換えられません: " + data.file);
      if (typeof data.text !== "string" || !data.text.length) throw new Error("中身が空です");

      var file = path.join(ROOT, data.file);

      /* 上書きする前に、いまの中身を history に取っておく */
      if (fs.existsSync(file)) {
        var dir = path.join(ROOT, "history");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        var d = new Date();
        var stamp = d.getFullYear() +
          ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "_" +
          ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2);
        fs.copyFileSync(file, path.join(dir, data.file.replace(/\.js$/, "") + "_" + stamp + ".js"));
      }

      fs.writeFileSync(file, data.text, "utf8");

      var t = new Date().toLocaleTimeString("ja-JP");
      console.log(t + "  " + data.file + " を保存しました（" + data.text.length + "文字）／ 前の中身は history に残しました");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.log("保存できませんでした: " + e.message);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}).listen(PORT, "127.0.0.1", function () {
  console.log("保存サーバーを立ち上げました  http://localhost:" + PORT);
  console.log("書き換え先: " + path.join(ROOT, "scenario.js"));
  console.log("editor.html の「保存」が、そのままこのファイルに入ります。止めるときは Ctrl+C。");
});
