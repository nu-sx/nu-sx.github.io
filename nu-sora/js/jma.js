/* NU-SORA デモ / 気象庁の公開画像のオーバーレイ
   ・ひまわり衛星画像（可視 B03 / 赤外 B13 / 水蒸気 B08 / 真彩色 REP）
     Web メルカトルの XYZ タイルで配信されているため、本デモの地図（同じくメルカトル）に
     そのまま重ねられる。
   ・地上天気図（実況・24/48 時間予想）
     図法が地図と異なるため重ねず、別枠の参照図として表示する。
   出典：気象庁（https://www.jma.go.jp/）。画像は気象庁のサーバーから直接取得する。
   既定では読み込まない（利用者が明示的に ON にしたときだけ通信する）。 */
'use strict';
(function (NS) {

var HIMAWARI = 'https://www.jma.go.jp/bosai/himawari/data/satimg/';
var WMAP = 'https://www.jma.go.jp/bosai/weather_map/data/';

NS.JMA_BANDS = [
  { key:'REP', name:'真彩色', path:'REP/ETC', desc:'可視の 3 バンドを合成した見た目に近い画像（昼のみ）' },
  { key:'VIS', name:'可視',   path:'B03/ALBD', desc:'バンド 3（0.64 µm）の反射。雲の厚みが分かる（昼のみ）' },
  { key:'IR',  name:'赤外',   path:'B13/TBB',  desc:'バンド 13（10.4 µm）の輝度温度。雲頂高度が分かる（昼夜とも）' },
  { key:'WV',  name:'水蒸気', path:'B08/TBB',  desc:'バンド 8（6.2 µm）。対流圏中上層の水蒸気の分布' }
];

var cache = {};
function fetchJson(url) {
  if (cache[url]) return cache[url];
  cache[url] = fetch(url, { mode:'cors' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
  return cache[url];
}
/* ひまわりの最新の観測時刻（日本域は 2.5 分ごと） */
NS.jmaHimawariTimes = function () { return fetchJson(HIMAWARI + 'targetTimes_jp.json'); };
/* 天気図の一覧 */
NS.jmaWeatherMapList = function () { return fetchJson(WMAP + 'list.json'); };
NS.jmaWeatherMapUrl = function (file) { return WMAP + 'png/' + file; };
/* 天気図のファイル名から実況時刻（UTC）を取り出す */
NS.jmaChartTime = function (file) {
  var m = file.match(/_(\d{14})_MET_CHT/);
  if (!m) return null;
  var s = m[1];
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
};

/* ---- Web メルカトルのタイルと本デモの地図座標の対応 ---- */
function tileLonW(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function tileLatN(y, z) {
  var n = Math.PI * (1 - 2 * y / Math.pow(2, z));
  return Math.atan(Math.sinh(n)) * NS.r2d;
}
/* 表示範囲に見合うズームを選ぶ（地図 1 単位あたりの画面画素から逆算） */
function pickZoom(vbw) {
  var worldUnits = 360 * NS.d2r * (NS.MAPW / ((146.6 - 127.8) * NS.d2r));  /* 全球の地図単位幅 */
  var z = Math.round(Math.log2(worldUnits * (900 / vbw) / 256));
  return Math.max(4, Math.min(7, z));
}

/* 地図に衛星画像を重ねる。戻り値の update() を地図操作のたびに呼ぶ */
NS.jmaSatLayer = function (M) {
  var g = NS.s('g', { class:'jma-sat' });
  M.overlay().parentNode.insertBefore(g, M.overlay());     /* 観測局より下、陸地より上に置く */
  var L = { node:g, band:null, opacity:0.62, time:null, tiles:{}, status:'' };

  L.clear = function () { NS.clear(g); L.tiles = {}; };
  L.setOpacity = function (v) { L.opacity = v; g.setAttribute('opacity', v); };
  L.setOpacity(L.opacity);

  L.setBand = function (key, onStatus) {
    L.band = key; L.clear();
    if (!key) { if (onStatus) onStatus(''); return; }
    if (onStatus) onStatus('気象庁から取得中…');
    NS.jmaHimawariTimes().then(function (list) {
      var last = list[list.length - 1];
      L.time = last;
      if (onStatus) onStatus(NS.fmtJST(NS.jmaParse(last.validtime)) + ' JST 観測');
      L.update();
    })['catch'](function (e) {
      if (onStatus) onStatus('取得できませんでした（' + e.message + '）');
    });
  };
  L.update = function () {
    if (!L.band || !L.time) return;
    var band = NS.JMA_BANDS.filter(function (b) { return b.key === L.band; })[0];
    var vb = M.viewBox(), z = pickZoom(vb.w), n = Math.pow(2, z);
    /* 表示範囲を覆うタイル範囲を求める */
    var lo = M.inv(vb.x, vb.y + vb.h), hi = M.inv(vb.x + vb.w, vb.y);
    var x0 = Math.floor((lo.lon + 180) / 360 * n), x1 = Math.ceil((hi.lon + 180) / 360 * n);
    var yOf = function (lat) {
      var s = Math.sin(Math.max(-85, Math.min(85, lat)) * NS.d2r);
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    };
    var y0 = Math.floor(yOf(hi.lat)), y1 = Math.ceil(yOf(lo.lat));
    x0 = Math.max(0, x0); x1 = Math.min(n, x1); y0 = Math.max(0, y0); y1 = Math.min(n, y1);
    if ((x1 - x0) * (y1 - y0) > 60) return;             /* 取りすぎを防ぐ */
    var keep = {};
    for (var x = x0; x < x1; x++) {
      for (var y = y0; y < y1; y++) {
        var id = z + '/' + x + '/' + y;
        keep[id] = 1;
        if (L.tiles[id]) continue;
        var a = NS.proj(tileLonW(x, z), tileLatN(y, z));
        var b = NS.proj(tileLonW(x + 1, z), tileLatN(y + 1, z));
        var im = NS.s('image', { x:a[0], y:a[1], width:(b[0] - a[0]), height:(b[1] - a[1]),
          preserveAspectRatio:'none', 'image-rendering':'optimizeQuality',
          href:HIMAWARI + L.time.basetime + '/jp/' + L.time.validtime + '/' + band.path + '/' + z + '/' + x + '/' + y + '.jpg' });
        im.setAttribute('crossorigin', 'anonymous');
        NS.add(g, im);
        L.tiles[id] = im;
      }
    }
    Object.keys(L.tiles).forEach(function (id) {
      if (!keep[id]) { if (L.tiles[id].parentNode) L.tiles[id].parentNode.removeChild(L.tiles[id]); delete L.tiles[id]; }
    });
  };
  return L;
};
/* "20260911012000" → ミリ秒（UTC） */
NS.jmaParse = function (s) {
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +(s.slice(12, 14) || 0));
};

})(NS);
