/* NU-SORA デモ / 気象・夜空輝度・電波流星（FFT）・2 周波 GNSS の実況表示
   いずれも全 14 局ぶんを並べる。表示している値はすべて模擬データである。 */
'use strict';
(function (NS) {

/* ===================== 電波流星受信機（HRO / FFT 画面） =====================
   HRO 方式：53.755 MHz の連続波ビーコンを直接波の届かない距離で受信し、
   流星飛跡のプラズマ柱に前方散乱された電波（流星エコー）を捉える。昼間・悪天候でも
   計数できるため、光学が使えない条件を埋める。表示は HROFFT 形式のスペクトログラム
   （横軸＝時刻、縦軸＝ビーコンからの周波数差、色＝強度）に倣う。 */
NS.HRO_FREQ = 53.755;

function hh(n) {                       /* 32bit ハッシュ（Math.imul で桁あふれを避ける） */
  n = n | 0;
  n = ((n << 13) ^ n) | 0;
  var m = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) | 0;
  return ((m & 0x7fffffff) / 2147483647);
}
/* 流星エコーの発生率（1 時間あたり）。明け方に多く、夕方に少ない日周変化 */
NS.hroRate = function (st, t) {
  var p = NS.jstParts(t), h = p.h + p.mi / 60;
  var diurnal = 0.55 + 0.45 * Math.cos((h - 6) / 24 * 2 * Math.PI);   /* 6 時に極大 */
  var doy = (t / 86400e3) % 365.25;
  var seas = 1 + 0.25 * Math.sin(2 * Math.PI * (doy - 200) / 365.25);
  return 26 * diurnal * seas * (0.85 + 0.3 * hh(NS.hash(st.id) + Math.floor(t / 3600e3)));
};
/* 窓内のエコー一覧を返す（決定論的） */
NS.hroEchoes = function (st, t0, t1) {
  var seed = NS.hash(st.id + 'hro') | 0, out = [];
  var rate = NS.hroRate(st, (t0 + t1) / 2 * 1000) / 3600;             /* 毎秒 */
  for (var s = Math.floor(t0) - 30; s < t1; s++) {
    var u = hh(seed + s);
    if (u > rate) continue;
    var r2 = hh(seed + s * 7 + 11), r3 = hh(seed + s * 13 + 23), r4 = hh(seed + s * 17 + 37);
    var over = r2 > 0.86;                                             /* 継続時間の長い過密エコー */
    out.push({ t:s + hh(seed + s * 3) , dur:over ? 1.5 + r3 * 22 : 0.06 + r3 * 0.5,
      f0:60 + r4 * 520, amp:over ? 0.75 + 0.25 * r2 : 0.30 + 0.55 * r2,
      head:r2 > 0.62, over:over });
  }
  return out;
};
/* HROFFT 風のカラーマップ（黒 → 青 → 水 → 緑 → 黄 → 赤 → 白） */
var HRO_MAP = [[0,4,6,16],[0.16,12,28,92],[0.32,10,110,150],[0.48,20,165,90],
               [0.64,210,200,40],[0.80,235,110,30],[0.92,245,60,60],[1,255,246,238]];
function hroColor(v) {
  if (v <= 0) return HRO_MAP[0];
  for (var i = 1; i < HRO_MAP.length; i++) {
    if (v <= HRO_MAP[i][0]) {
      var f = (v - HRO_MAP[i-1][0]) / (HRO_MAP[i][0] - HRO_MAP[i-1][0]);
      return [0, HRO_MAP[i-1][1] + (HRO_MAP[i][1] - HRO_MAP[i-1][1]) * f,
                 HRO_MAP[i-1][2] + (HRO_MAP[i][2] - HRO_MAP[i-1][2]) * f,
                 HRO_MAP[i-1][3] + (HRO_MAP[i][3] - HRO_MAP[i-1][3]) * f];
    }
  }
  return HRO_MAP[HRO_MAP.length - 1];
}

NS.HroFft = function (station, opts) {
  opts = opts || {};
  var W = opts.width || 268, H = opts.height || 78, padL = 22, padB = 11;
  var iw = W - padL, ih = H - padB;
  var A = { station:station, win:opts.win || 600, running:false };
  var cv = NS.el('canvas', { class:'hrofft', width:W * 2, height:H * 2, style:{ width:'100%', height:'auto' } });
  cv.style.aspectRatio = W + ' / ' + H;
  var ctx = cv.getContext('2d');
  A.node = cv;
  var img = ctx.createImageData ? ctx.createImageData(iw, ih) : null;
  var F0 = -120, F1 = 760;                      /* 表示する周波数差の範囲（Hz） */

  A.setWin = function (sec) { A.win = sec; A.render(); };
  A.render = function () {
    if (!img || !img.data) return;                  /* 画像バッファを扱えない環境では描画しない */
    var t1 = NS.now() / 1000, t0 = t1 - A.win, st = A.station;
    var ech = NS.hroEchoes(st, t0, t1);
    var seed = NS.hash(st.id + 'nz') | 0;
    var d = img.data, dt = A.win / iw, df = (F1 - F0) / ih;
    var lev = new Float32Array(iw * ih);
    /* 背景雑音と直接波 */
    for (var x = 0; x < iw; x++) {
      for (var y = 0; y < ih; y++) {
        var fr = F1 - y * df;
        var v = 0.035 + 0.055 * hh(seed + x * 977 + y * 31) + 0.03 * Math.exp(-Math.abs(fr) / 420);
        if (Math.abs(fr) < 5) v += 0.30 + 0.08 * hh(seed + x * 13);   /* ビーコンの直接波 */
        lev[y * iw + x] = v;
      }
    }
    /* 流星エコーは 1 画素未満に潰れるので、画素範囲を求めて直接描き込む */
    for (var k = 0; k < ech.length; k++) {
      var E = ech[k];
      var xa = Math.floor((E.t - t0) / dt), xb = Math.ceil((E.t + E.dur - t0) / dt);
      if (xb <= xa) xb = xa + 1;
      if (xb < 0 || xa > iw) continue;
      var wfq = E.over ? 20 : 8;
      for (var xx = Math.max(0, xa - 1); xx <= Math.min(iw - 1, xb); xx++) {
        /* 画素内での減衰（過密エコーは尾を引く） */
        var frac = (xx - xa) / Math.max(1, xb - xa);
        var env = xx < xa ? 0.45 : (E.over ? 1 - 0.5 * frac : Math.max(0.35, 1 - frac));
        /* ヘッドエコーは立ち上がりで周波数が高いほうへ伸びる */
        var spread = (E.head && xx <= xa + 1) ? 170 : 0;
        for (var yy = 0; yy < ih; yy++) {
          var fr2 = F1 - yy * df;
          var g = Math.exp(-Math.pow((fr2 - E.f0) / wfq, 2));
          if (spread && fr2 > E.f0) g = Math.max(g, 0.55 * Math.exp(-Math.pow((fr2 - E.f0) / spread, 2)));
          if (g < 0.02) continue;
          lev[yy * iw + xx] += E.amp * env * g;
        }
      }
    }
    for (var i2 = 0; i2 < iw * ih; i2++) {
      var c = hroColor(Math.min(1, lev[i2]));
      var o = i2 * 4;
      d[o] = c[1]; d[o + 1] = c[2]; d[o + 2] = c[3]; d[o + 3] = 255;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    /* ImageData を 2 倍に拡大して描く */
    var tmp = document.createElement('canvas');
    tmp.width = iw; tmp.height = ih;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, padL * 2, 0, iw * 2, ih * 2);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    /* 目盛 */
    ctx.font = '7.5px ui-monospace, monospace'; ctx.fillStyle = 'rgba(150,160,176,0.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    [0, 200, 400, 600].forEach(function (f) {
      var y2 = (F1 - f) / (F1 - F0) * ih;
      ctx.fillText(f === 0 ? '0' : String(f), padL - 3, y2);
      ctx.strokeStyle = 'rgba(150,160,176,0.25)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(padL - 2, y2); ctx.lineTo(padL, y2); ctx.stroke();
    });
    ctx.save(); ctx.translate(6, ih / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText('Hz', 0, 0); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var step = A.win <= 300 ? 60 : A.win <= 900 ? 180 : 600;
    for (var tg = Math.ceil(t0 / step) * step; tg <= t1; tg += step) {
      ctx.fillText(NS.fmtJST(tg * 1000, { timeOnly:true, sec:false }), padL + (tg - t0) / A.win * iw, ih + 1);
    }
    A.count = ech.filter(function (E) { return E.t > t1 - 3600; }).length;
    A.echoes = ech;
  };
  var timer = null;
  A.start = function () { if (A.running) return; A.running = true; A.render(); timer = setInterval(A.render, 1000); };
  A.stop = function () { A.running = false; if (timer) clearInterval(timer); timer = null; };
  return A;
};

