/* NU-SORA デモ / 太陽系の 3D 描画
   火球の突入前軌道を、惑星の軌道と同じ黄道座標系に置いて描く。
   マウスの左ドラッグで視点を回し、ホイールで拡大縮小する。
   惑星の位置は JPL「Keplerian Elements for Approximate Positions of the Major Planets」
   （1800–2050 年に有効な近似要素）で求めている。 */
'use strict';
(function (NS) {
var el = NS.el, D2R = Math.PI / 180;

/* [a, e, I, L, ϖ, Ω] と 100 年あたりの変化率。a は au、角度は度。 */
NS.PLANETS = [
  { n:'水星', en:'Mercury', c:'#9AA3AE', r:2.4,
    e0:[0.38709927, 0.20563593,  7.00497902, 252.25032350,  77.45779628,  48.33076593],
    ed:[0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { n:'金星', en:'Venus', c:'#D9B26B', r:3.2,
    e0:[0.72333566, 0.00677672,  3.39467605, 181.97909950, 131.60246718,  76.67984255],
    ed:[0.00000390,-0.00004107, -0.00078890,  58517.81538729, 0.00268329, -0.27769418] },
  { n:'地球', en:'Earth', c:'#4585CC', r:3.4,
    e0:[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193,   0.0],
    ed:[0.00000562,-0.00004392, -0.01294668,  35999.37244981, 0.32327364,  0.0] },
  { n:'火星', en:'Mars', c:'#C0563C', r:2.8,
    e0:[1.52371034, 0.09339410,  1.84969142,  -4.55343205, -23.94362959,  49.55953891],
    ed:[0.00001847, 0.00007882, -0.00813131,  19140.30268499, 0.44441088, -0.29257343] },
  { n:'木星', en:'Jupiter', c:'#C9A227', r:6.0,
    e0:[5.20288700, 0.04838624,  1.30439695,  34.39644051,  14.72847983, 100.47390909],
    ed:[-0.00011607,-0.00013253,-0.00183714,   3034.74612775, 0.21252668,  0.20469106] },
  { n:'土星', en:'Saturn', c:'#B9A16B', r:5.2,
    e0:[9.53667594, 0.05386179,  2.48599187,  49.95424423,  92.59887831, 113.66242448],
    ed:[-0.00125060,-0.00050991, 0.00193609,   1222.49362201,-0.41897216, -0.28867794] }
];

/* J2000.0 からのユリウス世紀 */
NS.julianCentury = function (t) { return (t / 86400e3 + 2440587.5 - 2451545.0) / 36525; };

/* ケプラー方程式 M = E − e sin E を解く（ニュートン法） */
NS.kepler = function (M, e) {
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  var E = M + e * Math.sin(M);
  for (var i = 0; i < 24; i++) {
    var d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
};

/* 軌道要素 → 黄道直交座標（au）。ν は真近点角。 */
NS.orbXYZ = function (a, e, iDeg, wDeg, nodeDeg, nu) {
  var p = a * (1 - e * e), r = p / (1 + e * Math.cos(nu));
  var u = wDeg * D2R + nu, i = iDeg * D2R, O = nodeDeg * D2R;
  var cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(i), si = Math.sin(i);
  return [ r * (Math.cos(O) * cu - Math.sin(O) * su * ci),
           r * (Math.sin(O) * cu + Math.cos(O) * su * ci),
           r * (su * si) ];
};

/* ある時刻の惑星の位置 */
NS.planetAt = function (pl, t) {
  var T = NS.julianCentury(t), E = pl.e0, R = pl.ed;
  var a = E[0] + R[0] * T, e = E[1] + R[1] * T, I = E[2] + R[2] * T;
  var L = E[3] + R[3] * T, wbar = E[4] + R[4] * T, O = E[5] + R[5] * T;
  var w = wbar - O, M = (L - wbar) * D2R;
  var Ecc = NS.kepler(M, e);
  var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(Ecc / 2), Math.sqrt(1 - e) * Math.cos(Ecc / 2));
  return { xyz:NS.orbXYZ(a, e, I, w, O, nu), a:a, e:e, i:I, w:w, node:O, nu:nu };
};

/* 単位換算と定数 */
NS.AU_KMS = 1731.456836;                 /* 1 au/日 ＝ 1731.46 km/s */
NS.GM_SUN = 2.959122082855911e-4;        /* au³/日² */
NS.GM_EARTH = 398600.4418;               /* km³/s² */
NS.OBLIQ = 23.43929111;                  /* 黄道傾斜角（J2000） */

/* 地球の位置（au）と速度（au/日）。速度は中心差分で求める。 */
NS.earthState = function (t) {
  var h = 0.05 * 86400e3;                /* ±0.05 日 */
  var p0 = NS.planetAt(NS.PLANETS[2], t).xyz;
  var pm = NS.planetAt(NS.PLANETS[2], t - h).xyz;
  var pp = NS.planetAt(NS.PLANETS[2], t + h).xyz;
  return { r:p0, v:[(pp[0] - pm[0]) / 0.1, (pp[1] - pm[1]) / 0.1, (pp[2] - pm[2]) / 0.1] };
};

/* グリニッジ平均恒星時（度） */
NS.gmst = function (t) {
  var jd = t / 86400e3 + 2440587.5, d = jd - 2451545.0, T = d / 36525;
  var g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000;
  return ((g % 360) + 360) % 360;
};

/* 地心直交座標（赤道面・km）。lat・lon は度、alt は km。 */
function ecef(lat, lon, alt) {
  var la = lat * D2R, lo = lon * D2R, r = 6371.0 + alt;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)];
}
function rotZ(v, deg) {
  var c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
function eq2ecl(v) {
  var c = Math.cos(NS.OBLIQ * D2R), s = Math.sin(NS.OBLIQ * D2R);
  return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
}
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm3(a) { return Math.sqrt(dot3(a, a)); }

/* 位置 r（au）と速度 v（au/日）から軌道要素を求める */
NS.elemsFromRV = function (r, v) {
  var R = norm3(r), V = norm3(v), rv = dot3(r, v), GM = NS.GM_SUN;
  var h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  var H = norm3(h), a = 1 / (2 / R - V * V / GM);
  var ev = [0, 1, 2].map(function (k) { return (V * V / GM - 1 / R) * r[k] - rv / GM * v[k]; });
  var e = norm3(ev), i = Math.acos(h[2] / H) / D2R;
  var n = [-h[1], h[0], 0], N = norm3(n);
  var node = ((Math.atan2(n[1], n[0]) / D2R) + 360) % 360;
  var w = Math.acos(Math.max(-1, Math.min(1, dot3(n, ev) / (N * e)))) / D2R;
  if (ev[2] < 0) w = 360 - w;
  var nu = Math.acos(Math.max(-1, Math.min(1, dot3(ev, r) / (e * R)))) / D2R;
  if (rv < 0) nu = 360 - nu;
  var aJ = 5.20336301;
  return { a:a, e:e, i:i, node:node, w:w, nu:nu, q:a * (1 - e), Q:a * (1 + e),
           Tj:aJ / a + 2 * Math.cos(i * D2R) * Math.sqrt(a / aJ * (1 - e * e)) };
};

/* 地球近傍小惑星の軌道分類 */
NS.neaClass = function (a, q, Q) {
  if (q > 1.017) return 'アモール型';
  if (a < 1.0) return Q > 0.983 ? 'アテン型' : 'アティラ型';
  return 'アポロ型';
};

/* =========================================================================
   軌跡（発光点・終端点）と突入速度から、輻射点と日心軌道を導く。
   多点三角測量で決まるのは「地面に対する速度ベクトル」なので、
     ① 地球自転の速度を足して地心の速度にし、
     ② 地球重力による加速（天頂引力）を取り除いて地心速度 v_g と地心輻射点を得て、
     ③ 地球の公転速度を足して日心速度にする
   という順で直す。こうして求めた軌道は、発生時刻の地球の位置を必ず通る。
   ========================================================================= */
NS.orbitFromTrack = function (ev) {
  if (!ev || !ev.begin || !ev.end || !ev.vInf) return null;
  var t = ev.t, th = NS.gmst(t);
  var b = ecef(ev.begin.lat, ev.begin.lon, ev.begin.alt);
  var q2 = ecef(ev.end.lat, ev.end.lon, ev.end.alt);
  var d = [q2[0] - b[0], q2[1] - b[1], q2[2] - b[2]], L = norm3(d);
  if (!(L > 0)) return null;
  var dh = d.map(function (x) { return x / L; });

  /* 発光点での地平座標：突入角（水平面からの伏角）と飛行方位 */
  var la = ev.begin.lat * D2R, lo = ev.begin.lon * D2R;
  var up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  var east = [-Math.sin(lo), Math.cos(lo), 0];
  var north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  var entry = Math.asin(-dot3(dh, up)) / D2R;
  var azim = ((Math.atan2(dot3(dh, east), dot3(dh, north)) / D2R) + 360) % 360;

  /* 見かけの輻射点（飛行方向の逆向き）を赤道座標に直す */
  var radA = rotZ(dh.map(function (x) { return -x; }), th);
  var raApp = ((Math.atan2(radA[1], radA[0]) / D2R) + 360) % 360;
  var decApp = Math.asin(radA[2]) / D2R;

  /* ① 自転補正 */
  var W = 7.292115e-5, site = rotZ(b, th);
  var vrot = [-W * site[1], W * site[0], 0];
  var vec = [0, 1, 2].map(function (k) { return -ev.vInf * radA[k] + vrot[k]; });
  var Vec = norm3(vec);

  /* ② 天頂引力の補正 */
  var vesc = Math.sqrt(2 * NS.GM_EARTH / (6371.0 + ev.begin.alt));
  var vg = Math.sqrt(Math.max(0.01, Vec * Vec - vesc * vesc));
  var rC = vec.map(function (x) { return -x / Vec; });             /* 補正前の地心輻射点 */
  var zc = Math.acos(Math.max(-1, Math.min(1, dot3(rC, rotZ(up, th)))));
  var dz = 2 * Math.atan((Vec - vg) / (Vec + vg) * Math.tan(zc / 2));
  var zh = rotZ(up, th), perp = [0, 1, 2].map(function (k) { return zh[k] - Math.cos(zc) * rC[k]; });
  var pn = norm3(perp);
  var radG = pn > 1e-9
    ? [0, 1, 2].map(function (k) { return rC[k] * Math.cos(dz) - perp[k] / pn * Math.sin(dz); })
    : rC;
  var ra = ((Math.atan2(radG[1], radG[0]) / D2R) + 360) % 360, dec = Math.asin(radG[2]) / D2R;

  /* ③ 地球の公転速度を足して日心速度へ */
  var E = NS.earthState(t);
  var vgEcl = eq2ecl(radG.map(function (x) { return -vg * x; })).map(function (x) { return x / NS.AU_KMS; });
  var vh = [0, 1, 2].map(function (k) { return E.v[k] + vgEcl[k]; });
  var o = NS.elemsFromRV(E.r, vh);
  o.cls = NS.neaClass(o.a, o.q, o.Q);
  /* 衝突は交点で起きる。u = ω + ν が 0 なら昇交点、180° なら降交点。 */
  var u = (o.w + o.nu) % 360;
  o.impactNode = (u < 90 || u > 270) ? 'asc' : 'desc';
  return { orbit:o, radiant:{ ra:ra, dec:dec, raApp:raApp, decApp:decApp },
           vg:vg, vh:norm3(vh) * NS.AU_KMS, entryAngle:entry, azimuth:azim, pathLen:L };
};

/* 軌道を 1 周ぶんサンプルする */
function orbitPts(a, e, i, w, node, n) {
  var out = [];
  for (var k = 0; k <= n; k++) out.push(NS.orbXYZ(a, e, i, w, node, k / n * 2 * Math.PI));
  return out;
}

/* =========================================================================
   描画本体
   ========================================================================= */
NS.SolarSystem3D = function (opts) {
  opts = opts || {};
  var orb = opts.orbit, t = opts.t || NS.now();
  var size = opts.size || 560, H = opts.height || 420;
  var cv = el('canvas', { width:size * 2, height:H * 2, class:'ss3d',
    style:{ width:'100%', maxWidth:size + 'px', height:'auto', display:'block', touchAction:'none' } });
  var ctx = cv.getContext('2d');
  ctx.scale(2, 2);

  /* 視点は Cometarium の太陽系軌道 3D にあわせる。
     az は黄道面内の方位、el は黄道面からの仰角（真上＝90°、真横＝0°）、
     centre は画面の中心に置く天体。 */
  var DEF = { az:-35, el:66, zoom:1, centre:'sun' };
  var A = { az:DEF.az, el:DEF.el, zoom:DEF.zoom, centre:DEF.centre,
            showPlanets:true, showLabels:true, showNode:true,
            showPlane:false, showEquinox:true, showPeri:true, node:cv, spin:false };
  var drag = null;

  /* 画面の中心に置く点（太陽 or 発生時刻の地球＝衝突点） */
  function centrePos() {
    if (A.centre === 'earth' || A.centre === 'impact') return NS.planetAt(NS.PLANETS[2], t).xyz;
    return [0, 0, 0];
  }
  /* 方位 az・仰角 el のカメラ。右・上・視線の 3 ベクトルへ投げる。 */
  function project(p) {
    var ca = Math.cos(A.az * D2R), sa = Math.sin(A.az * D2R);
    var ce = Math.cos(A.el * D2R), se = Math.sin(A.el * D2R);
    return [ p[0] * (-sa) + p[1] * ca,                                  /* 右 */
             p[0] * (-ca * se) + p[1] * (-sa * se) + p[2] * ce,          /* 上 */
             p[0] * (ca * ce) + p[1] * (sa * ce) + p[2] * se ];          /* 奥行き */
  }
  function scr(p) {
    var c = centrePos(), s = scale();
    var q = project([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    return [size / 2 + q[0] * s, H / 2 - q[1] * s, q[2]];
  }
  function span0() { return Math.max(1.7, (orb ? orb.Q : 2) * 1.15); }
  function scale() { return Math.min(size, H) / 2 / span0() * 0.94 * A.zoom; }

  function line(pts, color, width, dash, alpha) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = scr(pts[i]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.restore();
  }
  /* away を真にすると、ラベルを画面中心（太陽）と反対側に出す */
  function dot(p, r, color, label, lcolor, away) {
    var q = scr(p);
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7);
    ctx.fillStyle = color; ctx.fill();
    if (label && A.showLabels) {
      var toRight = !away || q[0] >= size / 2;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = lcolor || 'rgba(200,212,230,0.85)';
      ctx.textAlign = toRight ? 'left' : 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(label, q[0] + (toRight ? r + 3 : -(r + 3)), q[1]);
    }
    return q;
  }

  function draw() {
    var css = getComputedStyle(document.documentElement);
    var ink = (css.getPropertyValue('--ink2') || '#AEB6C0').trim();
    var mut = (css.getPropertyValue('--muted') || '#7E8792').trim();
    ctx.clearRect(0, 0, size, H);

    /* 黄道面のグリッド（同心円と 30° ごとの放射線）。縮小したぶんだけ外へ伸ばす。 */
    var span = span0() / Math.min(1, A.zoom);
    var step = span > 8 ? 5 : span > 4 ? 2 : span > 2 ? 1 : 0.5;
    for (var rr = step; rr <= span; rr += step) {
      var ring = [];
      for (var k = 0; k <= 72; k++) ring.push([rr * Math.cos(k / 72 * 2 * Math.PI), rr * Math.sin(k / 72 * 2 * Math.PI), 0]);
      line(ring, mut, 0.6, null, 0.16);
    }
    for (var ang = 0; ang < 360; ang += 30) {
      line([[0, 0, 0], [span * Math.cos(ang * D2R), span * Math.sin(ang * D2R), 0]], mut, 0.5, [2, 4], 0.12);
    }
    /* 春分点方向（黄経 0°。黄道座標の x 軸） */
    if (A.showEquinox) {
      line([[0, 0, 0], [span * 0.98, 0, 0]], mut, 0.9, [6, 4], 0.5);
      if (A.showLabels) {
        var vq = scr([span * 0.98, 0, 0]);
        ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = mut;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(NS.t('♈ 黄経 0°'), vq[0] + 4, vq[1]);
      }
    }

    /* 惑星の軌道と位置 */
    if (A.showPlanets) {
      NS.PLANETS.forEach(function (pl) {
        var st = NS.planetAt(pl, t);
        line(orbitPts(st.a, st.e, st.i, st.w, st.node, 180), pl.c, 1, null, 0.42);
        /* 地球は下で「衝突」マーカーを重ねるので、ここではラベルを出さない */
        dot(st.xyz, pl.r * 0.55 + 1.4, pl.c, (orb && pl.en === 'Earth') ? null : NS.t(pl.n), pl.c);
      });
    }

    /* 太陽 */
    var sq = scr([0, 0, 0]);
    var g = ctx.createRadialGradient(sq[0], sq[1], 0, sq[0], sq[1], 16);
    g.addColorStop(0, 'rgba(255,214,120,0.95)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sq[0], sq[1], 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFD678'; ctx.beginPath(); ctx.arc(sq[0], sq[1], 3.6, 0, 7); ctx.fill();

    /* 流星体の軌道 */
    if (orb) {
      var pts = orbitPts(orb.a, orb.e, orb.i, orb.w, orb.node, 360);
      /* 軌道が囲む面（軌道面の傾きが一目で分かる） */
      if (A.showPlane) {
        ctx.save();
        ctx.beginPath();
        pts.forEach(function (p, k) {
          var q = scr(p);
          if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(214,64,95,0.10)'; ctx.fill();
        ctx.restore();
      }
      /* 黄道面より上（実線）と下（破線）に切り分ける。切れ目でつながるよう
         境目の点を両方の区間に入れ、1 周ぶんを余さず描く。 */
      var segs = [], cur = null;
      pts.forEach(function (p, k) {
        var upSide = p[2] >= 0;
        if (!cur || cur.up !== upSide) {
          if (cur) cur.pts.push(p);
          cur = { up:upSide, pts:k > 0 ? [pts[k - 1]] : [] };
          segs.push(cur);
        }
        cur.pts.push(p);
      });
      segs.forEach(function (sg) {
        if (sg.pts.length < 2) return;
        if (sg.up) line(sg.pts, '#D6405F', 2.2, null, 1);
        else line(sg.pts, '#D6405F', 1.4, [3, 3], 0.6);
      });

      /* 衝突点＝発生時の地球の位置（交点のラベルが重ならないよう先に画面座標を出す） */
      var ea = NS.planetAt(NS.PLANETS[2], t);
      var eScr = scr(ea.xyz);
      var far = function (q) { return Math.hypot(q[0] - eScr[0], q[1] - eScr[1]) > 18; };

      /* 昇交点・降交点 */
      if (A.showNode) {
        var pN = NS.orbXYZ(orb.a, orb.e, orb.i, orb.w, orb.node, -orb.w * D2R);
        var pD = NS.orbXYZ(orb.a, orb.e, orb.i, orb.w, orb.node, Math.PI - orb.w * D2R);
        line([pN, pD], '#7C6FD0', 1.1, [5, 4], 0.85);
        dot(pN, 2.4, '#7C6FD0', far(scr(pN)) ? NS.t('☊ 昇交点') : null, '#9C92DF', true);
        dot(pD, 2.4, '#7C6FD0', far(scr(pD)) ? NS.t('☋ 降交点') : null, '#9C92DF', true);
      }
      /* 近日点と、そこから黄道面へ下ろした垂線（面からの高さが読める） */
      if (A.showPeri) {
        var pq = NS.orbXYZ(orb.a, orb.e, orb.i, orb.w, orb.node, 0);
        line([pq, [pq[0], pq[1], 0]], '#F2C14E', 1, [3, 3], 0.55);
        dot([pq[0], pq[1], 0], 1.4, 'rgba(242,193,78,0.5)', null);
        dot(pq, 2.6, '#F2C14E', 'q = ' + orb.q.toFixed(3) + ' au', '#F2C14E', true);
      }
      var eq = dot(ea.xyz, 4.2, '#D6405F', null);
      ctx.save();
      ctx.strokeStyle = '#D6405F'; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(eq[0], eq[1], 8, 0, 7); ctx.stroke();
      ctx.restore();
      if (A.showLabels) {
        ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#E8798F';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(NS.t('地球（衝突）'), eq[0] + 11, eq[1]);
      }
    }

    /* 隅の表示：左下に視点、右下に視野の半径（Cometarium の 3D 図と同じ並び） */
    ctx.font = '9.5px ui-monospace, monospace'; ctx.fillStyle = mut;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(NS.t('方位 ') + Math.round(((A.az % 360) + 360) % 360) + NS.t('°  仰角 ') + Math.round(A.el) + '°',
                 8, H - 6);
    ctx.textAlign = 'right';
    ctx.fillText(NS.f(span0() / A.zoom, 2) + ' au　×' + A.zoom.toFixed(2), size - 8, H - 6);
    ctx.textBaseline = 'top';
    ctx.fillText(NS.t('ドラッグで回転 / ホイールで拡大'), size - 8, 6);
    ctx.textAlign = 'left';
    ctx.fillText(NS.t('中心：') + NS.t(A.centre === 'sun' ? '太陽' : '地球'), 8, 6);
  }

  /* --- マウス・タッチ --- */
  cv.addEventListener('pointerdown', function (e2) {
    drag = { x:e2.clientX, y:e2.clientY, az:A.az, el:A.el };
    cv.setPointerCapture(e2.pointerId);
    A.spin = false;
  });
  cv.addEventListener('pointermove', function (e2) {
    if (!drag) return;
    A.az = drag.az + (e2.clientX - drag.x) * 0.5;
    A.el = Math.max(-90, Math.min(90, drag.el - (e2.clientY - drag.y) * 0.45));
    draw();
  });
  cv.addEventListener('pointerup', function () { drag = null; });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('wheel', function (e2) {
    e2.preventDefault();
    A.setZoom(A.zoom * Math.exp(-e2.deltaY * 0.0014));
  }, { passive:false });
  cv.addEventListener('dblclick', function () { A.reset(); });   /* Cometarium と同じ */

  A.draw = draw;
  A.setView = function (az, elv, z) { A.az = az; A.el = elv; if (z) A.zoom = z; draw(); };
  A.setZoom = function (z) { A.zoom = Math.max(0.12, Math.min(40, z)); draw(); };
  A.setCentre = function (c) { A.centre = c; draw(); };
  A.reset = function () {
    A.az = DEF.az; A.el = DEF.el; A.zoom = DEF.zoom; A.centre = DEF.centre;
    if (A.onReset) A.onReset();
    draw();
  };
  A.node = cv;
  draw();
  return A;
};

/* 太陽系 3D のパネル（火球画面から呼ぶ） */
NS.orbit3dPanel = function (e) {
  var orb = e.orbit;
  var S = NS.SolarSystem3D({ orbit:orb, t:e.t, size:620, height:430 });
  /* 視点のボタン（Cometarium の太陽系軌道 3D と同じ並び）。
     「黄道面の真上／真横」は春分点を画面の右（x 軸）に向けた絶対的な向きにする。 */
  var views = [['斜めから', -35, 66], ['黄道面の真上', 270, 90], ['黄道面の真横', 270, 0],
               ['近日点の方向', orb.node + orb.w - 90, 24], ['土星まで', -35, 66, 0.15]];
  var seg = el('div', { class:'seg' }, views.map(function (v, i) {
    return el('button', { text:v[0], 'aria-pressed':i === 0 ? 'true' : 'false', onclick:function (ev) {
      Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.currentTarget.setAttribute('aria-pressed', 'true');
      S.setView(v[1], v[2], v[3]);
    } });
  }));
  /* 画面の中心に置く天体 */
  var cenBtns = [];
  var cen = el('div', { class:'seg' }, [['太陽中心', 'sun'], ['地球中心', 'earth']].map(function (v, i) {
    var b = el('button', { text:v[0], 'aria-pressed':i === 0 ? 'true' : 'false', onclick:function () {
      cenBtns.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      S.setCentre(v[1]);
    } });
    cenBtns.push(b);
    return b;
  }));
  function toggle(label, key) {
    var b = el('button', { class:'iconbtn', text:label, 'aria-pressed':S[key] ? 'true' : 'false',
      style:{ opacity:S[key] ? 1 : 0.5 }, onclick:function () {
        S[key] = !S[key];
        b.setAttribute('aria-pressed', S[key] ? 'true' : 'false');
        b.style.opacity = S[key] ? 1 : 0.5;
        S.draw();
      } });
    return b;
  }
  var toggles = el('div', { class:'split' }, [
    toggle('惑星', 'showPlanets'), toggle('ラベル', 'showLabels'), toggle('交点線', 'showNode'),
    toggle('軌道面', 'showPlane'), toggle('春分点', 'showEquinox'), toggle('近日点', 'showPeri')
  ]);
  var zoomBox = el('div', { class:'split' }, [
    el('button', { class:'iconbtn', text:'リセット', onclick:function () { S.reset(); } }),
    el('button', { class:'iconbtn', text:'−', onclick:function () { S.setZoom(S.zoom / 1.35); } }),
    el('button', { class:'iconbtn', text:'＋', onclick:function () { S.setZoom(S.zoom * 1.35); } })
  ]);
  S.onReset = function () {
    Array.prototype.forEach.call(seg.children, function (c, i) { c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); });
    cenBtns.forEach(function (c, i) { c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); });
  };

  return NS.panel('突入前の軌道（太陽系 3D）', {
    note:'黄道座標・太陽中心。ドラッグで視点を回し（方位・仰角）、ホイールで拡大縮小、ダブルクリックで既定に戻る',
    tools:NS.badge(orb.cls, 'info') }, [
    el('div', { class:'specbar' }, [el('span', { class:'lbl', text:'視点' }), seg,
      el('div', { class:'spacer' }), zoomBox]),
    el('div', { class:'specbar' }, [el('span', { class:'lbl', text:'中心' }), cen,
      el('div', { class:'spacer' }), toggles]),
    S.node,
    NS.chart.legend([['流星体の軌道', '#D6405F', 'line'], ['黄道面より下', '#D6405F', 'dash'],
                     ['交点線', '#7C6FD0', 'dash'], ['近日点', '#F2C14E', 'dot'], ['地球', '#4585CC', 'dot']]),
    el('div', { class:'note', html:'赤の実線が黄道面より上、破線が下で、1 周ぶんすべてを描いている。紫の破線は軌道面と黄道面が交わる<b>交点線</b>で、'
      + 'その向きが昇交点黄経 &Omega; = ' + NS.f(orb.node, 2) + '&deg; にあたる。流星体が黄道面を横切るのは交点だけなので、'
      + '衝突は必ず交点で起こる（この事例は' + (orb.impactNode === 'asc' ? '昇交点' : '降交点') + '）。'
      + '赤い二重丸が発生時刻 ' + NS.fmtJST(e.t, { sec:false }) + ' JST の地球の位置で、軌道はそこをきちんと通る。'
      + '惑星の位置は JPL の近似要素（1800–2050 年に有効）で同じ時刻のものを描いている。' }),
    el('div', { class:'src', text:'軌道要素は、多点三角測量で決めた軌跡（発光点・終端点）と突入速度から、'
      + '地球自転による速度を加えて地心速度に直し、天頂引力（地球重力による加速と輻射点のずれ）を取り除いて地心輻射点・地心速度 v_g を求め、'
      + 'さらに地球の公転速度を加えて日心速度としたうえで、発生時刻の地球の位置を通る二体軌道として解いたものである。'
      + '惑星の位置は JPL「Keplerian Elements for Approximate Positions of the Major Planets」による近似計算で、'
      + '描画は黄道座標系の正射影である。' })
  ]);
};

})(NS);
