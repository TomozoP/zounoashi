// 2²択クイズ：全問正解・各段での間違い・キー操作・もどる・押す間隔・問題の中身を確かめる。
const assert = require('assert'); const load = require('../harness');
const FILE = 'games/_baibai-quiz/index.html';
const inject = 'window.__dbg={answer:function(){return Q.answer;},per:function(){return Q.per;},items:function(){return Q.items;},build:build,' +
  'data:{ANIMALS:ANIMALS,PREFS:PREFS,ELEMENTS:ELEMENTS,ELEMENT_Q:ELEMENT_Q,CODES:CODES,CODE_Q:CODE_Q,WORDS:WORDS,WORD_Q:WORD_Q,EVENTS:EVENTS}};';
const STAGES = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const center = c => [c.x + c.w / 2, c.y + c.h / 2];

// 問題の中身
{
  const g = load(FILE, { inject }); const d = g.dbg.data;
  const uniq = a => new Set(a).size === a.length;
  assert(d.ANIMALS.length >= 16 && uniq(d.ANIMALS.map(a => a[0])) && uniq(d.ANIMALS.map(a => a[1])), '動物は16種類以上で重複なし');
  assert.equal(d.PREFS.length, 47); assert(d.PREFS.filter(p => p[1]).length >= 10);
  assert.equal(d.ELEMENTS.length, 86); assert(uniq(d.ELEMENTS.map(e => e[0])) && uniq(d.ELEMENTS.map(e => e[1])));
  d.ELEMENT_Q.forEach(s => assert(d.ELEMENTS.some(e => e[0] === s), s));
  assert(d.CODES.length >= 128 && uniq(d.CODES), '国コードは128以上で重複なし');
  d.CODE_Q.forEach(c => assert(d.CODES.includes(c[1]), c[1]));
  assert(d.WORDS.length >= 256 && uniq(d.WORDS), '英単語は256以上で重複なし（' + d.WORDS.length + '）');
  d.WORDS.concat(d.CODES).forEach(w => assert(/^[A-Z]{3}$/.test(w), w));
  d.WORD_Q.forEach(w => assert(d.WORDS.includes(w[1]), w[1]));
  d.EVENTS.forEach(e => assert(e[0] >= 1 && e[0] <= 2048));
  // 何度作っても、答えが中にあり、並びが揃っている
  for (let n = 0; n < 300; n++) for (const N of STAGES) {
    const q = g.dbg.build(N);
    assert.equal(q.items.length, N); assert(uniq(q.items), N + '択に重複');
    assert(q.answer >= 0 && q.answer < N); assert.equal(N % q.per, 0);
    if (N >= 512) {
      const ev = d.EVENTS.filter(e => e[1] === q.text)[0];
      assert.equal(q.items[q.answer], String(ev[0])); assert(+q.items[0] >= 1 && +q.items[N - 1] <= 2048);
    }
    if (N === 256) assert.equal(q.items[q.answer], d.WORD_Q.filter(w => '「' + w[0] + '」を英語で言うと？' === q.text)[0][1]);
    if (N === 128) assert.equal(q.items[q.answer], d.CODE_Q.filter(w => q.text.startsWith(w[0] + 'の国コード'))[0][1]);
    if (N === 32) assert.equal(q.items[q.answer], d.PREFS.filter(p => p[1] && q.text === '都道府県庁が' + p[1] + 'にあるのは？')[0][0]);
    if (N <= 16) assert.equal(q.items[q.answer], d.ANIMALS.filter(a => a[1] === q.text)[0][0]);
    if (N === 64) assert.equal(q.items[q.answer], d.ELEMENTS.filter(e => q.text === '元素記号が「' + e[0] + '」の元素は？')[0][1]);
    assert(q.text.length >= 8, '文章題になっている: ' + q.text);
  }
  console.log('OK 問題の中身：動物' + d.ANIMALS.length + '・都道府県47・元素86・国コード' + d.CODES.length + '・英単語' + d.WORDS.length + '・出来事' + d.EVENTS.length + '、10段×300回');
}

// 押しどころ同士の間隔（中心どうし63以上）
function checkSpacing(s) {
  const pts = s.cells.map(center); if (s.back) pts.push([s.back.x + s.back.w / 2, s.back.y + s.back.h / 2]);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dx = Math.abs(pts[i][0] - pts[j][0]), dy = Math.abs(pts[i][1] - pts[j][1]);
    assert(Math.max(dx, dy) >= 63 - 1e-9, '押しどころが近い ' + JSON.stringify([pts[i], pts[j]]) + ' H=' + s.H);
  }
  s.cells.forEach(c => assert(c.x >= 0 && c.x + c.w <= s.W && c.y >= 0 && c.y + c.h <= s.H, 'はみ出し'));
}
function waitPlay(g) { assert(g.until(() => g.probe.now().state === 'play' || g.probe.now().state === 'result', 300)); }
// タップで正解（または answer をずらした不正解）を選ぶ
function pickByTap(g, offset) {
  const per = g.dbg.per(), N = g.probe.now().N, target = (g.dbg.answer() + offset) % N;
  let s = g.probe.now(); checkSpacing(s);
  if (s.cells[0].kind === 'group') {
    const gc = s.cells[Math.floor(target / per)]; assert.equal(gc.a, g.dbg.items()[Math.floor(target / per) * per]);
    g.tap(...center(gc)); s = g.probe.now(); checkSpacing(s); assert(s.back, '中に入るともどるが出る');
  }
  const c = s.cells.find(c => c.id === target); assert(c, '目当てが見えている');
  g.tap(...center(c));
}

