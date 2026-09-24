/* 架空県名クイズ: 県名の中身・全問正解・全問不正解・キー操作・カメラの寄り・押しどころの距離・画面の形を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_kakuu-ken/index.html';
/* テストのときだけ、正解と中身を覗く */
const inject = 'window.__dbg={target:function(){return target;},choices:function(){return choices.slice();},' +
  'NAMES:NAMES,SHAPES:SHAPES,BOX:BOX,aim:aim,goal:function(){return goal;},FULL:function(){return FULL;},MAP:function(){return MAP;}};';

function open(shape) {
  const g = load(file, { quiet: true, inject });
  if (shape) g.view(...shape);
  g.step(2);
  assert.equal(g.probe.now().state, 'intro', '開いたときはSTART待ち');
  g.press(' ');
  g.step(1);
  assert.equal(g.probe.now().state, 'play');
  return g;
}
const center = c => [c.x + c.w / 2, c.y + c.h / 2];
/* 答えて、次の問題（か結果）まで進める */
function answerBy(g, pick) {
  const d = g.dbg, t = d.target(), ch = d.choices();
  const k = pick(ch, t);
  const before = g.probe.now().q;
  g.tap(...center(g.probe.now().choices[k]));
  assert(g.probe.now().answered, '押すと答えが出る');
  assert(g.until(() => g.probe.now().state === 'result' || g.probe.now().q !== before, 200), '次へ進む');
  return ch[k] === t;
}

// 県名の中身
{
  const g = load(file, { quiet: true, inject });
  const N = g.dbg.NAMES;
  assert.equal(N.length, 47);
  assert.equal(g.dbg.SHAPES.length, 47);
  assert.equal(new Set(N).size, 47, '県名は重ならない');
  N.forEach(n => assert(/県$/.test(n), n));
  /* 実際の都道府県名は使わない */
  const REAL = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(' ');
  N.forEach(n => REAL.forEach(r => assert(!n.includes(r), n + ' に実在の名前 ' + r)));
  g.dbg.SHAPES.forEach((s, i) => assert(s.length >= 1 && s.every(r => r.length >= 4), (i + 1) + '番の形'));
}

// 全問正解・全問不正解・10問で終わる・もう一度
{
  const g = open();
  for (let i = 0; i < 10; i++) {
    const ch = g.dbg.choices();
    assert.equal(ch.length, 4); assert.equal(new Set(ch).size, 4, '選択肢は重ならない');
    assert(ch.includes(g.dbg.target()), '正解が選択肢にある');
    assert(answerBy(g, (c, t) => c.indexOf(t)));
  }
  assert.equal(g.probe.now().state, 'result');
  assert.equal(g.probe.now().score, 10);
  assert.deepEqual(g.probe.now().marks, Array(10).fill(true));

  /* 結果の「もう一度」 */
  g.step(30);
  const H = g.probe.now().H;
  g.tap(270 - 102, H * 0.62 + 27);
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().score, 0); assert.equal(g.probe.now().q, 0);

  const seen = new Set();
  for (let i = 0; i < 10; i++) { seen.add(g.dbg.target()); assert(!answerBy(g, (c, t) => c.findIndex(x => x !== t))); }
  assert.equal(seen.size, 10, '1回の中で同じ県は出ない');
  assert.equal(g.probe.now().state, 'result'); assert.equal(g.probe.now().score, 0);
}

// 答えた後は押しても変わらない・待ち時間
{
  const g = open();
  const t = g.dbg.target(), ch = g.dbg.choices();
  const wrong = ch.findIndex(x => x !== t), right = ch.indexOf(t);
  g.tap(...center(g.probe.now().choices[wrong]));
  g.tap(...center(g.probe.now().choices[right]));
  assert.deepEqual(g.probe.now().marks, [false], '2回目の押しは効かない');
  let f = 0; while (g.probe.now().q === 0) { g.step(1); f++; }
  assert(f >= 80 && f <= 120, '間違いの答えを見せる時間 ' + f + 'コマ');
  g.tap(...center(g.probe.now().choices[g.dbg.choices().indexOf(g.dbg.target())]));
  f = 0; while (g.probe.now().q === 1) { g.step(1); f++; }
  assert(f >= 50 && f <= 70, '正解を見せる時間 ' + f + 'コマ');
  /* 選択肢の外（地図）を押しても答えにならない */
  g.tap(270, 200);
  assert(!g.probe.now().answered);
}

// キーだけで遊べる
{
  const g = open();
  g.press(' ');
  assert(!g.probe.now().answered, '最初のスペースは目印を出すだけ');
  assert(g.probe.now().keyMode);
  g.press('ArrowRight'); assert.equal(g.probe.now().sel, 1);
  g.press('ArrowDown'); assert.equal(g.probe.now().sel, 3);
  g.press('ArrowLeft'); assert.equal(g.probe.now().sel, 2);
  g.press('ArrowUp'); assert.equal(g.probe.now().sel, 0);
  for (let i = 0; i < 10; i++) {
    const k = g.dbg.choices().indexOf(g.dbg.target());
    while (g.probe.now().sel !== k) g.press(k % 2 !== g.probe.now().sel % 2 ? 'ArrowRight' : 'ArrowDown');
    const q = g.probe.now().q;
    g.press(' ');
    assert(g.probe.now().answered);
    g.until(() => g.probe.now().state === 'result' || g.probe.now().q !== q, 200);
  }
  assert.equal(g.probe.now().score, 10);
  g.press(' ');
  assert.equal(g.probe.now().state, 'play', '結果でスペースはもう一度');
  g.esc();
  assert.equal(g.probe.now().q, 0, 'Escで最初から');
}

// どの県も、寄ったときに地図の中に見える大きさで収まる
for (const shape of load.SHAPES) {
  const g = open(shape);
  const d = g.dbg, M = d.MAP(), F = d.FULL();
  let small = Infinity;
  d.BOX.forEach((b, i) => {
    d.aim(i);
    const c = d.goal();
    assert(c.s >= F - 1e-9 && c.s <= F * 4 + 1e-9, '寄りすぎない');
    const x0 = (b[0] - c.x) * c.s + M.w / 2, x1 = (b[2] - c.x) * c.s + M.w / 2;
    const y0 = (b[1] - c.y) * c.s + M.h / 2, y1 = (b[3] - c.y) * c.s + M.h / 2;
    assert(x0 >= -1 && x1 <= M.w + 1 && y0 >= -1 && y1 <= M.h + 1, (i + 1) + '番が地図からはみ出す ' + shape);
    small = Math.min(small, Math.max(x1 - x0, y1 - y0));
  });
  assert(small >= 60, 'いちばん小さい県でも60以上に見える（' + Math.round(small) + '）' + shape);
  /* 押しどころの間隔と、地図に重ならないこと */
  const cs = g.probe.now().choices.map(center);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    assert(Math.hypot(cs[i][0] - cs[j][0], cs[i][1] - cs[j][1]) >= 63, '押しどころの間隔');
  }
  g.probe.now().choices.forEach(c => assert(c.y >= M.h && c.y + c.h <= g.probe.now().H, 'ボタンは地図の下で画面の中'));
}

console.log('架空県名クイズ: OK');
