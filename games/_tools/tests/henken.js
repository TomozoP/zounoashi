/* 偏県: 県名の中身・県名の置き場所・地図をタップして県を選ぶ・ドラッグと2本指とホイールで地図を動かす・
   外したら選び直し・47県を埋めて終わる・一覧のスクロール・キー操作・押しどころの距離を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_henken/index.html';
/* テストのときだけ、正解と中身を覗く */
const inject = 'window.__dbg={list:function(){return list.slice();},reveal:reveal,prefAt:prefAt,' +
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
const center = c => [c.x + c.w / 2, c.y + c.h / 2];
const P = (id, x, y) => ({ clientX: x, clientY: y, pointerId: id, button: 0, preventDefault() {} });
/* 地図で県 i の県名の場所をタップする */
function tapPref(g, i) {
  const s = g.probe.spot(i);
  g.tap(s.x, s.y);
}
/* 一覧のk番目を見えるところまで動かして押す */
function tapName(g, k) {
  g.dbg.reveal(k);
  g.until(() => { const p = g.probe.now(), c = p.list[k]; return c.y >= p.listTop && c.y + c.h <= p.listBottom; }, 120);
  g.tap(...center(g.probe.now().list[k]));
}
const kOf = (g, i) => g.dbg.list().indexOf(i);

// 県名の中身
{
  const g = load(file, { quiet: true, inject });
  /* 「|」は2行にするときの区切り。1つだけ、端には置かない */
  g.dbg.NAMES.forEach(n => assert(/^[^|]+|[^|]+$/.test(n), '区切りは1つ: ' + n));
  const N = g.dbg.NAMES.map(n => n.replace('|', ''));
  assert.equal(N.length, 47);
  assert.equal(g.dbg.SHAPES.length, 47);
  assert.equal(new Set(N).size, 47, '県名は重ならない');
  const SUFFIX = '道' + '県'.repeat(11) + '都' + '県'.repeat(12) + '府府' + '県'.repeat(20);
  N.forEach((n, i) => assert(n.length >= 3 && n.length <= 9 && n.slice(-1) === SUFFIX[i], '偏見＋都道府県: ' + n));
  /* 答えが書いてあると当てる遊びにならないので、実際の都道府県名は入れない */
  const REAL = '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(' ');
  N.forEach(n => REAL.forEach(r => assert(!n.includes(r), n + ' に実在の名前 ' + r)));
  /* 一覧の一文も47個。重ならず、1行に収まる長さで、答えの都道府県名は入れない */
  const L = g.dbg.LINES;
  assert.equal(L.length, 47); assert.equal(new Set(L).size, 47);
  L.forEach(s => assert(s.length >= 8 && s.length <= 24, '一文の長さ: ' + s));
  L.forEach(s => REAL.forEach(r => assert(!s.includes(r), s + ' に実在の名前 ' + r)));
  g.dbg.SHAPES.forEach((s, i) => assert(s.length >= 1 && s.every(r => r.length >= 4), (i + 1) + '番の形'));
  /* 県名は、その県の中に置く */
  g.dbg.LABEL.forEach((p, i) => assert(g.dbg.SHAPES[i].some(r => g.dbg.inside(r, p[0], p[1])), (i + 1) + '番の県名が県の外'));
}

// 開始直後は何も選ばれていない。名前を押しても何も起きない。地図の県をタップすると選べる
{
  const g = open();
  assert.equal(g.probe.now().selected, -1, '県は自動で選ばれない');
  tapName(g, 0);
  assert.equal(g.probe.now().misses, 0); assert.equal(g.probe.now().left, 47, '県を選ぶ前は答えられない');
  /* 全体表示のままで、どの県も県名の場所をタップすればその県が選ばれる */
  for (let i = 0; i < 47; i++) {
    const s = g.probe.spot(i);
    assert.equal(g.dbg.prefAt(s.x, s.y), i, (i + 1) + '番をタップで選べる');
  }
  tapPref(g, 12);
  assert.equal(g.probe.now().selected, 12);
  tapPref(g, 0);
  assert.equal(g.probe.now().selected, 0, '別の県を選び直せる');
  /* 海をタップしても選択は変わらない */
  g.tap(530, 8);
  assert.equal(g.probe.now().selected, 0, '海のタップで選択は変わらない');
}

