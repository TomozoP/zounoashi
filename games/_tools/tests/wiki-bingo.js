/* Wikipediaビンゴ: 通信の代わりに偽の記事を差し込み、選ぶ・流れる・光る・タップで開ける・次の記事・ビンゴ・通信失敗を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_wiki-bingo/index.html';
const flush = () => new Promise(r => setImmediate(r));

/* 偽のWikipedia。記事の本文は、そのときのカードを見て作る（どの単語を入れるかを決められるように） */
function open(plan, shape) {
  const inject = `
  window.__wikiSource = {
    choices: function () {
      var f = globalThis.__wikiFake; f.calls++;
      if (f.failNext > 0) { f.failNext--; return Promise.reject(new Error("x")); }
      return Promise.resolve([0, 1, 2].map(function (i) { return { id: f.calls * 10 + i, title: "記事" + f.calls + "-" + i }; }));
    },
    text: function (id) { globalThis.__wikiFake.texts++; return Promise.resolve(globalThis.__wikiFake.plan(id, card.slice(), open.slice())); }
  };`;
  globalThis.__wikiFake = { plan: null, calls: 0, texts: 0, failNext: 0 };
  const g = load(file, { quiet: true, inject });
  if (shape) g.view(...shape);
  g.step(2);
  return g;
}
const tapCell = (g, i) => { const p = g.probe.cell(i); g.tap(p.x, p.y); };
const litCount = g => g.probe.now().lit.filter(Boolean).length;
const litCells = g => g.probe.now().lit.map((v, i) => v ? i : -1).filter(i => i >= 0);
/* 光るか、記事が終わるまで進める */
const toNextLight = g => g.until(() => litCount(g) > 0 || g.probe.now().phase !== "stream", 3000);
/* 記事の終わりかビンゴまで、光ったらすぐ開けながら進める */
function playOut(g) {
  for (let k = 0; k < 40; k++) {
    toNextLight(g);
    if (!litCount(g)) break;
    litCells(g).forEach(i => tapCell(g, i));
    if (g.probe.now().phase === "bingo") break;
  }
}
/* 指定したマスの単語が、カードのほかの単語を含まない（1か所で2マス同時に光らない）ように配り直す */
async function cleanCard(g, cells) {
  for (let k = 0; k < 200; k++) {
    const c = g.probe.now().card;
    const bad = cells.some(i => c.some((w, j) => w && j !== i && c[i].includes(w)));
    const joined = cells.map(i => c[i]).join("");
    const cross = c.some((w, j) => w && !cells.includes(j) && joined.includes(w));
    if (!bad && !cross) return c;
    g.esc(); g.step(1); await flush(); g.step(1);
  }
  throw new Error("配り直しても揃わない");
}
async function start(g) {
  assert.equal(g.probe.now().state, 'intro');
  const introCard = g.probe.now().card;
  g.press(' '); g.step(1);
  assert.equal(g.probe.now().state, 'play');
  assert.deepEqual(g.probe.now().card, introCard, 'STARTの前に見えていたカードのまま始まる');
  await flush(); g.step(1);
  assert.equal(g.probe.now().phase, 'choose', '題名が3つ出る');
  assert.equal(g.probe.now().choices.length, 3);
}

