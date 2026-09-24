/* 母音合成の声。録音やOSの読み上げ音声は使わない。
   ノコギリ波を「あいうえお」の響き（3つの帯域）に通して母音を作り、子音は短いノイズで足す。
   一輪車で鍋の「ごちそうさまでした」、同時球技5種の掛け声、偏県の偏見ロボが使う。

   window.zVoice.speak(ac, at, pitch, words, opts) … 声を鳴らす。終わる時刻と止める関数を返す
     words: [子音, 母音, 秒] の並び。例 [["g","o",0.13], ["ch","i",0.12]]
            子音 "s" "sh" "ch" "g" "d" "t" "p" "b" "k" "m" "n" "h" "z" "j"（それ以外は子音なし）
            母音 "a" "i" "u" "e" "o"、"n" は「ん」、"" は間（声を止める）
     opts.out    つなぐ先（省略時は ac.destination）
     opts.volume 音量（省略時 0.34）
     opts.noise  子音に使うノイズのバッファ（省略時はここで作る）
   window.zVoice.kana(yomi, mora) … ひらがな・カタカナの読みを words にする。mora は1拍の秒数 */
(function (global) {
  "use strict";

  var VOWELS = { a: [800, 1200, 2600], i: [300, 2300, 3000], u: [350, 1300, 2400], e: [500, 1900, 2600], o: [500, 850, 2500], n: [250, 1000, 2200] };

  var noiseBufs = [];
  function noiseOf(ac) {
    for (var i = 0; i < noiseBufs.length; i++) if (noiseBufs[i].ac === ac) return noiseBufs[i].buf;
    var len = Math.floor(ac.sampleRate * 0.5), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var k = 0; k < len; k++) d[k] = Math.random() * 2 - 1;
    noiseBufs.push({ ac: ac, buf: buf });
    return buf;
  }

  function speak(ac, at, pitch, words, opts) {
    opts = opts || {};
    var t = at, f0 = pitch || 300, noise = opts.noise || noiseOf(ac);
    var out = ac.createGain();
    out.gain.value = opts.volume == null ? 0.34 : opts.volume;
    out.connect(opts.out || ac.destination);
    var o = ac.createOscillator(), env = ac.createGain();
    o.type = "sawtooth";
    env.gain.value = 0.0001;
    o.connect(env);
    var bands = [0, 1, 2].map(function (k) {
      var b = ac.createBiquadFilter(), g = ac.createGain();
      b.type = "bandpass"; b.Q.value = [5, 6, 8][k]; g.gain.value = [2.2, 1.4, 0.6][k];
      env.connect(b); b.connect(g); g.connect(out);
      return b;
    });
    function hiss(t0, dur, freq, q, vol) {
      var n = ac.createBufferSource(), b = ac.createBiquadFilter(), g = ac.createGain();
      n.buffer = noise; b.type = "bandpass"; b.frequency.value = freq; b.Q.value = q;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      n.connect(b); b.connect(g); g.connect(out);
      n.start(t0); n.stop(t0 + dur + 0.02);
    }
    var total = 0;
    words.forEach(function (w) { total += w[2]; });
    var start = t;
    words.forEach(function (w, i) {
      var c = w[0], vw = VOWELS[w[1]], dur = w[2];
      var k = (t - start) / total;
      var p = f0 * (1.12 - 0.3 * k);                 /* 少しずつ下がる */
      o.frequency.setTargetAtTime(p, t, 0.02);
      /* 間：声を止めて進める */
      if (!vw) {
        env.gain.setTargetAtTime(0.0001, t, 0.015);
        t += dur;
        return;
      }
      /* 子音 */
      var cl = 0;
      if (c === "s" || c === "sh" || c === "ch") {
        cl = c === "ch" ? 0.05 : 0.07;
        env.gain.setTargetAtTime(0.0001, t, 0.008);
        if (c === "ch") hiss(t, 0.012, 3000, 0.8, 0.5);
        hiss(t, cl, c === "s" ? 6500 : 3400, c === "s" ? 2 : 1.5, 0.55);
      } else if (c === "g" || c === "d" || c === "t" || c === "p" || c === "b" || c === "k") {
        cl = 0.03;
        env.gain.setTargetAtTime(0.0001, t, 0.005);
        hiss(t + 0.015, 0.02, (c === "p" || c === "b") ? 700 : c === "g" ? 1500 : 3500, 0.8, c === "t" ? 0.5 : 0.3);
      } else if (c === "m" || c === "n") {
        cl = 0.05;
        /* 口を閉じて鼻に抜ける：低い響きだけにする */
        env.gain.setTargetAtTime(0.35, t, 0.01);
        bands[0].frequency.setTargetAtTime(250, t, 0.01);
        bands[1].frequency.setTargetAtTime(c === "n" ? 1400 : 1000, t, 0.01);
        bands[2].frequency.setTargetAtTime(2200, t, 0.01);
      } else if (c === "h") {
        cl = 0.05;
        env.gain.setTargetAtTime(0.0001, t, 0.008);
        hiss(t, cl, 1800, 0.6, 0.35);
      } else if (c === "z" || c === "j") {
        cl = 0.05;
        env.gain.setTargetAtTime(0.2, t, 0.008);
        hiss(t, cl, c === "z" ? 5500 : 3200, 1.5, 0.35);
      }
      /* 母音。「し」の i は声を小さく（ささやくように抜ける）。「ん」は鼻に抜けて小さい */
      var tv = t + cl, loud = c === "sh" ? 0.25 : w[1] === "n" ? 0.4 : 0.9;
      bands.forEach(function (b, j) { b.frequency.setTargetAtTime(vw[j], tv, 0.015); });
      env.gain.setTargetAtTime(loud, tv, 0.012);
      t += dur;
      if (i === words.length - 1) env.gain.setTargetAtTime(0.0001, t - 0.06, 0.03);
    });
    o.start(start); o.stop(t + 0.2);
    return {
      end: t,
      /* 途中で止める（次の文に切り替えるときなど） */
      stop: function () {
        var n = ac.currentTime;
        try {
          out.gain.cancelScheduledValues(n);
          out.gain.setTargetAtTime(0.0001, n, 0.02);
          o.stop(n + 0.12);
        } catch (e) {}
      }
    };
  }

  /* かな → [子音, 母音] */
  var ROWS = {
    "": "あいうえお", k: "かきくけこ", s: "さしすせそ", t: "たちつてと", n: "なにぬねの", h: "はひふへほ",
    m: "まみむめも", y: "や ゆ よ", r: "らりるれろ", w: "わ   を", g: "がぎぐげご", z: "ざじずぜぞ",
    d: "だぢづでど", b: "ばびぶべぼ", p: "ぱぴぷぺぽ"
  };
  var TABLE = {};
  Object.keys(ROWS).forEach(function (c) {
    for (var i = 0; i < 5; i++) if (ROWS[c][i] !== " ") TABLE[ROWS[c][i]] = [c, "aiueo"[i]];
  });
  /* 音の近いものに寄せる（子音の作り分けは大まか） */
  TABLE["し"] = ["sh", "i"]; TABLE["ち"] = ["ch", "i"]; TABLE["つ"] = ["ch", "u"];
  TABLE["じ"] = ["j", "i"]; TABLE["ぢ"] = ["j", "i"]; TABLE["づ"] = ["z", "u"]; TABLE["ふ"] = ["h", "u"];
  TABLE["ゐ"] = ["", "i"]; TABLE["ゑ"] = ["", "e"];
  var SMALL = { "ゃ": "a", "ゅ": "u", "ょ": "o", "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o" };

  function kana(yomi, mora) {
    var d = mora || 0.13, words = [];
    var s = String(yomi).replace(/[ァ-ヶ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], last = words[words.length - 1];
      if (TABLE[ch]) {
        var cv = TABLE[ch].slice();
        /* 「きゃ」「しょ」のような小さい字は、母音を差し替える */
        if (SMALL[s[i + 1]]) { cv[1] = SMALL[s[i + 1]]; i++; }
        words.push([cv[0], cv[1], d]);
      } else if (ch === "ん") words.push(["", "n", d]);
      else if (ch === "ー" && last && last[1]) last[2] += d;            /* のばす */
      else if (ch === "っ") words.push(["", "", d * 0.8]);             /* つまる */
      else if (/[、，,]/.test(ch)) words.push(["", "", d * 2]);         /* ひと息 */
      else if (/[。！？!?]/.test(ch)) words.push(["", "", d * 3]);
      /* かぎかっこや空白は読まない */
    }
    return words;
  }

  global.zVoice = { speak: speak, kana: kana };
})(window);
