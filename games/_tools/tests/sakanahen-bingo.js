/* 魚へんビンゴ: 開始・正しい字で開く・違う字で流れる・時間切れ・箱で飛ばす・キー操作・ビンゴまでの回数を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_sakanahen-bingo/index.html';

const open = shape => { const g = load(file, { quiet: true }); if (shape) g.view(...shape); g.step(2); return g; };
const tapCell = (g, i) => { const p = g.probe.cell(i); g.tap(p.x, p.y); };
const now = g => g.probe.now();
const cellOf = g => { const n = now(g); return n.card.indexOf(n.call.kanji); };
/* 次の読みが出るまで進める */
const toCall = g => { const c = now(g).calls; g.until(() => now(g).calls !== c || now(g).state !== 'play', 400); };
/* カードにある（まだ開いていない）読み／無い読みが出るまで、箱で飛ばす */
function waitFor(g, onCard) {
  for (let k = 0; k < 200; k++) {
    const n = now(g), at = n.card.indexOf(n.call.kanji);
    if (n.phase === 'call' && (onCard ? at >= 0 && !n.open[at] : at < 0)) return at;
    if (n.phase === 'call') { const b = g.probe.box(); g.tap(b.x, b.y); }
    toCall(g);
  }
  throw new Error('読みが来ない');
}
function start(g) { tapCell(g, 12); g.step(1); assert.equal(now(g).state, 'play'); }

/* 0. 字と読み: 魚へんで、字も読みも重ならない */
{
  const g = open();
  const fish = g.probe.fish();
  assert.ok(fish.length >= 40, '字の数');
  assert.equal(new Set(fish.map(f => f.kanji)).size, fish.length, '字が重ならない');
  assert.equal(new Set(fish.map(f => f.reading)).size, fish.length, '読みが重ならない');
  fish.forEach(f => {
    assert.ok(/^[魚-鱿]$/.test(f.kanji), f.kanji + ' は魚へんの字');
    assert.ok(/^[ぁ-ゖー]+$/.test(f.reading), f.reading + ' はひらがな');
  });
}

/* 1. 開始前は真ん中を押すまで始まらない。カードは24字＋真ん中 */
{
  const g = open();
  const card = now(g).card;
  assert.equal(now(g).state, 'intro');
  assert.equal(card.filter(Boolean).length, 24);
  assert.equal(card[12], null);
  assert.equal(new Set(card.filter(Boolean)).size, 24, 'カードの字が重ならない');
  [0, 11, 24].forEach(i => tapCell(g, i)); g.esc(); g.step(30);
  assert.equal(now(g).state, 'intro', '真ん中以外やEscでは始まらない');
  start(g);
  assert.deepEqual(now(g).card, card, '見えていたカードのまま');
  assert.ok(now(g).open[12]);
  assert.equal(now(g).phase, 'call');
  assert.equal(now(g).calls, 1);
}

/* 2. スペースでも始まる（離したとき） */
{
  const g = open();
  g.key(' '); g.step(1);
  assert.equal(now(g).state, 'intro', '押しただけでは始まらない');
  g.key(' ', true); g.step(1);
  assert.equal(now(g).state, 'play');
}

/* 3. 正しい字を押すと開いて次へ。違う字を押すと流れ、正しいマスも開かない */
{
  const g = open(); start(g);
  const at = waitFor(g, true);
  tapCell(g, at); g.step(1);
  assert.ok(now(g).open[at], '正しい字で開く');
  assert.equal(now(g).outcome, 'ok');
  const c = now(g).calls; toCall(g);
  assert.equal(now(g).calls, c + 1, '次の読みへ');

  const at2 = waitFor(g, true);
  const wrong = now(g).card.findIndex((k, i) => k && i !== at2 && !now(g).open[i]);
  tapCell(g, wrong); g.step(1);
  assert.equal(now(g).outcome, 'wrong');
  assert.ok(!now(g).open[wrong], '違う字は開かない');
  tapCell(g, at2); g.step(1);
  assert.ok(!now(g).open[at2], '流れた後に正しい字を押しても開かない');
}

/* 4. 時間切れで流れる。カードに無い読みは箱を押すと飛ばせる */
{
  const g = open(); start(g);
  const at = waitFor(g, true);
  g.step(Math.ceil(g.probe.callTime * 60) + 2);
  assert.equal(now(g).outcome, 'time');
  assert.ok(!now(g).open[at]);
  toCall(g);
  waitFor(g, false);
  const c = now(g).calls, b = g.probe.box();
  g.tap(b.x, b.y); g.step(1);
  assert.equal(now(g).outcome, 'pass');
  toCall(g);
  assert.equal(now(g).calls, c + 1);
}

/* 5. キー: 矢印で選んでスペースで押す */
{
  const g = open(); start(g);
  const at = waitFor(g, true);
  g.press('ArrowRight');                           /* 最初の1回は枠を出すだけ */
  assert.ok(now(g).keyMode);
  assert.equal(now(g).cursor, 0);
  const r = Math.floor(at / 5), c = at % 5;
  for (let i = 0; i < r; i++) g.press('ArrowDown');
  for (let i = 0; i < c; i++) g.press('ArrowRight');
  assert.equal(now(g).cursor, at);
  g.press(' '); g.step(1);
  assert.ok(now(g).open[at], 'スペースで選んだマスが開く');
}

/* 6. 全部取れば必ずビンゴになり、結果は出た読みの数。もう一度で最初から */
function perfect(g) {
  start(g);
  for (let k = 0; k < 400 && now(g).state === 'play'; k++) {
    const n = now(g);
    if (n.phase === 'call') {
      const at = cellOf(g);
      if (at >= 0 && !n.open[at]) tapCell(g, at); else { const b = g.probe.box(); g.tap(b.x, b.y); }
    }
    g.step(10);
  }
  g.until(() => now(g).state === 'result', 400);
  return now(g);
}
{
  const g = open();
  const r = perfect(g);
  assert.equal(r.state, 'result');
  assert.ok(r.bingo && r.bingo.length === 5);
  assert.equal(r.score, r.calls);
  const p = g.probe.result().retry;
  g.tap(p.x, p.y); g.step(1);
  assert.equal(now(g).state, 'play');
  assert.equal(now(g).calls, 1);
}

/* 7. 回数のばらつき（全部取れた場合） */
{
  const scores = [];
  for (let k = 0; k < 60; k++) scores.push(perfect(open()).score);
  scores.sort((a, b) => a - b);
  const q = f => scores[Math.floor((scores.length - 1) * f)];
  console.log('全部取れた場合のビンゴまでの回数: 最小' + scores[0] + ' / 中央' + q(0.5) + ' / 9割' + q(0.9) + ' / 最大' + scores[scores.length - 1]);
  assert.ok(q(0.5) >= 8 && q(0.5) <= 40, '中央値が極端でない');
}

/* 8. 画面の形を変えても、マス同士・箱が押せる大きさ */
[[375, 667], [390, 844], [430, 932], [768, 1024]].forEach(v => {
  const g = open(v);
  const a = g.probe.cell(0), b = g.probe.cell(1), d = g.probe.cell(5);
  assert.ok(b.x - a.x >= 63 && d.y - a.y >= 63, v + ' マスの間隔 ' + (b.x - a.x) + ',' + (d.y - a.y));
  assert.ok(d.y + (d.y - a.y) * 4 < now(g).H, v + ' カードが画面に収まる');
});

console.log('魚へんビンゴ: ok');
