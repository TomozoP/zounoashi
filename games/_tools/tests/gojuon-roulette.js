/* 50音ルーレット: 置く・戻す・回す・払い戻し（かな・行・赤黒）・赤黒の交互・10回で終わり・押しどころの距離を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_gojuon-roulette/index.html';

function open(shape) {
  const g = load(file, { quiet: true });
  if (shape) g.view(...shape);
  g.step(2);
  assert.equal(g.probe.now().state, 'intro', '開いたときはSTART待ち');
  g.press(' ');
  g.step(1);
  assert.equal(g.probe.now().state, 'play');
  return g;
}
const at = (g, p) => g.tap(p.x, p.y);
/* 賭け先の当たり判定と倍率を、ゲームとは別に書いておく */
const ROWS = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "やゆよ", "らりるれろ", "わをん"];
const ORDER = ROWS.join("");
const rowOf = ch => ROWS.findIndex(r => r.includes(ch));
const red = k => ORDER[k] !== "ん" && k % 2 === 0, black = k => ORDER[k] !== "ん" && k % 2 === 1;
function payout(bets, k) {
  let sum = 0;
  bets.forEach((n, i) => {
    if (!n) return;
    if (i < 46) { if (i === k) sum += n * 46; }
    else if (i < 56) { const r = i - 46; if (rowOf(ORDER[k]) === r) sum += n * Math.floor(46 / ROWS[r].length); }
    else if (i === 56) { if (red(k)) sum += n * 2; }
    else if (black(k)) sum += n * 2;
  });
  return sum;
}
/* 回して、次に置けるようになる（か結果になる）まで進める。何コマかかったかを返す */
function spinOut(g) {
  let n = 0;
  while (g.probe.now().phase === 'bet' && g.probe.now().state === 'play') { at(g, g.probe.wheel()); g.step(1); if (++n > 3) break; }
  assert.notEqual(g.probe.now().phase, 'bet', '盤を押すと回る');
  let frames = 0, seen = false;
  while (g.probe.now().state === 'play' && g.probe.now().phase !== 'bet' && frames < 1200) {
    const now = g.probe.now();
    if (now.phase === 'back' && !seen) {
      seen = true;
      assert.equal(g.probe.ballOver(), now.landed, '止まった玉の下のかなと結果が同じ');
    }
    g.step(1); frames++;
  }
  assert.ok(frames < 1200, '回り終わる');
  assert.ok(seen, '盤の戻る場面を通る');
  return frames;
}

/* 1. 置く・戻す・空では回らない */
{
  const g = open();
  const K = g.probe.kana();
  assert.equal(K.length, 46);
  assert.equal(new Set(K).size, 46, '46文字すべて別');
  assert.equal(K.join(""), ORDER, "50音の順");
  const wo = g.probe.wheelOrder();
  assert.equal(new Set(wo).size, 46, "盤に全部ある");
  assert.equal(ORDER[wo[0]], "ん");
  for (let p = 1; p < 46; p++) assert.equal(red(wo[p]), p % 2 === 1, "盤の赤黒が交互");
  const sp = g.probe.spots();
  assert.equal(sp.count, 58);
  at(g, g.probe.wheel()); g.step(30);
  assert.equal(g.probe.now().phase, 'bet', '何も置かずに盤を押しても回らない');
  at(g, g.probe.cell(0)); at(g, g.probe.cell(0)); at(g, g.probe.cell(45));
  let now = g.probe.now();
  assert.equal(now.chips, 7);
  assert.equal(now.bets[0], 2);
  assert.equal(now.bets[45], 1);
  at(g, g.probe.pile()); g.step(30);
  now = g.probe.now();
  assert.equal(now.chips, 10, '手元を押すと全部戻る');
  assert.equal(now.bet, 0);
  for (let i = 0; i < 12; i++) at(g, g.probe.cell(i % 46));
  assert.equal(g.probe.now().chips, 0, '手持ちより多くは置けない');
  assert.equal(g.probe.now().bet, 10);
}