(async () => {
  /* 1. カードの作り */
  {
    const g = open();
    const c = g.probe.now().card;
    assert.equal(c.length, 25);
    assert.equal(c[12], null, '真ん中は空き');
    assert.equal(new Set(c.filter(Boolean)).size, 24, '単語は重ならない');
    assert.ok(g.probe.now().open[12], "真ん中は最初から開いている");
    for (let n = 0; n < 200; n++) {
      g.esc(); g.step(1);
      const gs = g.probe.now().genres.filter(x => x != null);
      assert.equal(gs.length, 24);
      assert.equal(gs.filter(x => x === -1).length, 4, "どの記事にも出やすい言葉は4つ");
      const count = {};
      gs.filter(x => x >= 0).forEach(x => count[x] = (count[x] || 0) + 1);
      assert.deepEqual(Object.values(count), [5, 5, 5, 5], "4分野から5語ずつ");
      assert.equal(new Set(g.probe.now().card.filter(Boolean)).size, 24);
    }
  }

  /* 1b. 1本で流すのは冒頭1200字まで。1本で3つ以上開けたら大当たり、数は記事ごと */
  {
    const g = open();
    await start(g);
    const c = await cleanCard(g, [0, 1, 2, 5]);
    let n = 0;
    setPlan(g, () => (++n === 1 ? "あ" + c[0] + "い" + c[1] + "う" + c[2] + "。" + "え".repeat(3000) : "お" + c[5] + "。"));
    g.press(" "); await flush(); g.step(1);
    assert.ok(g.probe.now().length <= 1200, "冒頭だけ: " + g.probe.now().length);
    playOut(g);
    assert.equal(g.probe.now().combo, 3);
    assert.equal(g.probe.now().jackpot, true, "3つ開けた記事は大当たり");
    g.until(() => g.probe.now().phase === "choose", 400); await flush(); g.step(1);
    g.press(" "); await flush(); g.step(1);
    playOut(g);
    assert.equal(g.probe.now().combo, 1, "次の記事では数え直す");
  }

  /* 2. 出た単語のところで本文が止まって光る。開けると続きが流れる */
  {
    const g = open();
    await start(g);
    const c = await cleanCard(g, [10, 11, 13, 14]);
    const row = [10, 11, 13, 14].map(i => c[i]);            /* 真ん中の段 */
    const filler = "ああああああああああ";
    const body = filler + row.join("いいい") + filler.repeat(20);
    setPlan(g, () => body);
    g.tap(g.probe.choice(1).x, g.probe.choice(1).y);
    await flush(); g.step(1);
    assert.equal(g.probe.now().phase, "stream");
    assert.ok(/-1$/.test(g.probe.now().title), "選んだ記事（2つ目）が流れる");
    let end = filler.length;
    [10, 11, 13, 14].forEach((cell, k) => {
      end += c[cell].length + (k ? 3 : 0);
      toNextLight(g);
      assert.deepEqual(litCells(g), [cell], (k + 1) + "つ目の単語で光る");
      assert.equal(g.probe.now().pos, end, "単語の終わりで止まる");
      g.step(90);
      g.down(270, g.probe.choice(1).y); g.step(30); g.up();
      assert.equal(g.probe.now().pos, end, "光っている間は、押しても本文は進まない");
      assert.equal(g.probe.now().open[cell], false, "勝手には開かない");
      if (k === 0) { tapCell(g, 0); assert.equal(g.probe.now().open[0], false, "光っていないマスは開かない"); }
      tapCell(g, cell);
      assert.ok(g.probe.now().open[cell], "タップで開く");
      if (k < 2) assert.deepEqual(g.probe.now().waiting, [], "3つまではリーチでない");
      if (k === 2) {
        assert.deepEqual(g.probe.now().waiting, [14], "真ん中を入れて4つでリーチ。待ちは残りの1マス");
        assert.equal(g.probe.now().reaches, 1, "リーチの演出が1回");
        tapCell(g, 0); assert.equal(g.probe.now().reaches, 1);
      }
      if (k < 3) { g.step(2); assert.ok(g.probe.now().pos > end, "開けると続きが流れる"); }
    });
    const now = g.probe.now();
    assert.equal(now.phase, "bingo");
    assert.deepEqual(now.bingo, [10, 11, 12, 13, 14]);
    assert.equal(now.score, 1, "結果は選んだ記事の本数（1本でビンゴ）");
    g.until(() => g.probe.now().state === "result", 400);
    assert.equal(g.probe.now().score, 1);
  }

  /* 2b. 続けて出る単語は1つずつ止まって光る。スペースでも開けられる */
  {
    const g = open();
    await start(g);
    const c = await cleanCard(g, [0,1]);
    setPlan(g, () => "あ" + c[0] + c[1] + "いいいいいいいいいい");
    g.press(" "); await flush(); g.step(1);
    toNextLight(g);
    assert.deepEqual(litCells(g), [0]);
    tapCell(g, 0);
    toNextLight(g);
    assert.deepEqual(litCells(g), [1]);
    g.press(" ");
    assert.ok(g.probe.now().open[1], "スペースでも開けられる");
  }

  /* 3. 1本で揃わない → 次の3つが出る。穴は記事をまたいで積み上がり、結果は本数 */
  {
    const g = open();
    await start(g);
    const c = await cleanCard(g, [0,1,2,3,4]);
    let n = 0;
    const t1 = "あ" + c[0] + "あ" + c[1] + "あ", t2 = c[2] + "う" + c[3] + "う" + c[4];
    setPlan(g, () => (++n === 1 ? t1 : t2));
    g.press(" "); await flush(); g.step(1);
    playOut(g);
    g.until(() => g.probe.now().phase === "choose", 200);
    await flush(); g.step(1);
    assert.equal(g.probe.now().phase, "choose", "次の題名");
    assert.ok(g.probe.now().open[0] && g.probe.now().open[1], "前の記事で開けた穴は残る");
    g.press("ArrowDown"); g.press("ArrowDown");
    assert.equal(g.probe.now().pick, 2, "矢印で選ぶ");
    g.press(" "); await flush(); g.step(1);
    assert.ok(/-2$/.test(g.probe.now().title));
    playOut(g);
    assert.equal(g.probe.now().phase, "bingo");
    assert.deepEqual(g.probe.now().bingo, [0, 1, 2, 3, 4]);
    assert.equal(g.probe.now().score, 2, "2本目でビンゴなら2");
    assert.equal(g.probe.now().articles, 2);
    g.until(() => g.probe.now().state === "result", 400);
    const list = g.probe.list();
    assert.equal(list.length, 2);
    assert.ok(/-0$/.test(list[0].title) && /-2$/.test(list[1].title), "結果に読んだ記事が順に並ぶ（1本目は1つ目、2本目は3つ目を選んだ）");
    assert.deepEqual(list.map(r => r.last), [false, true], "ビンゴした記事に印");
    const links = g.probe.links();
    assert.equal(links.length, 2);
    assert.ok(/^https:\/\/ja\.wikipedia\.org\/\?curid=\d*0$/.test(links[0]) && /curid=\d*2$/.test(links[1]), "押すとその記事が開くリンク: " + links);
    const btn = g.probe.result();
    assert.ok(list[0].y - btn.retry.y >= 63 && list[1].y - list[0].y >= 63, "ボタンと記事の行の間隔");
    g.tap(270, list[0].y); g.step(1);
    assert.equal(g.probe.now().state, "result", "記事の行を押しても最初からにはならない");
  }

  /* 4. 押している間は速く流れる */
  {
    const g = open();
    await start(g);
    setPlan(g, () => 'あ'.repeat(2000));
    g.press(' '); await flush(); g.step(1);
    g.step(60); const slow = g.probe.now().pos;
    g.down(270, g.probe.choice(1).y); g.step(60); g.up();   /* 本文の枠を押す（カードを押すと開けるほうになる） */
    const fast = g.probe.now().pos - slow;
    assert.ok(slow > 35 && slow < 55, '1秒でふつう45文字ほど: ' + slow);
    assert.ok(fast > slow * 3, '押している間は速い: ' + fast);
  }

  /* 5. 通信の失敗 → 押し直すと取り直す */
  {
    const g = open();
    globalThis.__wikiFake.failNext = 1;
    g.press(' '); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'error', '失敗したら止まる');
    g.step(120);
    assert.equal(g.probe.now().phase, 'error', '勝手に進まない');
    const r = g.probe.retryButton();
    g.tap(r.x, r.y); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'choose', '押し直すと取れる');
  }

  /* 6. 結果からもう一度 → 新しいカードで最初から。Escでも最初から */
  {
    const g = open();
    await start(g);
    const c = await cleanCard(g, [0,6,18,24]);
    setPlan(g, () => [0, 6, 18, 24].map(i => c[i]).join('。'));
    g.press(' '); await flush(); g.step(1);
    playOut(g);
    g.until(() => g.probe.now().state === "result", 3000);
    assert.equal(g.probe.list().length, 1);
    const b = g.probe.result().retry;
    g.tap(b.x, b.y); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.links().length, 0, "遊び始めたら記事のリンクは消える");
    assert.equal(g.probe.now().state, 'play');
    assert.equal(g.probe.now().score, 0);
    assert.equal(g.probe.now().open.filter(Boolean).length, 1);
    assert.equal(g.probe.now().phase, 'choose');
    g.esc(); g.step(1); await flush(); g.step(1);
    assert.equal(g.probe.now().phase, 'choose');
    assert.equal(g.probe.now().articles, 0);
  }

  /* 7. 押しどころ（題名3つ）の間隔と、画面に収まるか */
  for (const shape of load.SHAPES) {
    const g = open(null, shape);
    await start(g);
    const H = g.probe.now().H;
    const ys = [0, 1, 2].map(i => g.probe.choice(i).y);
    assert.ok(ys[1] - ys[0] >= 63 && ys[2] - ys[1] >= 63, shape.join('x') + ' 題名の間隔 ' + (ys[1] - ys[0]));
    assert.ok(g.probe.cell(24).y + 40 < H - 20, shape.join('x') + ' カードが画面に収まる');
  }

  console.log('ok wiki-bingo');
})().catch(e => { console.error(e); process.exit(1); });

function setPlan(g, f) { globalThis.__wikiFake.plan = f; }
