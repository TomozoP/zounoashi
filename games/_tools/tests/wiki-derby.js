/* ウィキペディアダービー: 通信の代わりに偽の出走馬を差し込み、1頭1ボタンで賭ける・リセット・倍率・文字を出し切って止まるレース・着順・払い戻し・3レース・キー・間隔・通信失敗を確かめる。 */
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
      var lens = f.lens ? f.lens.slice() : [0,1,2,3,4,5,6,7].map(function () { return 1000 + Math.floor(Math.random() * 90000); });
      var pvs = f.pvs ? f.pvs.slice() : lens.map(function () { return Math.floor(Math.random() * 2000); });
      return Promise.resolve(lens.map(function (len, i) {
        return { id: f.calls * 100 + i, title: "記事" + f.calls + "-" + i, len: len, pv: pvs[i], text: "これは" + i + "番の記事の冒頭の文章です。" };
      }));
    }
  };`;
  globalThis.__derbyFake = { calls: 0, failNext: 0, lens: null, pvs: null };
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
  assert.equal(g.probe.now().horses.length, 8, '8頭立て');
}
/* スタートして、着順と払い戻しが出るまで進める */
function race(g) {
  at(g, g.probe.startButton()); g.step(1);
  assert.equal(g.probe.now().phase, 'count', 'スタートで3つ数える');
  g.step(170);
  assert.equal(g.probe.now().phase, 'count', '3秒たつまでは走らない');
  assert.ok(g.probe.positions() === null || g.probe.positions().every(v => v === 0));
  g.until(() => g.probe.now().phase === 'race', 30);
  assert.equal(g.probe.now().phase, 'race', '3秒たったら走る');
  assert.ok(Math.abs(g.probe.now().cam + 44) < 1, 'ゲートは画面の左端');
  const H = g.probe.now().H, lastLane = g.probe.lane(7), top = g.probe.raceCtrl(0).y - 26;
  assert.ok(lastLane < top, 'レース中の賭けたボタンは走路の下にある');
  assert.ok(g.probe.raceCtrl(7).y + 26 < H - 20, 'レース中の賭けたボタンが画面に収まる');
  const stopSeen = [], cams = [], stopX = {};
  let frames = 0, fastFrames = 0, soloFrames = 0;
  while (g.probe.now().phase === 'race' && frames < 3000) {
    const st = g.probe.stopped(), p = g.probe.positions();
    const alive = st.filter(v => !v).length;
    if (alive === 1) soloFrames++; else soloFrames = 0;
    if (g.probe.fast() > 1) {
      fastFrames++;
      assert.ok(alive <= 1, "早送りは走っているのが1頭だけのとき（止まった直後の1コマを除く）");
      if (alive === 1) assert.ok(soloFrames > 115, "独走が2秒続いてから早送り: " + soloFrames);
    }
    st.forEach((v, i) => { if (v && !stopSeen.includes(i)) { stopSeen.push(i); stopX[i] = p[i]; } });
    if (frames % 60 === 0) cams.push(g.probe.now().cam);
    g.step(1); frames++;
  }
  const orderSeen = stopSeen.slice().reverse();              /* 最後まで走った馬が1着 */
  for (let k = 1; k < orderSeen.length; k++) assert.ok(stopX[orderSeen[k - 1]] > stopX[orderSeen[k]], '長い記事の馬ほど先で止まる');
  assert.ok(frames < 3000, '走り終わる');
  assert.equal(g.probe.now().phase, 'finish');
  return { orderSeen, seconds: frames / 60, cams, fastFrames };
}
async function next(g) { g.step(40); at(g, g.probe.next()); g.step(1); await flush(); g.step(1); }

(async () => {
  /* 1. 賭ける・戻す・賭けずに走れない（単勝だけ、100ずつ） */
  {
    const g = open();
    await start(g);
    at(g, g.probe.startButton()); g.step(30);
    assert.equal(g.probe.now().phase, 'bet', '賭けずにスタートしても走らない');
    at(g, g.probe.plus(3)); at(g, g.probe.plus(3)); at(g, g.probe.plus(7));
    let now = g.probe.now();
    assert.equal(now.money, 700);
    assert.equal(now.bets[3], 200);
    assert.equal(now.bets[7], 100);
    at(g, g.probe.card(4)); g.step(10);
    assert.equal(g.probe.now().bets[4], 0, '馬名の一覧を押しても賭けない');
    at(g, g.probe.resetButton()); g.step(30);
    now = g.probe.now();
    assert.equal(now.money, 1000, 'リセットで全部戻る');
    assert.equal(now.bet, 0);
    for (let i = 0; i < 13; i++) at(g, g.probe.plus(i % 8));
    assert.equal(g.probe.now().money, 0, '手持ちより多くは賭けられない');
    assert.equal(g.probe.now().bet, 1000);
  }

  /* 2. 倍率は閲覧数で、着順は長さで決まる。払い戻しは賭け金×倍率 */
  {
    const g = open();
    globalThis.__derbyFake.lens = [5000, 120000, 3000, 80000, 700, 45000, 9000, 60000];
    globalThis.__derbyFake.pvs = [3000, 50, 10, 900, 0, 200, 40, 5];
    await start(g);
    const now0 = g.probe.now();
    assert.deepEqual(now0.order, [1, 3, 7, 5, 6, 0, 2, 4], '着順は長い順');
    const odds = now0.odds;
    assert.equal(now0.popRank[0], 0, 'いちばん読まれている記事が1番人気');
    assert.ok(odds[0] < odds[3] && odds[3] < odds[5] && odds[5] < odds[1] && odds[1] < odds[4], '閲覧数が多いほど倍率が低い: ' + odds);
    assert.ok(odds.every(o => o >= 1.1 && o <= 999.9));
    at(g, g.probe.plus(1)); at(g, g.probe.plus(1));          /* 1着の馬に200 */
    at(g, g.probe.plus(0));                                  /* 1番人気（6着）に100 */
    const rest = g.probe.now().money;
    const r = race(g);
    assert.deepEqual(r.orderSeen, now0.order, '止まった順の逆が長さの順');
    /* 2位の馬は長さ80000で約24.5秒、1位は120000で30秒走る。24.5秒からの独走は2秒待って4倍 */
    assert.ok(r.fastFrames > 0, '独走で早送りになった');
    assert.ok(r.seconds > 26 && r.seconds < 30, '早送りのぶん30秒より短い: ' + r.seconds.toFixed(1));
    assert.ok(r.cams[r.cams.length - 1] - r.cams[0] > 2000, 'カメラが馬群を追いかける');
    assert.equal(g.probe.now().won, Math.floor(200 * odds[1]));
    assert.equal(g.probe.now().money, rest + Math.floor(200 * odds[1]));
    assert.equal(g.probe.now().race, 1);
  }

  /* 3. 途中の抜きつ抜かれつ: 先頭が入れ替わる */
  {
    let changed = 0;
    for (let n = 0; n < 6; n++) {
      const g = open();
      await start(g);
      at(g, g.probe.plus(0));
      at(g, g.probe.startButton()); g.step(1);
      g.until(() => g.probe.now().phase === 'race', 400);
      const winner = g.probe.now().order[0];
      const leaders = new Set();
      for (let f = 0; f < 600; f++) {
        g.step(1);
        const p = g.probe.positions(), st = g.probe.stopped();
        const run = p.map((v, i) => st[i] ? -1 : v);
        if (f > 150 && f % 10 === 0) leaders.add(run.indexOf(Math.max(...run)));
      }
      if (leaders.size > 1 || !leaders.has(winner)) changed++;
    }
    assert.ok(changed >= 4, '先頭が入れ替わる: ' + changed + '/6');
  }

  /* 4. 3レースで終わる。結果は手持ち */
  {
    const g = open();
    await start(g);
    let expect = 1000;
    for (let n = 0; n < 3; n++) {
      assert.equal(g.probe.now().phase, 'bet', (n + 1) + 'レース目');
      const w = g.probe.now().order[0];
      at(g, g.probe.plus(w));                                /* 必ず勝つ馬に100 */
      expect += -100 + Math.floor(100 * g.probe.now().odds[w]);
      race(g);
      await next(g);
      if (g.probe.now().state !== 'play') break;
    }
    const now = g.probe.now();
    assert.equal(now.state, 'result', '3レースで結果');
    assert.equal(now.race, 3);
    assert.equal(now.score, expect);
    at(g, g.probe.result().retry); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().state, 'play', 'もう一度');
    assert.equal(g.probe.now().money, 1000);
    assert.equal(g.probe.now().race, 0);
  }

  /* 5. 手持ちが100を切ったら終わる */
  {
    const g = open();
    globalThis.__derbyFake.lens = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
    await start(g);
    for (let i = 0; i < 10; i++) at(g, g.probe.plus(0));     /* いちばん短い馬に全部 */
    race(g);
    assert.equal(g.probe.now().money, 0);
    await next(g);
    assert.equal(g.probe.now().state, 'result', '尽きたら結果');
    assert.equal(g.probe.now().score, 0);
  }

  /* 6. キーだけで遊べる */
  {
    const g = open();
    await start(g);
    g.press('ArrowRight'); g.press(' ');
    assert.equal(g.probe.now().bets[1], 100, '→で2番');
    g.press('ArrowDown'); g.press(' '); g.press(' ');
    assert.equal(g.probe.now().bets[5], 200, '↓で6番（4列なので2番の下は6番）');
    g.press('Backspace');
    assert.equal(g.probe.now().bet, 0, 'Backspaceでリセット');
    g.press(' ');
    assert.equal(g.probe.now().bets[5], 100);
    for (let i = 0; i < 6; i++) g.press('ArrowDown');
    assert.equal(g.probe.now().sel, 8, 'いちばん下からさらに下はスタート');
    g.press('ArrowRight');
    assert.equal(g.probe.now().sel, 9, 'スタートの右はリセット');
    g.press('ArrowLeft');
    g.press(' '); g.step(1);
    assert.equal(g.probe.now().phase, 'count');
    g.until(() => g.probe.now().phase === 'finish', 3000); g.step(40);
    g.press(' '); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'bet', 'スペースで次のレース');
    g.esc(); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().money, 1000, 'Escで最初から');
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
    const pts = [g.probe.pile(), g.probe.startButton(), g.probe.resetButton()];
    for (let i = 0; i < 8; i++) pts.push(g.probe.plus(i));
    let min = 1e9;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    assert.ok(min >= 63, shape.join('x') + ' 押しどころの間隔 ' + min.toFixed(1));
    pts.forEach(p => assert.ok(p.y > 0 && p.y < H - 20, shape.join('x') + ' 画面の中'));
    assert.ok(g.probe.next().y < H - 20);
  }

  console.log('ok wiki-derby');
})().catch(e => { console.error(e); process.exit(1); });
