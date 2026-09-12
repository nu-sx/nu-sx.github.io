/* NU-SORA デモ / 月面の描画
   リモート望遠鏡の「月面衝突閃光」モードで使う月を、実際の見え方に近づける。

   ① 月面座標（東経＋・北緯＋）で海・クレーター・光条・山脈を並べ、
      手前半球を正射影してアルベド図（反射能の分布）を作る。
   ② 同じ並びから起伏図（斜面が光の方を向いているか）を作る。
   ③ 太陽光の当たり方は Lommel–Seeliger の反射則 I ∝ μ₀/(μ₀+μ) で与える。
      月はこの式に従うため、満月では面全体がほぼ一様な明るさになり、
      縁が暗くならない（「平たい硬貨」のように見える）。
      斜面は μ₀ を μ₀ + g·√(1−μ₀²) だけ動かすので、太陽が低い明暗境界付近ほど
      クレーターの陰影が強く伸び、月下点の近くでは消える。
   ④ 夜側は地球照。海がうっすら見える程度の明るさを下限として与える。

   画像は大きさと月齢ごとに 1 枚だけ作って使い回す。 */
'use strict';
(function (NS) {
var el = NS.el, D2R = Math.PI / 180;

/* 月面の海・湾・暗いクレーター底。lon は東経（西は負）、lat は北緯、r は角半径（度）、
   k はアルベド比（高地を 1.0 とする）。大きく不規則な海は複数の円を重ねて作る。 */
NS.MOON_MARIA = [
  /* 雨の海：アペニン・コーカサス・アルプス・ジュラの各山脈に囲まれた円形の海 */
  { n:'雨の海', k:0.62, poly:[[-1,22],[-7,19],[-14,16],[-22,15],[-29,18],[-34,24],[-37,32],
    [-36,40],[-31,46],[-22,50],[-13,50],[-5,46],[-1,38],[0,30]] },
  /* 嵐の大洋：西の縁に沿って南北に広がる、最も広い海 */
  { n:'嵐の大洋', k:0.68, poly:[[-37,38],[-42,46],[-50,50],[-58,47],[-65,38],[-68,28],[-69,16],
    [-67,4],[-63,-6],[-57,-14],[-50,-16],[-45,-10],[-44,0],[-45,10],[-42,20],[-38,28]] },
  { n:'晴れの海', k:0.58, poly:[[8,23],[11,18],[18,16],[25,18],[29,24],[29,32],[25,38],[18,40],[11,36],[7,29]] },
  { n:'静かの海', k:0.60, poly:[[17,15],[23,18],[31,18],[39,15],[44,8],[43,0],[38,-4],[30,-3],[23,2],[18,8]] },
  { n:'豊かの海', k:0.66, poly:[[44,3],[51,4],[58,0],[61,-8],[59,-17],[53,-22],[47,-19],[43,-10],[42,-3]] },
  { n:'神酒の海', k:0.63, poly:[[30,-10],[36,-9],[41,-13],[41,-19],[36,-22],[31,-19],[29,-14]] },
  { n:'危難の海', k:0.62, poly:[[49,17],[52,23],[58,26],[65,24],[69,18],[68,11],[62,7],[55,8],[50,12]] },
  { n:'湿りの海', k:0.62, poly:[[-33,-18],[-39,-16],[-44,-20],[-45,-27],[-41,-32],[-35,-30],[-32,-24]] },
  { n:'雲の海',   k:0.68, poly:[[-7,-14],[-14,-12],[-22,-14],[-27,-20],[-26,-27],[-20,-31],[-12,-29],[-7,-23]] },
  { n:'知られざる海', k:0.70, poly:[[-18,-6],[-24,-5],[-28,-9],[-27,-14],[-22,-16],[-18,-12]] },
  { n:'島の海',   k:0.70, poly:[[-24,2],[-30,0],[-36,3],[-37,10],[-33,15],[-27,14],[-23,9]] },
  { n:'蒸気の海', k:0.68, poly:[[0,10],[5,9],[8,12],[7,17],[2,18],[-1,14]] },
  { n:'中央の入り江', k:0.74, poly:[[-3,-1],[2,-2],[6,1],[5,5],[1,7],[-3,4]] },
  { n:'熱の入り江', k:0.72, poly:[[-5,8],[-11,7],[-14,10],[-12,15],[-7,15],[-4,12]] },
  /* 氷の海：北の高地を東西に横切る細長い海 */
  { n:'氷の海',   k:0.70, poly:[[-42,44],[-36,50],[-26,55],[-12,58],[2,59],[16,57],[28,53],[34,48],
    [32,45],[22,49],[10,53],[-2,55],[-16,54],[-28,51],[-37,46]] },
  { n:'虹の入り江', k:0.70, poly:[[-26,44],[-31,42],[-37,44],[-38,48],[-33,50],[-27,48]] },
  { n:'疫病の沼', k:0.74, poly:[[-24,-18],[-29,-17],[-32,-21],[-29,-24],[-25,-22]] },
  { n:'夢の湖',   k:0.74, poly:[[26,34],[32,33],[36,37],[34,42],[28,42],[25,38]] },
  { n:'死の湖',   k:0.74, poly:[[24,43],[30,43],[31,47],[26,48]] },
  { n:'蛇の海',   k:0.74, poly:[[64,20],[70,21],[71,25],[66,26]] },
  /* 東の縁の海（大きく傾いて見える） */
  { n:'スミス海', k:0.66, poly:[[82,-5],[88,-6],[92,0],[90,7],[84,6],[81,1]] },
  { n:'縁の海',   k:0.68, poly:[[81,9],[87,9],[90,15],[86,19],[81,16]] },
  { n:'波の海',   k:0.72, poly:[[65,4],[71,5],[73,9],[68,11],[64,8]] },
  { n:'泡の海',   k:0.72, poly:[[62,-2],[67,-1],[68,3],[63,3]] },
  { n:'南の海',   k:0.74, poly:[[86,-30],[94,-33],[96,-43],[90,-48],[84,-42],[83,-35]] }
];
/* 描画と小クレーターの密度に使う、海のおおよその中心と広がり */
NS.MOON_MARIA.forEach(function (m) {
  var sx = 0, sy = 0, n = m.poly.length;
  m.poly.forEach(function (q) { sx += q[0]; sy += q[1]; });
  m.lon = sx / n; m.lat = sy / n;
  var rr = 0;
  m.poly.forEach(function (q) {
    rr = Math.max(rr, Math.hypot((q[0] - m.lon) * Math.cos(m.lat * Math.PI / 180), q[1] - m.lat));
  });
  m.r = rr;
});


/* 名前つきのクレーター。d は直径（km）。
   f は底のアルベド比（省略＝高地なみ）、b は明るさ（＞1 で白い）。 */
NS.MOON_CRATERS = [
  { lon:-11.2, lat:-43.3, d:85,  b:1.55, ray:{ n:64, len:58, w:1.15, a:0.20 } },   /* ティコ */
  { lon:-20.1, lat:9.6,   d:93,  b:1.32, ray:{ n:40, len:26, w:1.05, a:0.15 } },   /* コペルニクス */
  { lon:-38.0, lat:8.1,   d:32,  b:1.34, ray:{ n:28, len:15, w:0.75, a:0.14 } },   /* ケプラー */
  { lon:-47.4, lat:23.7,  d:40,  b:1.75, ray:{ n:26, len:11, w:0.70, a:0.16 } },   /* アリスタルコス */
  { lon:46.8,  lat:16.1,  d:28,  b:1.50, ray:{ n:22, len:14, w:0.70, a:0.15, az0:300, az1:190 } }, /* プロクロス */
  { lon:-14.4, lat:-58.6, d:231 },                                  /* クラビウス */
  { lon:-9.3,  lat:51.6,  d:101, f:0.55 },                          /* プラトー */
  { lon:-1.8,  lat:-9.3,  d:153, f:0.86 },                          /* プトレマイオス */
  { lon:-2.8,  lat:-13.4, d:119, f:0.82 },                          /* アルフォンスス */
  { lon:-1.9,  lat:-18.2, d:96 },                                   /* アルザケル */
  { lon:26.4,  lat:-11.4, d:100, b:1.12 },                          /* テオフィルス */
  { lon:24.0,  lat:-13.2, d:98 },                                   /* キリルス */
  { lon:23.4,  lat:-18.1, d:98 },                                   /* カタリナ */
  { lon:61.1,  lat:-8.9,  d:132, b:1.18 },                          /* ラングレヌス */
  { lon:60.4,  lat:-25.1, d:177 },                                  /* ペタヴィウス */
  { lon:61.8,  lat:-16.4, d:147 },                                  /* ヴェンデリヌス */
  { lon:55.5,  lat:27.7,  d:125, f:0.84 },                          /* クレオメデス */
  { lon:29.9,  lat:31.8,  d:95,  f:0.80 },                          /* ポシドニウス */
  { lon:-4.0,  lat:29.7,  d:81,  f:0.72 },                          /* アルキメデス */
  { lon:-11.3, lat:14.5,  d:59,  b:1.10 },                          /* エラトステネス */
  { lon:-40.1, lat:-17.6, d:110, f:0.80 },                          /* ガッサンディ */
  { lon:-55.3, lat:-44.3, d:227, f:0.78 },                          /* シッカルト */
  { lon:-69.1, lat:-66.5, d:303 },                                  /* バイイ */
  { lon:-21.8, lat:-49.6, d:145 },                                  /* ロンゴモンタヌス */
  { lon:-6.2,  lat:-50.0, d:156 },                                  /* マギヌス */
  { lon:6.0,   lat:-41.1, d:126, f:0.88 },                          /* ストフレル */
  { lon:14.0,  lat:-42.0, d:114 },                                  /* マウロリクス */
  { lon:17.4,  lat:50.2,  d:87,  b:1.10 },                          /* アリストテレス */
  { lon:16.3,  lat:44.3,  d:67 },                                   /* エウドクソス */
  { lon:44.4,  lat:46.7,  d:87 },                                   /* アトラス */
  { lon:39.1,  lat:46.7,  d:69,  f:0.66 },                          /* ヘルクレス */
  { lon:33.2,  lat:-21.2, d:124, f:0.70 },                          /* フラカストリウス */
  { lon:32.2,  lat:-29.7, d:88 },                                   /* ピッコロミニ */
  { lon:-68.3, lat:-5.5,  d:173, f:0.44 },                          /* グリマルディ */
  { lon:-74.6, lat:-3.3,  d:146, f:0.62 },                          /* リッチョリ */
  { lon:56.5,  lat:53.6,  d:123, f:0.66 },                          /* エンデュミオン */
  { lon:60.6,  lat:-36.3, d:125 },                                  /* フルネリウス */
  { lon:40.8,  lat:-45.4, d:199 },                                  /* ヤンセン */
  { lon:5.2,   lat:-5.5,  d:150, f:0.90 },                          /* ヒッパルコス */
  { lon:4.1,   lat:-11.2, d:136 },                                  /* アルバテグニウス */
  { lon:1.0,   lat:-33.1, d:132 },                                  /* ワルテル */
  { lon:3.3,   lat:-28.0, d:70 },                                   /* ウェルナー */
  { lon:-22.2, lat:-20.7, d:61,  b:1.14 },                          /* ブリアルドゥス */
  { lon:-13.5, lat:-29.8, d:97,  f:0.72 },                          /* ピタトゥス */
  { lon:9.1,   lat:14.5,  d:38,  b:1.16 },                          /* マニリウス */
  { lon:16.0,  lat:16.3,  d:27,  b:1.22 },                          /* メネラウス */
  { lon:17.3,  lat:2.8,   d:18,  b:1.30 },                          /* ディオニュシウス */
  { lon:32.7,  lat:-0.4,  d:4,   b:1.40 },                          /* ケンソリヌス */
  { lon:11.8,  lat:27.7,  d:2.4, b:1.35 },                          /* リンネ */
  { lon:-8.1,  lat:-21.3, d:40,  b:1.12 },                          /* ラランド周辺 */
  { lon:-43.4, lat:-12.9, d:63,  b:1.10 },                          /* メルセニウス */
  { lon:-25.9, lat:46.8,  d:40,  b:1.08 }                           /* ヘリコン／ル・ヴェリエ */
];

/* 山脈・尾根。海の縁をふちどると月らしくなる。折れ線（東経, 北緯）で与える。 */
NS.MOON_RIDGES = [
  { name:'アペニン山脈',  pts:[[-1, 18], [-4, 21], [-7, 24], [-11, 27], [-15, 30]], w:2.2, b:1.07 },
  { name:'カウカスス山脈',pts:[[-9, 33], [-6, 37], [-4, 40], [-1, 43]],             w:1.8, b:1.06 },
  { name:'アルプス山脈',  pts:[[-1, 45], [-4, 47], [-8, 49], [-12, 50]],            w:1.8, b:1.06 },
  { name:'ジュラ山脈',    pts:[[-24, 47], [-30, 48], [-36, 46], [-38, 42]],         w:1.8, b:1.05 },
  { name:'カルパチア山脈',pts:[[-16, 15], [-20, 16], [-25, 16], [-29, 15]],         w:1.5, b:1.05 },
  { name:'ハエムス山脈',  pts:[[6, 18], [10, 19], [14, 20], [18, 19]],              w:1.4, b:1.04 },
  { name:'アルタイ断崖',  pts:[[22, -24], [26, -27], [29, -30]],                    w:1.6, b:1.05 },
  { name:'ピレネー山脈',  pts:[[41, -12], [42, -16], [42, -20]],                    w:1.2, b:1.04 }
];

/* ---- 投影（正射影：手前半球をそのまま平面に落とす） ----
   画面は北が上・東が左（望遠鏡の視野と同じ向き）。
   x は右が正、y は下が正、z は手前が正で、単位は月の半径。 */
function proj(lon, lat) {
  var b = lat * D2R, l = lon * D2R, cb = Math.cos(b);
  return [-cb * Math.sin(l), -Math.sin(b), cb * Math.cos(l)];
}
/* (lon, lat) から方位角 az（北から東回り）へ角距離 d だけ大円に沿って進んだ点 */
function offset(lon, lat, az, d) {
  var b = lat * D2R, l = lon * D2R, A = az * D2R, D = d * D2R;
  var sb = Math.sin(b) * Math.cos(D) + Math.cos(b) * Math.sin(D) * Math.cos(A);
  var b2 = Math.asin(Math.max(-1, Math.min(1, sb)));
  var l2 = l + Math.atan2(Math.sin(A) * Math.sin(D) * Math.cos(b),
                          Math.cos(D) - Math.sin(b) * sb);
  return [l2 / D2R, b2 / D2R];
}

/* 楕円（正射影された円形の地形）の画面上の形を返す。z<=0 なら裏側。 */
function ellipse(lon, lat, rDeg, Rt, C) {
  var p = proj(lon, lat);
  if (p[2] <= 0.04) return null;
  var d = Math.acos(Math.min(1, p[2]));            /* 中心からの角距離 */
  var rho = rDeg * D2R * Rt;
  return { x:C + p[0] * Rt, y:C + p[1] * Rt,
           a:Math.max(0.4, rho * Math.cos(d)),     /* 動径方向は短縮される */
           b:Math.max(0.4, rho),
           rot:Math.atan2(p[1], p[0]), z:p[2], d:d / D2R };
}

/* =========================================================================
   アルベド図と起伏図
   ========================================================================= */
var faceCache = {};

/* 画素を直接読み書きできる環境かどうか（描画のみの代替環境では作らない） */
var canPixels = null;
function pixelsOK() {
  if (canPixels !== null) return canPixels;
  try {
    var t = el('canvas', { width:2, height:2 }).getContext('2d');
    var a = t.createImageData(2, 2), b = t.getImageData(0, 0, 2, 2);
    canPixels = !!(a && a.data && b && b.data && b.data.length === 16);
  } catch (err) { canPixels = false; }
  return canPixels;
}

function buildFace(N, dir) {
  if (!pixelsOK()) return null;
  var key = N + '|' + dir;
  if (faceCache[key]) return faceCache[key];
  var C = N / 2, Rt = N / 2 - 1;
  var ac = el('canvas', { width:N, height:N }), a = ac.getContext('2d');
  var rc = el('canvas', { width:N, height:N }), r = rc.getContext('2d');
  var rng = NS.rng('moonface-2');
  var BASE = 198;                                   /* 高地の明るさ */

  a.save(); a.beginPath(); a.arc(C, C, Rt, 0, 7); a.clip();
  a.fillStyle = 'rgb(' + BASE + ',' + BASE + ',' + (BASE + 4) + ')';
  a.fillRect(0, 0, N, N);
  r.fillStyle = 'rgb(128,128,128)'; r.fillRect(0, 0, N, N);
  r.save(); r.beginPath(); r.arc(C, C, Rt, 0, 7); r.clip();

  /* 大きな濃淡のむら（高地の中の明暗） */
  for (var i = 0; i < 90; i++) {
    var lo = (rng() - 0.5) * 180, la = Math.asin(rng() * 2 - 1) / D2R;
    var e0 = ellipse(lo, la, 4 + rng() * 14, Rt, C);
    if (!e0) continue;
    var v = (rng() - 0.5) * 0.10;
    blob(a, e0, 'rgba(' + (v > 0 ? '255,255,255,' : '0,0,0,') + Math.abs(v).toFixed(3) + ')');
  }

  /* 海（アルベドが低い）。円では月に見えないので、方位角ごとに半径をうねらせた
     閉曲線として描き、入り組んだ「海岸線」を作る。 */
  NS.MOON_MARIA.forEach(function (m) {
    var rr2 = NS.rng('mare' + m.lon + '_' + m.lat);
    var g = Math.round(BASE * m.k);
    var col = 'rgba(' + g + ',' + g + ',' + (g + 6) + ',';
    var pts = marePath(m, rr2, Rt, C);
    if (pts.length < 6) return;
    a.save();
    a.beginPath(); a.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) a.lineTo(pts[i][0], pts[i][1]);
    a.closePath();
    a.fillStyle = col + '0.94)'; a.fill();
    a.restore();
    /* 海の中の濃淡（噴出した時期の違い） */
    for (var j = 0; j < 3; j++) {
      var pp = offset(m.lon, m.lat, rr2() * 360, m.r * rr2() * 0.6);
      var e3 = ellipse(pp[0], pp[1], m.r * (0.25 + rr2() * 0.35), Rt, C);
      if (e3) blob(a, e3, 'rgba(' + (rr2() < 0.5 ? '255,255,255,0.04' : '0,0,0,0.05') + ')');
    }
    /* 海は周囲よりわずかに低い。輪郭に沿って細い段差を入れておく。 */
    r.save();
    r.beginPath(); r.moveTo(pts[0][0], pts[0][1]);
    for (var k2 = 1; k2 < pts.length; k2++) r.lineTo(pts[k2][0], pts[k2][1]);
    r.closePath();
    r.strokeStyle = dir > 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)';
    r.lineWidth = 1.6; r.stroke();
    r.restore();
  });

  /* 光条（若いクレーターから伸びる明るい筋）。海の上にも乗る。 */
  NS.MOON_CRATERS.forEach(function (c) {
    if (!c.ray) return;
    var rs = c.ray, rr = NS.rng('ray' + c.lon + c.lat);
    /* まわりの淡いにじみ（放出物の薄い覆い） */
    var halo = ellipse(c.lon, c.lat, rs.len * 0.30, Rt, C);
    if (halo) blob(a, halo, 'rgba(255,255,255,' + (rs.a * 0.55).toFixed(3) + ')', 0.02);
    for (var k = 0; k < rs.n * 3; k++) {
      var az = rs.az0 != null ? rs.az0 + (((rs.az1 - rs.az0) + 360) % 360) * (k + rr() * 0.8) / (rs.n * 3)
                              : rr() * 360;
      drawRay(a, c, az, rs.len * (0.25 + rr() * rr() * 1.1), rs.w * (0.22 + rr() * 0.7),
              rs.a * (0.22 + rr() * 0.45), Rt, C);
    }
  });

  /* クレーター：名前つき ＋ 小さいものを分布に従って撒く */
  /* 小さいクレーターを手前の半球に撒く。直径分布は N(>D) ∝ D^-1.8。
     画像の分解能で描ける下限（おおむね 1 px）より小さいものは作らない。 */
  var list = NS.MOON_CRATERS.slice();
  var dMin = Math.max(5, 2 * 1737.4 * 0.9 / Rt);
  var nSmall = Math.min(3000, Math.round(Rt * Rt / 46));
  for (var j = 0; j < nSmall; j++) {
    var z2 = rng(), rho = Math.sqrt(1 - z2 * z2), th2 = rng() * 2 * Math.PI;
    var X2 = rho * Math.cos(th2), Y2 = rho * Math.sin(th2);
    var la2 = Math.asin(-Y2) / D2R, lo2 = Math.atan2(-X2, z2) / D2R;
    /* 海は若いのでクレーターがまばら。高地は重なり合うほど多い。 */
    if (inMare(lo2, la2) && rng() < 0.88) continue;
    var d2 = dMin / Math.pow(rng(), 0.556);
    if (d2 > 120) continue;
    list.push({ lon:lo2, lat:la2, d:d2, b:1 + (rng() - 0.5) * 0.16, sm:true });
  }
  list.forEach(function (c) { drawCrater(a, r, c, dir, Rt, C, rng); });

  /* 山脈 */
  NS.MOON_RIDGES.forEach(function (m) { drawRidge(a, r, m, dir, Rt, C); });

  /* 細かいざらつき。小さなタイルを 1 枚作って敷き詰める（点を撒くより速い）。 */
  var nz = grainTile(rng);
  a.globalAlpha = 0.17; a.fillStyle = a.createPattern(nz, 'repeat');
  a.fillRect(0, 0, N, N); a.globalAlpha = 1;
  r.globalAlpha = 0.55; r.fillStyle = r.createPattern(nz, 'repeat');
  r.fillRect(0, 0, N, N); r.globalAlpha = 1;

  /* 起伏の細かいざらつき（明暗境界のぎざぎざになる） */
  for (var q = 0; q < 420; q++) {
    var lo3 = (rng() - 0.5) * 360, la3 = Math.asin(rng() * 2 - 1) / D2R;
    var e3 = ellipse(lo3, la3, 1.2 + rng() * 5, Rt, C);
    if (!e3) continue;
    var v3 = (rng() - 0.5) * 0.30;
    blob(r, e3, 'rgba(' + (v3 > 0 ? '255,255,255,' : '0,0,0,') + Math.abs(v3).toFixed(3) + ')');
  }
  a.restore(); r.restore();

  var out;
  try {
    out = { alb:a.getImageData(0, 0, N, N).data, rel:r.getImageData(0, 0, N, N).data, N:N };
  } catch (err) { return null; }                    /* 画素を読めない環境では作らない */
  faceCache = {}; faceCache[key] = out;             /* 1 枚だけ持てばよい */
  return out;
}

