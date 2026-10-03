/* NU-AbeLab / 画面 ③検出結果 ④同時観測 ⑤観測条件 */
'use strict';
(function (AL) {

var el = AL.el, panel = AL.panel, C = AL.chart;
var SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, kids) {
  var e = document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

/* ================= ③ 検出結果 ================= */
AL.V.events = function (root, ui) {
  var ids = ui.stations, t0 = ui.t0, t1 = ui.t1;
  var ev = AL.data.events(ids, t0, t1);
  var g = el('div', { class: 'grid' });

  /* --- 集計 --- */
  var bright = ev.reduce(function (a, e) { return (a == null || e.mag < a.mag) ? e : a; }, null);
  var shn = ev.filter(function (e) { return e.shower; }).length;
  var p0 = panel('検出の概要', { col: 'c3', note: ui.rangeLabel });
  var b0 = p0.querySelector('.body');
  AL.add(b0, AL.stat(AL.int(ev.length), '件', '検出イベント'));
  AL.add(b0, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
    AL.stat(ev.length ? AL.mag(AL.sum(ev.map(function (e) { return e.mag; })) / ev.length) : '—', '等', '平均等級', { sm: true }),
    AL.stat(bright ? AL.mag(bright.mag) : '—', '等', '最も明るい', { sm: true }),
    AL.stat(ev.length ? AL.pct(shn / ev.length) : '—', '', '流星群に属する', { sm: true }),
    AL.stat(AL.int(ev.filter(function (e) { return e.shared; }).length), '件', '同時観測', { sm: true })
  ]));
  g.appendChild(p0);

  /* --- 等級分布 --- */
  var BINS = [], LO = -6, HI = 6;
  for (var m = LO; m < HI; m++) BINS.push((m >= 0 ? '+' : '') + m);
  var magSer = ids.map(function (id) {
    var st = AL.st(id), bins = BINS.map(function () { return 0; });
    ev.forEach(function (e) {
      if (e.st !== id) return;
      var i = Math.floor(e.mag) - LO;
      if (i >= 0 && i < bins.length) bins[i]++;
    });
    return { name: st.name, color: st.hex, bins: bins };
  });
  var p1 = panel('等級分布', { col: 'c5', note: '1 等ごと。暗い側は限界等級で落ちる' });
  var b1 = p1.querySelector('.body');
  C.hist(b1, { bins: BINS, series: magSer, height: 170, xlabel: '等級',
    binTitle: function (i) { return (LO + i) + ' 〜 ' + (LO + i + 1) + ' 等'; } });
  C.legend(b1, magSer.map(function (s) { return { name: s.name, color: s.color, value: AL.int(AL.sum(s.bins)) + ' 件' }; }), { square: true });
  g.appendChild(p1);

  /* --- 出現時刻の分布 --- */
  var HR = []; for (var h = 18; h < 18 + 12; h++) HR.push(((h % 24) + '時'));
  var hrSer = ids.map(function (id) {
    var st = AL.st(id), bins = HR.map(function () { return 0; });
    ev.forEach(function (e) {
      if (e.st !== id) return;
      var hh = AL.parts(e.t).h, i = (hh - 18 + 24) % 24;
      if (i < 12) bins[i]++;
    });
    return { name: st.name, color: st.hex, bins: bins };
  });
  var p2 = panel('出現時刻の分布', { col: 'c4', note: '地方時。明け方ほど多いのが流星の常' });
  C.hist(p2.querySelector('.body'), { bins: HR, series: hrSer, height: 170, labelEvery: 2, xlabel: '時刻' });
  g.appendChild(p2);

  /* --- 継続時間 vs 等級 --- */
  var p3 = panel('継続時間と明るさ', { col: 'c6', note: '明るい流星ほど長く光る' });
  var b3 = p3.querySelector('.body');
  C.scatter(b3, {
    height: 210, xmin: -6, xmax: 6, ymin: 0,
    xlabel: '等級', yfmt: function (v) { return AL.f(v, 1) + 's'; },
    series: ids.map(function (id) {
      var st = AL.st(id);
      return { name: st.name, color: st.hex,
               points: ev.filter(function (e) { return e.st === id; }).slice(0, 400).map(function (e) { return [e.mag, e.dur, e]; }) };
    }),
    tip: function (p) { return AL.mag(p[0]) + ' 等 / ' + AL.f(p[1], 2) + ' 秒' + (p[2] && p[2].shower ? ' / ' + p[2].shower : ''); }
  });
  C.legend(b3, ids.map(function (id) { return { name: AL.st(id).name, color: AL.st(id).hex }; }), { square: true });
  g.appendChild(p3);

  /* --- 群の内訳 --- */
  var byShower = {};
  ev.forEach(function (e) { var k = e.shower || '散在'; byShower[k] = (byShower[k] || 0) + 1; });
  var shRows = Object.keys(byShower).sort(function (a, b) { return byShower[b] - byShower[a]; }).map(function (k) {
    var sh = AL.SHOWERS.filter(function (s) { return s[0] === k; })[0];
    return [k, sh ? sh[1] : '—', AL.int(byShower[k]), AL.pct(byShower[k] / Math.max(1, ev.length)),
            sh ? AL.f(sh[6], 0) + ' km/s' : '—'];
  });
  var p4 = panel('流星群の内訳', { col: 'c6', note: '輻射点と出現方向から判定（模擬）' });
  AL.add(p4.querySelector('.body'), AL.table(
    ['略号', '群名', ['件数', 'num'], ['割合', 'num'], ['対地速度', 'num']], shRows, { max: '210px' }));
  g.appendChild(p4);

  /* --- イベント表 --- */
  var p5 = panel('イベント一覧', { col: 'c12', note: AL.int(ev.length) + ' 件（新しい順・上位 300 件を表示）' });
  AL.add(p5.querySelector('.body'), AL.table(
    ['時刻', '局', ['等級', 'num'], ['継続', 'num'], ['角速度', 'num'], ['フレーム', 'num'], '群', '同時', 'ファイル'],
    ev.slice(0, 300).map(function (e) {
      var st = AL.st(e.st);
      return [AL.stamp(e.t, { sec: true }),
        el('span', null, [el('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px',
          background: st.hex, marginRight: '5px' } }), st.name]),
        AL.mag(e.mag), AL.f(e.dur, 2) + ' s', AL.f(e.vang, 1) + ' °/s', AL.int(e.frames),
        e.shower || '散在', e.shared ? '◎ ' + e.shared : '',
        el('span', { style: { color: 'var(--text-3)', fontFamily: 'var(--mono)' }, text: e.file || '—' })];
    }), { max: '420px' }));
  g.appendChild(p5);
  root.appendChild(g);
};

