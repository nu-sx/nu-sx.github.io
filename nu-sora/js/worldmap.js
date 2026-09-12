/* NU-SORA デモ / 地球図（正距円筒図法）と、再突入体の軌道フィッティング
   観測から得られるのは「いつ・どこを・どの向きに・どれだけの速さで」通ったかである。
   そこから軌道傾斜角を逆算し、公開カタログの候補と突き合わせてどの物体かを絞り込む。 */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, D2R = Math.PI / 180, R2D = 180 / Math.PI;

NS.RE_KM = 6378.137;                     /* 地球赤道半径 km */
NS.MU_E  = 398600.4418;                  /* 地心重力定数 km³/s² */
NS.OMEGA_E = 7.2921159e-5;               /* 地球の自転角速度 rad/s */

/* 円軌道の周期（秒） */
NS.orbPeriod = function (altKm) {
  var a = NS.RE_KM + altKm;
  return 2 * Math.PI * Math.sqrt(a * a * a / NS.MU_E);
};
/* 円軌道の速度（km/s） */
NS.orbSpeed = function (altKm) { return Math.sqrt(NS.MU_E / (NS.RE_KM + altKm)); };

/* 緯度 φ を通るときの地上軌跡の方位。軌道傾斜角 i から 2 つ（上昇・下降）出る。
   球面三角法：cos i = sin β · cos φ 。|cos i| > cos φ なら その緯度には届かない。 */
NS.trackHeadings = function (iDeg, latDeg) {
  var ci = Math.cos(iDeg * D2R), cf = Math.cos(latDeg * D2R);
  if (Math.abs(ci) > cf) return null;              /* この緯度には到達できない */
  var b = Math.asin(ci / cf) * R2D;                /* 上昇パス（北向き成分） */
  return [ (b + 360) % 360, (180 - b + 360) % 360 ];
};
/* 観測した方位と緯度から軌道傾斜角を逆算する */
NS.incFromHeading = function (azDeg, latDeg) {
  var v = Math.sin(azDeg * D2R) * Math.cos(latDeg * D2R);
  return Math.acos(Math.max(-1, Math.min(1, v))) * R2D;
};

/* 地上軌跡。u0 は基準時刻での緯度引数、lon0 はそのときの経度。 */
NS.groundTrack = function (o) {
  var per = NS.orbPeriod(o.alt), i = o.inc * D2R;
  var out = [], n = o.n || 720, span = o.span || per * 1.05;
  for (var k = 0; k <= n; k++) {
    var dt = -span / 2 + span * k / n;
    var u = o.u0 + 2 * Math.PI * dt / per;
    var lat = Math.asin(Math.sin(i) * Math.sin(u)) * R2D;
    var dlon = Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u))
             - Math.atan2(Math.cos(i) * Math.sin(o.u0), Math.cos(o.u0));
    var lon = o.lon0 + dlon * R2D - NS.OMEGA_E * dt * R2D;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    out.push({ dt:dt, lat:lat, lon:lon });
  }
  return out;
};
/* 観測した点・時刻・方位を通る軌跡を作る（u0 を緯度から決める） */
NS.trackThrough = function (inc, alt, lat, lon, az, span) {
  var i = inc * D2R;
  var su = Math.sin(lat * D2R) / Math.sin(i);
  su = Math.max(-1, Math.min(1, su));
  var u0 = Math.asin(su);
  /* 方位が北向き成分を持たない（下降パス）なら u を補角にする */
  var h = NS.trackHeadings(inc, lat);
  if (h && Math.abs(((az - h[1] + 540) % 360) - 180) < Math.abs(((az - h[0] + 540) % 360) - 180)) u0 = Math.PI - u0;
  return NS.groundTrack({ inc:inc, alt:alt, u0:u0, lon0:lon, span:span || NS.orbPeriod(alt) * 0.62 });
};

