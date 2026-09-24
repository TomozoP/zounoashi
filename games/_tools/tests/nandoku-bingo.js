/* 難読ビンゴ: 開始・正しい字で開く・違う字で流れる・時間切れ・箱で飛ばす・キー操作・ビンゴまでの回数を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/nandoku-bingo/index.html';

const open = shape => { const g = load(file, { quiet: true }); if (shape) g.view(...shape); g.step(2); return g; };
const tapCell = (g, i) => { const p = g.probe.cell(i); g.tap(p.x, p.y); };
const now = g => g.probe.now();
/* カードの並び（やさしい順に左から）。位置ではなく字で選ぶ */
const ORDER = ['木', '金', '虫', '魚', '鳥', '難', '𰻞'];
const I = m => ORDER.indexOf(m);
const cellOf = g => { const n = now(g); return n.card.indexOf(n.call.kanji); };
/* 次の読みが出るまで進める */
/* 抽選機から玉が出きるまで（読みが出るまで）進める */
const toShown = g => g.until(() => now(g).phase !== 'draw' || now(g).state !== 'play', 200);
const toCall = g => { const c = now(g).calls; g.until(() => (now(g).calls !== c && now(g).phase !== 'draw') || now(g).state !== 'play', 400); };
/* カードにある（まだ開いていない）読み／無い読みが出るまで進める */
function waitFor(g, onCard) {
  for (let k = 0; k < 200; k++) {
    if (now(g).phase === 'draw') toShown(g);
    const n = now(g), at = n.card.indexOf(n.call.kanji);
    if (n.phase === 'call' && (onCard ? at >= 0 && !n.open[at] : at < 0)) return at;
    /* 待っていない読みは、ライフを減らさないように片づける（カードにあれば開け、無ければ飛ばす） */
    if (n.phase === 'call') { if (at >= 0 && !n.open[at]) tapCell(g, at); else { const b = g.probe.skip(); g.tap(b.x, b.y); } }
    toCall(g);
  }
  throw new Error('読みが来ない');
}
/* 結果から「もう一度」でカード選びへ戻る */
function back(g) { const r = g.probe.result().retry; g.tap(r.x, r.y); g.step(1); assert.equal(now(g).state, 'intro'); }
function start(g) { tapCell(g, 12); g.step(1); assert.equal(now(g).state, 'play'); toShown(g); }

/* 0. 字と読み: どのカードも、字も読みも重ならない。魚は魚へんの字 */
{
  const g = open();
  const sets = g.probe.sets();
  assert.deepEqual(sets.map(s => s.mark), ORDER, 'やさしい順に左から');
  assert.equal(g.probe.setCount(), 6, '難は最初から選べて、𰻞 はまだ出ていない');
  /* 難と 𰻞 は、ほかのカードに入っていない字だけ */
  [5, 6].forEach(k => {
    const others = new Set(sets.filter((s, j) => j !== k).flatMap(s => s.list.map(f => f.kanji)));
    sets[k].list.forEach(f => assert.ok(!others.has(f.kanji), sets[k].mark + ' の ' + f.kanji + ' はほかのカードにもある'));
  });
  sets.forEach(s => {
    const fish = s.list;
    assert.ok(fish.length >= 32, s.mark + ' の字の数 ' + fish.length);
    assert.ok(!fish.some(f => f.kanji === s.mark), s.mark + ' のカードに「' + s.mark + '」そのものが入っている');
    assert.equal(new Set(fish.map(f => f.kanji)).size, fish.length, s.mark + ' 字が重ならない');
    assert.equal(new Set(fish.map(f => f.reading)).size, fish.length, s.mark + ' 読みが重ならない');
    fish.forEach(f => {
      assert.ok(/^[一-鿿]$/.test(f.kanji), f.kanji + ' は漢字1字');
      assert.ok(/^[ぁ-ゖー]+$/.test(f.reading), f.reading + ' はひらがな');
    });
  });
  sets[I('魚')].list.forEach(f => assert.ok(/^[魚-鱿]$/.test(f.kanji), f.kanji + ' は魚へんの字'));
}

