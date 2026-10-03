/* NU-AbeLab / 観測局と機材
   DIMS（Dark matter and Interstellar Meteoroid Study）の日本側観測と同じ構成を踏襲する。
   カメラは Canon ME20F-SH 系（35 mm フルサイズ CMOS）に 24 mm レンズ、1920×1080、30 fps、
   トリガーは UFOCapture。運用は日没 30 分後から日の出 30 分前まで自動。
   視野は撮像素子の寸法と焦点距離から 2·atan(寸法/2f) で求める。向き（方位・仰角）と焦点距離は
   局ごとに持ち、画面から変えられる。 */
'use strict';
(function (AL) {

/* 機材の共通諸元 */
AL.RIG = {
  sensor: '35 mm フルサイズ CMOS（36 × 24 mm, 1920 × 1080）',
  sw: 36, sh: 24,                /* 撮像面の寸法 [mm] */
  fl: 24,                        /* 既定の焦点距離 [mm] */
  lens:   '24 mm F1.4',
  fps: 30,
  iso: 1600000,                  /* 実運用の設定感度（最大 4,000,000） */
  band: '300–1000 nm',
  limMag: 6.0,                   /* 流星に対する限界等級の目安 */
  trigger: 'UFOCapture（連続 2 フレーム閾値超、または 1 フレームで 100 画素以上の変化）',
  pre: 30, post: 30,             /* トリガー前後に付ける余裕フレーム */
  /* 無圧縮 YUYV422 の記録レート：1920×1080×2 byte × 30 fps */
  rateMBs: 1920 * 1080 * 2 * 30 / 1e6
};
/* 焦点距離 [mm] → 視野 [deg]。長辺が水平、短辺が上下 */
AL.fovOf = function (fl) {
  var f = fl || AL.RIG.fl;
  return { w: 2 * Math.atan(AL.RIG.sw / 2 / f) * AL.r2d, h: 2 * Math.atan(AL.RIG.sh / 2 / f) * AL.r2d, fl: f };
};
AL.fov = function (st) { return AL.fovOf(st.fl); };
/* 視野の立体角の目安（deg²）。トリガー率は視野の広さに比例する */
AL.fovArea = function (st) { var v = AL.fov(st); return v.w * v.h; };
AL.FOV_REF = 54 * 33;              /* DIMS（35 mm レンズ）の視野。トリガー率の基準 */

/* 系列色は data-viz の検証済みスロット 1–3（暗面で全ペア CVD ΔE 9.4）を固定順に割り当てる */
AL.ST = {
  FNB: {
    id: 'FNB', name: '船橋', full: '日本大学 理工学部 船橋キャンパス',
    org: '日本大学 理工学部 航空宇宙工学科 阿部研究室',
    lat: 35.7236, lon: 140.0369, elev: 25,
    color: 'var(--series-1)', hex: '#3987e5',
    cam: 'Canon ME20F-SHN（カラー・フルサイズ）', lensNote: '24 mm F1.4',
    az: 337.5, el: 45, fl: 24,      /* 北北西・仰角 45° */
    sqm: 18.6, baseRate: 22, disk: 4096, diskBase: 0.84, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '学内 LAN（1 Gbps）', since: '2026-04',
    note: '開発・試験と火球監視を兼ねる都市部の局。北北西を向き、関東上空から山岳 2 局の方向までを覆う。' +
          '光害が大きく限界等級は浅いが、機材更新とトリガー調整をここで詰めてから山岳の 2 局へ展開する。'
  },
  KSO: {
    id: 'KSO', name: '木曽', full: '東京大学 木曽観測所',
    org: '東京大学大学院理学系研究科 附属天文学教育研究センター',
    lat: 35.7972, lon: 137.6256, elev: 1130,
    color: 'var(--series-2)', hex: '#d95926',
    cam: 'Canon ME20F-SH（モノクロ・フルサイズ）', lensNote: '24 mm F1.4',
    az: 45, el: 45, fl: 24,         /* 北東・仰角 45° */
    sqm: 21.3, baseRate: 55, disk: 8192, diskBase: 0.38, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '観測所回線（VPN 経由で遠隔操作）', since: '2021-10',
    note: '西側の局。北東を向き、北西を向く明野局と高度 80–120 km の層で視野が重なるようにする。'
  },
  AKN: {
    id: 'AKN', name: '明野', full: '東京大学宇宙線研究所 明野観測所',
    org: '東京大学宇宙線研究所',
    lat: 35.7833, lon: 138.5000, elev: 900,
    color: 'var(--series-3)', hex: '#199e70',
    cam: 'Canon ME20F-SH（モノクロ・フルサイズ）', lensNote: '24 mm F1.4',
    az: 315, el: 45, fl: 24,        /* 北西・仰角 45° */
    sqm: 21.0, baseRate: 50, disk: 8192, diskBase: 0.61, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '観測所回線（VPN 経由で遠隔操作）', since: '2021-08',
    note: '東側の局。北西を向き、北東を向く木曽局と対にして同時流星を取り、速度と軌道を出す。'
  }
};
AL.STL = ['FNB', 'KSO', 'AKN'];                       /* 表示順（系列色の割り当て順でもある） */
AL.st = function (id) { return AL.ST[id]; };
AL.stList = function (ids) { return (ids || AL.STL).map(AL.st); };

/* 同時観測の組。基線長はその場で計算する */
AL.PAIRS = [['KSO', 'AKN'], ['AKN', 'FNB'], ['KSO', 'FNB']];
/* 向き・画角を変える。方位は 0–360、仰角は 5–85、焦点距離は 8–135 mm に収める */
AL.setAim = function (st, a) {
  if (a.az != null) st.az = ((a.az % 360) + 360) % 360;
  if (a.el != null) st.el = AL.clamp(a.el, 5, 85);
  if (a.fl != null) st.fl = AL.clamp(a.fl, 8, 135);
  return st;
};
AL.aimDefaults = { FNB: { az: 337.5, el: 45, fl: 24 }, KSO: { az: 45, el: 45, fl: 24 }, AKN: { az: 315, el: 45, fl: 24 } };
AL.resetAim = function () { AL.STL.forEach(function (id) { AL.setAim(AL.ST[id], AL.aimDefaults[id]); }); };
AL.compass16 = function (deg) {
  var N = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
           '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return N[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
};
AL.baseline = function (a, b) {
  var A = AL.st(a), B = AL.st(b);
  return AL.dist(A.lat, A.lon, B.lat, B.lon);
};
/* 高度 h km の層で、その局の視野が覆う範囲（局を原点とする北 / 東 [km]）。
   カメラは方位 az・仰角 el を向き、画像の長辺が水平、短辺が上下に対応する。
   短辺は天頂角 za±16.5° に広がるので、地表に落とすと南北に大きく引き伸ばされる。 */
AL.za = function (st) { return 90 - st.el; };         /* 仰角 → 天頂角 */
AL.footprint = function (st, h) {
  var v = AL.fov(st);
  var za = AL.za(st) * AL.d2r, hw = v.w / 2 * AL.d2r, hh = v.h / 2 * AL.d2r;
  var near = h * Math.tan(Math.max(0.01, za - hh));    /* 視野の手前端までの水平距離 */
  var far  = h * Math.tan(Math.min(1.50, za + hh));    /* 奥端（天頂角 86° で頭打ち） */
  var slant = h / Math.cos(za);
  var half = slant * Math.tan(hw);                     /* 視野中心での左右の半幅 */
  var br = st.az * AL.d2r, c = Math.cos(br), sn = Math.sin(br);
  return { near: near, far: far, half: half, mid: h * Math.tan(za),
           north: [near * c, far * c], east: [-half * c, half * c],
           azRad: br, sinAz: sn, cosAz: c };
};
/* 高度 h km の層での視野の footprint を多角形で返す（局を原点とする [北, 東] km）。
   天頂角 za±16.5° で近端と遠端の距離が変わり、その距離に比例して左右の幅も変わるので、
   地上に落とした形は矩形ではなく「奥ほど広がる台形」になる。
   ref を渡すと、その地点を原点とする座標系で返す。 */
AL.footprintPoly = function (st, h, ref) {
  var v = AL.fov(st);
  var za = AL.za(st) * AL.d2r, hh = v.h / 2 * AL.d2r, hw = v.w / 2 * AL.d2r;
  var zN = Math.max(0.004, za - hh), zF = Math.min(1.48, za + hh);   /* 天頂角 85° で頭打ち */
  var dN = h * Math.tan(zN), dF = h * Math.tan(zF);
  var wN = (h / Math.cos(zN)) * Math.tan(hw), wF = (h / Math.cos(zF)) * Math.tan(hw);
  var c = Math.cos(st.az * AL.d2r), sn = Math.sin(st.az * AL.d2r);
  var o = ref ? [(st.lat - ref.lat) * 111.32, (st.lon - ref.lon) * 111.32 * Math.cos(ref.lat * AL.d2r)] : [0, 0];
  /* [前方, 横] → [北, 東] */
  return [[dN, -wN], [dF, -wF], [dF, wF], [dN, wN]].map(function (q) {
    return [o[0] + q[0] * c - q[1] * sn, o[1] + q[0] * sn + q[1] * c];
  });
};
/* 多角形の面積（靴ひも公式）と凸多角形どうしの交差（Sutherland–Hodgman） */
function polyArea(p) {
  var a = 0;
  for (var i = 0, n = p.length; i < n; i++) {
    var q = p[(i + 1) % n];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return Math.abs(a) / 2;
}
function clipPoly(subject, clip) {
  var out = subject.slice();
  for (var i = 0, n = clip.length; i < n && out.length; i++) {
    var A = clip[i], B = clip[(i + 1) % n], inp = out;
    out = [];
    var side = function (p) { return (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]); };
    var sgn = polyArea(clip) > 0 ? 1 : 1;
    for (var j = 0; j < inp.length; j++) {
      var P = inp[j], Q = inp[(j + 1) % inp.length];
      var sp = side(P), sq = side(Q);
      /* 多角形は反時計回り・時計回りのどちらで来るか分からないので、内側の符号を面積から決める */
      if (sp * sgn >= 0) out.push(P);
      if ((sp > 0) !== (sq > 0)) {
        var t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    }
  }
  return out;
}
function ccw(p) {                                   /* 反時計回りに揃える */
  var a = 0;
  for (var i = 0, n = p.length; i < n; i++) { var q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a < 0 ? p.slice().reverse() : p;
}
/* 二局の視野が高度 h km でどれだけ重なるか。重なり領域の多角形も返す（地図に描く） */
AL.overlapAt = function (a, b, h) {
  var A = AL.st(a), B = AL.st(b);
  var ref = { lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2 };
  var pa = ccw(AL.footprintPoly(A, h, ref)), pb = ccw(AL.footprintPoly(B, h, ref));
  var inter = clipPoly(pa, pb);
  var areaA = polyArea(pa), areaI = inter.length > 2 ? polyArea(inter) : 0;
  return { overlap: areaI > 1, areaKm2: areaI, frac: areaA > 0 ? areaI / areaA : 0,
           poly: inter, a: pa, b: pb, ref: ref,
           sep: AL.dist(A.lat, A.lon, B.lat, B.lon) };
};
AL.polyArea = polyArea; AL.clipPoly = clipPoly; AL.ccwPoly = ccw;
/* 複数局が同時に見込む領域（高度 h km）。3 局そろえば軌道の精度が上がる */
AL.commonVolume = function (ids, h) {
  var sts = ids.map(AL.st);
  var ref = { lat: AL.sum(sts.map(function (x) { return x.lat; })) / sts.length,
              lon: AL.sum(sts.map(function (x) { return x.lon; })) / sts.length };
  var poly = null;
  for (var i = 0; i < sts.length; i++) {
    var q = ccw(AL.footprintPoly(sts[i], h, ref));
    poly = poly == null ? q : clipPoly(poly, q);
    if (poly.length < 3) return { area: 0, poly: [], ref: ref };
  }
  return { area: polyArea(poly), poly: poly, ref: ref };
};
/* [北, 東] km → 緯度経度 */
AL.neToLatLon = function (ne, ref) {
  var lat = ref.lat + ne[0] / 111.32;
  return { lat: lat, lon: ref.lon + ne[1] / (111.32 * Math.cos(ref.lat * AL.d2r)) };
};
/* 二局の視野が重なる高度の範囲（流星の発光層 70–120 km に対して） */
AL.overlapHeights = function (a, b) {
  var lo = null, hi = null;
  for (var h = 10; h <= 150; h += 1) {
    if (AL.overlapAt(a, b, h).overlap) { if (lo == null) lo = h; hi = h; }
  }
  return { lo: lo, hi: hi };
};

})(AL);
