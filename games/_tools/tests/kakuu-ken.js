/* 架空県名クイズ: 県名の中身・47県を一覧から当てていく・全問正解・全問不正解・使用済み・一覧のスクロール・キー操作・カメラの寄り・押しどころの距離を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_kakuu-ken/index.html';
/* テストのときだけ、正解と中身を覗く */
const inject = 'window.__dbg={target:function(){return target;},list:function(){return list.slice();},reveal:reveal,' +
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
/* 一覧のk番目を見えるところまで動かして押す */
function tapName(g, k) {
  g.dbg.reveal(k);
  g.until(() => { const p = g.probe.now(), c = p.list[k]; return c.y >= p.listTop && c.y + c.h <= p.listBottom; }, 120);
  const c = g.probe.now().list[k];
  g.tap(...center(c));
}
/* 答えて、次の問題（か結果）まで進める */
function answerBy(g, pick) {
  const t = g.dbg.target(), L = g.dbg.list();
  const k = pick(L, t, g.probe.now().list);
  const before = g.probe.now().q;
  tapName(g, k);
  assert(g.probe.now().answered, '押すと答えが出る');
  assert(g.until(() => g.probe.now().state === 'result' || g.probe.now().q !== before, 200), '次へ進む');
  return L[k] === t;
}

// 県名の中身
{
  const g = load(file, { quiet: true, inject });
  const N = g.dbg.NAMES;
  assert.equal(N.length, 47);
  assert.equal(g.dbg.SHAPES.length, 47);
  assert.equal(new Set(N).size, 47, '県名は重ならない');
  N.forEach(n => assert(/^[一-鿿]{2,3}県$/.test(n), '漢字2〜3字＋県: ' + n));
  /* 実際の都道府県名は使わない */
  const REAL = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(' ');
  N.forEach(n => REAL.forEach(r => assert(!n.includes(r), n + ' に実在の名前 ' + r)));
  g.dbg.SHAPES.forEach((s, i) => assert(s.length >= 1 && s.every(r => r.length >= 4), (i + 1) + '番の形'));
}

// 全問正解・47問で終わる・使用済み・もう一度・全問不正解
{
  const g = open();
  assert.equal(g.probe.now().list.length, 47, '一覧に47個すべて出る');
  const seen = new Set();
  for (let i = 0; i < 47; i++) {
    seen.add(g.dbg.target());
    assert(g.dbg.list().includes(g.dbg.target()));
    assert(answerBy(g, (L, t) => L.indexOf(t)));
    if (i < 46) assert.equal(g.probe.now().list.filter(c => c.used).length, i + 1, '当てた名前は使用済み');
  }
  assert.equal(seen.size, 47, '47県すべてが1回ずつ出る');
  assert.equal(g.probe.now().state, 'result');
  assert.equal(g.probe.now().score, 47);

  g.step(30);
  const H = g.probe.now().H;
  g.tap(270 - 102, H * 0.62 + 27);
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().score, 0); assert.equal(g.probe.now().q, 0);
  assert.equal(g.probe.now().list.filter(c => c.used).length, 0, 'もう一度で一覧が戻る');

  /* 最後の1問は残りが1つなので、46問まで外す */
  for (let i = 0; i < 46; i++) assert(!answerBy(g, (L, t, P) => L.findIndex((x, k) => x !== t && !P[k].used)));
  assert(answerBy(g, (L, t) => L.indexOf(t)));
  assert.equal(g.probe.now().score, 1);
  assert.equal(g.probe.now().done.filter(d => d === 2).length, 46, '外した県は外した印');
}