/* 0b. 開始前に上の丸でカードを選ぶ。選ぶと配り直し、そのカードで始まる。左右キーでも選べる */
{
  const g = open();
  assert.equal(now(g).set, '魚', '最初は魚');
  const b = g.probe.setButton(I('木')); g.tap(b.x, b.y); g.step(30);
  assert.equal(now(g).state, 'intro', '選んだだけでは始まらない');
  assert.equal(now(g).set, '木');
  const wood = g.probe.sets()[I('木')].list.map(f => f.kanji);
  assert.ok(now(g).card.filter(Boolean).every(k => wood.includes(k)), '木のカードに配り直す');
  g.press('ArrowRight'); assert.equal(now(g).set, '金');
  g.press('ArrowLeft'); g.press('ArrowLeft'); assert.equal(now(g).set, '難', '端から回る');
  const card = now(g).card;
  start(g);
  assert.deepEqual(now(g).card, card);
  const hard0 = g.probe.sets()[I('難')].list.map(f => f.kanji);
  assert.ok(hard0.includes(now(g).call.kanji), '難の読みが出る');
  /* 6つ並べても、丸の間隔はスマホで押せて、画面に収まる */
  const a0 = g.probe.setButton(0), a1 = g.probe.setButton(1);
  assert.ok(a1.x - a0.x >= 63);
  assert.ok(g.probe.setButton(5).x + 34 <= now(g).W && a0.x - 34 >= 0, '画面に収まる');
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

/* 1b. 読みごとに、まず抽選機が回って玉が出る（その間は押しても開かず、ライフも減らない）。そのあと読みが出る */
{
  const g = open();
  tapCell(g, 12); g.step(1);
  assert.equal(now(g).phase, 'draw', 'まず抽選');
  const n = now(g), at = n.card.indexOf(n.call.kanji);
  const other = n.card.findIndex((k, i) => k && i !== at);
  tapCell(g, other); g.step(1);
  assert.equal(now(g).lives, 3, '抽選中に押してもライフは減らない');
  assert.equal(now(g).phase, 'draw');
  let frames = 0;
  while (now(g).phase === 'draw' && frames < 200) { g.step(1); frames++; }
  assert.equal(now(g).phase, 'call');
  assert.ok(frames >= 50 && frames <= 90, '玉が出て大きく映るまで1秒ほど ' + frames);
  /* 正解の漢字（玉の裏）は、答えを出すまで描かない */
  const g2 = open(); tapCell(g2, 12);
  let seen = false;
  for (let f = 0; f < 200 && now(g2).phase !== 'reveal'; f++) { g2.step(1); if (g2.probe.backShown() && now(g2).phase !== 'reveal') seen = true; if (f === 120) { const sk = g2.probe.skip(); g2.tap(sk.x, sk.y); } }
  assert.ok(!seen, '答えの前に裏の漢字が見えている');
  g2.step(10);
  assert.ok(g2.probe.backShown(), '答えのときは見える');
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
  const c = now(g).calls, b = g.probe.skip();
  g.tap(b.x, b.y); g.step(1);
  assert.equal(now(g).outcome, 'pass');
  toCall(g);
  assert.equal(now(g).calls, c + 1);
}

/* 4b. 飛ばすのはスキップボタンと X キーだけ。箱のほかの場所（玉）を押しても飛ばない。抽選中は効かない */
{
  const g = open(); start(g);
  waitFor(g, false);
  const ball = g.probe.box(); g.tap(ball.x, ball.y); g.step(1);
  assert.equal(now(g).phase, 'call', '玉を押しても飛ばない');
  const sk = g.probe.skip();
  const c0 = g.probe.cell(0);
  assert.ok(c0.y - sk.y >= 63, 'ボタンとカードのマスが離れている');
  assert.ok(sk.x + 42 <= now(g).W - 16, 'ボタンが箱に収まる');
  g.press('x'); g.step(1);
  assert.equal(now(g).outcome, 'pass', 'X で飛ばせる');
  const c = now(g).calls;
  g.until(() => now(g).phase === 'draw', 200);
  g.tap(sk.x, sk.y); g.step(1);
  assert.equal(now(g).phase, 'draw', '抽選中にボタンを押しても何も起きない');
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
  if (set != null) { const b = g.probe.setButton(set); g.tap(b.x, b.y); g.step(1); }
  start(g);
  return playOut(g);
}
function playOut(g) {
  for (let k = 0; k < 1500 && now(g).state === 'play'; k++) {
    const n = now(g);
    if (n.phase === 'call') {
      const at = cellOf(g);
      if (at >= 0 && !n.open[at]) tapCell(g, at); else { const b = g.probe.skip(); g.tap(b.x, b.y); }
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
  /* 結果では左右キーでカードは変わらない */
  g.press('ArrowRight'); assert.equal(now(g).set, '魚');
  /* もう一度でカード選びへ。前と同じカード（魚）で、新しく配られ、真ん中は閉じている */
  const oldCard = now(g).card;
  back(g);
  assert.equal(now(g).set, '魚');
  assert.ok(!now(g).open[12], '真ん中は閉じている');
  assert.ok(now(g).open.every(o => !o), 'どこも開いていない');
  assert.notDeepEqual(now(g).card, oldCard, '配り直す');
  /* 選び直して始める */
  const sb = g.probe.setButton(I('鳥')); g.tap(sb.x, sb.y); g.step(1);
  assert.equal(now(g).set, '鳥');
  start(g);
  assert.equal(now(g).calls, 1);
  assert.equal(now(g).lives, 3);
  const bird = g.probe.sets()[I('鳥')].list.map(f => f.kanji);
  assert.ok(now(g).card.filter(Boolean).every(k => bird.includes(k)), '鳥のカードで始まる');
  /* 結果ではスペースでももう一度（カード選びへ） */
  const r2 = playOut(g);
  assert.equal(r2.state, 'result');
  g.press(' '); g.step(1);
  assert.equal(now(g).state, 'intro');
  assert.equal(now(g).set, '鳥');
}

/* 7. 回数のばらつき（全部取れた場合） */
ORDER.slice(0, 5).forEach(mark => {
  const scores = [];
  for (let k = 0; k < 6; k++) scores.push(perfect(open(), I(mark)).score);
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
  const b = g.probe.skip(); g.tap(b.x, b.y); g.step(1);
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
  const bb = g.probe.skip(); g.tap(bb.x, bb.y); g.step(1);
  assert.equal(now(g).lives, 0, 'カードにある字を飛ばすと1つ減る');
  assert.equal(now(g).phase, 'over');
  g.until(() => now(g).state === 'result', 400);
  assert.ok(now(g).failed);
  back(g); start(g);
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

/* 11. 残すのはクリアしたかだけ（回数は残さない）。ライフがなくなった回はクリアにしない */
{
  const g = open();
  /* 1回目: わざと間違えて終わる → 記録なし */
  start(g);
  for (let k = 0; k < 300 && now(g).state === 'play'; k++) {
    const n = now(g);
    if (n.phase === 'call') tapCell(g, n.card.findIndex((q, i) => q && q !== n.call.kanji && !n.open[i]));
    g.step(10);
  }
  g.until(() => now(g).state === 'result', 400);
  assert.ok(now(g).failed);
  assert.deepEqual(now(g).cleared, {}, 'ライフがなくなった回はクリアにしない');
  assert.equal(g.probe.shareText(), 'ビンゴならず #難読ビンゴ');
  ['魚', '難', '木', '金', '虫', '鳥'].forEach((m, k) => {   /* 並びと違う順でも、6つ揃えば 𰻞 が出る */
    back(g);
    const b = g.probe.setButton(I(m)); g.tap(b.x, b.y); g.step(1);
    start(g);
    assert.equal(now(g).set, m);
    const res = playOut(g);
    assert.ok(!res.failed);
    assert.equal(res.cleared[m], true, m + ' をクリア');
    assert.ok(Object.values(res.cleared).every(v => v === true), '回数は残さない');
    assert.equal(g.probe.setCount(), k < 5 ? 6 : 7, k < 5 ? 'まだ 𰻞 は出ない' : '6つ揃うと 𰻞 が出る');
    assert.equal(g.probe.shareText(), '「' + m + '」のシートをクリアしました #難読ビンゴ', 'シェアの文');
  });
}

/* 12. 確かめる用: 手元だけ、遊んでいる間の F8 で出ている字を開ける（無ければスキップ）。カード選びの F8 で 𰻞 を出す／戻す。公開の場所では効かない */
{
  const at = host => load(file, { quiet: true, inject: 'window.location.hostname = ' + JSON.stringify(host) + ';' });
  const g = at('localhost'); g.step(2);
  g.press('F8'); g.step(1);
  assert.equal(now(g).state, 'intro', 'カード選びの F8 では始まらない');
  assert.equal(g.probe.setCount(), 7, 'F8 で 𰻞 が出る');
  assert.equal(now(g).set, '𰻞', '𰻞 を選んでいる');
  assert.deepEqual(now(g).cleared, {}, '記録には書かない');
  const a0 = g.probe.setButton(0), a1 = g.probe.setButton(1), a6 = g.probe.setButton(6);
  assert.ok(a1.x - a0.x >= 63, '7つ並べても丸同士が離れている');
  assert.ok(a6.x + 30 <= now(g).W && a0.x - 30 >= 0, '7つ並べても画面に収まる');
  start(g);
  const bl = g.probe.sets()[I('𰻞')].list.map(f => f.kanji);
  assert.ok(bl.includes(now(g).call.kanji), '𰻞 で遊べる');
  assert.ok(now(g).card.filter(Boolean).every(k => bl.includes(k)), '𰻞 のカード');
  /* 制作中の固定リンク（/preview/）では最初から 𰻞 が出ている（スマホで確かめるため）。公開の場所では出ない */
  const pv = load(file, { quiet: true, inject: 'window.location.hostname = "www.zounoashi.com"; window.location.pathname = "/preview/";' }); pv.step(2);
  assert.equal(pv.probe.setCount(), 7, '固定リンクでは最初から 𰻞 が出る');
  assert.deepEqual(now(pv).cleared, {}, '記録には書かない');
  const pb = load(file, { quiet: true, inject: 'window.location.hostname = "www.zounoashi.com"; window.location.pathname = "/games/nandoku-bingo/";' }); pb.step(2);
  assert.equal(pb.probe.setCount(), 6, '公開の場所では出ない');
  const g2 = at('localhost'); g2.step(2);
  g2.press('F8'); g2.step(1); g2.press('F8'); g2.step(1);
  assert.equal(g2.probe.setCount(), 6, 'もう一度で戻る');
  assert.equal(now(g2).set, '魚');
  /* 遊んでいる間の F8: 出ている字があれば開け、無ければスキップ。押し続ければビンゴまで行く */
  const h = at('localhost'); h.step(2); start(h);
  for (let k = 0; k < 2000 && now(h).state === 'play'; k++) {
    if (now(h).phase === 'call') {
      const n = now(h), c = n.card.indexOf(n.call.kanji), was = c >= 0 && !n.open[c];
      h.press('F8'); h.step(1);
      if (now(h).phase !== 'bingo') assert.equal(now(h).outcome, was ? 'ok' : 'pass', was ? 'F8 で開く' : 'F8 でスキップ');   /* 開けてビンゴになったときは答えの判定を通らない */
      if (was) assert.ok(now(h).open[c]);
    }
    h.step(10);
  }
  h.until(() => now(h).state === 'result', 400);
  assert.ok(!now(h).failed && now(h).bingo, 'F8 だけでビンゴまで');
  assert.equal(now(h).lives, 3, 'ライフは減らない');
  const pub = at('www.zounoashi.com'); pub.step(2);
  start(pub);
  const c0 = now(pub).calls;
  pub.press('F8'); pub.step(1);
  assert.equal(now(pub).outcome, null, '公開の場所では遊んでいる間も効かない');
  assert.equal(now(pub).calls, c0);
}

/* 8. 画面の形を変えても、マス同士・箱が押せる大きさ */
[[375, 667], [320, 480], [390, 844], [430, 932], [768, 1024]].forEach(v => {
  const g = open(v);
  const a = g.probe.cell(0), b = g.probe.cell(1), d = g.probe.cell(5);
  assert.ok(b.x - a.x >= 63 && d.y - a.y >= 63, v + ' マスの間隔 ' + (b.x - a.x) + ',' + (d.y - a.y));
  assert.ok(d.y + (d.y - a.y) * 4 < now(g).H, v + ' カードが画面に収まる');
  /* 結果のボタンはシートのすぐ下。マスから離れていて、画面に収まる */
  const last = g.probe.cell(22), rb = g.probe.result().retry, sb = g.probe.result().share;
  assert.ok(rb.y - last.y >= 63 && rb.y + 27 <= now(g).H, v + ' 結果のボタンの位置 ' + (rb.y - last.y) + ' / ' + (now(g).H - rb.y));
  assert.equal(rb.y, sb.y);
});

console.log('難読ビンゴ: ok');