/* 海の輪郭。折れ線を Catmull–Rom で滑らかにつなぎ、少しゆらして海岸線らしくする。
   縁ぎりぎりの海は裏側へ回り込むので、その点は縁へ寄せる。 */
function catmull(a, b, c, d, t) {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                + (-a + 3 * b - 3 * c + d) * t * t * t);
}
function marePath(m, rr, Rt, C) {
  var P = m.poly, n = P.length, out = [], sub = 5;
  var jit = Math.min(1.6, m.r * 0.10);
  for (var i = 0; i < n; i++) {
    var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (var t = 0; t < sub; t++) {
      var u = t / sub;
      var lon = catmull(p0[0], p1[0], p2[0], p3[0], u) + (rr() - 0.5) * jit;
      var lat = catmull(p0[1], p1[1], p2[1], p3[1], u) + (rr() - 0.5) * jit;
      var q = proj(lon, lat);
      /* 裏側へ回った点は落とす。残りを結べば、縁に沿って切り取られた形になる。 */
      if (q[2] > 0.02) out.push([C + q[0] * Rt, C + q[1] * Rt]);
    }
  }
  return out;
}

/* ざらつきのタイル（灰色 128 を中心にした細かいむら） */
function grainTile(rng) {
  var N = 96, tc = el('canvas', { width:N, height:N }), g = tc.getContext('2d');
  var im = g.createImageData(N, N), d = im.data;
  for (var i = 0; i < d.length; i += 4) {
    var v = 128 + (rng() - 0.5) * 150;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 90;
  }
  g.putImageData(im, 0, 0);
  return tc;
}

