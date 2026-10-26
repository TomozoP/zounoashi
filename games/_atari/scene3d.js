/* あたりくじの立体（three.js）。games/three-base.js の Z3 を土台にする。
   棒の位置・引いた長さ・抜けたかどうかはゲーム側（index.html）が決め、ここは見た目と、
   画面の点から棒を探す・棒の向きを画面の向きに直す、だけをする。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* 大きさ（ゲーム側も使う）。1文字ぶんの長さ C、棒の幅 SW、筒の半径 R・深さ DEPTH、カメラ */
  var K = global.KUJI3D = { C: 0.34, SW: 0.42, R: 2.35, DEPTH: 5.4, CAMY: 4.6, CAMZ: 21, LOOKY: -1.9 };

  /* 筒の手前のふちの上を通る視線より下は見えない。棒の口の位置 (x, z) で、見えなくなる高さ */
  K.hideY = function (x, z) {
    var zf = Math.sqrt(Math.max(0, K.R * K.R - x * x));
    return -(zf - z) * K.CAMY / (K.CAMZ - zf);
  };

  function stickTex(st) {
    var n = st.word.length, px = 64;
    var w = Math.round(px * K.SW / K.C), h = px * (n + 2);
    return Z3.canvasTex(w, h, function (g) {
      var r = w / 2 - 2;
      g.beginPath();
      g.moveTo(2, r + 2); g.arc(w / 2, r + 2, r, Math.PI, 0); g.lineTo(w - 2, h - r - 2);
      g.arc(w / 2, h - r - 2, r, 0, Math.PI); g.closePath();
      var lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "#d9bf93"); lg.addColorStop(0.3, "#f1dfbd"); lg.addColorStop(1, "#d2b689");
      g.fillStyle = lg; g.fill();
      if (st.word === "あたり") {                /* あたりの棒は根元が赤い */
        g.save(); g.clip(); g.fillStyle = "#e0322b"; g.fillRect(0, h - px * 0.75, w, px); g.restore();
      }
      g.lineWidth = 3; g.strokeStyle = "rgba(110,75,40,.7)"; g.stroke();
      g.fillStyle = "#24130a";
      g.font = "900 " + Math.round(px * 0.8) + "px sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      for (var i = 0; i < n; i++) g.fillText(st.word[i], w / 2, px * (1.5 + i) + 3);
    });
  }

  function GameScene() {
    T = global.THREE;
    var stg = this.stage = new Z3.Stage({ renderer: { tone: "aces", exposure: 1.05 }, camera: { fov: 34 } });
    this.scene = stg.scene;
    this.camera = stg.camera;
    this.scene.background = new T.Color(0xefdcb6);
    Z3.lights(this.scene, { scale: 0.9 });
    this.camera.position.set(0, K.CAMY, K.CAMZ);
    this.camera.lookAt(0, K.LOOKY, 0);

    var R = K.R, D = K.DEPTH;
    /* 台 */
    var table = new T.Mesh(new T.CircleGeometry(9, 48), Z3.std(0xc79a63, { roughness: 0.7 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -D - 0.01;
    this.scene.add(table);
    /* 筒の外側：赤に白い帯 */
    var side = Z3.canvasTex(512, 256, function (g, w, h) {
      g.fillStyle = "#d8372e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff6e6"; g.fillRect(0, h * 0.5, w, h * 0.16);
    });
    var cupOut = new T.Mesh(new T.CylinderGeometry(R, R * 0.94, D, 56, 1, true), Z3.std(0xffffff, { map: side, roughness: 0.45 }));
    cupOut.position.y = -D / 2;
    this.scene.add(cupOut);
    var cupIn = new T.Mesh(new T.CylinderGeometry(R - 0.03, R * 0.94 - 0.03, D, 56, 1, true), Z3.std(0x5a1410, { side: T.BackSide }));
    cupIn.position.y = -D / 2;
    this.scene.add(cupIn);
    var rim = new T.Mesh(new T.TorusGeometry(R, 0.07, 10, 64), Z3.std(0xf3d29a, { roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);
    this.cup = [cupOut, rim];

    this.geo = {};                             /* 文字数ごとの板 */
    this.meshes = new Map();
    this.ray = new T.Raycaster();
    this.up = new T.Vector3(0, 1, 0);
  }

  GameScene.prototype.plate = function (n) {
    if (!this.geo[n]) {
      var L = K.C * (n + 2), g = new T.PlaneGeometry(K.SW, L);
      g.translate(0, -L / 2, 0);                /* 原点が棒の先 */
      this.geo[n] = g;
    }
    return this.geo[n];
  };

  GameScene.prototype.meshOf = function (st) {
    var m = this.meshes.get(st);
    if (!m) {
      m = new T.Mesh(this.plate(st.word.length), new T.MeshStandardMaterial({ map: stickTex(st), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.75 }));
      m.userData.st = st;
      this.scene.add(m);
      this.meshes.set(st, m);
    }
    return m;
  };

  /* 棒の先の位置（引いた長さ込み） */
  function tipOf(st) {
    var k = st.v + st.p;
    return new T.Vector3(st.x + st.d.x * k, st.d.y * k, st.z + st.d.z * k);
  }

  /* s: { sticks: 筒の中の棒, gone: 抜けた棒, lit: 持っている棒, win: あたりの棒, winT } */
  GameScene.prototype.sync = function (s) {
    var keep = new Set(), self = this;
    function place(st) {
      keep.add(st);
      var m = self.meshOf(st), dir = new T.Vector3(st.d.x, st.d.y, st.d.z);
      m.scale.set(1, 1, 1);
      if (st === s.win) {
        /* あたりは筒から出て、画面の手前にまっすぐ立つ */
        var e = 1 - Math.pow(1 - Math.min(1, s.winT / 0.6), 3);
        var from = tipOf(st), L = K.C * (st.word.length + 2);
        var to = new T.Vector3(0, 2.4 + L * 0.5, 11);
        m.position.copy(from.lerp(to, e));
        var q0 = new T.Quaternion().setFromUnitVectors(self.up, dir), q1 = new T.Quaternion();
        m.quaternion.copy(q0.slerp(q1, e));
        var sc = 1; m.scale.set(sc, sc, sc);
      } else if (st.fly) {
        var f = st.fly;
        m.position.set(f.x, f.y, f.z);
        m.quaternion.setFromUnitVectors(self.up, dir);
        m.rotateZ(f.r); m.rotateX(f.r * 0.4);
      } else {
        m.position.copy(tipOf(st));
        m.quaternion.setFromUnitVectors(self.up, dir);
      }
      var lit = st === s.lit;
      m.material.emissive.setHex(lit ? 0x4a3a10 : 0x000000);
      m.renderOrder = lit ? 1 : 0;
    }
    s.sticks.forEach(place);
    s.gone.forEach(place);
    this.meshes.forEach(function (m, st) {
      if (keep.has(st)) return;
      self.scene.remove(m); m.material.map.dispose(); m.material.dispose();
      self.meshes.delete(st);
    });
  };

  /* 画面の点（ゲーム座標）にある、筒の中の棒。筒の壁の裏は取らない */
  GameScene.prototype.pick = function (x, y, W, H, sticks) {
    var best = null, self = this, list = [];
    sticks.forEach(function (st) { var m = self.meshes.get(st); if (m) list.push(m); });
    var offs = [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14], [-26, 0], [26, 0]];
    for (var i = 0; i < offs.length && !best; i++) {
      this.ray.setFromCamera(new T.Vector2((x + offs[i][0]) / W * 2 - 1, -((y + offs[i][1]) / H) * 2 + 1), this.camera);
      var hits = this.ray.intersectObjects(list.concat(this.cup), false);
      for (var j = 0; j < hits.length; j++) {
        if (this.cup.indexOf(hits[j].object) >= 0) break;
        if (hits[j].point.y < -0.02) continue;  /* 口より下（筒の中）は持てない */
        best = hits[j].object.userData.st; break;
      }
    }
    return best;
  };

  /* 棒の軸を画面に写した向き。1単位引くと画面で (x, y) 動く */
  GameScene.prototype.axis = function (st, W, H) {
    var a = tipOf(st), b = a.clone().add(new T.Vector3(st.d.x, st.d.y, st.d.z));
    a.project(this.camera); b.project(this.camera);
    return { x: (b.x - a.x) * W / 2, y: -(b.y - a.y) * H / 2 };
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
