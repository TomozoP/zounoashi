/* ゲームのcanvasと音だけを録画する、手元用の道具。

     node games/_tools/record.js oushogi

   games/_recordings/<id>.mp4 または .webm に保存する。
   canvasを直接録るため、マウスカーソルやサイトの外枠は映らない。 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var cp = require('child_process');

var args = process.argv.slice(2);
var manual = args.indexOf('--manual') >= 0;
var id = args.filter(function (a) { return a !== '--manual'; })[0];
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.log('使い方: node games/_tools/record.js <id> [--manual]');
  process.exit(1);
}

var root = path.join(__dirname, '..', '..');
var dir = fs.existsSync(path.join(root, 'games', '_' + id)) ? '_' + id : id;
var gamePath = path.join(root, 'games', dir, 'index.html');
if (!fs.existsSync(gamePath)) {
  console.log('ゲームが無い: games/' + dir + '/index.html');
  process.exit(1);
}

var outDir = path.join(root, 'games', '_recordings');
fs.mkdirSync(outDir, { recursive: true });
var gameUrl = '/games/' + dir + '/index.html';
var output = null, recordingInfo = null, ended = false, why = null, child = null, timer = null;

/* 音の出口へつないだ節を、録画用の出口にもつなぐ。 */
var recorder = String.raw`<script>
(function () {
  'use strict';
  var manual = __MANUAL__;
  var nativeConnect = window.AudioNode && AudioNode.prototype.connect;
  if (nativeConnect) {
    AudioNode.prototype.connect = function (destination) {
      var result = nativeConnect.apply(this, arguments);
      if (window.AudioDestinationNode && destination instanceof AudioDestinationNode && !this.__recorded) {
        this.__recorded = true;
        if (!window.__recordSound || window.__recordSound.context !== this.context) {
          window.__recordSound = this.context.createMediaStreamDestination();
        }
        nativeConnect.call(this, window.__recordSound);
      }
      return result;
    };
  }

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function key() {
    var o = { key: ' ', code: 'Space', bubbles: true };
    window.dispatchEvent(new KeyboardEvent('keydown', o));
    window.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  function fail(message) { fetch('/__fail', { method: 'POST', body: String(message) }); }
  async function until(test, seconds) {
    var limit = performance.now() + seconds * 1000;
    while (performance.now() < limit) {
      if (test()) return true;
      await wait(16);
    }
    return false;
  }

  window.addEventListener('load', async function () {
    try {
      await document.fonts.ready;
      var canvas = document.querySelector('canvas');
      var probe = window.__probe;
      if (!canvas) throw Error('canvas が無い');
      if (!probe || !probe.now) throw Error('覗き穴が無い');
      var stage = document.getElementById('stage');
      if (stage) { stage.style.width = '540px'; stage.style.height = '960px'; }
      window.dispatchEvent(new Event('resize'));
      await wait(80);
      var recipe = window.__recording;
      var sound = recipe && recipe.sound ? recipe.sound() : null;
      if (sound && !window.__recordSound) window.__recordSound = sound.createMediaStreamDestination();
      await wait(150);

      var video = canvas.captureStream(60);
      var tracks = video.getVideoTracks();
      if (window.__recordSound) tracks = tracks.concat(window.__recordSound.stream.getAudioTracks());
      var stream = new MediaStream(tracks);
      /* ChromeのMP4直接録画は音の開始時刻がずれるため、まずWebMで一つの時計に録る。 */
      var types = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      var mime = types.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
      if (!mime) throw Error('このブラウザは動画を書き出せない');
      var chunks = [];
      var startedAt = 0;
      var rec = new MediaRecorder(stream, {
        mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000
      });
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { fail(e.error || '録画に失敗'); };
      rec.onstop = async function () {
        var blob = new Blob(chunks, { type: mime });
        var ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        var info = '&w=' + canvas.width + '&h=' + canvas.height +
          '&audio=' + stream.getAudioTracks().length + '&seconds=' + ((performance.now() - startedAt) / 1000).toFixed(2);
        await fetch('/__save?ext=' + ext + info, { method: 'POST', body: await blob.arrayBuffer() });
      };

      if (manual) {
        var note = document.createElement('div');
        note.textContent = 'F9で録画開始';
        note.style.cssText = 'position:fixed;z-index:9;left:12px;top:12px;padding:9px 14px;background:#111;color:#fff;font:16px sans-serif;border-radius:4px;opacity:.88;pointer-events:none';
        document.body.appendChild(note);
        var started = false;
        window.addEventListener('keydown', function (e) {
          if (e.key !== 'F9') return;
          e.preventDefault(); e.stopImmediatePropagation();
          if (!started) {
            started = true; startedAt = performance.now(); rec.start(250); note.textContent = '録画中　F9で停止';
          } else if (rec.state === 'recording') {
            note.textContent = '保存中'; rec.stop();
          }
        }, true);
        return;
      }

      startedAt = performance.now(); rec.start(250);
      var helper = { wait: wait, key: key, until: until, now: probe.now };
      if (recipe && recipe.run) await recipe.run(helper);
      else {
        await wait(1000); key();
        if (!await until(function () { return probe.now().state === 'result'; }, 20)) throw Error('勝敗が出ない');
        await wait(1500);
      }
      rec.stop();
    } catch (e) {
      fail(e.stack || e.message || e);
    }
  });
})();
</script>`;
recorder = recorder.replace('__MANUAL__', manual ? 'true' : 'false');

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};

