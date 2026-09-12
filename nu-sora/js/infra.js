/* NU-SORA デモ / インフラサウンド 実況グラフ
   複合型インフラサウンドセンサー（株式会社サヤ INF03 ／ 高知工科大学と共同開発の
   ADXII-INF01 系）が出力する 6 チャンネルを、全 14 局ぶん並べて実時間で描く。
     HF 1–20 Hz      高周波帯（雷放電・爆発音・近傍の人工雑音）
     MF 0.1–1 Hz     中周波帯（脈動微気圧振動＝マイクロバロム、火球衝撃波）
     LF 0.005–0.1 Hz 低周波帯（大気重力波・津波・気圧変動）
     X / Y / Z       3 成分加速度（常時微動。校舎の応答と地震）
   表示の体裁は、気象協会「インフラサウンド・モニタリング・ネットワーク」実況グラフ
   （https://micos-sc.jwa.or.jp/infrasound-net/observed/）および高知工科大学 KISONS
   （https://geosci.mydns.jp/infrasound/graph.php）を参考にした。波形自体は模擬である。 */
'use strict';
(function (NS) {

NS.INFRA_CH = [
  { key:'HF', name:'HF', band:'1–20 Hz',      unit:'Pa',  color:'#D6405F', scale:0.35 },
  { key:'MF', name:'MF', band:'0.1–1 Hz',     unit:'Pa',  color:'#4585CC', scale:0.55 },
  { key:'LF', name:'LF', band:'0.005–0.1 Hz', unit:'Pa',  color:'#3FA07A', scale:0.90 },
  { key:'X',  name:'X',  band:'0.1–10 Hz',    unit:'gal', color:'#C9A227', scale:2.2 },
  { key:'Y',  name:'Y',  band:'0.1–10 Hz',    unit:'gal', color:'#C77DBB', scale:2.2 },
  { key:'Z',  name:'Z',  band:'0.1–10 Hz',    unit:'gal', color:'#7C6FD0', scale:3.0 }
];
NS.INFRA_CHMAP = {}; NS.INFRA_CH.forEach(function (c) { NS.INFRA_CHMAP[c.key] = c; });

/* 高速な 1 次元ハッシュ雑音（時間的に滑らかに変化する乱数）。
   32 bit 整数として計算する必要があるため、乗算は Math.imul を使う
   （通常の * では積が 2^53 を超えて下位ビットが失われ、定数を返してしまう）。 */
function h1(n) {
  n = n | 0;
  n = ((n << 13) ^ n) | 0;
  var m = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) | 0;
  return 1 - (m & 0x7fffffff) / 1073741824;
}
function nz(seed, x) {
  var i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  return h1(seed + i) * (1 - s) + h1(seed + i + 1) * s;
}
/* 雑音の引数が大きくなりすぎないよう、基準時刻からの秒数で扱う */
NS.INFRA_T0 = 1767225600;   /* 2026-01-01 00:00 UTC */
function rel(tsec) { return tsec - NS.INFRA_T0; }

/* 波形は「ゆっくり変わる振幅（包絡線）」と「その帯域の振動（搬送波）」に分けて持つ。
   時間窓が長いと搬送波は 1 画素に何周期も入って解像できないため、実際の実況グラフと
   同じく ±包絡線の帯として描き、窓が短いときだけ波形そのものを描く。 */
NS.INFRA_CYCLE = { HF:0.16, MF:5.0, LF:90, X:0.5, Y:0.5, Z:0.5 };   /* 代表周期（秒） */

NS.infraEnv = function (st, ch, tsec, env) {
  tsec = rel(tsec);
  var sd = (NS.hash(st.id + ch) & 0x7fffff) | 0;
  var wind = env.wind, stormy = (env.rain > 1.5 || env.cloud > 0.88);
  switch (ch) {
    case 'HF': {
      var base = (0.009 + 0.026 * wind / 5) * (0.45 + 1.05 * Math.abs(nz(sd, tsec * 0.035)));
      if (stormy) {
        var e1 = nz(sd + 7, tsec * 0.16);                            /* 10 秒前後の間隔 */
        if (e1 > 0.84) base += (e1 - 0.84) * 9.0;                    /* 雷放電の突発 */
        var e2 = nz(sd + 71, tsec * 0.9);
        if (e2 > 0.93) base += (e2 - 0.93) * 6.0;                    /* 近傍の落雷 */
      }
      return base;
    }
    case 'MF':
      /* マイクロバロム。海況で数十分かけて強弱する */
      return 0.045 + 0.14 * Math.abs(nz(sd + 3, tsec * 0.0016)) + 0.035 * wind / 5;
    case 'LF':
      return 0.34 + 0.12 * Math.abs(nz(sd + 17, tsec * 0.0009));
    default: {
      var g = (ch === 'Z' ? 1.3 : 1.0) * (0.32 + 0.42 * wind / 5);
      return g * (0.55 + 0.85 * Math.abs(nz(sd + 23, tsec * 0.03)));
    }
  }
};
/* 搬送波（−1〜1）。窓が短いときだけ使う */
NS.infraCarrier = function (st, ch, tsec) {
  tsec = rel(tsec);
  var sd = (NS.hash(st.id + ch) & 0x7fffff) | 0;
  switch (ch) {
    case 'HF':
      return 0.75 * nz(sd + 41, tsec * 9.0) + 0.35 * nz(sd + 43, tsec * 22.0);
    case 'MF':
      return Math.sin(2 * Math.PI * 0.20 * tsec + nz(sd + 5, tsec * 0.01) * 6) * 0.85
           + 0.25 * nz(sd + 13, tsec * 1.1);
    case 'LF':
      return nz(sd + 19, tsec * 0.011) + 0.35 * nz(sd + 21, tsec * 0.045);
    default:
      return 0.8 * nz(sd + 29, tsec * 2.1) + 0.45 * nz(sd + 31, tsec * 5.6) + 0.2 * nz(sd + 37, tsec * 13);
  }
};
NS.infraSignal = function (st, ch, tsec, env) {
  return NS.infraEnv(st, ch, tsec, env) * NS.infraCarrier(st, ch, tsec);
};

/* =============== 1 局ぶんの実況グラフ =============== */
NS.InfraStrip = function (station, opts) {
  opts = opts || {};
  var W = opts.width || 300, rowH = opts.rowH || 26, padL = 30, padR = 4;
  var A = { station:station, chans:opts.chans || ['HF', 'MF', 'LF'], win:opts.win || 300, running:false };
  var cv = NS.el('canvas', { class:'infstrip', style:{ width:'100%', height:'auto' } });
  var ctx = cv.getContext('2d');
  A.node = cv;

  function resize() {
    var h = A.chans.length * rowH + 14;
    cv.width = W * 2; cv.height = h * 2;
    cv.style.aspectRatio = W + ' / ' + h;
    A.H = h;
  }
  A.setChans = function (list) { A.chans = list.slice(); resize(); A.render(); };
  A.setWin = function (sec) { A.win = sec; A.render(); };

  /* 窓内の最大振幅に合わせてフルスケールを決める（実況グラフと同じく自動レンジ） */
  A.fullScale = function (key, t0, t1, env) {
    var C = NS.INFRA_CHMAP[key], mx = 0, n = 48;
    for (var i = 0; i <= n; i++) {
      var e2 = NS.infraEnv(A.station, key, t0 + (t1 - t0) * i / n, env);
      if (e2 > mx) mx = e2;
    }
    mx *= 1.25;
    return Math.max(C.scale * 0.25, mx);
  };
  A.render = function () {
    var t1 = NS.now() / 1000, t0 = t1 - A.win;
    var st = A.station, w = NS.weather(st, NS.now());
    var env = { wind:w.wind, cloud:w.cloud, rain:w.rain };
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, A.H);
    var iw = W - padL - padR;
    /* 時刻の縦グリッド */
    ctx.strokeStyle = 'rgba(128,140,156,0.20)'; ctx.lineWidth = 0.6;
    var step = A.win <= 120 ? 30 : A.win <= 600 ? 120 : A.win <= 1800 ? 300 : 900;
    ctx.font = '8px ui-monospace, monospace'; ctx.textBaseline = 'top';
    for (var tg = Math.ceil(t0 / step) * step; tg <= t1; tg += step) {
      var gx = padL + (tg - t0) / A.win * iw;
      ctx.beginPath(); ctx.moveTo(gx, 2); ctx.lineTo(gx, A.chans.length * rowH + 2); ctx.stroke();
      ctx.fillStyle = 'rgba(128,140,156,0.65)'; ctx.textAlign = 'center';
      ctx.fillText(NS.fmtJST(tg * 1000, { timeOnly:true, sec:A.win <= 120 }), gx, A.chans.length * rowH + 3);
    }
    A.chans.forEach(function (key, r) {
      var C = NS.INFRA_CHMAP[key], y0 = r * rowH + 2, mid = y0 + rowH / 2;
      var full = A.fullScale(key, t0, t1, env);
      /* 基線 */
      ctx.strokeStyle = 'rgba(128,140,156,0.28)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(padL, mid); ctx.lineTo(W - padR, mid); ctx.stroke();
      /* 1 画素あたりの時間で、搬送波を解像できるか判定する */
      var dtPx = A.win / iw, cyc = NS.INFRA_CYCLE[key];
      var resolve = cyc >= dtPx * 3;
      var half = (rowH / 2 - 2) / full, sub = resolve ? 5 : 1;
      var clamp = function (v) { return Math.max(-rowH / 2 + 1.5, Math.min(rowH / 2 - 1.5, v)); };
      ctx.strokeStyle = C.color; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (var px = 0; px < iw; px++) {
        var x = padL + px + 0.5, ya, yb;
        if (resolve) {
          var lo = 1e9, hi = -1e9;
          for (var k = 0; k < sub; k++) {
            var tt = t0 + (px + k / sub) * dtPx;
            var v = NS.infraSignal(st, key, tt, env);
            if (v < lo) lo = v; if (v > hi) hi = v;
          }
          ya = mid - clamp(hi * half); yb = mid - clamp(lo * half);
        } else {
          /* 解像できない帯域は、その画素に入る振動の最大振幅を帯として描く。
             搬送波を 1 点サンプルして揺らぎを与えることで、実測と同じくぎざぎざになる */
          var tt2 = t0 + px * dtPx;
          var en = NS.infraEnv(st, key, tt2, env);
          var pk = en * (0.40 + 0.62 * Math.abs(NS.infraCarrier(st, key, tt2 * 7.3)));
          ya = mid - clamp(pk * half); yb = mid + clamp(pk * half);
        }
        ctx.moveTo(x, ya); ctx.lineTo(x, yb + 0.4);
      }
      ctx.stroke();
      /* チャンネル名 */
      ctx.font = '600 9px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.color; ctx.fillText(C.name, 2, mid);
      ctx.font = '7.5px ui-monospace, monospace'; ctx.fillStyle = 'rgba(128,140,156,0.7)';
      ctx.fillText(C.unit, 2, mid + 9);
      /* フルスケールの表示（右端） */
      ctx.textAlign = 'right';
      ctx.fillText('±' + (full < 0.1 ? full.toFixed(3) : full.toFixed(2)), W - padR - 1, y0 + 5);
      ctx.textAlign = 'left';
    });
  };
  var timer = null;
  A.start = function () { if (A.running) return; A.running = true; A.render(); timer = setInterval(A.render, 500); };
  A.stop = function () { A.running = false; if (timer) clearInterval(timer); timer = null; };
  resize();
  return A;
};

})(NS);
