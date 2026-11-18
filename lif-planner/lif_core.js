/* lif_core.js — 月面衝突閃光 流星群観測シミュレータ 計算コア
   依存: astronomy-engine (global Astronomy)  — ブラウザ / node 両用
   © 2026 Abe Laboratory, Nihon University */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./astronomy.browser.min.js'));
  else root.LIF = factory(root.Astronomy);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const AU_KM = 149597870.7, R_MOON = 1737.4, V_ESC_EARTH = 11.1 /* 100 km 高度 */, V_ESC_MOON = 2.38;
  const V_ESC_EARTH_AT_MOON = 1.44; // 月の距離 (384 400 km) での地球の脱出速度 [km/s]
  const EPS0 = 23.4392911 * D2R;

  // ---------- 観測地 ----------
  const SITES = [
    { id: 'nihon', name: '日本大学理工学部 船橋 (GUNDAM 40 cm)', en: 'Nihon University, Funabashi (GUNDAM 40 cm)', lat: 35.7253, lon: 140.0589, elev: 20, tz: 9 },
    { id: 'okayama', name: '岡山天文台 (せいめい望遠鏡)', en: 'Okayama Observatory (Seimei Telescope)', lat: 34.5769, lon: 133.5956, elev: 355, tz: 9 },
    { id: 'lulin', name: '鹿林天文台 (台湾)', en: 'Lulin Observatory (Taiwan)', lat: 23.4686, lon: 120.8736, elev: 2862, tz: 8 },
    { id: 'haleakala', name: 'ハレアカラ天文台 (ハワイ)', en: 'Haleakalā Observatory (Hawaii)', lat: 20.7075, lon: -156.2567, elev: 3055, tz: -10 },
    { id: 'nice', name: 'ニース天文台 (Mont Gros, フランス)', en: 'Nice Observatory (Mont Gros, France)', lat: 43.7275, lon: 7.3006, elev: 372, tz: 1 },
    { id: 'lowell', name: 'ローウェル天文台 (Flagstaff, USA)', en: 'Lowell Observatory (Flagstaff, USA)', lat: 35.2029, lon: -111.6653, elev: 2210, tz: -7 },
    { id: 'kryoneri', name: 'Kryoneri 1.2 m (NELIOTA, ギリシャ)', en: 'Kryoneri 1.2 m (NELIOTA, Greece)', lat: 37.9725, lon: 22.6186, elev: 930, tz: 2 },
    { id: 'custom', name: '任意の地点 (下の欄に入力)', en: 'Custom site (enter below)', lat: 35.0, lon: 135.0, elev: 0, tz: 9 },
  ];

  // ---------- 流星群 (IMO Meteor Shower Calendar 2026, Table 5/6) ----------
  // ra/dec: 極大時の輻射点 (J2000, 度). dra/ddec: 日周ドリフト (度/日, Table 6 から算出)
  // bm/bp: 極大前/後の活動プロファイル指数 B [/deg λ⊙] (Jenniskens 1994 ほか; 不明は 0.2)
  // zhr が 'Var' の群は仮の値 (varNote)
  // 月面衝突閃光の実測がある群だけに付く値 (GEM: Abe et al., A&A 原稿 "LIF Geminids 2018–2025"):
  //   sCm: cm サイズ (≳10 g) まで通用する質量指数 (最尤 1.76 ± 0.17)。あれば 1 + 2.5 log r の代わりに使う
  //   vg:  地心速度 Vg [km/s] (Jenniskens+ 2016)。あれば sqrt(V∞² − v_esc²) の代わりに使う
  //   rho: 流星体のバルク密度 [kg/m³] (Babadzhanov & Kokhirova 2009 の 2900 ± 600 を丸めた値)
  const SHOWERS = [
    { code: 'QUA', name: 'しぶんぎ座流星群 Quadrantids', act: 'Dec 28–Jan 12', lam: 283.15, ra: 230, dec: 49, dra: 0.6, ddec: -0.2, v: 41, r: 2.1, zhr: 80, bm: 2.5, bp: 2.5 },
    { code: 'GUM', name: 'γ-Ursae Minorids', act: 'Jan 10–Jan 22', lam: 298, ra: 228, dec: 67, dra: 0.8, ddec: -0.4, v: 31, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'ACE', name: 'α-Centaurids', act: 'Jan 31–Feb 20', lam: 319.4, ra: 211, dec: -58, dra: 1.19, ddec: -0.29, v: 58, r: 2.0, zhr: 6, bm: 0.2, bp: 0.2 },
    { code: 'LYR', name: '4月こと座流星群 April Lyrids', act: 'Apr 14–Apr 30', lam: 32.32, ra: 271, dec: 34, dra: 1.07, ddec: 0.0, v: 49, r: 2.1, zhr: 18, bm: 0.22, bp: 0.22 },
    { code: 'PPU', name: 'π-Puppids', act: 'Apr 15–Apr 28', lam: 33.5, ra: 110, dec: -45, dra: 0.5, ddec: -0.1, v: 18, r: 2.0, zhr: 5, varNote: true, bm: 0.5, bp: 0.5 },
    { code: 'ETA', name: 'みずがめ座η流星群 η-Aquariids', act: 'Apr 19–May 28', lam: 45.5, ra: 338, dec: -1, dra: 0.86, ddec: 0.4, v: 66, r: 2.4, zhr: 50, bm: 0.08, bp: 0.08 },
    { code: 'ELY', name: 'η-Lyrids', act: 'May 03–May 14', lam: 50.0, ra: 291, dec: 43, dra: 1.0, ddec: 0.1, v: 43, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'ARI', name: '昼間おひつじ座流星群 Daytime Arietids', act: 'May 14–Jun 24', lam: 76.7, ra: 43, dec: 24, dra: 1.0, ddec: 0.0, v: 38, r: 2.8, zhr: 30, bm: 0.1, bp: 0.1 },
    { code: 'JBO', name: 'June Bootids', act: 'Jun 22–Jul 02', lam: 90.3, ra: 221, dec: 48, dra: 0.2, ddec: -0.2, v: 18, r: 2.2, zhr: 5, varNote: true, bm: 0.5, bp: 0.5 },
    { code: 'JPE', name: 'July Pegasids', act: 'Jul 01–Jul 20', lam: 108.0, ra: 347, dec: 11, dra: 0.87, ddec: 0.2, v: 63, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'GDR', name: 'July γ-Draconids', act: 'Jul 25–Jul 31', lam: 125.13, ra: 280, dec: 51, dra: 1.0, ddec: 0.0, v: 27, r: 3.0, zhr: 5, bm: 1.0, bp: 1.0 },
    { code: 'SDA', name: 'みずがめ座δ南流星群 S. δ-Aquariids', act: 'Jul 12–Aug 23', lam: 128, ra: 340, dec: -16, dra: 0.76, ddec: 0.2, v: 41, r: 2.5, zhr: 25, bm: 0.091, bp: 0.091 },
    { code: 'CAP', name: 'やぎ座α流星群 α-Capricornids', act: 'Jul 03–Aug 15', lam: 128, ra: 307, dec: -10, dra: 0.92, ddec: 0.28, v: 23, r: 2.5, zhr: 5, bm: 0.041, bp: 0.041 },
    { code: 'ERI', name: 'η-Eridanids', act: 'Jul 31–Aug 19', lam: 135, ra: 41, dec: -11, dra: 0.87, ddec: 0.33, v: 64, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'PER', name: 'ペルセウス座流星群 Perseids', act: 'Jul 17–Aug 24', lam: 140.0, ra: 48, dec: 58, dra: 1.39, ddec: 0.2, v: 59, r: 2.2, zhr: 100, bm: 0.2, bp: 0.2 },
    { code: 'KCG', name: 'κ-Cygnids', act: 'Aug 03–Aug 28', lam: 144, ra: 286, dec: 59, dra: 0.48, ddec: 0.68, v: 23, r: 3.0, zhr: 3, bm: 0.069, bp: 0.069 },
    { code: 'AUR', name: 'ぎょしゃ座流星群 Aurigids', act: 'Aug 28–Sep 05', lam: 158.6, ra: 91, dec: 39, dra: 1.06, ddec: -0.06, v: 66, r: 2.5, zhr: 6, bm: 0.19, bp: 0.19 },
    { code: 'SPE', name: '9月ペルセウス座ε流星群 Sep. ε-Perseids', act: 'Sep 05–Sep 21', lam: 166.7, ra: 48, dec: 40, dra: 1.07, ddec: 0.07, v: 64, r: 2.5, zhr: 8, bm: 0.2, bp: 0.2 },
    { code: 'SLY', name: 'Sep. Lyncids', act: 'Sep 10–Oct 08', lam: 170, ra: 113, dec: 56, dra: 1.33, ddec: -0.2, v: 60, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'DSX', name: '昼間ろくぶんぎ座流星群 Daytime Sextantids', act: 'Sep 20–Oct 06', lam: 188, ra: 156, dec: -2, dra: 0.8, ddec: 0.0, v: 32, r: 2.5, zhr: 5, bm: 0.1, bp: 0.1 },
    { code: 'OCT', name: 'Oct. Camelopardalids', act: 'Oct 05–Oct 06', lam: 192.58, ra: 164, dec: 79, dra: 0.0, ddec: 0.0, v: 47, r: 2.5, zhr: 5, bm: 3.0, bp: 3.0 },
    { code: 'DRA', name: 'りゅう座流星群 Draconids', act: 'Oct 06–Oct 10', lam: 195.4, ra: 262, dec: 54, dra: 0.0, ddec: 0.0, v: 20, r: 2.6, zhr: 5, bm: 3.0, bp: 3.0 },
    { code: 'EGE', name: 'ε-Geminids', act: 'Oct 14–Oct 27', lam: 205, ra: 102, dec: 27, dra: 1.0, ddec: 0.0, v: 70, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'ORI', name: 'オリオン座流星群 Orionids', act: 'Oct 02–Nov 07', lam: 208, ra: 95, dec: 16, dra: 0.65, ddec: 0.1, v: 66, r: 2.5, zhr: 20, bm: 0.12, bp: 0.12 },
    { code: 'LMI', name: 'Leonis Minorids', act: 'Oct 19–Oct 27', lam: 211, ra: 162, dec: 37, dra: 1.0, ddec: -0.4, v: 62, r: 3.0, zhr: 2, bm: 0.2, bp: 0.2 },
    { code: 'STA', name: 'おうし座南流星群 S. Taurids', act: 'Sep 20–Nov 20', lam: 223, ra: 52, dec: 15, dra: 0.75, ddec: 0.18, v: 27, r: 2.3, zhr: 7, bm: 0.026, bp: 0.026 },
    { code: 'NTA', name: 'おうし座北流星群 N. Taurids', act: 'Oct 20–Dec 10', lam: 230, ra: 58, dec: 22, dra: 1.03, ddec: 0.08, v: 29, r: 2.3, zhr: 5, bm: 0.026, bp: 0.026 },
    { code: 'LEO', name: 'しし座流星群 Leonids', act: 'Nov 06–Nov 30', lam: 235.27, ra: 152, dec: 22, dra: 0.6, ddec: -0.25, v: 71, r: 2.5, zhr: 15, bm: 0.55, bp: 0.55 },
    { code: 'AMO', name: 'いっかくじゅう座α流星群 α-Monocerotids', act: 'Nov 15–Nov 25', lam: 239.32, ra: 117, dec: 1, dra: 0.8, ddec: -0.2, v: 65, r: 2.4, zhr: 5, varNote: true, bm: 4.0, bp: 4.0 },
    { code: 'NOO', name: 'Nov. Orionids', act: 'Nov 13–Dec 06', lam: 246, ra: 91, dec: 16, dra: 0.7, ddec: 0.0, v: 44, r: 3.0, zhr: 3, bm: 0.2, bp: 0.2 },
    { code: 'PHO', name: 'ほうおう座流星群 Phoenicids', act: 'Dec 01–Dec 05', lam: 249.5, ra: 8, dec: -27, dra: 0.6, ddec: -0.1, v: 15, r: 2.8, zhr: 3, varNote: true, bm: 1.0, bp: 1.0 },
    { code: 'PUP', name: 'Puppid-Velids', act: 'Dec 01–Dec 15', lam: 255, ra: 123, dec: -45, dra: 0.6, ddec: 0.0, v: 44, r: 2.9, zhr: 10, bm: 0.1, bp: 0.1 },
    { code: 'MON', name: 'いっかくじゅう座流星群 Monocerotids', act: 'Dec 01–Dec 19', lam: 257, ra: 100, dec: 8, dra: 0.85, ddec: -0.05, v: 41, r: 3.0, zhr: 3, bm: 0.25, bp: 0.25 },
    { code: 'HYD', name: 'うみへび座σ流星群 σ-Hydrids', act: 'Dec 03–Dec 20', lam: 257, ra: 125, dec: 2, dra: 0.8, ddec: -0.2, v: 58, r: 3.0, zhr: 7, bm: 0.1, bp: 0.1 },
    { code: 'GEM', name: 'ふたご座流星群 Geminids', act: 'Dec 04–Dec 20', lam: 262.2, ra: 112, dec: 33, dra: 1.0, ddec: -0.07, v: 35, r: 2.6, zhr: 150, bm: 0.59, bp: 0.81, sCm: 1.76, sCmErr: 0.17, vg: 33.8, rho: 3000 },
    { code: 'COM', name: 'かみのけ座流星群 Comae Berenicids', act: 'Dec 04–Jan 30', lam: 271, ra: 164, dec: 29, dra: 0.88, ddec: -0.36, v: 65, r: 3.0, zhr: 3, bm: 0.1, bp: 0.1 },
    { code: 'URS', name: 'こぐま座流星群 Ursids', act: 'Dec 17–Dec 26', lam: 270.7, ra: 217, dec: 76, dra: 0.0, ddec: -0.4, v: 33, r: 2.8, zhr: 10, bm: 0.9, bp: 0.9 },
  ];

  // ---------- ベクトル ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mulMV = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
  const transpose = M => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
  const mulMM = (P, Q) => { const T = transpose(Q); return [0, 1, 2].map(i => [0, 1, 2].map(j => dot(P[i], T[j]))); };
  const Rz = t => { const c = Math.cos(t), s = Math.sin(t); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };
  const Rx = t => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, s], [0, -s, c]]; };
  const vecOf = v => [v.x, v.y, v.z];
  const radec2vec = (ra, dec) => { const a = ra * D2R, d = dec * D2R; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };
  const vec2latlon = p => ({ lat: Math.asin(Math.max(-1, Math.min(1, p[2]))) * R2D, lon: Math.atan2(p[1], p[0]) * R2D });
  const latlon2vec = (lat, lon) => radec2vec(lon, lat);
  const wrap180 = x => ((x + 540) % 360) - 180;
  const wrap360 = x => ((x % 360) + 360) % 360;

  // ---------- 月の自転 (IAU WGCCRE, Archinal et al. 2018): ICRF → 月固定座標 ----------
  function moonRotation(time) {
    const d = time.tt, T = d / 36525;
    const E = [
      125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d,
      357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d, 134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d,
      34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d,
    ].map(x => x * D2R);
    const sn = i => Math.sin(E[i - 1]), cs = i => Math.cos(E[i - 1]);
    const a0 = 269.9949 + 0.0031 * T - 3.8787 * sn(1) - 0.1204 * sn(2) + 0.0700 * sn(3) - 0.0172 * sn(4) + 0.0072 * sn(6) - 0.0052 * sn(10) + 0.0043 * sn(13);
    const d0 = 66.5392 + 0.0130 * T + 1.5419 * cs(1) + 0.0239 * cs(2) - 0.0278 * cs(3) + 0.0068 * cs(4) - 0.0029 * cs(6) + 0.0009 * cs(7) + 0.0008 * cs(10) - 0.0009 * cs(13);
    const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * sn(1) + 0.1208 * sn(2) - 0.0642 * sn(3) + 0.0158 * sn(4) + 0.0252 * sn(5)
      - 0.0066 * sn(6) - 0.0047 * sn(7) - 0.0046 * sn(8) + 0.0028 * sn(9) + 0.0052 * sn(10) + 0.0040 * sn(11) + 0.0019 * sn(12) - 0.0044 * sn(13);
    const M = mulMM(Rz(W * D2R), mulMM(Rx((90 - d0) * D2R), Rz((90 + a0) * D2R)));
    return { M, Mt: transpose(M), a0, d0, W };
  }

  // ---------- 太陽黄経 (J2000) ----------
  function solarLongitudeJ2000(time) {
    const s = A.GeoVector('Sun', time, false);
    const c = Math.cos(EPS0), sn = Math.sin(EPS0);
    const y = s.y * c + s.z * sn;
    return wrap360(Math.atan2(y, s.x) * R2D);
  }
  // 指定年に λ⊙ = lam となる時刻 (Date)
  function peakTimeForYear(lam, year) {
    let t0 = new Date(Date.UTC(year, 0, 1));
    let prev = solarLongitudeJ2000(A.MakeTime(t0)), tPrev = t0;
    for (let i = 1; i <= 370; i++) {
      const t = new Date(Date.UTC(year, 0, 1 + i));
      const l = solarLongitudeJ2000(A.MakeTime(t));
      const d1 = wrap180(lam - prev), d2 = wrap180(lam - l);
      if (d1 >= 0 && d2 <= 0 && Math.abs(d1) < 5 && Math.abs(d2) < 5) {
        let a = tPrev.getTime(), b = t.getTime();
        for (let k = 0; k < 40; k++) {
          const m = (a + b) / 2;
          const lm = solarLongitudeJ2000(A.MakeTime(new Date(m)));
          if (wrap180(lam - lm) >= 0) a = m; else b = m;
        }
        return new Date((a + b) / 2);
      }
      prev = l; tPrev = t;
    }
    return null;
  }

  // ---------- 状態計算 ----------
  // sh: 流星群パラメータ, tPeak: 極大時刻 (Date), site {lat, lon, elev}, opts {focus}
  function state(date, sh, tPeak, site, opts) {
    opts = opts || {};
    const time = A.MakeTime(date);
    const obs = new A.Observer(site.lat, site.lon, site.elev);
    const moonV = vecOf(A.GeoVector('Moon', time, false)); // AU, EQJ
    const sunV = vecOf(A.GeoVector('Sun', time, false));
    const dt = 1 / 1440; // 1 min
    const mp = vecOf(A.GeoVector('Moon', time.AddDays(dt), false)), mm = vecOf(A.GeoVector('Moon', time.AddDays(-dt), false));
    const vMoon = scale(sub(mp, mm), AU_KM / (2 * dt * 86400)); // km/s 地心
    const mhat = norm(moonV);
    const eGeo = scale(mhat, -1);                 // 月→地心
    // 観測地から見た月の向き (地形視差 最大 ~1° を含む)。月面図・可視判定・視野枠はこちらを使う
    const obsV = vecOf(A.ObserverVector(time, obs, false));
    const mTopo = norm(sub(moonV, obsV));
    const eDir = scale(mTopo, -1);                // 月→観測地
    const sDir = norm(sub(sunV, moonV));           // 月→太陽
    const rot = moonRotation(time);
    const subEarth = vec2latlon(mulMV(rot.M, eGeo));
    const subObs = vec2latlon(mulMV(rot.M, eDir));
    const subSolar = vec2latlon(mulMV(rot.M, sDir));

    // 輻射点 (J2000) とドリフト
    const dDays = (date.getTime() - tPeak.getTime()) / 86400000;
    const ra = sh.ra + sh.dra * dDays, dec = sh.dec + sh.ddec * dDays;
    const rGeo = radec2vec(ra, dec);
    const vInf = vInfOf(sh, opts.focus);
    // 流星体の速度ベクトル (地球基準) → 月基準
    const uE = scale(rGeo, -vInf);
    const uM = sub(uE, vMoon);
    const vMoonImpact = Math.hypot(uM[0], uM[1], uM[2]);
    const rMoonDir = norm(scale(uM, -1));           // 月から見た輻射点
    const radiantSub = vec2latlon(mulMV(rot.M, rMoonDir));

    // 天球上の向き: 東/北 (EQJ)
    const ra_m = Math.atan2(mTopo[1], mTopo[0]), dec_m = Math.asin(mTopo[2]);
    const east = [-Math.sin(ra_m), Math.cos(ra_m), 0];
    const north = [-Math.sin(dec_m) * Math.cos(ra_m), -Math.sin(dec_m) * Math.sin(ra_m), Math.cos(dec_m)];
    // 観測地の天頂方向 (EQD → EQJ)
    const lst = A.SiderealTime(time) + site.lon / 15;
    const zEQD = radec2vec(lst * 15, site.lat);
    const rotDJ = A.Rotation_EQD_EQJ(time);
    const zJ = vecOf(A.RotateVector(rotDJ, new A.Vector(zEQD[0], zEQD[1], zEQD[2], time)));
    const zenithPA = Math.atan2(dot(zJ, east), dot(zJ, north)) * R2D; // 北から東回り

    // 地平座標
    const eqM = A.Equator('Moon', time, obs, true, true);
    const hzM = A.Horizon(time, obs, eqM.ra, eqM.dec, 'normal');
    const eqS = A.Equator('Sun', time, obs, true, true);
    const hzS = A.Horizon(time, obs, eqS.ra, eqS.dec, 'normal');
    const rotJD = A.Rotation_EQJ_EQD(time);
    const rD = A.RotateVector(rotJD, new A.Vector(rGeo[0], rGeo[1], rGeo[2], time));
    const eqR = A.EquatorFromVector(rD);
    const hzR = A.Horizon(time, obs, eqR.ra, eqR.dec, 'normal');
    const ill = A.Illumination('Moon', time);
    const distTopo = eqM.dist * AU_KM;
    const diamDeg = 2 * Math.asin(R_MOON / distTopo) * R2D;
    // 太陽黄経と ZHR
    const lam = solarLongitudeJ2000(time);
    // 月位置補正: 月は地球の公転方向に along [km] だけ先 (後) にいるので、同じ流星群断面を dtMoon 秒だけ早く (遅く) 通る。
    // 月が出会う流れは、地球が太陽黄経 lamMoon で出会う流れ (論文 Sect. 3.4, analysis/scripts/event_geometry.js と同じ式)
    const sp = vecOf(A.GeoVector('Sun', time.AddDays(dt), false)), sm = vecOf(A.GeoVector('Sun', time.AddDays(-dt), false));
    const vEarth = scale(sub(sm, sp), AU_KM / (2 * dt * 86400)); // 地球の日心速度 [km/s]
    const vEarthAbs = Math.hypot(vEarth[0], vEarth[1], vEarth[2]);
    const dtMoon = dot(scale(moonV, AU_KM), vEarth) / (vEarthAbs * vEarthAbs); // s
    const lamRate = 360 / 365.25636 / 86400 * (1 + 2 * 0.0167 * Math.cos((lam - 282.9) * D2R)); // deg/s
    const lamMoon = wrap360(lam + dtMoon * lamRate);
    const dl = wrap180((opts.moonLam === false ? lam : lamMoon) - sh.lam);
    const zhr = sh.zhr * Math.pow(10, -(dl < 0 ? sh.bm : sh.bp) * Math.abs(dl));
    // 月から見た太陽・地球の離角 (夜側の地球可視率の目安)
    const elong = Math.acos(Math.max(-1, Math.min(1, dot(eDir, sDir)))) * R2D;

    return {
      time, date, rot, eDir, eGeo, sDir, rMoonDir, rGeo, east, north, zenithPA, subEarth, subObs, subSolar, radiantSub,
      ra, dec, vInf, vMoonImpact, moonAlt: hzM.altitude, moonAz: hzM.azimuth, sunAlt: hzS.altitude, radAlt: hzR.altitude, radAz: hzR.azimuth,
      illum: ill.phase_fraction, phaseAngle: ill.phase_angle, distKm: distTopo, diamDeg, lam, lamMoon, dtMoonH: dtMoon / 3600, dl, zhr, elong, vMoon, lst,
    };
  }

  // 地球の重力圏の外での速度 [km/s]: 実測の地心速度 Vg があればそれ、なければ大気圏突入速度 V∞ から地球の加速分を引く
  function vInfOf(sh, focus) {
    if (!focus) return sh.v;
    return sh.vg > 0 ? sh.vg : Math.sqrt(Math.max(sh.v * sh.v - V_ESC_EARTH * V_ESC_EARTH, 1));
  }
  // 質量指数: 上書き > 月面閃光で測った cm サイズの値 (sCm) > 目視の母集団指数 r から 1 + 2.5 log r
  function massIndex(sh, opts) {
    if (opts && opts.sOverride > 0) return { s: opts.sOverride, src: 'override' };
    if (sh.sCm > 0) return { s: sh.sCm, src: 'lif' };
    return { s: 1 + 2.5 * Math.log10(sh.r), src: 'r' };
  }

  // ---------- フラックス ----------
  // 共通: 質量指数 s (massIndex: 上書き > 月面閃光の実測 sCm > 1 + 2.5 log r), +6.5 等の質量 m65 (Verniani 1973), 下限質量 mlim (直径 d, 密度 ρ)
  //   ZHR(≥m) = ZHR·(m/m65)^(1−s)  … 目視観測者 1 人あたりの cm サイズ以上 (火球級) の出現数 (s = 1 + 2.5 log r なら ZHR·r^(6.5−M))
  // model 'zhr' (既定): 地球フラックス F(≥m) = ZHR(≥m) / A_eff, A_eff = π (H tan z_max)² (H = 100 km) — 明るい流星の幾何学的集光面積
  // model 'kr':  Koschack & Rendtel (1990) の F(+6.5) を質量指数で外挿  F(≥m) = F(6.5)·(m/m65)^(1−s)
  const R_EARTH = 6371, H_METEOR = 100;
  function flux(sh, zhr, opts) {
    const r = sh.r, v = sh.v;
    const F65 = zhr * (13.1 * r - 16.5) * Math.pow(Math.max(r - 1.3, 0.01), 0.748) / 37200;
    const mi = massIndex(sh, opts), s = mi.s;
    // Verniani (1973): log10 m[g] = 6.31 - 0.4 Mv - 3.89 log10 V[km/s]
    const m65_g = opts.m65 || Math.pow(10, 6.31 - 0.4 * 6.5 - 3.89 * Math.log10(v));
    const m65 = m65_g / 1000; // kg
    const mlim = Math.PI / 6 * opts.rho * Math.pow(opts.dcm / 100, 3); // kg
    const Mlim = (6.31 - 3.89 * Math.log10(v) - Math.log10(mlim * 1000)) / 0.4; // 下限質量の流星の絶対等級
    const frac = Math.pow(mlim / m65, 1 - s);
    const zhrD = zhr * frac;
    const zmax = opts.zmax || 70;
    const Aeff = Math.PI * Math.pow(H_METEOR * Math.tan(zmax * D2R), 2);
    const FE = (opts.model === 'kr') ? F65 * frac : zhrD / Aeff;   // 地球大気上端, 輻射点に垂直な単位面積あたり
    const Aearth = Math.PI * Math.pow(R_EARTH + H_METEOR, 2);
    const Nearth = FE * Aearth;                                     // 地球全体 [/h]
    let ratio = 1;
    const vInf = vInfOf(sh, opts.focus);
    if (opts.focus) ratio = (1 + (V_ESC_MOON * V_ESC_MOON) / (vInf * vInf)) / (1 + (V_ESC_EARTH * V_ESC_EARTH) / (vInf * vInf));
    // 月面への衝突速度: 月の脱出速度と、月の距離での地球の重力ポテンシャルを加える (GEM: Vg 33.8 → 33.9 km/s, 論文 Sect. 3.3)
    const vImp = Math.sqrt(vInf * vInf + V_ESC_MOON * V_ESC_MOON + (opts.focus ? V_ESC_EARTH_AT_MOON * V_ESC_EARTH_AT_MOON : 0));
    const Fmoon = FE * ratio * (opts.calib || 1);
    const Ekin = 0.5 * mlim * vImp * vImp * 1e6; // J
    return { dcm: opts.dcm, F65, s, sSrc: mi.src, m65, mlim, Mlim, frac, zhrD, Aeff, FE, Aearth, Nearth, Nlim: FE, ratio, Fmoon, vInf, vImp, Ekin, model: opts.model || 'zhr' };
  }

  // ---------- 発光効率 η(v) (Swift et al. 2011; Suggs et al. 2014 が採用) ----------
  const etaOfV = v => 1.5e-3 * Math.exp(-Math.pow(9.3 / v, 2));

  // ---------- 月面閃光の明るさ (地上から, 400–800 nm) ----------
  // 発光効率 η (400–800 nm 帯内で定義), 継続時間 tau [s], 露光 texp [s], 距離 D [km]
  // 0 等の 400–800 nm 帯エネルギーフラックス: Vega の f_λ (7.3e-11 @400, 3.6e-11 @550, 1.25e-11 @800 W m⁻² nm⁻¹) を台形積分 ≈ 1.4e-8 W m⁻²
  const F0_400_800 = 1.4e-8;
  // 測光の定義 (conv):
  //   'R'    (既定) 論文 "LIF Geminids 2018–2025" Eq. 1–2 と同じ: R バンド (Bessell 1998, Δλ = 1607 Å, ZP_R = 0.555),
  //          月面上の半球 2π sr への等方放射 (f = 2)。0 等の帯内フラックス = 10^(−(21.1+0.555)/2.5) erg cm⁻² s⁻¹ Å⁻¹ × 1607 Å = 3.50e-9 W m⁻²
  //   'wide' 2026-11 までの既定: 400–800 nm, 全球 4π sr
  const PHOT = { R: { f0: 1e-3 * Math.pow(10, -(21.1 + 0.555) / 2.5) * 1607, omega: 2 * Math.PI }, wide: { f0: F0_400_800, omega: 4 * Math.PI } };
  const photOf = conv => PHOT[conv] || PHOT.R;
  function flashMag(Ekin, eta, tau, texp, distKm, conv) {
    const P = photOf(conv);
    const Elum = eta * Ekin;
    const D = distKm * 1000;
    const Lpeak = Elum / tau, Lframe = Elum / Math.max(tau, texp);
    const fPeak = Lpeak / (P.omega * D * D), fFrame = Lframe / (P.omega * D * D);
    return { Elum, fPeak, fFrame, mPeak: -2.5 * Math.log10(fPeak / P.f0), mFrame: -2.5 * Math.log10(fFrame / P.f0) };
  }
  // 限界等級 (フレーム) → 検出できる最小の運動エネルギー・質量・直径
  function massFromMag(mag, eta, tau, texp, distKm, vImp, rho, conv) {
    const P = photOf(conv);
    const D = distKm * 1000;
    const f = P.f0 * Math.pow(10, -0.4 * mag);
    const Elum = f * P.omega * D * D * Math.max(tau, texp);
    const Ekin = Elum / eta;
    const mass = 2 * Ekin / (vImp * vImp * 1e6); // kg
    const d = Math.cbrt(6 * mass / (Math.PI * rho)) * 100; // cm
    return { Elum, Ekin, mass, d };
  }

  // 月面格子で衝突率 (個/時) を積分.  fov: {w,h,cx,cy (arcmin), rot (deg: 枠の回転), pa (deg: 画面回転)} or null
  function integrate(st, Fmoon, step, fov) {
    const { rot, eDir, sDir, rMoonDir, east, north, diamDeg } = st;
    const Rmin = diamDeg * 60 / 2; // 視半径 arcmin
    const dl = step * D2R;
    let aNight = 0, aNightVis = 0, aFov = 0, nNight = 0, nNightVis = 0, nFov = 0, nAll = 0, areaFov = 0;
    const th = fov ? fov.pa * D2R : 0, cth = Math.cos(th), sth = Math.sin(th);
    const rr = fov ? (fov.rot || 0) * D2R : 0, cr = Math.cos(rr), sr = Math.sin(rr);
    for (let lat = -90 + step / 2; lat < 90; lat += step) {
      const cl = Math.cos(lat * D2R);
      const dA = R_MOON * R_MOON * cl * dl * dl;
      for (let lon = -180 + step / 2; lon < 180; lon += step) {
        const pb = latlon2vec(lat, lon);
        const p = mulMV(rot.Mt, pb);
        const cosr = dot(p, rMoonDir);
        const night = dot(p, sDir) < 0;
        const vis = dot(p, eDir) > 0;
        const hit = cosr > 0 ? Fmoon * cosr * dA : 0;
        nAll += hit;
        if (night) { aNight += dA; nNight += hit; }
        if (night && vis) { aNightVis += dA; nNightVis += hit; }
        if (fov && vis) {
          // 天球投影 (arcmin): x 右=西, y 上=北 → 回転
          let X = -dot(p, east) * Rmin, Y = dot(p, north) * Rmin;
          const x = X * cth + Y * sth, y = -X * sth + Y * cth; // 画面回転 (北→天頂上向き)
          const dx = x - fov.cx, dy = y - fov.cy;
          const xf = dx * cr + dy * sr, yf = -dx * sr + dy * cr;   // 視野枠の回転 (rot, 反時計回り正)
          if (Math.abs(xf) <= fov.w / 2 && Math.abs(yf) <= fov.h / 2) {
            areaFov += dA; if (night) { aFov += dA; nFov += hit; } // 昼側は検出不能: 夜側のみ計上
          }
        }
      }
    }
    return { nAll, nNight, nNightVis, nFov, aNight, aNightVis, aFovNight: aFov, areaFov };
  }

  // 視野内 (夜側) の衝突率が最大になる視野中心を探す。fov は integrate と同じ (w, h, rot, pa は固定)。
  // 月面格子を一度だけ天球に投影し、中心 (cx, cy) を stepArcmin 刻みで総当たりする。
  function bestPointing(st, fov, gridStep, stepArcmin) {
    const { rot, eDir, sDir, rMoonDir, east, north, diamDeg } = st;
    const Rmin = diamDeg * 60 / 2, step = gridStep || 3, dl = step * D2R, ds = stepArcmin || 0.5;
    const th = (fov.pa || 0) * D2R, cth = Math.cos(th), sth = Math.sin(th), rr = (fov.rot || 0) * D2R, cr = Math.cos(rr), sr = Math.sin(rr);
    const pts = [];
    for (let lat = -90 + step / 2; lat < 90; lat += step) {
      const dA = R_MOON * R_MOON * Math.cos(lat * D2R) * dl * dl;
      for (let lon = -180 + step / 2; lon < 180; lon += step) {
        const p = mulMV(rot.Mt, latlon2vec(lat, lon));
        if (dot(p, eDir) <= 0 || dot(p, sDir) >= 0) continue; // 地球から見える夜側だけ
        const cosr = dot(p, rMoonDir);
        const X = -dot(p, east) * Rmin, Y = dot(p, north) * Rmin, x = X * cth + Y * sth, y = -X * sth + Y * cth;
        pts.push([x * cr + y * sr, -x * sr + y * cr, cosr > 0 ? cosr * dA : 0, dA]); // 視野枠の座標系 (枠の回転後)
      }
    }
    let best = null;
    for (let cy = -Rmin; cy <= Rmin; cy += ds) for (let cx = -Rmin; cx <= Rmin; cx += ds) {
      const u = cx * cr + cy * sr, v = -cx * sr + cy * cr; let hit = 0, area = 0;
      for (const q of pts) if (Math.abs(q[0] - u) <= fov.w / 2 && Math.abs(q[1] - v) <= fov.h / 2) { hit += q[2]; area += q[3]; }
      const score = hit > 0 ? hit : area * 1e-9; // 衝突領域が視野に入らないときは夜側の面積で決める
      if (!best || score > best.score) best = { cx, cy, score, hit, area };
    }
    return best && best.score > 0 ? best : null;
  }

  // 観測窓の走査 (start..end Date, stepMin) → 配列
  function scan(sh, tPeak, site, opts, start, end, stepMin, fov, gridStep) {
    const out = [];
    for (let t = start.getTime(); t <= end.getTime(); t += stepMin * 60000) {
      const st = state(new Date(t), sh, tPeak, site, opts);
      const fl = flux(sh, st.zhr, opts);
      const ig = integrate(st, fl.Fmoon, gridStep || 4, fov);
      out.push({ t, st, fl, ig });
    }
    return out;
  }

  return { A, SITES, SHOWERS, R_MOON, AU_KM, F0_400_800, PHOT, etaOfV, massIndex, vInfOf, bestPointing, moonRotation, solarLongitudeJ2000, peakTimeForYear, state, flux, flashMag, massFromMag, integrate, scan,
    vec: { dot, norm, sub, scale, cross, mulMV, transpose, radec2vec, vec2latlon, latlon2vec, wrap180, wrap360 }, D2R, R2D };
});