/* ===================== 2 周波 GNSS ===================== */
NS.gnssState = function (st, t) {
  var r = NS.rng(st.id + '|gnss|' + Math.floor(t / 60000));
  var sats = { GPS:r.int(7, 11), QZSS:r.int(2, 4), Galileo:r.int(5, 9), GLONASS:r.int(5, 8) };
  var n = sats.GPS + sats.QZSS + sats.Galileo + sats.GLONASS;
  /* 電離圏 TEC：日変化（14 時前後に極大）＋ 緯度依存 */
  var p = NS.jstParts(t), h = p.h + p.mi / 60;
  var diurnal = 0.32 + 0.68 * Math.max(0, Math.cos((h - 14) / 24 * 2 * Math.PI));
  var tec = (7 + 22 * diurnal) * (1 + (35 - st.lat) * 0.012) + r.norm(0, 0.4);
  return { sats:sats, n:n, pdop:1.0 + r.range(0, 0.9), tec:tec,
    ppsNs:r.norm(0, 18), lock:true,
    rate:'30 s（TEC）／ 1 Hz（測位）', mode:'L1 / L2 二周波' };
};

/* ===================== まとめ：各センサーのカード群 ===================== */
/* =========================================================================
   宇宙線計測（Accel Kitchen 素粒子検出器組み立てキット）
   プラスチックシンチレータ 5×5×1 cm ＋ SiPM ＋ ESP32。海面での計数は
   おおむね毎分 30 前後で、気圧・気温・太陽活動でわずかに上下する。
   その「わずかな上下」を全 14 局で同時に測ることが、この装置の狙いである。
   ========================================================================= */
