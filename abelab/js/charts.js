/* NU-AbeLab / 図
   Canvas で描く。どの図にもホバー（線・面は十字線、棒・点・升目は個別）を付ける。
   色は観測局＝系列色の固定割り当て。数値や目盛の文字は系列色ではなく文字色で書く。 */
'use strict';
(function (AL) {

var C = AL.chart = {};
var INK1 = '#e6e7ea', INK2 = '#a3a8b0', INK3 = '#777d86';
var GRID = 'rgba(255,255,255,.07)', AXIS = 'rgba(255,255,255,.16)';
var SURF = '#181b1f';

/* ---------- 下回り：canvas・再描画・ホバー ---------- */
function base(host, height, opt) {
  opt = opt || {};
  var wrap = AL.el('div', { class: 'plot', style: { height: height + 'px' } });
  var cv = AL.el('canvas');
  var tip = AL.el('div', { class: 'tip' });
  wrap.appendChild(cv); wrap.appendChild(tip);
  host.appendChild(wrap);
  var ctx = cv.getContext('2d');
  var P = { wrap: wrap, cv: cv, ctx: ctx, tip: tip, w: 0, h: height, pad: opt.pad || { l: 42, r: 10, t: 8, b: 20 } };

  P.resize = function () {
    var w = wrap.clientWidth || 600, dpr = Math.min(2, window.devicePixelRatio || 1);
    P.w = w; cv.width = Math.round(w * dpr); cv.height = Math.round(height * dpr);
    cv.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.box = { x: P.pad.l, y: P.pad.t, w: Math.max(10, w - P.pad.l - P.pad.r), h: Math.max(10, height - P.pad.t - P.pad.b) };
  };
  P.clear = function () { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    var dpr = Math.min(2, window.devicePixelRatio || 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  P.showTip = function (html, x, y) {
    tip.innerHTML = html; tip.style.opacity = 1;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(2, Math.min(P.w - tw - 2, x + 12)) + 'px';
    tip.style.top = Math.max(2, Math.min(P.h - th - 2, y - th - 10)) + 'px';
  };
  P.hideTip = function () { tip.style.opacity = 0; };
  P.on = function (move, leave) {
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      move(e.clientX - r.left, e.clientY - r.top);
    });
    cv.addEventListener('mouseleave', function () { P.hideTip(); if (leave) leave(); });
  };
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { if (P.redraw) P.redraw(); }); ro.observe(wrap); }
  return P;
}
/* 見やすい目盛の刻み */
function niceTicks(min, max, n) {
  if (!isFinite(min) || !isFinite(max) || min === max) { max = (min || 0) + 1; }
  var span = (max - min) / (n || 4);
  var mag = Math.pow(10, Math.floor(Math.log10(span)));
  var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; })
    .filter(function (s) { return s >= span; })[0] || 10 * mag;
  var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
  for (var v = lo; v <= hi + step * 0.01; v += step) if (v >= min - step * 0.01) out.push(+v.toFixed(10));
  return out;
}
function timeTicks(t0, t1, w) {
  var span = t1 - t0, want = Math.max(2, Math.floor(w / 78)), out = [];
  var steps = [1, 2, 3, 6, 12, 24, 48, 72, 168].map(function (h) { return h * 3600e3; });
  var step = steps.filter(function (s) { return span / s <= want; })[0] || steps[steps.length - 1];
  var off = AL.tz === 'jst' ? AL.JST : 0;
  var t = Math.ceil((t0 + off) / step) * step - off;
  for (; t <= t1; t += step) out.push({ t: t, label: step >= 24 * 3600e3 ? AL.md(t) : AL.hm(t) });
  return out;
}
function axes(P, t0, t1, ymin, ymax, yfmt, opt) {
  var b = P.box, ctx = P.ctx;
  var ticks = niceTicks(ymin, ymax, (opt && opt.yn) || 4);
  ctx.font = '10px ui-monospace, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ticks.forEach(function (v) {
    var y = b.y + b.h - (v - ymin) / (ymax - ymin) * b.h;
    if (y < b.y - 1 || y > b.y + b.h + 1) return;
    ctx.strokeStyle = GRID; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, Math.round(y) + .5); ctx.lineTo(b.x + b.w, Math.round(y) + .5); ctx.stroke();
    ctx.fillStyle = INK3; ctx.fillText(yfmt ? yfmt(v) : String(v), b.x - 6, y);
  });
  if (t0 != null) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    timeTicks(t0, t1, b.w).forEach(function (k) {
      var x = b.x + (k.t - t0) / (t1 - t0) * b.w;
      ctx.strokeStyle = GRID; ctx.beginPath();
      ctx.moveTo(Math.round(x) + .5, b.y); ctx.lineTo(Math.round(x) + .5, b.y + b.h); ctx.stroke();
      ctx.fillStyle = INK3; ctx.fillText(k.label, x, b.y + b.h + 5);
    });
  }
  ctx.strokeStyle = AXIS; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(b.x + .5, b.y); ctx.lineTo(b.x + .5, b.y + b.h + .5); ctx.lineTo(b.x + b.w, b.y + b.h + .5); ctx.stroke();
  return ticks;
}
function roundTop(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.max(0, h));
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h); ctx.closePath();
}
/* 凡例。系列が 2 つ以上なら必ず出す（色だけに意味を持たせない） */
C.legend = function (host, series, opts) {
  opts = opts || {};
  if (series.length < 2 && !opts.force) return null;
  var box = AL.el('div', { class: 'legend' });
  series.forEach(function (s) {
    box.appendChild(AL.el('span', { class: 'item' }, [
      AL.el('span', { class: 'mark' + (opts.square ? ' sq' : ''), style: { background: s.color } }),
      AL.el('span', { text: s.name }),
      s.value != null ? AL.el('span', { class: 'val', text: s.value }) : null
    ]));
  });
  host.appendChild(box);
  return box;
};