// ドラッグで動かす（タップ扱いにしない）・2本指とホイールで広げる・端から出ない
{
  const g = open();
  const m = g.probe.now().map, c0 = g.probe.now().cam;
  g.drag([{ x: 270, y: m.h / 2 }, { x: 200, y: m.h / 2 - 50 }, { x: 150, y: m.h / 2 - 90 }], 1);
  assert.equal(g.probe.now().selected, -1, 'なぞっただけでは選ばない');
  /* ホイールで寄る */
  g.wrap.fire('wheel', Object.assign(P(1, 270, m.h / 2), { deltaY: -600 }));
  const s1 = g.probe.now().cam.s;
  assert(s1 > c0.s * 1.8, 'ホイールで寄る');
  /* 寄った後のドラッグで地図が動く */
  const cx = g.probe.now().cam.x;
  g.drag([{ x: 300, y: m.h / 2 }, { x: 250, y: m.h / 2 }, { x: 200, y: m.h / 2 }], 1);
  assert(g.probe.now().cam.x > cx + 10, 'ドラッグで地図が動く');
  assert.equal(g.probe.now().selected, -1);
  /* 2本指で広げる */
  const s2 = g.probe.now().cam.s;
  g.wrap.fire('pointerdown', P(1, 220, m.h / 2)); g.wrap.fire('pointerdown', P(2, 320, m.h / 2));
  g.wrap.fire('pointermove', P(1, 170, m.h / 2)); g.wrap.fire('pointermove', P(2, 370, m.h / 2));
  g.wrap.fire('pointerup', P(2, 370, m.h / 2)); g.wrap.fire('pointerup', P(1, 170, m.h / 2));
  assert(Math.abs(g.probe.now().cam.s / s2 - 2) < 0.05, '2本指の開きに合わせて寄る');
  assert.equal(g.probe.now().selected, -1, '2本指ではタップ扱いにしない');
  /* 引きすぎ・寄りすぎ・はみ出しを止める */
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 270, m.h / 2), { deltaY: 800 }));
  assert(Math.abs(g.probe.now().cam.s - g.probe.now().full) < 1e-6, '全体より引かない');
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 10, 10), { deltaY: -800 }));
  assert(g.probe.now().cam.s <= g.probe.now().full * 8 + 1e-6, '寄りすぎない');
  for (let i = 0; i < 10; i++) g.drag([{ x: 100, y: 100 }, { x: 400, y: 300 }], 1);
  const spots = g.dbg.LABEL.map((p, i) => g.probe.spot(i));
  assert(spots.some(s => s.x >= 0 && s.x <= m.w && s.y >= 0 && s.y <= m.h), '地図の外まで行かない');
  /* 寄った状態でも小さい県をタップで選べる */
  for (let i = 0; i < 20; i++) g.wrap.fire('wheel', Object.assign(P(1, 270, m.h / 2), { deltaY: 800 }));
  const z = g.probe.spot(12);
  g.wrap.fire('wheel', Object.assign(P(1, z.x, z.y), { deltaY: -900 }));
  tapPref(g, 12);
  assert.equal(g.probe.now().selected, 12);
}

// 全部1回で当てる・県名が埋まる・もう一度
{
  const g = open();
  const order = [...Array(47).keys()].sort(() => Math.random() - .5);
  order.forEach((i, n) => {
    tapPref(g, i);
    assert.equal(g.probe.now().selected, i);
    tapName(g, kOf(g, i));
    assert.equal(g.probe.now().done[i], 1, '当てた県は埋まる');
    assert.equal(g.probe.now().selected, -1, '当てたら選択が外れる');
    assert.equal(g.probe.now().left, 46 - n);
    if (n < 46) {
      tapPref(g, i);
      assert.equal(g.probe.now().selected, -1, '埋まった県は選べない');
    }
  });
  assert(g.until(() => g.probe.now().state === 'result', 400), '全部埋めたら結果');
  assert.equal(g.probe.now().score, 47);
  assert.equal(g.probe.now().map.h, g.probe.now().H, '最後は地図が画面いっぱい');
  g.step(30);
  const H = g.probe.now().H;
  g.tap(270 - 102, H * 0.62 + 27);
  assert.equal(g.probe.now().state, 'play'); assert.equal(g.probe.now().left, 47);
  assert(g.probe.now().map.h < H * 0.6, 'もう一度で一覧が戻る');
}