NS.CR = {
  area:25,            /* 受光面積 cm²（5 × 5 cm） */
  base:34.0,          /* 海面・1013.25 hPa での計数 cpm（ミューオン ＋ 環境ガンマ） */
  beta:-0.0015,       /* 気圧効果 −0.15 %/hPa（ミューオンの代表値） */
  alphaT:-0.0009,     /* 気温効果 −0.09 %/K（成層圏の実効気温に対する） */
  hAtm:8434           /* 気圧の尺度高さ m。標高による増加は気圧効果そのものとして扱う */
};
/* 地磁気の遮断能（vertical cutoff rigidity）。日本では南ほど高く、北ほど低い。
   遮断能が高いほど届く一次宇宙線が減るので、計数はわずかに下がる。 */
NS.crRigidity = function (lat) { return 11.9 - (lat - 31.9) * 0.155; };

/* 太陽活動に伴う変動。フォーブッシュ減少（CME の通過で数 % 下がり、数日かけて戻る）を含む。 */
NS.crSolar = function (t) {
  var day = t / 86400e3;
  var slow = 0.006 * Math.sin(day / 58.0);            /* 27 日周期（太陽自転）ほかの緩い変動 */
  var onset = NS.CR_FB_T || (NS.CR_FB_T = NS.now() - 21.3 * 86400e3);
  var dt = (t - onset) / 86400e3, fb = 0;
  if (dt > 0) fb = -0.058 * Math.exp(-dt / 2.6) * (1 - Math.exp(-dt / 0.18));
  return { slow:slow, forbush:fb, total:slow + fb };
};

