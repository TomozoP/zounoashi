/* 同時球技5種の舞台。
   野球・サッカー・テニス・バスケ・バレーのコートと道具を、
   ぜんぶ同じ場所に重ねて置く。本体から渡された球と選手の姿勢を描くだけ。 */
var ZDoji5Scene = (function () {
  'use strict';

  var COLORS = ZDoji5Colors;
  var T;                                   /* THREE。Scene を作るときに入れる */
  var SPHERE, SIMPLE_SPHERE, CYL, BOX;                    /* 使い回す形 */

  function mat(color, rough, metal) {
    return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? .7 : rough, metalness: metal || 0 });
  }
  function texture(cv) {
    var t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* ============ 地面の絵 ============
     世界の x -35〜35、z -25〜80（70m×105m）を 2048x3072 の絵にする。
     縦横とも 1m = 29.26px で揃うので、円は円のまま描ける。
     線は5cmほどの細さ。5競技の線を同じ紙の上に全部引く。 */
  var FIELD = { x0: -35, z0: -25, w: 70, d: 105, px: 2048 / 70 };
  var fieldCv = null, grassCv = null;
  /* 芝と刈り跡だけの下地。線を引き直すたびに作り直さない */
  function grassBase() {
    if (grassCv) return grassCv;
    grassCv = document.createElement('canvas');
    grassCv.width = 2048; grassCv.height = 3072;
    var c = grassCv.getContext('2d');
    c.fillStyle = '#2e7a3b'; c.fillRect(0, 0, 2048, 3072);
    for (var i = 0; i < 24; i++) { c.fillStyle = i % 2 ? '#358140' : '#2a7135'; c.fillRect(0, i * 128, 2048, 128); }
    return grassCv;
  }
  /* on に入っている競技の線だけを引く */
  function fieldTexture(on) {
    if (!fieldCv) { fieldCv = document.createElement('canvas'); fieldCv.width = 2048; fieldCv.height = 3072; }
    var cv = fieldCv;
    var c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.drawImage(grassBase(), 0, 0);
    var K = FIELD.px;
    function PX(x) { return (x + 35) * K; }
    function PZ(z) { return (z + 25) * K; }
    function S(v) { return v * K; }
    function line() { c.lineWidth = S(.03); c.strokeStyle = 'rgba(246,250,247,.5)'; }
    function rect(x0, z0, x1, z1) { c.strokeRect(PX(x0), PZ(z0), S(x1 - x0), S(z1 - z0)); }
    function seg(x0, z0, x1, z1) { c.beginPath(); c.moveTo(PX(x0), PZ(z0)); c.lineTo(PX(x1), PZ(z1)); c.stroke(); }
    function circle(x, z, r, from, to) {
      c.beginPath(); c.arc(PX(x), PZ(z), S(r), from == null ? 0 : from, to == null ? Math.PI * 2 : to); c.stroke();
    }

    /* 野球の内野。土の菱形の中に芝を残す */
    function diamond(back, right, front, fill) {
      c.beginPath();
      c.moveTo(PX(0), PZ(back)); c.lineTo(PX(right), PZ((back + front) / 2));
      c.lineTo(PX(0), PZ(front)); c.lineTo(PX(-right), PZ((back + front) / 2));
      c.closePath(); c.fillStyle = fill; c.fill();
    }
    if (on.yakyu) {
    diamond(-5, 17, 27, '#a9713f');
    diamond(1.5, 10.5, 20.5, 'rgba(46,122,59,.85)');
    c.fillStyle = '#a9713f';
    [[0, -1], [12, 11], [0, 23], [-12, 11]].forEach(function (b) {
      c.beginPath(); c.ellipse(PX(b[0]), PZ(b[1]), S(2.2), S(2.2), 0, 0, Math.PI * 2); c.fill();
    });
    c.beginPath(); c.ellipse(PX(0), PZ(11), S(2.9), S(2.9), 0, 0, Math.PI * 2); c.fillStyle = '#b77c47'; c.fill();
    c.fillStyle = '#f4f7f4';
    [[12, 11], [0, 23], [-12, 11]].forEach(function (b) { c.fillRect(PX(b[0]) - S(.5), PZ(b[1]) - S(.5), S(1), S(1)); });
    c.fillRect(PX(0) - S(.45), PZ(11) - S(.18), S(.9), S(.36));
    c.beginPath();                                           /* 本塁 */
    c.moveTo(PX(-.6), PZ(-1.6)); c.lineTo(PX(.6), PZ(-1.6)); c.lineTo(PX(.6), PZ(-.6));
    c.lineTo(PX(0), PZ(-.1)); c.lineTo(PX(-.6), PZ(-.6)); c.closePath(); c.fill();
    line(); rect(-2.6, -2.4, -.9, .8); rect(.9, -2.4, 2.6, .8);   /* 打席 */
    seg(0, -1, 27, 26); seg(0, -1, -27, 26);                      /* ファウルライン */
    }

    /* サッカー */
    if (on.soccer) {
    line(); rect(-28, -18, 28, 78);
    seg(-28, 30, 28, 30); circle(0, 30, 9.15);
    rect(-20, 62, 20, 78); rect(-9, 72, 9, 78);
    rect(-20, -18, 20, -2); rect(-9, -18, 9, -12);
    c.fillStyle = 'rgba(244,248,245,.92)';
    [[0, 67], [0, -7], [0, 30]].forEach(function (p) {
      c.beginPath(); c.ellipse(PX(p[0]), PZ(p[1]), S(.35), S(.35), 0, 0, Math.PI * 2); c.fill();
    });
    circle(-28, 78, 1, 0, Math.PI * 2); circle(28, 78, 1, 0, Math.PI * 2);
    }

    /* テニス（本塁の先に重ねる） */
    if (on.tennis) {
    c.fillStyle = 'rgba(40,86,132,.30)'; c.fillRect(PX(-5.5), PZ(0), S(11), S(24));
    line(); rect(-5.5, 0, 5.5, 24); rect(-4.12, 0, 4.12, 24);
    seg(-4.12, 6, 4.12, 6); seg(-4.12, 18, 4.12, 18); seg(0, 6, 0, 18);
    }

    /* バスケ */
    if (on.basket) {
    line(); rect(-7.5, -4, 7.5, 24);
    seg(-7.5, 10, 7.5, 10); circle(0, 10, 1.8);
    c.fillStyle = 'rgba(190,84,42,.42)';
    c.fillRect(PX(-2.45), PZ(17.2), S(4.9), S(6.8)); c.fillRect(PX(-2.45), PZ(-4), S(4.9), S(6.8));
    line(); rect(-2.45, 17.2, 2.45, 24); rect(-2.45, -4, 2.45, 2.8);
    circle(0, 17.2, 1.8); circle(0, 2.8, 1.8);
    circle(0, 22.4, 6.75, Math.PI * 1.08, Math.PI * 1.92);
    circle(0, -2.4, 6.75, Math.PI * .08, Math.PI * .92);
    }

    /* バレー */
    if (on.volley) {
    c.fillStyle = 'rgba(214,116,48,.34)'; c.fillRect(PX(-4.5), PZ(4), S(9), S(18));
    line(); rect(-4.5, 4, 4.5, 22); seg(-4.5, 13, 4.5, 13); seg(-4.5, 10, 4.5, 10); seg(-4.5, 16, 4.5, 16);
    }

    return cv;
  }

  /* 観客席。点をばらまくだけ */
  function crowdTexture() {
    var cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 512;
    var c = cv.getContext('2d');
    c.fillStyle = '#1b222c'; c.fillRect(0, 0, 1024, 512);
    var colors = ['#e4d7bd', '#c9576a', '#6f9bd6', '#e6b455', '#8fc79a', '#b78fd0', '#d8dde4'];
    for (var row = 0; row < 16; row++) {
      c.fillStyle = 'rgba(12,16,22,.5)'; c.fillRect(0, row * 32, 1024, 6);
      for (var i = 0; i < 180; i++) {
        c.fillStyle = colors[(Math.random() * colors.length) | 0];
        c.globalAlpha = .55 + Math.random() * .45;
        c.beginPath(); c.arc(Math.random() * 1024, row * 32 + 18 + Math.random() * 6, 6 + Math.random() * 3.2, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    return cv;
  }

  /* 網。透ける格子。1枚に4目、糸は細く */
  function netTexture(color) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, 64, 64);
    c.strokeStyle = color; c.lineWidth = 1.6;
    for (var i = 0; i < 4; i++) {
      var p = i * 16 + .8;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 64); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(64, p); c.stroke();
    }
    return cv;
  }

  /* 球の柄。競技ごとに描き分ける */
  function ballTexture(kind) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    var c = cv.getContext('2d');
    c.scale(2, 2);                                 /* 描くのは 256x128 のつもりのまま */
    var x, i;
    if (kind === 'yakyu') {
      c.fillStyle = '#f6f3ea'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#c4384a'; c.lineWidth = 3;
      [40, 168].forEach(function (off) {
        c.beginPath();
        for (x = 0; x <= 64; x++) c.lineTo(off + x, 64 + Math.sin(x / 64 * Math.PI) * 46 - 23);
        c.stroke();
        for (i = 0; i < 12; i++) {
          var t = i / 11, px = off + t * 64, py = 64 + Math.sin(t * Math.PI) * 46 - 23;
          c.beginPath(); c.moveTo(px - 5, py - 5); c.lineTo(px + 5, py + 5); c.stroke();
        }
      });
    } else if (kind === 'soccer') {
      /* 切頂二十面体の五角形と六角形を球面へ写し、極でも模様を潰さない。 */
      var golden = (1 + Math.sqrt(5)) / 2, vertices = [], faces = [];
      [-1, 1].forEach(function (a) { [-1, 1].forEach(function (b) {
        vertices.push(new T.Vector3(0, a, b * golden), new T.Vector3(a, b * golden, 0), new T.Vector3(b * golden, 0, a));
      }); });
      function cut(a, b) { return vertices[a].clone().multiplyScalar(2).add(vertices[b]).normalize(); }
      function face(points, black) {
        var center = new T.Vector3(); points.forEach(function (p) { center.add(p); }); center.normalize();
        var axis = points[0].clone().sub(center.clone().multiplyScalar(points[0].dot(center))).normalize(), up = new T.Vector3().crossVectors(center, axis);
        points.sort(function (a, b) { return Math.atan2(a.dot(up), a.dot(axis)) - Math.atan2(b.dot(up), b.dot(axis)); });
        var normals = points.map(function (p, i) { var n = new T.Vector3().crossVectors(p, points[(i + 1) % points.length]).normalize(); if (n.dot(center) < 0) n.negate(); return n; });
        faces.push({ normals: normals, black: black });
      }
      var neighbors = vertices.map(function (v, i) { return vertices.map(function (w, j) { return j; }).filter(function (j) { return j !== i && v.distanceTo(vertices[j]) < 2.01; }); });
      neighbors.forEach(function (ns, i) { face(ns.map(function (j) { return cut(i, j); }), true); });
      for (var i = 0; i < 12; i++) for (var j = i + 1; j < 12; j++) for (var k = j + 1; k < 12; k++) {
        if (neighbors[i].indexOf(j) >= 0 && neighbors[i].indexOf(k) >= 0 && neighbors[j].indexOf(k) >= 0) face([cut(i,j),cut(j,i),cut(j,k),cut(k,j),cut(k,i),cut(i,k)], false);
      }
      /* 画素の直接書き込みには拡大設定が効かないため、実寸で描く。 */
      var pixels = c.createImageData(cv.width, cv.height), dir = new T.Vector3();
      for (var y = 0; y < cv.height; y++) for (var x = 0; x < cv.width; x++) {
        var lat = (y + .5) / cv.height * Math.PI, lon = (x + .5) / cv.width * Math.PI * 2;
        dir.set(Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
        var color = [244,244,240];
        for (var f = 0; f < faces.length; f++) {
          var distance = Math.min.apply(null, faces[f].normals.map(function (n) { return n.dot(dir); }));
          if (distance >= 0) { color = faces[f].black ? [32,36,42] : distance < .009 ? [167,174,169] : [244,244,240]; break; }
        }
        var offset = (y * cv.width + x) * 4; pixels.data[offset] = color[0]; pixels.data[offset+1] = color[1]; pixels.data[offset+2] = color[2]; pixels.data[offset+3] = 255;
      }
      c.putImageData(pixels, 0, 0);
    } else if (kind === 'tennis') {
      c.fillStyle = '#dfff38'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#f7f9ee'; c.lineWidth = 7;
      [24, 152].forEach(function (off) {
        c.beginPath();
        for (x = 0; x <= 80; x++) c.lineTo(off + x, 64 + Math.sin(x / 80 * Math.PI) * 50 - 25);
        c.stroke();
      });
    } else if (kind === 'basket') {
      c.fillStyle = '#d4702a'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#231a14'; c.lineWidth = 4;
      /* 赤道が1本、極を通る継ぎ目が1本（左右に分かれて2本に見える）、
         そのあいだにふくらんだ継ぎ目が2本。重ならないように置く。 */
      c.beginPath(); c.moveTo(0, 64); c.lineTo(256, 64); c.stroke();
      [0, 128, 256].forEach(function (p) { c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 128); c.stroke(); });
      [[64, 1], [192, -1]].forEach(function (v) {
        c.beginPath();
        for (var y = 0; y <= 128; y++) c.lineTo(v[0] + v[1] * Math.sin(y / 128 * Math.PI) * 26, y);
        c.stroke();
      });
    } else {
      c.fillStyle = '#f7f6f1'; c.fillRect(0, 0, 256, 128);
      /* 三色の曲がったパネルを経度方向へ繰り返す。継ぎ目も帯と一緒に曲げる。 */
      for (var n = -1; n < 7; n++) {
        c.fillStyle = ['#294da0', '#f3d62d', '#f7f6f1'][(n + 3) % 3];
        c.strokeStyle = '#39413d'; c.lineWidth = 1.3; c.beginPath();
        for (var y = 0; y <= 128; y += 2) c.lineTo(n * 43 + Math.sin(y / 128 * Math.PI * 2) * 16, y);
        for (var y = 128; y >= 0; y -= 2) c.lineTo((n + 1) * 43 + Math.sin(y / 128 * Math.PI * 2) * 16, y);
        c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(n * 43, 64); c.lineTo((n + 1) * 43, 64); c.stroke();
      }
    }
    return cv;
  }

  /* ============ 人 ============ */
  function makeAthlete(scene, opt) {
    var root = new T.Group(), parts = {};
    var skin = new T.MeshStandardMaterial({ color: '#d9a06a', roughness: .55 });
    var shirt = mat(opt.shirt, .75), pants = mat(opt.pants, .75), shoe = mat('#1d2129', .6);
    function part(parent, name, x, y, z) {
      var g = new T.Group(); g.position.set(x, y, z); parent.add(g); parts[name] = g; return g;
    }
    function blob(parent, sx, sy, sz, m, y, z) {
      var mesh = new T.Mesh(opt.simple ? SIMPLE_SPHERE : SPHERE, m);
      mesh.scale.set(sx, sy, sz); mesh.position.set(0, y || 0, z || 0);
      mesh.castShadow = !opt.simple; parent.add(mesh); return mesh;
    }
    var hips = part(root, 'hips', 0, .92, 0);
    blob(hips, .18, .16, .15, pants);
    var torso = part(hips, 'torso', 0, .05, 0);
    blob(torso, .21, .27, .16, shirt, .24);
    blob(torso, .115, .13, .125, skin, .58);                 /* 頭 */
    var cap = new T.Mesh(opt.simple ? SIMPLE_SPHERE : SPHERE, mat(opt.shirt, .7));
    cap.scale.set(.125, .085, .135); cap.position.set(0, .655, 0); cap.castShadow = !opt.simple; torso.add(cap);
    var visor = new T.Mesh(BOX, mat(opt.shirt, .7));
    visor.scale.set(.2, .02, .16); visor.position.set(0, .625, .155); torso.add(visor);
    ['L', 'R'].forEach(function (tag) {
      var side = tag === 'L' ? 1 : -1;
      var sh = part(torso, 'shoulder' + tag, side * .24, .46, 0);
      blob(sh, .062, .16, .062, skin, -.14);
      var el = part(sh, 'elbow' + tag, 0, -.3, 0);
      blob(el, .055, .15, .055, skin, -.13);
      var hand = part(el, 'hand' + tag, 0, -.28, 0);
      /* 手首。持ちものの向きは腕の角度と切り離して決める */
      part(hand, 'wrist' + tag, 0, 0, 0);
      var hip = part(hips, 'hip' + tag, side * .11, -.06, 0);
      blob(hip, .088, .22, .09, pants, -.2);
      var kn = part(hip, 'knee' + tag, 0, -.42, 0);
      blob(kn, .072, .21, .075, skin, -.2);
      blob(kn, .085, .05, .15, shoe, -.42, .06);
    });
    /* 競技ごとの持ちもの・身につけるもの。入切で見え隠れさせる */
    var worn = { yakyu: [], soccer: [], tennis: [], basket: [], volley: [] };
    if (opt.gear) {
      cap.material.color.set(COLORS.yakyu); visor.material.color.set(COLORS.yakyu);
      worn.yakyu.push(cap, visor);                            /* 帽子は野球のもの */
      ['L', 'R'].forEach(function (tag) {
        var kn = parts['knee' + tag];
        /* サッカー: 長いソックスとスパイク */
        worn.soccer.push(blob(kn, .083, .17, .086, mat(COLORS.soccer, .75), -.27));
        worn.soccer.push(blob(kn, .094, .056, .165, mat(COLORS.soccer, .6), -.425, .065));
        /* バレー: ひざあて */
        worn.volley.push(blob(kn, .09, .078, .092, mat(COLORS.volley, .8), -.02));
      });
      /* バスケ: ヘッドバンドと、右腕のスリーブ */
      var band = new T.Mesh(new T.TorusGeometry(.119, .027, 6, 16), mat(COLORS.basket, .7));
      band.rotation.x = Math.PI / 2; band.position.set(0, .565, 0); band.castShadow = true;
      torso.add(band); worn.basket.push(band);
      worn.basket.push(blob(parts.shoulderR, .068, .155, .068, mat(COLORS.basket, .8), -.15));
      worn.basket.push(blob(parts.elbowR, .061, .145, .061, mat(COLORS.basket, .8), -.13));
      /* テニス: ラケットを持つ手のリストバンド */
      var wristband = new T.Mesh(CYL, mat(COLORS.tennis, .7));
      wristband.scale.set(.062, .055, .062); wristband.position.y = .04;
      wristband.castShadow = true; parts.handL.add(wristband);
      worn.tennis.push(wristband);
    }
    /* 手前のプレイヤーだけ、服の縁・手・靴底などの立体を足す。 */
    if (opt.gear && !opt.simple) {
      var trim = mat('#f1e6d2', .8), sole = mat('#dce5e9', .9), seam = mat('#b52e2b', .85);
      function detail(parent, x, y, z, sx, sy, sz, material) {
        var m = blob(parent, sx, sy, sz, material, y, z); m.position.x = x; return m;
      }
      /* 首元と裾は体に沿った細い縁。背中に縦の縫い目を置く。 */
      var collar = new T.Mesh(new T.TorusGeometry(.085, .012, 6, 20), trim);
      collar.rotation.x = Math.PI / 2; collar.position.set(0, .48, 0); torso.add(collar);
      detail(torso, 0, .24, -.159, .007, .19, .005, seam);
      detail(torso, 0, .015, 0, .164, .019, .137, seam);
      detail(torso, 0, .675, 0, .025, .018, .025, seam);
      [-1, 1].forEach(function (side) {
        detail(torso, side * .112, .58, 0, .025, .039, .026, skin);
        detail(torso, side * .043, .598, .116, .012, .016, .007, shoe);
      });
      ['L', 'R'].forEach(function (tag) {
        var side = tag === 'L' ? 1 : -1, sh = parts['shoulder' + tag], hand = parts['hand' + tag], kn = parts['knee' + tag];
        detail(sh, 0, -.05, 0, .075, .083, .075, shirt);
        detail(sh, 0, -.108, 0, .068, .012, .068, trim);
        detail(hand, 0, -.015, .007, .057, .065, .047, skin);
        detail(hand, side * .039, .004, .032, .024, .04, .025, skin);
        detail(kn, 0, -.465, .064, .096, .018, .167, sole);
        detail(kn, 0, -.426, -.073, .066, .045, .025, trim);
        for (var i = 0; i < 3; i++) detail(kn, 0, -.38 - i * .008, .095 + i * .025, .049, .006, .008, trim);
      });
    }
    var batParts = [], racketParts = [];
    if (opt.bat) {                                            /* 右手はバット。手首から上へ伸ばす */
      var bat = new T.Mesh(new T.CylinderGeometry(.05, .023, .92, 12), mat(COLORS.yakyu, .55));
      bat.position.y = .46; bat.castShadow = true;
      var batGrip = new T.Mesh(CYL, mat('#23272f', .85));
      batGrip.scale.set(.026, .17, .026); batGrip.position.y = .08;
      parts.wristR.add(bat, batGrip);
      batParts = [bat, batGrip];
    }
    if (opt.racket) {                                         /* 左手はラケット。面を斜めに開き、構えでも見えるようにする */
      var frame = new T.Mesh(new T.TorusGeometry(.165, .023, 8, 22), mat(COLORS.tennis, .4, .25));
      frame.position.y = .45; frame.rotation.y = .35; frame.castShadow = true;
      var gut = new T.Mesh(new T.CircleGeometry(.152, 20), new T.MeshBasicMaterial({ color: '#f4f7fa', transparent: true, opacity: .42, side: T.DoubleSide }));
      gut.position.y = .45; gut.rotation.y = .35;
      var throat = new T.Mesh(CYL, mat(COLORS.tennis, .4, .25));
      throat.scale.set(.02, .12, .02); throat.position.y = .26;
      var grip = new T.Mesh(CYL, mat('#23272f', .85));
      grip.scale.set(.025, .2, .025); grip.position.y = .1;
      parts.wristL.add(frame, gut, throat, grip);
      racketParts = [frame, gut, throat, grip];
    }
    if (opt.glove) {
      var glove = new T.Mesh(SPHERE, mat('#8a5a2f', .8));
      glove.scale.set(.13, .15, .07); glove.castShadow = true; parts.handL.add(glove);
    }
    worn.yakyu = worn.yakyu.concat(batParts);
    worn.tennis = worn.tennis.concat(racketParts);
    scene.add(root);
    return { root: root, parts: parts, worn: worn, holdsItem: !!(opt.bat || opt.racket) };
  }

  /* ============ 舞台 ============ */
  function Scene() {
    T = THREE;
    var self = this;
    SPHERE = new T.SphereGeometry(1, 14, 10);
    /* 奥の選手は少ない面数を共有し、個々の影も省いて軽くする。 */
    SIMPLE_SPHERE = new T.SphereGeometry(1, 8, 6);
    CYL = new T.CylinderGeometry(1, 1, 1, 12);
    BOX = new T.BoxGeometry(1, 1, 1);

    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new T.Scene();
    this.scene.fog = new T.Fog('#16334c', 80, 190);
    /* 空。上から水平線へ向けて明るくする */
    var skyCv = document.createElement('canvas');
    skyCv.width = 8; skyCv.height = 128;
    var sc = skyCv.getContext('2d');
    var grd = sc.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#060d17'); grd.addColorStop(.6, '#15304a'); grd.addColorStop(1, '#31607e');
    sc.fillStyle = grd; sc.fillRect(0, 0, 8, 128);
    var sky = new T.Mesh(new T.SphereGeometry(200, 16, 12),
      new T.MeshBasicMaterial({ map: texture(skyCv), side: T.BackSide, fog: false }));
    this.scene.add(sky);
    this.camera = new T.PerspectiveCamera(50, 540 / 960, .1, 400);
    this.w = 540; this.h = 960; this.logicalH = 960;

    this.scene.add(new T.HemisphereLight('#d6e9ff', '#4d5b3c', 1.9));
    var key = new T.DirectionalLight('#fff3da', 2.6);
    key.position.set(-16, 40, -6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -24, right: 24, top: 30, bottom: -18, near: 1, far: 120 });
    key.target.position.set(0, 0, 10); key.shadow.bias = -.0004;
    this.scene.add(key, key.target);
    var fill = new T.DirectionalLight('#9fc6e8', 1.1);
    fill.position.set(12, 14, 26); this.scene.add(fill);

    /* 地面 */
    var ft = texture(fieldTexture({ yakyu: 1, soccer: 1, tennis: 1, basket: 1, volley: 1 }));
    ft.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    var ground = new T.Mesh(new T.PlaneGeometry(FIELD.w, FIELD.d), new T.MeshStandardMaterial({ map: ft, roughness: .92 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, FIELD.z0 + FIELD.d / 2);
    ground.receiveShadow = true; this.scene.add(ground);
    var outer = new T.Mesh(new T.PlaneGeometry(220, 320), mat('#25532f', .95));
    outer.rotation.x = -Math.PI / 2; outer.position.set(0, -.02, 30); this.scene.add(outer);

    function box(x, y, z, w, h, d, m, cast) {
      var mesh = new T.Mesh(BOX, m);
      mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
      mesh.receiveShadow = true; if (cast !== false) mesh.castShadow = true;
      self.scene.add(mesh); return mesh;
    }
    function post(x, y, z, r, h, m, rotZ) {
      var mesh = new T.Mesh(CYL, m);
      mesh.scale.set(r, h, r); mesh.position.set(x, y, z);
      if (rotZ) mesh.rotation.z = rotZ;
      mesh.castShadow = true; self.scene.add(mesh); return mesh;
    }
    /* cell は目の大きさ（メートル） */
    function netPanel(x, y, z, w, h, cell, color, rotY) {
      var tx = texture(netTexture(color));
      tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(w / (cell * 4), h / (cell * 4));
      var mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx, transparent: true, side: T.DoubleSide, depthWrite: false }));
      mesh.position.set(x, y, z); if (rotY) mesh.rotation.y = rotY;
      self.scene.add(mesh); return mesh;
    }
    var white = mat('#eef1ee', .5), metal = mat('#8e9aa4', .4, .5), dark = mat('#20262e', .7);

    /* まとめて作ってから、置き場所と向きを決める */
    function group(x, z, rotY, build) {
      var start = self.scene.children.length;
      build();
      var g = new T.Group();
      self.scene.children.slice(start).forEach(function (m) { g.add(m); });
      g.position.set(x, 0, z); g.rotation.y = rotY || 0;
      self.scene.add(g); return g;
    }

    /* サッカーゴール。z=0 に置き、開いている側が手前 */
    function soccerGoal() {
      post(-3.66, 1.22, 0, .1, 2.44, white); post(3.66, 1.22, 0, .1, 2.44, white);
      post(0, 2.44, 0, .1, 7.32, white, Math.PI / 2);
      netPanel(0, 1.22, 1.6, 7.3, 2.44, .13, 'rgba(238,242,238,.85)');
      netPanel(0, 2.0, .8, 7.3, 1.7, .13, 'rgba(238,242,238,.5)');
    }
    var gear = this.gear = { yakyu: [], soccer: [], tennis: [], basket: [], volley: [] };
    gear.soccer.push(group(0, 78, 0, soccerGoal), group(-26, 44, Math.PI / 2, soccerGoal));

    /* バスケットゴール。リングは手前側（-z）へ張り出す */
    function hoop() {
      post(0, 1.9, 1.6, .11, 3.8, metal);
      box(0, 3.5, .8, .16, .16, 1.6, metal);
      var bb = box(0, 3.5, 0, 1.8, 1.05, .06, new T.MeshStandardMaterial({ color: '#f2f4f6', roughness: .35, transparent: true, opacity: .82 }));
      bb.renderOrder = 1;
      box(0, 3.35, -.05, .59, .45, .08, mat('#c9552f', .6));
      var ring = new T.Mesh(new T.TorusGeometry(.33, .028, 6, 18), mat('#e2622c', .5, .3));
      ring.rotation.x = Math.PI / 2; ring.position.set(0, 3.05, -.43); ring.castShadow = true;
      self.scene.add(ring);
      netPanel(0, 2.82, -.43, .66, .45, .05, 'rgba(245,247,245,.9)');
      netPanel(0, 2.82, -.43, .66, .45, .05, 'rgba(245,247,245,.9)', Math.PI / 2);
    }
    gear.basket.push(group(0, 24.5, 0, hoop));

    /* バレーのネット */
    gear.volley.push(group(0, 13, 0, function () {
      post(-5.6, 1.3, 0, .07, 2.6, metal); post(5.6, 1.3, 0, .07, 2.6, metal);
      netPanel(0, 2.05, 0, 11.2, 1, .1, 'rgba(232,236,232,.85)');
      box(0, 2.53, 0, 11.2, .1, .03, white, false);
    }));

    /* テニスのネット */
    gear.tennis.push(group(0, 8, 0, function () {
      post(-6.4, .6, 0, .06, 1.2, metal); post(6.4, .6, 0, .06, 1.2, metal);
      netPanel(0, .52, 0, 12.8, 1.04, .045, 'rgba(70,80,92,.75)');
      box(0, 1.06, 0, 12.8, .08, .03, white, false);
    }));

    /* 野球のバックネット。打つ人の後ろなので、カメラの外に置く */
    var backstop = new T.Mesh(new T.CylinderGeometry(9, 9, 5, 20, 1, true, Math.PI * .74, Math.PI * .52), (function () {
      var tx = texture(netTexture('rgba(190,200,206,.7)'));
      tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(60, 12);
      return new T.MeshBasicMaterial({ map: tx, transparent: true, side: T.DoubleSide, depthWrite: false });
    })());
    backstop.position.set(0, 2.5, -2); this.scene.add(backstop);
    gear.yakyu.push(backstop);

    /* 観客席と照明 */
    var crowd = texture(crowdTexture());
    crowd.wrapS = crowd.wrapT = T.RepeatWrapping;
    /* w は客席の長さ、d は厚み。back のときは奥の正面に横へ寝かせる */
    function stand(x, z, w, d, back) {
      var c = crowd.clone(); c.needsUpdate = true; c.repeat.set(w / 7, 1.6);
      box(x, 5, z, back ? w : d, 10, back ? d : w, dark, false);
      var face = new T.Mesh(new T.PlaneGeometry(w, 11), new T.MeshBasicMaterial({ map: c }));
      if (back) {
        face.position.set(x, 6.5, z - d / 2);
        face.rotation.set(-.16, Math.PI, 0);
      } else {
        face.position.set(x + (x < 0 ? d / 2 : -d / 2), 6.5, z);
        face.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        face.rotation.x = -.16;
      }
      self.scene.add(face);
    }
    stand(-34, 30, 104, 8);
    stand(34, 30, 104, 8);
    stand(0, 90, 74, 8, true);
    for (var i = 0; i < 4; i++) {
      var lx = i % 2 ? 22 : -22, lz = i < 2 ? 70 : 20;
      post(lx, 10, lz, .32, 20, metal);
      var head = box(lx, 20.6, lz, 4.6, 1.5, .5, mat('#2a323c', .5));
      head.lookAt(0, 0, 20);
      for (var j = 0; j < 8; j++) {
        var lamp = box(lx + (j % 4 - 1.5) * 1.1 * (lx < 0 ? 1 : -1), 20.2 + (j < 4 ? .5 : -.5), lz + (lx < 0 ? .3 : -.3), .8, .5, .12,
          new T.MeshBasicMaterial({ color: '#fff6d8' }), false);
        lamp.lookAt(0, 0, 20);
      }
    }
    box(0, 11, 88, 22, 7, .6, mat('#161d26', .8));
    for (var r = 0; r < 3; r++) for (var q = 0; q < 9; q++) {
      box(-8 + q * 2, 13 - r * 2, 87.6, 1.5, 1.3, .1, new T.MeshBasicMaterial({ color: (q + r) % 3 ? '#243040' : '#f0b64a' }), false);
    }

    /* 小物。どの競技のものも散らかしておく */
    function flag(side, color) {
      post(0, .8, 0, .045, 1.6, white);
      var f = new T.Mesh(new T.PlaneGeometry(.62, .42), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      f.position.set(side * .31, 1.38, 0); self.scene.add(f);
    }
    [[-28, 78, '#f0c33c'], [28, 78, '#f0c33c'], [-28, -18, '#e0604a'], [28, -18, '#e0604a']].forEach(function (p) {
      gear.soccer.push(group(p[0], p[1], 0, function () { flag(p[0] < 0 ? -1 : 1, p[2]); }));
    });

    function umpChair(x, z, rotY) {
      return group(x, z, rotY, function () {
        [-.42, .42].forEach(function (s) { post(s, 1.15, -.33, .045, 2.3, metal); post(s, 1.15, .33, .045, 2.3, metal); });
        box(0, 2.32, 0, 1.05, .1, .86, mat('#39485a', .7));
        box(0, 2.7, -.42, 1.05, .76, .1, mat('#39485a', .7));
        box(0, 1.2, 0, .9, .06, .7, mat('#39485a', .7));
      });
    }
    gear.tennis.push(umpChair(7.4, 8, -Math.PI / 2));
    gear.volley.push(umpChair(-6.6, 13, Math.PI / 2));

    function bench(x, z, rotY) {
      group(x, z, rotY, function () {
        box(0, .44, 0, 3.4, .1, .46, mat('#c8873f', .8));
        box(0, .74, -.24, 3.4, .5, .08, mat('#c8873f', .8));
        [-1.5, 1.5].forEach(function (s) { post(s, .22, 0, .05, .44, metal); });
      });
    }
    bench(-9.5, 3, Math.PI / 2); bench(10.2, 11, -Math.PI / 2); bench(-11, 22, Math.PI / 2);

    /* 球かご。5競技の球を放り込んである */
    function basket5(x, z) {
      box(x, .3, z, 1.1, .6, 1.1, new T.MeshStandardMaterial({ color: '#2b3340', roughness: .6, transparent: true, opacity: .55 }));
      ['#f6f3ea', '#d4702a', '#d3e64a', '#f4f4f0', '#e5c33f'].forEach(function (col, n) {
        var b = new T.Mesh(SPHERE, mat(col, .5));
        b.scale.setScalar(.18 + (n % 2) * .05);
        b.position.set(x + (n % 3 - 1) * .32, .68, z + ((n / 3 | 0) - .5) * .32);
        b.castShadow = true; self.scene.add(b);
      });
    }
    basket5(-8.6, 6.5); basket5(9.4, 17);

    /* 球。競技ごとに1個ずつ用意して使い回す */
    this.ballMeshes = {};
    var ballSphere = new T.SphereGeometry(1, 28, 20);
    ['yakyu', 'soccer', 'tennis', 'basket', 'volley'].forEach(function (kind) {
      var pool = [], ballMap = texture(ballTexture(kind));
      for (var n = 0; n < 6; n++) {
        var m = new T.Mesh(ballSphere, new T.MeshStandardMaterial({ map: ballMap, roughness: kind === 'basket' ? .85 : .45, emissive: kind === 'tennis' ? '#829b16' : '#000000', emissiveIntensity: kind === 'tennis' ? .3 : 0 }));
        m.castShadow = true; m.visible = false;
        /* 縁取り。ひと回り大きい球の裏側だけを描いて、輪郭として残す */
        var edge = new T.Mesh(ballSphere, new T.MeshBasicMaterial({ color: '#121a24', side: T.BackSide }));
        edge.scale.setScalar(1.13); m.add(edge);
        /* 白い帯を使い回し、先端から後方へ細く薄くする。 */
        var trailGeo = new T.BufferGeometry();
        trailGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(198), 3));
        var trailColors = new Float32Array(198);
        for (var j = 0; j < 11; j++) {
          [j, j, j + 1, j + 1, j, j + 1].forEach(function (point, v) {
            var fade = Math.pow(1 - point / 11, 1.5);
            for (var c = 0; c < 3; c++) trailColors[(j * 6 + v) * 3 + c] = fade;
          });
        }
        trailGeo.setAttribute('color', new T.BufferAttribute(trailColors, 3));
        m.userData.trail = new T.Mesh(trailGeo, new T.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, side: T.DoubleSide, transparent: true, opacity: .65, blending: T.AdditiveBlending, depthWrite: false }));
        m.userData.trail.frustumCulled = false;
        m.userData.trail.visible = false;
        self.scene.add(m.userData.trail);
        self.scene.add(m); pool.push(m);
      }
      self.ballMeshes[kind] = pool;
    });

    /* 選手と投手 */
    this.player = makeAthlete(this.scene, { shirt: '#d8402f', pants: '#1f2a3a', bat: true, racket: true, gear: true });
    this.pitcher = makeAthlete(this.scene, { shirt: COLORS.yakyu, pants: '#39506e', glove: true });
    this.pitcher.root.position.set(0, .28, 11);
    this.pitcher.root.rotation.y = Math.PI;
    var mound = new T.Mesh(new T.CylinderGeometry(2.9, 3.2, .3, 20), mat('#b77c47', .95));
    mound.position.set(0, .14, 11); mound.receiveShadow = true; this.scene.add(mound);
    gear.yakyu.push(mound, this.pitcher.root);
    this.ground = ground; this.fieldTex = ft; this.sportsKey = null;

    /* 奥に立っている人たち。競技ごとに揃いの色で、入切で出入りする */
    var UNIFORM = {
      yakyu: [COLORS.yakyu, '#39506e'], soccer: [COLORS.soccer, '#f0f2f0'],
      tennis: [COLORS.tennis, '#e6e9ee'], basket: [COLORS.basket, '#2a2f3a'],
      volley: [COLORS.volley, '#1f2a3a']
    };
    this.extras = [];
    [['tennis', -4.6, 18], ['tennis', 4.3, 21.5], ['tennis', -8.6, 13],
     ['volley', -3.4, 17.5], ['volley', 3.2, 20], ['volley', 6.4, 16],
     ['basket', -7.6, 11], ['basket', 7.2, 21], ['basket', 2.2, 27], ['basket', -2.6, 30],
     ['yakyu', -12, 11], ['yakyu', 12, 11], ['yakyu', 0, 23], ['yakyu', -17, 27], ['yakyu', 17, 29],
     ['soccer', -2.2, 38], ['soccer', 7.6, 42], ['soccer', -10.5, 35], ['soccer', 13.4, 33],
     ['soccer', 2.8, 52], ['soccer', -5.4, 58], ['soccer', 9.8, 62]
    ].forEach(function (e, n) {
      var u = UNIFORM[e[0]];
      var a = makeAthlete(self.scene, { shirt: u[0], pants: u[1], simple: true });
      a.root.position.set(e[1], 0, e[2]);
      a.sport = e[0]; a.home = [e[1], e[2]];
      a.face = Math.atan2(-e[1], -.9 - e[2]);            /* ふだんは打つ人のほう */
      a.root.rotation.y = a.face;
      a.phase = n * 1.3;
      self.extras.push(a);
      gear[e[0]].push(a.root);
    });

    this.shake = 0;
  }

  Scene.prototype.resize = function (w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    /* タテ長でも横の写る範囲を保つ */
    this.camera.fov = 2 * Math.atan(Math.tan(34 * Math.PI / 180) * (h / w) / (960 / 540)) * 180 / Math.PI;
    this.camera.updateProjectionMatrix();
  };

  /* 入れてある競技だけを出す。地面の線は引き直し、道具と持ちものは見え隠れさせる */
  Scene.prototype.applySports = function (key) {
    var set = {}, self = this;
    key.split(',').forEach(function (k) { if (k) set[k] = 1; });
    Object.keys(this.gear).forEach(function (kind) {
      self.gear[kind].forEach(function (o) { o.visible = !!set[kind]; });
      self.player.worn[kind].forEach(function (m) { m.visible = !!set[kind]; });
    });
    this.player.hasBat = !!set.yakyu;
    this.player.hasRacket = !!set.tennis;
    fieldTexture(set);
    this.fieldTex.needsUpdate = true;
  };

  Scene.prototype.project = function (x, y, z) {
    var v = new T.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * .5 + .5) * 540, y: (.5 - v.y * .5) * this.logicalH, z: v.z };
  };

  /* 立ち姿にしてから、動作ぶんだけ足す。
     持ちものの角度（BAT/RKT）は腕の曲げ具合とは別に決め、最後に手首で辻褄を合わせる。
     0 で真上、＋で前へ倒す、−で後ろへ倒す。こうすると腕をどう動かしても、
     バットが胴を突き抜けたり、ラケットが体の中へ入ったりしない。 */
  var BAT = -.45, RKT = .35;                                   /* 構えたときの角度 */
  var PLAYER_NDC = 1 - 2 * .655;                                /* 選手を画面の68%の高さに置く */
  var QA = null, QB = null, EU = null;
  /* 持ちものを、腕の形に関わらず体（腰）から見た向きへ合わせる。
     angleX は 0 で真上・＋で前へ倒す、leanZ は体の外へ開く角度。 */
  function aimItem(hips, hand, wrist, angleX, leanZ) {
    if (!QA) { QA = new T.Quaternion(); QB = new T.Quaternion(); EU = new T.Euler(); }
    EU.set(angleX, 0, leanZ, 'YXZ');
    QA.setFromEuler(EU);
    QA.premultiply(hips.getWorldQuaternion(QB));
    wrist.quaternion.copy(hand.getWorldQuaternion(QB).invert()).multiply(QA);
  }
  Scene.prototype.pose = function (a, act, p, t) {
    var P = a.parts;
    a.root.position.y = 0;
    a.root.rotation.y = 0;
    P.hips.rotation.set(0, 0, 0);
    P.torso.rotation.set(.12 + Math.sin(t * 3) * .03, 0, 0);
    /* 右腕はバットを右肩の上へ、左腕はラケットを前へ。腕は体の外側へ開く */
    P.shoulderR.rotation.set(-.30, 0, -.30); P.elbowR.rotation.set(-1.70, 0, 0);
    P.shoulderL.rotation.set(-.45, 0, .55); P.elbowL.rotation.set(-1.30, 0, 0);
    P.hipL.rotation.set(-.16, 0, .1); P.kneeL.rotation.set(.26, 0, 0);
    P.hipR.rotation.set(-.16, 0, -.1); P.kneeR.rotation.set(.26, 0, 0);
    /* 持っていない側の腕は、構えずに下ろす */
    if (a.hasBat === false) { P.shoulderR.rotation.set(-.12, 0, -.16); P.elbowR.rotation.set(-.5, 0, 0); }
    if (a.hasRacket === false) { P.shoulderL.rotation.set(-.12, 0, .16); P.elbowL.rotation.set(-.45, 0, 0); }
    var bat = BAT, racket = RKT, batLean = -.3, racketLean = .55;
    if (act) {
      var e = Math.max(0, Math.min(1, p));
      var s = 1 - Math.pow(1 - Math.min(1, e / .45), 3);      /* 振り抜き */
      /* 振り終わったら、はじめに大きく戻して構えへ収める（余韻を残さない） */
      var w = e < .55 ? 1 : 1 - Math.pow((e - .55) / .45, .65);
      var k = s * w;
      if (act === 'yakyu') {                                   /* 腰を回してバットを水平に振る */
        P.hips.rotation.y = -2.6 * k + .65 * w;
        P.torso.rotation.y = -.7 * k + .25 * w;
        P.shoulderR.rotation.x += -.5 * k; P.shoulderR.rotation.z += -.7 * k;
        P.elbowR.rotation.x += 1.3 * k;
        P.hipR.rotation.x += -.3 * k;
        P.shoulderL.rotation.x += .55 * k; P.shoulderL.rotation.z += -.2 * k;
        P.elbowL.rotation.x += -.35 * k;                       /* ラケットは邪魔にならぬよう引く */
        bat = BAT - .35 * w + 2.15 * k; batLean = -.3 + .25 * k;
        racket = RKT - .8 * k;
      } else if (act === 'tennis') {                           /* 逆回りでラケットを払う */
        P.hips.rotation.y = 2.3 * k - .55 * w;
        P.torso.rotation.y = .6 * k - .2 * w;
        P.shoulderL.rotation.x += -.4 * k; P.shoulderL.rotation.z += .7 * k;
        P.elbowL.rotation.x += 1.0 * k;
        P.shoulderR.rotation.x += .5 * k; P.shoulderR.rotation.z += .2 * k;
        P.elbowR.rotation.x += -.3 * k;                        /* バットは肩へ担いだまま */
        racket = RKT - .9 * w + 2.1 * k; racketLean = .35 - .25 * k;
        bat = BAT - .45 * k;
      } else if (act === 'soccer') {                           /* 右足を振り出す。持ちものは構えたまま */
        P.hipR.rotation.x += -1.9 * k; P.kneeR.rotation.x += -.85 * k;
        P.hipL.rotation.x += .25 * k; P.kneeL.rotation.x += .2 * k;
        P.torso.rotation.x += -.22 * k;                        /* 蹴り足の反対へ少し反る */
        P.shoulderL.rotation.x += -.9 * k; P.shoulderR.rotation.x += .5 * k;
        a.root.position.y = Math.sin(Math.PI * e) * .05 * w;
      } else if (act === 'basket') {                           /* 跳んで両手で押し出す */
        a.root.position.y = Math.sin(Math.PI * Math.min(1, e / .8)) * .42 * w;
        P.shoulderR.rotation.x += -2.3 * k; P.shoulderL.rotation.x += -2.3 * k;
        P.elbowR.rotation.x += 1.2 * k; P.elbowL.rotation.x += 1.2 * k;
        P.hipR.rotation.x += .3 * k; P.hipL.rotation.x += .3 * k;
        bat = BAT + .35 * k; racket = RKT - .3 * k;            /* 手が上がるぶん立てる */
        batLean = -.3 + .12 * k; racketLean = .35 - .15 * k;
      } else if (act === 'volley') {                           /* 跳んで、振りかぶってから打ち下ろす */
        var up = Math.min(1, e / .35) * w, hit = Math.max(0, Math.min(1, (e - .35) / .3)) * w;
        a.root.position.y = Math.sin(Math.PI * Math.min(1, e / .9)) * .8 * w;
        P.shoulderR.rotation.x += -3.3 * up + 4.0 * hit;
        P.elbowR.rotation.x += 1.0 * up - .6 * hit;
        P.shoulderL.rotation.x += -1.1 * up + .4 * hit;
        P.torso.rotation.x += -.35 * up + .7 * hit;
        P.hipL.rotation.x += -.5 * hit;
        bat = BAT - 1.0 * up + 2.9 * hit; batLean = -.3 + .2 * hit;
        racket = RKT + .5 * up - .3 * hit;
      }
    }
    /* 腕の形が決まってから、持ちものの向きだけ入れ直す（持っている人だけ） */
    if (a.holdsItem) {
      a.root.updateMatrixWorld(true);
      if (P.wristR) aimItem(P.hips, P.handR, P.wristR, bat, batLean);
      if (P.wristL) aimItem(P.hips, P.handL, P.wristL, racket, racketLean);
    }
  };

  /* ============ 奥の人たちの動き ============
     持ち場のまわりを行き来させ、競技ごとの構えを足す。 */
  var MOVE = {
    yakyu:  { speed: .50, rx: 1.0, rz: .6 },
    soccer: { speed: .75, rx: 5.5, rz: 3.4 },
    tennis: { speed: 1.00, rx: 2.4, rz: 1.0 },
    basket: { speed: .90, rx: 3.6, rz: 2.2 },
    volley: { speed: 1.10, rx: 1.8, rz: .9 }
  };
  Scene.prototype.idle = function (a, t) {
    var P = a.parts, ph = a.phase, m = MOVE[a.sport] || MOVE.yakyu;
    this.pose(a, null, 0, t + ph);
    var u = t * m.speed + ph;
    var vx = Math.cos(u) * m.rx * m.speed;
    var vz = Math.cos(u * .7 + 1.3) * m.rz * m.speed * .7;
    var sp = Math.sqrt(vx * vx + vz * vz);
    a.root.position.x = a.home[0] + Math.sin(u) * m.rx;
    a.root.position.z = a.home[1] + Math.sin(u * .7 + 1.3) * m.rz;
    a.face = Math.atan2(this.player.root.position.x - a.root.position.x,
      this.player.root.position.z - a.root.position.z); /* 移動中も手前のプレイヤーを向く */
    a.root.rotation.y = a.face;

    /* 足取り。速いほど大きく振る */
    var swing = Math.min(1, sp / 2.2), step = t * (4.5 + sp) + ph * 2;
    var lift = Math.sin(step);
    a.root.position.y = Math.abs(lift) * .07 * swing;
    P.hipL.rotation.x += lift * .75 * swing;
    P.hipR.rotation.x += -lift * .75 * swing;
    P.kneeL.rotation.x += Math.max(0, -lift) * .85 * swing;
    P.kneeR.rotation.x += Math.max(0, lift) * .85 * swing;
    P.shoulderL.rotation.x += -lift * .8 * swing;
    P.shoulderR.rotation.x += lift * .8 * swing;

    /* 競技ごとの構え */
    if (a.sport === 'yakyu') {                             /* 腰を落としてグラブを前へ */
      P.torso.rotation.x += .22;
      P.hipL.rotation.x += -.3; P.hipR.rotation.x += -.3;
      P.kneeL.rotation.x += .45; P.kneeR.rotation.x += .45;
      P.shoulderL.rotation.x += -.7; P.elbowL.rotation.x += -.5;
      P.shoulderR.rotation.x += -.4;
    } else if (a.sport === 'basket') {                     /* 片手でつく */
      var d = Math.sin(t * 6 + ph * 3);
      P.shoulderR.rotation.x += -.9 + d * .45;
      P.elbowR.rotation.x += .55;
      P.shoulderL.rotation.z += -.5;
      P.torso.rotation.x += .12;
    } else if (a.sport === 'tennis') {                     /* 小刻みに跳ねて構える */
      a.root.position.y += Math.abs(Math.sin(t * 3.4 + ph)) * .09;
      P.shoulderL.rotation.x += -.9; P.shoulderR.rotation.x += -.7;
      P.elbowL.rotation.x += .5; P.elbowR.rotation.x += .5;
      P.torso.rotation.x += .16;
    } else if (a.sport === 'volley') {                     /* 低く構えて、ときどき跳ぶ */
      var jump = Math.max(0, Math.sin(t * 1.3 + ph * 2) - .82) / .18;
      a.root.position.y += jump * .55;
      P.torso.rotation.x += .3 - jump * .5;
      P.hipL.rotation.x += -.45; P.hipR.rotation.x += -.45;
      P.kneeL.rotation.x += .7; P.kneeR.rotation.x += .7;
      P.shoulderL.rotation.x += -1.1 - jump * 1.8; P.shoulderR.rotation.x += -1.1 - jump * 1.8;
      P.elbowL.rotation.x += .9; P.elbowR.rotation.x += .9;
    } else {                                               /* サッカーは走るだけ */
      P.torso.rotation.x += .1 * swing;
    }
  };

  /* 投手。渡された進みぐあいで振りかぶって投げる */
  Scene.prototype.posePitcher = function (p, t) {
    var a = this.pitcher, P = a.parts;
    this.pose(a, null, 0, t + 1.7);
    if (p < 0) return;
    var e = Math.max(0, Math.min(1, p));
    var wind = Math.min(1, e / .55), throwing = Math.max(0, (e - .55) / .45);
    P.shoulderR.rotation.x += -2.4 * wind + 3.4 * throwing;
    P.elbowR.rotation.x += -.6 * wind + .8 * throwing;
    P.torso.rotation.x += -.25 * wind + .5 * throwing;
    P.hipL.rotation.x += -.9 * wind + 1.1 * throwing;
    P.kneeL.rotation.x += 1.2 * wind - 1.4 * throwing;
  };

  Scene.prototype.draw = function (ctx, W, H, snap) {
    this.logicalH = H;
    var t = snap.t, self = this;
    if (this.sportsKey !== snap.on) { this.applySports(snap.on || ''); this.sportsKey = snap.on; }

    this.pose(this.player, snap.act, snap.actP, t);
    this.player.root.position.x = snap.leanX || 0;
    this.player.root.position.z = -.9;
    this.player.root.rotation.z = 0;
    if (snap.fall >= 0) {
      /* 一瞬膝を落としてから横に倒れ、結果画面ではその姿勢を保つ。 */
      var fall = snap.fall, eased = fall * fall * (3 - 2 * fall), body = this.player.parts;
      this.player.root.rotation.z = -Math.PI * .49 * eased;
      this.player.root.position.y = .18 * eased;
      body.torso.rotation.x += .18 * Math.sin(fall * Math.PI);
      body.shoulderL.rotation.z += .55 * eased;
      body.shoulderR.rotation.z -= .35 * eased;
      body.kneeL.rotation.x += .4 * eased;
      body.kneeR.rotation.x += .22 * eased;
    }
    this.posePitcher(snap.pitch, t);
    this.extras.forEach(function (a) {
      if (!a.root.visible) return;                       /* 出ていない競技の人は動かさない */
      self.idle(a, t);
    });

    /* 球を並べる。余ったものは隠す */
    var used = { yakyu: 0, soccer: 0, tennis: 0, basket: 0, volley: 0 };
    snap.balls.forEach(function (b) {
      var pool = self.ballMeshes[b.kind], m = pool[used[b.kind]++];
      if (!m) return;
      m.visible = true;
      var tail = m.userData.trail, points = b.trail || [];
      tail.visible = points.length > 1;
      if (tail.visible) {
        var positions = tail.geometry.attributes.position, edges = [];
        points.forEach(function (p, j) {
          var next = points[Math.min(j + 1, points.length - 1)], prev = points[Math.max(0, j - 1)];
          var tangent = new T.Vector3(next.x - prev.x, next.y - prev.y, next.z - prev.z);
          var facing = new T.Vector3().subVectors(self.camera.position, new T.Vector3(p.x, p.y, p.z));
          var across = tangent.cross(facing).normalize().multiplyScalar(.060 * (1 - j / 14));
          edges.push([{ x: p.x + across.x, y: p.y + across.y, z: p.z + across.z }, { x: p.x - across.x, y: p.y - across.y, z: p.z - across.z }]);
        });
        for (var j = 0; j < points.length - 1; j++) {
          [edges[j][0], edges[j][1], edges[j + 1][0], edges[j + 1][0], edges[j][1], edges[j + 1][1]].forEach(function (p, v) { positions.setXYZ(j * 6 + v, p.x, p.y, p.z); });
        }
        positions.needsUpdate = true; tail.geometry.setDrawRange(0, (points.length - 1) * 6);
      }
      m.position.set(b.x, b.y, b.z);
      m.scale.setScalar(b.r);
      /* 球の半径にかかわらず、輪郭の厚みを揃える。 */
      m.children[0].scale.setScalar(1 + .018 / b.r);
      m.rotation.set(b.z * 1.4, b.x * 2 + t * 3, b.spin || 0);
    });
    Object.keys(used).forEach(function (kind) {
      for (var i = used[kind]; i < self.ballMeshes[kind].length; i++) {
        self.ballMeshes[kind][i].visible = false;
        self.ballMeshes[kind][i].userData.trail.visible = false;
      }
    });

    /* 打った瞬間だけ少し揺らす */
    this.shake = Math.max(0, (snap.shake || 0));
    var sh = this.shake * .25;
    /* 開始前は全景、開始すると元の近い位置へゆっくり加速して寄る。 */
    var mix = snap.cameraMix == null ? 1 : snap.cameraMix;
    mix = mix * mix * (3 - 2 * mix);
    var angle = 34 + (28 - 34) * mix;
    this.camera.fov = 2 * Math.atan(Math.tan(angle * Math.PI / 180) * (this.h / this.w) / (960 / 540)) * 180 / Math.PI;
    this.camera.updateProjectionMatrix();
    this.camera.position.set((Math.random() - .5) * sh, 16 + (5.2 - 16) * mix + (Math.random() - .5) * sh, -24 + (-7.8 + 24) * mix);
    this.camera.lookAt(0, .9, 11.5);
    this.camera.updateMatrixWorld();
    /* 画面の形で上下の写る範囲が変わるので、選手がいつも同じ高さに来るまで傾ける。
       下に並べたボタンへ選手がかぶらないようにするため。 */
    if (!this.aimPoint) this.aimPoint = new T.Vector3();
    var ndc = this.aimPoint.set(0, 1.0, -.9).project(this.camera).y;
    var half = Math.tan(this.camera.fov * Math.PI / 360);
    this.camera.rotateX(-(Math.atan((PLAYER_NDC - .06 * mix) * half) - Math.atan(ndc * half)));
    this.camera.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  return Scene;
})();