/* ================= ④ 同時観測 ================= */
AL.V.pairs = function (root, ui) {
  var t0 = ui.t0, t1 = ui.t1;
  var prs = AL.data.pairs(t0, t1);
  var g = el('div', { class: 'grid' });
  var H = 100;                                   /* 流星の代表的な発光高度 */
  var ov = AL.overlapAt('KSO', 'AKN', H), hh = AL.overlapHeights('KSO', 'AKN');
  var kso = AL.st('KSO'), akn = AL.st('AKN'), fnb = AL.st('FNB');

  /* --- 概要 --- */
  var dts = prs.map(function (p) { return p.dt; }).sort(function (a, b) { return a - b; });
  var ksoN = AL.summary(['KSO'], t0, t1).total.n;
  var p0 = panel('同時観測の成立', { col: 'c3', note: '木曽 × 明野' });
  var b0 = p0.querySelector('.body');
  AL.add(b0, AL.stat(AL.int(prs.length), '組', ui.rangeLabel + 'の同時イベント'));
  AL.add(b0, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
    AL.stat(ksoN ? AL.pct(prs.length / ksoN) : '—', '', '木曽の検出に占める割合', { sm: true }),
    AL.stat(dts.length ? AL.int(dts[dts.length >> 1]) : '—', 'ms', '時刻差の中央値', { sm: true }),
    AL.stat(AL.f(AL.baseline('KSO', 'AKN'), 1), 'km', '基線長', { sm: true }),
    AL.stat(AL.pct(ov.frac), '', '高度 100 km の視野重なり', { sm: true })
  ]));
  AL.add(b0, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '2 局で同じ流星を取れると、視差から発光点・消滅点の高度と速度が決まり、軌道要素まで辿れる。' +
          'DIMS の日本側はこの木曽 × 明野の対を主眼に置いている。' }));
  g.appendChild(p0);

  /* --- 断面図（東西断面）--- */
  var p1 = panel('視野の重なり（東西断面）', { col: 'c5',
    note: '両局とも北へ天頂角 ' + kso.za + '°。横軸は基線の中点からの東西距離' });
  (function () {
    var W = 520, Hh = 240, pad = { l: 36, r: 10, t: 10, b: 24 };
    var xs = [-170, 170], ys = [0, 150];
    var X = function (v) { return pad.l + (v - xs[0]) / (xs[1] - xs[0]) * (W - pad.l - pad.r); };
    var Y = function (v) { return Hh - pad.b - (v - ys[0]) / (ys[1] - ys[0]) * (Hh - pad.t - pad.b); };
    var mid = (kso.lon + akn.lon) / 2;
    var ex = function (st) { return (st.lon - mid) * 111.32 * Math.cos(st.lat * AL.d2r); };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: '100%', style: 'display:block' });
    /* 目盛 */
    [0, 50, 100, 150].forEach(function (v) {
      svg.appendChild(sv('line', { x1: X(xs[0]), y1: Y(v), x2: X(xs[1]), y2: Y(v), stroke: 'rgba(255,255,255,.07)' }));
      svg.appendChild(sv('text', { x: pad.l - 6, y: Y(v) + 3, fill: '#777d86', 'font-size': 10, 'text-anchor': 'end',
        'font-family': 'ui-monospace,monospace' }, String(v)));
    });
    [-150, -100, -50, 0, 50, 100, 150].forEach(function (v) {
      svg.appendChild(sv('text', { x: X(v), y: Hh - 6, fill: '#777d86', 'font-size': 10, 'text-anchor': 'middle',
        'font-family': 'ui-monospace,monospace' }, String(v)));
    });
    svg.appendChild(sv('text', { x: pad.l - 6, y: Y(150) - 2, fill: '#777d86', 'font-size': 10, 'text-anchor': 'end' }, '高度 km'));
    /* 流星の発光層 */
    svg.appendChild(sv('rect', { x: X(xs[0]), y: Y(120), width: X(xs[1]) - X(xs[0]), height: Y(70) - Y(120),
      fill: 'rgba(255,255,255,.04)' }));
    svg.appendChild(sv('text', { x: X(xs[1]) - 4, y: Y(118), fill: '#777d86', 'font-size': 10, 'text-anchor': 'end' }, '流星の発光層 70–120 km'));
    /* 各局の視野（高度が上がるほど東西に広がる扇） */
    [kso, akn].forEach(function (st) {
      var e0 = ex(st);
      var half = function (h) { return (h / Math.cos(st.za * AL.d2r)) * Math.tan(AL.RIG.fovW / 2 * AL.d2r); };
      var pts = [[e0, 0], [e0 - half(150), 150], [e0 + half(150), 150]];
      svg.appendChild(sv('polygon', { points: pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' '),
        fill: st.hex + '26', stroke: st.hex, 'stroke-width': 1.5 }));
      svg.appendChild(sv('circle', { cx: X(e0), cy: Y(0), r: 4, fill: st.hex, stroke: '#181b1f', 'stroke-width': 1.5 }));
      svg.appendChild(sv('text', { x: X(e0), y: Y(0) + 16, fill: '#a3a8b0', 'font-size': 11, 'text-anchor': 'middle' }, st.name));
    });
    /* 重なり（両方の扇に入る帯） */
    var halfK = function (h) { return (h / Math.cos(kso.za * AL.d2r)) * Math.tan(AL.RIG.fovW / 2 * AL.d2r); };
    var lo = null, poly1 = [], poly2 = [];
    for (var h = 0; h <= 150; h += 2) {
      var a0 = ex(kso) - halfK(h), a1 = ex(kso) + halfK(h);
      var b1x = ex(akn) - halfK(h), b2x = ex(akn) + halfK(h);
      var l = Math.max(a0, b1x), r = Math.min(a1, b2x);
      if (r > l) { if (lo == null) lo = h; poly1.push([l, h]); poly2.unshift([r, h]); }
    }
    if (poly1.length) {
      svg.appendChild(sv('polygon', { points: poly1.concat(poly2).map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' '),
        fill: 'rgba(255,255,255,.16)', stroke: 'rgba(255,255,255,.4)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      svg.appendChild(sv('text', { x: X(0), y: Y(135), fill: '#e6e7ea', 'font-size': 11, 'text-anchor': 'middle' },
        '両局が見込む空間（高度 ' + lo + ' km 以上）'));
    }
    p1.querySelector('.body').appendChild(svg);
  })();
  g.appendChild(p1);

  /* --- 時刻差 --- */
  var p2 = panel('同時イベントの時刻差', { col: 'c4', note: '2 局の記録時刻のずれ（GPS 同期なしの PC 時計）' });
  (function () {
    var bins = [], labels = [];
    for (var i = 0; i < 8; i++) { bins.push(0); labels.push((i * 20) + ''); }
    prs.forEach(function (p) { var i = Math.min(7, Math.floor(p.dt / 20)); bins[i]++; });
    C.hist(p2.querySelector('.body'), {
      bins: labels, series: [{ name: '同時イベント', color: '#5598e7', bins: bins }],
      height: 170, xlabel: 'ms', labelEvery: 2,
      binTitle: function (i) { return (i * 20) + '–' + ((i + 1) * 20) + ' ms'; }
    });
    AL.add(p2.querySelector('.body'), el('div', { class: 'note', style: { marginTop: '4px' },
      text: '映像は 30 fps なので 1 フレーム = 33 ms。これより細かく合わせるには GPS 時刻の重畳が要る。' }));
  })();
  g.appendChild(p2);

  /* --- 日本地図への投影（気象衛星を重ねられる）--- */
  var ALT = [70, 80, 90, 100, 110, 120];
  var curAlt = 100;
  var p3 = panel('視野の投影（日本地図）', { col: 'c7', right: [],
    note: '各局が高度の層で覆う範囲。ホイールで拡大、ドラッグで移動' });
  (function () {
    var b = p3.querySelector('.body');
    var status = el('span', { class: 'note' });
    /* 操作：高度・衛星バンド・不透明度 */
    var selAlt = el('select', { onchange: function () { curAlt = +selAlt.value; draw(true); } },
      ALT.map(function (h) { return el('option', { value: h, text: h + ' km', selected: h === curAlt ? '' : null }); }));
    var selBand = el('select', { onchange: function () {
      sat.setBand(selBand.value || null, function (t) { status.textContent = t; });
      opa.disabled = !selBand.value;
    } }, [el('option', { value: '', text: 'なし' })].concat(AL.JMA_BANDS.map(function (bd) {
      return el('option', { value: bd.key, text: bd.name, title: bd.desc });
    })));
    var opa = el('input', { type: 'range', min: 10, max: 100, value: 60, disabled: 'disabled',
      oninput: function () { sat.setOpacity(opa.value / 100); } });
    AL.add(p3.querySelector('header .right'), [
      el('span', { class: 'ctl' }, ['高度', selAlt]),
      el('span', { class: 'ctl' }, ['気象衛星', selBand, opa])
    ]);

    var M = AL.Map();
    b.appendChild(M.node);
    M.node.appendChild(el('div', { class: 'maphint', text: 'ひまわり：気象庁' }));
    var sat = AL.satLayer(M);

    function poly(g, pts, attrs) {
      var d = pts.map(function (q) { var xy = AL.proj(q.lon, q.lat); return xy[0].toFixed(1) + ',' + xy[1].toFixed(1); }).join(' ');
      var e = AL.s('polygon', Object.assign({ points: d }, attrs || {}));
      g.appendChild(e);
      return e;
    }
    function clearG(g) { while (g.firstChild) g.removeChild(g.firstChild); }

    function draw(refit) {
      clearG(M.layers.fov); clearG(M.layers.ov); clearG(M.layers.st);
      var all = [];
      /* 各局の視野（天頂角で奥ほど広がる台形） */
      [kso, akn, fnb].forEach(function (st) {
        var pts = AL.footprintPoly(st, curAlt).map(function (ne) { return AL.neToLatLon(ne, st); });
        poly(M.layers.fov, pts, { fill: st.hex, stroke: st.hex });
        all = all.concat(pts, [{ lat: st.lat, lon: st.lon }]);
      });
      /* 木曽 × 明野の重なりと基線 */
      var ov = AL.overlapAt('KSO', 'AKN', curAlt);
      if (ov.poly.length > 2) {
        var pts2 = ov.poly.map(function (ne) { return AL.neToLatLon(ne, ov.ref); });
        poly(M.layers.ov, pts2);
        var cx = pts2.reduce(function (a, q) { return a + q.lon; }, 0) / pts2.length;
        var cy = pts2.reduce(function (a, q) { return a + q.lat; }, 0) / pts2.length;
        var c = AL.proj(cx, cy);
        M.layers.ov.appendChild(AL.s('text', { x: c[0], y: c[1], class: 'ovlbl',
          text: '同時観測の領域 ' + AL.int(ov.areaKm2) + ' km²' }));
      }
      var a1 = AL.proj(kso.lon, kso.lat), a2 = AL.proj(akn.lon, akn.lat);
      M.layers.ov.appendChild(AL.s('line', { x1: a1[0], y1: a1[1], x2: a2[0], y2: a2[1] }));
      /* 観測局 */
      [kso, akn, fnb].forEach(function (st) {
        var xy = AL.proj(st.lon, st.lat);
        M.layers.st.appendChild(AL.s('circle', { cx: xy[0], cy: xy[1], r: 4, fill: st.hex },
          [AL.s('title', { text: st.full })]));
        M.layers.st.appendChild(AL.s('text', { x: xy[0], y: xy[1], 'data-y': xy[1], text: st.name }));
      });
      if (refit) M.fit(all, 0.1);
      marks();
      /* 注記を更新 */
      hint.textContent = '高度 ' + curAlt + ' km：木曽 × 明野の視野は ' +
        (ov.overlap ? AL.pct(ov.frac) + ' 重なり、' + AL.int(ov.areaKm2) + ' km² を共有する。' : '重ならない。') +
        '船橋は現在の向きではこの層で両局と交わらない。';
    }
    /* 記号と文字は拡大率によらず同じ大きさに見えるようにする */
    function marks() {
      var k = 1 / Math.max(0.02, M.unit());        /* 画面 1 px ぶんの viewBox 単位 */
      Array.prototype.forEach.call(M.layers.st.querySelectorAll('circle'), function (c) { c.setAttribute('r', (4.2 * k).toFixed(2)); });
      Array.prototype.forEach.call(M.layers.st.querySelectorAll('text'), function (t) {
        t.setAttribute('font-size', (11 * k).toFixed(2));
        t.setAttribute('y', (+t.getAttribute('data-y') + 13 * k).toFixed(1));
      });
      Array.prototype.forEach.call(M.layers.ov.querySelectorAll('text'), function (t) { t.setAttribute('font-size', (10 * k).toFixed(2)); });
      Array.prototype.forEach.call(M.svg.querySelectorAll('.m-grid .gt'), function (t) { t.setAttribute('font-size', (5.5 * k).toFixed(2)); });
    }
    M.onView = marks;
    var hint = el('div', { class: 'note', style: { marginTop: '6px' } });
    C.legend(b, [kso, akn, fnb].map(function (st) { return { name: st.name + '局の視野', color: st.hex }; })
      .concat([{ name: '同時観測の領域', color: 'rgba(255,255,255,.45)' }]), { square: true });
    b.appendChild(hint);
    b.appendChild(el('div', { class: 'note', style: { marginTop: '2px' } }, [
      '気象衛星はひまわりの実データ（気象庁）。選んだときだけ取得する。', status
    ]));
    draw(true);
    setTimeout(function () { draw(true); }, 0);          /* パネルの幅が決まってから枠を合わせ直す */
  })();
  g.appendChild(p3);

  /* --- 船橋局の扱い --- */
  var p4 = panel('船橋局を同時観測に加えるには', { col: 'c5', note: '現在の向きでは重ならない' });
  var b4 = p4.querySelector('.body');
  var rows = AL.PAIRS.map(function (pp) {
    var o = AL.overlapAt(pp[0], pp[1], H), hr = AL.overlapHeights(pp[0], pp[1]);
    return [AL.st(pp[0]).name + ' × ' + AL.st(pp[1]).name, AL.f(o.sep, 1) + ' km',
      o.overlap ? AL.state('good', '重なる', '●') : AL.state('idle', '重ならない', '○'),
      o.overlap ? AL.pct(o.frac) : '—',
      hr.lo ? hr.lo + ' km 以上' : '—'];
  });
  AL.add(b4, AL.table(['組', ['基線長', 'num'], '高度 100 km', ['重なり', 'num'], ['重なり始める高度', 'num']], rows, { scroll: false }));
  /* 船橋から明野の視野中心を見込む向きを出す */
  (function () {
    var fc = AL.footprint(akn, H);
    var midLat2 = akn.lat + fc.mid / 111.32;
    var dN = (midLat2 - fnb.lat) * 111.32;
    var dE = (akn.lon - fnb.lon) * 111.32 * Math.cos(fnb.lat * AL.d2r);
    var az = (Math.atan2(dE, dN) * AL.r2d + 360) % 360;
    var ground = Math.hypot(dN, dE);
    var za = Math.atan2(ground, H) * AL.r2d;
    AL.add(b4, el('div', { class: 'note', style: { marginTop: '8px' } }, [
      '船橋局は基線 ' + AL.f(AL.baseline('AKN', 'FNB'), 0) + ' km と長く、両局とも北の同じ天頂角を向いているため視野が交わらない。' +
      '明野局の視野中心（高度 ' + H + ' km）を見込むには、船橋局を方位 ' + AL.f(az, 0) + '°・天頂角 ' + AL.f(za, 0) +
      '° に向ける必要がある。天頂角が ' + AL.f(za, 0) + '° では視線が大気を長く通り、限界等級がさらに浅くなるため、' +
      '船橋局は同時観測の 3 局目ではなく、機材試験と明るい火球の監視に充てるのが現実的である。'
    ]));
  })();
  g.appendChild(p4);

  /* --- 同時イベント表 --- */
  var p5 = panel('同時観測イベント', { col: 'c12', note: AL.int(prs.length) + ' 組' });
  AL.add(p5.querySelector('.body'), prs.length ? AL.table(
    ['時刻（木曽）', ['木曽 等級', 'num'], ['明野 等級', 'num'], ['時刻差', 'num'], ['角速度差', 'num'], '群', '識別子'],
    prs.slice(0, 200).map(function (p) {
      return [AL.stamp(p.a.t, { sec: true }), AL.mag(p.a.mag), AL.mag(p.b.mag),
        AL.int(p.dt) + ' ms', AL.f(Math.abs(p.a.vang - p.b.vang), 1) + ' °/s',
        p.a.shower || '散在',
        el('span', { style: { fontFamily: 'var(--mono)', color: 'var(--text-3)' }, text: p.id })];
    }), { max: '320px' }) : el('div', { class: 'note', text: 'この期間に同時観測は成立していない。' }));
  g.appendChild(p5);
  root.appendChild(g);
};

