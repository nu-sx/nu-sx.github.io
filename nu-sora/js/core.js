/* NU-SORA デモ / 共通基盤: 乱数・時刻・整形・DOM/SVG・チャート部品 */
'use strict';
var NS = window.NS || (window.NS = {});

/* ---------- 決定論的擬似乱数（同じ種なら常に同じ模擬データ） ---------- */
NS.hash = function (s) {
  var h = 2166136261 >>> 0;
  s = String(s);
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
NS.rng = function (seed) {
  var a = (typeof seed === 'number' ? seed : NS.hash(seed)) >>> 0;
  var f = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = function (lo, hi) { return lo + (hi - lo) * f(); };
  f.int = function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * f()); };
  f.pick = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
  f.norm = function (mu, sd) {
    var u = Math.max(1e-9, f()), v = f();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return f;
};

/* ---------- 時刻 ---------- */
NS.JST = 9 * 3600e3;
NS.now = function () { return NS.clock ? NS.clock() : Date.now(); };
NS.jstParts = function (t) {
  var d = new Date(t + NS.JST);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(),
           mi: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds(), dow: d.getUTCDay() };
};
NS.p2 = function (n) { return (n < 10 ? '0' : '') + n; };
NS.p3 = function (n) { return (n < 100 ? (n < 10 ? '00' : '0') : '') + n; };
NS.fmtJST = function (t, opt) {
  var p = NS.jstParts(t), o = opt || {};
  var date = p.y + '-' + NS.p2(p.mo) + '-' + NS.p2(p.d);
  var time = NS.p2(p.h) + ':' + NS.p2(p.mi) + (o.sec === false ? '' : ':' + NS.p2(p.s));
  if (o.ms) time += '.' + NS.p3(p.ms);
  if (o.timeOnly) return time;
  if (o.dateOnly) return date;
  return date + ' ' + time;
};
NS.fmtUTC = function (t, opt) {
  var o = opt || {}, d = new Date(t);
  var date = d.getUTCFullYear() + '-' + NS.p2(d.getUTCMonth() + 1) + '-' + NS.p2(d.getUTCDate());
  var time = NS.p2(d.getUTCHours()) + ':' + NS.p2(d.getUTCMinutes()) + (o.sec === false ? '' : ':' + NS.p2(d.getUTCSeconds()));
  if (o.ms) time += '.' + NS.p3(d.getUTCMilliseconds());
  if (o.timeOnly) return time;
  return date + ' ' + time;
};
NS.ago = function (t, ref) {
  var s = Math.max(0, ((ref == null ? NS.now() : ref) - t) / 1000);
  if (s < 60) return Math.floor(s) + ' 秒前';
  if (s < 3600) return Math.floor(s / 60) + ' 分前';
  if (s < 86400) return Math.floor(s / 3600) + ' 時間前';
  return Math.floor(s / 86400) + ' 日前';
};
/* 地方恒星時（度）。デモの全天表示用の近似 */
NS.lst = function (t, lonDeg) {
  var jd = t / 86400000 + 2440587.5, d = jd - 2451545.0;
  var gmst = 280.46061837 + 360.98564736629 * d;
  return ((gmst + lonDeg) % 360 + 360) % 360;
};

/* ---------- 数値整形 ---------- */
NS.f = function (v, n) { return (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(n == null ? 1 : n); };
NS.sig = function (v) {
  if (v == null || !isFinite(v)) return '—';
  if (v === 0) return '0';
  var a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
};
/* 1.53e+7 → 1.53×10⁷ のように上付きで書く */
NS.SUP = { '-':'⁻', '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹' };
NS.expo = function (v, n) {
  if (v == null || !isFinite(v)) return '—';
  var e = Math.floor(Math.log(Math.abs(v)) / Math.LN10);
  var m = v / Math.pow(10, e);
  return m.toFixed(n == null ? 2 : n) + '×10' + String(e).split('').map(function (c) { return NS.SUP[c] || c; }).join('');
};
NS.mag = function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' 等'; };
NS.km = function (v, n) { return NS.f(v, n == null ? 1 : n) + ' km'; };
NS.dms = function (deg) {
  var s = deg < 0 ? '-' : '', a = Math.abs(deg), d = Math.floor(a), m = Math.floor((a - d) * 60);
  return s + d + '°' + NS.p2(m) + "'";
};
NS.latlon = function (lat, lon) {
  return NS.f(lat, 4) + '°N, ' + NS.f(lon, 4) + '°E';
};

