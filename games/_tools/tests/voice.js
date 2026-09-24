/* 母音合成の声（games/voice.js）: かなの読みから声の並びを作る・鳴らす・途中で止める、を確かめる。
   一輪車で鍋・同時球技5種・偏県が使う。ここを変えたら、その3本の声も聞いて確かめること。 */
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', '..', 'voice.js'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(code, ctx);
const V = ctx.window.zVoice;

/* 鳴らした命令を数えるだけの、偽の音声の仕組み */
function fakeAC() {
  const log = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() { log.push('cancel'); } });
  const node = kind => ({ kind, gain: param(), frequency: param(), Q: param(), connect() {}, start() { log.push(kind + ':start'); }, stop(t) { log.push(kind + ':stop@' + t.toFixed(2)); } });
  return {
    log, currentTime: 0, sampleRate: 8000, destination: {},
    createGain: () => node('gain'), createOscillator: () => node('osc'), createBiquadFilter: () => node('biquad'),
    createBufferSource: () => node('src'), createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) })
  };
}
const pairs = w => w.map(x => x[0] + x[1]).join(' ');

// かな → 声の並び
assert.equal(pairs(V.kana('ごちそうさまでした')), 'go chi so u sa ma de shi ta');
assert.equal(pairs(V.kana('きゃしゅちょじゃ')), 'ka shu cho ja', '小さい字は母音を差し替える');
assert.equal(pairs(V.kana('カタカナ')), 'ka ta ka na', 'カタカナも読む');
assert.equal(pairs(V.kana('らーめん')), 'ra me n', 'ーはのばす、んは鼻に抜ける');
assert.equal(V.kana('らーめん', 0.1)[0][2].toFixed(2), '0.20', 'ーのぶん長くなる');
assert.equal(pairs(V.kana('なっとう')), 'na  to u', 'っは間');
assert.equal(pairs(V.kana('「よこはま」、と')), 'yo ko ha ma  to', 'かぎかっこは読まず、読点はひと息');
assert.equal(V.kana('あ、い', 0.1)[1][2].toFixed(2), '0.20', '読点のひと息は2拍');
assert.equal(pairs(V.kana('ふつじ')), 'hu chu ji');
V.kana('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ')
  .forEach(w => assert(/^[aiueon]$/.test(w[1]), '母音がある: ' + w));

// 鳴らす: 終わる時刻は並びの長さの合計。止めると声がすぐ止まる
{
  const ac = fakeAC();
  const w = V.kana('ぎゅうたん', 0.15);
  const v = V.speak(ac, 1, 200, w);
  const len = w.reduce((s, x) => s + x[2], 0);
  assert(Math.abs(v.end - (1 + len)) < 1e-9, '終わる時刻');
  assert(ac.log.includes('osc:start'));
  ac.currentTime = 1.2;
  v.stop();
  assert(ac.log.includes('cancel') && ac.log.includes('osc:stop@1.32'), '止めると0.12秒で消える');
}
// 抑揚: swing を指定しないときは今までどおり（1.12倍から0.82倍へ下がる）。小さくすると幅が縮む
{
  const range = opts => {
    const fs = [];
    const ac = fakeAC();
    const osc = ac.createOscillator;
    ac.createOscillator = () => { const o = osc(); o.frequency.setTargetAtTime = v => fs.push(v); return o; };
    V.speak(ac, 0, 400, V.kana('あいうえおあいうえお', 0.1), opts);
    return [Math.max(...fs) / 400, Math.min(...fs) / 400];
  };
  const full = range(), soft = range({ swing: 0.35 });
  assert(Math.abs(full[0] - 1.12) < 1e-9 && full[1] > 0.84 && full[1] < 0.86, '今までどおりの幅: ' + full);
  assert(Math.abs(range({ swing: 1 })[0] - 1.12) < 1e-9);
  assert(soft[0] - soft[1] < (full[0] - full[1]) * 0.4, '抑えると幅が縮む: ' + soft);
}
// 間（母音なし）が入っても鳴らせる
{
  const ac = fakeAC();
  const v = V.speak(ac, 0, 200, V.kana('あっ、ん。'));
  assert(v.end > 0);
}

console.log('声: OK');