for (const shape of [[375, 667], [390, 844], [768, 1024], [500, 1600], [1280, 720]]) {
  const g = load(FILE, { inject, w: shape[0], h: shape[1] });
  g.step(120); assert.equal(g.probe.now().state, 'intro'); g.press(' ');
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 4);
  // 全問正解
  for (const N of STAGES) {
    assert.equal(g.probe.now().N, N);
    pickByTap(g, 0); assert.equal(g.probe.now().judge, 'ok');
    g.tap(10, 10); g.press(' '); // 判定中の入力は効かない
    waitPlay(g);
  }
  let s = g.probe.now(); assert.equal(s.state, 'result'); assert(s.cleared); assert.equal(s.score, 2048);
  g.tap(175, s.H * 0.62 + 27); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 4);
  // 各段で間違える
  for (let k = 0; k < STAGES.length; k++) {
    g.probe.reset();
    for (let i = 0; i < k; i++) { pickByTap(g, 0); waitPlay(g); }
    const N = STAGES[k], ans = g.dbg.answer(), per = g.dbg.per();
    const off = per > 1 && N / per > 1 ? per + 1 : 1; // 多い段は別の区画を選んでおく
    pickByTap(g, off); assert.equal(g.probe.now().judge, 'ng');
    g.step(60); s = g.probe.now();
    assert.equal(s.state, 'judge'); assert(s.cells.some(c => c.id === ans), '正解の区画が開く');
    waitPlay(g); s = g.probe.now();
    assert.equal(s.state, 'result'); assert(!s.cleared); assert.equal(s.score, N);
  }
  g.esc(); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().score, 0);
}
console.log('OK 5画面：開始待ち・10段すべて正解で2048・判定中の入力無視・10段それぞれの間違い・正解の区画を見せる・押す間隔63以上');

// キーだけで遊ぶ（矢印とスペース）、もどる
{
  const g = load(FILE, { inject }); g.press(' ');
  for (const N of STAGES) {
    const per = g.dbg.per(), ans = g.dbg.answer();
    let s = g.probe.now();
    const go = (idx, cols) => {
      s = g.probe.now(); if (s.cur < 0) g.press('ArrowDown');
      const cur = g.probe.now().cur;
      for (let i = 0; i < Math.floor(cur / cols); i++) g.press('ArrowUp');
      for (let i = 0; i < cur % cols; i++) g.press('ArrowLeft');
      assert.equal(g.probe.now().cur, 0);
      for (let i = 0; i < Math.floor(idx / cols); i++) g.press('ArrowDown');
      for (let i = 0; i < idx % cols; i++) g.press('ArrowRight');
      assert.equal(g.probe.now().cur, idx); g.press(' ');
    };
    const colsOf = n => ({ 1: 1, 2: 1, 4: 2, 8: 2, 16: 2, 32: 4, 64: 8 })[n];
    if (s.cells[0].kind === 'group') {
      const gi = Math.floor(ans / per);
      go((gi + 1) % s.cells.length, colsOf(s.cells.length)); // 違う区画に入って
      assert.equal(g.probe.now().level, 1);
      g.press('ArrowUp'); for (let i = 0; i < 9; i++) g.press('ArrowUp');
      assert.equal(g.probe.now().cur, -1); g.press(' '); // もどる
      assert.equal(g.probe.now().level, 0); assert.equal(g.probe.now().cur, (gi + 1) % s.cells.length);
      go(gi, colsOf(s.cells.length));
    }
    go(ans % per, colsOf(per));
    assert.equal(g.probe.now().judge, 'ok'); waitPlay(g);
  }
  assert(g.probe.now().cleared);
  // タップでももどれる
  g.esc(); for (let i = 0; i < 4; i++) { pickByTap(g, 0); waitPlay(g); }
  let s = g.probe.now(); assert.equal(s.N, 64); g.tap(...center(s.cells[1])); s = g.probe.now();
  assert.equal(s.group, 1); g.tap(s.back.x + s.back.w / 2, s.back.y + s.back.h / 2);
  assert.equal(g.probe.now().level, 0); assert.equal(g.probe.now().state, 'play');
}
console.log('OK キー操作だけで2048・もどる（キーとタップ）');
