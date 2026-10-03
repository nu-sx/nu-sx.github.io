/* NU-AbeLab / 画面 ⑦インフラサウンド
   3 局に載せたインフラサウンドセンサーで火球の衝撃波を捉える。
   光学は雲があると何も写らないが、音は雲を通り、昼でも鳴る。
   3 局の到達時刻の差から音源の位置が決まるので、光学の軌跡と突き合わせられる。 */
'use strict';
(function (AL) {

var el = AL.el, panel = AL.panel, C = AL.chart;

AL.V.infra = function (root, ui) {
  var t0 = ui.t0, t1 = ui.t1, now = AL.now();
  var g = el('div', { class: 'grid' });
  var I = AL.INFRA;
  var noiseNow = {};
  AL.STL.forEach(function (id) { noiseNow[id] = AL.data.infraNoise(AL.st(id), now); });

  /* --- 概要 --- */
  var bol90 = AL.data.bolides(now - 90 * 86400e3, now);
  var det90 = bol90.filter(function (b) { return b.nDet > 0; });
  var p0 = panel('インフラサウンドの状況', { col: 'c3', note: '3 局とも ' + I.model.split('（')[0] });
  var b0 = p0.querySelector('.body');
  var rate = {};
  AL.STL.forEach(function (id) { rate[id] = AL.data.infraRate(id, now); });
  AL.add(b0, AL.stat(AL.f(rate.KSO.perYear, 0), '個/年', '木曽で音を捉えられる火球'));
  AL.add(b0, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
    AL.stat(AL.f(noiseNow.KSO.pa * 1000, 0), 'mPa', '背景雑音（木曽）', { sm: true }),
    AL.stat(AL.f(noiseNow.FNB.pa * 1000, 0), 'mPa', '背景雑音（船橋）', { sm: true }),
    AL.stat(AL.int(bol90.length), '件', '90 日の火球候補（−4 等以下）', { sm: true }),
    AL.stat(AL.int(det90.length), '件', 'うち音も捉えた', { sm: true, color: det90.length ? 'var(--good)' : null })
  ]));
  AL.add(b0, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '音が届くのは光ってから 6〜13 分後（高度 90–100 km、実効音速 ' + I.c + ' km/s）。' +
          '光学の検出時刻を起点に、その窓だけを探せばよい。' }));
  g.appendChild(p0);

  /* --- 検出しきい値 --- */
  var p1 = panel('捉えられる火球の明るさ', { col: 'c5',
    note: '背景雑音の 2 倍を検出のしきい値とした（継続 2 秒の火球）' });
  var b1 = p1.querySelector('.body');
  var ser = AL.STL.map(function (id) {
    var st = AL.st(id), pts = [];
    for (var R = 60; R <= 400; R += 10) pts.push([R, AL.data.infraMagLimit(id, R, now)]);
    return { name: st.name, color: st.hex, points: pts };
  });
  C.xy(b1, { series: ser, xmin: 60, xmax: 400, ymin: -14, ymax: -7, height: 175,
    xlabel: '音源までの距離 km', yfmt: function (v) { return AL.f(v, 0); },
    xtip: function (v) { return AL.f(v, 0) + ' km'; }, tipfmt: function (v) { return AL.mag(v) + ' 等より明るいこと'; } });
  C.legend(b1, ser.map(function (s) { return { name: s.name, color: s.color }; }));
  AL.add(b1, el('div', { class: 'note', style: { marginTop: '4px' },
    text: '下へ行くほど「もっと明るい火球でないと届かない」。都市部の船橋は風雑音が大きく、山の 2 局より 1–2 等ぶん不利になる。' }));
  g.appendChild(p1);

  /* --- 背景雑音の推移 --- */
  var p2 = panel('背景雑音', { col: 'c4', note: '風が強いほど小さな衝撃波が埋もれる' });
  var b2 = p2.querySelector('.body');
  var nser = AL.STL.map(function (id) {
    var st = AL.st(id), pts = [];
    for (var t = t0; t <= t1; t += Math.max(600e3, (t1 - t0) / 160)) pts.push([t, AL.data.infraNoise(st, t).pa * 1000]);
    return { name: st.name, color: st.hex, points: pts };
  });
  C.timeseries(b2, { t0: t0, t1: t1, series: nser, height: 175, ymin: 0,
    yfmt: function (v) { return AL.f(v, 0); }, tipfmt: function (v) { return AL.f(v, 1) + ' mPa'; },
    snap: (t1 - t0) / 40 });
  C.legend(b2, nser.map(function (s) { return { name: s.name, color: s.color, value: AL.f(noiseNow[s.name === '船橋' ? 'FNB' : s.name === '木曽' ? 'KSO' : 'AKN'].pa * 1000, 0) + ' mPa' }; }));
  g.appendChild(p2);

  /* --- 火球候補と音の到達 --- */
  var p3 = panel('火球候補と音の到達', { col: 'c12',
    note: '直近 90 日・−4 等以下の光学イベント ' + AL.int(bol90.length) + ' 件。選んだ期間に関係なく出す' });
  AL.add(p3.querySelector('.body'), bol90.length ? AL.table(
    ['光学の時刻', '光った局', ['等級', 'num'], ['エネルギー', 'num'], ['卓越周期', 'num'],
     '船橋', '木曽', '明野', '音の検出'],
    bol90.slice(0, 40).map(function (b) {
      var cells = AL.STL.map(function (id) {
        var a = b.arr.filter(function (x) { return x.st === id; })[0];
        return el('span', { style: { color: a.det ? 'var(--good)' : 'var(--text-3)' },
          text: AL.f(a.dt / 60, 1) + ' 分後 ' + AL.f(a.amp * 1000, 1) + ' mPa（SNR ' + AL.f(a.snr, 1) + '）' });
      });
      return [AL.stamp(b.t, { sec: true }), AL.st(b.ev.st).name, AL.mag(b.mag),
        b.kt.toExponential(1) + ' kt', AL.f(b.P, 2) + ' s'].concat(cells,
        [b.nDet ? AL.state('good', b.nDet + ' 局', '●') : AL.state('idle', '届かず', '○')]);
    }), { max: '300px' })
    : el('div', { class: 'note', text: 'この 90 日に −4 等以下の火球はない。' }));
  g.appendChild(p3);

  /* --- 音で捉えられる頻度 --- */
  var p7 = panel('音で捉えられる火球の頻度', { col: 'c6',
    note: 'Brown et al. (2002) の流入頻度 N(>E) = 3.7·E⁻⁰·⁹ から' });
  var b7 = p7.querySelector('.body');
  AL.add(b7, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' } },
    AL.STL.map(function (id) {
      var r = rate[id];
      return AL.stat(AL.f(r.perYear, 0), '個/年', AL.st(id).name + '（' + AL.f(365 / Math.max(0.01, r.perYear), 0) + ' 日に 1 個）',
        { sm: true, color: AL.st(id).hex });
    })));
  AL.add(b7, AL.table(['等級', ['検出半径', 'num'], ['エネルギー', 'num'], ['年あたり', 'num']],
    rate.KSO.rows.filter(function (x, i) { return i % 2 === 0 && x.mag >= -15; }).map(function (x) {
      return [AL.mag(x.mag), AL.f(x.R, 0) + ' km', x.kt.toExponential(1) + ' kt', AL.f(x.rate, 2) + ' 個/年'];
    }), { max: '170px' }));
  AL.add(b7, el('div', { class: 'note', style: { marginTop: '6px' },
    text: 'インフラサウンドは全方位で、最大 400 km 先まで届く。カメラの視野（高度 100 km で ' +
          AL.int(AL.polyArea(AL.ccwPoly(AL.footprintPoly(AL.st("KSO"), 100)))) + ' km²）より桁ちがいに広く、' +
          '曇っていても昼間でも鳴る。カメラが取り逃がした火球を拾えるのが、同じ局に載せる最大の利点になる。' +
          '逆に、音だけでは高度も速度も出ないので、軌道を出すには光学との同時検出がいる。' }));
  g.appendChild(p7);

  /* --- 音源の決め方 --- */
  var p4 = panel('音源の決め方', { col: 'c6', note: '到達時刻の差から位置を出す' });
  var b4 = p4.querySelector('.body');
  AL.add(b4, AL.table(['組', ['基線長', 'num'], ['最大の到達時刻差', 'num'], ['位置の分解能', 'num']],
    AL.PAIRS.map(function (pp) {
      var d = AL.baseline(pp[0], pp[1]);
      var dtMax = d / I.c;                                  /* 基線に沿って来たときの差 */
      var res = I.c * 1.0;                                  /* 時刻を 1 秒で読めたときの距離分解能 */
      return [AL.st(pp[0]).name + ' × ' + AL.st(pp[1]).name, AL.f(d, 0) + ' km',
        AL.f(dtMax, 0) + ' 秒', '± ' + AL.f(res, 1) + ' km（時刻 1 秒）'];
    }), { scroll: false }));
  AL.add(b4, el('div', { class: 'note', style: { marginTop: '8px' } }, [
    '3 局で到達時刻が取れれば、双曲線 2 本の交点として音源の水平位置が決まる。実効音速 ' + I.c +
    ' km/s なので、時刻を 1 秒の精度で読めれば距離は ± ' + AL.f(I.c, 1) + ' km に収まる。' +
    '映像の 1 フレーム（33 ms）より時刻の要求はゆるく、NTP で足りる。', el('br'), el('br'),
    'ただし成層圏の風で音の経路は曲がり、到来方位は数度ずれる。高度まで含めて決めるには、' +
    '光学で出した発光点・消滅点を拘束条件に使うのが実際的である。光学とインフラサウンドを' +
    '同じ局に置く利点はここにある。'
  ]));
  g.appendChild(p4);

  /* --- 火球以外の検出 --- */
  var others = {};
  var oAll = [];
  AL.STL.forEach(function (id) { others[id] = AL.data.infraOther(id, t0, t1); oAll = oAll.concat(others[id]); });
  var byType = {};
  oAll.forEach(function (x) { byType[x.type] = (byType[x.type] || 0) + 1; });
  var p5 = panel('火球以外の検出', { col: 'c6', note: ui.rangeLabel + '・数のうえではこちらが大半' });
  var b5 = p5.querySelector('.body');
  AL.add(b5, AL.table(['局', ['雷', 'num'], ['人工音', 'num'], ['合計', 'num'], ['最大振幅', 'num']],
    AL.STL.map(function (id) {
      var o = others[id];
      var th = o.filter(function (x) { return x.type === '雷'; }).length;
      var mn = o.filter(function (x) { return x.type === '人工音'; }).length;
      var mx = o.reduce(function (a, x) { return Math.max(a, x.amp); }, 0);
      return [AL.st(id).name, AL.int(th), AL.int(mn), AL.int(o.length), AL.f(mx * 1000, 0) + ' mPa'];
    }), { scroll: false }));
  AL.add(b5, el('div', { class: 'note', style: { marginTop: '8px' },
    text: '雷は雲が厚いときに増え、人工音（発破・航空機）は昼に多い。都市部の船橋がいちばん多い。' +
          'これらは 1 局だけ、あるいは到来方位が地上を向くことで見分けられる。' +
          '火球は「3 局でほぼ同時刻（音速ぶんずれる）・方位が上空の一点を指す・光学に対応がある」の 3 つで切り分ける。' }));
  g.appendChild(p5);

  /* --- 諸元 --- */
  var p6 = panel('センサーと記録', { col: 'c6', note: I.model });
  var b6 = p6.querySelector('.body');
  AL.add(b6, AL.table(['帯域', '範囲', '何を捉えるか'],
    I.bands.map(function (bd) { return [bd.name, bd.band, bd.what]; }), { scroll: false }));
  AL.add(b6, AL.table(['', ['', 'num']], [
    ['記録', I.fs + ' Hz・' + I.bits + ' bit・' + I.ch + ' ch'],
    ['記録量', AL.f(I.rateKBs, 2) + ' kB/s ＝ ' + AL.f(I.rateKBs * 86400 / 1024, 0) + ' MB/日/局'],
    ['3 局・1 年', AL.f(I.rateKBs * 86400 * 365 * 3 / 1048576, 0) + ' GB'],
    ['実効音速', I.c + ' km/s'],
    ['発光効率（仮定）', AL.pct(I.lumEff)],
    ['周期–収量関係', 'AFTAC：log(E/2) = 3.34 log(P) − 2.58（E は kt）']
  ], { scroll: false }));
  AL.add(b6, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '映像が 1 夜 60 GB なのに対し、インフラサウンドは 1 日 ' + AL.f(I.rateKBs * 86400 / 1024, 0) +
          ' MB。常時つなぎっぱなしで流しても回線に効かないので、連続波形をそのまま中央へ送ってよい。' }));
  g.appendChild(p6);

  root.appendChild(g);
};

})(AL);