/* =========================================================================
   正距円筒図法（equirectangular）の世界図
   経度・緯度をそのまま x・y に取る。面積は高緯度ほど引き伸ばされるが、
   緯度が線形に読めるので、地上軌跡の傾きから軌道傾斜角を見るのに向く。
   ========================================================================= */
var MW = 1080, MH = 540;                 /* 360° × 180°（2:1） */
function mx(lon) { return (lon + 180) / 360 * MW; }
function my(lat) { return (90 - lat) / 180 * MH; }
NS.worldXY = function (lon, lat) { return [mx(lon), my(lat)]; };
NS.mercXY = NS.worldXY;                  /* 旧名 */

/* 詰めた座標列をほどく（js/geo-world50.js）。可変長の差分符号。 */
var w50 = null;
function unpack50() {
  if (w50) return w50;
  var G = window.GEO_W50;
  if (!G) return (w50 = { land:[], bord:[] });
  function take(str) {
    var i = 0, out = [];
    function num() {
      var r = 0, sh = 0, c;
      do { c = str.charCodeAt(i++) - 63; r |= (c & 0x1f) << sh; sh += 5; } while (c >= 0x20);
      return (r & 1) ? ~(r >> 1) : (r >> 1);
    }
    while (i < str.length) {
      var n = num(), line = [], px = 0, py = 0;
      for (var k = 0; k < n; k++) {
        px += num(); py += num();
        line.push([px * G.q, py * G.q]);
      }
      out.push(line);
    }
    return out;
  }
  w50 = { land:take(G.l), bord:take(G.b) };
  return w50;
}

/* 経度が日付変更線をまたぐ折れ線を、連続な経度に開く */
function unwrap(line) {
  var lon = [], lat = [], acc = 0, prev = line[0][0];
  for (var i = 0; i < line.length; i++) {
    var v = line[i][0];
    if (i > 0) {
      var d0 = v - prev;
      if (d0 > 180) acc -= 360; else if (d0 < -180) acc += 360;
    }
    lon.push(v + acc); lat.push(line[i][1]); prev = v;
  }
  return { lon:lon, lat:lat };
}
function pathOf(lon, lat, sh, close) {
  var d = '';
  for (var j = 0; j < lon.length; j++) {
    d += (j ? 'L' : 'M') + mx(lon[j] + sh).toFixed(1) + ' ' + my(lat[j]).toFixed(1);
  }
  return close ? d + 'Z' : d;
}

var mapSeq = 0;

