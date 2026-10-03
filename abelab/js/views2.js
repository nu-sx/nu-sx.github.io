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
  var groups = AL.data.groups(t0, t1);
  var g = el('div', { class: 'grid' });
  var ALT = [80, 90, 100, 110, 120];
  var curAlt = AL.planAlt || 100;

  /* --- 概要 --- */
  var dts = groups.map(function (x) { return x.dt; }).sort(function (a, b) { return a - b; });
  var n3 = groups.filter(function (x) { return x.n >= 3; }).length;
  var totalN = AL.summary(AL.STL, t0, t1).total.n;
  var p0 = panel('同時観測の成立', { col: 'c3', note: ui.rangeLabel });
  var b0 = p0.querySelector('.body');
  AL.add(b0, AL.stat(AL.int(groups.length), '件', '2 局以上で捉えた流星'));
  AL.add(b0, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
    AL.stat(AL.int(n3), '件', '3 局そろった流星', { sm: true }),
    AL.stat(totalN ? AL.pct(groups.length * 2 / totalN) : '—', '', '全検出に占める割合', { sm: true }),
    AL.stat(dts.length ? AL.int(dts[dts.length >> 1]) : '—', 'ms', '時刻差の中央値', { sm: true }),
    AL.stat(AL.int(AL.commonVolume(AL.STL, curAlt).area), 'km²', '3 局共通の領域（' + curAlt + ' km）', { sm: true })
  ]));
  AL.add(b0, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '2 局で同じ流星を取れると視差から発光点・消滅点の高度と速度が決まり、軌道要素まで辿れる。' +
          '3 局そろえば幾何が過剰決定になり、誤差を評価できる。' }));
  g.appendChild(p0);

  /* --- 重なり面積と高度 --- */
  var p1 = panel('視野が重なる面積と高度', { col: 'c4', note: '流星の発光層 80–120 km を帯で示す' });
  var b1 = p1.querySelector('.body');
  var ovSeries = AL.PAIRS.map(function (pp, i) {
    var pts = [];
    for (var h = 60; h <= 140; h += 2) pts.push([h, AL.overlapAt(pp[0], pp[1], h).areaKm2]);
    return { name: AL.st(pp[0]).name + '×' + AL.st(pp[1]).name, color: [AL.st('FNB').hex, AL.st('KSO').hex, AL.st('AKN').hex][i], points: pts };
  });
  var triPts = [];
  for (var hh2 = 60; hh2 <= 140; hh2 += 2) triPts.push([hh2, AL.commonVolume(AL.STL, hh2).area]);
  ovSeries.push({ name: '3 局共通', color: '#a3a8b0', points: triPts });
  C.xy(b1, { series: ovSeries, xmin: 60, xmax: 140, height: 165, band: [80, 120], bandLabel: '発光層',
    xlabel: '高度 km', yfmt: function (v) { return v >= 1000 ? AL.f(v / 1000, 0) + 'k' : AL.f(v, 0); },
    xtip: function (v) { return AL.f(v, 0) + ' km'; }, tipfmt: function (v) { return AL.int(v) + ' km²'; } });
  C.legend(b1, ovSeries.map(function (s2) { return { name: s2.name, color: s2.color }; }));
  g.appendChild(p1);

  /* --- 時刻差 --- */
  var p2 = panel('同時イベントの時刻差', { col: 'c5', note: '同じ流星を記録した時刻のずれ（PC 時計）' });
  (function () {
    var bins = [], labels = [];
    for (var i = 0; i < 8; i++) { bins.push(0); labels.push((i * 25) + ''); }
    groups.forEach(function (x) { bins[Math.min(7, Math.floor(x.dt / 25))]++; });
    C.hist(p2.querySelector('.body'), {
      bins: labels, series: [{ name: '同時イベント', color: '#5598e7', bins: bins }],
      height: 165, xlabel: 'ms', labelEvery: 2,
      binTitle: function (i) { return (i * 25) + '–' + ((i + 1) * 25) + ' ms'; }
    });
    AL.add(p2.querySelector('.body'), el('div', { class: 'note', style: { marginTop: '4px' },
      text: '映像は 30 fps なので 1 フレーム = 33 ms。これより細かく合わせるには GPS 時刻の重畳が要る。' }));
  })();
  g.appendChild(p2);

  /* ================= 日本地図（向きと画角をマウスで変えられる）================= */
  var p3 = panel('視野の投影（日本地図）', { col: 'c8', right: [],
    note: '視野をドラッグで向きを変え、右端の ○ をドラッグで画角を変える。ホイールで東アジア〜太平洋まで引ける' });
  var p4 = panel('カメラの向きと画角', { col: 'c4', right: [] });
  var aimBody = p4.querySelector('.body');
  var mapBody = p3.querySelector('.body');
  var hint = el('div', { class: 'note', style: { marginTop: '6px' } });
  var aimHost = el('div');
  var pairHost = el('div', { style: { marginTop: '10px' } });
  var status = el('span', { class: 'note' });

  var M = AL.Map();
  mapBody.appendChild(M.node);
  M.node.appendChild(el('div', { class: 'maphint', text: 'ひまわり：気象庁' }));
  var sat = AL.satLayer(M);

  /* 操作：高度・気象衛星・向きの初期化 */
  var selAlt = el('select', { onchange: function () { curAlt = AL.planAlt = +selAlt.value; redrawAll(true); } },
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
    el('span', { class: 'ctl' }, ['気象衛星', selBand, opa]),
    el('button', { class: 'btn', text: '局に合わせる', title: '3 局の視野が収まる範囲に戻す',
      onclick: function () { M.goHome(); } })
  ]);
  AL.add(p4.querySelector('header .right'), [
    el('button', { class: 'btn', text: '既定に戻す', onclick: function () { AL.resetAim(); redrawAll(true); } })
  ]);
  /* --- カバー面積と最適化 --- */
  var covHost = el('div', { style: { marginTop: '10px' } });
  var optOut = el('div', { class: 'note', style: { marginTop: '6px' } });
  var selObj = el('select', null, [
    el('option', { value: 'atLeast2', text: '2 局以上でカバー' }),
    el('option', { value: 'triple', text: '3 局共通' }),
    el('option', { value: 'union', text: '1 局以上でカバー' })
  ]);
  /* 固定する局は複数選べる（木曽と船橋を固定して明野だけ動かす、といった使い方のため） */
  var fixState = { FNB: true, KSO: true, AKN: false };
  function fixChip(id) {
    var st = AL.st(id);
    return el('button', { class: 'chip', 'aria-pressed': String(!!fixState[id]), title: st.name + '局を固定する',
      onclick: function (e) {
        if (!fixState[id] && AL.STL.filter(function (x) { return !fixState[x]; }).length <= 1) return;  /* 全部は固定できない */
        fixState[id] = !fixState[id];
        e.currentTarget.setAttribute('aria-pressed', String(fixState[id]));
      } }, [el('span', { class: 'swatch', style: { background: st.hex } }), st.name]);
  }
  var inZa = el('input', { type: 'number', value: AL.USABLE.maxZa, min: 40, max: 85, step: 1,
    oninput: function () { AL.USABLE.maxZa = AL.clamp(+inZa.value || 70, 40, 85); redrawAll(); } });
  function runOpt() {
    var fix = AL.STL.filter(function (id) { return fixState[id]; });
    var free = AL.STL.filter(function (id) { return !fixState[id]; });
    if (!free.length) { optOut.textContent = '動かせる局がない。固定を 1 つ外すこと。'; return; }
    var before = AL.coverage(AL.STL.map(AL.st), curAlt)[selObj.value];
    var t0 = performance.now();
    /* 動かすのが 1 局だけなら総当たりで厳密に、2 局以上なら格子を粗くして反復で詰める */
    var fine = free.length === 1;
    var r = AL.optimizeAim({ fixed: fix, free: free, h: curAlt, objective: selObj.value,
      azStep: fine ? 1 : 3, elStep: fine ? 0.5 : 1.5, passes: fine ? 1 : 6 });
    free.forEach(function (id) { AL.setAim(AL.st(id), r.aims[id]); });
    redrawAll();
    optOut.innerHTML = '高度 ' + curAlt + ' km で ' + selObj.options[selObj.selectedIndex].text +
      ' を最大化した（' + Math.round(performance.now() - t0) + ' ms）。' +
      AL.int(before) + ' → <b>' + AL.int(r.value) + ' km²</b>　' +
      free.map(function (id) {
        return AL.st(id).name + ' 方位 ' + AL.f(r.aims[id].az, 0) + '°・仰角 ' + AL.f(r.aims[id].el, 1) + '°';
      }).join('／');
  }

  function clearG(x) { while (x.firstChild) x.removeChild(x.firstChild); }
  function toLL(ne, ref) { return AL.neToLatLon(ne, ref); }
  function polyEl(host, pts, attrs) {
    var d = pts.map(function (q) { var xy = AL.proj(q.lon, q.lat); return xy[0].toFixed(1) + ',' + xy[1].toFixed(1); }).join(' ');
    var e = AL.s('polygon', Object.assign({ points: d }, attrs || {}));
    host.appendChild(e);
    return e;
  }
  /* 局座標 [前方, 横] → 緯度経度 */
  function local(st, fwd, lat_) {
    var c = Math.cos(st.az * AL.d2r), sn = Math.sin(st.az * AL.d2r);
    return AL.neToLatLon([fwd * c - lat_ * sn, fwd * sn + lat_ * c], st);
  }

  /* --- マウスで向きを変える --- */
  function onDrag(node, move) {
    node.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      function mv(ev) { move(ev); }
      function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
      move(e);
    });
  }
  function aimTo(st, ev) {
    var ll = M.toLatLon(ev.clientX, ev.clientY);
    var dN = (ll.lat - st.lat) * 111.32;
    var dE = (ll.lon - st.lon) * 111.32 * Math.cos(st.lat * AL.d2r);
    var d = Math.hypot(dN, dE);
    AL.setAim(st, { az: Math.atan2(dE, dN) * AL.r2d, el: 90 - Math.atan2(d, curAlt) * AL.r2d });
    redrawAll();
  }
  function fovTo(st, ev) {
    var ll = M.toLatLon(ev.clientX, ev.clientY);
    var dN = (ll.lat - st.lat) * 111.32;
    var dE = (ll.lon - st.lon) * 111.32 * Math.cos(st.lat * AL.d2r);
    var c = Math.cos(st.az * AL.d2r), sn = Math.sin(st.az * AL.d2r);
    var lat_ = -dN * sn + dE * c;                       /* 光軸からの横方向の距離 */
    var slant = curAlt / Math.cos(AL.za(st) * AL.d2r);
    var hw = Math.atan2(Math.max(1, Math.abs(lat_)), slant);
    AL.setAim(st, { fl: AL.RIG.sw / 2 / Math.tan(hw) });
    redrawAll();
  }

  function drawMap(refit) {
    clearG(M.layers.fov); clearG(M.layers.ov); clearG(M.layers.st);
    var all = [];
    AL.STL.forEach(function (id) {
      var st = AL.st(id);
      /* 視野全体（天頂角 85° まで）は破線の輪郭だけ。大気減光で使えない低空が見える */
      var full = AL.footprintPoly(st, curAlt, null, 85).map(function (ne) { return toLL(ne, st); });
      if (AL.lowerEdgeEl(st) < 90 - AL.USABLE.maxZa - 0.5)
        polyEl(M.layers.fov, full, { fill: 'none', stroke: st.hex, 'stroke-opacity': .45,
          'stroke-dasharray': '4 4', class: 'fullfov' });
      var pts = AL.footprintPoly(st, curAlt).map(function (ne) { return toLL(ne, st); });
      var pe = polyEl(M.layers.fov, pts, { fill: st.hex, stroke: st.hex, 'data-st': id });
      pe.style.cursor = 'move';
      pe.appendChild(AL.s('title', { text: st.name + '局の視野（ドラッグで向きを変える）' }));
      onDrag(pe, function (ev) { aimTo(st, ev); });
      pe.addEventListener('dblclick', function (e2) {
        e2.stopPropagation(); AL.setAim(st, AL.aimDefaults[id]); redrawAll();
      });
      all = all.concat(pts, [{ lat: st.lat, lon: st.lon }]);
    });
    /* 2 局・3 局の重なり */
    var tri = AL.commonVolume(AL.STL, curAlt);
    AL.PAIRS.forEach(function (pp) {
      var o = AL.overlapAt(pp[0], pp[1], curAlt);
      if (o.poly.length > 2) polyEl(M.layers.ov, o.poly.map(function (ne) { return toLL(ne, o.ref); }),
        { class: 'ov2' });
    });
    if (tri.poly.length > 2) {
      var tp = tri.poly.map(function (ne) { return toLL(ne, tri.ref); });
      polyEl(M.layers.ov, tp, { class: 'ov3' });
      var cx = AL.sum(tp.map(function (q) { return q.lon; })) / tp.length;
      var cy = AL.sum(tp.map(function (q) { return q.lat; })) / tp.length;
      var c = AL.proj(cx, cy);
      M.layers.ov.appendChild(AL.s('text', { x: c[0], y: c[1], text: '3 局共通 ' + AL.int(tri.area) + ' km²' }));
    }
    /* 観測局と画角の取っ手 */
    AL.STL.forEach(function (id) {
      var st = AL.st(id), xy = AL.proj(st.lon, st.lat);
      M.layers.st.appendChild(AL.s('circle', { cx: xy[0], cy: xy[1], r: 4, fill: st.hex },
        [AL.s('title', { text: st.full })]));
      M.layers.st.appendChild(AL.s('text', { x: xy[0], y: xy[1], 'data-y': xy[1], text: st.name }));
      var v = AL.fov(st);
      var mid = curAlt * Math.tan(AL.za(st) * AL.d2r);
      var half = (curAlt / Math.cos(AL.za(st) * AL.d2r)) * Math.tan(v.w / 2 * AL.d2r);
      var hp = local(st, mid, half), hx = AL.proj(hp.lon, hp.lat);
      /* 取っ手は見える円と、掴みやすくするための透明な円の二重にする */
      var hg = AL.s('g', { class: 'handle' }, [
        AL.s('circle', { cx: hx[0], cy: hx[1], r: 6, fill: st.hex, stroke: '#e6e7ea', 'stroke-width': 2, class: 'hk' }),
        AL.s('circle', { cx: hx[0], cy: hx[1], r: 13, fill: 'transparent', class: 'hit' },
          [AL.s('title', { text: '横へドラッグすると画角（焦点距離）が変わる' })])
      ]);
      hg.style.cursor = 'ew-resize';
      onDrag(hg, function (ev) { fovTo(st, ev); });
      M.layers.st.appendChild(hg);
    });
    if (refit) M.fit(all, 0.08);
    marks();
  }
  function marks() {
    var k = 1 / Math.max(0.02, M.unit());              /* 画面 1 px ぶんの viewBox 単位 */
    Array.prototype.forEach.call(M.layers.st.querySelectorAll('circle'), function (c) {
      var cl = c.getAttribute('class');
      c.setAttribute('r', ((cl === 'hk' ? 6 : cl === 'hit' ? 14 : 4.5) * k).toFixed(2));
    });
    Array.prototype.forEach.call(M.layers.st.querySelectorAll('text'), function (t) {
      t.setAttribute('font-size', (11 * k).toFixed(2));
      t.setAttribute('y', (+t.getAttribute('data-y') + 13 * k).toFixed(1));
    });
    Array.prototype.forEach.call(M.layers.ov.querySelectorAll('text'), function (t) { t.setAttribute('font-size', (10 * k).toFixed(2)); });
    Array.prototype.forEach.call(M.svg.querySelectorAll('.m-grid .gt'), function (t) { t.setAttribute('font-size', (5.5 * k).toFixed(2)); });
  }
  M.onView = marks;

  /* --- 向きと画角の表（数値でも変えられる）--- */
  function drawAim() {
    AL.clear(aimHost);
    var rows = AL.STL.map(function (id) {
      var st = AL.st(id), v = AL.fov(st);
      function num(val, min, max, step, key, unit) {
        var inp = el('input', { type: 'number', value: AL.f(val, step < 1 ? 1 : 0), min: min, max: max, step: step,
          oninput: function () {
            var o = {}; o[key] = +inp.value;
            AL.setAim(st, o); redrawAll();
          } });
        return el('span', { class: 'numin' }, [inp, el('i', { text: unit })]);
      }
      return [
        el('span', null, [el('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px',
          background: st.hex, marginRight: '5px' } }), st.name]),
        num(st.az, 0, 360, 1, 'az', '°'),
        el('span', { class: 'note', text: AL.compass16(st.az) }),
        num(st.el, 5, 85, 1, 'el', '°'),
        num(v.fl, 8, 135, 1, 'fl', 'mm'),
        AL.f(v.w, 1) + '° × ' + AL.f(v.h, 1) + '°'
      ];
    });
    AL.add(aimHost, AL.table(['局', ['方位', 'num'], '', ['仰角', 'num'], ['焦点距離', 'num'], ['画角', 'num']], rows, { scroll: false }));
  }
  /* --- 組ごとの成立 --- */
  function drawPairs() {
    AL.clear(pairHost);
    var rows = AL.PAIRS.map(function (pp) {
      var o = AL.overlapAt(pp[0], pp[1], curAlt), hr = AL.overlapHeights(pp[0], pp[1]);
      return [AL.st(pp[0]).name + ' × ' + AL.st(pp[1]).name, AL.f(o.sep, 0) + ' km',
        o.overlap ? AL.state('good', '重なる', '●') : AL.state('idle', '重ならない', '○'),
        o.overlap ? AL.pct(o.frac) : '—',
        o.overlap ? AL.int(o.areaKm2) + ' km²' : '—'];
    });
    var tri = AL.commonVolume(AL.STL, curAlt);
    rows.push(['3 局共通', '—', tri.area > 1 ? AL.state('good', '成立', '●') : AL.state('idle', '不成立', '○'),
      '—', tri.area > 1 ? AL.int(tri.area) + ' km²' : '—']);
    AL.add(pairHost, AL.table(['組', ['基線長', 'num'], '高度 ' + curAlt + ' km', ['重なり', 'num'], ['面積', 'num']], rows, { scroll: false }));
  }

  function drawCov() {
    AL.clear(covHost);
    var c = AL.coverage(AL.STL.map(AL.st), curAlt);
    AL.add(covHost, AL.table(['カバー面積（高度 ' + curAlt + ' km）', ['面積', 'num'], ['用途', '']], [
      ['1 局以上', AL.int(c.union) + ' km²', '単独検出（軌道は出ない）'],
      ['2 局以上', AL.int(c.atLeast2) + ' km²', '同時観測。高度・速度・軌道が出る'],
      ['3 局共通', AL.int(c.triple) + ' km²', '幾何が過剰決定。誤差を評価できる']
    ], { scroll: false }));
  }
  function redrawAll(refit) {
    drawMap(refit);
    drawAim();
    drawCov();
    drawPairs();
    var tri = AL.commonVolume(AL.STL, curAlt);
    var ka = AL.overlapAt('KSO', 'AKN', curAlt);
    var v = AL.fov(AL.st('KSO'));
    hint.textContent = '高度 ' + curAlt + ' km：木曽 × 明野は ' +
      (ka.overlap ? AL.pct(ka.frac) + '（' + AL.int(ka.areaKm2) + ' km²）' : '重ならず') +
      '、3 局共通は ' + (tri.area > 1 ? AL.int(tri.area) + ' km²' : 'なし') + '。' +
      '視野の下辺は仰角 ' + AL.f(AL.st('KSO').el - v.h / 2, 0) + '° で、そこでは大気減光が効き限界等級は浅くなる。';
  }

  AL.add(mapBody, [hint, el('div', { class: 'note', style: { marginTop: '2px' } }, [
    '気象衛星はひまわりの実データ（気象庁）。選んだときだけ取得する。', status
  ])]);
  C.legend(mapBody, AL.STL.map(function (id) { return { name: AL.st(id).name + 'の視野', color: AL.st(id).hex }; })
    .concat([{ name: '2 局の重なり', color: 'rgba(255,255,255,.28)' },
              { name: '3 局共通', color: 'rgba(250,178,25,.55)' }]), { square: true });
  AL.add(aimBody, [aimHost, covHost,
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '8px' } }, [
      el('span', { class: 'ctl' }, [selObj]),
      el('span', { class: 'ctl' }, ['固定'].concat(AL.STL.map(fixChip))),
      el('span', { class: 'ctl numin' }, ['有効範囲 天頂角', inZa, el('i', { text: '°' })]),
      el('button', { class: 'btn', text: '最適化', onclick: runOpt })
    ]), optOut, pairHost, el('div', { class: 'note', style: { marginTop: '8px' },
    text: '既定は 35 mm フルサイズに 24 mm レンズ（画角 73.7° × 53.1°）。' +
          '木曽（方位 50°・仰角 38°）と船橋（方位 0°・仰角 47°）を固定し、明野は「2 局以上で' +
          'カバーされる面積」が最大になる向き（方位 25°・仰角 46.5°）を総当たりで求めて既定にした。' +
          '塗りは有効範囲（天頂角 ' + AL.USABLE.maxZa + '° まで）、破線は視野全体。' +
          '地図の視野をドラッグで向き、右端の ○ を横へドラッグで画角が変わる。ダブルクリックで既定に戻る。' })]);
  g.appendChild(p3); g.appendChild(p4);
  redrawAll(true);
  setTimeout(function () { redrawAll(true); }, 0);

  /* --- 同時イベント一覧 --- */
  var p5 = panel('同時観測イベント', { col: 'c12', note: AL.int(groups.length) + ' 件' });
  AL.add(p5.querySelector('.body'), groups.length ? AL.table(
    ['時刻', ['局数', 'num'], '局', ['等級', 'num'], ['時刻差', 'num'], ['角速度', 'num'], '群', '識別子'],
    groups.slice(0, 200).map(function (x) {
      return [AL.stamp(x.t, { sec: true }), x.n,
        el('span', null, x.ev.map(function (e) {
          return el('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px',
            background: AL.st(e.st).hex, marginRight: '4px' }, title: AL.st(e.st).name });
        }).concat([el('span', { text: x.sts.map(function (i) { return AL.st(i).name; }).join('・') })])),
        x.ev.map(function (e) { return AL.mag(e.mag); }).join(' / '),
        AL.int(x.dt) + ' ms',
        x.ev.map(function (e) { return AL.f(e.vang, 1); }).join(' / ') + ' °/s',
        x.ev[0].shower || '散在',
        el('span', { style: { fontFamily: 'var(--mono)', color: 'var(--text-3)' }, text: x.id })];
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
