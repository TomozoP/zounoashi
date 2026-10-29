/* 同時にいる人を数える小さな仕組み（MQTT 3.1.1 を WebSocket で、QoS0 だけ）。
   サーバーは置かず、無料の公開ブローカーに複数つなぎ、同じ合図を全部に送る（片方が落ちても数えられる）。
   各自が「id,引っぱり中か,来た時刻」を2秒ごと（引っぱり中は0.8秒ごと）に流し、
   5秒以内に聞こえた id を「いる人」、2秒以内に「引っぱり中」と言った id を「引っぱっている人」と数える。

   var p = zPresence({ topic: "...", onDone: fn });
   p.setPulling(true/false);  p.peers() → [{id, pull, since, me}]（来た順）
   p.sendDone();  p.status() → つながっているブローカーの数 */
(function () {
  "use strict";
  var BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt"
  ];
  var q = /[?&]broker=([^&]+)/.exec(location.search);   /* 手元の確認用 */
  if (q) BROKERS = [decodeURIComponent(q[1])];
  var enc = new TextEncoder(), dec = new TextDecoder();

  function str(s) { var b = enc.encode(s); return [b.length >> 8, b.length & 255].concat(Array.from(b)); }
  function packet(type, body) {
    var len = body.length, head = [type];
    do { var d = len % 128; len = Math.floor(len / 128); head.push(len > 0 ? d | 128 : d); } while (len > 0);
    return new Uint8Array(head.concat(body));
  }

  function Conn(url, cid, topic, onMsg) {
    var self = this, ws = null, buf = [], ping = null, retry = 1000;
    self.ok = false;
    function open() {
      try { ws = new WebSocket(url, "mqtt"); } catch (e) { later(); return; }
      ws.binaryType = "arraybuffer";
      ws.onopen = function () {
        ws.send(packet(0x10, str("MQTT").concat([4, 2, 0, 30], str(cid))));
      };
      ws.onmessage = function (e) {
        buf = buf.concat(Array.from(new Uint8Array(e.data)));
        for (;;) {
          if (buf.length < 2) return;
          var mul = 1, len = 0, i = 1, d;
          do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
          if (buf.length < i + len) return;
          var type = buf[0] >> 4, body = buf.slice(i, i + len);
          buf = buf.slice(i + len);
          if (type === 2) {                       /* CONNACK */
            if (body[1] !== 0) { ws.close(); return; }
            self.ok = true; retry = 1000;
            ws.send(packet(0x82, [0, 1].concat(str(topic), [0])));
            ping = setInterval(function () { try { ws.send(new Uint8Array([0xc0, 0])); } catch (e) {} }, 20000);
            if (self.onUp) self.onUp();
          } else if (type === 3) {                /* PUBLISH */
            var tl = (body[0] << 8) | body[1];
            onMsg(dec.decode(new Uint8Array(body.slice(2 + tl))));
          }
        }
      };
      ws.onclose = ws.onerror = function () {
        if (!ws) return;
        ws.onclose = ws.onerror = ws.onmessage = null;
        try { ws.close(); } catch (e) {}
        ws = null; self.ok = false; buf = [];
        clearInterval(ping);
        later();
      };
    }
    function later() { setTimeout(open, retry); retry = Math.min(15000, retry * 2); }
    self.send = function (msg) {
      if (!self.ok || !ws) return;
      try { ws.send(packet(0x30, str(topic).concat(Array.from(enc.encode(msg))))); } catch (e) {}
    };
    open();
  }

  window.zPresence = function (opt) {
    var id = Math.random().toString(36).slice(2, 10);
    var since = Date.now();
    var pulling = false, peers = {}, conns = [], lastSent = 0;
    var self = {};
    function now() { return Date.now(); }
    function onMsg(m) {
      var a = m.split(",");
      if (a[0] === "done") { if (opt.onDone) opt.onDone(a[1]); return; }
      if (a.length < 3 || a[0] === id) return;
      if (a[1] === "x") { delete peers[a[0]]; return; }
      peers[a[0]] = { id: a[0], pull: a[1] === "1", since: Number(a[2]) || 0, seen: now() };
    }
    function beat() {
      lastSent = now();
      var msg = id + "," + (pulling ? 1 : 0) + "," + since;
      conns.forEach(function (c) { c.send(msg); });
    }
    BROKERS.forEach(function (u) {
      var c = new Conn(u, "zk" + id + conns.length, opt.topic, onMsg);
      c.onUp = beat;
      conns.push(c);
    });
    setInterval(function () { if (now() - lastSent > (pulling ? 800 : 2000)) beat(); }, 200);
    window.addEventListener("pagehide", function () { conns.forEach(function (c) { c.send(id + ",x,0"); }); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) beat(); });

    self.id = id;
    self.setPulling = function (b) { if (b === pulling) return; pulling = b; beat(); };
    self.peers = function () {
      var t = now(), out = [{ id: id, pull: pulling, since: since, me: true }];
      for (var k in peers) {
        var p = peers[k];
        if (t - p.seen > 5000) { delete peers[k]; continue; }
        out.push({ id: p.id, pull: p.pull && t - p.seen < 2000, since: p.since, me: false });
      }
      return out.sort(function (a, b) { return a.since - b.since || (a.id < b.id ? -1 : 1); });
    };
    self.sendDone = function () { var m = "done," + id; conns.forEach(function (c) { c.send(m); }); };
    self.status = function () { return conns.filter(function (c) { return c.ok; }).length; };
    return self;
  };
  window.zPresence.BROKERS = BROKERS;
})();