/* 楕円に沿った、縁がなだらかな塗り */
function blob(g, e2, color, hard) {
  g.save();
  g.translate(e2.x, e2.y); g.rotate(e2.rot); g.scale(e2.a / e2.b, 1);
  var gr = g.createRadialGradient(0, 0, 0, 0, 0, e2.b);
  gr.addColorStop(0, color);
  gr.addColorStop(hard == null ? 0.45 : hard, color);
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, e2.b, 0, 7); g.fill();
  g.restore();
}

/* 起伏図に、光の側が明るく反対が暗い段差を描く（縁の斜面）。
   太陽は画面の左右どちらかにあるので、明暗は画面 x 方向に付ければよい。 */
function ring(g, e2, dir, amp) {
  var px = Math.max(e2.a, e2.b);
  var gr = g.createLinearGradient(e2.x - px, 0, e2.x + px, 0);
  gr.addColorStop(0, dir > 0 ? 'rgba(0,0,0,' + amp + ')' : 'rgba(255,255,255,' + amp + ')');
  gr.addColorStop(0.5, 'rgba(128,128,128,0)');
  gr.addColorStop(1, dir > 0 ? 'rgba(255,255,255,' + amp + ')' : 'rgba(0,0,0,' + amp + ')');
  g.save();
  g.beginPath(); g.ellipse(e2.x, e2.y, e2.a, e2.b, e2.rot, 0, 7);
  g.fillStyle = gr; g.fill();
  g.restore();
}