/* ================= ⑤ 観測条件 ================= */
AL.V.plan = function (root, ui) {
  var now = AL.now(), g = el('div', { class: 'grid' });
  var ids = ui.stations.length ? ui.stations : AL.STL;

  /* --- 今夜のタイムライン --- */
  var st0 = AL.st(ids[0]);
  var n0 = AL.night(now, st0);
  var tl0 = n0.noon + 6 * 3600e3, tl1 = n0.noon + 22 * 3600e3;
  var p1 = panel('今夜のタイムライン', { col: 'c12',
    note: '日没 30 分後から日の出 30 分前まで自動で観測する。暗夜は天文薄明の外で月が出ていない時間' });
  var b1 = p1.querySelector('.body');
  C.timeline(b1, { t0: tl0, t1: tl1, rowH: 20, rows: ids.map(function (id) {
    var st = AL.st(id), n = AL.night(now, st), spans = [];
    var step = 10 * 60e3;
    var cur = null;
    for (var t = tl0; t < tl1; t += step) {
      var sa = AL.sunAlt(t + step / 2, st.lat, st.lon), ma = AL.moonAlt(t + step / 2, st.lat, st.lon);
      var k = sa > -0.833 ? 'day' : sa > -18 ? 'twi' : (ma > 0 ? 'moon' : 'dark');
      if (!cur || cur.k !== k) { cur = { k: k, t0: t, t1: t + step }; spans.push(cur); } else cur.t1 = t + step;
    }
    var LAB = { day: ['昼間', 'rgba(255,255,255,.07)'], twi: ['薄明', '#4a3a26'],
                moon: ['月あり（背景が明るい）', '#2b3a52'], dark: ['暗夜', '#184f95'] };
    return { name: st.name, spans: spans.map(function (s) {
      return { t0: s.t0, t1: s.t1, label: LAB[s.k][0], color: LAB[s.k][1] };
    }) };
  }) });
  C.legend(b1, [['昼間', 'rgba(255,255,255,.07)'], ['薄明', '#4a3a26'], ['月あり（背景が明るい）', '#2b3a52'], ['暗夜', '#184f95']]
    .map(function (x) { return { name: x[0], color: x[1] }; }), { square: true, force: true });
  g.appendChild(p1);

  /* --- 今後 14 夜 --- */
  var nights = [];
  for (var i = 0; i < 14; i++) {
    var nn = AL.nightOf(now + i * 86400e3);
    var N = AL.night(nn + 18 * 3600e3, st0);
    nights.push({ t: nn, dark: N.darkHours, obs: N.obsHours, illum: N.moon.illum, age: N.moon.age });
  }
  var p2 = panel('暗夜時間の見通し（14 夜）', { col: 'c6', note: st0.name + '局。月明かりのない観測時間' });
  var b2 = p2.querySelector('.body');
  C.timeseries(b2, { t0: nights[0].t, t1: nights[13].t + 86400e3, height: 160, step: 86400e3,
    series: [{ name: '暗夜時間', color: '#3987e5', points: nights.map(function (x) { return [x.t, x.dark]; }) }],
    kind: 'bar', snap: 43200e3, yfmt: function (v) { return AL.f(v, 0) + 'h'; },
    tipfmt: function (v) { return AL.f(v, 1) + ' 時間'; } });
  C.legend(b2, [{ name: '暗夜時間（月なし・天文薄明の外）', color: '#3987e5' }], { square: true, force: true });
  g.appendChild(p2);

  var p3 = panel('月の輝面比（14 夜）', { col: 'c6', note: '満月に近いほどトリガー閾値が上がる' });
  C.timeseries(p3.querySelector('.body'), { t0: nights[0].t, t1: nights[13].t + 86400e3, height: 160,
    ymin: 0, ymax: 100, snap: 43200e3,
    series: [{ name: '輝面比', color: '#c98500', area: true, points: nights.map(function (x) { return [x.t, x.illum * 100]; }) }],
    yfmt: function (v) { return AL.f(v, 0) + '%'; }, tipfmt: function (v) { return AL.f(v, 0) + ' %'; } });
  g.appendChild(p3);

  /* --- 流星群 --- */
  var lam = AL.sun(now).lon;
  var shRows = AL.SHOWERS.map(function (sh) {
    var d = ((sh[2] - lam + 540) % 360) - 180;                 /* 極大までの太陽黄経差 */
    var days = d / 0.9856;
    var alt = AL.radiantAlt(sh, st0, AL.nightOf(now) + 14 * 3600e3);   /* 地方時 2 時の輻射点高度 */
    return { sh: sh, days: days, zhr: AL.showerZHR(sh, lam), alt: alt };
  }).sort(function (a, b) { return Math.abs(a.days) - Math.abs(b.days); });
  var p4 = panel('流星群', { col: 'c6', note: '極大が近い順。輻射点高度は地方時 2 時・' + st0.name + '局' });
  AL.add(p4.querySelector('.body'), AL.table(
    ['略号', '群名', ['極大まで', 'num'], ['極大 ZHR', 'num'], ['現在の活動', 'num'], ['輻射点高度', 'num']],
    shRows.slice(0, 8).map(function (x) {
      return [x.sh[0], x.sh[1],
        Math.abs(x.days) < 0.6 ? '今夜' : (x.days > 0 ? AL.f(x.days, 0) + ' 日後' : AL.f(-x.days, 0) + ' 日前'),
        AL.int(x.sh[5]), x.zhr > 0.5 ? AL.f(x.zhr, 1) : '—',
        x.alt > 0 ? AL.f(x.alt, 0) + '°' : '地平線下'];
    }), { max: '240px' }));
  g.appendChild(p4);

  /* --- 雲量の見通し --- */
  var p5 = panel('雲量の見通し（7 日）', { col: 'c6', note: '模擬。実運用では気象庁 GPV を差し込む' });
  var b5 = p5.querySelector('.body');
  var cser = ids.map(function (id) {
    var st = AL.st(id), pts = [];
    for (var t = now; t < now + 7 * 86400e3; t += 3 * 3600e3) pts.push([t, AL.data.cloud(st, t) * 100]);
    return { name: st.name, color: st.hex, points: pts };
  });
  C.timeseries(b5, { t0: now, t1: now + 7 * 86400e3, height: 160, ymin: 0, ymax: 100, series: cser,
    snap: 3 * 3600e3, yfmt: function (v) { return AL.f(v, 0) + '%'; }, tipfmt: function (v) { return AL.f(v, 0) + ' %'; } });
  C.legend(b5, cser.map(function (s) { return { name: s.name, color: s.color }; }), { square: true });
  g.appendChild(p5);

  /* --- 観測実績のヒートマップ --- */
  var days = 21;
  var p6 = panel('検出数の推移（直近 ' + days + ' 夜 × 時刻）', { col: 'c12',
    note: ids.map(function (i) { return AL.st(i).name; }).join('・') + 'の合計' });
  var b6 = p6.querySelector('.body');
  var cols = [], grid = [], maxv = 1;
  for (var dd = days - 1; dd >= 0; dd--) {
    var nt = AL.nightOf(now - dd * 86400e3);
    cols.push(AL.md(nt));
    var colv = [];
    for (var hh2 = 0; hh2 < 14; hh2++) {
      var tt = nt + (6 + hh2) * 3600e3;
      var v = 0;
      ids.forEach(function (id) { v += AL.data.hourly(id, tt, tt + 3600e3)[0].n; });
      colv.push(v); maxv = Math.max(maxv, v);
    }
    grid.push(colv);
  }
  var rowsLab = []; for (var k = 0; k < 14; k++) rowsLab.push(((18 + k) % 24) + '時');
  C.heat(b6, { cols: cols, rows: rowsLab, max: maxv, height: 230, colEvery: 2,
    get: function (i, j) { return grid[i][j]; } });
  C.heatLegend(b6, maxv, '件/時');
  g.appendChild(p6);

  root.appendChild(g);
};

})(AL);
