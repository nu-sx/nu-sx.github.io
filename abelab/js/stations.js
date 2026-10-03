/* NU-AbeLab / 観測局と機材
   DIMS（Dark matter and Interstellar Meteoroid Study）の日本側観測と同じ構成を踏襲する。
   カメラは Canon ME20F-SH 系＋35 mm F1.4、視野 54°×33°、1920×1080、30 fps、
   トリガーは UFOCapture。運用は日没 30 分後から日の出 30 分前まで自動。 */
'use strict';
(function (AL) {

/* 機材の共通諸元 */
AL.RIG = {
  sensor: '35 mm フルサイズ CMOS（1920 × 1080）',
  lens:   '35 mm F1.4',
  fovW: 54, fovH: 33,            /* 視野 [deg] */
  fps: 30,
  iso: 1600000,                  /* 実運用の設定感度（最大 4,000,000） */
  band: '300–1000 nm',
  limMag: 6.0,                   /* 流星に対する限界等級の目安 */
  trigger: 'UFOCapture（連続 2 フレーム閾値超、または 1 フレームで 100 画素以上の変化）',
  pre: 30, post: 30,             /* トリガー前後に付ける余裕フレーム */
  /* 無圧縮 YUYV422 の記録レート：1920×1080×2 byte × 30 fps */
  rateMBs: 1920 * 1080 * 2 * 30 / 1e6
};

/* 系列色は data-viz の検証済みスロット 1–3（暗面で全ペア CVD ΔE 9.4）を固定順に割り当てる */
AL.ST = {
  FNB: {
    id: 'FNB', name: '船橋', full: '日本大学 理工学部 船橋キャンパス',
    org: '日本大学 理工学部 航空宇宙工学科 阿部研究室',
    lat: 35.7236, lon: 140.0369, elev: 25,
    color: 'var(--series-1)', hex: '#3987e5',
    cam: 'Canon ME20F-SHN（カラー）', mode: 'zenith', az: 0, za: 10,
    sqm: 18.6, baseRate: 22, disk: 4096, diskBase: 0.84, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '学内 LAN（1 Gbps）', since: '2026-04',
    note: '開発・試験と火球監視を兼ねる都市部の局。光害が大きく限界等級は浅いが、' +
          '機材更新とトリガー調整をここで詰めてから山岳の 2 局へ展開する。'
  },
  KSO: {
    id: 'KSO', name: '木曽', full: '東京大学 木曽観測所',
    org: '東京大学大学院理学系研究科 附属天文学教育研究センター',
    lat: 35.7972, lon: 137.6256, elev: 1130,
    color: 'var(--series-2)', hex: '#d95926',
    cam: 'Canon ME20F-SH（モノクロ）', mode: 'pole', az: 0, za: 47,
    sqm: 21.3, baseRate: 55, disk: 8192, diskBase: 0.38, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '観測所回線（VPN 経由で遠隔操作）', since: '2021-10',
    note: '西側の局。明野局と北天の同じ空（天頂角 47°）を見込み、高度 100 km で視野が重なるように向ける。'
  },
  AKN: {
    id: 'AKN', name: '明野', full: '東京大学宇宙線研究所 明野観測所',
    org: '東京大学宇宙線研究所',
    lat: 35.7833, lon: 138.5000, elev: 900,
    color: 'var(--series-3)', hex: '#199e70',
    cam: 'Canon ME20F-SH（モノクロ）', mode: 'pole', az: 0, za: 47,
    sqm: 21.0, baseRate: 50, disk: 8192, diskBase: 0.61, pc: '制御 PC（Windows 11 / UFOCapture HD2）',
    net: '観測所回線（VPN 経由で遠隔操作）', since: '2021-08',
    note: '東側の局。木曽局と対にして同時流星を取り、速度と軌道を出す。'
  }
};
AL.STL = ['FNB', 'KSO', 'AKN'];                       /* 表示順（系列色の割り当て順でもある） */
AL.st = function (id) { return AL.ST[id]; };
AL.stList = function (ids) { return (ids || AL.STL).map(AL.st); };

/* 同時観測の組。基線長はその場で計算する */
AL.PAIRS = [['KSO', 'AKN'], ['AKN', 'FNB'], ['KSO', 'FNB']];
AL.baseline = function (a, b) {
  var A = AL.st(a), B = AL.st(b);
  return AL.dist(A.lat, A.lon, B.lat, B.lon);
};
/* 高度 h km の層で、その局の視野が覆う範囲（局を原点とする北 / 東 [km]）。
   カメラは方位 az・天頂角 za を向き、画像の長辺 54° が水平、短辺 33° が上下に対応する。
   短辺は天頂角 za±16.5° に広がるので、地表に落とすと南北に大きく引き伸ばされる。 */
AL.footprint = function (st, h) {
  var za = st.za * AL.d2r, hw = AL.RIG.fovW / 2 * AL.d2r, hh = AL.RIG.fovH / 2 * AL.d2r;
  var near = h * Math.tan(Math.max(0.01, za - hh));    /* 視野の手前端までの水平距離 */
  var far  = h * Math.tan(Math.min(1.50, za + hh));    /* 奥端（天頂角 86° で頭打ち） */
  var slant = h / Math.cos(za);
  var half = slant * Math.tan(hw);                     /* 視野中心での左右の半幅 */
  var br = st.az * AL.d2r, c = Math.cos(br), sn = Math.sin(br);
  return { near: near, far: far, half: half, mid: h * Math.tan(za),
           north: [near * c, far * c], east: [-half * c, half * c],
           azRad: br, sinAz: sn, cosAz: c };
};
/* 二局の視野が高度 h km で重なるか。方位が同じ（どちらも北向き）前提で、
   北方向の区間と東西方向の区間の積として重なりを見る。 */
AL.overlapAt = function (a, b, h) {
  var A = AL.st(a), B = AL.st(b);
  var fa = AL.footprint(A, h), fb = AL.footprint(B, h);
  /* B を原点にした A の位置（北・東 [km]） */
  var dN = (A.lat - B.lat) * 111.32;
  var dE = (A.lon - B.lon) * 111.32 * Math.cos(B.lat * AL.d2r);
  var aN = [dN + fa.near, dN + fa.far],  bN = [fb.near, fb.far];
  var aE = [dE - fa.half, dE + fa.half], bE = [-fb.half, fb.half];
  var oN = Math.min(aN[1], bN[1]) - Math.max(aN[0], bN[0]);
  var oE = Math.min(aE[1], bE[1]) - Math.max(aE[0], bE[0]);
  var areaA = (aN[1] - aN[0]) * (aE[1] - aE[0]);
  var inter = Math.max(0, oN) * Math.max(0, oE);
  return {
    overlap: oN > 0 && oE > 0, northKm: oN, eastKm: oE,
    areaKm2: inter, frac: areaA > 0 ? inter / areaA : 0,
    sep: AL.dist(A.lat, A.lon, B.lat, B.lon),
    box: { north: [Math.max(aN[0], bN[0]), Math.min(aN[1], bN[1])],
           east: [Math.max(aE[0], bE[0]), Math.min(aE[1], bE[1])] }
  };
};
/* 二局の視野が重なる高度の範囲（流星の発光層 70–120 km に対して） */
AL.overlapHeights = function (a, b) {
  var lo = null, hi = null;
  for (var h = 40; h <= 140; h += 1) {
    var o = AL.overlapAt(a, b, h);
    if (o.overlap) { if (lo == null) lo = h; hi = h; }
  }
  return { lo: lo, hi: hi };
};

})(AL);
