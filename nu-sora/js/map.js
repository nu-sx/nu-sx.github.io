/* NU-SORA デモ / 日本地図コンポーネント
   投影・視野円の算出は提案書「観測局配置図」（V7）と同一の方式を用いる。 */
'use strict';
(function (NS) {

var merc = function (lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); };
var BOX = { lon0:127.8, lon1:146.6, lat0:30.2, lat1:46.2 };
var W = 1000, H = 900;
/* 世界座標（0..W, 0..H）への固定投影 */
var SX = W / ((BOX.lon1 - BOX.lon0) * NS.d2r);
var SY = H / (merc(BOX.lat1) - merc(BOX.lat0));
var S = Math.min(SX, SY);
var OX = (W - (BOX.lon1 - BOX.lon0) * NS.d2r * S) / 2;
var OY = (H - (merc(BOX.lat1) - merc(BOX.lat0)) * S) / 2;
NS.proj = function (lon, lat) { return [OX + (lon - BOX.lon0) * NS.d2r * S, OY + (merc(BOX.lat1) - merc(lat)) * S]; };
NS.unproj = function (px, py) {
  var lon = BOX.lon0 + (px - OX) / (NS.d2r * S);
  var my = merc(BOX.lat1) - (py - OY) / S;
  var lat = (Math.atan(Math.exp(my)) - Math.PI / 4) * 360 / Math.PI;
  return { lon:lon, lat:lat };
};
NS.MAPW = W; NS.MAPH = H;

/* =============== 市区町村境界（遅延読込） ===============
   全国 1,893 市区町村を県別ファイルに分けておき、局所マップが必要な県だけを
   その場で読み込む。全国表示では一切読み込まないので初期表示は軽い。 */
var MUNI_BASE = (function () {
  var sc = document.currentScript;
  var src = sc ? sc.src : '';
  var i = src.lastIndexOf('/');
  return i < 0 ? 'js/' : src.slice(0, i + 1);
})();
var muniState = {};                       /* 県コード → 'load' | 'ok' | 'ng' */
NS.MUNI_ZOOM  = 430;                      /* この viewBox 幅（px）より寄ったら境界を描く */
NS.MUNI_LABEL = 165;                      /* この幅より寄ったら市区町村名も描く */

NS.muniNeed = function (vb) {             /* 表示範囲に掛かる県コードを返す */
  var idx = window.MUNI_INDEX;
  if (!idx) return [];
  var a = NS.unproj(vb.x, vb.y), b = NS.unproj(vb.x + vb.w, vb.y + vb.h);
  var lo0 = Math.min(a.lon, b.lon), lo1 = Math.max(a.lon, b.lon);
  var la0 = Math.min(a.lat, b.lat), la1 = Math.max(a.lat, b.lat);
  var out = [];
  for (var c in idx) {
    var bb = idx[c].bb;                   /* [lon0, lat0, lon1, lat1] */
    if (bb[2] < lo0 || bb[0] > lo1 || bb[3] < la0 || bb[1] > la1) continue;
    out.push(c);
  }
  return out;
};

NS.muniLoad = function (codes, cb) {      /* 未読の県を読み込み、1 件でも増えたら cb */
  var pend = 0, got = false;
  codes.forEach(function (c) {
    if (window.MUNI_DATA && window.MUNI_DATA[c]) return;
    if (muniState[c]) return;
    muniState[c] = 'load'; pend++;
    var sc = document.createElement('script');
    sc.src = MUNI_BASE + 'muni/' + c + '.js';
    sc.onload  = function () { muniState[c] = 'ok'; got = true; if (--pend === 0 && cb) cb(); };
    sc.onerror = function () { muniState[c] = 'ng';            if (--pend === 0 && cb) cb(); };
    document.head.appendChild(sc);
  });
  return pend;
};


NS.ELEVS = [5, 10, 15, 20, 30, 45];
NS.ELEV_DASH = { 5:'2 3', 10:'5 3', 15:'9 3', 20:'14 3', 30:'', 45:'1 2.5' };
NS.FOV_ALT = 100;

NS.VIEWS = {
  all:    { name:'全国',   cx:137.3, cy:37.6, span:17.6 },
  kanto:  { name:'関東',   cx:139.9, cy:35.85, span:3.4 },
  tokyo:  { name:'東京',   cx:139.72, cy:35.68, span:0.9 },
  tohoku: { name:'東北',   cx:140.2, cy:38.3,  span:4.2 },
  chubu:  { name:'中部',   cx:137.6, cy:35.7,  span:4.0 },
  kyushu: { name:'九州',   cx:130.7, cy:32.0,  span:4.6 }
};

/* 大円上の円（半径 dkm）を経路に */
NS.geoCirclePath = function (lat0, lon0, dkm) {
  var d = dkm / NS.R_EARTH, la0 = lat0 * NS.d2r, lo0 = lon0 * NS.d2r, p = '';
  for (var i = 0; i <= 128; i++) {
    var th = i / 128 * 2 * Math.PI;
    var la = Math.asin(Math.sin(la0) * Math.cos(d) + Math.cos(la0) * Math.sin(d) * Math.cos(th));
    var lo = lo0 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la0), Math.cos(d) - Math.sin(la0) * Math.sin(la));
    var xy = NS.proj(lo * NS.r2d, la * NS.r2d);
    p += (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
  }
  return p + 'Z';
};
/* 測地線（点間を大円で分割） */
NS.geoLinePath = function (a, b, n) {
  n = n || 40;
  var p = '';
  for (var i = 0; i <= n; i++) {
    var f = i / n;
    var xy = NS.proj(a.lon + (b.lon - a.lon) * f, a.lat + (b.lat - a.lat) * f);
    p += (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
  }
  return p;
};

/* =============== 地図オブジェクト =============== */
NS.Map = function (opts) {
  opts = opts || {};
  var M = { view:opts.view || 'all', layers:opts.layers || {}, onStation:opts.onStation || null, sel:null };
  var svg = NS.s('svg', { class:'jmap', viewBox:'0 0 ' + W + ' ' + H, preserveAspectRatio:'xMidYMid meet' });
  var gSea = NS.s('rect', { x:0, y:0, width:W, height:H, class:'m-sea' });
  var gGrid = NS.s('g', { class:'m-grid' });
  var gLand = NS.s('g', { class:'m-land' });
  var gCity = NS.s('g', { class:'m-city' });
  var gCLbl = NS.s('g', { class:'m-cname' });
  var gFov  = NS.s('g', { class:'m-fov' });
  var gOv   = NS.s('g', { class:'m-ov' });
  var gSt   = NS.s('g', { class:'m-st' });
  var gLbl  = NS.s('g', { class:'m-lbl' });
  NS.add(svg, [gSea, gGrid, gLand, gCity, gCLbl, gFov, gOv, gSt, gLbl]);
  var wrap = NS.el('div', { class:'mapwrap' }, svg);
  var tip = NS.el('div', { class:'maptip', hidden:'hidden' });
  wrap.appendChild(tip);
  M.node = wrap; M.svg = svg;

  /* 陸地 */
  (window.GEO_JAPAN || []).forEach(function (pref) {
    pref.r.forEach(function (ring) {
      if (ring.length < 4) return;
      var d = '';
      for (var i = 0; i < ring.length; i++) {
        var xy = NS.proj(ring[i][0], ring[i][1]);
        d += (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
      }
      NS.add(gLand, NS.s('path', { d:d + 'Z', class:'m-pref', 'vector-effect':'non-scaling-stroke' }, NS.s('title', { text:pref.n })));
    });
  });
  /* 経緯線 */
  for (var la = 30; la <= 46; la += 2) {
    var a = NS.proj(BOX.lon0, la), b = NS.proj(BOX.lon1, la);
    NS.add(gGrid, NS.s('line', { x1:a[0], y1:a[1], x2:b[0], y2:b[1], class:'gl' }));
    NS.add(gGrid, NS.s('text', { x:a[0] + 4, y:a[1] - 3, class:'gt', text:la + '°N' }));
  }
  for (var lo = 128; lo <= 146; lo += 2) {
    var c = NS.proj(lo, BOX.lat0), d2 = NS.proj(lo, BOX.lat1);
    NS.add(gGrid, NS.s('line', { x1:c[0], y1:c[1], x2:d2[0], y2:d2[1], class:'gl' }));
    NS.add(gGrid, NS.s('text', { x:c[0] + 3, y:c[1] - 4, class:'gt', text:lo + '°E' }));
  }

  /* --- ズーム / パン --- */
  var vb = { x:0, y:0, w:W, h:H };
  function apply() {
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
    scaleMarks();
    cityUpdate();
    if (M.onView) M.onView(vb);
  }

  /* --- 市区町村境界：寄ったときだけ描く --- */
  var cityKey = '';
  function cityUpdate() {
    if (M.city === false) return;
    if (vb.w > NS.MUNI_ZOOM) {
      if (cityKey) { NS.clear(gCity); NS.clear(gCLbl); cityKey = ''; gLand.style.opacity = ''; }
      return;
    }
    var codes = NS.muniNeed(vb);
    if (!codes.length) return;
    var lbl = vb.w <= NS.MUNI_LABEL;
    var key = codes.join(',') + '|' + (lbl ? 1 : 0) + '|' +
              [vb.x, vb.y, vb.w].map(function (v) { return Math.round(v / 12); }).join(',');
    if (key === cityKey) { if (lbl) cityScale(); return; }
    if (NS.muniLoad(codes, function () { cityKey = ''; cityUpdate(); })) return;
    cityKey = key;
    NS.clear(gCity); NS.clear(gCLbl);
    var data = window.MUNI_DATA || {};
    var pad = vb.w * 0.15;                /* 画面外の環は描かない（少しだけ余白を取る） */
    var cx0 = vb.x - pad, cx1 = vb.x + vb.w + pad, cy0 = vb.y - pad, cy1 = vb.y + vb.h + pad;
    codes.forEach(function (c) {
      (data[c] || []).forEach(function (mu) {
        var big = null, bigN = 0;
        mu.r.forEach(function (ring) {
          if (ring.length < 4) return;
          var n = ring.length, xs = new Array(n), ys = new Array(n);
          var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, sx = 0, sy = 0;
          for (var i = 0; i < n; i++) {
            var xy = NS.proj(ring[i][0], ring[i][1]);
            xs[i] = xy[0]; ys[i] = xy[1]; sx += xy[0]; sy += xy[1];
            if (xy[0] < x0) x0 = xy[0];
            if (xy[0] > x1) x1 = xy[0];
            if (xy[1] < y0) y0 = xy[1];
            if (xy[1] > y1) y1 = xy[1];
          }
          if (x1 < cx0 || x0 > cx1 || y1 < cy0 || y0 > cy1) return;
          var d = '';
          for (var j = 0; j < n; j++) d += (j ? 'L' : 'M') + xs[j].toFixed(1) + ' ' + ys[j].toFixed(1);
          NS.add(gCity, NS.s('path', { d:d + 'Z', 'vector-effect':'non-scaling-stroke' }, NS.s('title', { text:mu.n })));
          if (n > bigN) { bigN = n; big = [sx / n, sy / n]; }
        });
        if (lbl && big && bigN > 12)
          NS.add(gCLbl, NS.s('text', { x:big[0].toFixed(1), y:big[1].toFixed(1), text:mu.n }));
      });
    });
    /* 市区町村の面で陸を描き直す。簡略化した都道府県ポリゴンより海岸線が細かいので、
       描けたときだけ粗いほうを隠して二重の海岸線が出ないようにする。 */
    gLand.style.opacity = gCity.childElementCount ? '0' : '';
    cityScale();
  }
  function cityScale() {                  /* 文字の大きさと濃さをズームに追随させる（線幅は非拡大ストローク） */
    gCLbl.setAttribute('font-size', Math.max(1.2, vb.w / W * 9).toFixed(2));
    var f = (NS.MUNI_ZOOM - vb.w) / (NS.MUNI_ZOOM - NS.MUNI_LABEL);
    gCity.style.strokeOpacity = (0.34 + 0.56 * Math.max(0, Math.min(1, f))).toFixed(2);
  }
  M.cityUpdate = cityUpdate;
  function scaleMarks() {
    var k = Math.max(0.055, Math.min(2.6, vb.w / W));
    svg.style.setProperty('--mk', k.toFixed(3));
  }
  M.goto = function (key, animate) {
    var v = NS.VIEWS[key] || NS.VIEWS.all; M.view = key;
    var c = NS.proj(v.cx, v.cy);
    var top = NS.proj(v.cx, v.cy + v.span / 2), bot = NS.proj(v.cx, v.cy - v.span / 2);
    var h = Math.abs(bot[1] - top[1]), w = h * (W / H);
    var t = { x:c[0] - w / 2, y:c[1] - h / 2, w:w, h:h };
    if (!animate) { vb = t; apply(); return; }
    var s0 = { x:vb.x, y:vb.y, w:vb.w, h:vb.h }, t0 = performance.now(), D = 420;
    (function step(now) {
      var f = Math.min(1, (now - t0) / D), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      vb = { x:s0.x + (t.x - s0.x) * e, y:s0.y + (t.y - s0.y) * e, w:s0.w + (t.w - s0.w) * e, h:s0.h + (t.h - s0.h) * e };
      apply();
      if (f < 1) requestAnimationFrame(step);
    })(t0);
  };
  M.fit = function (pts, padFrac) {
    if (!pts.length) return;
    var xs = [], ys = [];
    pts.forEach(function (p) { var xy = NS.proj(p.lon, p.lat); xs.push(xy[0]); ys.push(xy[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pad = (padFrac == null ? 0.35 : padFrac);
    var cw = Math.max(24, (x1 - x0)) * (1 + pad * 2), ch = Math.max(24, (y1 - y0)) * (1 + pad * 2);
    var ar = W / H;
    if (cw / ch < ar) cw = ch * ar; else ch = cw / ar;
    vb = { x:(x0 + x1) / 2 - cw / 2, y:(y0 + y1) / 2 - ch / 2, w:cw, h:ch };
    apply();
  };
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = svg.getBoundingClientRect();
    var mx = vb.x + (e.clientX - r.left) / r.width * vb.w, my = vb.y + (e.clientY - r.top) / r.height * vb.h;
    var k = Math.exp(e.deltaY * 0.0016);
    var nw = Math.max(W * 0.008, Math.min(W * 1.6, vb.w * k)), nh = nw / (W / H);
    vb = { x:mx - (mx - vb.x) * (nw / vb.w), y:my - (my - vb.y) * (nh / vb.h), w:nw, h:nh };
    apply();
  }, { passive:false });
  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    drag = { x:e.clientX, y:e.clientY, vx:vb.x, vy:vb.y }; svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing');
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var r = svg.getBoundingClientRect();
    vb.x = drag.vx - (e.clientX - drag.x) / r.width * vb.w;
    vb.y = drag.vy - (e.clientY - drag.y) / r.height * vb.h;
    apply();
  });
  svg.addEventListener('pointerup', function () { drag = null; svg.classList.remove('grabbing'); });
  svg.addEventListener('pointercancel', function () { drag = null; svg.classList.remove('grabbing'); });

  /* --- ツールチップ --- */
  function showTip(html, ev) {
    tip.innerHTML = html; tip.hidden = false;
    var r = wrap.getBoundingClientRect();
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width - 6) x = ev.clientX - r.left - tip.offsetWidth - 12;
    if (y + tip.offsetHeight > r.height - 6) y = ev.clientY - r.top - tip.offsetHeight - 12;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }
  M.hideTip = hideTip;

  /* --- 視野円 --- */
  M.drawFov = function (elevs, stations) {
    NS.clear(gFov);
    (elevs || []).forEach(function (e) {
      var rad = NS.groundRadius(NS.FOV_ALT, e);
      (stations || NS.STATIONS).forEach(function (st) {
        NS.add(gFov, NS.s('path', { d:NS.geoCirclePath(st.lat, st.lon, rad), class:'fov',
          'stroke-dasharray':NS.ELEV_DASH[e] || null, opacity:e === 30 ? 0.55 : 0.34 }));
      });
    });
  };
  /* --- 観測局マーカー --- */
  M.drawStations = function (opt) {
    opt = opt || {};
    NS.clear(gSt); NS.clear(gLbl);
    var t = NS.now();
    NS.STATIONS.forEach(function (st) {
      var xy = NS.proj(st.lon, st.lat);
      var s = opt.state ? opt.state(st) : null;
      var cls = 'stm' + (st.kind === 'u' ? ' u' : ' s') + (s && s.status ? ' q-' + s.status : '') + (M.sel === st.id ? ' sel' : '');
      var g = NS.s('g', { class:cls, transform:'translate(' + xy[0].toFixed(1) + ',' + xy[1].toFixed(1) + ')', tabindex:'0',
        role:'button', 'aria-label':st.name });
      if (opt.halo) {
        var hv = opt.halo(st);
        if (hv) NS.add(g, NS.s('circle', { r:hv.r, fill:hv.color, opacity:hv.opacity == null ? 0.3 : hv.opacity, class:'halo' }));
      }
      if (st.kind === 'u') NS.add(g, NS.s('rect', { x:-5.4, y:-5.4, width:10.8, height:10.8, class:'mk' }));
      else NS.add(g, NS.s('circle', { r:5.6, class:'mk' }));
      if (st.swir) NS.add(g, NS.s('circle', { r:9.4, class:'swirring' }));
      NS.add(g, NS.s('title', { text:st.name + '（' + st.host + '）' }));
      g.addEventListener('pointerenter', function (e) {
        var w = s && s.weather ? s.weather : NS.weather(st, t);
        showTip('<b>' + st.name + '</b><span class="mt-s">' + st.pref + ' ' + st.city + ' · ' + (st.kind === 'u' ? '大学キャンパス拠点' : '付属校拠点') + '</span>' +
          '<span class="mt-h">' + st.host + '</span>' +
          '<span class="mt-d">' + NS.f(st.lat, 3) + '°N ' + NS.f(st.lon, 3) + '°E · 標高 ' + st.alt + ' m' +
          (s ? ' · 稼働率 ' + NS.f(s.uptime, 2) + '%' : '') + '</span>' +
          (opt.tipExtra ? '<span class="mt-x">' + opt.tipExtra(st, s) + '</span>' : ''), e);
      });
      g.addEventListener('pointerleave', hideTip);
      g.addEventListener('click', function () { if (M.onStation) M.onStation(st); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' && M.onStation) M.onStation(st); });
      NS.add(gSt, g);
      if (opt.labels !== false) {
        var lx = xy[0] + (st.labelDx || 9), ly = xy[1] + (st.labelDy || -8);
        NS.add(gLbl, NS.s('text', { x:lx, y:ly, class:'stl', text:opt.labelText ? opt.labelText(st, s) : st.name }));
      }
    });
  };
  /* --- 任意オーバーレイ --- */
  M.overlay = function () { return gOv; };
  M.clearOverlay = function () { NS.clear(gOv); return gOv; };
  M.addOverlay = function (node) { NS.add(gOv, node); return node; };
  M.tipOn = function (node, html) {
    node.addEventListener('pointerenter', function (e) { showTip(html, e); });
    node.addEventListener('pointermove', function (e) { showTip(html, e); });
    node.addEventListener('pointerleave', hideTip);
    return node;
  };
  M.pt = function (lon, lat) { return NS.proj(lon, lat); };
  M.viewBox = function () { return { x:vb.x, y:vb.y, w:vb.w, h:vb.h }; };
  M.inv = function (px, py) { return NS.unproj(px, py); };
  /* 画面上でおよそ p ピクセルに見える半径をワールド単位で返す（拡大しても大きさが変わらない印用） */
  M.px = function (p) { return p * vb.w / 900; };
  M.select = function (id) { M.sel = id; };

  apply();
  return M;
};

/* 色スケール（連続値 → 色） */
NS.colorScale = function (stops) {
  return function (v) {
    if (v == null || !isFinite(v)) return 'var(--muted)';
    if (v <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        var f = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return NS.mix(stops[i - 1][1], stops[i][1], f);
      }
    }
    return stops[stops.length - 1][1];
  };
};
NS.mix = function (a, b, f) {
  var pa = NS.rgb(a), pb = NS.rgb(b);
  return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(pa[i] + (pb[i] - pa[i]) * f); }).join(',') + ')';
};
NS.rgb = function (h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
/* 夜空輝度（暗い=青紫 → 明るい=橙白） */
NS.SQM_SCALE = NS.colorScale([[17.5,'#FFF1C9'],[18.5,'#FFC46B'],[19.5,'#F08A3C'],[20.3,'#B4562F'],[20.9,'#5C4A8C'],[21.5,'#2C3A82'],[22.0,'#101A44']]);
NS.WBGT_SCALE = NS.colorScale([[18,'#3B7EA1'],[21,'#4FA07A'],[25,'#D9B23C'],[28,'#DE8330'],[31,'#C43D2E'],[35,'#8E1B2C']]);
NS.CLOUD_SCALE = NS.colorScale([[0,'#2F6FA8'],[0.5,'#8C97A3'],[1,'#E8EAED']]);

})(NS);
