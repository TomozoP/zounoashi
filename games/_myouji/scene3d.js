/* 名字の水族館の立体（three.js）。games/three-base.js の Z3 を土台にする。
   まんなかの丸い部屋を、ぐるっと一周の水槽が囲む。名字は群れになって、ずっと水槽の中を回遊する。
   並びは MYOUJI_LAYOUT で決め、ゲーム側も同じものを使う。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ============ 並び ============ */
  var R_IN = 9;                                 /* 部屋の半径（ガラスの位置） */
  var R_OUT = 23;                               /* 水槽の外側の壁 */
  var TOP = 9;                                  /* 水槽の高さ */
  var GIANT = 10;                               /* 一匹で大きく泳ぐ、人数の多い名字の数 */

  function layout() {
    var seen = {}, list = [];
    (global.MYOUJI || []).forEach(function (s) {
      var p = s.split(":");
      if (!p[0] || !p[1] || seen[p[0]]) return;
      seen[p[0]] = 1;
      list.push({ name: p[0], yomi: p[1], rank: list.length });
    });
    return { list: list, rIn: R_IN, rOut: R_OUT, top: TOP, giant: GIANT };
  }
  global.MYOUJI_LAYOUT = layout;

  /* ============ 絵 ============ */
  var CELL_W = 160, CELL_H = 48, ATLAS = 2048;
  var PER_ROW = Math.floor(ATLAS / CELL_W), PER_ATLAS = PER_ROW * Math.floor(ATLAS / CELL_H);
  var COLORS = [0xff7a59, 0xffb347, 0xffd166, 0x5ec8e5, 0x7bd389, 0xf28dc4, 0xa78bfa, 0x4f9dff, 0xff5d73, 0x2ec4b6, 0xf4a261, 0xe9c46a];

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { tone: "linear" }, camera: { fov: 80, near: 0.1, far: 90 }, finish: { contrast: 0.1, vignette: 0.45, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.camera.rotation.order = "YXZ";
    this.scene.background = new T.Color(0x04101e);
    this.scene.fog = new T.Fog(0x05182c, 14, 50);
    var L = this.L = layout();
    this.buildRoom(L);
    this.buildFish(L);
  }

  GameScene.prototype.buildRoom = function (L) {
    var sc = this.scene, SEG = 96;
    var dark = new T.MeshBasicMaterial({ color: 0x0b1626, side: T.DoubleSide });
    /* 部屋の床と天井 */
    var floorTex = Z3.canvasTex(64, 64, function (g, w, h) {
      g.fillStyle = "#13202f"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#18283a"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(L.rIn, L.rIn);
    var floor = new T.Mesh(new T.CircleGeometry(L.rIn + 0.2, SEG), new T.MeshBasicMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    sc.add(floor);
    var ceil = new T.Mesh(new T.CircleGeometry(L.rIn + 0.3, SEG), dark);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = L.top + 0.45;
    sc.add(ceil);

    /* 水槽：外の壁（上ほど明るい水の色）、砂、水面、内側のガラス */
    var water = Z3.canvasTex(8, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5fd0ff"); gr.addColorStop(0.35, "#1677b8"); gr.addColorStop(1, "#06305a");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var wall = new T.Mesh(new T.CylinderGeometry(L.rOut, L.rOut, L.top, SEG, 1, true), new T.MeshBasicMaterial({ map: water, side: T.BackSide, fog: false }));
    wall.position.y = L.top / 2;
    sc.add(wall);
    var sand = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#c9b48a"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? "#b49d72" : "#ddc9a0"; g.fillRect(r() * w, r() * h, 2, 2); }
    });
    sand.wrapS = sand.wrapT = T.RepeatWrapping; sand.repeat.set(10, 10);
    var sandM = new T.Mesh(new T.RingGeometry(L.rIn, L.rOut, SEG, 1), new T.MeshBasicMaterial({ map: sand }));
    sandM.rotation.x = -Math.PI / 2; sandM.position.y = 0.25;
    sc.add(sandM);
    var surf = new T.Mesh(new T.RingGeometry(L.rIn, L.rOut, SEG, 1), new T.MeshBasicMaterial({ color: 0x8fe3ff, fog: false, side: T.DoubleSide }));
    surf.rotation.x = Math.PI / 2; surf.position.y = L.top;
    sc.add(surf);
    var glass = new T.Mesh(new T.CylinderGeometry(L.rIn, L.rIn, L.top, SEG, 1, true), new T.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide }));
    glass.position.y = L.top / 2;
    sc.add(glass);
    /* ガラスの上下の縁だけ（仕切りはなし） */
    var lip = new T.Mesh(new T.CylinderGeometry(L.rIn + 0.02, L.rIn + 0.02, 0.3, SEG, 1, true), dark);
    lip.position.y = 0.15; sc.add(lip);
    var lip2 = new T.Mesh(new T.CylinderGeometry(L.rIn + 0.02, L.rIn + 0.02, 0.5, SEG, 1, true), dark);
    lip2.position.y = L.top + 0.2; sc.add(lip2);
    /* 水草 */
    var weedMat = new T.MeshBasicMaterial({ color: 0x2f8f5b, side: T.DoubleSide });
    var rnd = Z3.rng(11);
    for (var i = 0; i < 140; i++) {
      var hgt = 0.6 + rnd() * 2.2, a = rnd() * Math.PI * 2, r = L.rIn + 0.6 + rnd() * (L.rOut - L.rIn - 1.2);
      var weed = new T.Mesh(new T.PlaneGeometry(0.22, hgt), weedMat);
      weed.position.set(Math.cos(a) * r, 0.25 + hgt / 2, Math.sin(a) * r);
      weed.rotation.y = rnd() * Math.PI;
      sc.add(weed);
    }
  };

  GameScene.prototype.buildFish = function (L) {
    var all = this.fish = [], groups = this.groups = [];
    var rnd = Z3.rng(7);
    function size(rank) {
      if (rank < 3) return 2.3;
      if (rank < GIANT) return 1.8;
      if (rank < 40) return 1.15;
      if (rank < 150) return 0.95;
      if (rank < 400) return 0.8;
      return 0.6;
    }
    var mid = (L.rIn + L.rOut) / 2, span = (L.rOut - L.rIn) / 2 - 1.2;
    function group(n, slow) {
      var g = {
        a: rnd() * Math.PI * 2,
        dir: rnd() < 0.5 ? 1 : -1,
        sp: (slow ? 0.35 : 0.45 + rnd() * 0.6),         /* 進む速さ（m/秒） */
        rc: mid + (rnd() - 0.5) * span, rAmp: rnd() * span * 0.6, rF: 0.05 + rnd() * 0.08,
        hc: 1.2 + rnd() * (L.top - 2.6), hAmp: 0.3 + rnd() * 1.2, hF: 0.06 + rnd() * 0.1,
        pF: 0.08 + rnd() * 0.1, ph: rnd() * 10, n: n
      };
      groups.push(g);
      return g;
    }
    /* 同じ漢字を持つ名字どうしで群れにする（「田」の群れ、「藤」の群れ…）。大きい群れは16匹ずつに分ける */
    var THEMES = ("田 藤 山 川 木 野 井 本 村 島 原 中 小 大 上 石 松 谷 岡 森 沢 澤 宮 西 高 崎 部 口 下 内 江 浜 水 池 鳥 " +
      "子 金 長 横 平 北 東 南 新 古 吉 福 久 安 竹 岩 坂 林 永 前 渡 尾 杉 桜 星 海 浅 白 黒 青 赤 菅 有 荒 片 若 根 塚 " +
      "越 瀬 河 津 岸 橋 屋 戸 城 寺 熊 鶴 亀 鷹 鯉 鮫 鯨 鮎 貝 磯 浦 湊 船 舟 網 滝 沼 泉 雪 雨 風 霧 梅 菊 堀 関 秋 柴 " +
      "今 和 増 近 遠 後 佐 加 伊 斎 清 鈴 武 早 三 二 一 千 八 五 九 十 百 万 日 月 春 夏 冬 花 葉 柳 桑 栗 室 野 間 地 " +
      "生 田 美 光 正 元 天 神 仁 国 宇 角 志 曽 丸 玉 細 広 進 二").split(" ");
    var rest = L.list.filter(function (f) { return f.rank >= GIANT; });
    var buckets = {}, order = [], left = [];
    rest.forEach(function (f) {
      for (var q = 0; q < THEMES.length; q++) {
        if (THEMES[q] && f.name.indexOf(THEMES[q]) >= 0) {
          if (!buckets[THEMES[q]]) { buckets[THEMES[q]] = []; order.push(THEMES[q]); }
          buckets[THEMES[q]].push(f); return;
        }
      }
      left.push(f);
    });
    /* どれにも入らなかったものは、最初の字が同じものどうし */
    left.forEach(function (f) {
      var key = "*" + f.name[0];
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(f);
    });
    var ci = 0;
    order.forEach(function (key) {
      var list = buckets[key], parts = Math.ceil(list.length / 16);
      for (var pi = 0; pi < parts; pi++) {
        var sub = list.slice(Math.floor(list.length * pi / parts), Math.floor(list.length * (pi + 1) / parts));
        var n = sub.length, g = group(n, false), spread = 0.7 + n * 0.17;
        g.color = COLORS[ci++ % COLORS.length];
        sub.forEach(function (f) {
          all.push({ f: f, s: size(f.rank), g: g,
            ot: (rnd() - 0.5) * spread * 2, or: (rnd() - 0.5) * 1.4, ou: (rnd() - 0.5) * 1.2,
            wF: 0.4 + rnd() * 0.6, wA: 0.1 + rnd() * 0.2, ph: rnd() * 10, roll: 0, yaw: 0, sw: rnd() * 10 });
        });
      }
    });
    /* 上位の名字は一匹で大きく、ゆったり */
    L.list.slice(0, GIANT).forEach(function (f) {
      var g = group(1, true);
      g.color = COLORS[(f.rank * 5 + 1) % COLORS.length];
      g.hc = 2.2 + rnd() * (L.top - 4.4); g.rAmp = span * 0.3;
      all.push({ f: f, s: size(f.rank), g: g, ot: 0, or: 0, ou: 0, wF: 0.3, wA: 0.1, ph: rnd() * 10, roll: 0, yaw: 0, sw: rnd() * 10, giant: true });
    });
    this.byName = {};
    var self = this;
    all.forEach(function (o, i) { o.i = i; self.byName[o.f.name] = o; o.pos = new T.Vector3(); o.prev = new T.Vector3(); o.vel = new T.Vector3(); });
    this.lastT = null;

    var col = new T.Color();
    /* 名前の文字は、何枚かの大きな絵にまとめて貼る */
    this.texts = [];
    for (var a = 0; a * PER_ATLAS < all.length; a++) {
      var chunk = all.slice(a * PER_ATLAS, (a + 1) * PER_ATLAS);
      var tex = Z3.canvasTex(ATLAS, ATLAS, function (c) {
        c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
        chunk.forEach(function (o, q) {
          var cx = (q % PER_ROW) * CELL_W + CELL_W / 2, cy = Math.floor(q / PER_ROW) * CELL_H + CELL_H / 2;
          c.font = "900 38px sans-serif";
          var tw = c.measureText(o.f.name).width;
          c.save(); c.translate(cx, cy + 2);
          if (tw > CELL_W - 22) c.scale((CELL_W - 22) / tw, 1);
          c.lineWidth = 8; c.strokeStyle = "rgba(10,20,40,.9)"; c.strokeText(o.f.name, 0, 0);
          c.fillStyle = "#fff"; c.fillText(o.f.name, 0, 0);
          c.restore();
        });
      });
      tex.anisotropy = 4;
      var geo = new T.PlaneGeometry(1, 1);
      var off = new Float32Array(chunk.length * 2);
      chunk.forEach(function (o, q) { off[q * 2] = (q % PER_ROW) * CELL_W / ATLAS; off[q * 2 + 1] = 1 - (Math.floor(q / PER_ROW) + 1) * CELL_H / ATLAS; });
      geo.setAttribute("cell", new T.InstancedBufferAttribute(off, 2));
      var mat = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.35, side: T.DoubleSide });
      mat.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 cell;")
          .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = cell + uv * vec2(" + (CELL_W / ATLAS).toFixed(6) + ", " + (CELL_H / ATLAS).toFixed(6) + ");");
      };
      var im = new T.InstancedMesh(geo, mat, chunk.length);
      chunk.forEach(function (o, q) { col.setHex(o.g.color); im.setColorAt(q, col); });
      im.frustumCulled = false;
      im.base = a * PER_ATLAS;
      this.scene.add(im);
      this.texts.push(im);
    }
    this.dummy = new T.Object3D();
    this.ring = new T.Mesh(new T.RingGeometry(0.32, 0.42, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    this.scene.add(this.ring);
  };

  GameScene.prototype.reset = function () {};

  /* s: { t, cam: {x, z, yaw, pitch}, glide } */
  GameScene.prototype.sync = function (s) {
    var t = s.t, c = s.cam, cam = this.camera, d = this.dummy, L = this.L;
    cam.position.set(c.x, 1.55, c.z);
    cam.rotation.set(c.pitch || 0, c.yaw, 0);
    var gl = s.glide;
    this.ring.visible = !!gl;
    if (gl) { this.ring.position.set(gl.x1, 0.02, gl.z1); this.ring.material.opacity = 0.75 * (1 - Math.min(1, gl.t / gl.dur) * 0.6); }
    var dt = this.lastT == null ? 0 : Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    /* 群れ：水槽をぐるっと回り続ける。速さは波のように上下し、半径と高さもゆっくり変わる */
    var rMin = L.rIn + 0.7, rMax = L.rOut - 0.7;
    for (var gi = 0; gi < this.groups.length; gi++) {
      var g = this.groups[gi];
      var sp = g.sp * (1 + 0.45 * Math.sin(t * g.pF + g.ph));
      g.r = g.rc + Math.sin(t * g.rF + g.ph) * g.rAmp;
      g.h = g.hc + Math.sin(t * g.hF + g.ph * 1.7) * g.hAmp;
      g.a += g.dir * sp * dt / g.r;
    }
    var all = this.fish;
    for (var i = 0; i < all.length; i++) {
      var o = all[i], G = o.g;
      var w = Math.sin(t * o.wF + o.ph), w2 = Math.cos(t * o.wF * 0.7 + o.ph * 1.3);
      var r = Math.max(rMin, Math.min(rMax, G.r + o.or + w2 * o.wA));
      var a = G.a + (o.ot + w * o.wA * 2) / r;
      var y = Math.max(0.6 + o.s * 0.2, Math.min(L.top - 0.5 - o.s * 0.2, G.h + o.ou + w * o.wA));
      o.prev.copy(o.pos);
      o.pos.set(Math.cos(a) * r, y, Math.sin(a) * r);
      if (dt > 0) o.vel.subVectors(o.pos, o.prev).multiplyScalar(1 / dt);
      /* まんなか（見ている人）の方を向ける。文字は裏返さず、進む向きに頭を上げ下げし、少しひねる */
      var face = Math.atan2(-o.pos.x, -o.pos.z);
      var vx = o.vel.x * Math.cos(face) - o.vel.z * Math.sin(face);
      var spd = o.vel.length();
      var wantRoll = spd > 0.05 ? Math.max(-0.45, Math.min(0.45, Math.atan2(o.vel.y, Math.abs(vx) + 0.15) * (vx >= 0 ? 1 : -1))) : 0;
      var wantYaw = Math.max(-0.45, Math.min(0.45, -vx * 0.25));
      var k = Math.min(1, dt * 4);
      o.roll += (wantRoll - o.roll) * k; o.yaw += (wantYaw - o.yaw) * k;
      o.sw += dt * (2 + spd * 7);
      d.position.copy(o.pos);
      d.rotation.set(0, face + o.yaw, o.roll + Math.sin(o.sw) * 0.03);
      var sc = 1 + Math.sin(o.sw) * (0.03 + Math.min(0.06, spd * 0.03));
      d.scale.set(o.s * 2.4 * sc, o.s * 2.4 / sc * CELL_H / CELL_W, 1);
      d.updateMatrix();
      var im = this.texts[Math.floor(i / PER_ATLAS)];
      im.setMatrixAt(i - im.base, d.matrix);
    }
    this.texts.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
  };

  /* 画面の (x, y) を通る向き（長さ1） */
  GameScene.prototype.ray = function (x, y, W, H) {
    var cam = this.camera;
    cam.aspect = W / H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    var v = new T.Vector3(x / W * 2 - 1, -(y / H * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize();
    return { x: v.x, y: v.y, z: v.z };
  };

  /* 画面の (x, y) にいちばん近い名字。いなければ null */
  GameScene.prototype.pick = function (x, y, W, H) {
    var cam = this.camera, v = new T.Vector3(), best = null, bd = 1e9;
    cam.updateMatrixWorld();
    var fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    for (var i = 0; i < this.fish.length; i++) {
      var o = this.fish[i];
      v.copy(o.pos).sub(cam.position);
      var dist = v.length();
      if (dist > 34 || v.dot(fwd) <= 0.3) continue;
      v.copy(o.pos).project(cam);
      var sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      var r = Math.max(26, o.s * 0.9 / dist * H * 0.9);
      var dd = Math.hypot(sx - x, sy - y);
      if (dd < r && dd / r + dist * 0.02 < bd) { bd = dd / r + dist * 0.02; best = o; }
    }
    return best;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