/* 海の中かどうか（小クレーターの密度を変えるのに使う） */
function inMare(lon, lat) {
  for (var i = 0; i < NS.MOON_MARIA.length; i++) {
    var m = NS.MOON_MARIA[i];
    var dl = (lon - m.lon) * Math.cos(lat * D2R), db = lat - m.lat;
    if (dl * dl + db * db < m.r * m.r) return true;
  }
  return false;
}

/* クレーター 1 個。アルベド図には底と縁の明暗を、起伏図には椀のかたちを描く。 */
function drawCrater(a, r, c, dir, Rt, C, rng) {
  var rDeg = c.d / 2 / 1737.4 / D2R;                /* 半径（km）→ 月面での角半径（度） */
  var e2 = ellipse(c.lon, c.lat, rDeg, Rt, C);
  if (!e2 || e2.b < 0.6) return;
  var px = Math.max(e2.a, e2.b);

  /* 底のアルベド */
  if (c.f != null || c.b != null) {
    var lvl = Math.round(198 * (c.f != null ? c.f : 1) * (c.b != null && c.f == null ? c.b : 1));
    lvl = Math.max(30, Math.min(252, lvl));
    a.save();
    a.beginPath(); a.ellipse(e2.x, e2.y, e2.a * 0.92, e2.b * 0.92, e2.rot, 0, 7);
    a.fillStyle = 'rgba(' + lvl + ',' + lvl + ',' + (lvl + 4) + ',' + (c.f != null ? 0.85 : 0.5) + ')';
    a.fill(); a.restore();
  }
  /* 縁は掘り出した物質で明るい */
  if (px > 1.2) {
    a.save();
    a.beginPath(); a.ellipse(e2.x, e2.y, e2.a * 1.22, e2.b * 1.22, e2.rot, 0, 7);
    a.strokeStyle = 'rgba(255,255,255,' + (c.b > 1 ? 0.20 : 0.10) + ')';
    a.lineWidth = Math.max(0.7, px * 0.22);
    a.stroke(); a.restore();
  }
  /* 起伏：光の側の内壁が暗く、反対の内壁が明るい（椀の底の影） */
  var gr = r.createLinearGradient(e2.x - px, 0, e2.x + px, 0);
  var lit = 'rgba(255,255,255,0.62)', shd = 'rgba(0,0,0,0.62)';
  gr.addColorStop(0, dir > 0 ? lit : shd);
  gr.addColorStop(0.46, 'rgba(128,128,128,0)');
  gr.addColorStop(0.54, 'rgba(128,128,128,0)');
  gr.addColorStop(1, dir > 0 ? shd : lit);
  r.save();
  r.beginPath(); r.ellipse(e2.x, e2.y, e2.a, e2.b, e2.rot, 0, 7);
  r.fillStyle = gr; r.fill();
  /* 外側の縁（盛り上がり）は内壁と逆向きの明暗になる */
  var gr2 = r.createLinearGradient(e2.x - px * 1.3, 0, e2.x + px * 1.3, 0);
  gr2.addColorStop(0, dir > 0 ? shd : lit);
  gr2.addColorStop(0.5, 'rgba(128,128,128,0)');
  gr2.addColorStop(1, dir > 0 ? lit : shd);
  r.globalAlpha = 0.5;
  r.beginPath();
  r.ellipse(e2.x, e2.y, e2.a * 1.3, e2.b * 1.3, e2.rot, 0, 7);
  r.ellipse(e2.x, e2.y, e2.a, e2.b, e2.rot, 0, 7, true);
  r.fillStyle = gr2; r.fill('evenodd');
  r.restore();
  if (rng && !c.sm && px > 6) {                     /* 大きいものには中央丘 */
    var cp = ellipse(c.lon, c.lat, rDeg * 0.16, Rt, C);
    if (cp) ring(r, cp, dir, 0.5);
  }
}

