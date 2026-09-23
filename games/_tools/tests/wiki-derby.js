/* ウィキペディアダービー: 通信の代わりに偽の出走馬を差し込み、賭ける・戻す・走る・着順・払い戻し・10レース・キー・間隔・通信失敗を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_wiki-derby/index.html';
const flush = () => new Promise(r => setImmediate(r));

function open(shape) {
  const inject = `
  window.__wikiSource = {
    field: function () {
      var f = globalThis.__derbyFake; f.calls++;
      if (f.failNext > 0) { f.failNext--; return Promise.reject(new Error("x")); }
      var lens = f.lens ? f.lens.slice() : [0,1,2,3,4,5,6,7,8,9,10,11].map(function () { return 1000 + Math.floor(Math.random() * 90000); });
      return Promise.resolve(lens.map(function (len, i) { return { id: f.calls * 100 + i, title: "記事" + f.calls + "-" + i, len: len }; }));
    }
  };`;
  globalThis.__derbyFake = { calls: 0, failNext: 0, lens: null };
  const g = load(file, { quiet: true, inject });
  if (shape) g.view(...shape);
  g.step(2);
  return g;
}
const at = (g, p) => g.tap(p.x, p.y);
async function start(g) {
  assert.equal(g.probe.now().state, 'intro');
  g.press(' '); g.step(1); await flush(); g.step(1);
  assert.equal(g.probe.now().state, 'play');
  assert.equal(g.probe.now().phase, 'bet', '出走馬が出る');
  assert.equal(g.probe.now().horses.length, 12);
}
/* スタートして、着順と払い戻しが出るまで進める */
function race(g) {
  at(g, g.probe.startButton()); g.step(1);
  assert.equal(g.probe.now().phase, 'race', 'スタートで走る');
  let orderSeen = [], frames = 0;
  while (g.probe.now().phase === 'race' && frames < 1200) {
    const p = g.probe.positions();
    p.forEach((v, i) => { if (v >= 1 && !orderSeen.includes(i)) orderSeen.push(i); });
    g.step(1); frames++;
  }
  assert.ok(frames < 1200, '走り終わる');
  assert.equal(g.probe.now().phase, 'finish');
  return { orderSeen, seconds: frames / 60 };
}
async function next(g) { g.step(40); at(g, g.probe.next()); g.step(1); await flush(); g.step(1); }