/* ================= 時系列（線 / 面 / 積み上げ棒） ================= */
C.timeseries = function (host, o) {
  var P = base(host, o.height || 180, { pad: o.pad });
  var ser = o.series.filter(function (s) { return s.points && s.points.length; });
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx, t0 = o.t0, t1 = o.t1;
    var ymax = o.ymax, ymin = o.ymin == null ? 0 : o.ymin;
    if (ymax == null) {
      ymax = 0;
      if (o.stack) {
        var acc = {};
        ser.forEach(function (s) { s.points.forEach(function (p) { acc[p[0]] = (acc[p[0]] || 0) + p[1]; }); });
        for (var k in acc) ymax = Math.max(ymax, acc[k]);
      } else ser.forEach(function (s) { s.points.forEach(function (p) { ymax = Math.max(ymax, p[1]); }); });
      ymax = ymax <= 0 ? 1 : ymax * 1.15;
    }
    var tk = niceTicks(ymin, ymax, 4); ymax = Math.max(ymax, tk[tk.length - 1]);
    axes(P, t0, t1, ymin, ymax, o.yfmt);
    var X = function (t) { return b.x + (t - t0) / (t1 - t0) * b.w; };
    var Y = function (v) { return b.y + b.h - (v - ymin) / (ymax - ymin) * b.h; };
    P._X = X; P._Y = Y; P._ymin = ymin; P._ymax = ymax;

    if (o.kind === 'bar') {
      var n = Math.max(1, (o.step ? (t1 - t0) / o.step : ser[0].points.length));
      var bw = Math.max(1.5, b.w / n - 2);
      var stackAcc = {};
      ser.forEach(function (s) {
        ctx.fillStyle = s.color;
        s.points.forEach(function (p) {
          var x = X(p[0]) + (o.step ? (b.w / n - bw) / 2 : -bw / 2);
          var y0 = o.stack ? (stackAcc[p[0]] || 0) : 0;
          var yTop = Y(y0 + p[1]), yBot = Y(y0);
          if (p[1] <= 0) return;
          roundTop(ctx, x, yTop, bw, Math.max(1, yBot - yTop - (o.stack ? 2 : 0)), 3);
          ctx.fill();
          if (o.stack) stackAcc[p[0]] = y0 + p[1];
        });
      });
    } else {
      ser.forEach(function (s) {
        if (s.area) {
          var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
          g.addColorStop(0, s.color + '44'); g.addColorStop(1, s.color + '05');
          ctx.beginPath(); ctx.moveTo(X(s.points[0][0]), Y(0));
          s.points.forEach(function (p) { ctx.lineTo(X(p[0]), Y(p[1])); });
          ctx.lineTo(X(s.points[s.points.length - 1][0]), Y(0)); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        var started = false;
        s.points.forEach(function (p) {
          if (p[1] == null) { started = false; return; }
          var x = X(p[0]), y = Y(p[1]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }
    if (o.marks) o.marks.forEach(function (m) {     /* 薄明・月の出などの縦帯 */
      var x0 = X(m.t0), x1 = X(m.t1);
      ctx.fillStyle = m.color || 'rgba(255,255,255,.05)';
      ctx.fillRect(Math.max(b.x, x0), b.y, Math.min(b.x + b.w, x1) - Math.max(b.x, x0), b.h);
    });
  };
  P.redraw();
  /* 十字線＋ツールチップ：いちばん近い時刻の全系列を並べる */
  P.on(function (mx, my) {
    var b = P.box;
    if (mx < b.x || mx > b.x + b.w) { P.hideTip(); P.redraw(); return; }
    var t = o.t0 + (mx - b.x) / b.w * (o.t1 - o.t0);
    var rows = [], best = null;
    ser.forEach(function (s) {
      var p = null, d = Infinity;
      s.points.forEach(function (q) { var dd = Math.abs(q[0] - t); if (dd < d) { d = dd; p = q; } });
      if (p && d < (o.snap || 2 * 3600e3)) {
        rows.push('<div class="row"><span class="mark" style="background:' + s.color + '"></span>' +
                  '<span class="nm">' + s.name + '</span><span class="v">' +
                  (o.tipfmt ? o.tipfmt(p[1]) : AL.f(p[1], 1)) + '</span></div>');
        if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
      }
    });
    if (!rows.length) { P.hideTip(); return; }
    P.redraw();
    var ctx = P.ctx, x = P._X(best[0]);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, b.y); ctx.lineTo(Math.round(x) + .5, b.y + b.h); ctx.stroke();
    ser.forEach(function (s) {
      var p = s.points.filter(function (q) { return q[0] === best[0]; })[0];
      if (!p || p[1] == null) return;
      ctx.fillStyle = s.color; ctx.strokeStyle = SURF; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P._X(p[0]), P._Y(p[1]), 4.5, 0, 7); ctx.fill(); ctx.stroke();
    });
    P.showTip('<div class="ttl">' + AL.stamp(best[0], { sec: false }) + '</div>' + rows.join(''), mx, my);
  }, function () { P.redraw(); });
  return P;
};

/* ================= XY 折れ線（時間軸でない図） ================= */
C.xy = function (host, o) {
  var P = base(host, o.height || 170, { pad: { l: 46, r: 12, t: 10, b: 26 } });
  var ser = o.series.filter(function (s) { return s.points && s.points.length; });
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx;
    var x0 = o.xmin, x1 = o.xmax, ymin = o.ymin == null ? 0 : o.ymin, ymax = o.ymax;
    if (ymax == null) {
      ymax = 0;
      ser.forEach(function (s) { s.points.forEach(function (p) { ymax = Math.max(ymax, p[1]); }); });
      ymax = ymax <= 0 ? 1 : ymax * 1.15;
    }
    var tk = niceTicks(ymin, ymax, 4); ymax = Math.max(ymax, tk[tk.length - 1]);
    axes(P, null, null, ymin, ymax, o.yfmt);
    var X = function (v) { return b.x + (v - x0) / (x1 - x0) * b.w; };
    var Y = function (v) { return b.y + b.h - (v - ymin) / (ymax - ymin) * b.h; };
    P._X = X; P._Y = Y;
    if (o.band) {                       /* 注目する範囲の帯 */
      ctx.fillStyle = 'rgba(255,255,255,.055)';
      ctx.fillRect(X(o.band[0]), b.y, X(o.band[1]) - X(o.band[0]), b.h);
      if (o.bandLabel) {
        ctx.font = '10px -apple-system, sans-serif'; ctx.fillStyle = INK3;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(o.bandLabel, (X(o.band[0]) + X(o.band[1])) / 2, b.y + 2);
      }
    }
    ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    niceTicks(x0, x1, 5).forEach(function (v) {
      var x = X(v); if (x < b.x - 1 || x > b.x + b.w + 1) return;
      ctx.strokeStyle = GRID; ctx.beginPath();
      ctx.moveTo(Math.round(x) + .5, b.y); ctx.lineTo(Math.round(x) + .5, b.y + b.h); ctx.stroke();
      ctx.fillStyle = INK3; ctx.fillText(o.xfmt ? o.xfmt(v) : String(v), x, b.y + b.h + 5);
    });
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillStyle = INK3; ctx.fillText(o.xlabel, b.x + b.w, b.y + b.h + 15); }
    ser.forEach(function (s) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      s.points.forEach(function (p, i) { var x = X(p[0]), y = Y(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    });
  };
  P.redraw();
  P.on(function (mx, my) {
    var b = P.box;
    if (mx < b.x || mx > b.x + b.w) { P.hideTip(); return; }
    var x = o.xmin + (mx - b.x) / b.w * (o.xmax - o.xmin);
    var rows = [], best = null;
    ser.forEach(function (s) {
      var p = null, d = Infinity;
      s.points.forEach(function (q) { var dd = Math.abs(q[0] - x); if (dd < d) { d = dd; p = q; } });
      if (!p) return;
      best = p;
      rows.push('<div class="row"><span class="mark" style="background:' + s.color + '"></span>' +
                '<span class="nm">' + s.name + '</span><span class="v">' +
                (o.tipfmt ? o.tipfmt(p[1]) : AL.f(p[1], 1)) + '</span></div>');
    });
    if (!rows.length) { P.hideTip(); return; }
    P.redraw();
    var ctx = P.ctx, xx = P._X(best[0]);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(xx) + .5, b.y); ctx.lineTo(Math.round(xx) + .5, b.y + b.h); ctx.stroke();
    P.showTip('<div class="ttl">' + (o.xtip ? o.xtip(best[0]) : best[0]) + '</div>' + rows.join(''), mx, my);
  }, function () { P.redraw(); });
  return P;
};

/* ================= ヒストグラム ================= */
C.hist = function (host, o) {
  var P = base(host, o.height || 160, { pad: { l: 38, r: 10, t: 8, b: 24 } });
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx;
    var ymax = 0;
    o.series.forEach(function (s) { s.bins.forEach(function (v) { ymax = Math.max(ymax, v); }); });
    ymax = ymax <= 0 ? 1 : ymax * 1.15;
    var tk = niceTicks(0, ymax, 4); ymax = tk[tk.length - 1];
    axes(P, null, null, 0, ymax, o.yfmt);
    var n = o.bins.length, gw = b.w / n;
    var k = o.series.length, bw = Math.max(1.5, (gw - 3) / k - (k > 1 ? 2 : 0));
    o.series.forEach(function (s, si) {
      ctx.fillStyle = s.color;
      s.bins.forEach(function (v, i) {
        if (!v) return;
        var x = b.x + i * gw + 1.5 + si * (bw + 2);
        var y = b.y + b.h - v / ymax * b.h;
        roundTop(ctx, x, y, bw, b.y + b.h - y, 3); ctx.fill();
      });
    });
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = INK3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    o.bins.forEach(function (lb, i) {
      if (o.labelEvery && i % o.labelEvery) return;
      ctx.fillText(lb, b.x + i * gw + gw / 2, b.y + b.h + 5);
    });
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillText(o.xlabel, b.x + b.w, b.y + b.h + 15); }
  };
  P.redraw();
  P.on(function (mx, my) {
    var b = P.box, n = o.bins.length, gw = b.w / n;
    var i = Math.floor((mx - b.x) / gw);
    if (i < 0 || i >= n || my < b.y || my > b.y + b.h) { P.hideTip(); return; }
    var rows = o.series.map(function (s) {
      return '<div class="row"><span class="mark" style="background:' + s.color + '"></span>' +
             '<span class="nm">' + s.name + '</span><span class="v">' + AL.int(s.bins[i]) + ' 件</span></div>';
    });
    P.showTip('<div class="ttl">' + (o.binTitle ? o.binTitle(i) : o.bins[i]) + '</div>' + rows.join(''), mx, my);
  });
  return P;
};