NS.WorldMap = function (opts) {
  opts = opts || {};
  var svg = s('svg', { viewBox:'0 0 ' + MW + ' ' + MH, class:'wmap',
                       preserveAspectRatio:'xMidYMid meet' });
  var uid = 'wm' + (++mapSeq);
  /* 日付変更線をまたぐ陸地は ±360° ずらした写しも描くので、図の外にはみ出す。
     世界の枠で切り取っておかないと、右の複製（use）を通して本体に重なってしまう。 */
  var clip = s('clipPath', { id:uid + 'c' }, s('rect', { x:0, y:0, width:MW, height:MH }));
  var world = s('g', { id:uid, 'clip-path':'url(#' + uid + 'c)' });
  var gGrid = s('g', { class:'w-grid' }), gLand = s('g', { class:'w-land' });
  var gBord = s('g', { class:'w-bord' }), gOv = s('g', { class:'w-ov' });
  NS.add(world, [s('rect', { x:0, y:0, width:MW, height:MH, class:'w-sea' }), gGrid, gLand, gBord, gOv]);
  /* 東西に切れ目なくたどれるよう、同じ内容を 1 周ぶん右に複製する。
     use は元をそのまま映すので、あとから足した軌跡も一緒に出る。 */
  var copy = s('use', { transform:'translate(' + MW + ' 0)' });
  copy.setAttribute('href', '#' + uid);
  copy.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + uid);
  NS.add(svg, [s('defs', {}, clip), world, copy]);

  /* 経緯線 */
  var gridTxt = [];
  for (var la = -60; la <= 60; la += 30) {
    NS.add(gGrid, s('line', { x1:0, x2:MW, y1:my(la), y2:my(la), class:'gl' }));
    var tla = s('text', { x:4, y:my(la) - 3, class:'gt', text:(la > 0 ? '+' : '') + la + '°' });
    NS.add(gGrid, tla); gridTxt.push({ el:tla, fs:9 });
  }
  for (var lo = -150; lo <= 150; lo += 30) {
    NS.add(gGrid, s('line', { x1:mx(lo), x2:mx(lo), y1:0, y2:MH, class:'gl' }));
    var tlo = s('text', { x:mx(lo) + 3, y:MH - 5, class:'gt', text:lo + '°' });
    NS.add(gGrid, tlo); gridTxt.push({ el:tlo, fs:9 });
  }
  NS.add(gGrid, s('line', { x1:0, x2:MW, y1:my(0), y2:my(0), class:'gl eq' }));

  /* 陸地と国境。日付変更線をまたぐ環は経度を開いてから描き、
     はみ出したぶんを ±360° ずらしてもう一度描く。 */
  var W = unpack50();
  function drawLines(list, parent, cls, close) {
    list.forEach(function (line) {
      var u = unwrap(line);
      var lo2 = Math.min.apply(null, u.lon), hi2 = Math.max.apply(null, u.lon);
      var shifts = [0];
      if (hi2 > 180) shifts.push(-360);
      if (lo2 < -180) shifts.push(360);
      shifts.forEach(function (sh) {
        NS.add(parent, s('path', { d:pathOf(u.lon, u.lat, sh, close), class:cls }));
      });
    });
  }
  drawLines(W.land, gLand, 'w-l', true);
  drawLines(W.bord, gBord, 'w-b', false);

  var M = { node:el('div', { class:'wmapwrap' }, svg), svg:svg, ov:gOv, W:MW, H:MH };

  /* --- 視野（東西の移動と拡大縮小） ---------------------------------- */
  /* 拡大しても印と字の大きさは画面上で一定に保つ。
     scal は「画面上の大きさを保つもの」、deta は「ある倍率から出すもの」。 */
  var V = { x:0, y:0, w:MW, z:1 }, scal = [], deta = [];
  function fit(o, z) {
    if (o.r != null) o.el.setAttribute('r', (o.r / z).toFixed(2));
    if (o.fs != null) o.el.style.fontSize = (o.fs / z).toFixed(2) + 'px';
    if (o.dx != null) o.el.setAttribute('x', (o.x0 + o.dx / z).toFixed(2));
    if (o.dy != null) o.el.setAttribute('y', (o.y0 + o.dy / z).toFixed(2));
  }
  function apply() {
    var h = V.w * MH / MW;
    V.x = ((V.x % MW) + MW) % MW;                    /* 東西は巻き戻して連続に */
    V.y = Math.max(0, Math.min(MH - h, V.y));
    svg.setAttribute('viewBox', V.x.toFixed(2) + ' ' + V.y.toFixed(2) + ' ' + V.w.toFixed(2) + ' ' + h.toFixed(2));
    var z = MW / V.w;
    if (z !== V.z) {
      V.z = z;
      scal.forEach(function (o) { fit(o, z); });
      gridTxt.forEach(function (o) { fit(o, z); });
      /* 名前は重なったら落とす（近い局どうしは、さらに寄れば出てくる） */
      var kept = [];
      deta.forEach(function (o) {
        var vis = z >= o.min;
        if (vis && o.dc) {
          for (var i = 0; i < kept.length; i++) {
            if (Math.abs(kept[i][0] - o.x) * z < 42 && Math.abs(kept[i][1] - o.y) * z < 10) { vis = false; break; }
          }
          if (vis) kept.push([o.x, o.y]);
        }
        o.el.style.display = vis ? '' : 'none';
      });
    }
  }
  M.view = V;
  M.reset = function () { V.x = 0; V.y = 0; V.w = MW; apply(); };
  /* 経度 lon を中心に、倍率 z で寄る */
  M.focus = function (lon, lat, z) {
    V.w = MW / Math.max(1, Math.min(24, z));
    var h = V.w * MH / MW;
    V.x = mx(lon) - V.w / 2; V.y = my(lat) - h / 2;
    apply();
  };

  var drag = null;
  function userPos(ev) {
    var r = svg.getBoundingClientRect();
    var h = V.w * MH / MW;
    return [V.x + (ev.clientX - r.left) / r.width * V.w, V.y + (ev.clientY - r.top) / r.height * h];
  }
  svg.style.cursor = 'grab';
  svg.style.touchAction = 'none';
  svg.addEventListener('pointerdown', function (ev) {
    drag = { x:ev.clientX, y:ev.clientY, vx:V.x, vy:V.y, r:svg.getBoundingClientRect() };
    svg.setPointerCapture(ev.pointerId); svg.style.cursor = 'grabbing';
  });
  svg.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var h = V.w * MH / MW;
    V.x = drag.vx - (ev.clientX - drag.x) / drag.r.width * V.w;
    V.y = drag.vy - (ev.clientY - drag.y) / drag.r.height * h;
    apply();
  });
  function endDrag() { drag = null; svg.style.cursor = 'grab'; }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', function () { M.reset(); });
  svg.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = userPos(ev), h0 = V.w * MH / MW;
    var z = Math.max(1, Math.min(24, (MW / V.w) * Math.exp(-ev.deltaY * 0.0016)));
    var w1 = MW / z, h1 = w1 * MH / MW;
    V.x = p[0] - (p[0] - V.x) * (w1 / V.w);
    V.y = p[1] - (p[1] - V.y) * (h1 / h0);
    V.w = w1;
    apply();
  }, { passive:false });

  /* --- 重ね描き ------------------------------------------------------ */
  M.clear = function () { NS.clear(gOv); scal = []; deta = []; };
  M.pt = function (lon, lat) { return NS.worldXY(lon, lat); };
  /* 日付変更線をまたぐところで折れ線を切る */
  M.track = function (pts, attrs) {
    var segs = [[]], prev = null;
    pts.forEach(function (p) {
      if (prev !== null && Math.abs(p.lon - prev) > 180) segs.push([]);
      segs[segs.length - 1].push(p); prev = p.lon;
    });
    var out = [];
    segs.forEach(function (seg) {
      if (seg.length < 2) return;
      var d = seg.map(function (p, i) {
        var q = NS.worldXY(p.lon, p.lat);
        return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
      }).join('');
      out.push(NS.add(gOv, s('path', Object.assign({ d:d, fill:'none', 'vector-effect':'non-scaling-stroke' }, attrs))));
    });
    return out;
  };
  M.mark = function (lon, lat, attrs) {
    var q = NS.worldXY(lon, lat);
    var r0 = (attrs && attrs.r) || 4;
    /* NS.add は親を返すので、要素を作ってから入れる */
    var c = s('circle', Object.assign({}, attrs, { cx:q[0], cy:q[1], r:r0 / V.z,
      'vector-effect':'non-scaling-stroke' }));
    NS.add(gOv, c);
    scal.push({ el:c, r:r0 });
    return c;
  };
  M.label = function (lon, lat, text, attrs) {
    var q = NS.worldXY(lon, lat);
    var t = s('text', Object.assign({ x:q[0] + 7 / V.z, y:q[1] + 3.5, class:'w-lbl', text:text }, attrs));
    t.style.fontSize = (11 / V.z).toFixed(2) + 'px';
    NS.add(gOv, t);
    scal.push({ el:t, fs:11, dx:7, x0:q[0] });
    return t;
  };

  /* 地表の円（中心から km 単位の半径。大円に沿って点を取る） */
  function circlePts(lon, lat, km, n) {
    var out = [], d = km / 6371.0, b = lat * D2R, l = lon * D2R;
    for (var i = 0; i <= n; i++) {
      var az = i / n * 2 * Math.PI;
      var sb = Math.sin(b) * Math.cos(d) + Math.cos(b) * Math.sin(d) * Math.cos(az);
      var b2 = Math.asin(Math.max(-1, Math.min(1, sb)));
      var l2 = l + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(b), Math.cos(d) - Math.sin(b) * sb);
      out.push([l2 / D2R, b2 / D2R]);
    }
    return out;
  }

  /* 観測局。倍率に応じて見せる情報を増やす：
     点 → （1.8 倍）名前 → （3.5 倍）視野円（高度 100 km を仰角 30° 以上で見込める範囲）。 */
  M.station = function (lon, lat, name, opts) {
    opts = opts || {};
    var q = NS.worldXY(lon, lat), col = opts.color || 'var(--c-s)';
    var g = s('g', { class:'w-st' });
    if (opts.fov) {
      var pts = circlePts(lon, lat, opts.fov, 64), d = '';
      for (var i = 0; i < pts.length; i++) {
        var p = NS.worldXY(pts[i][0], pts[i][1]);
        d += (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
      }
      var fov = s('path', { d:d + 'Z', fill:col, 'fill-opacity':0.05, stroke:col,
        'stroke-opacity':0.5, 'stroke-dasharray':'3 3', 'vector-effect':'non-scaling-stroke' });
      fov.style.display = 'none';
      NS.add(g, fov);
      deta.push({ el:fov, min:3.5 });
    }
    var ring = s('circle', { cx:q[0], cy:q[1], r:3.2 / V.z, fill:'none', stroke:col,
      'stroke-opacity':0.95, 'vector-effect':'non-scaling-stroke' });
    var core = s('circle', { cx:q[0], cy:q[1], r:1.1 / V.z, fill:col });
    NS.add(g, [ring, core]);
    scal.push({ el:ring, r:3.2 }); scal.push({ el:core, r:1.1 });
    if (name) {
      var t = s('text', { x:q[0] + 5 / V.z, y:q[1] - 4 / V.z, class:'w-lbl', text:name, fill:col });
      t.style.fontSize = (9 / V.z).toFixed(2) + 'px';
      t.style.display = 'none';
      NS.add(g, t);
      scal.push({ el:t, fs:9, dx:5, x0:q[0], dy:-4, y0:q[1] });
      deta.push({ el:t, min:1.8, dc:true, x:q[0], y:q[1] });
    }
    NS.add(gOv, g);
    return g;
  };
  apply();
  return M;
};
NS.WorldMercator = NS.WorldMap;            /* 旧名 */

