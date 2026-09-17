// 2²択クイズ：問題の中身・全問正解・各段での間違い・スクロール・キー操作・押す間隔を確かめる。
const assert = require('assert'); const load = require('../harness');
const FILE = 'games/_baibai-quiz/index.html';
const inject = 'window.__dbg={answer:function(){return Q.answer;},vel:function(){return vel;},build:build,' +
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
    assert(q.answer >= 0 && q.answer < N);
    if (N >= 512) {
      const ev = d.EVENTS.filter(e => e[1] === q.text)[0];
      assert.equal(q.items[q.answer], String(ev[0])); assert(+q.items[0] >= 1 && +q.items[N - 1] <= 2048);
    }
    if (N === 256) assert.equal(q.items[q.answer], d.WORD_Q.filter(w => '「' + w[0] + '」を英語で言うと？' === q.text)[0][1]);
    if (N === 128) assert.equal(q.items[q.answer], d.CODE_Q.filter(w => q.text.startsWith(w[0] + 'の国コード'))[0][1]);
    if (N === 64) assert.equal(q.items[q.answer], d.ELEMENTS.filter(e => q.text === '元素記号が「' + e[0] + '」の元素は？')[0][1]);
    if (N === 32) assert.equal(q.items[q.answer], d.PREFS.filter(p => p[1] && q.text === '都道府県庁が' + p[1] + 'にあるのは？')[0][0]);
    if (N <= 16) assert.equal(q.items[q.answer], d.ANIMALS.filter(a => a[1] === q.text)[0][0]);
    assert(q.text.length >= 8, '文章題になっている: ' + q.text);
  }
  console.log('OK 問題の中身：動物' + d.ANIMALS.length + '・都道府県47・元素86・国コード' + d.CODES.length + '・英単語' + d.WORDS.length + '・出来事' + d.EVENTS.length + '、10段×300回');
}

// 見えている押しどころ同士の間隔（中心どうし63以上）と、並びが全部そろっているか
function checkLayout(s) {
  const pts = s.cells.map(center);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dx = Math.abs(pts[i][0] - pts[j][0]), dy = Math.abs(pts[i][1] - pts[j][1]);
    assert(Math.max(dx, dy) >= 63 - 1e-9, '押しどころが近い ' + JSON.stringify([pts[i], pts[j]]) + ' H=' + s.H);
  }
  s.cells.forEach(c => assert(c.x >= 0 && c.x + c.w <= s.W - 10, 'よこにはみ出し'));
  assert.equal((s.N <= 32), s.maxScroll === 0, s.N + '択: 32択まではスクロールなし');
  if (s.maxScroll > 0) assert.equal(s.maxScroll, Math.ceil(s.N / s.cols) * s.rowH - (s.listBottom - s.listTop), '最後の段まで届く');
}
const settle = g => assert(g.until(() => !g.probe.now().moving, 600), 'スクロールが止まる');
// 指でなぞって、id の段が見えるところまで持ってくる
function scrollTo(g, id) {
  for (let k = 0; k < 60; k++) {
    let s = g.probe.now();
    const c = s.cells.find(c => c.id === id);
    if (c && c.y >= s.listTop && c.y + c.h <= s.listBottom) return c;
    const want = Math.floor(id / s.cols) * s.rowH - (s.listBottom - s.listTop - s.rowH) / 2;
    if (Math.abs(want - s.scroll) > 2500) { // 遠いときははじいて流す
      const dir = Math.sign(want - s.scroll), m = (s.listTop + s.listBottom) / 2;
      g.drag([{ x: 200, y: m + dir * 100 }, { x: 200, y: m }, { x: 200, y: m - dir * 100 }], 1);
      settle(g); continue;
    }
    const lim = (s.listBottom - s.listTop) * 0.8;
    const delta = Math.max(-lim, Math.min(lim, want - s.scroll));
    const y0 = (s.listTop + s.listBottom) / 2 + delta / 2;
    g.down(200, y0);
    for (let i = 1; i <= 10; i++) { g.moveTo(200, y0 - delta * i / 10); g.step(2); }
    g.step(12); g.up(); // 止まってから離す
    settle(g);
  }
  assert.fail('届かない id=' + id);
}
function waitPlay(g) { assert(g.until(() => g.probe.now().state === 'play' || g.probe.now().state === 'result', 300)); }
function pick(g, offset) {
  const N = g.probe.now().N, target = (g.dbg.answer() + offset) % N;
  checkLayout(g.probe.now());
  const c = scrollTo(g, target); checkLayout(g.probe.now());
  g.tap(...center(c));
  return target;
}