/* ある局・ある時刻の期待計数（雑音なし）。標高と天気の効果はどちらも「頭上の大気の量」なので、
   現地気圧ひとつにまとめて扱う。分けて表示するときだけ、標高ぶんと天気ぶんに切り分ける。 */
NS.crMean = function (st, t) {
  var w = NS.weather(st, t);
  var k = Math.exp(-st.alt / NS.CR.hAtm);
  var pRef = 1013.25 * k;                             /* この局の平年の現地気圧 */
  var pSta = w.press * k;                             /* いまの現地気圧 */
  var baroAlt = Math.exp(NS.CR.beta * (pRef - 1013.25));   /* 標高ぶん（常に一定） */
  var baroWx  = Math.exp(NS.CR.beta * (pSta - pRef));      /* 天気による日々の変動 */
  var rig = 1 - (NS.crRigidity(st.lat) - 11.0) * 0.021;
  var tEff = -55 + (w.temp - 15) * 0.35;              /* 成層圏の実効気温（地上気温と緩く連動） */
  var temp = Math.exp(NS.CR.alphaT * (tEff + 55));
  var sol = NS.crSolar(t);
  var diurnal = 1 + 0.004 * Math.sin((t / 3600e3 % 24 - 15) / 24 * 2 * Math.PI);
  return { mean:NS.CR.base * baroAlt * baroWx * rig * temp * diurnal * (1 + sol.total),
           baroAlt:baroAlt, baroWx:baroWx, pSta:pSta, pRef:pRef, press:w.press,
           rig:NS.crRigidity(st.lat), temp:temp, solar:sol };
};

/* 1 分値。計数はポアソン統計に従うので、期待値のまわりに ±√N でばらつく。 */
NS.cosmicRay = function (st, t) {
  var m = NS.crMean(st, t);
  var r = NS.rng(st.id + '|cr|' + Math.floor(t / 60000));
  var obs = Math.max(0, m.mean + r.norm(0, Math.sqrt(m.mean)));
  return { cpm:obs, mean:m.mean, press:m.press, pSta:m.pSta,
           baro:(m.baroWx - 1) * 100, alt:(m.baroAlt - 1) * 100,
           rig:m.rig, solar:m.solar, sigma:Math.sqrt(m.mean),
           /* 天気による気圧変動ぶんだけを取り除く。局ごとの標高差はそのまま残す */
           corr:obs / m.baroWx };
};

/* 全 14 局を合計した系列。1 点あたり avgMin 分ぶんを平均するので、
   統計誤差は √(計数 / 分数) まで下がる。1 台では埋もれる数 % がここで見えてくる。 */
NS.crNetSeries = function (days, stepH) {
  var t1 = NS.now(), out = [];
  var avgMin = stepH * 60;
  for (var h = -days * 24; h <= 0; h += stepH) {
    var t = t1 + h * 3600e3, mRaw = 0, mCor = 0, pSum = 0;
    NS.STATIONS.forEach(function (st) {
      var m = NS.crMean(st, t);
      mRaw += m.mean; mCor += m.mean / m.baroWx; pSum += m.press;
    });
    var r = NS.rng('crnet' + h);
    var sd = Math.sqrt(mRaw / avgMin);                /* 合計計数の統計誤差 */
    var n = r.norm(0, sd);
    out.push({ t:t, h:h, raw:mRaw + n, corr:mCor + n / 1.0, press:pSum / NS.STATIONS.length });
  }
  return out;
};

/* 1 局の系列（比較用） */
NS.crSeries = function (st, days, stepH) {
  var t1 = NS.now(), out = [], avgMin = stepH * 60;
  for (var h = -days * 24; h <= 0; h += stepH) {
    var t = t1 + h * 3600e3, m = NS.crMean(st, t), r = NS.rng(st.id + '|crs|' + h);
    var n = r.norm(0, Math.sqrt(m.mean / avgMin));
    out.push({ t:t, h:h, raw:m.mean + n, corr:m.mean / m.baroWx + n });
  }
  return out;
};