// 使用済みの名前は押せない・答えた後は押しても変わらない・待ち時間・なぞると押さない
{
  const g = open();
  const t = g.dbg.target(), L = g.dbg.list();
  const right = L.indexOf(t), wrong = L.findIndex(x => x !== t);
  tapName(g, wrong);
  const q = g.probe.now().q;
  g.tap(...center(g.probe.now().list[right]));
  assert.deepEqual(g.probe.now().done.filter(d => d).length, 1, '2回目の押しは効かない');
  let f = 0; while (g.probe.now().q === q) { g.step(1); f++; }
  assert(f >= 70 && f <= 110, '間違いの答えを見せる時間 ' + f + 'コマ');
  /* 使用済み（さっきの正解の名前）は押しても答えにならない */
  tapName(g, right);
  assert(!g.probe.now().answered, '使用済みは押せない');
  /* 地図を押しても答えにならない */
  g.tap(270, 100);
  assert(!g.probe.now().answered);
  /* 一覧をなぞるとスクロールして、答えにはならない */
  const p = g.probe.now();
  if (p.maxScroll > 0) {
    const s0 = p.scroll, y = p.listBottom - 20;
    g.drag([{ x: 100, y }, { x: 100, y: y - 40 }, { x: 100, y: y - 120 }], 1);
    assert(!g.probe.now().answered, 'なぞっただけでは選ばない');
    assert(g.probe.now().scroll > s0, 'なぞると一覧が動く');
  }
}

// キーだけで遊べる
{
  const g = open();
  g.press(' ');
  assert(!g.probe.now().answered, '最初のスペースは目印を出すだけ');
  assert(g.probe.now().keyMode);
  g.press('ArrowRight'); assert.equal(g.probe.now().sel, 1);
  g.press('ArrowDown'); assert.equal(g.probe.now().sel, 5);
  g.press('ArrowLeft'); assert.equal(g.probe.now().sel, 4);
  g.press('ArrowUp'); assert.equal(g.probe.now().sel, 0);
  for (let i = 0; i < 47; i++) {
    const k = g.dbg.list().indexOf(g.dbg.target());
    let n = 0;
    while (g.probe.now().sel !== k && n++ < 60) g.press(g.probe.now().sel < k ? 'ArrowRight' : 'ArrowLeft');
    assert.equal(g.probe.now().sel, k, '左右で正解の名前まで行ける');
    const q = g.probe.now().q;
    g.press(' ');
    assert(g.probe.now().answered);
    g.until(() => g.probe.now().state === 'result' || g.probe.now().q !== q, 200);
  }
  assert.equal(g.probe.now().score, 47);
  g.press(' ');
  assert.equal(g.probe.now().state, 'play', '結果でスペースはもう一度');
  g.esc();
  assert.equal(g.probe.now().q, 0, 'Escで最初から');
}

// どの県も、寄ったときに地図の中に見える大きさで収まる・一覧の押しどころ
for (const shape of load.SHAPES) {
  const g = open(shape);
  const d = g.dbg, M = d.MAP(), F = d.FULL();
  let small = Infinity;
  d.BOX.forEach((b, i) => {
    d.aim(i);
    const c = d.goal();
    const x0 = (b[0] - c.x) * c.s + M.w / 2, x1 = (b[2] - c.x) * c.s + M.w / 2;
    const y0 = (b[1] - c.y) * c.s + M.h / 2, y1 = (b[3] - c.y) * c.s + M.h / 2;
    assert(x0 >= -1 && x1 <= M.w + 1 && y0 >= -1 && y1 <= M.h + 1, (i + 1) + '番が地図からはみ出す ' + shape);
    small = Math.min(small, Math.max(x1 - x0, y1 - y0));
  });
  assert(small >= 45, 'いちばん小さい県でも45以上に見える（' + Math.round(small) + '）' + shape);
  const p = g.probe.now(), cs = p.list.map(center);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    assert(Math.hypot(cs[i][0] - cs[j][0], cs[i][1] - cs[j][1]) >= 63, '押しどころの間隔');
  }
  assert(p.listTop >= M.h, '一覧は地図の下');
  /* 一番下までスクロールすると、最後の名前が見える */
  d.reveal(46); g.step(120);
  const last = g.probe.now().list[46];
  assert(last.y >= p.listTop && last.y + last.h <= p.listBottom, '最後の名前まで届く ' + shape);
}

console.log('架空県名クイズ: OK');