// 外したら同じ県のまま選び直し。外した名前はその県でだけ押せない。途中で別の県に移ってもよい
{
  const g = open();
  const a = 5, b = 30, L = () => g.dbg.list();
  tapPref(g, a);
  const wrong = L().findIndex(x => x !== a && x !== b);
  tapName(g, wrong);
  assert.equal(g.probe.now().selected, a, '外しても同じ県のまま');
  assert.equal(g.probe.now().misses, 1); assert.equal(g.probe.now().tried, 1);
  tapName(g, wrong);
  assert.equal(g.probe.now().misses, 1, '外した名前はもう押せない');
  /* 別の県へ移ると、さっき外した名前も押せる */
  tapPref(g, b);
  assert.equal(g.probe.now().tried, 0);
  tapName(g, wrong);
  assert.equal(g.probe.now().misses, 2);
  tapName(g, kOf(g, b));
  assert.equal(g.probe.now().done[b], 2, '外してから当てた印');
  /* 戻ると、外した記録は残っている */
  tapPref(g, a);
  assert.equal(g.probe.now().tried, 1);
  tapName(g, kOf(g, a));
  assert.equal(g.probe.now().done[a], 2);
  assert.equal(g.probe.now().score, 0);
  /* 一覧をなぞるとスクロールして、答えにはならない */
  tapPref(g, 0);
  const p = g.probe.now();
  if (p.maxScroll > 0) {
    /* 動かせる向きへなぞる */
    const s0 = p.scroll, upward = s0 < p.maxScroll / 2, y = upward ? p.listBottom - 20 : p.listTop + 20, d = upward ? -1 : 1;
    g.drag([{ x: 100, y }, { x: 100, y: y + 40 * d }, { x: 100, y: y + 120 * d }], 1);
    assert.equal(g.probe.now().misses, 2, 'なぞっただけでは選ばない');
    assert(Math.abs(g.probe.now().scroll - s0) > 50, 'なぞると一覧が動く');
  }
}

// キーだけで遊べる
{
  const g = open();
  g.press(' ');
  assert(g.probe.now().selected >= 0, '最初のスペースで県が1つ選ばれる');
  const first = g.probe.now().selected;
  ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].some(k => { g.press(k); return g.probe.now().selected !== first; });
  assert.notEqual(g.probe.now().selected, first, '矢印で別の県へ');
  let guard = 0;
  while (g.probe.now().left > 0 && guard++ < 400) {
    ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].some(k => { if (g.probe.now().selected >= 0) return true; g.press(k); return false; });
    const i = g.probe.now().selected;
    assert(i >= 0, '矢印でまだの県を選べる');
    g.press(' ');
    assert.equal(g.probe.now().focus, 'list', 'スペースで一覧へ');
    const k = kOf(g, i);
    let n = 0;
    while (g.probe.now().sel !== k && n++ < 60) g.press(g.probe.now().sel < k ? 'ArrowRight' : 'ArrowLeft');
    assert.equal(g.probe.now().sel, k, '左右で正解の名前まで行ける');
    g.press(' ');
    assert.equal(g.probe.now().done[i], 1);
    assert.equal(g.probe.now().focus, 'map', '当てたら地図へ戻る');
  }
  assert.equal(g.probe.now().left, 0, 'キーだけで47県を埋められる');
  assert(g.until(() => g.probe.now().state === 'result', 400));
  g.press(' ');
  assert.equal(g.probe.now().state, 'play', '結果でスペースはもう一度');
  g.esc();
  assert.equal(g.probe.now().left, 47, 'Escで最初から');
}

// 画面の形ごとに: 押しどころの間隔・一覧の位置・最後の名前まで届く・全体表示で全県が見える
for (const shape of load.SHAPES) {
  const g = open(shape);
  const p = g.probe.now(), cs = p.list.map(center);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    assert(Math.hypot(cs[i][0] - cs[j][0], cs[i][1] - cs[j][1]) >= 63, '押しどころの間隔');
  }
  assert(p.listTop >= p.map.h, '一覧は地図の下');
  for (let i = 0; i < 47; i++) {
    const s = g.probe.spot(i);
    assert(s.x >= 0 && s.x <= p.map.w && s.y >= 0 && s.y <= p.map.h, '全体表示で全県が見える ' + shape);
  }
  g.dbg.reveal(46); g.step(120);
  const last = g.probe.now().list[46];
  assert(last.y >= p.listTop - 0.5 && last.y + last.h <= p.listBottom + 0.5, '最後の名前まで届く ' + shape);
}

console.log('偏県: OK');