/* 光条 1 本。大円に沿って点を取り、外へ向かって細く薄くする。 */
function drawRay(a, c, az, len, wDeg, alpha, Rt, C) {
  var n = 9, prev = null;
  for (var i = 0; i <= n; i++) {
    var d = len * i / n;
    var p = offset(c.lon, c.lat, az, d);
    var q = proj(p[0], p[1]);
    if (q[2] <= 0.05) break;
    var s = [C + q[0] * Rt, C + q[1] * Rt];
    if (prev) {
      var t = i / n;
      a.beginPath(); a.moveTo(prev[0], prev[1]); a.lineTo(s[0], s[1]);
      a.strokeStyle = 'rgba(255,255,255,' + (alpha * (1 - t) * (1 - t * 0.5)).toFixed(3) + ')';
      a.lineWidth = Math.max(0.6, wDeg * D2R * Rt * (1 - t * 0.4));
      a.lineCap = 'round';
      a.stroke();
    }
    prev = s;
  }
}

/* 山脈：折れ線をぎざぎざに刻み、太陽の側を明るく反対側を暗くした帯として描く。
   月面の山は影で見えるものなので、アルベドはごくわずかに明るくするだけにする。 */
function drawRidge(a, r, m, dir, Rt, C) {
  var rr = NS.rng('rdg' + m.name);
  var seg = m.pts.length - 1, n = seg * 16, pts = [], lat = 0;
  for (var i = 0; i <= n; i++) {
    var u = i / n * seg, k = Math.min(seg - 1, Math.floor(u)), t = u - k;
    var lon = m.pts[k][0] + (m.pts[k + 1][0] - m.pts[k][0]) * t + (rr() - 0.5) * m.w * 0.7;
    lat = m.pts[k][1] + (m.pts[k + 1][1] - m.pts[k][1]) * t + (rr() - 0.5) * m.w * 0.7;
    var q = proj(lon, lat);
    if (q[2] <= 0.05) return;
    pts.push([C + q[0] * Rt, C + q[1] * Rt]);
  }
  var w = Math.max(1.2, m.w * D2R * Rt * 0.75);
  function stroke(g, dx, col, lw) {
    g.save();
    g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1]);
    for (var j = 1; j < pts.length; j++) g.lineTo(pts[j][0] + dx, pts[j][1]);
    g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke(); g.restore();
  }
  stroke(a, 0, 'rgba(255,255,255,' + ((m.b - 1) * 0.30).toFixed(3) + ')', w * 1.6);
  stroke(r, dir > 0 ? w * 0.42 : -w * 0.42, 'rgba(255,255,255,0.44)', w * 0.9);
  stroke(r, dir > 0 ? -w * 0.42 : w * 0.42, 'rgba(0,0,0,0.44)', w * 0.9);
}

