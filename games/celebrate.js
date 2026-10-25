/* お祝いの共通部品：自作のファンファーレと紙吹雪。
   節はすべて自作。既存曲（FF・ドラクエ・マリオ・ゼルダなど）のリズムや音の並びはなぞらない。
   新しい節を足すときも「同じ音の連打→長音」の形は使わない。

   音:   zCelebrate.play(AudioContext, "fanfare", {volume: 1, delay: 0, dest: 出力先})  → 鳴る長さ(秒)
         種類: "fanfare"(全クリア・大勝利)  "clear"(ステージクリア)  "levelup"(レベルアップ)  "chime"(小さな成功)
   紙吹雪: var c = zCelebrate.confetti();  c.burst(W, H, 160);  毎フレーム c.step(dt, W, H); c.draw(ctx);
         c.burst(W, H, n, {x, y}) で一点から噴き出す。 c.rain = false で画面下に落ちたら消える(既定は降り続ける)。 c.clear() で消す。 */
(function () {
  "use strict";
  /* [周波数, 開始(秒), 長さ(秒)] */
  var SONGS = {
    /* 駆け上がって、ひと跳ねしてから和音で伸ばす */
    fanfare: { notes: [[392, 0, 0.09], [523, 0.09, 0.09], [659, 0.18, 0.09], [784, 0.27, 0.22], [880, 0.52, 0.09], [784, 0.62, 0.09], [988, 0.72, 0.22], [1047, 0.98, 1.0]],
      chord: [[523, 659, 784], 0.98, 1.0], bass: true },
    /* 下がって上がる短い節。最後は5度上に抜ける */
    clear: { notes: [[784, 0, 0.1], [659, 0.1, 0.1], [698, 0.2, 0.1], [880, 0.3, 0.16], [1047, 0.5, 0.5]],
      chord: [[523, 784], 0.5, 0.5], bass: true },
    /* 五音の素早い駆け上がり＋きらめき */
    levelup: { notes: [[523, 0, 0.07], [587, 0.06, 0.07], [659, 0.12, 0.07], [784, 0.18, 0.07], [880, 0.24, 0.07], [1047, 0.3, 0.07], [1319, 0.38, 0.45]],
      chord: null, sparkle: 0.38 },
    /* 2音の小さな成功音 */
    chime: { notes: [[988, 0, 0.08], [1480, 0.07, 0.35]], chord: null }
  };

  function tone(ac, dest, f, t0, dur, vol, type) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function play(ac, kind, opt) {
    var s = SONGS[kind];
    if (!ac || !s) return 0;
    opt = opt || {};
    var v = opt.volume == null ? 1 : opt.volume, dest = opt.dest || ac.destination;
    var t = ac.currentTime + (opt.delay || 0), end = 0;
    s.notes.forEach(function (n) {
      tone(ac, dest, n[0], t + n[1], n[2] + 0.06, 0.11 * v, "triangle");
      if (s.bass) tone(ac, dest, n[0] / 2, t + n[1], n[2] + 0.06, 0.05 * v, "square");
      end = Math.max(end, n[1] + n[2]);
    });
    if (s.chord) s.chord[0].forEach(function (f) { tone(ac, dest, f, t + s.chord[1], s.chord[2], 0.05 * v, "triangle"); });
    if (s.sparkle != null) [2093, 2637, 3136].forEach(function (f, i) { tone(ac, dest, f, t + s.sparkle + i * 0.05, 0.25, 0.025 * v, "sine"); });
    return end + 0.1;
  }

  var COLORS = ["#ff4d4d", "#ffd23f", "#3fa7ff", "#5ee07a", "#ff7ad9", "#ffffff", "#ff9a3c"];

  function confetti() {
    var bits = [];
    var c = {
      rain: true,
      colors: COLORS,
      get count() { return bits.length; },
      burst: function (W, H, n, at) {
        n = n || 160;
        for (var i = 0; i < n; i++) {
          var b = { r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, flip: Math.random() * 6, vf: 9 + Math.random() * 10, fall: 240 + Math.random() * 160,
            size: 0.8 + Math.random() * 0.5, col: c.colors[i % c.colors.length] };
          if (at) {
            var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 600 + Math.random() * 700;
            b.x = at.x; b.y = at.y; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
          } else {
            b.x = Math.random() * W; b.y = -Math.random() * H * 0.8 - 20; b.vx = (Math.random() - 0.5) * 80; b.vy = b.fall;
          }
          bits.push(b);
        }
      },
      step: function (dt, W, H) {
        for (var i = bits.length - 1; i >= 0; i--) {
          var b = bits[i];
          /* 噴き出した分は空気で減速して、ふつうの落ち方に落ち着く */
          b.vx += (0 - b.vx) * Math.min(1, dt * 3);
          b.vy += (b.fall - b.vy) * Math.min(1, dt * 3);
          b.x += (b.vx + Math.sin(b.flip * 0.5) * 50) * dt; b.y += b.vy * dt;
          b.r += b.vr * dt; b.flip += b.vf * dt;
          if (b.y > H + 20) {
            if (c.rain) { b.y = -20; b.x = Math.random() * W; } else bits.splice(i, 1);
          }
        }
      },
      draw: function (ctx) {
        bits.forEach(function (b) {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
          ctx.scale(b.size, Math.cos(b.flip) * b.size); ctx.fillStyle = b.col; ctx.fillRect(-6, -3.5, 12, 7);
          ctx.restore();
        });
      },
      clear: function () { bits.length = 0; }
    };
    return c;
  }

  window.zCelebrate = { play: play, confetti: confetti, kinds: Object.keys(SONGS) };
})();
