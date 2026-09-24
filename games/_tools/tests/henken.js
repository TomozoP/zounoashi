/* 偏県: 偏県名と偏見の一文の中身・県名の置き場所・上に偏見を1つ出し、地図の県をタップして当てる・
   ドラッグと2本指とホイールで地図を動かす・外したら選び直し・47県を埋めて終わる・キー操作を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_henken/index.html';
/* テストのときだけ、正解と中身を覗く */
const inject = 'window.__dbg={ask:function(){return ask;},prefAt:prefAt,' +
  'peek:function(c,dx,dy){var k=cursor;cursor=c;stepPref(dx,dy);var r=cursor;cursor=k;return r;},' +
  'LINES:LINES,LABEL:LABEL,inside:inside,NAMES:NAMES,SHAPES:SHAPES};';

function open(shape) {
  const g = load(file, { quiet: true, inject });
  if (shape) g.view(...shape);
  g.step(2);
  assert.equal(g.probe.now().state, 'intro', '開いたときはSTART待ち');
  g.press(' ');
  g.step(1);
  assert.equal(g.probe.now().state, 'play');
  g.step(60);
  return g;
}
const P = (id, x, y) => ({ clientX: x, clientY: y, pointerId: id, button: 0, preventDefault() {} });
/* 地図で県 i の県名の場所をタップする */
function tapPref(g, i) {
  const s = g.probe.spot(i);
  g.tap(s.x, s.y);
}
/* いまの偏見に当たったら、次の偏見が出るまで進める */
function next(g) {
  assert(g.until(() => !g.probe.now().waiting, 120), '次の偏見が出る');
}

// 偏県名と一文の中身
{
  const g = load(file, { quiet: true, inject });
  /* 「|」は2行にするときの区切り。1つだけ、端には置かない */
  g.dbg.NAMES.forEach(n => assert(/^[^|]+\|[^|]+$/.test(n), '区切りは1つ: ' + n));
  const N = g.dbg.NAMES.map(n => n.replace('|', ''));
  assert.equal(N.length, 47);
  assert.equal(g.dbg.SHAPES.length, 47);
  assert.equal(new Set(N).size, 47, '偏県名は重ならない');
  const SUFFIX = '道' + '県'.repeat(11) + '都' + '県'.repeat(12) + '府府' + '県'.repeat(20);
  N.forEach((n, i) => assert(n.length >= 3 && n.length <= 9 && n.slice(-1) === SUFFIX[i], '偏見＋都道府県: ' + n));
  /* 答えが書いてあると当てる遊びにならないので、実際の都道府県名は入れない */
  const REAL = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(' ');
  N.forEach(n => REAL.forEach(r => assert(!n.includes(r), n + ' に実在の名前 ' + r)));
  const L = g.dbg.LINES;
  assert.equal(L.length, 47); assert.equal(new Set(L).size, 47);
  L.forEach(s => assert(/そう$/.test(s), '「〜そう」で終わる: ' + s));
  L.forEach(s => assert(s.length >= 8 && s.length <= 28, '一文の長さ: ' + s));
  L.forEach(s => REAL.forEach(r => assert(!s.includes(r), s + ' に実在の名前 ' + r)));
  g.dbg.SHAPES.forEach((s, i) => assert(s.length >= 1 && s.every(r => r.length >= 4), (i + 1) + '番の形'));
  /* 県名は、その県の中に置く */
  g.dbg.LABEL.forEach((p, i) => assert(g.dbg.SHAPES[i].some(r => g.dbg.inside(r, p[0], p[1])), (i + 1) + '番の県名が県の外'));
}

// 偏見ロボが1文字ずつ読み上げる。当てて次の偏見になると、また最初から
{
  const g = load(file, { quiet: true, inject });
  g.step(2); g.press(' '); g.step(1);
  const len = g.probe.now().line.length;
  assert(g.probe.now().spoken < 3, '出た直後はまだ読み上げていない');
  g.step(30);
  const mid = g.probe.now().spoken;
  assert(mid > 0 && mid < len, '途中まで読み上げている');
  g.step(len * 4 + 30);
  assert.equal(g.probe.now().spoken, len, '最後まで読み上げる');
  tapPref(g, g.dbg.ask());
  next(g);
  assert(g.probe.now().spoken < 3, '次の偏見はまた最初から');
}

