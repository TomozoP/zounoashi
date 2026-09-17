// 2ⁿ択クイズ：問題の中身・全問正解・各段での間違い・スクロール・キー操作・押す間隔を確かめる。
const assert = require('assert'); const load = require('../harness');
const FILE = 'games/baibai-quiz/index.html';
const inject = 'window.__dbg={answer:function(){return Q.answer;},answers:function(){return Q.answers;},vel:function(){return vel;},build:build,' +
  'data:{ANIMAL_GROUPS:ANIMAL_GROUPS,ANIMAL_NAMES:ANIMAL_NAMES,COLORS:COLORS,COLOR_Q:COLOR_Q,SEASONS:SEASONS,SEASON_Q:SEASON_Q,PLANETS:PLANETS,PLANET_Q:PLANET_Q,KANJI:KANJI,KANJI_Q:KANJI_Q,PEOPLE:PEOPLE,allFake:allFakeNames,TRUE_FALSE:TRUE_FALSE,ANIMALS:ANIMALS,PREFS:PREFS,ELEMENTS:ELEMENTS,ELEMENT_Q:ELEMENT_Q,CODES:CODES,CODE_Q:CODE_Q,EVENTS:EVENTS}};';
const STAGES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
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
  d.CODES.forEach(w => assert(/^[A-Z]{3}$/.test(w), w));
  assert(d.ANIMAL_NAMES.length >= 256 && uniq(d.ANIMAL_NAMES), '動物は256種類以上（' + d.ANIMAL_NAMES.length + '）');
  d.ANIMAL_NAMES.forEach(a => assert(/^[ァ-ヶー]{1,7}$/.test(a), '動物名はカタカナ7文字まで: ' + a));
  d.ANIMALS.forEach(a => assert(d.ANIMAL_NAMES.includes(a[0])));
  assert.equal(d.ANIMAL_GROUPS.length, 6, '分類は6つ');
  d.ANIMAL_GROUPS.forEach(g => assert.deepEqual(g, g.slice().sort(), '分類の中は五十音順'));
  // 答えの仲間（まぎらわしい動物）が候補に入っていない
  ['ヒグマ','ツキノワグマ','ホッキョクグマ','コウテイペンギン','ウミガメ','ヒキガエル','ニホンザル','ヤギ','シャチ','ラマ','ワラビー','レッサーパンダ','ヤマアラシ','ハリセンボン','トキ','イタチ','イノシシ','ガ','ミツバチ','ヤドカリ','コビトカバ']
    .forEach(a => assert(!d.ANIMAL_NAMES.includes(a), 'まぎらわしい動物: ' + a));
  assert.equal(new Set(d.COLORS).size, 16); d.COLOR_Q.forEach(q => assert(d.COLORS.includes(q[1]), q[0]));
  assert(d.TRUE_FALSE.length >= 20 && uniq(d.TRUE_FALSE.map(t => t[0])), '○×問題は20以上');
  const tf = d.TRUE_FALSE.filter(t => t[1]).length; assert(tf >= 10 && d.TRUE_FALSE.length - tf >= 10, '○と×の両方が十分ある');
  d.EVENTS.forEach(e => assert(e[0] >= 1 && e[0] <= 2048));
  d.SEASON_Q.forEach(q => assert(d.SEASONS.includes(q[1]), q[0]));
  new Set(d.SEASONS).forEach(x => assert(d.SEASON_Q.some(q => q[1] === x), x + 'が答えの問題がある'));
  d.PLANET_Q.forEach(q => assert(d.PLANETS.includes(q[1]), q[0]));
  assert(d.KANJI.length >= 2048 && uniq(d.KANJI) && d.KANJI.every(k => k.length === 1), '漢字は2048字以上');
  assert.deepEqual(d.KANJI, d.KANJI.slice().sort(), '漢字は文字コード順');
  d.KANJI_Q.forEach(q => [...q[1]].forEach(k => assert(d.KANJI.includes(k), q[0] + ': ' + k)));
  assert(uniq(d.KANJI_Q.map(q => q[0])), '漢字のよみは重ならない');
  assert(uniq(d.PEOPLE.map(p => p[0])) && uniq(d.PEOPLE.map(p => p[2])));
  d.PEOPLE.forEach(p => assert(/^[ぁ-ん]+$/.test(p[1]), p[0] + 'のよみ'));
  const fake = d.allFake(); assert(fake.length >= 2048, '架空の名前が足りる');
  assert(uniq(fake.map(n => n[0])), '架空の名前は重ならない');
  fake.forEach(n => assert(!d.PEOPLE.some(p => p[0] === n[0]), '実在の答えと同じ名前: ' + n[0]));
  // 何度作っても、答えが中にあり、並びが揃っている
  const stageOf = {}; // 同じ問題文が2つの段に出ない
  for (let n = 0; n < 300; n++) for (const N of STAGES) {
    const q = g.dbg.build(N);
    assert.equal(stageOf[q.text] || N, N, '段をまたいだ問題: ' + q.text); stageOf[q.text] = N;
    assert.equal(q.items.length, N); assert(uniq(q.items), N + '択に重複');
    assert(q.answer >= 0 && q.answer < N);
    if (N === 1024) {
      const ev = d.EVENTS.filter(e => e[1] === q.text)[0];
      assert.equal(q.items[q.answer], String(ev[0])); assert(+q.items[0] >= 1 && +q.items[N - 1] <= 2048);
    }
    if (N === 256) {
      assert.equal(q.items[q.answer], d.ANIMALS.filter(a => a[1] === q.text)[0][0]);
      const at = x => d.ANIMAL_NAMES.indexOf(x); assert(q.items.every((x, i) => i === 0 || at(q.items[i - 1]) < at(x)), '分類の順に並ぶ');
    }
    if (N === 16) assert.equal(q.items[q.answer], d.COLOR_Q.filter(t => t[0] === q.text)[0][1]);
    if (N === 128) assert.equal(q.items[q.answer], d.CODE_Q.filter(w => q.text.startsWith(w[0] + 'の国コード'))[0][1]);
    if (N === 64) assert.equal(q.items[q.answer], d.ELEMENTS.filter(e => q.text === '元素記号が「' + e[0] + '」の元素は？')[0][1]);
    if (N === 32) assert.equal(q.items[q.answer], d.PREFS.filter(p => p[1] && q.text === '都道府県庁が' + p[1] + 'にあるのは？')[0][0]);
    if (N === 4) assert.equal(q.items[q.answer], d.SEASON_Q.filter(t => t[0] === q.text)[0][1]);
    if (N === 8) assert.equal(q.items[q.answer], d.PLANET_Q.filter(t => t[0] === q.text)[0][1]);
    if (N === 2048) {
      const t = d.KANJI_Q.filter(t => '「' + t[0] + '」を漢字1文字で書くと？' === q.text)[0];
      assert.equal(q.items[q.answer], t[1][0], '代表の答え'); assert.deepEqual(q.items, q.items.slice().sort());
      assert.deepEqual(q.answers.map(i => q.items[i]).sort(), [...t[1]].filter(k => q.items.includes(k)).sort(), '同じ読みの漢字はどれも正解');
    }
    if (N === 512) { const p = d.PEOPLE.filter(t => t[2] === q.text)[0]; assert.equal(q.items[q.answer], p[0]); d.PEOPLE.forEach(t => assert(q.items.includes(t[0]))); }
    if (N !== 2048) assert.equal(q.answers, undefined, '答えが1つの段');
    if (N === 2) { assert.deepEqual(q.items, ['○', '×']); assert.equal(q.answer, d.TRUE_FALSE.filter(t => t[0] === q.text)[0][1] ? 0 : 1); }
    assert(q.text.length >= 6, '文章題になっている: ' + q.text);
  }
  console.log('OK 問題の中身：○×' + d.TRUE_FALSE.length + '・季節' + d.SEASON_Q.length + '・惑星' + d.PLANET_Q.length + '・色' + d.COLOR_Q.length + '・都道府県47・元素86・国コード' + d.CODES.length + '・動物' + d.ANIMALS.length + '問/' + d.ANIMAL_NAMES.length + '種・漢字' + d.KANJI.length + '字/' + d.KANJI_Q.length + '問・出来事' + d.EVENTS.length + '・人物' + d.PEOPLE.length + '（架空' + fake.length + '）、11段×300回・段をまたぐ問題なし');
}