/* ================= 散布図 ================= */
C.scatter = function (host, o) {
  var P = base(host, o.height || 200, { pad: { l: 44, r: 12, t: 10, b: 28 } });
  var all = [];
  o.series.forEach(function (s) { s.points.forEach(function (p) { all.push({ s: s, p: p }); }); });
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx;
    var xs = all.map(function (a) { return a.p[0]; }), ys = all.map(function (a) { return a.p[1]; });
    var x0 = o.xmin != null ? o.xmin : Math.min.apply(null, xs), x1 = o.xmax != null ? o.xmax : Math.max.apply(null, xs);
    var y0 = o.ymin != null ? o.ymin : Math.min.apply(null, ys), y1 = o.ymax != null ? o.ymax : Math.max.apply(null, ys);
    if (!isFinite(x0)) { x0 = 0; x1 = 1; } if (!isFinite(y0)) { y0 = 0; y1 = 1; }
    var tk = niceTicks(y0, y1, 4); y0 = Math.min(y0, tk[0]); y1 = Math.max(y1, tk[tk.length - 1]);
    axes(P, null, null, y0, y1, o.yfmt);
    var X = function (v) { return b.x + (v - x0) / (x1 - x0) * b.w; };
    var Y = function (v) { return b.y + b.h - (v - y0) / (y1 - y0) * b.h; };
    P._X = X; P._Y = Y;
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = INK3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    niceTicks(x0, x1, 5).forEach(function (v) {
      var x = X(v); if (x < b.x - 1 || x > b.x + b.w + 1) return;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, b.y); ctx.lineTo(Math.round(x) + .5, b.y + b.h); ctx.stroke();
      ctx.fillStyle = INK3; ctx.fillText(o.xfmt ? o.xfmt(v) : String(v), x, b.y + b.h + 5);
    });
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillText(o.xlabel, b.x + b.w, b.y + b.h + 15); }
    all.forEach(function (a) {
      ctx.fillStyle = a.s.color + 'cc'; ctx.strokeStyle = SURF; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(a.p[0]), Y(a.p[1]), o.r || 4, 0, 7); ctx.fill(); ctx.stroke();
    });
  };
  P.redraw();
  P.on(function (mx, my) {
    var best = null, bd = 144;
    all.forEach(function (a) {
      var d = Math.pow(P._X(a.p[0]) - mx, 2) + Math.pow(P._Y(a.p[1]) - my, 2);
      if (d < bd) { bd = d; best = a; }
    });
    if (!best) { P.hideTip(); return; }
    P.showTip('<div class="ttl">' + (o.tip ? o.tip(best.p) : '') + '</div>' +
      '<div class="row"><span class="mark" style="background:' + best.s.color + '"></span>' +
      '<span class="nm">' + best.s.name + '</span></div>', mx, my);
  });
  return P;
};