// 上に偏見が1つ出る。地図の県をタップすると答えになる。外したら同じ偏見のまま
{
  const g = open();
  const p = g.probe.now();
  assert(p.line.length > 0, '偏見が1つ出ている');
  assert.equal(p.line, g.dbg.LINES[g.dbg.ask()]);
  assert(p.card.y + p.card.h <= p.map.y, '札は地図の上');
  /* 全体表示のままで、どの県も県名の場所をタップすればその県になる */
  for (let i = 0; i < 47; i++) {
    const s = g.probe.spot(i);
    assert.equal(g.dbg.prefAt(s.x, s.y), i, (i + 1) + '番をタップで選べる');
  }
  const a = g.dbg.ask(), wrong = (a + 10) % 47;
  tapPref(g, wrong);
  assert.equal(g.probe.now().misses, 1);
  assert.equal(g.dbg.ask(), a, '外しても同じ偏見のまま');
  assert.equal(g.probe.now().done[wrong], 0, '外した県は埋まらない');
  tapPref(g, wrong);
  assert.equal(g.probe.now().misses, 1, '外した県はこの偏見ではもう数えない');
  /* 海をタップしても答えにならない */
  g.tap(530, g.probe.now().map.y + 8);
  assert.equal(g.probe.now().misses, 1);
  /* 札をタップしても答えにならない */
  g.tap(270, g.probe.now().card.y + 40);
  assert.equal(g.probe.now().misses, 1);
  tapPref(g, a);
  assert.equal(g.probe.now().done[a], 2, '外してから当てた印');
  assert(g.probe.now().waiting, '当てたら少し間をおく');
  tapPref(g, (a + 1) % 47);
  assert.equal(g.probe.now().misses, 1, '間の最中のタップは数えない');
  next(g);
  assert.notEqual(g.dbg.ask(), a, '次の偏見が出る');
  assert.equal(g.probe.now().tried, 0, '次の偏見では外した記録が消える');
  tapPref(g, a);
  assert.equal(g.probe.now().misses, 1, '埋まった県はもう答えにならない');
}

// 5回外したら、答えの県がある地方を囲む。次の偏見では消える
{
  const g = open();
  const REGION = [0, 1, 7, 14, 23, 30, 35, 39], regionOf = i => REGION.filter(s => i >= s).length - 1;
  /* 地方の分け方: 東北は青森から福島、九州沖縄は福岡から沖縄 */
  assert.deepEqual([0, 1, 6, 7, 13, 14, 22, 23, 29, 30, 34, 35, 38, 39, 46].map(regionOf), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  const a = g.dbg.ask(), others = [...Array(47).keys()].filter(i => i !== a);
  for (let n = 0; n < 5; n++) {
    assert.equal(g.probe.now().hint, -1, (n) + '回目まではヒントなし');
    tapPref(g, others[n]);
  }
  assert.equal(g.probe.now().hint, regionOf(a), '5回外すと答えの地方を囲む');
  g.step(10);
  tapPref(g, a);
  assert.equal(g.probe.now().hint, -1, '当てたら消える');
  next(g);
  assert.equal(g.probe.now().hint, -1, '次の偏見ではヒントなし');
}

// ドラッグで動かす（タップ扱いにしない）・2本指とホイールで広げる・端から出ない
{
  const g = open();
  const m = g.probe.now().map, cy = m.y + m.h / 2, c0 = g.probe.now().cam;
  const touched = () => g.probe.now().misses + (47 - g.probe.now().left);
  g.drag([{ x: 270, y: cy }, { x: 200, y: cy - 50 }, { x: 150, y: cy - 90 }], 1);
  assert.equal(touched(), 0, 'なぞっただけでは答えない');
  g.wrap.fire('wheel', Object.assign(P(1, 270, cy), { deltaY: -600 }));
  assert(g.probe.now().cam.s > c0.s * 1.8, 'ホイールで寄る');
  const cx = g.probe.now().cam.x;
  g.drag([{ x: 300, y: cy }, { x: 250, y: cy }, { x: 200, y: cy }], 1);
  assert(g.probe.now().cam.x > cx + 10, 'ドラッグで地図が動く');
  const s2 = g.probe.now().cam.s;
  g.wrap.fire('pointerdown', P(1, 220, cy)); g.wrap.fire('pointerdown', P(2, 320, cy));
  g.wrap.fire('pointermove', P(1, 170, cy)); g.wrap.fire('pointermove', P(2, 370, cy));
  g.wrap.fire('pointerup', P(2, 370, cy)); g.wrap.fire('pointerup', P(1, 170, cy));
  assert(Math.abs(g.probe.now().cam.s / s2 - 2) < 0.05, '2本指の開きに合わせて寄る');
  assert.equal(touched(), 0, '2本指ではタップ扱いにしない');
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 270, cy), { deltaY: 800 }));
  assert(Math.abs(g.probe.now().cam.s - g.probe.now().full) < 1e-6, '全体より引かない');
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 10, m.y + 10), { deltaY: -800 }));
  assert(g.probe.now().cam.s <= g.probe.now().full * 8 + 1e-6, '寄りすぎない');
  /* 端までなぞると、それ以上は動かない */
  for (let i = 0; i < 10; i++) g.drag([{ x: 100, y: m.y + 100 }, { x: 400, y: m.y + 300 }], 1);
  const edge = g.probe.now().cam;
  g.drag([{ x: 100, y: m.y + 100 }, { x: 400, y: m.y + 300 }], 1);
  assert.deepEqual(g.probe.now().cam, edge, '地図の外まで行かない');
  /* 寄った状態でも小さい県をタップで当てられる */
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 270, cy), { deltaY: 800 }));
  const a = g.dbg.ask(), z = g.probe.spot(a);
  g.wrap.fire('wheel', Object.assign(P(1, z.x, z.y), { deltaY: -900 }));
  tapPref(g, a);
  assert.equal(g.probe.now().done[a], 1, '寄って当てる');
}

