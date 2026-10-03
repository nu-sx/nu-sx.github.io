/* NU-AbeLab 流星観測ダッシュボード / 共通の下回り
   DOM の組み立て・書式・擬似乱数・時刻の扱い。画面側はここだけを使う。 */
'use strict';
var AL = window.AL || (window.AL = {});

/* ---------- DOM ---------- */
AL.el = function (tag, attrs, kids) {
  var e = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k];
    if (v == null) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (var s in v) e.style[s] = v[s]; }
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (kids) AL.add(e, kids);
  return e;
};
AL.add = function (p, kids) {
  if (kids == null) return p;
  if (!Array.isArray(kids)) kids = [kids];
  kids.forEach(function (k) {
    if (k == null || k === false) return;
    p.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  return p;
};
AL.clear = function (e) { while (e.firstChild) e.removeChild(e.firstChild); return e; };

/* パネル。title は見出し、opts.note は薄い補足、opts.right は右肩の要素 */
AL.panel = function (title, opts, kids) {
  opts = opts || {};
  var hd = AL.el('header', null, [AL.el('span', { text: title })]);
  if (opts.note) AL.add(hd, AL.el('span', { class: 'note', text: opts.note }));
  if (opts.right) AL.add(hd, AL.el('span', { class: 'right' }, opts.right));
  var p = AL.el('section', { class: 'panel' + (opts.flat ? ' flat' : '') + (opts.cls ? ' ' + opts.cls : '') },
    [hd, AL.el('div', { class: 'body' }, kids)]);
  if (opts.col) p.classList.add(opts.col);
  if (opts.accent) p.style.borderLeft = '3px solid ' + opts.accent;
  return p;
};
AL.stat = function (value, unit, label, opts) {
  opts = opts || {};
  var v = AL.el('div', { class: 'v' }, [String(value)]);
  if (unit && String(value) !== '—') AL.add(v, AL.el('small', { text: unit }));
  if (opts.color) v.style.color = opts.color;
  return AL.el('div', { class: 'stat' + (opts.sm ? ' sm' : '') }, [v, AL.el('div', { class: 'k', text: label })]);
};
AL.state = function (kind, text, icon) {
  return AL.el('span', { class: 'state ' + kind }, [
    AL.el('span', { class: 'ico', text: icon || '●' }), AL.el('span', { text: text })
  ]);
};
AL.meter = function (frac, color) {
  var f = Math.max(0, Math.min(1, frac));
  var bar = AL.el('span', { style: { width: (f * 100).toFixed(1) + '%', background: color || 'var(--series-1)' } });
  return AL.el('div', { class: 'meter' }, [bar]);
};
AL.table = function (head, rows, opts) {
  opts = opts || {};
  var thead = AL.el('thead', null, [AL.el('tr', null, head.map(function (h) {
    return AL.el('th', { text: typeof h === 'string' ? h : h[0], class: (typeof h === 'object' && h[1] === 'num') ? 'num' : null });
  }))]);
  var tbody = AL.el('tbody', null, rows.map(function (r) {
    return AL.el('tr', null, r.map(function (c, i) {
      var num = (typeof head[i] === 'object' && head[i][1] === 'num');
      return AL.el('td', { class: num ? 'num' : null }, [c]);
    }));
  }));
  var t = AL.el('table', { class: 'tbl' }, [thead, tbody]);
  return opts.scroll === false ? t : AL.el('div', { class: 'scroll', style: opts.max ? { maxHeight: opts.max } : null }, [t]);
};

/* ---------- 書式 ---------- */
AL.f = function (v, n) { return (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(n == null ? 1 : n); };
AL.int = function (v) { return (v == null || !isFinite(v)) ? '—' : Math.round(v).toLocaleString('en-US'); };
AL.mag = function (v) { return (v == null) ? '—' : (v > 0 ? '+' : '') + v.toFixed(1); };
AL.pct = function (v, n) { return AL.f(v * 100, n == null ? 0 : n) + ' %'; };
AL.dur = function (sec) {
  if (sec == null || !isFinite(sec)) return '—';
  if (sec < 60) return AL.f(sec, sec < 10 ? 2 : 1) + ' 秒';
  var h = Math.floor(sec / 3600), m = Math.round((sec - h * 3600) / 60);
  if (m === 60) { h++; m = 0; }
  return h ? h + ' 時間 ' + m + ' 分' : m + ' 分';
};
AL.bytes = function (gb) {
  if (gb == null) return '—';
  return gb >= 1024 ? AL.f(gb / 1024, 2) + ' TB' : AL.f(gb, 0) + ' GB';
};
AL.ago = function (t, ref) {
  var d = ((ref == null ? AL.now() : ref) - t) / 1000;
  if (d < 0) return '—';
  if (d < 60) return Math.round(d) + ' 秒前';
  if (d < 3600) return Math.round(d / 60) + ' 分前';
  if (d < 86400) return Math.floor(d / 3600) + ' 時間 ' + Math.round((d % 3600) / 60) + ' 分前';
  return Math.floor(d / 86400) + ' 日前';
};

/* ---------- 時刻（JST / UTC の切り替えは画面上部の一か所で持つ） ---------- */
AL.JST = 9 * 3600e3;
AL.tz = 'jst';
AL.now = function () { return AL.clock ? AL.clock() : Date.now(); };
AL.parts = function (t) {
  var d = new Date(t + (AL.tz === 'jst' ? AL.JST : 0));
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
           h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay() };
};
AL.p2 = function (n) { return (n < 10 ? '0' : '') + n; };
AL.hm = function (t) { var p = AL.parts(t); return AL.p2(p.h) + ':' + AL.p2(p.mi); };
AL.hms = function (t) { var p = AL.parts(t); return AL.p2(p.h) + ':' + AL.p2(p.mi) + ':' + AL.p2(p.s); };
AL.md = function (t) { var p = AL.parts(t); return p.mo + '/' + p.d; };
AL.ymd = function (t) { var p = AL.parts(t); return p.y + '-' + AL.p2(p.mo) + '-' + AL.p2(p.d); };
AL.stamp = function (t, opt) {
  opt = opt || {};
  return (opt.date === false ? '' : AL.ymd(t) + ' ') + (opt.sec ? AL.hms(t) : AL.hm(t)) +
         (opt.tz === false ? '' : ' ' + (AL.tz === 'jst' ? 'JST' : 'UTC'));
};
/* その日の「観測夜」の始まり（正午で日付を切る。夜は日付をまたぐため） */
AL.nightOf = function (t) {
  var noon = Math.floor((t + AL.JST - 12 * 3600e3) / 86400e3) * 86400e3 + 12 * 3600e3 - AL.JST;
  return noon;
};

/* ---------- 擬似乱数（種から再現できる。模擬データはすべてこれで作る） ---------- */
AL.hash = function (s) {
  var h = 2166136261 >>> 0;
  s = String(s);
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
AL.rng = function (seed) {
  var a = AL.hash(seed) || 1;
  return function () {
    a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
};
/* 正規乱数（Box–Muller）。r は AL.rng の返り値 */
AL.gauss = function (r) {
  var u = Math.max(1e-9, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/* ---------- その他 ---------- */
AL.d2r = Math.PI / 180; AL.r2d = 180 / Math.PI;
AL.R_EARTH = 6371.0;
AL.dist = function (lat1, lon1, lat2, lon2) {
  var p = AL.d2r, dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * AL.R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
};
AL.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
AL.lerp = function (a, b, f) { return a + (b - a) * f; };
AL.sum = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; };
AL.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