/* ---------- 幾何 ---------- */
NS.R_EARTH = 6371.0;
NS.d2r = Math.PI / 180; NS.r2d = 180 / Math.PI;
NS.dist = function (lat1, lon1, lat2, lon2) {
  var p1 = lat1 * NS.d2r, p2 = lat2 * NS.d2r, dp = (lat2 - lat1) * NS.d2r, dl = (lon2 - lon1) * NS.d2r;
  var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * NS.R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
};
NS.bearing = function (lat1, lon1, lat2, lon2) {
  var p1 = lat1 * NS.d2r, p2 = lat2 * NS.d2r, dl = (lon2 - lon1) * NS.d2r;
  var y = Math.sin(dl) * Math.cos(p2);
  var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * NS.r2d + 360) % 360;
};
NS.compass = function (deg) {
  var n = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return n[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
};
/* 高度 h km の点を仰角 elev 以上で見込める地表半径 */
NS.groundRadius = function (h, elevDeg) {
  var R = NS.R_EARTH, e = elevDeg * NS.d2r;
  var s = Math.asin(R * Math.cos(e) / (R + h)); // 天頂角
  return R * (Math.PI / 2 - e - s);
};

/* ---------- DOM ---------- */
NS.el = function (tag, attrs, kids) {
  var e = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) e.style[s] = attrs[k][s]; }
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
  }
  NS.add(e, kids);
  return e;
};
NS.add = function (parent, kids) {
  if (kids == null) return parent;
  if (!Array.isArray(kids)) kids = [kids];
  kids.forEach(function (k) {
    if (k == null || k === false) return;
    parent.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  });
  return parent;
};
NS.SVGNS = 'http://www.w3.org/2000/svg';
NS.s = function (tag, attrs, kids) {
  var e = document.createElementNS(NS.SVGNS, tag);
  if (attrs) for (var k in attrs) {
    if (k === 'text') { e.textContent = attrs[k]; continue; }
    if (k === 'html') { e.innerHTML = attrs[k]; continue; }
    if (k.slice(0, 2) === 'on') { e.addEventListener(k.slice(2), attrs[k]); continue; }
    if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
  }
  if (kids) NS.add(e, kids);
  return e;
};
NS.clear = function (e) { while (e.firstChild) e.removeChild(e.firstChild); return e; };

