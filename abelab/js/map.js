/* NU-AbeLab / 日本地図と気象衛星のオーバーレイ
   投影は Web メルカトル。ひまわりの XYZ タイルが同じ図法で配信されているので、
   視野の投影・観測局・衛星画像を 1 枚に重ねられる（NU-SORA の地図と同じ方式）。
   衛星画像は利用者が選んだときにだけ気象庁のサーバーから取得する。 */
'use strict';
(function (AL) {

var SVGNS = 'http://www.w3.org/2000/svg';
AL.s = function (tag, attrs, kids) {
  var e = document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) {
    if (attrs[k] == null) continue;
    if (k === 'text') e.textContent = attrs[k];
    else if (k === 'href') e.setAttributeNS('http://www.w3.org/1999/xlink', 'href', attrs[k]), e.setAttribute('href', attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
};

/* ---- 固定投影（世界座標 0..W, 0..H） ---- */
var merc = function (lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); };
var BOX = { lon0: 127.8, lon1: 146.6, lat0: 30.2, lat1: 46.2 };
var W = 1000, H = 900;
var S = Math.min(W / ((BOX.lon1 - BOX.lon0) * AL.d2r), H / (merc(BOX.lat1) - merc(BOX.lat0)));
var OX = (W - (BOX.lon1 - BOX.lon0) * AL.d2r * S) / 2;
var OY = (H - (merc(BOX.lat1) - merc(BOX.lat0)) * S) / 2;
AL.proj = function (lon, lat) { return [OX + (lon - BOX.lon0) * AL.d2r * S, OY + (merc(BOX.lat1) - merc(lat)) * S]; };
AL.unproj = function (px, py) {
  var lon = BOX.lon0 + (px - OX) / (AL.d2r * S);
  var my = merc(BOX.lat1) - (py - OY) / S;
  return { lon: lon, lat: (Math.atan(Math.exp(my)) - Math.PI / 4) * 360 / Math.PI };
};
AL.MAPW = W; AL.MAPH = H;

/* ================= 地図 ================= */
AL.Map = function (opts) {
  opts = opts || {};
  var M = {};
  var svg = AL.s('svg', { class: 'jmap', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' });
  var gSea = AL.s('rect', { x: 0, y: 0, width: W, height: H, class: 'm-sea' });
  var gSat = AL.s('g', { class: 'm-sat' });
  var gLand = AL.s('g', { class: 'm-land' });
  var gGrid = AL.s('g', { class: 'm-grid' });
  var gFov = AL.s('g', { class: 'm-fov' });
  var gOv = AL.s('g', { class: 'm-ov' });
  var gSt = AL.s('g', { class: 'm-st' });
  [gSea, gSat, gLand, gGrid, gFov, gOv, gSt].forEach(function (g) { svg.appendChild(g); });
  var wrap = AL.el('div', { class: 'mapwrap' }, [svg]);
  M.node = wrap; M.svg = svg;
  M.layers = { sat: gSat, fov: gFov, ov: gOv, st: gSt };

  /* 陸地 */
  (window.GEO_JAPAN || []).forEach(function (pref) {
    pref.r.forEach(function (ring) {
      if (ring.length < 4) return;
      var d = '';
      for (var i = 0; i < ring.length; i++) {
        var xy = AL.proj(ring[i][0], ring[i][1]);
        d += (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
      }
      gLand.appendChild(AL.s('path', { d: d + 'Z', class: 'm-pref', 'vector-effect': 'non-scaling-stroke' },
        [AL.s('title', { text: pref.n })]));
    });
  });
  /* 経緯線 */
  for (var la = 32; la <= 44; la += 1) {
    var a = AL.proj(BOX.lon0, la), b = AL.proj(BOX.lon1, la);
    gGrid.appendChild(AL.s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'gl' }));
    gGrid.appendChild(AL.s('text', { x: a[0] + 4, y: a[1] - 3, class: 'gt', text: la + '°N' }));
  }
  for (var lo = 128; lo <= 146; lo += 1) {
    var c = AL.proj(lo, BOX.lat0), d2 = AL.proj(lo, BOX.lat1);
    gGrid.appendChild(AL.s('line', { x1: c[0], y1: c[1], x2: d2[0], y2: d2[1], class: 'gl' }));
    gGrid.appendChild(AL.s('text', { x: c[0] + 3, y: c[1] - 4, class: 'gt', text: lo + '°E' }));
  }

  var vb = { x: 0, y: 0, w: W, h: H };
  function apply() {
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
    svg.style.setProperty('--mk', Math.max(0.05, Math.min(2.6, vb.w / W)).toFixed(3));
    gGrid.setAttribute('opacity', vb.w < W * 0.5 ? 0.9 : 0.5);
    if (M.sat) M.sat.update();
    if (M.onView) M.onView(vb);
  }
  M.viewBox = function () { return vb; };
  /* viewBox の 1 単位が画面で何画素か。記号や文字を一定の大きさに見せるのに使う */
  M.unit = function () { return (wrap.clientWidth || W) / vb.w; };
  /* 画面座標 → 地図のユーザー座標・緯度経度（向きをマウスで変えるのに使う） */
  M.toUser = function (cx, cy) {
    var r = svg.getBoundingClientRect();
    return { x: vb.x + (cx - r.left) / r.width * vb.w, y: vb.y + (cy - r.top) / r.height * vb.h };
  };
  M.toLatLon = function (cx, cy) { var p = M.toUser(cx, cy); return AL.unproj(p.x, p.y); };
  M.inv = function (px, py) { return AL.unproj(px, py); };
  M.fit = function (pts, padFrac) {
    if (!pts.length) return;
    var xs = [], ys = [];
    pts.forEach(function (p) { var xy = AL.proj(p.lon, p.lat); xs.push(xy[0]); ys.push(xy[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pad = padFrac == null ? 0.18 : padFrac;
    var cw = Math.max(20, x1 - x0) * (1 + pad * 2), ch = Math.max(20, y1 - y0) * (1 + pad * 2);
    /* 画面に出ている縦横比に合わせないと、上下か左右に無駄な余白が出る */
    var ar = (wrap.clientWidth && wrap.clientHeight) ? wrap.clientWidth / wrap.clientHeight : W / H;
    if (cw / ch < ar) cw = ch * ar; else ch = cw / ar;
    vb = { x: (x0 + x1) / 2 - cw / 2, y: (y0 + y1) / 2 - ch / 2, w: cw, h: ch };
    apply();
  };
  M.redraw = apply;

  /* ズーム・パン */
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = svg.getBoundingClientRect();
    var mx = vb.x + (e.clientX - r.left) / r.width * vb.w, my = vb.y + (e.clientY - r.top) / r.height * vb.h;
    var k = Math.exp(e.deltaY * 0.0016);
    var ar0 = vb.w / vb.h;                       /* 表示中の縦横比を保つ */
    var nw = Math.max(W * 0.01, Math.min(W * 1.4, vb.w * k)), nh = nw / ar0;
    vb = { x: mx - (mx - vb.x) * (nw / vb.w), y: my - (my - vb.y) * (nh / vb.h), w: nw, h: nh };
    apply();
  }, { passive: false });
  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
    svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing');
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var r = svg.getBoundingClientRect();
    vb.x = drag.vx - (e.clientX - drag.x) / r.width * vb.w;
    vb.y = drag.vy - (e.clientY - drag.y) / r.height * vb.h;
    apply();
  });
  ['pointerup', 'pointercancel'].forEach(function (k) {
    svg.addEventListener(k, function () { drag = null; svg.classList.remove('grabbing'); });
  });
  return M;
};

/* ================= 気象衛星（ひまわり）=================
   気象庁が Web メルカトルの XYZ タイルで公開している画像を重ねる。
   既定では読み込まず、バンドを選んだときにだけ取得する。 */
var HIMAWARI = 'https://www.jma.go.jp/bosai/himawari/data/satimg/';
AL.JMA_BANDS = [
  { key: 'REP', name: '真彩色', path: 'REP/ETC', desc: '可視 3 バンドの合成（昼のみ）' },
  { key: 'VIS', name: '可視',   path: 'B03/ALBD', desc: 'バンド 3（0.64 µm）の反射。雲の厚み（昼のみ）' },
  { key: 'IR',  name: '赤外',   path: 'B13/TBB',  desc: 'バンド 13（10.4 µm）の輝度温度。雲頂高度（昼夜とも）' },
  { key: 'WV',  name: '水蒸気', path: 'B08/TBB',  desc: 'バンド 8（6.2 µm）。対流圏中上層の水蒸気' }
];
var jcache = {};
function fetchJson(url) {
  if (jcache[url]) return jcache[url];
  jcache[url] = fetch(url, { mode: 'cors' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
  return jcache[url];
}
AL.jmaTimes = function () { return fetchJson(HIMAWARI + 'targetTimes_jp.json'); };
AL.jmaParse = function (s) {
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +(s.slice(12, 14) || 0));
};
function tileLonW(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function tileLatN(y, z) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z)))) * AL.r2d; }
function pickZoom(vbw) {
  var worldUnits = 360 * AL.d2r * (W / ((BOX.lon1 - BOX.lon0) * AL.d2r));
  return Math.max(4, Math.min(6, Math.round(Math.log2(worldUnits * (900 / vbw) / 256))));
}
AL.satLayer = function (M) {
  var g = M.layers.sat;
  var L = { band: null, opacity: 0.6, time: null, tiles: {} };
  L.setOpacity = function (v) { L.opacity = v; g.setAttribute('opacity', v); };
  L.setOpacity(L.opacity);
  L.clear = function () { while (g.firstChild) g.removeChild(g.firstChild); L.tiles = {}; };
  L.setBand = function (key, onStatus) {
    L.band = key; L.clear();
    if (!key) { if (onStatus) onStatus(''); return; }
    if (onStatus) onStatus('気象庁から取得中…');
    AL.jmaTimes().then(function (list) {
      L.time = list[list.length - 1];
      if (onStatus) onStatus(AL.stamp(AL.jmaParse(L.time.validtime), { sec: false }) + ' 観測');
      L.update();
    })['catch'](function (e) {
      if (onStatus) onStatus('取得できなかった（' + e.message + '）');
    });
  };
  L.update = function () {
    if (!L.band || !L.time) return;
    var band = AL.JMA_BANDS.filter(function (b) { return b.key === L.band; })[0];
    var vb = M.viewBox(), z = pickZoom(vb.w), n = Math.pow(2, z);
    var lo = M.inv(vb.x, vb.y + vb.h), hi = M.inv(vb.x + vb.w, vb.y);
    var x0 = Math.max(0, Math.floor((lo.lon + 180) / 360 * n));
    var x1 = Math.min(n, Math.ceil((hi.lon + 180) / 360 * n));
    var yOf = function (lat) {
      var s = Math.sin(AL.clamp(lat, -85, 85) * AL.d2r);
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    };
    var y0 = Math.max(0, Math.floor(yOf(hi.lat))), y1 = Math.min(n, Math.ceil(yOf(lo.lat)));
    if ((x1 - x0) * (y1 - y0) > 60) return;
    var keep = {};
    for (var x = x0; x < x1; x++) for (var y = y0; y < y1; y++) {
      var id = z + '/' + x + '/' + y;
      keep[id] = 1;
      if (L.tiles[id]) continue;
      var a = AL.proj(tileLonW(x, z), tileLatN(y, z));
      var b = AL.proj(tileLonW(x + 1, z), tileLatN(y + 1, z));
      var im = AL.s('image', { x: a[0], y: a[1], width: b[0] - a[0], height: b[1] - a[1],
        preserveAspectRatio: 'none',
        href: HIMAWARI + L.time.basetime + '/jp/' + L.time.validtime + '/' + band.path + '/' + z + '/' + x + '/' + y + '.jpg' });
      g.appendChild(im);
      L.tiles[id] = im;
    }
    Object.keys(L.tiles).forEach(function (id) {
      if (!keep[id]) { if (L.tiles[id].parentNode) L.tiles[id].parentNode.removeChild(L.tiles[id]); delete L.tiles[id]; }
    });
  };
  M.sat = L;
  return L;
};

})(AL);
