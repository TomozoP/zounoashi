/* ジョイパッドを、キー入力に変えて配る。

     <script src="../pad.js"></script>

   これを1行置くだけで、どのゲームでも使えます。
   ゲーム側に足すものはありません。

   ■ なにをするか

     どのボタンでも        → スペース（押した／離した、両方）
     十字キー・左スティック → ← → ↑ ↓

   このサイトのゲームは「スペース＝決定・進む、矢印＝向き」で揃えてあるので、
   キーに化けさせれば、そのまま遊べます。Esc（やり直し）は**出しません**。
   手が滑って最初からになるのを防ぐためです。

   ■ なぜ要るか

   ゲームは枠（iframe）の中にいるので、枠をクリックしていないと自分では
   ジョイパッドを読めません。そこでサイト側が読んで枠へ送ってきます。
   ここはその便りを受けます（自分で読めるときは自分で読みます）。

   ■ 絵の外（黒い余白）のタップは、拾いません

   一度そうしてみましたが、ボタンでないところを押して何か起きるのは
   おかしい、ということでやめました。触るのは絵の中だけです。 */

(function () {
  "use strict";

  /* 押しているもの。変わり目だけをキーにする */
  var want = { press: false, x: 0, y: 0 };
  var have = { press: false, x: 0, y: 0 };
  var seen = 0;                                /* 便りが何コマ来ていないか */

  /* ---------------- キーを配る ----------------
     document に投げると、上へ伝わって window で聞いている人にも届く */
  function send(kind, key, code) {
    document.dispatchEvent(new KeyboardEvent(kind, {
      key: key, code: code || "", bubbles: true, cancelable: true, repeat: false
    }));
  }

  function typing() {                          /* 打ち込み中は邪魔しない */
    var a = document.activeElement;
    if (!a) return false;
    var t = (a.tagName || "").toLowerCase();
    return t === "input" || t === "textarea" || t === "select" || a.isContentEditable;
  }

  /* ---------------- ジョイパッド ---------------- */
  function readPads(pads) {
    var press = false, x = 0, y = 0, i, b, p, v;
    for (i = 0; i < pads.length; i++) {
      p = pads[i];
      if (!p || !p.buttons) continue;
      for (b = 0; b < p.buttons.length && b < 10; b++) {
        v = p.buttons[b];
        if (v && (v.pressed || v.value > 0.5)) press = true;
      }
      if (p.buttons[12] && p.buttons[12].pressed) y = -1;      /* 十字 上 */
      if (p.buttons[13] && p.buttons[13].pressed) y = 1;       /*      下 */
      if (p.buttons[14] && p.buttons[14].pressed) x = -1;      /*      左 */
      if (p.buttons[15] && p.buttons[15].pressed) x = 1;       /*      右 */
      if (p.axes) {                                            /* 左スティック */
        if (p.axes[0] < -0.5) x = -1;
        if (p.axes[0] > 0.5) x = 1;
        if (p.axes[1] < -0.5) y = -1;
        if (p.axes[1] > 0.5) y = 1;
      }
    }
    want.press = press; want.x = x; want.y = y;
    seen = 0;
  }

  /* 矢印キーは key と code が同じ綴り */
  var DIRX = { "-1": "ArrowLeft", "1": "ArrowRight" };
  var DIRY = { "-1": "ArrowUp", "1": "ArrowDown" };

  function turn(was, now, table) {
    if (was === now) return;
    if (table[was]) send("keyup", table[was], table[was]);
    if (table[now]) send("keydown", table[now], table[now]);
  }

  function poll() {
    var nav = window.navigator, list, any = false, i;
    if (nav && nav.getGamepads) {
      list = nav.getGamepads() || [];
      for (i = 0; i < list.length; i++) if (list[i]) any = true;
      if (any) readPads(list);                 /* 自分で読めたときは自分で読む */
    }
    if (++seen > 20) { want.press = false; want.x = 0; want.y = 0; }   /* 便りが途切れたら離す */

    if (!typing()) {
      if (want.press && !have.press) send("keydown", " ", "Space");
      if (!want.press && have.press) send("keyup", " ", "Space");
      turn(have.x, want.x, DIRX);
      turn(have.y, want.y, DIRY);
    }
    have.press = want.press; have.x = want.x; have.y = want.y;
    requestAnimationFrame(poll);
  }

  /* サイト側（親ページ）から届くジョイパッドの状態 */
  window.addEventListener("message", function (e) {
    var d = e && e.data;
    if (!d || d.z !== "pad" || !d.pads) return;
    readPads(d.pads);
  });

  requestAnimationFrame(poll);
})();