// 見えている押しどころ同士の間隔（中心どうし63以上）と、並びが全部そろっているか
function checkLayout(s) {
  const pts = s.cells.map(center);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const dx = Math.abs(pts[i][0] - pts[j][0]), dy = Math.abs(pts[i][1] - pts[j][1]);
    assert(Math.max(dx, dy) >= 63 - 1e-9, '押しどころが近い ' + JSON.stringify([pts[i], pts[j]]) + ' H=' + s.H);
  }
  s.cells.forEach(c => assert(c.x >= 0 && c.x + c.w <= s.W - 10, 'よこにはみ出し'));
  const room = s.listBottom - s.listTop, rows = Math.ceil(s.N / s.cols);
  if (s.N <= 32) assert.equal(s.maxScroll, 0, s.N + '択: 32択まではスクロールなし');
  assert.equal(s.maxScroll === 0, rows * 64 <= room, s.N + '択: 64で収まるときだけスクロールなし');
  if (s.maxScroll === 0) {
    assert(Math.abs(s.rowH - Math.min(140, room / rows)) < 1e-6, '場所いっぱいに広がる（1段140まで）');
    const last = s.cells[s.cells.length - 1]; assert(Math.abs(last.y + last.h - s.listBottom) < 1e-6, '下に寄せる');
  } else assert.equal(s.rowH, 64);
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
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 2);
  // 全問正解
  for (const N of STAGES) {
    assert.equal(g.probe.now().N, N); assert.equal(g.probe.now().scroll, 0, '新しい段は先頭から');
    pick(g, 0); assert.equal(g.probe.now().judge, 'ok');
    g.tap(10, g.probe.now().listTop + 30); g.press(' '); // 判定中の入力は効かない
    assert.equal(g.probe.now().judge, 'ok');
    waitPlay(g);
  }
  let s = g.probe.now(); assert.equal(s.state, 'result'); assert(s.cleared); assert.equal(s.score, 2048);
  g.tap(175, s.H * 0.62 + 27); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().N, 2);
  // 各段で間違える。正解が遠くても、そこまで流れて見える
  for (let k = 0; k < STAGES.length; k++) {
    g.probe.reset();
    for (let i = 0; i < k; i++) { pick(g, 0); waitPlay(g); }
    const N = STAGES[k], ans = g.dbg.answer();
    let off = N === 2 ? 1 : Math.floor(N / 2) + 1;
    while (g.dbg.answers().includes((ans + off) % N)) off++;
    pick(g, off); assert.equal(g.probe.now().judge, 'ng');
    g.step(80); s = g.probe.now();
    assert.equal(s.state, 'judge');
    const c = s.cells.find(c => c.id === ans);
    assert(c && c.y >= s.listTop && c.y + c.h <= s.listBottom, N + '択: 正解が見える位置まで流れる');
    waitPlay(g); s = g.probe.now();
    assert.equal(s.state, 'result'); assert(!s.cleared); assert.equal(s.score, N);
  }
  g.esc(); assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().score, 0);
}
console.log('OK 5画面：開始待ち・なぞって探して11段すべて正解で2048・判定中の入力無視・11段それぞれの間違いで正解まで流れる・押す間隔63以上');