(async () => {
  /* 1. 賭ける・戻す・賭けずに走れない */
  {
    const g = open();
    await start(g);
    at(g, g.probe.startButton()); g.step(30);
    assert.equal(g.probe.now().phase, 'bet', '賭けずにスタートしても走らない');
    at(g, g.probe.card(3)); at(g, g.probe.card(3));
    at(g, g.probe.toggle('place')); at(g, g.probe.card(7));
    let now = g.probe.now();
    assert.equal(now.chips, 7);
    assert.equal(now.win[3], 2, '1着に2枚');
    assert.equal(now.place[7], 1, '3着以内に1枚');
    at(g, g.probe.pile()); g.step(30);
    now = g.probe.now();
    assert.equal(now.chips, 10, '手元を押すと全部戻る');
    assert.equal(now.bet, 0);
    for (let i = 0; i < 13; i++) at(g, g.probe.card(i % 12));
    assert.equal(g.probe.now().chips, 0, '手持ちより多くは賭けられない');
  }

  /* 2. 着順はページの長い順。払い戻しは1着8倍・3着以内3倍 */
  {
    const g = open();
    globalThis.__derbyFake.lens = [5000, 120000, 3000, 80000, 700, 45000, 9000, 60000, 1500, 100000, 20000, 30000];
    await start(g);
    const expectOrder = [1, 9, 3, 7, 5, 11, 10, 6, 0, 2, 8, 4];
    assert.deepEqual(g.probe.now().order, expectOrder);
    at(g, g.probe.card(1));                                  /* 1着に1枚（当たり） */
    at(g, g.probe.card(4));                                  /* 1着に1枚（外れ） */
    at(g, g.probe.toggle('place'));
    at(g, g.probe.card(3)); at(g, g.probe.card(3));          /* 3着以内に2枚（当たり） */
    at(g, g.probe.card(7));                                  /* 3着以内に1枚（4着で外れ） */
    const rest = g.probe.now().chips;
    const r = race(g);
    assert.deepEqual(r.orderSeen, expectOrder, 'ゴールした順が長さの順');
    assert.ok(r.seconds > 5 && r.seconds < 12, '1レースの長さ ' + r.seconds.toFixed(1) + '秒');
    assert.equal(g.probe.now().won, 1 * 8 + 2 * 3);
    assert.equal(g.probe.now().chips, rest + 14);
    assert.equal(g.probe.now().race, 1);
  }

  /* 3. 途中の抜きつ抜かれつ: 最後に勝つ馬がずっと先頭とは限らない（何度か走らせて確かめる） */
  {
    let changed = 0;
    for (let n = 0; n < 6; n++) {
      const g = open();
      await start(g);
      at(g, g.probe.card(0));
      at(g, g.probe.startButton()); g.step(1);
      const winner = g.probe.now().order[0];
      let leaders = new Set();
      for (let f = 0; f < 280; f++) {
        g.step(1);
        const p = g.probe.positions();
        if (f > 60) leaders.add(p.indexOf(Math.max(...p)));
      }
      if (leaders.size > 1 || !leaders.has(winner)) changed++;
    }
    assert.ok(changed >= 3, '先頭が入れ替わる: ' + changed + '/6');
  }

  /* 4. 10レースで終わる。結果は手持ちの枚数 */
  {
    const g = open();
    await start(g);
    for (let n = 0; n < 10; n++) {
      assert.equal(g.probe.now().phase, 'bet', (n + 1) + 'レース目');
      at(g, g.probe.toggle('place'));
      at(g, g.probe.card(g.probe.now().order[0]));           /* 必ず当たる馬に3着以内1枚 */
      race(g);
      await next(g);
      if (g.probe.now().state !== 'play') break;
    }
    const now = g.probe.now();
    assert.equal(now.state, 'result', '10レースで結果');
    assert.equal(now.race, 10);
    assert.equal(now.score, 10 + 10 * 2, '毎回3倍で戻ると +2ずつ');
    const b = g.probe.result().retry;
    at(g, b); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().state, 'play', 'もう一度');
    assert.equal(g.probe.now().chips, 10);
    assert.equal(g.probe.now().race, 0);
  }

  /* 5. チップが尽きたら終わる */
  {
    const g = open();
    globalThis.__derbyFake.lens = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000];
    await start(g);
    for (let i = 0; i < 10; i++) at(g, g.probe.card(0));     /* いちばん短い馬に全部 */
    race(g);
    assert.equal(g.probe.now().chips, 0);
    await next(g);
    assert.equal(g.probe.now().state, 'result', '尽きたら結果');
    assert.equal(g.probe.now().score, 0);
  }

  /* 6. キーだけで遊べる */
  {
    const g = open();
    await start(g);
    g.press('ArrowRight'); g.press(' ');
    assert.equal(g.probe.now().win[1], 1, '→で2番に1着');
    g.press('ArrowUp'); g.press('ArrowUp');
    assert.equal(g.probe.now().sel, -2, '上の段からさらに上は賭け方');
    g.press(' ');
    assert.equal(g.probe.now().betType, 'place');
    g.press('ArrowDown'); g.press('ArrowDown'); g.press(' ');
    assert.equal(g.probe.now().place[3], 1, '↓で4番に3着以内');
    for (let i = 0; i < 6; i++) g.press('ArrowDown');
    assert.equal(g.probe.now().sel, 12, 'いちばん下からさらに下はスタート');
    g.press(' '); g.step(1);
    assert.equal(g.probe.now().phase, 'race');
    g.until(() => g.probe.now().phase === 'finish', 1200); g.step(40);
    g.press(' '); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'bet', 'スペースで次のレース');
    g.esc(); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().chips, 10, 'Escで最初から');
  }

  /* 7. 通信の失敗 → 押し直すと取り直す */
  {
    const g = open();
    globalThis.__derbyFake.failNext = 1;
    g.press(' '); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'error');
    g.step(120);
    assert.equal(g.probe.now().phase, 'error', '勝手に進まない');
    at(g, g.probe.retryButton()); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'bet');
  }

  /* 8. 押しどころの間隔（画面の形ごと） */
  for (const shape of load.SHAPES) {
    const g = open(shape);
    await start(g);
    const H = g.probe.now().H;
    const pts = [g.probe.toggle('win'), g.probe.toggle('place'), g.probe.pile(), g.probe.startButton()];
    for (let i = 0; i < 12; i++) pts.push(g.probe.card(i));
    let min = 1e9;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    assert.ok(min >= 63, shape.join('x') + ' 押しどころの間隔 ' + min.toFixed(1));
    pts.forEach(p => assert.ok(p.y > 0 && p.y < H - 20, shape.join('x') + ' 画面の中'));
    assert.ok(g.probe.next().y < H - 20);
  }

  console.log('ok wiki-derby');
})().catch(e => { console.error(e); process.exit(1); });
