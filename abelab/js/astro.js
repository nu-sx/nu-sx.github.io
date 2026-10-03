/* NU-AbeLab / 天文計算
   太陽・月の位置、薄明と暗夜の時刻、地平座標への変換、主要流星群の輻射点。
   精度は低精度式（Meeus 簡約）で、観測計画と模擬データの変調に使う程度のもの。 */
'use strict';
(function (AL) {

var D2R = AL.d2r, R2D = AL.r2d;
AL.jd = function (t) { return t / 86400000 + 2440587.5; };
AL.jc = function (t) { return (AL.jd(t) - 2451545.0) / 36525; };

/* ---- 太陽（黄経 = 流星群で使う太陽黄経） ---- */
AL.sun = function (t) {
  var n = AL.jd(t) - 2451545.0;
  var L = (280.460 + 0.9856474 * n) % 360;
  var g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g) + 360) % 360;
  var eps = (23.439 - 0.0000004 * n) * D2R, lr = lam * D2R;
  return {
    lon: lam,                                            /* 太陽黄経 [deg] */
    ra: (Math.atan2(Math.cos(eps) * Math.sin(lr), Math.cos(lr)) * R2D + 360) % 360,
    dec: Math.asin(Math.sin(eps) * Math.sin(lr)) * R2D
  };
};
/* ---- 月（低精度。主要項のみ） ---- */
AL.moon = function (t) {
  var n = AL.jd(t) - 2451545.0;
  var Lp = (218.316 + 13.176396 * n) % 360;
  var M  = ((134.963 + 13.064993 * n) % 360) * D2R;
  var F  = ((93.272 + 13.229350 * n) % 360) * D2R;
  var lam = (Lp + 6.289 * Math.sin(M) + 360) % 360;
  var bet = 5.128 * Math.sin(F);
  var eps = 23.439 * D2R, lr = lam * D2R, br = bet * D2R;
  var ra = Math.atan2(Math.sin(lr) * Math.cos(eps) - Math.tan(br) * Math.sin(eps), Math.cos(lr)) * R2D;
  var dec = Math.asin(Math.sin(br) * Math.cos(eps) + Math.cos(br) * Math.sin(eps) * Math.sin(lr)) * R2D;
  var s = AL.sun(t);
  var elong = Math.acos(Math.cos(br) * Math.cos((lam - s.lon) * D2R));   /* 離角 */
  return {
    ra: (ra + 360) % 360, dec: dec,
    illum: (1 - Math.cos(elong)) / 2,                    /* 輝面比 0–1 */
    age: ((lam - s.lon + 360) % 360) / 360 * 29.530589   /* 月齢 [日] */
  };
};
/* ---- 地方恒星時・地平座標 ---- */
AL.lst = function (t, lonDeg) {
  var g = 280.46061837 + 360.98564736629 * (AL.jd(t) - 2451545.0);
  return ((g + lonDeg) % 360 + 360) % 360;
};
AL.altaz = function (raDeg, decDeg, latDeg, lonDeg, t) {
  var ha = (AL.lst(t, lonDeg) - raDeg) * D2R;
  var d = decDeg * D2R, la = latDeg * D2R;
  var sa = Math.sin(d) * Math.sin(la) + Math.cos(d) * Math.cos(la) * Math.cos(ha);
  sa = AL.clamp(sa, -1, 1);
  var alt = Math.asin(sa) * R2D;
  var az = Math.atan2(-Math.cos(d) * Math.sin(ha), Math.sin(d) * Math.cos(la) - Math.cos(d) * Math.sin(la) * Math.cos(ha)) * R2D;
  return { alt: alt, az: (az + 360) % 360 };
};
AL.sunAlt = function (t, lat, lon) { var s = AL.sun(t); return AL.altaz(s.ra, s.dec, lat, lon, t).alt; };
AL.moonAlt = function (t, lat, lon) { var m = AL.moon(t); return AL.altaz(m.ra, m.dec, lat, lon, t).alt; };

/* ---- その夜の時刻表 ----
   DIMS の運用に合わせ、観測は日没 30 分後から日の出 30 分前まで。
   暗夜（dark night）は天文薄明の外で、かつ月が出ていない時間。 */