/* =========================================================================
   実データの地図（NASA/GSFC SVS「CGI Moon Kit」より、表側 ±105° を切り出したもの）
     lroc-albedo.jpg … LRO / LROC 広角カメラ（WAC）の全球モザイク（実写）
     lola-slope.jpg  … LRO / LOLA の地形から求めた斜面（R = 東向き, G = 北向き）
   読み込めたらこちらを使い、読み込めない間は上の手描き地形で代用する。
   ========================================================================= */
var MOON_BASE = (function () {
  var sc = document.currentScript && document.currentScript.src;
  return sc ? sc.replace(/js\/moon\.js.*$/, '') : '';
})();
NS.MOON_MAP = { lonHalf:105, slopeK:0.5, state:'idle', alb:null, slp:null };

function grabPixels(img) {
  var c = el('canvas', { width:img.naturalWidth, height:img.naturalHeight });
  var g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  return { w:c.width, h:c.height, d:g.getImageData(0, 0, c.width, c.height).data };
}

/* 地図を読み込む。読み終わったら cb を呼ぶ（失敗しても呼ぶ）。 */
NS.loadMoonMaps = function (cb) {
  var M = NS.MOON_MAP;
  if (M.state === 'ready' || M.state === 'fail') { if (cb) cb(); return; }
  if (M.state === 'loading') { M.cbs.push(cb); return; }
  if (!pixelsOK()) { M.state = 'fail'; if (cb) cb(); return; }
  M.state = 'loading'; M.cbs = [cb];
  var left = 2, bad = false;
  function done() {
    if (--left > 0) return;
    M.state = (bad || !M.alb || !M.slp) ? 'fail' : 'ready';
    imgCache = {};                                   /* 地図が入れ替わるので作り直す */
    M.cbs.forEach(function (f) { if (f) f(); });
    M.cbs = [];
  }
  [['alb', 'lroc-albedo.jpg'], ['slp', 'lola-slope.jpg']].forEach(function (v) {
    var im = new Image();
    im.onload = function () { try { M[v[0]] = grabPixels(im); } catch (e) { bad = true; } done(); };
    im.onerror = function () { bad = true; done(); };
    im.src = MOON_BASE + 'assets/moon/' + v[1];
  });
};

