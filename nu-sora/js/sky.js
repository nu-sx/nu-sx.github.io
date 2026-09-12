/* NU-SORA デモ / 全天カメラ 疑似ライブ表示（魚眼・等距離射影）
   恒星位置は実測値（J2000 概略）。雲・流星・衛星軌跡・空の明るさは模擬。 */
'use strict';
(function (NS) {

/* ---------- 恒星カタログの展開（js/starcatalog.js を base36 から復元） ---------- */
NS.unpackSky = function () {
  if (NS._sky) return NS._sky;
  var S = window.SKY_STAR_STR || '', n = (S.length / 12) | 0;
  var ra = new Float64Array(n), sinD = new Float64Array(n), cosD = new Float64Array(n);
  var dec = new Float64Array(n), mag = new Float64Array(n), bv = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var o = i * 12;
    var r = parseInt(S.substr(o, 4), 36) / 1000;
    var d = parseInt(S.substr(o + 4, 4), 36) / 1000 - 90;
    ra[i] = r; dec[i] = d;
    sinD[i] = Math.sin(d * NS.d2r); cosD[i] = Math.cos(d * NS.d2r);
    mag[i] = parseInt(S.substr(o + 8, 2), 36) / 50 - 2;
    bv[i] = parseInt(S.substr(o + 10, 2), 36) / 50 - 1;
  }
  /* 星座線（明るさ順の添字ペア） */
  var LS = window.SKY_LINE_STR || '', ln = (LS.length / 6) | 0;
  var la = new Int32Array(ln), lb = new Int32Array(ln);
  for (var j = 0; j < ln; j++) {
    la[j] = parseInt(LS.substr(j * 6, 3), 36);
    lb[j] = parseInt(LS.substr(j * 6 + 3, 3), 36);
  }
  /* 天の川（Tycho-2 星数密度 1 度グリッドのうち閾値超のセル） */
  var MS = window.SKY_MW_STR || '', mn = (MS.length / 6) | 0;
  var mra = new Float64Array(mn), msinD = new Float64Array(mn), mcosD = new Float64Array(mn), mv = new Float64Array(mn);
  for (var k = 0; k < mn; k++) {
    var q = k * 6;
    var rr = parseInt(MS.substr(q, 2), 36), cc = parseInt(MS.substr(q + 2, 3), 36);
    var dd = rr - 90 + 0.5;
    mra[k] = cc + 0.5; msinD[k] = Math.sin(dd * NS.d2r); mcosD[k] = Math.cos(dd * NS.d2r);
    mv[k] = parseInt(MS.substr(q + 5, 1), 36) / 35;
  }
  NS._sky = { n:n, ra:ra, dec:dec, sinD:sinD, cosD:cosD, mag:mag, bv:bv,
              ln:ln, la:la, lb:lb, mn:mn, mra:mra, msinD:msinD, mcosD:mcosD, mv:mv };
  return NS._sky;
};
/* 固有名（和名）を持つ明るい星を、位置でカタログに突き合わせて索引を作る */
NS.starNameIndex = function () {
  if (NS._nameIdx) return NS._nameIdx;
  var sky = NS.unpackSky(), idx = {};
  NS.STARS.forEach(function (st) {
    var ra0 = st[1] * 15, dec0 = st[2], best = -1, bestD = 0.35;
    for (var i = 0; i < sky.n && sky.mag[i] < st[3] + 0.9; i++) {
      var dr = Math.abs(sky.ra[i] - ra0); if (dr > 180) dr = 360 - dr;
      var d = Math.hypot(dr * Math.cos(dec0 * NS.d2r), sky.dec[i] - dec0);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0 && !(best in idx)) idx[best] = st[0];
  });
  NS._nameIdx = idx;
  return idx;
};
/* B−V 色指数 → 表示色（古典的な恒星色テーブルを線形補間） */
var BV_TAB = [[-0.40,155,176,255],[-0.20,170,191,255],[0.00,202,215,255],[0.20,231,236,255],
              [0.40,248,247,255],[0.60,255,251,246],[0.80,255,244,234],[1.00,255,235,213],
              [1.20,255,222,180],[1.40,255,210,161],[1.60,255,199,142],[2.00,255,166,81]];
NS.bvColor = function (bv) {
  var t = BV_TAB;
  if (bv <= t[0][0]) return t[0];
  for (var i = 1; i < t.length; i++) {
    if (bv <= t[i][0]) {
      var f = (bv - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return [0, Math.round(t[i-1][1] + (t[i][1] - t[i-1][1]) * f),
                 Math.round(t[i-1][2] + (t[i][2] - t[i-1][2]) * f),
                 Math.round(t[i-1][3] + (t[i][3] - t[i-1][3]) * f)];
    }
  }
  return t[t.length - 1];
};

/* 明るい星の和名。位置でカタログ（BSC5）に突き合わせてラベル表示に使う。
   [名前, 赤経(h), 赤緯(°), V等級] */
NS.STARS = [
['シリウス',6.752,-16.716,-1.46],['カノープス',6.399,-52.696,-0.72],['アークトゥルス',14.261,19.182,-0.05],
['ベガ',18.615,38.784,0.03],['カペラ',5.278,45.998,0.08],['リゲル',5.242,-8.202,0.13],
['プロキオン',7.655,5.225,0.34],['アケルナル',1.629,-57.237,0.46],['ベテルギウス',5.919,7.407,0.50],
['ハダル',14.064,-60.373,0.61],['アルタイル',19.846,8.868,0.77],['アクルックス',12.443,-63.099,0.77],
['アルデバラン',4.599,16.509,0.85],['アンタレス',16.490,-26.432,1.09],['スピカ',13.420,-11.161,1.04],
['ポルックス',7.755,28.026,1.14],['フォーマルハウト',22.961,-29.622,1.16],['デネブ',20.690,45.280,1.25],
['ミモザ',12.795,-59.689,1.25],['レグルス',10.140,11.967,1.35],['アダーラ',6.977,-28.972,1.50],
['カストル',7.577,31.888,1.58],['シャウラ',17.560,-37.104,1.62],['ガクルックス',12.519,-57.113,1.63],
['ベラトリックス',5.418,6.350,1.64],['エルナト',5.438,28.608,1.65],['ミアプラキドゥス',9.220,-69.717,1.68],
['アルニラム',5.604,-1.202,1.69],['アルナイル',22.137,-46.961,1.74],['アルニタク',5.679,-1.943,1.74],
['アリオト',12.900,55.960,1.77],['ドゥーベ',11.062,61.751,1.79],['ミルファク',3.405,49.861,1.79],
['ウェズン',7.140,-26.393,1.83],['カウス・アウストラリス',18.403,-34.385,1.85],['アルカイド',13.792,49.313,1.86],
['アヴィオール',8.375,-59.510,1.86],['サルガス',17.622,-42.998,1.87],['メンカリナン',5.992,44.947,1.90],
['アトリア',16.811,-69.028,1.91],['アルヘナ',6.629,16.399,1.93],['ピーコック',20.427,-56.735,1.94],
['アルファルド',9.460,-8.659,1.98],['ミルザム',6.378,-17.956,1.98],['ポラリス',2.530,89.264,1.98],
['アルゲナ',10.333,19.842,2.01],['ハマル',2.120,23.462,2.00],['デネブ・カイトス',0.726,-17.987,2.04],
['サイフ',5.796,-9.670,2.06],['アルフェラッツ',0.140,29.091,2.06],['ヌンキ',18.921,-26.297,2.05],
['ミラク',1.162,35.621,2.05],['メンケント',14.111,-36.370,2.06],['アルフェッカ',15.578,26.715,2.22],
['ミザール',13.399,54.925,2.23],['コカブ',14.845,74.155,2.08],['ラスアルハゲ',17.582,12.560,2.08],
['アルゴル',3.136,40.956,2.12],['アルマク',2.065,42.330,2.10],['デネボラ',11.818,14.572,2.14],
['ツィー',0.945,60.717,2.15],['ナオス',8.060,-40.003,2.21],['スハイル',9.133,-43.433,2.21],
['エルタニン',17.944,51.489,2.23],['シェダル',0.675,56.537,2.23],['サドル',20.371,40.257,2.23],
['カフ',0.153,59.150,2.27],['ミンタカ',5.533,-0.299,2.25],['アルシャイン',19.921,6.407,3.71],
['ラスアルゲティ',17.244,14.390,3.35],['エニフ',21.736,9.875,2.38],['シェアト',23.063,28.083,2.42],
['マルカブ',23.079,15.205,2.48],['アルゲニブ',0.221,15.184,2.83],['ギエナー',20.770,33.970,2.46],
['アルビレオ',19.512,27.960,3.05],['ルクバー',1.430,60.235,2.68],['セギン',1.907,63.670,3.35],
['アルデラミン',21.310,62.586,2.45],['タラゼド',19.771,10.613,2.72],['メラク',11.031,56.382,2.37],
['フェクダ',11.897,53.695,2.44],['メグレズ',12.257,57.033,3.32],['アルゴレム',12.573,-23.397,2.59],
['ジェンマ',15.578,26.715,2.22],['ズベンエルゲヌビ',14.848,-16.042,2.75],['ズベンエスカマリ',15.283,-9.383,2.61],
['アルニヤト',16.353,-25.593,2.89],['ドゥシュバ',15.981,-26.114,2.29],['レサト',17.708,-37.296,2.69],
['カウス・メディア',18.350,-29.828,2.70],['アスケラ',19.078,-21.024,2.60],['アルタルフ',8.275,9.186,3.52],
['アルゴル座β',3.136,40.956,2.12],['プロプス',6.248,22.507,3.31],['メンカル',3.038,4.090,2.53],
['ミラ',2.322,-2.977,3.50],['アルレシャ',2.034,2.764,3.82],['ハトゥサ',0.819,-8.824,3.56],
['アルゲディ',20.294,-12.545,3.57],['ダビ',20.351,-14.781,2.85],['サダルスウド',21.526,-5.571,2.87],
['サダルメリク',22.096,-0.320,2.95],['スカト',22.911,-15.821,3.27],['アルデバランε',4.477,19.180,3.53],
['アルキオネ',3.791,24.105,2.87],['アトラス',3.819,24.053,3.62],['カフ座',0.153,59.150,2.27],
['ヘカ',5.586,9.934,3.39],['タビト',4.831,6.961,3.19],['クルサ',5.131,-5.086,2.79],
['ナイル・アル・サイフ',5.591,-5.910,2.75],['アルヒバ',12.169,-22.620,2.65],['クラズ',12.573,-23.397,2.59],
['ジェンナー',12.263,-17.542,2.94],['ミンカル',12.498,-16.516,2.95],['ラスアルアスド',10.333,19.842,2.01],
['アルジェバ',10.278,23.417,2.37],['ゾスマ',11.235,20.524,2.56],['シェラタン',1.911,20.808,2.64]
];
/* =============== 全天ビュー =============== */
NS.AllSky = function (station, opts) {
  opts = opts || {};
  var size = opts.size || 420;
  var cv = NS.el('canvas', { class:'allsky', width:size * 2, height:size * 2, style:{ width:'100%', height:'auto' } });
  var A = { node:cv, station:station, running:false, showConst:opts.showConst !== false, showNames:!!opts.showNames, showGrid:opts.showGrid !== false,
            speed:opts.speed || 1, meteors:[], sats:[], t0:NS.now(), started:performance.now() };
  var ctx = cv.getContext('2d');
  var CX = size / 2, CY = size / 2, R = size * 0.468;
  /* 恒星・天の川は毎フレーム描くと重いので、天球が 1/12 度回るごとにだけ描き直して使い回す */
  var bg = document.createElement('canvas');
  bg.width = cv.width; bg.height = cv.height;
  var bctx = bg.getContext('2d');
  A._bgKey = null;

  function fish(alt, az) {   /* 等距離射影。北が上、東が左 */
    var r = R * (90 - alt) / 90, a = az * NS.d2r;
    return [CX - r * Math.sin(a), CY - r * Math.cos(a)];
  }
  A.fish = fish;

  /* 恒星・天の川・星座線・太陽・月を描くレイヤ。天球が少し回るごとにだけ更新する */
  function drawStatic(t, lst, sb, w) {
    var st = A.station;
    bctx.setTransform(2, 0, 0, 2, 0, 0);
    bctx.clearRect(0, 0, size, size);
    /* --- 空の地色（光害ドーム：地平線側が明るい） --- */
    var night = w.sunAlt < -12, dusk = w.sunAlt >= -12 && w.sunAlt < 0;
    var lp = Math.max(0, Math.min(1, (21.9 - st.sqm) / 4.2));
    var g = bctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    if (night) {
      g.addColorStop(0, 'rgb(' + Math.round(5 + 13 * lp) + ',' + Math.round(7 + 14 * lp) + ',' + Math.round(16 + 20 * lp) + ')');
      g.addColorStop(0.60, 'rgb(' + Math.round(8 + 26 * lp) + ',' + Math.round(10 + 24 * lp) + ',' + Math.round(21 + 28 * lp) + ')');
      g.addColorStop(1, 'rgb(' + Math.round(15 + 62 * lp) + ',' + Math.round(17 + 50 * lp) + ',' + Math.round(28 + 38 * lp) + ')');
    } else if (dusk) {
      g.addColorStop(0, '#1b2b4a'); g.addColorStop(0.6, '#3b4a6b'); g.addColorStop(1, '#8a6a58');
    } else {
      g.addColorStop(0, '#4b7fbd'); g.addColorStop(0.6, '#7ba5d0'); g.addColorStop(1, '#c3d4e4');
    }
    bctx.beginPath(); bctx.arc(CX, CY, R, 0, 7); bctx.fillStyle = g; bctx.fill();
    bctx.save(); bctx.beginPath(); bctx.arc(CX, CY, R, 0, 7); bctx.clip();

    var vis = night ? 1 : dusk ? Math.max(0, (-w.sunAlt) / 12) : 0;
    var limMag = night ? (st.sqm - 14.5) : 1.2;   /* 高感度全天カメラの限界等級の代用 */

    /* ---- 天の川（Tycho-2 の星数密度グリッド） ---- */
    var sky = NS.unpackSky();
    var la = st.lat * NS.d2r, sinLat = Math.sin(la), cosLat = Math.cos(la);
    var altaz = function (raDeg, sinD, cosD) {
      var ha = (lst - raDeg) * NS.d2r, ch = Math.cos(ha), sh = Math.sin(ha);
      var sa = sinD * sinLat + cosD * cosLat * ch;
      if (sa < -0.02) return null;
      var alt = Math.asin(sa > 1 ? 1 : sa) * NS.r2d;
      var az = Math.atan2(-cosD * sh, sinD * cosLat - cosD * sinLat * ch) * NS.r2d;
      return [alt, (az + 360) % 360];
    };
    if (vis > 0.2) {
      var mwStep = size >= 360 ? 1 : 2;
      var mwGain = vis * (0.30 + 0.55 * (1 - lp)) * (1 - w.cloud * 0.85);
      var cell = (R / 90) * (mwStep === 1 ? 1.75 : 3.0);
      for (var mi = 0; mi < sky.mn; mi += mwStep) {
        var mh = altaz(sky.mra[mi], sky.msinD[mi], sky.mcosD[mi]);
        if (!mh || mh[0] < 2) continue;
        /* 低空は大気減光で急速に暗くなる */
        var mext = Math.pow(Math.max(0.06, Math.sin(mh[0] * NS.d2r)), 0.45);
        var a2 = Math.pow(sky.mv[mi], 2.4) * mwGain * 0.22 * mext;
        if (a2 <= 0.006) continue;
        var mxy = fish(mh[0], mh[1]);
        var msz = cell;
        bctx.fillStyle = 'rgba(198,208,232,' + a2.toFixed(3) + ')';
        bctx.fillRect(mxy[0] - msz / 2, mxy[1] - msz / 2, msz, msz);
      }
    }
    /* ---- 星座線（IAU 公式星座図形） ---- */
    var cloudCut0 = 1 - w.cloud * 0.9;
    if (A.showConst && vis > 0.4 && cloudCut0 > 0.12) {
      bctx.strokeStyle = 'rgba(118,168,224,' + (0.30 * vis * cloudCut0).toFixed(3) + ')';
      bctx.lineWidth = size >= 360 ? 0.8 : 0.6;
      bctx.beginPath();
      for (var li = 0; li < sky.ln; li++) {
        var i1 = sky.la[li], i2 = sky.lb[li];
        var p1 = altaz(sky.ra[i1], sky.sinD[i1], sky.cosD[i1]); if (!p1 || p1[0] < 4) continue;
        var p2 = altaz(sky.ra[i2], sky.sinD[i2], sky.cosD[i2]); if (!p2 || p2[0] < 4) continue;
        var q1 = fish(p1[0], p1[1]), q2 = fish(p2[0], p2[1]);
        if (Math.hypot(q1[0] - q2[0], q1[1] - q2[1]) > R * 0.75) continue;   /* 折り返しを描かない */
        bctx.moveTo(q1[0], q1[1]); bctx.lineTo(q2[0], q2[1]);
      }
      bctx.stroke();
    }
    /* ---- 恒星（Yale BSC5。明るい順に並んでいるので限界等級で打ち切る） ---- */
    if (vis > 0.02) {
      var names = (A.showNames && size >= 360) ? NS.starNameIndex() : null;
      var labels = [];
      var tw = NS.rng('tw' + Math.floor(t / 20000));
      var cloudCut = 1 - w.cloud * 0.9;
      for (var si = 0; si < sky.n; si++) {
        var m0 = sky.mag[si];
        if (m0 > limMag) break;
        var h2 = altaz(sky.ra[si], sky.sinD[si], sky.cosD[si]);
        if (!h2 || h2[0] < 1.2) continue;
        var ext = 0.28 / Math.max(0.13, Math.sin(Math.max(3, h2[0]) * NS.d2r));
        var m = m0 + ext;
        if (m > limMag) continue;
        var x = limMag - m;                                   /* 限界等級より何等明るいか */
        var amp = Math.min(1, Math.max(0, x / 1.25)) * vis * cloudCut;
        if (amp <= 0.03) continue;
        var sxy = fish(h2[0], h2[1]);
        var col = NS.bvColor(sky.bv[si]);
        /* 暗い星ほど色が抜けて白く見える */
        var sat = Math.min(1, Math.max(0, x / 3.2));
        var cR = Math.round(248 + (col[1] - 248) * sat);
        var cG = Math.round(248 + (col[2] - 248) * sat);
        var cB = Math.round(248 + (col[3] - 248) * sat);
        var rr = Math.min(3.3, 0.30 + 0.42 * Math.pow(Math.max(0, x), 0.85)) * (size >= 360 ? 1 : 0.82);
        var scin = 1 - 0.20 * (1 - Math.sin(h2[0] * NS.d2r)) * tw();
        bctx.beginPath(); bctx.arc(sxy[0], sxy[1], rr, 0, 7);
        bctx.fillStyle = 'rgba(' + cR + ',' + cG + ',' + cB + ',' + (amp * scin).toFixed(3) + ')';
        bctx.fill();
        if (rr > 1.75) {   /* 明るい星のにじみ */
          var gg = bctx.createRadialGradient(sxy[0], sxy[1], 0, sxy[0], sxy[1], rr * 3.2);
          gg.addColorStop(0, 'rgba(' + cR + ',' + cG + ',' + cB + ',' + (0.17 * amp).toFixed(3) + ')');
          gg.addColorStop(1, 'rgba(' + cR + ',' + cG + ',' + cB + ',0)');
          bctx.fillStyle = gg;
          bctx.beginPath(); bctx.arc(sxy[0], sxy[1], rr * 3.2, 0, 7); bctx.fill();
        }
        if (names && names[si] && m0 <= 1.75 && cloudCut > 0.25) labels.push([sxy[0], sxy[1], names[si], rr]);
      }
      if (labels.length) {
        bctx.font = '600 11px "Zen Kaku Gothic New", sans-serif';
        bctx.textAlign = 'left'; bctx.textBaseline = 'middle';
        bctx.fillStyle = 'rgba(186,206,240,' + (0.72 * cloudCut).toFixed(3) + ')';
        labels.forEach(function (lb2) { bctx.fillText(NS.t(lb2[2]), lb2[0] + lb2[3] + 4, lb2[1]); });
      }
    }
    /* --- 太陽（昼間・薄明） --- */
    if (w.sunAlt > -6) {
      var sAz = ((180 + (NS.jstParts(t).h + NS.jstParts(t).mi / 60 - 12 + (st.lon - 135) / 15) * 15) % 360 + 360) % 360;
      var sxy = fish(Math.max(0, w.sunAlt), sAz);
      var sg = bctx.createRadialGradient(sxy[0], sxy[1], 1, sxy[0], sxy[1], R * 0.30);
      sg.addColorStop(0, 'rgba(255,248,220,0.85)'); sg.addColorStop(0.25, 'rgba(255,236,190,0.30)');
      sg.addColorStop(1, 'rgba(255,236,190,0)');
      bctx.fillStyle = sg; bctx.beginPath(); bctx.arc(sxy[0], sxy[1], R * 0.30, 0, 7); bctx.fill();
      bctx.beginPath(); bctx.arc(sxy[0], sxy[1], R * 0.022, 0, 7); bctx.fillStyle = 'rgba(255,253,244,0.95)'; bctx.fill();
    }
    /* --- 月 --- */
    var mAlt = NS.moonAlt(t, st.lat, st.lon), ill = NS.moonIllum(t);
    if (mAlt > 0.5) {
      var mAz = ((NS.lst(t, st.lon) - NS.moonPhase(t) * 360 + 180) % 360 + 360) % 360;
      var mxy = fish(mAlt, mAz);
      var gr = bctx.createRadialGradient(mxy[0], mxy[1], 1, mxy[0], mxy[1], 30);
      gr.addColorStop(0, 'rgba(255,250,232,' + (0.5 * ill * vis).toFixed(2) + ')');
      gr.addColorStop(1, 'rgba(255,250,232,0)');
      bctx.fillStyle = gr; bctx.beginPath(); bctx.arc(mxy[0], mxy[1], 30, 0, 7); bctx.fill();
      bctx.beginPath(); bctx.arc(mxy[0], mxy[1], 4.6, 0, 7);
      bctx.fillStyle = 'rgba(255,251,236,' + (0.35 + 0.6 * ill).toFixed(2) + ')'; bctx.fill();
    }
    bctx.restore();
  }

  function draw(nowMs) {
    var t = A.t0 + (nowMs - A.started) * A.speed * (opts.timeScale || 1);
    A.t = t;
    var st = A.station, sb = NS.skyBrightness(st, t), w = sb.w;
    var lst = NS.lst(t, st.lon);
    var night0 = w.sunAlt < -12, dusk0 = w.sunAlt >= -12 && w.sunAlt < 0;
    var limMag0 = night0 ? (st.sqm - 14.5) : 1.2;
    var key = Math.round(lst * 12) + '|' + Math.round(w.sunAlt * 2) + '|' + Math.round(limMag0 * 4) +
              '|' + (A.showConst ? 1 : 0) + (A.showNames ? 'N' : '') + '|' + Math.round(w.cloud * 6);
    if (key !== A._bgKey) { A._bgKey = key; drawStatic(t, lst, sb, w); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(2, 0, 0, 2, 0, 0);

    var night = night0, dusk = dusk0, limMag = limMag0;
    var vis = night ? 1 : dusk ? Math.max(0, (-w.sunAlt) / 12) : 0;
    var lp = Math.max(0, Math.min(1, (21.9 - st.sqm) / 4.2));
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.clip();
    /* --- 雲（風向に沿って平行移動する。天頂を中心に回転させない） --- */
    if (w.cloud > 0.04) {
      var cr = NS.rng(st.id + 'cl' + Math.floor(t / 7200e3));
      var n = Math.round(3 + w.cloud * 11);
      var TILE = R * 2.8;
      /* 風上から風下へ流す（w.dir は風が吹いてくる方位） */
      var wd = (w.dir + 180) * NS.d2r;
      var spd = R * 0.00026 * (1 + w.wind / 4.5);         /* px/s：視野を 1 時間ほどかけて横切る */
      var ox = Math.sin(wd) * spd * (t / 1000);
      var oy = -Math.cos(wd) * spd * (t / 1000);
      var wrap = function (v) { return ((v % TILE) + TILE) % TILE; };
      for (var i2 = 0; i2 < n; i2++) {
        var bx = cr() * TILE, by = cr() * TILE;
        var cx = CX - R * 1.4 + wrap(bx + ox);
        var cy = CY - R * 1.4 + wrap(by + oy);
        var rr2 = R * (0.13 + 0.28 * cr()) * (0.55 + w.cloud);
        if (Math.hypot(cx - CX, cy - CY) > R + rr2) continue;
        var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr2);
        var lum = night ? Math.round(40 + 118 * lp) : 214;
        var op = Math.min(0.82, w.cloud * (0.32 + 0.40 * cr()));
        cg.addColorStop(0, 'rgba(' + lum + ',' + lum + ',' + (lum + 8) + ',' + op.toFixed(2) + ')');
        cg.addColorStop(0.55, 'rgba(' + lum + ',' + lum + ',' + (lum + 8) + ',' + (op * 0.45).toFixed(2) + ')');
        cg.addColorStop(1, 'rgba(' + lum + ',' + lum + ',' + (lum + 8) + ',0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, 7); ctx.fill();
      }
    }
    /* --- 流星・人工衛星 --- */
    if (night && w.cloud < 0.9) {
      if (Math.random() < 0.011 * A.speed) A.meteors.push(newMeteor());
      if (Math.random() < 0.004 * A.speed) A.sats.push(newSat());
    }
    A.meteors = A.meteors.filter(function (m2) {
      m2.age += 1 / 60 * A.speed;
      if (m2.age > m2.life) return false;
      var f = m2.age / m2.life;
      var a0 = fish(m2.alt0 + (m2.alt1 - m2.alt0) * Math.max(0, f - 0.30), m2.az0 + (m2.az1 - m2.az0) * Math.max(0, f - 0.30));
      var a1 = fish(m2.alt0 + (m2.alt1 - m2.alt0) * f, m2.az0 + (m2.az1 - m2.az0) * f);
      var lum2 = Math.sin(Math.PI * Math.min(1, f * 1.05)) * m2.bright;
      var gl = ctx.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
      gl.addColorStop(0, 'rgba(150,190,255,0)');
      gl.addColorStop(1, 'rgba(255,248,228,' + Math.min(1, lum2).toFixed(2) + ')');
      ctx.strokeStyle = gl; ctx.lineWidth = 0.9 + 2.4 * m2.bright; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      if (m2.bright > 0.8) {
        ctx.beginPath(); ctx.arc(a1[0], a1[1], 2 + 5 * lum2, 0, 7);
        ctx.fillStyle = 'rgba(255,244,214,' + (0.35 * lum2).toFixed(2) + ')'; ctx.fill();
      }
      if (m2.bright > 0.8 && !m2.logged) { m2.logged = true; A.lastFlash = { t:t, mag:-(1 + m2.bright * 8) }; }
      return true;
    });
    A.sats = A.sats.filter(function (s2) {
      s2.age += 1 / 60 * A.speed;
      if (s2.age > s2.life) return false;
      var f = s2.age / s2.life;
      var p = fish(s2.alt0 + (s2.alt1 - s2.alt0) * f, s2.az0 + (s2.az1 - s2.az0) * f);
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.1, 0, 7);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * Math.sin(Math.PI * f)).toFixed(2) + ')'; ctx.fill();
      return true;
    });
    ctx.restore();

    /* --- 目盛・方位 --- */
    if (A.showGrid) {
      ctx.strokeStyle = 'rgba(190,205,225,0.22)'; ctx.lineWidth = 0.6;
      [30, 60].forEach(function (alt) {
        ctx.beginPath(); ctx.arc(CX, CY, R * (90 - alt) / 90, 0, 7); ctx.stroke();
      });
      ctx.setLineDash([2, 4]);
      for (var az = 0; az < 360; az += 45) {
        var e = fish(0, az);
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(e[0], e[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(150,165,190,0.55)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.stroke();
    ctx.font = '600 11px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226,232,242,0.8)';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (c) {
      var p = fish(-4.6, c[1]); ctx.fillText(c[0], p[0], p[1]);
    });
    /* --- オーバーレイ情報 --- */
    var small = size < 340;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = (small ? 9 : 11) + 'px ui-monospace, "SFMono-Regular", monospace';
    ctx.fillStyle = 'rgba(232,238,248,0.92)';
    ctx.fillText(st.id + '  ' + NS.fmtJST(t, { sec:!small }) + (small ? '' : ' JST'), 7, 6);
    ctx.fillStyle = 'rgba(200,212,230,0.72)';
    ctx.fillText('SQM ' + (sb.mag == null ? '—' : NS.f(sb.mag, 2)) +
      '  ' + NS.t('雲') + ' ' + Math.round(w.cloud * 100) + '%' +
      (small ? '' : '  ' + NS.t('限界等級') + ' ' + (night ? NS.f(limMag, 1) : '—')), 7, small ? 18 : 22);
    if (!small) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(NS.t('模擬映像（デモ）'), size - 8, 6);
    }

    if (A.running) requestAnimationFrame(draw);
  }
  function newMeteor() {
    var r = NS.rng(Math.random() * 1e9);
    var az0 = r() * 360, alt0 = 12 + r() * 66;
    var dir = r() * 6.283, len = 6 + r() * 40;
    var b = Math.pow(r(), 3.2);
    return { az0:az0, alt0:alt0, az1:az0 + Math.cos(dir) * len * 1.7, alt1:Math.max(0, alt0 - Math.abs(Math.sin(dir)) * len),
             age:0, life:0.28 + r() * 0.9 + b * 1.6, bright:0.18 + b * 0.95, logged:false };
  }
  function newSat() {
    var r = NS.rng(Math.random() * 1e9);
    var az0 = r() * 360;
    return { az0:az0, alt0:6 + r() * 20, az1:az0 + (r() > 0.5 ? 150 : -150), alt1:6 + r() * 76, age:0, life:9 + r() * 8 };
  }
  A.setTime = function (t, live) {
    A.t0 = t; A.live = live !== false; A.started = performance.now();
    if (!A.running) A.render();
  };
  A.start = function () { if (A.running) return; A.running = true; A.started = performance.now(); requestAnimationFrame(draw); };
  A.stop = function () { A.running = false; };
  A.render = function () { draw(performance.now()); };
  return A;
};

})(NS);
