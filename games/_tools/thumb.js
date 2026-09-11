/* サムネを、動いている画面から作る。

     node games/_tools/thumb.js hoge

   走らせるとサーバーが待つので、ブラウザでゲームを開いて、
   表示された1行を開発者ツールのコンソールに貼る。
   いま見えている画面が games/_hoge/img/thumb.webp （600x600）になる。

   カードは正方形に切られる（object-fit: cover）ので、
   縦長の画面をそのまま切ると上下が落ちる。貼る1行は、
   「上のほう」と「下のほう」を選んで詰めた正方形を作る。
   既定は上1/4と下2/4あたり。TOP/BOT を書き換えれば変えられる。 */

var http = require("http");
var fs = require("fs");
var path = require("path");

var id = process.argv[2];
if (!id) { console.log("使い方: node games/_tools/thumb.js <id>"); process.exit(1); }

var root = path.join(__dirname, "..", "..");
var dir = fs.existsSync(path.join(root, "games", "_" + id)) ? "_" + id : id;
var out = path.join(root, "games", dir, "img", "thumb.webp");
fs.mkdirSync(path.dirname(out), { recursive: true });

var snippet =
  "(async function(){var s=document.querySelector('canvas'),k=s.width/540," +
  "TOP={y:90,h:170},BOT={y:s.height/k-540+TOP.h,h:540-TOP.h}," +
  "cv=document.createElement('canvas');cv.width=cv.height=600;var c=cv.getContext('2d');" +
  "c.imageSmoothingQuality='high';" +
  "c.drawImage(s,0,TOP.y*k,540*k,TOP.h*k,0,0,600,TOP.h*600/540);" +
  "c.drawImage(s,0,BOT.y*k,540*k,BOT.h*k,0,TOP.h*600/540,600,BOT.h*600/540);" +
  "var b=await new Promise(r=>cv.toBlob(r,'image/webp',0.9));" +
  "var n=await (await fetch('http://127.0.0.1:8736/save',{method:'POST',body:b})).text();" +
  "console.log('保存しました '+n+' バイト');})()";

console.log("ゲームをブラウザで開いて、いちばん見せたい画面にしてから、");
console.log("開発者ツールのコンソールに次の1行を貼ってください:\n");
console.log(snippet + "\n");
console.log("保存先: games/" + dir + "/img/thumb.webp");
console.log("（上1/4と下2/4を詰めて正方形にします。切り取り位置は TOP を変えて調整）\n");

http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") { res.writeHead(404); res.end(); return; }
  var chunks = [];
  req.on("data", function (c) { chunks.push(c); });
  req.on("end", function () {
    var buf = Buffer.concat(chunks);
    fs.writeFileSync(out, buf);
    console.log("保存しました: " + out + "  (" + buf.length.toLocaleString() + " バイト)");
    res.writeHead(200); res.end(String(buf.length));
    setTimeout(function () { process.exit(0); }, 200);
  });
}).listen(8736, "127.0.0.1", function () { console.log("待っています… (Ctrl+C でやめる)"); });
setTimeout(function () { console.log("時間切れ"); process.exit(1); }, 300000);
