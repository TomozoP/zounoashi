/* 30の答えから、そのまま見た目をひと組つくる。
   軸ひとつが見た目のどこかひとつに対応していて、全部で 1,610,612,736 通り。

     zAvatar(answers)       →  SVGの文字列
     zAvatarEdge(answers)   →  カードの枠に使う色（その人の服の色）

   ぜんぶ塗りだけで描く（線画にしない）。パーツは重ねる順に並べてある。 */
(function (global) {
  "use strict";

  var SKIN  = "#f5cd52";   /* 肌はぜんぶこの黄色 */

  /* 背景。朝は明るく、夜は深く。それぞれ6色 */
  var BG_DAY   = ["#ffc2cf", "#ffdc9a", "#a9e6c0", "#a3cdfa", "#d2bcff", "#ffc0a0"];
  var BG_NIGHT = ["#5a2f3c", "#4a3a24", "#1f4a44", "#26365e", "#3b3059", "#4d2f2f"];
  var LINE  = "#2c3040";

  /* 色を明るく/暗くする。amt は -1〜1 */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(v) {
      var x = amt > 0 ? v + (255 - v) * amt : v * (1 + amt);
      return Math.max(0, Math.min(255, Math.round(x)));
    }
    return "#" + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  function hsl2hex(h, sa, li) {
    h = (((h % 360) + 360) % 360) / 360;
    var q = li < 0.5 ? li * (1 + sa) : li + sa - li * sa;
    var pp = 2 * li - q;
    function f(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return pp + (q - pp) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
      return pp;
    }
    return "#" + ((1 << 24) +
      (Math.round(f(h + 1 / 3) * 255) << 16) +
      (Math.round(f(h) * 255) << 8) +
      Math.round(f(h - 1 / 3) * 255)).toString(16).slice(1);
  }

  /* 服の色。30の答えぜんぶを混ぜて色相を決めるので、答えが1つ違えば色も変わる。
     肌の黄色と重なる帯だけは暗く落として、キャラが沈まないようにしている */
  function mainHue(a) {
    var h = 2166136261;
    for (var i = 0; i < 30; i++) {
      h ^= (a[i] + 1) * (i * 31 + 7);
      h = (h * 16777619) >>> 0;
    }
    return h % 360;
  }

  function clothColor(a) {
    var deg = mainHue(a);
    return hsl2hex(deg, 0.62, (deg > 26 && deg < 72) ? 0.37 : 0.48);
  }

  function el(name, attrs, inner) {
    var s = "<" + name;
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) s += " " + k + '="' + attrs[k] + '"';
    return inner === undefined ? s + "/>" : s + ">" + inner + "</" + name + ">";
  }

  function limb(x1, y1, x2, y2, color, w) {
    return el("path", {
      d: "M" + x1 + " " + y1 + " L" + x2 + " " + y2,
      stroke: color, "stroke-width": w, "stroke-linecap": "round", fill: "none"
    });
  }

  function arc(x1, y1, qx, qy, x2, y2, color, w) {
    return el("path", {
      d: "M" + x1 + " " + y1 + " Q" + qx + " " + qy + " " + x2 + " " + y2,
      stroke: color, "stroke-width": w, "stroke-linecap": "round", fill: "none"
    });
  }

  /* 30の軸 → 見た目のパラメータ */
  function traits(a) {
    return {
      pose:   a[0],  head:   a[1],  eyeA:   a[2],  fit:    a[3],  brow:  a[4],
      build:  a[5],  mouth:  a[6],  bgSize: a[7],  eyeB:   a[8],  bgTone:a[9],
      hairVol:a[10], tilt:   a[11], blush:  a[12], prop:   a[13], stance:a[14],
      stripe: a[15], shoe:   a[16], bgC:    a[17], glass:  a[18], collar:a[19],
      hue:    a[20], hat:    a[21], bgMix:  a[22], shoulder:a[23], hair: a[24],
      eyeC:   a[25], belt:   a[26], bgGrad: a[27], hem:    a[28], accent:a[29]
    };
  }

  /* 目は8種類。3つの軸の組み合わせで決まる */
  function eyePart(kind, ex, s) {
    switch (kind) {
      case 0:   /* まる目 */
        return el("circle", { cx: ex, cy: 96, r: 6.4, fill: LINE }) +
               el("circle", { cx: ex + 2, cy: 94, r: 2.1, fill: "#ffffff" });
      case 1:   /* 線の目 */
        return limb(ex - 8, 97, ex + 8, 97, LINE, 3.4);
      case 2:   /* 笑った目 */
        return arc(ex - 8, 100, ex, 89, ex + 8, 100, LINE, 3.4);
      case 3:   /* 点の目 */
        return el("circle", { cx: ex, cy: 96, r: 3.6, fill: LINE });
      case 4:   /* たれ目 */
        return el("ellipse", { cx: ex, cy: 96, rx: 6.6, ry: 5.4, fill: LINE,
                               transform: "rotate(" + (s * 16) + " " + ex + " 96)" });
      case 5:   /* つり目 */
        return el("ellipse", { cx: ex, cy: 96, rx: 6.6, ry: 5.4, fill: LINE,
                               transform: "rotate(" + (-s * 16) + " " + ex + " 96)" });
      case 6:   /* 大きい目 */
        return el("ellipse", { cx: ex, cy: 96, rx: 8, ry: 9, fill: "#ffffff" }) +
               el("circle", { cx: ex + s * 1.6, cy: 96.5, r: 4.6, fill: LINE });
      default:  /* 片目をつぶる */
        return s < 0 ? arc(ex - 8, 100, ex, 92, ex + 8, 100, LINE, 3.4)
                     : el("circle", { cx: ex, cy: 96, r: 6.4, fill: LINE }) +
                       el("circle", { cx: ex + 2, cy: 94, r: 2.1, fill: "#ffffff" });
    }
  }

  /* 背景の模様は5種類。「左の答え」をいくつ選んだかで決まる */
  function pattern(pid, kind, ink) {
    var body;
    if (kind === 0) body = el("circle", { cx: 13, cy: 13, r: 4.2, fill: ink });
    else if (kind === 1) body = el("path", { d: "M-6 32 L32 -6 M-6 6 L6 -6 M20 32 L32 20",
                                             stroke: ink, "stroke-width": 5, fill: "none" });
    else if (kind === 2) body = el("path", { d: "M0 0 H26 M0 0 V26",
                                             stroke: ink, "stroke-width": 3, fill: "none" });
    else if (kind === 3) body = el("path", { d: "M0 13 Q6.5 4 13 13 T26 13",
                                             stroke: ink, "stroke-width": 3, fill: "none" });
    else body = el("circle", { cx: 13, cy: 13, r: 9, fill: "none", stroke: ink, "stroke-width": 3 });
    return el("pattern", { id: pid, width: 26, height: 26, patternUnits: "userSpaceOnUse" }, body);
  }

  global.zAvatarEdge = clothColor;

  global.zAvatar = function (a) {
    var t = traits(a);

    var skin   = SKIN;
    var skinD  = shade(skin, -0.12);
    var hair   = hsl2hex(mainHue(a), t.hue ? 0.48 : 0.20, t.hair ? 0.30 : 0.16);
    var cloth  = clothColor(a);
    var clothD = shade(cloth, -0.24);

    /* 背景は 12色 × 流れ方4通り × 丸の大小 × 模様5種 */
    var pal    = t.bgTone ? BG_NIGHT : BG_DAY;
    var bi     = t.accent * 2 + t.bgC;
    var bg     = pal[bi];
    var mix    = t.bgGrad * 2 + t.bgMix;
    var diag   = mix > 1;
    var bg2    = mix === 0 ? shade(bg, 0.38)
               : mix === 1 ? shade(bg, -0.36)
               : mix === 2 ? pal[(bi + 1) % 6]
                           : pal[(bi + 3) % 6];

    var left = 0;
    for (var i = 0; i < 30; i++) if (a[i] === 0) left++;
    var pat = left % 5;

    var uid = Math.random().toString(36).slice(2, 8);
    var gid = "g" + uid, pid = "p" + uid, hid = "h" + uid;

    var cx = 120;
    var W = 240, H = 204;        // カードの絵の部分。だいたい 1 : 0.85
    var bgOut = [], out = [];

    /* ---- 背景 ---- */
    bgOut.push("<defs>" +
      el("linearGradient", { id: gid, x1: 0, y1: 0, x2: diag ? 1 : 0, y2: 1 },
        el("stop", { offset: 0, "stop-color": bg }) + el("stop", { offset: 1, "stop-color": bg2 })) +
      pattern(pid, pat, t.bgTone ? "#ffffff" : "#2c3040") +
      "</defs>");
    bgOut.push(el("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#" + gid + ")" }));
    bgOut.push(el("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#" + pid + ")",
                            opacity: t.bgTone ? "0.13" : "0.08" }));
    bgOut.push(el("circle", {
      cx: cx, cy: 98, r: t.bgSize ? 98 : 70,
      fill: "#ffffff", opacity: t.bgTone ? "0.09" : "0.28"
    }));

    /* ---- 体まわりの寸法 ---- */
    var bodyW = t.build ? 84 : 66;                       // 胴の太さ
    var shW   = bodyW + (t.shoulder ? 12 : -4);          // 肩幅
    var hemY  = t.hem ? 240 : 226;                       // 服の丈
    var hemW  = t.fit ? shW : shW + 20;                  // 裾の広がり
    var legX  = t.stance ? 17 : 9;
    var footY = 282;

    /* ---- 脚（ズボン → 素足 → 靴） ---- */
    [-1, 1].forEach(function (s) {
      var x = cx + s * legX;
      out.push(el("rect", { x: x - 7, y: hemY - 14, width: 14, height: footY - hemY + 14, rx: 7, fill: skinD }));
      out.push(el("rect", { x: x - 8, y: hemY - 16, width: 16, height: 26, rx: 7, fill: clothD }));
      if (t.shoe) {
        out.push(el("rect", { x: x - 11, y: footY - 4, width: 22, height: 14, rx: 4, fill: LINE }));
      } else {
        out.push(el("ellipse", { cx: x, cy: footY + 3, rx: 12, ry: 8, fill: LINE }));
      }
    });

    /* ---- 胴（服） ---- */
    out.push(el("path", {
      d: "M" + (cx - shW / 2) + " 152" +
         " Q" + cx + " 138 " + (cx + shW / 2) + " 152" +
         " L" + (cx + hemW / 2) + " " + hemY +
         " Q" + cx + " " + (hemY + 10) + " " + (cx - hemW / 2) + " " + hemY + " Z",
      fill: cloth
    }));

    /* 縦じま */
    if (t.stripe) {
      [-1, 1].forEach(function (s) {
        out.push(el("rect", {
          x: cx + s * 12 - 3, y: 150, width: 6, height: hemY - 150,
          fill: "#ffffff", opacity: "0.22"
        }));
      });
    }
    /* ベルト */
    if (t.belt) {
      out.push(el("rect", { x: cx - hemW / 2 + 2, y: hemY - 34, width: hemW - 4, height: 11, fill: clothD }));
    }

    /* ---- 腕（袖は服より濃い色。手の位置を覚えておいて、持ち物と手をあとで置く） ---- */
    var handR = 8;
    var sleeve = shade(cloth, -0.36);
    var hands = [];
    if (t.pose) {
      /* 横に開く */
      [-1, 1].forEach(function (s) {
        var x2 = cx + s * (shW / 2 + 20), y2 = 212;
        out.push(limb(cx + s * (shW / 2 - 4), 158, x2, y2, sleeve, 15));
        hands.push({ x: x2, y: y2 + 8 });
      });
    } else {
      /* 体の前で手を合わせる */
      [-1, 1].forEach(function (s) {
        out.push(limb(cx + s * (shW / 2 - 4), 158, cx + s * 11, 210, sleeve, 15));
      });
      hands.push({ x: cx - 11, y: 216 });
      hands.push({ x: cx + 11, y: 216 });
    }

    /* 手に持つもの（右手に握らせる。棒を先に描いて、手をその上に重ねる） */
    if (t.prop) {
      var h = hands[1];
      out.push(el("rect", { x: h.x - 3, y: h.y - 44, width: 6, height: 50, rx: 3, fill: LINE }));
      out.push(el("circle", { cx: h.x, cy: h.y - 46, r: 7.5, fill: shade(cloth, 0.42) }));
    }
    hands.forEach(function (hh) {
      out.push(el("circle", { cx: hh.x, cy: hh.y, r: handR, fill: skin }));
    });

    /* ---- 首 → 襟 ---- */
    out.push(el("rect", { x: cx - 8, y: 112, width: 16, height: 40, rx: 7, fill: skin }));
    if (t.collar) {
      out.push(el("path", { d: "M" + (cx - 14) + " 146 L" + cx + " 168 L" + (cx + 14) + " 146 Z", fill: skinD }));
    } else {
      out.push(el("path", { d: "M" + (cx - 16) + " 147 Q" + cx + " 168 " + (cx + 16) + " 147 Z", fill: clothD }));
    }

    /* ---- 頭（ここから傾ける） ---- */
    var head = [];
    var headShape = t.head
      ? el("rect", { x: 78, y: 44, width: 84, height: 84, rx: 26 })
      : el("circle", { cx: cx, cy: 86, r: 42 });

    /* 髪の土台（頭より一回り大きい形） */
    head.push(t.head
      ? el("rect", { x: 74, y: 39, width: 92, height: 88, rx: 28, fill: hair })
      : el("circle", { cx: cx, cy: 83, r: 46, fill: hair }));
    if (t.hairVol) {
      head.push(el("circle", { cx: cx - 44, cy: 92, r: 16, fill: hair }));
      head.push(el("circle", { cx: cx + 44, cy: 92, r: 16, fill: hair }));
    }

    /* 顔 */
    head.push(headShape.replace("/>", ' fill="' + skin + '"/>'));

    /* 耳（髪のふくらみに隠れないよう、顔のあとに置く） */
    [-1, 1].forEach(function (s) {
      head.push(el("ellipse", { cx: cx + s * 42, cy: 92, rx: 6.5, ry: 9, fill: skinD }));
    });

    /* 前髪（頭の形で切り抜く） */
    head.push('<clipPath id="' + hid + '">' + headShape + "</clipPath>");
    head.push('<g clip-path="url(#' + hid + ')">' + el("path", {
      d: t.hairVol
        ? "M74 36 L166 36 L166 92 Q140 78 120 88 Q96 100 74 84 Z"
        : "M74 36 L166 36 L166 74 Q142 64 120 72 Q98 80 74 68 Z",
      fill: hair
    }) + "</g>");

    /* 顔のパーツ */
    var eyeKind = t.eyeA * 4 + t.eyeB * 2 + t.eyeC;
    var face = [];

    [-1, 1].forEach(function (s) {
      var ex = cx + s * 17;
      /* 眉 */
      var inner = t.brow ? 80 : 86, outer = t.brow ? 86 : 80;
      face.push(limb(ex - s * 9, outer, ex + s * 9, inner, hair, 3.4));
      /* 目 */
      face.push(eyePart(eyeKind, ex, s));
      /* ほお */
      if (t.blush) {
        face.push(el("ellipse", { cx: ex + s * 6, cy: 108, rx: 7, ry: 4.5, fill: "#ec7f7f", opacity: "0.42" }));
      }
    });

    /* 口 */
    if (t.mouth) {
      face.push(limb(cx - 7, 114, cx + 7, 114, LINE, 3.4));
    } else {
      face.push(el("path", { d: "M" + (cx - 8) + " 111 Q" + cx + " 124 " + (cx + 8) + " 111 Z", fill: "#8c4a4a" }));
    }

    /* めがね */
    if (t.glass) {
      [-1, 1].forEach(function (s) {
        face.push(el("circle", { cx: cx + s * 17, cy: 96, r: 11, fill: "none", stroke: LINE, "stroke-width": 2.6 }));
      });
      face.push(limb(cx - 6, 96, cx + 6, 96, LINE, 2.6));
    }

    head.push(face.join(""));

    /* ぼうし（頭の上半分にかぶせて、右につばを出す） */
    if (t.hat) {
      head.push(el("path", { d: "M76 66 A44 44 0 0 1 164 66 Z", fill: clothD }));
      head.push(el("rect", { x: cx - 2, y: 60, width: 56, height: 9, rx: 4.5, fill: shade(cloth, -0.4) }));
    }

    out.push(el("g", { transform: "rotate(" + (t.tilt ? -6 : 0) + " " + cx + " 120)" }, head.join("")));

    /* 人物は 22〜293 の高さで描いてあるので、縮めて枠の中央に置く */
    return '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="タイプの人物">' +
           bgOut.join("") +
           '<g transform="translate(38.4 -5) scale(0.68)">' + out.join("") + "</g></svg>";
  };
})(window);