AL.night = function (tRef, st) {
  var key = 'n' + AL.nightOf(tRef) + st.id;
  if (AL._nc && AL._nc[key]) return AL._nc[key];
  var noon = AL.nightOf(tRef);                      /* その夜の始まり（正午 JST） */
  var t0 = noon, t1 = noon + 24 * 3600e3, step = 120e3;
  var prevS = AL.sunAlt(t0, st.lat, st.lon), prevM = AL.moonAlt(t0, st.lat, st.lon);
  var sunset = null, sunrise = null, duskEnd = null, dawnStart = null;
  var moonUp = [], moonOpen = null, dark = 0, obs = 0;
  for (var t = t0 + step; t <= t1; t += step) {
    var s = AL.sunAlt(t, st.lat, st.lon), m = AL.moonAlt(t, st.lat, st.lon);
    if (prevS > -0.833 && s <= -0.833 && sunset == null) sunset = t;
    if (prevS <= -0.833 && s > -0.833 && sunset != null && sunrise == null) sunrise = t;
    if (prevS > -18 && s <= -18 && duskEnd == null) duskEnd = t;
    if (prevS <= -18 && s > -18 && duskEnd != null && dawnStart == null) dawnStart = t;
    if (prevM <= 0 && m > 0) moonOpen = t;
    if (prevM > 0 && m <= 0) { moonUp.push([moonOpen == null ? t0 : moonOpen, t]); moonOpen = null; }
    if (s < -18) { dark += step / 3600e3 * (m > 0 ? 0 : 1); }
    prevS = s; prevM = m;
  }
  if (moonOpen != null) moonUp.push([moonOpen, t1]);
  var obsStart = sunset == null ? null : sunset + 30 * 60e3;
  var obsEnd = sunrise == null ? null : sunrise - 30 * 60e3;
  if (obsStart != null && obsEnd != null) obs = (obsEnd - obsStart) / 3600e3;
  var r = { noon: noon, sunset: sunset, sunrise: sunrise, duskEnd: duskEnd, dawnStart: dawnStart,
            obsStart: obsStart, obsEnd: obsEnd, obsHours: obs, darkHours: dark, moonUp: moonUp,
            moon: AL.moon(noon + 18 * 3600e3) };
  (AL._nc || (AL._nc = {}))[key] = r;
  return r;
};
/* 観測時間帯か（日没 30 分後〜日の出 30 分前） */
AL.isObsTime = function (t, st) {
  var n = AL.night(t, st);
  return n.obsStart != null && t >= n.obsStart && t <= n.obsEnd;
};

/* ---- 主要流星群（IMO Working List の代表値） ----
   [略号, 和名, 極大の太陽黄経, 輻射点 RA, Dec, ZHR, 対地速度 km/s, 活動幅 σ(deg)] */
AL.SHOWERS = [
  ['QUA', 'しぶんぎ座',      283.15, 230.1,  49.5, 110, 41, 0.6],
  ['LYR', 'こと座',           32.32, 271.4,  33.6,  18, 49, 1.3],
  ['ETA', 'みずがめ座η',      45.50, 338.0,  -1.0,  50, 66, 4.5],
  ['SDA', 'みずがめ座δ南',   125.00, 340.0, -16.0,  25, 41, 4.0],
  ['CAP', 'やぎ座α',         127.00, 307.0, -10.0,   5, 23, 5.0],
  ['PER', 'ペルセウス座',     140.00,  48.2,  58.1, 100, 59, 2.0],
  ['KCG', 'はくちょう座κ',   140.80, 286.0,  59.0,   3, 25, 3.0],
  ['STA', 'おうし座南',       196.00,  32.0,   9.0,   5, 27, 8.0],
  ['ORI', 'オリオン座',       208.00,  95.2,  15.8,  20, 66, 3.0],
  ['NTA', 'おうし座北',       230.00,  58.0,  22.0,   5, 29, 8.0],
  ['LEO', 'しし座',           235.27, 152.3,  21.6,  15, 71, 1.0],
  ['GEM', 'ふたご座',         262.20, 113.5,  32.3, 150, 35, 1.6],
  ['URS', 'こぐま座',         270.70, 217.0,  75.4,  10, 33, 0.6]
];
/* 太陽黄経 lam における群の活動度（ZHR 相当）。極大を中心としたガウス型で近似 */
AL.showerZHR = function (sh, lam) {
  var d = ((lam - sh[2] + 540) % 360) - 180;
  return sh[5] * Math.exp(-(d * d) / (2 * sh[7] * sh[7]));
};
/* その時刻に「活動中」とみなせる群（ZHR が極大の 5 % 以上） */
AL.activeShowers = function (t) {
  var lam = AL.sun(t).lon;
  return AL.SHOWERS.map(function (sh) {
    return { sh: sh, id: sh[0], name: sh[1], zhr: AL.showerZHR(sh, lam), peak: sh[2], v: sh[6] };
  }).filter(function (x) { return x.zhr > x.sh[5] * 0.05; })
    .sort(function (a, b) { return b.zhr - a.zhr; });
};
/* 群の輻射点高度（出ていなければ負） */
AL.radiantAlt = function (sh, st, t) { return AL.altaz(sh[3], sh[4], st.lat, st.lon, t).alt; };

/* ---- 空の明るさ（模擬）----
   その局の本来の夜空輝度に、月明かりと薄明の寄与を足して SQM 相当を返す。 */
AL.skyBrightness = function (t, st) {
  var sAlt = AL.sunAlt(t, st.lat, st.lon);
  var m = AL.moon(t), mAlt = AL.altaz(m.ra, m.dec, st.lat, st.lon, t).alt;
  var sqm = st.sqm;
  if (mAlt > 0) sqm -= 3.6 * Math.pow(m.illum, 1.7) * Math.pow(Math.sin(mAlt * D2R), 0.5);
  if (sAlt > -18) sqm -= AL.clamp((sAlt + 18) / 18, 0, 1) * 6.0;
  return { sqm: sqm, sunAlt: sAlt, moonAlt: mAlt, illum: m.illum, age: m.age };
};

})(AL);