/* =========================================================================
   軌道フィッティング
   ========================================================================= */
/* 観測量（時刻・位置・方位・速度）と候補カタログを突き合わせ、残差で順位づけする。
   決め手は方位で、緯度 φ を方位 β で横切れる軌道傾斜角は cos i = sin β cos φ に限られる。 */
NS.fitDebris = function (e, cands) {
  var lat = e.begin.lat, lon = e.begin.lon;
  var incObs = NS.incFromHeading(e.azimuth, lat);
  return cands.map(function (c) {
    var h = NS.trackHeadings(c.inc, lat);
    var dAz = h === null ? 999 : Math.min(
      Math.abs(((e.azimuth - h[0] + 540) % 360) - 180),
      Math.abs(((e.azimuth - h[1] + 540) % 360) - 180));
    var dInc = Math.abs(c.inc - incObs);
    var dT = (c.t - e.t) / 60000;                       /* 分 */
    var dV = Math.abs(NS.orbSpeed(c.alt) - e.vInf);
    /* 重み：方位 3°、時刻 20 分、速度 0.15 km/s を 1σ とする */
    var chi2 = Math.pow(dAz / 3, 2) + Math.pow(dT / 20, 2) + Math.pow(dV / 0.15, 2);
    return { c:c, dAz:dAz, dInc:dInc, dT:dT, dV:dV, chi2:chi2, reach:h !== null };
  }).sort(function (a, b) { return a.chi2 - b.chi2; });
};