// スクロールそのもの
{
  const g = load(FILE, { inject, w: 390, h: 844 }); g.press(' ');
  for (let i = 0; i < 10; i++) { pick(g, 0); waitPlay(g); }
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
  assert.equal(g.probe.now().cur, 1, '2択では右にしか動かない');
}
console.log('OK キー操作だけで2048・目印に合わせてスクロール');

// 手元用の正解デバッグ（localhost のときだけ）。C で正解、V で印
{
  const g = load(FILE, { inject });
  g.press('c'); assert.equal(g.probe.now().state, 'intro', '開始前は効かない');
  g.press(' ');
  for (const N of STAGES) {
    assert.equal(g.probe.now().N, N);
    g.press('C'); assert.equal(g.probe.now().judge, 'ok', N + '択: C で正解');
    g.press('c'); assert.equal(g.probe.now().judge, 'ok', '判定中は効かない');
    const seen = () => { const s = g.probe.now(), c = s.cells.find(c => c.id === g.dbg.answer()); return c && c.y >= s.listTop && c.y + c.h <= s.listBottom; };
    assert(g.until(() => seen() || g.probe.now().judge !== 'ok', 45) && seen(), N + '択: 正解の位置まで流れる');
    waitPlay(g);
  }
  assert(g.probe.now().cleared);
  g.esc(); g.press('v'); g.drawn.length = 0; g.step(1); assert(!g.drawn.includes('arc'), '正解の印は出さない');
}
console.log('OK 正解デバッグ：C で11段すべて正解・判定中と開始前は効かない・正解の印は出さない');