/* 2. 払い戻しの計算と10回での終了（何度も遊んで当たりも外れも通る） */
{
  let wins = 0, losses = 0, maxFrames = 0, minFrames = 1e9;
  for (let game = 0; game < 12; game++) {
    const g = open();
    let spins = 0;
    while (g.probe.now().state === 'play') {
      const before = g.probe.now();
      const n = Math.min(before.chips, 10);
      const picks = [];
      while (picks.length < n) picks.push(Math.floor(Math.random() * 58));   /* かな・行・赤黒をまぜて、重ねても置く */
      picks.forEach(k => at(g, g.probe.cell(k)));
      const placed = g.probe.now().bets.slice();
      const rest = g.probe.now().chips;
      const f = spinOut(g);
      maxFrames = Math.max(maxFrames, f); minFrames = Math.min(minFrames, f);
      spins++;
      const after = g.probe.now();
      const expect = rest + payout(placed, after.last);
      assert.equal(after.chips, expect, '当たったマスの枚数×46が戻り、ほかは消える');
      assert.equal(after.bet, 0, '回したあと表は空');
      if (payout(placed, after.last)) wins++; else losses++;
      if (after.chips === 0) { assert.equal(after.state, 'result', 'チップが尽きたら終わり'); break; }
      assert.ok(spins <= 10);
    }
    const end = g.probe.now();
    assert.equal(end.state, 'result');
    assert.ok(spins === 10 || end.chips === 0, '10回まわすか尽きたら終わり');
    assert.equal(end.score, end.chips, '結果は手持ちの枚数');
  }
  assert.ok(wins > 0 && losses > 0, '当たりと外れの両方を通った');
  console.log('1回の長さ ' + (minFrames / 60).toFixed(1) + '〜' + (maxFrames / 60).toFixed(1) + '秒 / 当たり' + wins + ' 外れ' + losses);
  assert.ok(maxFrames / 60 < 9, '1回が長すぎない');
}

/* 2b. 行・赤・黒だけに置いたときの払い戻し */
{
  const g = open();
  const sp = g.probe.spots();
  for (let s = 0; s < 10 && g.probe.now().state === "play"; s++) {
    at(g, g.probe.cell(sp.row0 + (s % 10)));
    at(g, g.probe.cell(s % 2 ? sp.black : sp.red));
    const placed = g.probe.now().bets.slice(), rest = g.probe.now().chips;
    spinOut(g);
    const k = g.probe.now().last;
    assert.equal(g.probe.now().chips, rest + payout(placed, k));
  }
}

/* 3. キーだけで遊べる */
{
  const g = open();
  g.press('ArrowRight'); g.press(' ');
  g.press('ArrowDown'); g.press(' ');
  let now = g.probe.now();
  assert.equal(now.bets[1], 1, '→で い');
  assert.equal(now.bets[6], 1, '↓で き');
  g.press('ArrowUp'); g.press('ArrowUp');
  assert.equal(g.probe.now().sel, -1, 'いちばん上からさらに上は盤');
  g.press("ArrowDown");
  for (let i = 0; i < 6; i++) g.press("ArrowRight");
  assert.equal(g.probe.now().sel, 46, "かなの右端のさらに右は行（右へ押し続けても止まる）");
  g.press("ArrowUp");
  assert.equal(g.probe.now().sel, 57, "表の右上からさらに上は黒");
  g.press("ArrowLeft");
  assert.equal(g.probe.now().sel, 56, "黒の左は赤");
  g.press("ArrowLeft");
  assert.equal(g.probe.now().sel, -1, "赤の左は盤");
  g.press(" "); g.step(2);
  assert.notEqual(g.probe.now().phase, 'bet', 'スペースで回る');
  g.until(() => g.probe.now().phase === 'bet', 1200);
  g.esc(); g.step(1);
  now = g.probe.now();
  assert.equal(now.chips, 10, 'Escで最初から');
  assert.equal(now.spins, 0);
}

/* 4. もう一度 */
{
  const g = open();
  for (let s = 0; s < 10 && g.probe.now().state === 'play'; s++) { at(g, g.probe.cell(s)); spinOut(g); }
  assert.equal(g.probe.now().state, 'result');
  const H = g.probe.now().H;
  g.tap(270 - 107, H * 0.62 + 27); g.step(1);
  assert.equal(g.probe.now().state, 'play', 'もう一度で最初から');
  assert.equal(g.probe.now().chips, 10);
}

/* 5. 押しどころの距離（画面の形ごと） */
load.SHAPES.forEach(shape => {
  const g = open(shape);
  const H = g.probe.now().H;
  const pts = [g.probe.wheel(), g.probe.pile()];
  for (let k = 0; k < 58; k++) pts.push(g.probe.cell(k));
  let min = 1e9;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  }
  assert.ok(min >= 63, shape.join('x') + ' で押しどころが近い: ' + min.toFixed(1));
  pts.forEach(p => assert.ok(p.x > 0 && p.x < 540 && p.y > 0 && p.y < H, '画面の中'));
  const w = g.probe.wheel();
  assert.ok(w.y + w.r < g.probe.cell(0).y - g.probe.cell(0).h / 2 + 8, '盤と表が重ならない');
});

console.log('ok gojuon-roulette');