/* ---------- 汎用UI部品 ---------- */
NS.panel = function (title, opts, kids) {
  opts = opts || {};
  var head = NS.el('div', { class: 'panel-h' }, [
    NS.el('h3', { text: title }),
    opts.note ? NS.el('span', { class: 'panel-note', text: opts.note }) : null,
    opts.tools || null
  ]);
  return NS.el('section', { class: 'panel' + (opts.class ? ' ' + opts.class : '') }, [head, NS.el('div', { class: 'panel-b' }, kids)]);
};
NS.kv = function (rows, cls) {
  var d = NS.el('dl', { class: 'kv ' + (cls || '') });
  rows.forEach(function (r) {
    if (!r) return;
    NS.add(d, [NS.el('dt', { text: r[0] }), NS.el('dd', r[2] ? { class: r[2], html: r[1] } : { html: r[1] })]);
  });
  return d;
};
NS.table = function (head, rows, opts) {
  opts = opts || {};
  var thead = NS.el('thead', null, NS.el('tr', null, head.map(function (h) {
    return NS.el('th', typeof h === 'object' ? h : { text: h });
  })));
  var tb = NS.el('tbody');
  rows.forEach(function (r) {
    var attrs = r.attrs || null, cells = r.cells || r;
    var tr = NS.el('tr', attrs, cells.map(function (c) {
      if (c && c.nodeType) return NS.el('td', null, c);
      return NS.el('td', typeof c === 'object' && c !== null ? c : { html: c == null ? '—' : String(c) });
    }));
    NS.add(tb, tr);
  });
  return NS.el('div', { class: 'tw' }, NS.el('table', { class: 'tbl ' + (opts.class || '') }, [thead, tb]));
};
NS.badge = function (text, kind) { return NS.el('span', { class: 'badge ' + (kind || ''), text: text }); };
/* 画面全体の再描画。app.js が実体に差し替える */
/* 既定は素通し。js/i18n.js が読み込まれると訳す関数に差し替わる */
NS.t = function (x) { return x; };
NS.rerender = function () {};
/* 更新ボタン＋最終更新時刻。onRefresh は同期関数（再描画）を渡す */
NS.refreshTool = function (onRefresh, opts) {
  opts = opts || {};
  var stamp = NS.el('span', { class: 'reftime', text: NS.fmtJST(NS.now(), { timeOnly: true }) + ' 現在' });
  var btn = NS.el('button', {
    class: 'iconbtn refbtn', type: 'button', title: opts.title || '最新の観測値を取り込んで表示を更新する',
    onclick: function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add('spin');
      var done = function () {
        btn.disabled = false;
        btn.classList.remove('spin');
        stamp.textContent = NS.fmtJST(NS.now(), { timeOnly: true }) + ' 現在';
      };
      /* 取得中であることが分かるよう 1 フレーム置いてから実行する */
      requestAnimationFrame(function () {
        try { onRefresh(); } finally { setTimeout(done, 260); }
      });
    }
  }, [NS.el('span', { class: 'refico', text: '\u27F3' }), '更新']);
  return NS.el('div', { class: 'reftool' }, [stamp, btn]);
};
NS.bar = function (frac, kind) {
  return NS.el('div', { class: 'mbar' }, NS.el('i', { class: kind || '', style: { width: Math.max(0, Math.min(1, frac)) * 100 + '%' } }));
};