var server = http.createServer(function (req, res) {
  var url = new URL(req.url, 'http://127.0.0.1');
  var pathname = decodeURIComponent(url.pathname);
  if (pathname === '/__save') {
    var bits = [];
    req.on('data', function (d) { bits.push(d); });
    req.on('end', function () {
      var ext = url.searchParams.get('ext') === 'mp4' ? 'mp4' : 'webm';
      recordingInfo = {
        width: url.searchParams.get('w'), height: url.searchParams.get('h'),
        audio: url.searchParams.get('audio'), seconds: url.searchParams.get('seconds')
      };
      output = path.join(outDir, id + '.' + ext);
      fs.writeFileSync(output, Buffer.concat(bits));
      res.writeHead(200); res.end('ok'); finish();
    });
    return;
  }
  if (pathname === '/__fail') {
    var messages = [];
    req.on('data', function (d) { messages.push(d); });
    req.on('end', function () {
      why = Buffer.concat(messages).toString();
      res.writeHead(200); res.end('ok'); finish();
    });
    return;
  }

  var file = path.join(root, pathname.replace(/^\/+/, ''));
  if (file.indexOf(root) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  if (pathname === gameUrl) {
    var html = fs.readFileSync(file, 'utf8');
    res.end(html.indexOf('</body>') >= 0 ? html.replace('</body>', recorder + '\n</body>') : html + recorder);
    return;
  }
  fs.createReadStream(file).pipe(res);
});

function browser() {
  var choices = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  for (var i = 0; i < choices.length; i++) if (fs.existsSync(choices[i])) return choices[i];
  return null;
}

server.listen(0, '127.0.0.1', function () {
  var exe = browser();
  if (!exe) { why = 'EdgeもChromeも見つかりません'; finish(); return; }
  var profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zrecord-'));
  var url = 'http://127.0.0.1:' + server.address().port + gameUrl + '?recorder-cli=1';
  var browserArgs = [
    '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--run-all-compositor-stages-before-draw',
    '--force-device-scale-factor=1', '--window-size=540,960',
    '--user-data-dir=' + profile, url
  ];
  if (!manual) browserArgs.unshift('--headless=new');
  child = cp.spawn(exe, browserArgs, { stdio: 'ignore', windowsHide: !manual });
  child.on('error', function (e) { why = 'ブラウザを立ち上げられない: ' + e.message; finish(); });
  console.log(manual ? '画面を操作し、F9で録画を開始・停止してください。' : id + ' を自動で進めて録画します…');
  timer = setTimeout(function () { why = '録画が時間切れになりました'; finish(); }, (manual ? 600 : 35) * 1000);
});

function finish() {
  if (ended) return;
  ended = true;
  if (timer) clearTimeout(timer);
  if (child) { try { child.kill(); } catch (e) {} }
  server.close();
  if (why || !output || !fs.existsSync(output)) {
    console.log('NG  ' + (why || '動画を保存できませんでした'));
    process.exitCode = 1;
    return;
  }
  var ffmpeg = path.join(__dirname, '_bin', 'ffmpeg.exe');
  if (path.extname(output) === '.webm' && fs.existsSync(ffmpeg)) {
    var mp4 = path.join(outDir, id + '.mp4');
    var converted = cp.spawnSync(ffmpeg, [
      '-y', '-i', output,
      '-vf', 'setpts=PTS-STARTPTS',
      '-af', 'asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4
    ], { encoding: 'utf8', windowsHide: true });
    if (converted.status !== 0 || !fs.existsSync(mp4)) {
      console.log('NG  MP4への変換に失敗しました');
      if (converted.stderr) console.log(converted.stderr.split(/\r?\n/).slice(-12).join('\n'));
      process.exitCode = 1; return;
    }
    output = mp4;
  }
  var size = Math.round(fs.statSync(output).size / 1024);
  console.log('OK  ' + path.relative(root, output).replace(/\\/g, '/') + '  ' + size + 'KB');
  if (recordingInfo) console.log(recordingInfo.width + '×' + recordingInfo.height + '  ' + recordingInfo.seconds + '秒  音声' + (recordingInfo.audio === '0' ? 'なし' : 'あり'));
  console.log('映像と音を同じ時計で録画し、時刻を揃えてMP4にしました。マウスカーソルは映っていません。');
}