/* 雷雲に伴う地上放射線増加（TGE）。雷放電のインフラサウンド検知と同じ時間帯に現れる。 */
NS.crTGE = function (st, t) {
  var w = NS.weather(st, t);
  var active = w.rain > 4 && w.cloud > 0.85;
  if (!active) return null;
  var r = NS.rng(st.id + '|tge|' + Math.floor(t / 600000));
  var amp = 0.08 + r() * 0.42;                        /* 平常比 ＋8 〜 50 % */
  return { amp:amp, band:'0.2 – 10 MeV', dur:Math.round(3 + r() * 14),
           note:'雷雲の電場で加速された電子が制動放射を出す現象。雷放電の直前に増加し、放電と同時に止まることが多い' };
};

NS.sensorCards = function (kind, go) {
  var t = NS.now();
  return NS.liveOrder().map(function (st) {
    var s2 = NS.stationState(st, t), w = s2.weather;
    var head = NS.el('div', { class:'sn-h' }, [
      NS.el('b', { text:st.name }), NS.el('span', { class:'sid', text:st.id }), NS.el('div', { class:'spacer' })]);
    var card = NS.el('div', { class:'sncard', onclick:function () { go('station', st.id); }, role:'button', tabindex:'0' }, [head]);
    if (kind === 'met') {
      var wl = NS.wbgtLevel(w.wbgt);
      var spark = [];
      for (var i = -24; i <= 0; i++) spark.push(NS.weather(st, t + i * 3600e3).temp);
      NS.add(head, NS.el('span', { class:'hint', text:s2.sub.filter(function (x) { return x.key === 'met'; })[0].ok ? '正常' : '障害' }));
      NS.add(card, [
        NS.el('div', { class:'sn-big' }, [NS.f(w.temp, 1), NS.el('small', { text:'℃' }),
          NS.el('span', { class:'sn-sub', text:'湿度 ' + NS.f(w.rh, 0) + ' %' })]),
        NS.el('div', { class:'sn-rows' }, [
          NS.el('span', { html:'気圧 <b>' + NS.f(w.press, 1) + '</b> hPa' }),
          NS.el('span', { html:'風 <b>' + NS.f(w.wind, 1) + '</b> m/s ' + NS.compass(w.dir) }),
          NS.el('span', { html:'雨量 <b>' + NS.f(w.rain, 1) + '</b> mm/h' }),
          NS.el('span', { html:'日射 <b>' + NS.f(w.solar, 2) + '</b> kW/m²' }),
          NS.el('span', { html:'WBGT <b style="color:' + wl.color + '">' + NS.f(w.wbgt, 1) + '</b> ℃' }),
          NS.el('span', { html:'雲量 <b>' + Math.round(w.cloud * 100) + '</b> %' })]),
        NS.el('div', { class:'sn-foot' }, [NS.el('span', { class:'hint', text:'気温 24 時間' }), NS.chart.spark(spark, { color:'var(--c-warn)', width:96, height:20 })])
      ]);
    } else if (kind === 'cray') {
      var cr = NS.cosmicRay(st, t), tge = NS.crTGE(st, t);
      var sp = [];
      for (var m = -60; m <= 0; m++) sp.push(NS.cosmicRay(st, t + m * 60000).cpm);
      NS.add(head, NS.el('span', { class:'hint', text:s2.sub.filter(function (x) { return x.key === 'cray'; })[0].ok ? '正常' : '障害' }));
      NS.add(card, [
        NS.el('div', { class:'sn-big' }, [NS.f(cr.cpm, 1), NS.el('small', { text:'cpm' }),
          NS.el('span', { class:'sn-sub', text:'± ' + NS.f(cr.sigma, 1) + '（統計誤差）' })]),
        NS.el('div', { class:'sn-rows' }, [
          NS.el('span', { html:'気圧補正後 <b>' + NS.f(cr.corr, 1) + '</b> cpm' }),
          NS.el('span', { html:'現地気圧 <b>' + NS.f(cr.pSta, 1) + '</b> hPa' }),
          NS.el('span', { html:'天気ぶん <b>' + NS.f(cr.baro, 2) + '</b> %' }),
          NS.el('span', { html:'標高ぶん <b>＋' + NS.f(cr.alt, 2) + '</b> %' }),
          NS.el('span', { html:'遮断能 <b>' + NS.f(cr.rig, 2) + '</b> GV' }),
          NS.el('span', { html:'太陽成分 <b>' + NS.f(cr.solar.total * 100, 2) + '</b> %' })]),
        tge ? NS.el('div', { class:'sn-rows' }, NS.el('span', { class:'tge',
          html:'雷雲ガンマ線 <b>＋' + Math.round(tge.amp * 100) + ' %</b>（' + tge.band + '）' })) : null,
        NS.el('div', { class:'sn-foot' }, [NS.el('span', { class:'hint', text:'計数 60 分' }),
          NS.chart.spark(sp, { color:'var(--c-spec)', width:96, height:20 })])
      ]);
    } else if (kind === 'sqm') {
      var sb = NS.skyBrightness(st, t), mag = sb.mag == null ? st.sqm : sb.mag;
      var bt = NS.bortle(mag), pts = [];
      for (var j = -14; j <= 0; j += 0.5) {
        var b2 = NS.skyBrightness(st, t + j * 3600e3);
        if (b2.mag != null) pts.push(b2.mag);
      }
      NS.add(head, NS.el('span', { class:'hint', text:sb.mag == null ? '薄明・昼間' : '測定中' }));
      NS.add(card, [
        NS.el('div', { class:'sn-big', style:{ color:NS.SQM_SCALE(mag) } }, [NS.f(mag, 2),
          NS.el('small', { text:'mag/arcsec²' }),
          sb.mag == null ? NS.el('span', { class:'sn-sub', text:'平常値' }) : null]),
        NS.el('div', { class:'sn-rows' }, [
          NS.el('span', { html:'Bortle <b>' + bt.n + '</b>' }), NS.el('span', { class:'sm', text:bt.label }),
          NS.el('span', { html:'光害量 <b>' + NS.f(21.9 - st.sqm, 2) + '</b> 等' }),
          NS.el('span', { html:'月 輝面比 <b>' + Math.round(NS.moonIllum(t) * 100) + '</b> %' })]),
        NS.el('div', { class:'sn-foot' }, [NS.el('span', { class:'hint', text:pts.length > 3 ? '直近の夜' : 'データ待ち' }),
          pts.length > 3 ? NS.chart.spark(pts, { color:'var(--c-sky)', width:96, height:20 }) : null])
      ]);
    } else if (kind === 'gnss') {
      var g = NS.gnssState(st, t), tp = [];
      for (var k2 = -12; k2 <= 0; k2++) tp.push(NS.gnssState(st, t + k2 * 3600e3).tec);
      NS.add(head, NS.el('span', { class:'hint', text:'PPS 同期 ' + (g.ppsNs > 0 ? '+' : '') + NS.f(g.ppsNs, 0) + ' ns' }));
      NS.add(card, [
        NS.el('div', { class:'sn-big' }, [NS.f(g.tec, 1), NS.el('small', { text:'TECU' }),
          NS.el('span', { class:'sn-sub', text:'鉛直全電子数' })]),
        NS.el('div', { class:'sn-rows' }, [
          NS.el('span', { html:'受信衛星 <b>' + g.n + '</b> 機' }), NS.el('span', { html:'PDOP <b>' + NS.f(g.pdop, 2) + '</b>' }),
          NS.el('span', { class:'sm', text:'GPS ' + g.sats.GPS + ' / QZSS ' + g.sats.QZSS }),
          NS.el('span', { class:'sm', text:'Galileo ' + g.sats.Galileo + ' / GLONASS ' + g.sats.GLONASS }),
          NS.el('span', { class:'sm', text:g.mode }), NS.el('span', { class:'sm', text:g.rate })]),
        NS.el('div', { class:'sn-foot' }, [NS.el('span', { class:'hint', text:'TEC 12 時間' }), NS.chart.spark(tp, { color:'var(--c-info)', width:96, height:20 })])
      ]);
    }
    return card;
  });
};

})(NS);
