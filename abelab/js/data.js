/* NU-AbeLab / データ層
   ふだんは模擬データを返すが、実データを流し込めばそのまま置き換わる。
   入口は AL.ingest.*（UFOCapture の XML / CSV / 死活 JSON）。
   模擬は種から決まるので、何度描き直しても同じ値になる。 */
'use strict';
(function (AL) {

var HOUR = 3600e3;
AL.data = { source: 'sim' };
var REAL = { events: {}, status: {}, loadedAt: null };   /* 実データを入れる置き場 */
var CACHE = {};

/* ================= 気象（模擬）=================
   6 時間・24 時間・5 日の 3 つの滑らかな成分を重ねて雲量を作る。局ごとに位相をずらす。 */
function noise(seed, x) {
  var i = Math.floor(x), f = x - i;
  var a = AL.rng(seed + '|' + i)(), b = AL.rng(seed + '|' + (i + 1))();
  var s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}
AL.data.cloud = function (st, t) {
  var h = t / HOUR;
  var v = 0.52 * noise(st.id + 'c5', h / 120) + 0.32 * noise(st.id + 'c1', h / 24) + 0.16 * noise(st.id + 'c6', h / 6);
  /* 山の上の 2 局は晴天率が高い。都市部の船橋はやや曇りがち */
  var bias = st.elev > 500 ? -0.14 : 0.04;
  return AL.clamp(Math.pow(AL.clamp(v + bias, 0, 1), 1.35), 0, 1);
};
AL.data.temp = function (st, t) {
  var p = AL.parts(t), doy = (Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(p.y, 0, 1)) / 86400e3;
  var season = 14.5 - 11.5 * Math.cos((doy - 25) / 365.25 * 2 * Math.PI);   /* 年変化 */
  var diurnal = -4.2 * Math.cos((p.h + p.mi / 60 - 14.5) / 24 * 2 * Math.PI);
  return season + diurnal - st.elev * 0.0062 + 1.6 * (noise(st.id + 'T', t / HOUR / 8) - 0.5);
};

/* ================= 観測条件 ================= */
AL.data.cond = function (st, t) {
  var sb = AL.skyBrightness(t, st);
  var cloud = AL.data.cloud(st, t);
  var sqm = sb.sqm - cloud * (st.elev > 500 ? 0.9 : -0.6);     /* 曇ると暗所では暗く、都市では明るくなる */
  /* 限界等級は空の暗さでほぼ決まる。快晴・暗夜で機材の限界 6.0 等 */
  var lim = AL.clamp(AL.RIG.limMag - 0.72 * Math.max(0, 21.4 - sqm) - 3.4 * Math.pow(cloud, 1.8), -1, 6.5);
  return { sunAlt: sb.sunAlt, moonAlt: sb.moonAlt, illum: sb.illum, age: sb.age,
           cloud: cloud, sqm: sqm, limMag: lim, temp: AL.data.temp(st, t),
           obs: AL.isObsTime(t, st) };
};

/* ================= 障害（模擬）=================
   夜ごとに種を決め、低い確率で曇天停止・カメラ再起動・回線断を起こす。 */
AL.data.incidents = function (st, nightStart) {
  var key = 'i' + st.id + nightStart;
  if (CACHE[key]) return CACHE[key];
  var r = AL.rng('inc' + st.id + nightStart), out = [];
  var n = AL.night(nightStart + 18 * HOUR, st);
  if (n.obsStart && r() < (st.id === 'FNB' ? 0.22 : 0.12)) {
    var dur = (0.4 + r() * 2.6) * HOUR;
    var t0 = n.obsStart + r() * Math.max(1, (n.obsEnd - n.obsStart - dur));
    var kinds = [
      ['camera', '映像入力の瞬断。UFOCapture を自動再起動', 'warning'],
      ['net',    '回線断。録画は継続、転送のみ滞留', 'warning'],
      ['disk',   '書き込みエラー。予備ディスクへ退避', 'serious'],
      ['daq',    'DAQ プロセス停止。監視スクリプトが再起動', 'serious']
    ];
    var k = kinds[Math.floor(r() * kinds.length)];
    out.push({ st: st.id, kind: k[0], text: k[1], level: k[2], t0: t0, t1: t0 + dur });
  }
  CACHE[key] = out;
  return out;
};
function faultAt(st, t) {
  var inc = AL.data.incidents(st, AL.nightOf(t));
  for (var i = 0; i < inc.length; i++) if (t >= inc[i].t0 && t < inc[i].t1) return inc[i];
  return null;
}

/* ================= 期待トリガー率 =================
   DIMS の実測（暗夜で毎時 50–70 件）を基準に、月明かり・雲・薄明・流星群で変調する。 */
AL.data.rate = function (st, t) {
  var c = AL.data.cond(st, t);
  if (!c.obs) return { rate: 0, cond: c, shower: 0, state: c.sunAlt > -6 ? 'daytime' : 'standby' };
  var f = faultAt(st, t);
  if (f && (f.kind === 'daq' || f.kind === 'camera')) return { rate: 0, cond: c, shower: 0, state: 'fault', fault: f };
  /* 空の明るさでトリガー閾値が上がり、暗い流星が落ちる */
  var moonF = AL.clamp(Math.pow(10, -0.33 * Math.max(0, st.sqm - c.sqm)), 0.12, 1);
  var cloudF = Math.pow(1 - c.cloud, 1.6);
  var twiF = AL.clamp((-c.sunAlt - 10) / 8, 0, 1);
  /* 流星群の寄与。輻射点が地平線の上にある分だけ効く */
  var sh = 0;
  AL.activeShowers(t).forEach(function (x) {
    var alt = AL.radiantAlt(x.sh, st, t);
    if (alt > 5) sh += x.zhr * Math.pow(Math.sin(alt * AL.d2r), 0.6) / 22;
  });
  var rate = st.baseRate * (1 + sh) * moonF * cloudF * twiF;
  return { rate: rate, cond: c, shower: sh, moonF: moonF, cloudF: cloudF,
           state: c.cloud > 0.93 ? 'clouded' : (f ? 'degraded' : 'observing'), fault: f };
};

/* ================= 1 時間ごとの集計 =================
   個々のイベントを作らずに済むので、30 日ぶんでも軽い。 */
function hourRow(stId, t) {
  var key = 'hr' + stId + t;
  if (CACHE[key]) return CACHE[key];
  var st = AL.st(stId), mid = t + HOUR / 2;
  var R = AL.data.rate(st, mid);
  var r = AL.rng('h' + stId + t);
  /* ポアソン的なばらつき（期待値が小さいときも自然に見えるよう正規近似＋床） */
  var n = R.rate <= 0 ? 0 : Math.max(0, Math.round(R.rate + Math.sqrt(R.rate) * AL.gauss(r)));
  var clip = 2.0 + 1.6 * r();                        /* 1 ファイルの長さ [s]（前後 30 フレーム込み） */
  var recSec = n * clip;
  var row = { t: t, st: stId, n: n, rate: R.rate, state: R.state, cond: R.cond,
              recSec: recSec, activeSec: R.cond.obs ? 3600 : 0,
              bytes: recSec * AL.RIG.rateMBs, fault: R.fault || null };
  CACHE[key] = row;
  return row;
}
AL.data.hourly = function (stId, t0, t1) {
  var out = [];
  for (var t = Math.floor(t0 / HOUR) * HOUR; t < t1; t += HOUR) out.push(hourRow(stId, t));
  return out;
};
/* 一夜ぶんの要約（検出数・観測時間・暗夜時間・記録量） */
AL.data.nightSummary = function (stId, nightStart) {
  var key = 's' + stId + nightStart;
  if (CACHE[key]) return CACHE[key];
  var st = AL.st(stId), n = AL.night(nightStart + 18 * HOUR, st);
  var rows = AL.data.hourly(stId, nightStart, nightStart + 24 * HOUR);
  var s = { night: nightStart, st: stId, n: 0, recSec: 0, activeSec: 0, bytes: 0,
            obsHours: n.obsHours, darkHours: n.darkHours, moon: n.moon, cloud: 0, nc: 0, lim: 0 };
  rows.forEach(function (h) {
    s.n += h.n; s.recSec += h.recSec; s.activeSec += h.activeSec; s.bytes += h.bytes;
    if (h.cond.obs) { s.cloud += h.cond.cloud; s.lim += h.cond.limMag; s.nc++; }
  });
  if (s.nc) { s.cloud /= s.nc; s.lim /= s.nc; }
  CACHE[key] = s;
  return s;
};

/* ================= イベント =================
   1 時間ぶんずつ作って保持する。木曽と明野は視野が重なるので、
   重なり領域ぶんは「同じ流星」を両局に配る（同時観測イベント）。 */
var SPORADIC_V = [25, 72];
function makeEvent(st, t, r, shower, sharedId) {
  var c = AL.data.cond(st, t);
  var lim = c.limMag;
  var m = lim + Math.log(Math.max(1e-6, r())) / Math.log(2.5);          /* 等級分布 N(<m) ∝ 2.5^m */
  m = AL.clamp(m, -8, lim);
  var v = shower ? shower.v : AL.lerp(SPORADIC_V[0], SPORADIC_V[1], Math.pow(r(), 1.4));
  /* 視野内の位置（画面座標 0–1）と、そこから決まる見かけの角速度 */
  var fx = r(), fy = r();
  var ent = 90 + (r() - 0.5) * 30;                                      /* 発光高度 [km] */
  var zang = 20 + r() * 60;                                             /* 進行方向と視線のなす角 */
  var vang = v / (ent / Math.cos(st.za * AL.d2r)) * AL.r2d * Math.sin(zang * AL.d2r);
  var durM = AL.clamp(0.12 + Math.pow(r(), 2) * 1.5 + Math.max(0, -m) * 0.12, 0.08, 3.2);
  return {
    id: (sharedId || (st.id + t.toString(36) + Math.floor(r() * 1e6).toString(36))),
    shared: sharedId || null,
    t: t, st: st.id, mag: m, v: v, vang: vang, dur: durM,
    clip: 2.0 + durM + r() * 1.2, h0: ent, fx: fx, fy: fy,
    shower: shower ? shower.id : null,
    frames: Math.round(durM * AL.RIG.fps),
    file: 'M' + AL.ymd(t).replace(/-/g, '') + '_' + AL.hms(t).replace(/:/g, '') + '_' + st.id + '.avi'
  };
}
/* その時間帯に木曽・明野の両方の視野へ入る流星の数。両局で同じ値になるように、
   局によらない種から決める。視野の重なり割合に、重なり内で両方が検出できる割合を掛ける。 */
function pairCount(hourT) {
  var a = AL.data.hourly('KSO', hourT, hourT + HOUR)[0];
  var b = AL.data.hourly('AKN', hourT, hourT + HOUR)[0];
  if (!a.n || !b.n) return 0;
  var ov = AL.overlapAt('KSO', 'AKN', 100).frac;
  return Math.round(Math.min(a.n, b.n) * ov * 0.55);
}
/* 同時観測イベントの素（時刻・群・対地速度）。両局で共通 */
function pairSeeds(hourT) {
  var key = 'ps' + hourT;
  if (CACHE[key]) return CACHE[key];
  var n = pairCount(hourT), r = AL.rng('pev' + hourT), out = [];
  var act = AL.activeShowers(hourT + HOUR / 2);
  var vis = act.filter(function (x) { return AL.radiantAlt(x.sh, AL.st('KSO'), hourT + HOUR / 2) > 5; });
  var shTotal = AL.sum(vis.map(function (x) { return x.zhr; }));
  for (var i = 0; i < n; i++) {
    var sh = null, p = r() * (shTotal + 24);
    for (var j = 0; j < vis.length; j++) { p -= vis[j].zhr; if (p <= 0) { sh = vis[j]; break; } }
    out.push({ sid: 'P' + hourT.toString(36) + i.toString(36), t: hourT + r() * HOUR, sh: sh,
               v: sh ? sh.v : AL.lerp(SPORADIC_V[0], SPORADIC_V[1], Math.pow(r(), 1.4)),
               h0: 88 + (r() - 0.5) * 24, zang: 20 + r() * 60, base: r() });
  }
  CACHE[key] = out;
  return out;
}
function hourEvents(stId, hourT) {
  var key = 'e' + stId + hourT;
  if (CACHE[key]) return CACHE[key];
  var st = AL.st(stId);
  var H = AL.data.hourly(stId, hourT, hourT + HOUR)[0];
  var r = AL.rng('ev' + stId + hourT), out = [];
  var act = AL.activeShowers(hourT + HOUR / 2);
  var shTotal = 0;
  act.forEach(function (x) { x._alt = AL.radiantAlt(x.sh, st, hourT + HOUR / 2); if (x._alt > 5) shTotal += x.zhr; });

  /* 同時観測ぶん（木曽・明野のみ）。時刻は共通、見え方だけ局ごとに変える */
  var seeds = (stId === 'KSO' || stId === 'AKN') ? pairSeeds(hourT) : [];
  seeds.forEach(function (sd) {
    var rr = AL.rng(sd.sid + stId);
    var c = AL.data.cond(st, sd.t);
    var m = AL.clamp(c.limMag + Math.log(Math.max(1e-6, sd.base)) / Math.log(2.5) + (rr() - 0.5) * 0.4, -8, c.limMag);
    var vang = sd.v / (sd.h0 / Math.cos(st.za * AL.d2r)) * AL.r2d * Math.sin(sd.zang * AL.d2r);
    var durM = AL.clamp(0.12 + Math.pow(rr(), 2) * 1.5 + Math.max(0, -m) * 0.12, 0.08, 3.2);
    var t = sd.t + (stId === 'AKN' ? (rr() - 0.5) * 0.26 * 1000 : 0);   /* 時計のずれ ±0.13 秒 */
    out.push({
      id: stId + '-' + sd.sid, shared: sd.sid, t: t, st: stId, mag: m, v: sd.v, vang: vang,
      dur: durM, clip: 2.0 + durM + rr() * 1.2, h0: sd.h0, fx: rr(), fy: rr(),
      shower: sd.sh ? sd.sh.id : null, frames: Math.round(durM * AL.RIG.fps),
      file: 'M' + AL.ymd(t).replace(/-/g, '') + '_' + AL.hms(t).replace(/:/g, '') + '_' + st.id + '.avi'
    });
  });
  /* 残りはその局だけで見えた流星 */
  var nSingle = Math.max(0, H.n - out.length);
  for (var i = 0; i < nSingle; i++) {
    var t2 = hourT + r() * HOUR;
    var sh = null, p = r() * (shTotal + 24);
    for (var j = 0; j < act.length; j++) {
      if (act[j]._alt <= 5) continue;
      p -= act[j].zhr;
      if (p <= 0) { sh = act[j]; break; }
    }
    out.push(makeEvent(st, t2, r, sh, null));
  }
  out.sort(function (a, b) { return a.t - b.t; });
  CACHE[key] = out;
  return out;
}
/* 期間内のイベント。新しい時間帯から作り、上限に達したらそこで止める。
   返り値には実際に遡れた時刻（from）と打ち切りの有無（truncated）を付ける。 */
AL.data.events = function (stIds, t0, t1, cap) {
  if (AL.data.source === 'real') return realEvents(stIds, t0, t1, cap);
  var lim = cap || 8000, out = [], from = t0, cut = false;
  for (var t = Math.floor((t1 - 1) / HOUR) * HOUR; t >= t0; t -= HOUR) {
    stIds.forEach(function (id) {
      hourEvents(id, t).forEach(function (e) { if (e.t >= t0 && e.t < t1) out.push(e); });
    });
    if (out.length >= lim) { from = t; cut = t > t0; break; }
  }
  out.sort(function (a, b) { return b.t - a.t; });
  if (out.length > lim) out = out.slice(0, lim);
  out.from = from; out.truncated = cut;
  return out;
};
/* 同時観測の組を取り出す */
AL.data.pairs = function (t0, t1) {
  var a = AL.data.events(['KSO'], t0, t1), b = AL.data.events(['AKN'], t0, t1);
  var byId = {};
  b.forEach(function (e) { if (e.shared) byId[e.shared] = e; });
  var out = [];
  a.forEach(function (e) {
    if (e.shared && byId[e.shared]) out.push({ id: e.shared, a: e, b: byId[e.shared], dt: Math.abs(e.t - byId[e.shared].t) });
  });
  return out;
};

/* ================= 局の現在値 ================= */
AL.data.status = function (stId, t) {
  if (AL.data.source === 'real' && REAL.status[stId]) return REAL.status[stId];
  var st = AL.st(stId);
  t = t == null ? AL.now() : t;
  var R = AL.data.rate(st, t);
  var night = AL.nightOf(t);
  /* ディスク：退避済みの蓄積（局ごとの既定値）に、今の周期で貯まったぶんを足す。
     60 日ごとに外付けへ吸い出す運用を想定している。 */
  var EPOCH = Date.UTC(2026, 3, 1) - AL.JST, CYCLE = 60 * 86400e3;
  var cycle = EPOCH + Math.floor((night - EPOCH) / CYCLE) * CYCLE;
  var used = st.disk * (st.diskBase || 0.3);
  for (var d = cycle; d < night; d += 86400e3) used += AL.data.nightSummary(stId, d).bytes / 1024;   /* GB */
  for (var h = night; h < t; h += HOUR) {
    var row = AL.data.hourly(stId, h, h + HOUR)[0];
    used += row.bytes / 1024 * AL.clamp((t - h) / HOUR, 0, 1);
  }
  var r = AL.rng('sys' + stId + Math.floor(t / (5 * 60e3)));
  var last = AL.data.events([stId], t - 12 * HOUR, t, 1)[0];
  return {
    st: stId, t: t, state: R.state, fault: R.fault || null, cond: R.cond, rate: R.rate,
    diskUsedGB: Math.min(st.disk * 0.98, used), diskGB: st.disk,
    cpu: AL.clamp((R.state === 'observing' ? 34 : 9) + 14 * r() + (R.rate > 60 ? 12 : 0), 2, 98),
    tempPC: AL.clamp(R.cond.temp + 18 + 6 * r(), -5, 70),
    lastEvent: last ? last.t : null,
    uptimeH: 24 * ((AL.hash(stId + AL.ymd(t).slice(0, 7)) % 40) + 3) + Math.floor((t - night) / HOUR)
  };
};

/* ================= 実データの差し替え口 =================
   ここに流し込めば AL.data.source が 'real' になり、画面はそのまま実データを描く。 */
AL.ingest = {
  /* UFOCapture の A.XML（解析済み）/ M.XML（検出）を読む。
     ua2_objects の属性（sec, mag, av, dur …）を拾って内部形式へ直す。 */
  ufo: function (xmlText, stId) {
    var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    var rec = doc.querySelector('ufocapture_record, ufoanalyzer_record');
    if (!rec) throw new Error('UFOCapture の XML ではない');
    var y = +rec.getAttribute('y'), mo = +rec.getAttribute('mo'), d = +rec.getAttribute('d');
    var h = +rec.getAttribute('h'), mi = +rec.getAttribute('m'), s = +rec.getAttribute('s');
    var base = Date.UTC(y, mo - 1, d, h, mi, Math.floor(s)) - AL.JST;
    var out = [];
    doc.querySelectorAll('ua2_object, uc_object').forEach(function (o, i) {
      var sec = parseFloat(o.getAttribute('sec') || o.getAttribute('t') || 0);
      var mag = parseFloat(o.getAttribute('mag'));
      var dur = parseFloat(o.getAttribute('sec') || 0);
      out.push({
        id: stId + base.toString(36) + i, shared: null, t: base + sec * 1000, st: stId,
        mag: isFinite(mag) ? mag : null,
        v: parseFloat(o.getAttribute('vo')) || null,
        vang: parseFloat(o.getAttribute('av')) || null,
        dur: dur || null, clip: null, h0: parseFloat(o.getAttribute('h1')) || null,
        shower: o.getAttribute('str') || null,
        frames: parseInt(o.getAttribute('fN'), 10) || null,
        file: rec.getAttribute('clip_name') || null
      });
    });
    REAL.events[stId] = (REAL.events[stId] || []).concat(out);
    AL.data.source = 'real'; REAL.loadedAt = Date.now();
    return out.length;
  },
  /* 1 行 1 イベントの CSV：時刻(ISO),局,等級,継続[s],角速度[deg/s],群,ファイル名 */
  csv: function (text) {
    var n = 0;
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim() || /^#|^時刻|^time/i.test(line)) return;
      var c = line.split(',');
      var t = Date.parse(c[0]); if (!isFinite(t)) return;
      var id = (c[1] || '').trim(); if (!AL.ST[id]) return;
      (REAL.events[id] || (REAL.events[id] = [])).push({
        id: id + t.toString(36) + n, shared: (c[7] || '').trim() || null, t: t, st: id,
        mag: parseFloat(c[2]), dur: parseFloat(c[3]), vang: parseFloat(c[4]),
        shower: (c[5] || '').trim() || null, file: (c[6] || '').trim() || null, v: null, clip: null
      });
      n++;
    });
    if (n) { AL.data.source = 'real'; REAL.loadedAt = Date.now(); }
    return n;
  },
  /* 局の死活・ディスク・温度。{FNB:{state:'observing',diskUsedGB:…},…} */
  status: function (obj) {
    for (var k in obj) REAL.status[k] = Object.assign({ st: k, t: AL.now() }, obj[k]);
    AL.data.source = 'real';
    return Object.keys(obj).length;
  },
  clear: function () { REAL.events = {}; REAL.status = {}; AL.data.source = 'sim'; }
};
function realEvents(stIds, t0, t1, cap) {
  var out = [];
  stIds.forEach(function (id) {
    (REAL.events[id] || []).forEach(function (e) { if (e.t >= t0 && e.t < t1) out.push(e); });
  });
  out.sort(function (a, b) { return b.t - a.t; });
  return cap ? out.slice(0, cap) : out;
}
AL.data.real = REAL;

})(AL);