// 全部1回で当てる・偏県名が埋まる・もう一度
{
  const g = open();
  const seen = new Set();
  for (let n = 0; n < 47; n++) {
    const a = g.dbg.ask();
    seen.add(a);
    tapPref(g, a);
    assert.equal(g.probe.now().done[a], 1, '当てた県は埋まる');
    assert.equal(g.probe.now().left, 46 - n);
    if (n < 46) next(g);
  }
  assert.equal(seen.size, 47, '47の偏見が1回ずつ出る');
  assert(g.until(() => g.probe.now().state === 'result', 400), '全部埋めたら結果');
  assert.equal(g.probe.now().score, 47);
  assert.equal(g.probe.now().map.h, g.probe.now().H, '最後は地図が画面いっぱい');
  g.step(30);
  const H = g.probe.now().H;
  g.tap(270 - 102, H * 0.62 + 27);
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().left, 47);
  assert(g.probe.now().map.y > 100, 'もう一度で札が戻る');
}

// キーだけで遊べる
{
  const g = open();
  g.press(' ');
  assert(g.probe.now().cursor >= 0, '最初のスペースで県が1つ選ばれる');
  assert.equal(g.probe.now().misses, 0, '最初のスペースでは答えない');
  const first = g.probe.now().cursor;
  ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].some(k => { g.press(k); return g.probe.now().cursor !== first; });
  assert.notEqual(g.probe.now().cursor, first, '矢印で別の県へ');
  /* 矢印だけで、いまの偏見の県までたどり着ける。どの矢印でどこへ移るかをたどって道を探し、実際にそのキーを押す */
  const KEYS = [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowUp', 0, -1]];
  function route(from, to) {
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const c = q.shift();
      if (c === to) break;
      for (const [key, dx, dy] of KEYS) {
        const n = g.dbg.peek(c, dx, dy);
        if (n !== c && !(n in prev)) { prev[n] = [c, key]; q.push(n); }
      }
    }
    if (!(to in prev)) return null;
    const keys = [];
    for (let c = to; prev[c]; c = prev[c][0]) keys.unshift(prev[c][1]);
    return keys;
  }
  for (let n = 0; n < 47; n++) {
    const a = g.dbg.ask();
    if (g.probe.now().cursor < 0) g.press(' ');
    const keys = route(g.probe.now().cursor, a);
    assert(keys, (n + 1) + '問目: 矢印の道がある');
    keys.forEach(k => g.press(k));
    assert.equal(g.probe.now().cursor, a, (n + 1) + '問目: 矢印でたどり着ける');
    g.press(' ');
    assert(g.probe.now().done[a] > 0);
    if (n < 46) next(g);
  }
  assert(g.until(() => g.probe.now().state === 'result', 400));
  g.press(' ');
  assert.equal(g.probe.now().state, 'play', '結果でスペースはもう一度');
  g.esc();
  assert.equal(g.probe.now().left, 47, 'Escで最初から');
}

// 画面の形ごとに: 札が画面に収まる・全体表示で全県が見える
for (const shape of load.SHAPES) {
  const g = open(shape);
  const p = g.probe.now();
  assert(p.card.x >= 0 && p.card.x + p.card.w <= 540 && p.card.y >= 0, '札は画面の中 ' + shape);
  for (let i = 0; i < 47; i++) {
    const s = g.probe.spot(i);
    assert(s.x >= 0 && s.x <= p.map.w && s.y >= p.map.y && s.y <= p.map.y + p.map.h, '全体表示で全県が見える ' + shape);
  }
}

console.log('偏県: OK');