/* =========================================================================
   陰影づけ：太陽の当たり方を計算して 1 枚の画像にする
   fI は輝面比（0–1）、waxing が真なら西（画面右）が光る。
   ========================================================================= */
var imgCache = {};

NS.moonImage = function (N, fI, waxing, onReady) {
  N = Math.max(40, Math.min(1000, Math.round(N)));
  var M = NS.MOON_MAP;
  if (M.state === 'idle') NS.loadMoonMaps(onReady);   /* 実データの地図を取りにいく */
  var real = M.state === 'ready';
  var key = N + '|' + Math.round(fI * 400) + '|' + (waxing ? 1 : 0) + '|' + (real ? 'r' : 'p');
  if (imgCache.key === key) return imgCache.cv;

  var dir = waxing ? 1 : -1;                         /* 太陽のある側（＋1 = 画面右） */
  var face = real ? null : buildFace(N, dir);
  if (!real && !face) return null;
  var C = N / 2, Rt = N / 2 - 1;
  var cosA = Math.max(-1, Math.min(1, 2 * fI - 1));  /* 位相角 α：cos α = 2f−1 */
  var sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  var sx = dir * sinA, sz = cosA;                    /* 太陽の向き（月の中心から見た単位ベクトル） */
  var EARTH = 0.105;                                 /* 地球照（昼側を 1 としたときの明るさ） */
  var SLOPE = 0.52;                                  /* 手描き起伏図の値を斜面の傾きに直す係数 */

  var cv = el('canvas', { width:N, height:N }), g = cv.getContext('2d');
  var img;
  try { img = g.createImageData(N, N); } catch (err) { return null; }
  if (!img || !img.data) return null;
  var o = img.data;
  var alb = real ? M.alb : face.alb, slp = real ? M.slp : null, rel = real ? null : face.rel;
  var AW = real ? M.alb.w : 0, AH = real ? M.alb.h : 0, AD = real ? M.alb.d : null;
  var SW = real ? M.slp.w : 0, SH = real ? M.slp.h : 0, SD = real ? M.slp.d : null;
  var LH = M.lonHalf * D2R, K = M.slopeK, GAIN = 1.18;   /* 地図の輝度を高地が 200 前後になるよう合わせる */

  for (var y = 0; y < N; y++) {
    var Y = (y + 0.5 - C) / Rt, Y2 = Y * Y;
    for (var x = 0; x < N; x++) {
      var i = (y * N + x) * 4;
      var X = (x + 0.5 - C) / Rt, s2 = X * X + Y2;
      if (s2 >= 1) { o[i + 3] = 0; continue; }
      var Z = Math.sqrt(1 - s2);
      var mu = Z;                                    /* 視線方向の余弦 */
      var mu0 = sx * X + sz * Z;                     /* 太陽光の入射余弦（平らな面） */
      var lum;

      if (real) {
        /* 画面座標から月面座標へ。緯度 β = asin(−Y)、経度 λ = atan2(−X, Z)。 */
        var lat = Math.asin(Math.max(-1, Math.min(1, -Y)));
        var lon = Math.atan2(-X, Z);
        var u = (lon + LH) / (2 * LH), v = (Math.PI / 2 - lat) / Math.PI;
        lum = sample1(AD, AW, AH, u, v) * GAIN;
        /* 斜面（東向き gx・北向き gy）から入射角を直す */
        var gx = (sample3(SD, SW, SH, u, v, 0) - 128) / 127 * K;
        var gy = (sample3(SD, SW, SH, u, v, 1) - 128) / 127 * K;
        var c2 = Math.sqrt(Math.max(1e-6, 1 - Y2));  /* cos β */
        var sE = sx * (-Z / c2) + sz * (X / c2);     /* 太陽の東向き成分 */
        var sN = sx * (X * Y / c2) + sz * (Y * Z / c2);
        mu0 = (mu0 - gx * sE - gy * sN) / Math.sqrt(1 + gx * gx + gy * gy);
      } else {
        var gsl = (rel[i] - 128) / 128;
        mu0 += gsl * SLOPE * Math.sqrt(Math.max(0, 1 - mu0 * mu0));
        lum = alb[i];
      }

      var sh = mu0 > 0 ? 2 * mu0 / (mu0 + mu) : 0;   /* Lommel–Seeliger */
      /* そのままだと縁（μ→0）で明るくなりすぎる。実際の月面は細かい凹凸だらけで、
         斜めから見るほど影が見えるぶん暗くなるので、その効果を掛けておく。 */
      sh *= 0.60 + 0.40 * Math.pow(mu, 0.6);
      if (sh > 1.22) sh = 1.22;
      if (sh < EARTH) sh = EARTH;                    /* 夜側・影は地球照が下限 */
      var val = lum * sh * 0.98;
      if (val > 255) val = 255;
      o[i] = val; o[i + 1] = val; o[i + 2] = real ? val : Math.min(255, alb[i + 2] * sh * 0.98);
      /* 縁は 1 px ぶんなめらかに落とす */
      o[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - Math.sqrt(s2)) * Rt)));
    }
  }
  g.putImageData(img, 0, 0);
  imgCache = { key:key, cv:cv };
  return cv;
};

/* 地図の双一次補間。u・v は 0–1。sample1 は輝度、sample3 は指定チャンネル。 */
function sample3(d, w, h, u, v, ch) {
  var fx = u * (w - 1), fy = v * (h - 1);
  var x0 = fx | 0, y0 = fy | 0;
  if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
  var x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0;
  var tx = fx - x0, ty = fy - y0;
  var a = d[(y0 * w + x0) * 4 + ch], b = d[(y0 * w + x1) * 4 + ch];
  var c = d[(y1 * w + x0) * 4 + ch], e2 = d[(y1 * w + x1) * 4 + ch];
  return (a + (b - a) * tx) + ((c + (e2 - c) * tx) - (a + (b - a) * tx)) * ty;
}
function sample1(d, w, h, u, v) { return sample3(d, w, h, u, v, 0); }

})(NS);
