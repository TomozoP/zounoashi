/* 情報量ダービー: 通信の代わりに偽の出走馬を差し込み、1頭1ボタンで賭ける・リセット・倍率・本文を書き切って止まるレース（1着は決まったら走り抜けて終わり）・着順・払い戻し・3レース・キー・間隔・通信失敗を確かめる。 */
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
        return { id: f.calls * 100 + i, title: "記事" + f.calls + "-" + i, pv: pvs[i], text: "あいうえお".repeat(Math.ceil(len / 5)).slice(0, len) };   /* 本文の文字数が len */
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
  let frames = 0, soloFrames = 0, secondStop = null, lastX = null, dashSteps = [], lastCam = null, lastLead = null, camJump = 0, confettiMax = 0;
  while (g.probe.now().phase === 'race' && frames < 3000) {
    const st = g.probe.stopped(), p = g.probe.positions();
    const alive = st.filter(v => !v).length;
    if (alive === 1) { soloFrames++; if (secondStop === null) secondStop = frames; }
    const gl = g.probe.goal();
    confettiMax = Math.max(confettiMax, gl.confetti);
    /* カメラは1コマで、いちばん進んだ馬が動いたぶんより大きく動かない（飛ばない） */
    const camNow = g.probe.now().cam;
    const world = [0,1,2,3,4,5,6,7].map(i => g.probe.screenX(i) + camNow);
    if (gl.crossT === null && lastCam !== null) {
      const most = Math.max(0, ...world.map((x, i) => x - lastLead[i]));
      camJump = Math.max(camJump, (camNow - lastCam) - most - 1);
    }
    lastCam = camNow; lastLead = world;
    if (gl.crossT !== null && alive === 1) {                /* ゴール後の1着: 画面の上で1コマごとに同じだけ進む */
      const x = g.probe.screenX(g.probe.now().order[0]);
      if (lastX !== null) dashSteps.push(x - lastX);
      lastX = x;
    }
    const newly = [];
    st.forEach((v, i) => { if (v && !stopSeen.includes(i)) { newly.push(i); stopX[i] = p[i]; } });
    newly.sort((a, b) => stopX[a] - stopX[b]).forEach(i => stopSeen.push(i));   /* 同じコマで止まった馬は、止まった位置の手前から順に */
    if (frames % 60 === 0) cams.push(g.probe.now().cam);
    g.step(1); frames++;
  }
  const orderSeen = stopSeen.slice().reverse();              /* 最後まで走った馬が1着 */
  for (let k = 1; k < orderSeen.length; k++) assert.ok(stopX[orderSeen[k - 1]] > stopX[orderSeen[k]], '長い記事の馬ほど先で止まる: ' + k + '着 ' + JSON.stringify(orderSeen.map(i => [i, g.probe.now().horses[i].len, +stopX[i].toFixed(4)])));
  assert.ok(frames < 3000, '走り終わる');
  assert.equal(g.probe.now().phase, 'finish');
  const dashSteady = dashSteps.length < 2 || dashSteps.every(d => Math.abs(d - dashSteps[0]) < 0.5 && d > 5);
  assert.ok(camJump <= 0, 'カメラが飛ばない: ' + camJump.toFixed(1));
  return { orderSeen, seconds: frames / 60, cams, soloSeconds: soloFrames / 60, secondStop: secondStop / 60, dashSteady, confettiMax };
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
    globalThis.__derbyFake.lens = [5000, 120000, 3000, 8000, 700, 4500, 900, 6000];
    globalThis.__derbyFake.pvs = [3000, 50, 10, 900, 0, 200, 40, 5];
    await start(g);
    const now0 = g.probe.now();
    assert.deepEqual(now0.order, [1, 3, 7, 0, 5, 2, 6, 4], '着順は本文の文字数の多い順');
    assert.deepEqual(now0.horses.map(h => h.len), [5000, 120000, 3000, 8000, 700, 4500, 900, 6000], '文字数');
    const odds = now0.odds;
    assert.equal(now0.popRank[0], 0, 'いちばん読まれている記事が1番人気');
    assert.ok(odds[0] < odds[3] && odds[3] < odds[5] && odds[5] < odds[1] && odds[1] < odds[4], '閲覧数が多いほど倍率が低い: ' + odds);
    assert.ok(odds.every(o => o >= 1.1 && o <= 999.9));
    at(g, g.probe.plus(1)); at(g, g.probe.plus(1));          /* 1着の馬に200 */
    at(g, g.probe.plus(0));                                  /* 1番人気（4着）に100 */
    const rest = g.probe.now().money;
    const r = race(g);
    assert.deepEqual(r.orderSeen, now0.order, '止まった順の逆が長さの順');
    /* 2着（8000字）がちょうど28秒で書き終えて1着が決まる。1着は0.5秒後にゴールを越え、画面の外へ駆け抜けて、0.8秒おいて終わり */
    assert.ok(Math.abs(r.secondStop - 28) < 0.3, '2着が止まるのは約28秒: ' + r.secondStop.toFixed(2));
    const goal = g.probe.goal();
    assert.ok(Math.abs(goal.crossT - r.secondStop - 0.5) < 0.1, '1着がゴールを越えるのは決着の0.5秒後: ' + (goal.crossT - r.secondStop).toFixed(2));
    assert.ok(goal.out > goal.crossT && goal.out - goal.crossT < 0.6, 'ゴールのあと画面の外へ駆け抜ける: ' + (goal.out - goal.crossT).toFixed(2));
    assert.ok(r.soloSeconds > 0.5 && r.soloSeconds < 1.2, '決着から走り去るまで: ' + r.soloSeconds.toFixed(2));
    assert.ok(r.seconds > 30.5 && r.seconds < 33, 'レースはゴールから3秒ほどおいて終わる: ' + r.seconds.toFixed(1));
    assert.ok(r.confettiMax > 100, 'ゴールで紙吹雪');
    assert.ok(r.seconds - goal.crossT >= 3.1, 'ゴールから結果まで間を置く: ' + (r.seconds - goal.crossT).toFixed(2));
    assert.ok(r.dashSteady, 'ゴール後の1着は速さを落とさない');
    assert.ok(g.probe.written(1) < 120000, '1着の馬は書き切らずに終わる');
    for (let i = 0; i < 8; i++) if (i !== 1) assert.equal(g.probe.written(i), now0.horses[i].len, (i + 1) + '番は全部書き切って止まった');
    assert.ok(r.cams[r.cams.length - 1] - r.cams[0] > 2000, 'カメラが馬群を追いかける');
    /* 着順の一覧: 題名を押すとその記事が開くリンク。着順どおりに8本 */
    g.step(30);
    const links = g.probe.links();
    assert.equal(links.length, 8, '着順の一覧に記事のリンクが8本');
    now0.order.forEach((h, r) => assert.ok(links[r].endsWith('curid=' + (100 + h)), (r + 1) + '着の行はその記事: ' + links[r]));
    const H2 = g.probe.now().H, pts = [0,1,2,3,4,5,6,7].map(r => g.probe.titleAt(r)).concat([g.probe.next()]);
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++)
      assert.ok(Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) >= 63, '題名と次へのボタンの間隔');
    assert.ok(g.probe.titleAt(7).y < H2 - 20);
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

  /* 3b. 止まる馬はゆるやかに遅くなる。残りが少なくなると抜きつ抜かれつ */
  {
    const g = open();
    globalThis.__derbyFake.lens = [5000, 120000, 3000, 110000, 700, 4500, 900, 100000];
    await start(g);
    at(g, g.probe.plus(1));
    at(g, g.probe.startButton()); g.step(1);
    g.until(() => g.probe.now().phase === 'race', 400);
    let peak = {}, lastSpeed = {}, battleMax = 0, leaders = new Set();
    for (let fr = 0; fr < 2400 && g.probe.now().phase === 'race'; fr++) {
      const st = g.probe.stopped();
      for (let i = 0; i < 8; i++) {
        if (st[i]) continue;
        const v = g.probe.speed(i);
        peak[i] = Math.max(peak[i] || 0, v);
        lastSpeed[i] = v;
      }
      const alive = st.filter(v => !v).length;
      battleMax = Math.max(battleMax, g.probe.battle());
      if (alive >= 2 && alive <= 3 && g.probe.battle() > 0.8 && fr % 5 === 0) {
        const p = g.probe.positions().map((v, i) => st[i] ? -1 : v);
        leaders.add(p.indexOf(Math.max(...p)));
      }
      g.step(1);
    }
    const winner = g.probe.now().order[0];                  /* 1着は減速せずに駆け抜けるので除く */
    for (let i = 0; i < 8; i++) if (i !== winner) assert.ok(lastSpeed[i] < peak[i] * 0.1, (i + 1) + '番は止まる直前に遅くなる: ' + lastSpeed[i].toFixed(0) + ' / ' + peak[i].toFixed(0));
    assert.ok(battleMax > 0.9, '残り3頭以下で抜きつ抜かれつ');
    assert.ok(leaders.size >= 2, '終盤に先頭が入れ替わる: ' + [...leaders]);
    for (let i = 0; i < 8; i++) if (i !== winner) assert.equal(g.probe.written(i), g.probe.now().horses[i].len, '減速しても全部書き切る');
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
    assert.equal(g.probe.links().length, 0, '一覧を離れたらリンクは消える');
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