/* ================= 状態タイムライン（局 × 時間） ================= */
C.timeline = function (host, o) {
  var rowH = o.rowH || 22;
  var P = base(host, o.rows.length * (rowH + 6) + 24, { pad: { l: 46, r: 10, t: 4, b: 18 } });
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx, t0 = o.t0, t1 = o.t1;
    var X = function (t) { return b.x + (t - t0) / (t1 - t0) * b.w; };
    P._X = X;
    ctx.font = '10px ui-monospace, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    timeTicks(t0, t1, b.w).forEach(function (k) {
      var x = X(k.t);
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, b.y); ctx.lineTo(Math.round(x) + .5, b.y + b.h); ctx.stroke();
      ctx.fillStyle = INK3; ctx.fillText(k.label, x, b.y + b.h + 3);
    });
    o.rows.forEach(function (row, ri) {
      var y = b.y + ri * (rowH + 6);
      ctx.font = '600 11px -apple-system, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = INK2; ctx.fillText(row.name, b.x - 6, y + rowH / 2);
      row.spans.forEach(function (sp) {
        var x0 = Math.max(b.x, X(sp.t0)), x1 = Math.min(b.x + b.w, X(sp.t1));
        if (x1 - x0 < 0.4) return;
        ctx.fillStyle = sp.color;
        roundRect(ctx, x0, y, Math.max(1, x1 - x0 - 1), rowH, 2); ctx.fill();
      });
    });
  };
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  P.redraw();
  P.on(function (mx, my) {
    var b = P.box, ri = Math.floor((my - b.y) / (rowH + 6));
    var row = o.rows[ri];
    if (!row || my < b.y) { P.hideTip(); return; }
    var t = o.t0 + (mx - b.x) / b.w * (o.t1 - o.t0);
    var sp = row.spans.filter(function (s) { return t >= s.t0 && t < s.t1; })[0];
    if (!sp) { P.hideTip(); return; }
    P.showTip('<div class="ttl">' + row.name + ' · ' + AL.hm(sp.t0) + '–' + AL.hm(sp.t1) + '</div>' +
      '<div class="row"><span class="mark" style="background:' + sp.color + '"></span><span class="nm">' + sp.label + '</span>' +
      '<span class="v">' + AL.dur((sp.t1 - sp.t0) / 1000) + '</span></div>', mx, my);
  });
  return P;
};