// 2048択の漢字は、同じ読みの別の漢字を選んでも正解
{
  let tried = 0;
  for (let n = 0; n < 200 && tried < 5; n++) {
    const g = load(FILE, { inject }); g.press(' ');
    for (let i = 0; i < 10; i++) { g.press('c'); waitPlay(g); }
    const ans = g.dbg.answer(), alts = g.dbg.answers().filter(i => i !== ans);
    if (!alts.length) continue;
    const c = scrollTo(g, alts[0]); g.tap(...center(c));
    assert.equal(g.probe.now().judge, 'ok', '別の読みの漢字も正解: ' + c.a);
    waitPlay(g); assert(g.probe.now().cleared);
    tried++;
  }
  assert(tried >= 5, '別の正解がある問題を試せた');
}
console.log('OK 2048択の漢字：同じ読みの別の漢字でも正解');

// 全問正解の秒数とシェア文
{
  const share = 'share:function(){var t,o=window.zResultActions.x;window.zResultActions.x=function(a){t=a.text;};doShare();window.zResultActions.x=o;return t;},';
  const g = load(FILE, { inject: inject.replace('window.__dbg={', 'window.__dbg={' + share) });
  g.step(300); g.press(' ');
  assert.equal(g.probe.now().clearTime, 0);
  for (const N of STAGES) {
    g.step(60);                                  // 1問に1秒ずつ考える
    g.press('c');
    if (N < 2048) assert(g.until(() => g.probe.now().N === N * 2, 300));
  }
  const t = g.probe.now().clearTime;
  assert(t > 11 && t < 11 + 10 * 0.8 + 1, '11問×1秒＋判定の表示10回ぶんくらい: ' + t);
  g.step(120); assert(g.probe.now().cleared);
  assert.equal(g.probe.now().clearTime, t, '最後の正解のあとは増えない');
  const text = g.dbg.share();
  assert(/^\d+\.\d秒で2048択クリア #2n択クイズ$/.test(text), text);
  g.drawn.length = 0; g.step(1); assert(g.drawn.filter(x => x === 'fillText').length >= 2, '数字と秒数を描く');
  g.probe.reset(); assert.equal(g.probe.now().clearTime, 0, 'やり直すと0');
  // 途中で終わったときのシェア文
  g.probe.reset(); g.press('c'); waitPlay(g);
  let s = g.probe.now(); const wrong = s.cells.find(c => !g.dbg.answers().includes(c.id));
  g.tap(...center(wrong)); waitPlay(g);
  assert.equal(g.dbg.share(), '4択到達 #2n択クイズ');
  // 開始前は数えない
  const h = load(FILE, { inject }); h.step(600); h.press(' '); assert.equal(h.probe.now().clearTime, 0);
}
console.log('OK タイム：STARTから最後の正解まで・その後は増えない・シェア文・やり直しで0・途中終了のシェア文');
