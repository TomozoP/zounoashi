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
/* カードにある（まだ開いていない）読み／無い読みが出るまで進める */
function waitFor(g, onCard) {
  for (let k = 0; k < 200; k++) {
    const n = now(g), at = n.card.indexOf(n.call.kanji);
    if (n.phase === 'call' && (onCard ? at >= 0 && !n.open[at] : at < 0)) return at;
    /* 待っていない読みは、ライフを減らさないように片づける（カードにあれば開け、無ければ飛ばす） */
    if (n.phase === 'call') { if (at >= 0 && !n.open[at]) tapCell(g, at); else { const b = g.probe.box(); g.tap(b.x, b.y); } }
    toCall(g);
  }
  throw new Error('読みが来ない');
}
function start(g) { tapCell(g, 12); g.step(1); assert.equal(now(g).state, 'play'); }

/* 0. 字と読み: どのカードも、字も読みも重ならない。魚は魚へんの字 */
{
  const g = open();
  const sets = g.probe.sets();
  assert.deepEqual(sets.map(s => s.mark), ['魚', '木', '金', '鳥', '虫']);
  sets.forEach(s => {
    const fish = s.list;
    assert.ok(fish.length >= 32, s.mark + ' の字の数 ' + fish.length);
    assert.equal(new Set(fish.map(f => f.kanji)).size, fish.length, s.mark + ' 字が重ならない');
    assert.equal(new Set(fish.map(f => f.reading)).size, fish.length, s.mark + ' 読みが重ならない');
    fish.forEach(f => {
      assert.ok(/^[一-鿿]$/.test(f.kanji), f.kanji + ' は漢字1字');
      assert.ok(/^[ぁ-ゖー]+$/.test(f.reading), f.reading + ' はひらがな');
    });
  });
  sets[0].list.forEach(f => assert.ok(/^[魚-鱿]$/.test(f.kanji), f.kanji + ' は魚へんの字'));
}

/* 0b. 開始前に上の丸でカードを選ぶ。選ぶと配り直し、そのカードで始まる。左右キーでも選べる */
{
  const g = open();
  assert.equal(now(g).set, '魚');
  const b = g.probe.setButton(1); g.tap(b.x, b.y); g.step(30);
  assert.equal(now(g).state, 'intro', '選んだだけでは始まらない');
  assert.equal(now(g).set, '木');
  const wood = g.probe.sets()[1].list.map(f => f.kanji);
  assert.ok(now(g).card.filter(Boolean).every(k => wood.includes(k)), '木のカードに配り直す');
  g.press('ArrowRight'); assert.equal(now(g).set, '金');
  g.press('ArrowLeft'); g.press('ArrowLeft'); g.press('ArrowLeft'); assert.equal(now(g).set, '虫', '端から回る');
  const card = now(g).card;
  start(g);
  assert.deepEqual(now(g).card, card);
  const bug = g.probe.sets()[4].list.map(f => f.kanji);
  assert.ok(bug.includes(now(g).call.kanji), '虫の読みが出る');
  /* 丸の間隔もスマホで押せる */
  const a0 = g.probe.setButton(0), a1 = g.probe.setButton(1);
  assert.ok(a1.x - a0.x >= 63);
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
function perfect(g, set) {
  if (set) { const b = g.probe.setButton(set); g.tap(b.x, b.y); g.step(1); }
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
  /* 結果でもカードを選べる。選んでから「もう一度」でそのカードになる */
  const sb = g.probe.setButton(3); g.tap(sb.x, sb.y); g.step(1);
  assert.equal(now(g).state, 'result', '選んだだけでは始まらない');
  assert.equal(now(g).set, '鳥');
  const p = g.probe.result().retry;
  assert.ok(sb.y - p.y >= 63, '丸とボタンが離れている');
  g.tap(p.x, p.y); g.step(1);
  assert.equal(now(g).state, 'play');
  assert.equal(now(g).calls, 1);
  const bird = g.probe.sets()[3].list.map(f => f.kanji);
  assert.ok(now(g).card.filter(Boolean).every(k => bird.includes(k)), '鳥のカードで始まる');
  /* 結果では左右キーで選んで、スペースでもう一度 */
  const r2 = perfect(g);
  assert.equal(r2.state, 'result');
  g.press('ArrowRight'); assert.equal(now(g).set, '虫');
  g.press(' '); g.step(1);
  assert.equal(now(g).state, 'play');
  assert.equal(now(g).set, '虫');
}

/* 7. 回数のばらつき（全部取れた場合） */
['魚', '木', '金', '鳥', '虫'].forEach((mark, set) => {
  const scores = [];
  for (let k = 0; k < 40; k++) scores.push(perfect(open(), set).score);
  scores.sort((a, b) => a - b);
  const q = f => scores[Math.floor((scores.length - 1) * f)];
  console.log(mark + ' 全部取れた場合のビンゴまでの回数: 最小' + scores[0] + ' / 中央' + q(0.5) + ' / 9割' + q(0.9) + ' / 最大' + scores[scores.length - 1]);
  assert.ok(q(0.5) >= 8 && q(0.5) <= 40, '中央値が極端でない');
});

/* 9. ライフは3つ。違う字・カードにある字を流すと1つ減り、なくなると終わる。カードに無い字を飛ばしても減らない */
{
  const g = open(); start(g);
  assert.equal(now(g).lives, 3);
  waitFor(g, false);
  const b = g.probe.box(); g.tap(b.x, b.y); g.step(1);
  assert.equal(now(g).lives, 3, 'カードに無い字を飛ばしても減らない');
  toCall(g);
  const at = waitFor(g, true);
  const wrong = now(g).card.findIndex((k, i) => k && i !== at && !now(g).open[i]);
  tapCell(g, wrong); g.step(1);
  assert.equal(now(g).lives, 2, '違う字で1つ減る（カードにあった字を流しても、1回で減るのは1つ）');
  toCall(g);
  waitFor(g, true);
  g.step(Math.ceil(g.probe.callTime * 60) + 2);
  assert.equal(now(g).lives, 1, '時間切れで1つ減る');
  toCall(g);
  waitFor(g, true);
  const bb = g.probe.box(); g.tap(bb.x, bb.y); g.step(1);
  assert.equal(now(g).lives, 0, 'カードにある字を飛ばすと1つ減る');
  assert.equal(now(g).phase, 'over');
  g.until(() => now(g).state === 'result', 400);
  assert.ok(now(g).failed);
  const p = g.probe.result().retry; g.tap(p.x, p.y); g.step(1);
  assert.equal(now(g).lives, 3, 'もう一度で戻る');
  assert.ok(!now(g).failed);
}

/* 10. 開始前に選び直して時間が経ってから始めても、カードの字が見えている（配り直しの演出の時刻） */
{
  const g = open();
  g.step(300);
  const b = g.probe.setButton(2); g.tap(b.x, b.y); g.step(120);
  start(g);
  assert.ok(g.probe.dealAlpha(0) > 0.99, '始めた直後も字が見える ' + g.probe.dealAlpha(0));
}

/* 8. 画面の形を変えても、マス同士・箱が押せる大きさ */
[[375, 667], [390, 844], [430, 932], [768, 1024]].forEach(v => {
  const g = open(v);
  const a = g.probe.cell(0), b = g.probe.cell(1), d = g.probe.cell(5);
  assert.ok(b.x - a.x >= 63 && d.y - a.y >= 63, v + ' マスの間隔 ' + (b.x - a.x) + ',' + (d.y - a.y));
  assert.ok(d.y + (d.y - a.y) * 4 < now(g).H, v + ' カードが画面に収まる');
});

console.log('魚へんビンゴ: ok');