/* ================= ヒートマップ（日 × 時）=================
   連続量なので単色の濃淡。0 は面の色へ沈める。 */
C.heat = function (host, o) {
  var P = base(host, o.height || 190, { pad: { l: 46, r: 10, t: 8, b: 20 } });
  var RAMP = ['#14263f', '#184f95', '#256abf', '#3987e5', '#5598e7', '#86b6ef', '#b7d3f6'];
  function col(v) {
    if (v <= 0) return 'rgba(255,255,255,.04)';
    var f = Math.pow(AL.clamp(v / o.max, 0, 1), 0.62);
    return RAMP[Math.min(RAMP.length - 1, Math.floor(f * RAMP.length))];
  }
  P.redraw = function () {
    P.resize(); P.clear();
    var b = P.box, ctx = P.ctx;
    var nx = o.cols.length, ny = o.rows.length;
    var cw = b.w / nx, ch = b.h / ny;
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var v = o.get(i, j);
      ctx.fillStyle = col(v);
      ctx.fillRect(b.x + i * cw + 1, b.y + j * ch + 1, Math.max(1, cw - 2), Math.max(1, ch - 2));
    }
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = INK3;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    o.rows.forEach(function (lb, j) { if (j % (o.rowEvery || 1)) return; ctx.fillText(lb, b.x - 6, b.y + (j + .5) * ch); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    o.cols.forEach(function (lb, i) { if (i % (o.colEvery || 1)) return; ctx.fillText(lb, b.x + (i + .5) * cw, b.y + b.h + 4); });
  };
  P.redraw();
  P.on(function (mx, my) {
    var b = P.box, nx = o.cols.length, ny = o.rows.length;
    var i = Math.floor((mx - b.x) / (b.w / nx)), j = Math.floor((my - b.y) / (b.h / ny));
    if (i < 0 || j < 0 || i >= nx || j >= ny) { P.hideTip(); return; }
    P.showTip('<div class="ttl">' + o.cols[i] + ' · ' + o.rows[j] + '</div>' +
      '<div class="row"><span class="nm">' + (o.unit || '件') + '</span><span class="v">' + AL.int(o.get(i, j)) + '</span></div>', mx, my);
  });
  return P;
};

/* 濃淡の凡例 */
C.heatLegend = function (host, max, unit) {
  var RAMP = ['rgba(255,255,255,.04)', '#14263f', '#184f95', '#256abf', '#3987e5', '#5598e7', '#86b6ef', '#b7d3f6'];
  var box = AL.el('div', { class: 'legend', style: { alignItems: 'center' } }, [
    AL.el('span', { text: '0', style: { color: 'var(--text-3)' } })
  ]);
  RAMP.forEach(function (c) { box.appendChild(AL.el('span', { class: 'mark sq', style: { background: c, width: '14px' } })); });
  box.appendChild(AL.el('span', { text: AL.int(max) + ' ' + (unit || '件'), style: { color: 'var(--text-3)' } }));
  host.appendChild(box);
  return box;
};

})(AL);