/* ---------- チャート部品（すべてインラインSVG） ---------- */
NS.chart = {};
NS.chart.scale = function (d0, d1, r0, r1) {
  var f = function (v) { return d1 === d0 ? r0 : r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
  f.inv = function (p) { return d0 + (p - r0) / (r1 - r0) * (d1 - d0); };
  return f;
};
NS.chart.ticks = function (lo, hi, n) {
  n = n || 5;
  if (hi < lo) { var t0 = lo; lo = hi; hi = t0; }
  var span = hi - lo; if (!(span > 0)) return [lo];
  var step = Math.pow(10, Math.floor(Math.log10(span / n)));
  var err = span / n / step;
  if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
  var out = [], v = Math.ceil(lo / step) * step;
  for (; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return out;
};
/* 折れ線 / 面グラフ。series: [{name,color,pts:[[x,y],...],dash,area,width}] */
NS.chart.line = function (o) {
  var W = o.width || 460, H = o.height || 220;
  var m = Object.assign({ l: 46, r: 12, t: 12, b: 26 }, o.margin || {});
  var iw = W - m.l - m.r, ih = H - m.t - m.b;
  var xs = [], ys = [];
  o.series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
  var x0 = o.xDomain ? o.xDomain[0] : Math.min.apply(null, xs), x1 = o.xDomain ? o.xDomain[1] : Math.max.apply(null, xs);
  var y0 = o.yDomain ? o.yDomain[0] : Math.min.apply(null, ys), y1 = o.yDomain ? o.yDomain[1] : Math.max.apply(null, ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  if (!o.yDomain && o.pad !== false) { var pd = (y1 - y0) * 0.08; y0 -= pd; y1 += pd; }
  var X = NS.chart.scale(x0, x1, m.l, m.l + iw);
  var Y = NS.chart.scale(y0, y1, m.t + ih, m.t);
  var g = NS.s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': o.label || 'グラフ' });
  var yt = o.yTicks || NS.chart.ticks(y0, y1, o.yTickN || 4);
  yt.forEach(function (v) {
    var y = Y(v);
    NS.add(g, NS.s('line', { x1: m.l, x2: m.l + iw, y1: y, y2: y, class: 'grid' }));
    NS.add(g, NS.s('text', { x: m.l - 6, y: y + 3.5, class: 'axl', 'text-anchor': 'end', text: o.yFmt ? o.yFmt(v) : NS.sig(v) }));
  });
  var xt = o.xTicks || NS.chart.ticks(x0, x1, o.xTickN || 5);
  xt.forEach(function (v) {
    var x = X(v);
    NS.add(g, NS.s('line', { x1: x, x2: x, y1: m.t, y2: m.t + ih, class: 'grid grid-v' }));
    NS.add(g, NS.s('text', { x: x, y: H - 8, class: 'axl', 'text-anchor': 'middle', text: o.xFmt ? o.xFmt(v) : NS.sig(v) }));
  });
  (o.bands || []).forEach(function (b) {
    NS.add(g, NS.s('rect', { x: X(b.x0), y: m.t, width: Math.max(0, X(b.x1) - X(b.x0)), height: ih, fill: b.color, opacity: b.opacity == null ? 0.14 : b.opacity }));
    if (b.label) NS.add(g, NS.s('text', { x: (X(b.x0) + X(b.x1)) / 2, y: m.t + 12, class: 'axl', 'text-anchor': 'middle', fill: b.color, text: b.label }));
  });
  (o.rules || []).forEach(function (r) {
    if (r.y != null) NS.add(g, NS.s('line', { x1: m.l, x2: m.l + iw, y1: Y(r.y), y2: Y(r.y), stroke: r.color || 'currentColor', 'stroke-dasharray': r.dash || '4 3', 'stroke-width': 1, opacity: 0.75 }));
    if (r.x != null) NS.add(g, NS.s('line', { y1: m.t, y2: m.t + ih, x1: X(r.x), x2: X(r.x), stroke: r.color || 'currentColor', 'stroke-dasharray': r.dash || '4 3', 'stroke-width': 1, opacity: 0.75 }));
    if (r.label) NS.add(g, NS.s('text', { x: r.x != null ? X(r.x) + 4 : m.l + iw - 4, y: r.y != null ? Y(r.y) - 4 : m.t + 12,
      class: 'axl', 'text-anchor': r.x != null ? 'start' : 'end', fill: r.color || 'currentColor', text: r.label }));
  });
  o.series.forEach(function (s) {
    if (!s.pts.length) return;
    var d = s.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join('');
    if (s.area) {
      var base = Y(Math.max(y0, Math.min(y1, s.areaBase == null ? y0 : s.areaBase)));
      NS.add(g, NS.s('path', { d: d + 'L' + X(s.pts[s.pts.length - 1][0]).toFixed(2) + ' ' + base + 'L' + X(s.pts[0][0]).toFixed(2) + ' ' + base + 'Z',
        fill: s.color, opacity: s.areaOpacity == null ? 0.16 : s.areaOpacity, stroke: 'none' }));
    }
    NS.add(g, NS.s('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 1.7,
      'stroke-dasharray': s.dash || null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.opacity == null ? 1 : s.opacity }));
    if (s.dots) s.pts.forEach(function (p) { NS.add(g, NS.s('circle', { cx: X(p[0]), cy: Y(p[1]), r: s.dots, fill: s.color })); });
  });
  (o.marks || []).forEach(function (mk) {
    NS.add(g, NS.s('circle', { cx: X(mk.x), cy: Y(mk.y), r: mk.r || 4, fill: mk.fill || 'none', stroke: mk.color || 'currentColor', 'stroke-width': 1.6 }));
    if (mk.label) NS.add(g, NS.s('text', { x: X(mk.x) + 7, y: Y(mk.y) - 6, class: 'axl', fill: mk.color || 'currentColor', text: mk.label }));
  });
  if (o.yLabel) NS.add(g, NS.s('text', { x: 4, y: 11, class: 'axt', text: o.yLabel }));
  if (o.xLabel) NS.add(g, NS.s('text', { x: W - 4, y: H - 8, class: 'axt', 'text-anchor': 'end', text: o.xLabel }));
  return g;
};
/* 縦棒 / ヒストグラム。bars: [{x,y,color,label}] */
NS.chart.bars = function (o) {
  var W = o.width || 460, H = o.height || 200;
  var m = Object.assign({ l: 46, r: 12, t: 12, b: 30 }, o.margin || {});
  var iw = W - m.l - m.r, ih = H - m.t - m.b;
  var n = o.bars.length, bw = iw / Math.max(1, n);
  var ymax = o.yMax != null ? o.yMax : Math.max.apply(null, o.bars.map(function (b) { return b.y; }).concat([1]));
  var Y = NS.chart.scale(0, ymax, m.t + ih, m.t);
  var g = NS.s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img', 'aria-label': o.label || 'グラフ' });
  NS.chart.ticks(0, ymax, 4).forEach(function (v) {
    NS.add(g, NS.s('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), class: 'grid' }));
    NS.add(g, NS.s('text', { x: m.l - 6, y: Y(v) + 3.5, class: 'axl', 'text-anchor': 'end', text: o.yFmt ? o.yFmt(v) : NS.sig(v) }));
  });
  o.bars.forEach(function (b, i) {
    var x = m.l + i * bw, h = Math.max(0, m.t + ih - Y(b.y));
    NS.add(g, NS.s('rect', { x: x + bw * 0.14, y: Y(b.y), width: bw * 0.72, height: h, fill: b.color || 'var(--accent)', opacity: b.opacity == null ? 0.88 : b.opacity,
      rx: 1 }, b.title ? NS.s('title', { text: b.title }) : null));
    if (b.label && (n <= 26 || i % Math.ceil(n / 18) === 0))
      NS.add(g, NS.s('text', { x: x + bw / 2, y: H - 10, class: 'axl', 'text-anchor': 'middle', text: b.label }));
    if (b.top) NS.add(g, NS.s('text', { x: x + bw / 2, y: Y(b.y) - 4, class: 'axl', 'text-anchor': 'middle', text: b.top }));
  });
  if (o.yLabel) NS.add(g, NS.s('text', { x: 4, y: 11, class: 'axt', text: o.yLabel }));
  if (o.xLabel) NS.add(g, NS.s('text', { x: W - 4, y: H - 8, class: 'axt', 'text-anchor': 'end', text: o.xLabel }));
  return g;
};
/* 半円ゲージ */
NS.chart.gauge = function (o) {
  var W = 190, H = 108, cx = W / 2, cy = H - 12, R = 74;
  var g = NS.s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'gauge', role: 'img', 'aria-label': (o.label || '') + ' ' + o.value });
  var arc = function (a0, a1, r, w, color, op) {
    var p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    return NS.s('path', { d: 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2),
      fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'butt', opacity: op == null ? 1 : op });
  };
  var A = function (v) { return Math.PI + Math.max(0, Math.min(1, (v - o.min) / (o.max - o.min))) * Math.PI; };
  (o.zones || []).forEach(function (z) { NS.add(g, arc(A(z[0]), A(z[1]), R, 13, z[2], 0.3)); });
  NS.add(g, arc(Math.PI, A(o.value), R, 13, o.color || 'var(--accent)', 1));
  var a = A(o.value);
  NS.add(g, NS.s('circle', { cx: cx + R * Math.cos(a), cy: cy + R * Math.sin(a), r: 4.6, fill: 'var(--panel)', stroke: o.color || 'var(--accent)', 'stroke-width': 2.4 }));
  NS.add(g, NS.s('text', { x: cx, y: cy - 16, class: 'gv', 'text-anchor': 'middle', text: o.text || NS.sig(o.value) }));
  NS.add(g, NS.s('text', { x: cx, y: cy, class: 'gl', 'text-anchor': 'middle', text: o.unit || '' }));
  NS.add(g, NS.s('text', { x: cx - R, y: cy + 14, class: 'axl', 'text-anchor': 'middle', text: o.minLabel != null ? o.minLabel : o.min }));
  NS.add(g, NS.s('text', { x: cx + R, y: cy + 14, class: 'axl', 'text-anchor': 'middle', text: o.maxLabel != null ? o.maxLabel : o.max }));
  return g;
};
/* 積み上げ面（寄与分離用） */
NS.chart.stack = function (o) {
  var W = o.width || 460, H = o.height || 220;
  var m = Object.assign({ l: 46, r: 12, t: 12, b: 26 }, o.margin || {});
  var iw = W - m.l - m.r, ih = H - m.t - m.b;
  var n = o.x.length;
  var tot = new Array(n).fill(0);
  o.series.forEach(function (s) { s.v.forEach(function (v, i) { tot[i] += v; }); });
  var ymax = o.yMax != null ? o.yMax : Math.max.apply(null, tot) * 1.08;
  var X = NS.chart.scale(o.x[0], o.x[n - 1], m.l, m.l + iw), Y = NS.chart.scale(0, ymax, m.t + ih, m.t);
  var g = NS.s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart' });
  NS.chart.ticks(0, ymax, 4).forEach(function (v) {
    NS.add(g, NS.s('line', { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), class: 'grid' }));
    NS.add(g, NS.s('text', { x: m.l - 6, y: Y(v) + 3.5, class: 'axl', 'text-anchor': 'end', text: o.yFmt ? o.yFmt(v) : NS.sig(v) }));
  });
  (o.xTicks || NS.chart.ticks(o.x[0], o.x[n - 1], 5)).forEach(function (v) {
    NS.add(g, NS.s('text', { x: X(v), y: H - 8, class: 'axl', 'text-anchor': 'middle', text: o.xFmt ? o.xFmt(v) : NS.sig(v) }));
  });
  var base = new Array(n).fill(0);
  o.series.forEach(function (s) {
    var up = [], dn = [];
    for (var i = 0; i < n; i++) { up.push([o.x[i], base[i] + s.v[i]]); dn.push([o.x[i], base[i]]); }
    var d = up.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join('') +
      dn.reverse().map(function (p) { return 'L' + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join('') + 'Z';
    NS.add(g, NS.s('path', { d: d, fill: s.color, opacity: s.opacity == null ? 0.72 : s.opacity, stroke: s.color, 'stroke-width': 0.6 }));
    for (var j = 0; j < n; j++) base[j] += s.v[j];
  });
  if (o.yLabel) NS.add(g, NS.s('text', { x: 4, y: 11, class: 'axt', text: o.yLabel }));
  return g;
};
NS.chart.legend = function (items) {
  return NS.el('div', { class: 'legend' }, items.map(function (it) {
    return NS.el('span', { class: 'lg' }, [
      NS.el('i', { style: { background: it[1], borderRadius: it[2] === 'line' ? '0' : '2px', height: it[2] === 'line' ? '2px' : '9px' } }),
      NS.el('span', { text: it[0] })
    ]);
  }));
};
NS.chart.spark = function (vals, o) {
  o = o || {};
  var W = o.width || 110, H = o.height || 26, n = vals.length;
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  var d = vals.map(function (v, i) {
    return (i ? 'L' : 'M') + (i / (n - 1) * (W - 2) + 1).toFixed(1) + ' ' + ((1 - (v - lo) / (hi - lo)) * (H - 4) + 2).toFixed(1);
  }).join('');
  return NS.s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark' }, [
    NS.s('path', { d: d, fill: 'none', stroke: o.color || 'var(--accent)', 'stroke-width': 1.4, 'stroke-linejoin': 'round' })
  ]);
};