NS.debrisTrackPanel = function (e, go) {
  var kpi = NS.kpi, panel = NS.panel, badge = NS.badge, f = NS.f;
  var lat = e.begin.lat, lon = e.begin.lon;
  var incObs = NS.incFromHeading(e.azimuth, lat);
  var altObs = 78.4;                                   /* 発光開始高度。軌道高度の下限にあたる */
  var cands = NS.DEBRIS_CANDIDATES;
  var fit = NS.fitDebris(e, cands);
  var best = fit[0];

  var M = NS.WorldMap();
  var COL = ['var(--accent)', 'var(--c-info)', 'var(--c-ok)', 'var(--c-warn)', 'var(--c-sky)'];

  /* 候補の地上軌跡（当てはまりの悪いものほど薄く） */
  fit.slice().reverse().forEach(function (r, k) {
    var rank = fit.length - 1 - k;
    if (!r.reach) return;
    var tr = NS.trackThrough(r.c.inc, r.c.alt, lat, lon, e.azimuth, NS.orbPeriod(r.c.alt) * 1.0);
    M.track(tr, { stroke:rank === 0 ? 'var(--accent)' : 'var(--muted)',
      'stroke-width':rank === 0 ? 2.2 : 1, 'stroke-dasharray':rank === 0 ? null : '4 4',
      opacity:rank === 0 ? 1 : 0.32 });
  });
  /* 観測点・観測局 */
  var fovKm = NS.groundRadius ? NS.groundRadius(100, 30) : 173;
  NS.STATIONS.forEach(function (st) {
    M.station(st.lon, st.lat, st.name, { fov:fovKm });
  });
  M.track([e.begin, e.end], { stroke:'var(--c-crit)', 'stroke-width':3.4 });
  M.mark(lon, lat, { r:5, fill:'none', stroke:'var(--c-crit)', 'stroke-width':2 });
  M.label(lon, lat, '発光開始', { fill:'var(--c-crit)' });

  var trBest = NS.trackThrough(best.c.inc, best.c.alt, lat, lon, e.azimuth, NS.orbPeriod(best.c.alt));
  var per = NS.orbPeriod(best.c.alt);

  return [
    panel('地球上の推定軌道（正距円筒図法）', {
      note:'赤の太線が観測した発光区間、赤の細線が最も当てはまる候補の地上軌跡。灰の破線は他の候補。青点は観測局。'
         + 'ドラッグで東西・南北に動かし、ホイールで拡大縮小できる（ダブルクリックで全体に戻る）',
      tools:badge('軌道傾斜角 ' + f(incObs, 1) + '° と推定', 'info') }, [
      M.node,
      NS.chart.legend([['観測した発光区間', 'var(--c-crit)', 'line'], ['最良候補の地上軌跡', 'var(--accent)', 'line'],
                       ['他の候補', 'var(--muted)', 'dash'], ['観測局', 'var(--c-s)', 'dot']]),
      el('div', { class:'grid g4', style:{ marginTop:'10px' } }, [
        kpi('推定 軌道傾斜角', f(incObs, 1), '°', '観測した方位 ' + f(e.azimuth, 1) + '° と緯度 ' + f(lat, 2) + '° から', { acc:true }),
        kpi('推定 軌道周期', f(per / 60, 1), '分', '高度 ' + best.c.alt + ' km の円軌道として'),
        kpi('推定 軌道速度', f(NS.orbSpeed(best.c.alt), 2), 'km/s', '観測値 ' + f(e.vInf, 2) + ' km/s との差 ' + f(best.dV, 2)),
        kpi('1 周で西へずれる量', f(per * NS.OMEGA_E * 180 / Math.PI, 1), '°', '地球の自転による。軌跡が周回ごとに西へ移る')
      ]),
      el('div', { class:'note', html:'地上軌跡の向きと緯度だけで軌道傾斜角が決まる。球面三角法から '
        + '<b>cos i = sin β · cos φ</b>（β＝方位、φ＝緯度）で、観測した β = ' + f(e.azimuth, 1) + '°・φ = ' + f(lat, 2) + '° を入れると '
        + '<b>i = ' + f(incObs, 1) + '°</b> となる。90° を超えるので<b>逆行軌道</b>である。'
        + 'この 1 点だけで、順行軌道の候補はすべて除外できる。' })
    ]),
    panel('推定されるデブリ（衛星）とのフィッティング', {
      note:'公開カタログの候補と、観測量（方位・時刻・速度）の残差を比べる。χ² が小さいほど当てはまりが良い',
      tools:badge('最良候補：' + best.c.name, 'ok') },
      [NS.table(['順位', '候補', 'NORAD / COSPAR', '軌道傾斜角', '到達可否', 'Δ方位', 'Δ時刻', 'Δ速度', 'χ²', '判定'],
        fit.map(function (r, i2) {
          return { attrs:{ class:i2 === 0 ? 'on' : '' }, cells:[
            { class:'r mono', html:String(i2 + 1) },
            el('b', { text:r.c.name }),
            { class:'mono sm', html:r.c.norad + '<br>' + r.c.cospar },
            { class:'r mono', html:f(r.c.inc, 1) + '°' },
            r.reach ? badge('可', 'ok') : badge('この緯度に届かない', 'warn'),
            { class:'r mono', html:r.reach ? f(r.dAz, 1) + '°' : '—' },
            { class:'r mono', html:(r.dT >= 0 ? '+' : '') + f(r.dT, 1) + ' 分' },
            { class:'r mono', html:f(r.dV, 2) + ' km/s' },
            { class:'r mono', html:r.reach ? f(r.chi2, 1) : '—' },
            i2 === 0 ? badge('同定', 'crit') : '<span class="hint">除外</span>'
          ] };
        })),
      NS.kv([
        ['同定した物体', '<b>' + best.c.name + '</b>（' + best.c.norad + ' / ' + best.c.cospar + '・' + best.c.type + '）'],
        ['質量', best.c.mass + ' kg'],
        ['決め手', '方位から求めた軌道傾斜角が ' + f(incObs, 1) + '° の逆行軌道で、順行の候補（43 – 98°）はいずれもこの向きに横切れない'],
        ['時刻の一致', '再突入予報との差 ' + f(Math.abs(best.dT), 1) + ' 分（予報窓 ± ' + e.predict.windowMin + ' 分の内側）'],
        ['速度の一致', '円軌道速度 ' + f(NS.orbSpeed(best.c.alt), 2) + ' km/s に対し観測 ' + f(e.vInf, 2) + ' km/s（差 ' + f(best.dV, 2) + '）'],
        ['残差の重み', '方位 3°・時刻 20 分・速度 0.15 km/s を 1σ として χ² を計算した']
      ], 'wide'),
      el('div', { class:'note', text:'この手順は、光学観測だけで軌道要素の一部を独立に決められることを示している。'
        + '公開カタログに載っていない物体でも、方位と緯度から軌道傾斜角が、周回ごとの西へのずれから周期が出るので、'
        + '「カタログのどれでもない」という結論自体を根拠つきで出せる。結果は JAXA 宇宙状況把握（SSA）へ共有する。' }),
      el('div', { class:'src', text:'海岸線と国境線は Natural Earth 50m（public domain）。国境線は 2 か国以上が共有する境界だけを取り出している。軌道は円軌道近似で、'
        + '球面三角法（cos i = sin β cos φ）と地球の自転（15.04°/時）から地上軌跡を求めている。'
        + '候補カタログはデモ用の仮想の物体で、実在の衛星ではない。' })]
    )
  ];
};

})(NS);