for (const shape of [[375, 667], [390, 844], [768, 1024], [500, 1600], [1280, 720]]) {
  const g = load(FILE, { inject, w: shape[0], h: shape[1] });
  g.step(120); assert.equal(g.probe.now().state, 'intro'); g.press(' ');
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 4);
  // 全問正解
  for (const N of STAGES) {
    assert.equal(g.probe.now().N, N); assert.equal(g.probe.now().scroll, 0, '新しい段は先頭から');
    pick(g, 0); assert.equal(g.probe.now().judge, 'ok');
    g.tap(10, g.probe.now().listTop + 30); g.press(' '); // 判定中の入力は効かない
    assert.equal(g.probe.now().judge, 'ok');
    waitPlay(g);
  }
  let s = g.probe.now(); assert.equal(s.state, 'result'); assert(s.cleared); assert.equal(s.score, 2048);
  g.tap(175, s.H * 0.62 + 27); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 4);
  // 各段で間違える。正解が遠くても、そこまで流れて見える
  for (let k = 0; k < STAGES.length; k++) {
    g.probe.reset();
    for (let i = 0; i < k; i++) { pick(g, 0); waitPlay(g); }
    const N = STAGES[k], ans = g.dbg.answer();
    pick(g, Math.floor(N / 2) + 1); assert.equal(g.probe.now().judge, 'ng');
    g.step(80); s = g.probe.now();
    assert.equal(s.state, 'judge');
    const c = s.cells.find(c => c.id === ans);
    assert(c && c.y >= s.listTop && c.y + c.h <= s.listBottom, N + '択: 正解が見える位置まで流れる');
    waitPlay(g); s = g.probe.now();
    assert.equal(s.state, 'result'); assert(!s.cleared); assert.equal(s.score, N);
  }
  g.esc(); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().score, 0);
}
console.log('OK 5画面：開始待ち・なぞって探して10段すべて正解で2048・判定中の入力無視・10段それぞれの間違いで正解まで流れる・押す間隔63以上');

// スクロールそのもの
{
  const g = load(FILE, { inject, w: 390, h: 844 }); g.press(' ');
  for (let i = 0; i < 9; i++) { pick(g, 0); waitPlay(g); }
  let s = g.probe.now(); assert.equal(s.N, 2048);
  // なぞっている間は選ばない
  const mid = (s.listTop + s.listBottom) / 2;
  g.drag([{ x: 200, y: mid }, { x: 200, y: mid - 40 }, { x: 200, y: mid - 80 }], 1);
  assert.equal(g.probe.now().state, 'play', 'なぞって離しても選ばない');
  // 勢いよくはじくと、離したあとも流れて止まる
  const before = g.probe.now().scroll;
  g.drag([{ x: 200, y: mid }, { x: 200, y: mid - 60 }, { x: 200, y: mid - 120 }], 1);
  const released = g.probe.now().scroll;
  assert(g.dbg.vel() > 1000, '速さが残る');
  g.step(6); assert(g.probe.now().scroll > released + 20, '慣性で進む');
  // 流れている最中に触ると止まるだけ
  const c0 = g.probe.now().cells.find(c => c.y > mid);
  g.tap(...center(c0)); assert.equal(g.probe.now().state, 'play', '流れを止めるタップでは選ばない');
  assert.equal(g.dbg.vel(), 0);
  settle(g);
  // 端で止まる
  g.drag([{ x: 200, y: mid }, { x: 200, y: mid + 200 }], 1); g.step(200);
  for (let i = 0; i < 12; i++) { g.drag([{ x: 200, y: mid }, { x: 200, y: mid + 300 }], 1); g.step(60); }
  assert.equal(g.probe.now().scroll, 0, '上の端');
  // ホイール
  g.wrap.fire('wheel', { deltaY: 500, deltaMode: 0, preventDefault() {} }); settle(g);
  assert(g.probe.now().scroll > 100, 'ホイールで進む');
  for (let i = 0; i < 80; i++) g.wrap.fire('wheel', { deltaY: 5000, deltaMode: 0, preventDefault() {} });
  settle(g); s = g.probe.now();
  assert.equal(s.scroll, s.maxScroll, '下の端');
  assert(s.cells.some(c => c.id === 2047 && c.y + c.h <= s.listBottom), '最後の1つまで見える');
  assert(before >= 0);
}
console.log('OK スクロール：なぞりでは選ばない・慣性・止めるタップ・上下の端・ホイール・最後まで見える');

// キーだけで遊ぶ（矢印とスペース）。目印は画面の外に出ない
{
  const g = load(FILE, { inject }); g.press(' ');
  for (const N of STAGES) {
    const ans = g.dbg.answer(), cols = g.probe.now().cols;
    for (let i = 0; i < Math.floor(ans / cols); i++) g.press('ArrowDown');
    for (let i = 0; i < ans % cols; i++) g.press('ArrowRight');
    assert.equal(g.probe.now().cur, ans);
    settle(g);
    const s = g.probe.now(), c = s.cells.find(c => c.id === ans);
    assert(c && c.y >= s.listTop - 1e-6 && c.y + c.h <= s.listBottom + 1e-6, N + '択: 目印が見えている');
    g.press(' '); assert.equal(g.probe.now().judge, 'ok'); waitPlay(g);
  }
  assert(g.probe.now().cleared);
  // 端でははみ出さない
  g.esc(); g.press('ArrowUp'); g.press('ArrowLeft'); assert.equal(g.probe.now().cur, 0);
  g.press('ArrowDown'); g.press('ArrowDown'); g.press('ArrowRight'); g.press('ArrowRight');
  assert.equal(g.probe.now().cur, 3);
}
console.log('OK キー操作だけで2048・目印に合わせてスクロール');
