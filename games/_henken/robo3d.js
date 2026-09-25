/* 偏県の偏見ロボを3Dで描く（three.js）。
   ゲームの2D画面に貼り込めるよう、小さい画面に描いてその canvas を返す。録画にもそのまま映る。

   var robo = window.HenkenRobo3D.create(px);   px は描く大きさ（正方形、画素）
   robo.render({ t, talking, mouth, happy, blink, shake, party, hue }) → canvas
     t       … 秒
     talking … 話している（口をぱくぱく）
     happy   … 目を細める（当てられた・クリア）
     blink   … まばたき中
     shake   … 首を振る量（-1〜1。外されたとき）
     party   … クリア（虹色に光って踊る）
     hue     … party のときの色相（0〜360）

   形: 角の丸い箱の頭に、顔の画面とアンテナ。画面の右側（吹き出し側）に、体とつながっていない浮いた白いグローブの右手。黒い縁取り付き。目は「偏」「見」の光る字、口は横長の光る棒。耳と首はない。 */
(function (global) {
  "use strict";

  /* 角の丸い箱。細かく割った箱の点を、内側の箱から半径 r だけ外へ押し出して作る */
  function roundedBox(THREE, w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      v.sub(c).normalize().multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  function create(px) {
    var THREE = global.THREE;
    var canvas = document.createElement("canvas");
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(px, px, false);
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0, 0.25, 7.0);           /* 浮いた手まで枠に収まる距離 */
    camera.lookAt(0, 0.12, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa0b8, 1.6));
    var key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.5, 3, 4);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xbfe6ff, 1.2);
    rim.position.set(3, 1, -2);
    scene.add(rim);

    var robo = new THREE.Group();
    scene.add(robo);

    /* 黒い縁取り。ひと回り大きい黒い形を裏側だけ描くと、外側に輪郭が残る */
    var LINE = 0.05;
    var lineMat = new THREE.MeshBasicMaterial({ color: 0x16202e, side: THREE.BackSide });
    function outline(geom, x, y, z) {
      var m = new THREE.Mesh(geom, lineMat);
      m.position.set(x || 0, y || 0, z || 0);
      robo.add(m);
    }

    /* 頭 */
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9d5df, metalness: 0.18, roughness: 0.34 });
    var head = new THREE.Mesh(roundedBox(THREE, 1.5, 1.32, 1.15, 0.26, 8), bodyMat);
    robo.add(head);
    outline(roundedBox(THREE, 1.5 + LINE * 2, 1.32 + LINE * 2, 1.15 + LINE * 2, 0.26 + LINE, 8));

    /* 顔の画面。字と口は小さい2D画面に描いて貼る（毎コマ描き直す） */
    var faceCv = document.createElement("canvas");
    faceCv.width = 256; faceCv.height = 208;
    var fx = faceCv.getContext("2d");
    var faceTex = new THREE.CanvasTexture(faceCv);
    if ("colorSpace" in faceTex) faceTex.colorSpace = THREE.SRGBColorSpace;
    var face = new THREE.Mesh(roundedBox(THREE, 1.16, 0.98, 0.08, 0.035, 4),
      new THREE.MeshStandardMaterial({ color: 0x23364a, metalness: 0.1, roughness: 0.25 }));
    face.position.set(0, -0.02, 0.56);
    robo.add(face);
    outline(roundedBox(THREE, 1.16 + LINE, 0.98 + LINE, 0.08 + LINE, 0.035 + LINE / 2, 4), 0, -0.02, 0.56);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
    screen.position.set(0, -0.02, 0.605);
    robo.add(screen);

    /* アンテナ */
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x16202e, metalness: 0.4, roughness: 0.5 });
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 12), stemMat);
    stem.position.set(0, 0.82, 0);
    robo.add(stem);
    outline(new THREE.CylinderGeometry(0.035 + LINE * 0.7, 0.035 + LINE * 0.7, 0.34, 12), 0, 0.82, 0);
    var ballMat = new THREE.MeshStandardMaterial({ color: 0xe2504c, emissive: 0xe2504c, emissiveIntensity: 0.35, roughness: 0.3 });
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), ballMat);
    ball.position.set(0, 1.02, 0);
    robo.add(ball);
    outline(new THREE.SphereGeometry(0.12 + LINE * 0.8, 20, 14), 0, 1.02, 0);

    /* 浮いた手。白い丸いミトンに親指。頭とは別に動かす（頭の傾きにはつられない）。クリアの虹色にも染まらない */
    var handMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.45 });
    /* 白いグローブの右手（画面の右側に1本）。丸い手のひらに3本の指と親指、手首のふくらんだ袖口。
       指と親指はそれぞれ付け根で曲がる。どれも黒い縁取り付き（ひと回り大きい黒を裏側だけ描く） */
    function part(parent, geo, lineGeo, x, y, z, sx, sy, sz) {
      var line = new THREE.Mesh(lineGeo, lineMat), m = new THREE.Mesh(geo, handMat);
      [line, m].forEach(function (o) { o.position.set(x, y, z); o.scale.set(sx || 1, sy || 1, sz || 1); parent.add(o); });
    }
    function capsule(r, len) { return new THREE.CapsuleGeometry(r, len, 6, 12); }
    var FINGER_LEN = 0.25;
    var IN = -1;                                    /* 頭のほうの向き。右手なので -x（左右を入れ替えるときはここだけ） */
    function makeHand() {
      var root = new THREE.Group(), wrist = new THREE.Group();
      root.add(wrist);
      /* 手のひら・袖口 */
      part(wrist, new THREE.SphereGeometry(0.2, 22, 16), new THREE.SphereGeometry(0.2 + LINE, 22, 16), 0, 0, 0, 1.05, 0.95, 0.7);
      part(wrist, new THREE.CylinderGeometry(0.15, 0.17, 0.1, 20), new THREE.CylinderGeometry(0.15 + LINE, 0.17 + LINE, 0.1 + LINE * 2, 20), 0, -0.24, 0);
      /* 指3本。頭に近いほうから人さし指・中指・薬指。付け根で曲がる */
      var fingers = [0.11 * IN, 0, -0.11 * IN].map(function (fxp) {
        var pivot = new THREE.Group();
        pivot.position.set(fxp, 0.13 - Math.abs(fxp) * 0.2, 0.02);
        part(pivot, capsule(0.065, 0.12), capsule(0.065 + LINE, 0.12), 0, FINGER_LEN / 2, 0, 1, 1, 0.85);
        wrist.add(pivot);
        return { pivot: pivot, fan: -fxp * 1.2 };
      });
      /* 親指。頭のほうへ出て、付け根で手のひら側へ倒れる */
      var thumb = new THREE.Group();
      thumb.position.set(0.15 * IN, -0.02, 0.05);
      part(thumb, capsule(0.06, 0.1), capsule(0.06 + LINE, 0.1), 0, 0.1, 0, 1, 1, 0.85);
      wrist.add(thumb);
      scene.add(root);
      return { root: root, wrist: wrist, fingers: fingers, thumb: thumb };
    }
    var hand = makeHand();
    /* 手の構え。毎コマ目標へなめらかに寄せる（状態が変わっても手が飛ばないように） */
    var pose = null, lastT = null;
    function lerp(a, b, k) { return a + (b - a) * k; }

    function drawFace(o) {
      fx.clearRect(0, 0, 256, 208);
      fx.fillStyle = "#7df0ff";
      fx.shadowColor = "rgba(125,240,255,.9)";
      fx.shadowBlur = 14;
      fx.font = "900 64px sans-serif";
      fx.textAlign = "center";
      fx.textBaseline = "middle";
      var sy = o.happy ? 0.5 : o.blink ? 0.15 : 1;
      ["偏", "見"].forEach(function (ch, k) {
        fx.save();
        fx.translate(k ? 180 : 76, o.happy ? 70 : 80);
        fx.scale(1, sy);
        fx.fillText(ch, 0, 2);
        fx.restore();
      });
      var open = o.talking ? 8 + (o.mouth || 0) * 26 : 8;
      fx.beginPath();
      var x = 78, y = 150 - open / 2, w = 100, r = 4;
      fx.moveTo(x + r, y); fx.arcTo(x + w, y, x + w, y + open, r); fx.arcTo(x + w, y + open, x, y + open, r);
      fx.arcTo(x, y + open, x, y, r); fx.arcTo(x, y, x + w, y, r); fx.closePath();
      fx.fill();
      faceTex.needsUpdate = true;
    }

    var tmp = new THREE.Color();
    return {
      canvas: canvas,
      render: function (o) {
        var t = o.t || 0;
        drawFace(o);
        /* ふだんは少し首をかしげて左右を見回す。3Dの厚みが見えるように */
        var yaw = Math.sin(t * 0.9) * 0.38, pitch = -0.08 + Math.sin(t * 1.7) * 0.04, roll = Math.sin(t * 0.7) * 0.05;
        var y = Math.sin(t * 2) * 0.03;
        if (o.talking) { pitch += Math.sin(t * 18) * 0.05; y += Math.sin(t * 18) * 0.015; }
        if (o.shake) yaw += o.shake * 0.5;
        if (o.party) {
          /* 頭で円を描くようにノリノリで揺れる（顔が見えるよう、回りきらずに左右へ首を振る） */
          var ph = t * Math.PI * 4;
          yaw = Math.sin(ph / 2) * 0.7;
          roll = Math.sin(ph) * 0.3;
          pitch = Math.cos(ph) * 0.18;
          y = Math.abs(Math.sin(ph)) * 0.12;
          robo.position.x = Math.cos(ph) * 0.12;
        } else robo.position.x = 0;
        robo.rotation.set(pitch, yaw, roll, "YXZ");
        robo.position.y = y;
        /* 右手: 目標の構えを決めて、なめらかに寄せる。構えは頭の左に置いたときの値で書き、IN で左右を反転する。
           ふだん … 頭の横でゆるく丸めた手が、ふわふわ浮く。指はそれぞれ少しずつ動く
           話す   … 手首を返しながら上下に身ぶり。指が波のように開いたり握ったり
           外れ   … 人さし指だけ立てて、ほかは握る。「チッチッ」と手首ごと振る
           当たり … 手を上げてパッと開く
           クリア … 頭の上で手を振り、指をひらひら */
        var g = {
          x: -1.18, y: -0.66 + Math.sin(t * 2.2) * 0.05, z: 0.25,
          rx: -0.15, ry: 0.5, rz: -0.35 + Math.sin(t * 1.3) * 0.06,
          curl: [0, 1, 2].map(function (i) { return 0.4 + i * 0.12 + Math.sin(t * 1.6 + i * 1.1) * 0.1; }),
          spread: 1, thumb: 0.15
        };
        if (o.talking) {
          g.y += 0.14 + Math.sin(t * 6) * 0.08;
          g.x += Math.sin(t * 4) * 0.05;
          g.ry = 0.25;
          g.rz = -0.3 + Math.sin(t * 5) * 0.28;
          g.curl = [0, 1, 2].map(function (i) { return 0.15 + (Math.sin(t * 7 - i * 0.7) + 1) * 0.35; });
          g.thumb = 0.1 + (Math.sin(t * 7 + 1) + 1) * 0.2;
        }
        if (o.shake) {
          g.y = -0.45; g.ry = 0.2;
          g.rz = -0.05 + Math.sin(t * 26) * 0.38 * Math.min(1, Math.abs(o.shake) * 1.5);
          g.curl = [0, 1.5, 1.6]; g.spread = 0.6; g.thumb = 0.9;
        }
        if (o.happy && !o.party) {
          g.x = -1.12; g.y = 0.05 + Math.sin(t * 8) * 0.03; g.z = 0.3;
          g.rx = 0; g.ry = 0.15; g.rz = -0.2 + Math.sin(t * 10) * 0.08;
          g.curl = [0, 0, 0]; g.spread = 1.6; g.thumb = -0.2;
        }
        if (o.party) {
          var wv = t * Math.PI * 4;
          g.x = -1.08 + Math.cos(wv) * 0.06; g.y = 0.5 + Math.sin(wv) * 0.2; g.z = 0.3;
          g.rx = 0; g.ry = 0.15; g.rz = Math.sin(wv) * 0.55;
          g.curl = [0, 1, 2].map(function (i) { return 0.2 + Math.sin(t * 18 + i * 1.3) * 0.25; });
          g.spread = 1.4; g.thumb = -0.1 + Math.sin(t * 18) * 0.15;
        }
        var dt = lastT == null ? 1 : Math.max(0, Math.min(0.2, t - lastT));
        lastT = t;
        if (!pose || dt === 0) pose = JSON.parse(JSON.stringify(g));
        var k = 1 - Math.exp(-dt * 14);
        ["x", "y", "z", "rx", "ry", "rz", "spread", "thumb"].forEach(function (n) { pose[n] = lerp(pose[n], g[n], k); });
        pose.curl = pose.curl.map(function (c, i) { return lerp(c, g.curl[i], 1 - Math.exp(-dt * 20)); });
        hand.root.position.set(robo.position.x + pose.x * IN, robo.position.y + pose.y, pose.z);
        hand.wrist.rotation.set(pose.rx, pose.ry * IN, pose.rz * IN, "YXZ");
        hand.fingers.forEach(function (fg, i) {
          fg.pivot.rotation.set(pose.curl[i], 0, fg.fan * pose.spread);
        });
        hand.thumb.rotation.set(pose.thumb * 0.6, 0, (-1.0 + pose.thumb) * IN);
        if (o.party) {
          tmp.setHSL((o.hue || 0) / 360, 0.9, 0.62);
          bodyMat.color.copy(tmp);
          bodyMat.emissive.copy(tmp);
          bodyMat.emissiveIntensity = 0.35;
          tmp.setHSL(((o.hue || 0) + 180) % 360 / 360, 1, 0.55);
          ballMat.color.copy(tmp); ballMat.emissive.copy(tmp); ballMat.emissiveIntensity = 0.9;
        } else {
          bodyMat.color.set(0xc9d5df);
          bodyMat.emissive.set(0x000000);
          var blinkBall = o.talking && Math.floor(t * 8) % 2;
          ballMat.color.set(blinkBall ? 0xff7a2f : 0xe2504c);
          ballMat.emissive.set(blinkBall ? 0xff7a2f : 0xe2504c);
          ballMat.emissiveIntensity = 0.35;
        }
        renderer.render(scene, camera);
        return canvas;
      }
    };
  }

  global.HenkenRobo3D = { create: create };
})(window);
