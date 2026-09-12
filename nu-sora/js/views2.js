/* NU-SORA デモ / 画面：火球・隕石、デブリ再突入、インフラサウンド */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, panel = NS.panel, badge = NS.badge, kpi = NS.kpi;

/* ---------- 波形の合成（インフラサウンド） ---------- */
NS.wavePacket = function (o) {
  var n = o.n || 900, dur = o.dur || 30, f = 1 / o.P, r = NS.rng(o.seed), pts = [];
  for (var i = 0; i < n; i++) {
    var t = i / (n - 1) * dur - o.pre;
    var env = Math.exp(-Math.pow((t - 0) / (o.width || 1.6), 2));
    var v = o.amp * env * Math.sin(2 * Math.PI * f * t) * (1 + 0.25 * Math.sin(2 * Math.PI * f * 2.3 * t));
    v += r.norm(0, o.noise == null ? 0.03 : o.noise);
    pts.push([t, v]);
  }
  return pts;
};

/* =========================================================================
   火球・隕石（G-1）
   ========================================================================= */
NS.V.fireball = function (root, go, arg) {
  var evs = NS.EVENTS.filter(function (e) { return e.kind === 'fireball' || e.kind === 'meteor'; });
  var sel = NS.EVMAP[arg] && NS.EVMAP[arg].kind !== 'reentry' ? NS.EVMAP[arg] : NS.FLAGSHIP.fireball;
  var filt = { minMag:0, onlyMulti:false };

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'火球・隕石　多点観測と落下域確率地図' }),
    el('p', { text:'多点三角測量で軌跡と突入前軌道を決め、光学とインフラサウンドで独立にエネルギーを推定する。暗黒飛行（ダークフライト）を風補正して落下域の確率地図を自治体へ配信する（上空の風は気象庁の数値予報 GPV と高層気象観測、地上付近は各局の気象センサー）（サブテーマ G-1 / DT-1）。' })
  ]));

  var listWrap = el('div', { class:'evlist' });
  function renderList() {
    NS.clear(listWrap);
    evs.filter(function (e) {
      return e.absMag <= -filt.minMag && (!filt.onlyMulti || e.stationsDet >= 4);
    }).slice(0, 40).forEach(function (e) {
      NS.add(listWrap, NS.evRow(e, function (x) { sel = x; go('fireball', x.id); }, sel.id));
    });
  }
  renderList();
  var listPanel = panel('検出カタログ', { note:evs.length + ' 件（直近 14 日）',
    tools:el('div', { class:'chips' }, [
      el('button', { class:'chip', text:'すべて', 'aria-pressed':'true', onclick:function (e) { filt.minMag = 0; press(e); renderList(); } }),
      el('button', { class:'chip', text:'0 等より明るい', onclick:function (e) { filt.minMag = 0.001; press(e); renderList(); } }),
      el('button', { class:'chip', text:'−4 等以上', onclick:function (e) { filt.minMag = 4; press(e); renderList(); } }),
      el('button', { class:'chip', text:'4 局以上', onclick:function (e) { filt.onlyMulti = !filt.onlyMulti; e.target.setAttribute('aria-pressed', filt.onlyMulti ? 'true' : 'false'); renderList(); } })
    ]) }, []);
  function press(e) {
    Array.prototype.forEach.call(e.target.parentNode.children, function (x, i) { if (i < 3) x.setAttribute('aria-pressed', 'false'); });
    e.target.setAttribute('aria-pressed', 'true');
  }
  listPanel.querySelector('.panel-b').classList.add('flush');
  listPanel.querySelector('.panel-b').appendChild(listWrap);
  listPanel.querySelector('.panel-b').style.maxHeight = '520px';
  listPanel.querySelector('.panel-b').style.overflowY = 'auto';

  /* ---- 活動中の流星群（IMO Meteor Shower Calendar） ---- */
  var refSt = NS.ST.FNB, tNow = NS.nextMidnight();
  var act = NS.activeShowers(tNow, refSt);
  var mdT = function (a) { return a[0] + '/' + a[1]; };
  NS.add(root, panel('活動中の流星群（IMO Meteor Shower Calendar）',
    { note:'活動期間・極大日・極大時の太陽黄経 λ☉・ZHR は IMO の Working List による。推定 ZHR と輻射点高度は今夜 1 時・船橋局での値' },
    [act.length ? NS.table(['流星群', 'IAU', '活動期間', '極大', 'λ☉', '極大 ZHR', '今夜の推定 ZHR', '速度', '輻射点（J2000）', '輻射点高度'],
      act.map(function (a) {
        var sh = a.sh;
        return [el('b', { text:sh.ja }), { class:'mono sm', html:sh.code },
          { class:'sm', html:mdT(sh.start) + ' – ' + mdT(sh.end) },
          { class:'sm', html:mdT(sh.peak) + (Math.abs(a.dDays) < 1.5 ? '　<b style="color:var(--accent)">極大前後</b>' : '（' + (a.dDays > 0 ? '+' : '') + NS.f(a.dDays, 0) + ' 日）') },
          { class:'r mono sm', html:NS.f(sh.sol, 2) + '°' },
          { class:'r', html:String(sh.zhr) },
          { class:'r', html:'<b>' + NS.f(a.zhr, 1) + '</b>' },
          { class:'r', html:sh.v + ' km/s' },
          { class:'mono sm', html:NS.f(sh.ra / 15, 1) + 'h ' + (sh.dec >= 0 ? '+' : '') + NS.f(sh.dec, 0) + '°' },
          { class:'r', html:a.alt > 5 ? '<b>' + NS.f(a.alt, 0) + '°</b>' : '<span class="hint">' + NS.f(a.alt, 0) + '°（地平下）</span>' }];
      }))
      : el('div', { class:'hint', text:'今夜は主要な流星群の活動期間にあたらない。検出されるのは散在流星が主体となる。' }),
    el('div', { class:'note', text:'検出カタログの母集団は、IMO の活動期間と ZHR に輻射点高度の効果（出現数 ∝ ZHR·sin h の 0.7 乗）を掛けた重みで決めている。散在流星は ZHR 10 相当として常に含める。速度は各群の大気圏突入速度に合わせてある。' }),
    el('div', { class:'src', text:'出典：International Meteor Organization, Meteor Shower Calendar / IMO Working List of Meteor Showers（https://www.imo.net/resources/calendar/）。本デモでは主要 16 群を収録した。' })]));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('防災科研（NIED）の公開データとの突き合わせ',
    { note:'大火球の衝撃波は地面も揺らす。地震観測網の連続波形と突き合わせて音源高度を拘束する' },
    [NS.niedTable('火球'), el('div', { class:'src', text:NS.niedNote })])));

  var detail = el('div', { class:'grid', style:{ gap:'14px' } });
  NS.add(root, el('div', { class:'grid g-1-2' }, [listPanel, detail]));
  renderDetail();

  function renderDetail() {
    NS.clear(detail);
    var e = sel;
    if (e.auto) { NS.add(detail, autoDetail(e)); return; }
    /* --- 要約 --- */
    var ratio = e.EinfKt / e.EKt;
    NS.add(detail, panel(e.name, { note:e.id + ' · ' + NS.fmtJST(e.t, { ms:true }) + ' JST（' + NS.fmtUTC(e.t, { ms:true }) + ' UTC）',
      tools:badge(e.stationsDet + ' 局同時検出', 'ok') }, [
      el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' }, text:e.summary }),
      el('div', { class:'grid g4' }, [
        kpi('最大絶対等級', NS.f(e.absMag, 1), '等', '継続 ' + NS.f(e.dur, 2) + ' 秒', { acc:true }),
        kpi('突入速度', NS.f(e.vInf, 1), 'km/s', '経路角 ' + NS.f(e.entryAngle, 1) + '° · 方位 ' + NS.f(e.azimuth, 0) + '°'),
        kpi('全エネルギー（光学）', NS.f(e.EKt * 4.184e3, 2), 'GJ', '放射 ' + NS.f(e.ErJ / 1e9, 3) + ' GJ → Brown et al. (2002)｜TNT 換算 ' + NS.f(e.EKt * 1e6, 0) + ' kg'),
        kpi('同（インフラサウンド）', NS.f(e.EinfKt * 4.184e3, 2), 'GJ', '周期 ' + NS.f(e.infraP, 2) + ' s · AFTAC 式｜光学推定の ' + NS.f(ratio, 2) + ' 倍')
      ]),
      el('div', { class:'grid g4', style:{ marginTop:'10px' } }, [
        kpi('光度質量', NS.f(e.massPhoto, 1), 'kg', '発光効率 τ = ' + (e.tau * 100) + '%'),
        kpi('終端残存質量', NS.f(e.massTerminal, 2), 'kg', '減速終了高度 ' + NS.km(e.end.alt)),
        kpi('発光区間', NS.f(e.begin.alt, 1) + '→' + NS.f(e.end.alt, 1), 'km', '水平距離 ' + NS.km(NS.dist(e.begin.lat, e.begin.lon, e.end.lat, e.end.lon), 0) + '・経路長 ' + NS.km((e.begin.alt - e.end.alt) / Math.sin(e.entryAngle * NS.d2r), 0)),
        kpi('隕石落下の可能性', e.massTerminal > 0.1 ? '高い' : '低い', '', e.recovery ? e.recovery.area + ' · ' + e.recovery.status : '')
      ])
    ]));

    /* --- 光度曲線 + 高度・速度 --- */
    var series = e.det.filter(function (d) { return !d.cloud; }).map(function (d, i) {
      var st = NS.ST[d.id], off = d.mag - e.absMag;
      var r = NS.rng(e.id + d.id);
      return { name:st.name, color:['var(--accent)','var(--c-info)','var(--c-ok)','var(--c-warn)','var(--c-sky)','var(--c-spec)','var(--c-met)'][i % 7],
        pts:e.lightcurve.map(function (p) { return [p[0], p[1] + off + r.norm(0, 0.09)]; }), width:1.2, opacity:i === 0 ? 1 : 0.62 };
    });
    /* 高度・速度プロファイル */
    var altPts = [], vPts = [], nA = 60;
    for (var i = 0; i <= nA; i++) {
      var f = i / nA, tt = f * e.dur;
      var decel = Math.pow(f, 3.2) * e.decelMax || 0;
      var alt = e.begin.alt - (e.begin.alt - e.end.alt) * (f - 0.06 * Math.pow(f, 2.6));
      altPts.push([tt, Math.max(e.end.alt, alt)]);
      vPts.push([tt, e.vInf - (e.decelMax || 2) * Math.pow(f, 4.2)]);
    }
    NS.add(detail, el('div', { class:'grid g2' }, [
      panel('光度曲線（局別）', { note:'全天カメラの測光。局ごとの大気減光を補正した絶対等級' }, [
        NS.chart.line({ series:series, width:450, height:230, xLabel:'発光開始からの秒数', yLabel:'絶対等級',
          yDomain:[Math.max.apply(null, e.lightcurve.map(function (p) { return p[1]; })) + 0.6, e.absMag - 1.0],
          xFmt:function (v) { return NS.f(v, 1) + 's'; }, yFmt:function (v) { return NS.f(v, 0); } }),
        NS.chart.legend(series.map(function (x) { return [x.name, x.color, 'line']; })),
        el('div', { class:'note', text:'ピーク付近の複数のフレアは、母天体の分裂（フラグメンテーション）に対応する。' })
      ]),
      panel('高度と速度の変化', { note:'多点三角測量による軌跡（残差 41 m）' }, [
        NS.chart.line({ series:[{ name:'高度', color:'var(--c-info)', pts:altPts, area:true }],
          width:450, height:128, margin:{ l:48, r:12, t:12, b:20 }, yLabel:'高度 km',
          xFmt:function (v) { return NS.f(v, 1) + 's'; }, yFmt:function (v) { return NS.f(v, 0); } }),
        NS.chart.line({ series:[{ name:'速度', color:'var(--c-warn)', pts:vPts }],
          width:450, height:118, margin:{ l:48, r:12, t:10, b:26 }, xLabel:'発光開始からの秒数', yLabel:'速度 km/s',
          xFmt:function (v) { return NS.f(v, 1) + 's'; }, yFmt:function (v) { return NS.f(v, 1); } }),
        NS.kv([
          ['発光開始', NS.km(e.begin.alt) + '　' + NS.latlon(e.begin.lat, e.begin.lon)],
          ['発光終了', NS.km(e.end.alt) + '　' + NS.latlon(e.end.lat, e.end.lon)],
          ['進行方位', NS.f(e.azimuth, 1) + '°（' + NS.compass(e.azimuth) + 'へ）'],
          ['最大減速', NS.f(e.decelMax || 0, 1) + ' km/s'],
          ['地心速度 v_g', NS.f(e.vg, 1) + ' km/s'], ['日心速度 v_h', NS.f(e.vh, 1) + ' km/s']
        ], 'wide')
      ])
    ]));

    /* --- 地図：軌跡・視線・落下域 --- */
    var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
    M.drawStations({ state:function (st) { return NS.stationState(st, NS.now()); }, labels:true });
    M.addOverlay(s('path', { d:NS.geoLinePath(e.begin, e.end), stroke:'var(--accent)', 'stroke-width':2.6, fill:'none',
      'stroke-linecap':'round', 'vector-effect':'non-scaling-stroke' }));
    e.det.forEach(function (d) {
      var st = NS.ST[d.id]; if (!st) return;
      M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, e.end, 16), stroke:d.cloud ? 'var(--muted)' : 'var(--c-info)',
        'stroke-width':0.9, 'stroke-dasharray':'3 3', fill:'none', opacity:d.cloud ? 0.25 : 0.5, 'vector-effect':'non-scaling-stroke' }));
    });
    M.fit([e.begin, e.end].concat(e.strewn ? [e.strewn] : []), 1.15);
    var pb = M.pt(e.begin.lon, e.begin.lat), pe = M.pt(e.end.lon, e.end.lat);
    M.addOverlay(s('circle', { cx:pb[0], cy:pb[1], r:M.px(4.5), fill:'none', stroke:'var(--accent)', 'stroke-width':1.6, 'vector-effect':'non-scaling-stroke' }));
    M.addOverlay(s('circle', { cx:pe[0], cy:pe[1], r:M.px(5), fill:'var(--accent)' }));
    if (e.strewn) {
      var sw = e.strewn, c = M.pt(sw.lon, sw.lat);
      var kx = Math.abs(M.pt(sw.lon + 0.1, sw.lat)[0] - c[0]) / (0.1 * 111.32 * Math.cos(sw.lat * NS.d2r));
      var ky = Math.abs(M.pt(sw.lon, sw.lat + 0.1)[1] - c[1]) / (0.1 * 111.32);
      [[1, 0.10], [0.66, 0.20], [0.4, 0.3]].forEach(function (r2) {
        M.addOverlay(s('ellipse', { cx:c[0], cy:c[1], rx:sw.a * kx * r2[0], ry:sw.b * ky * r2[0],
          transform:'rotate(' + (90 - sw.az) + ' ' + c[0] + ' ' + c[1] + ')',
          fill:'var(--c-crit)', 'fill-opacity':r2[1], stroke:'var(--c-crit)', 'stroke-width':1, 'vector-effect':'non-scaling-stroke' }));
      });
      sw.bins.forEach(function (b) {
        var p = M.pt(b.lon, b.lat);
        var g = M.addOverlay(s('g', null, [s('circle', { cx:p[0], cy:p[1], r:M.px(3), fill:'var(--ink)', stroke:'var(--sea)', 'stroke-width':0.8, 'vector-effect':'non-scaling-stroke' })]));
        M.tipOn(g, '<b>' + b.m + '</b><span class="mt-d">推定 ' + b.n + ' 個 · ' + NS.latlon(b.lat, b.lon) + '</span>');
      });
    }
    var mp = panel('地上軌跡と落下域確率地図', { note:'破線は各局の視線。楕円は暗黒飛行（ダークフライト）の風補正後の落下推定域（10 / 20 / 30 % 確率）。市区町村の境界は国土数値情報 行政区域データ（国土交通省）による',
      tools:el('div', { class:'seg' }, [
        el('button', { text:'イベント', 'aria-pressed':'true', onclick:function () { M.fit([e.begin, e.end].concat(e.strewn ? [e.strewn] : []), 1.15); } }),
        el('button', { text:'関東', onclick:function () { M.goto('kanto', true); } }),
        el('button', { text:'全国', onclick:function () { M.goto('all', true); } })
      ]) }, []);
    var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);
    M.fit([e.begin, e.end].concat(e.strewn ? [e.strewn] : []), 1.15);

    var detTable = panel('検出局と観測条件', { note:'視野内 ' + e.stationsFov + ' 局 / 検出 ' + e.stationsDet + ' 局' },
      NS.table(['観測局', '最大等級', '仰角', 'S/N', 'インフラサウンド', '備考'],
        e.det.map(function (d) {
          var st = NS.ST[d.id];
          return { attrs:{ class:'clk', onclick:function () { go('station', d.id); } }, cells:[
            el('b', { text:st.name }),
            { class:'r', html:d.mag == null ? '—' : NS.mag(d.mag) },
            { class:'r', html:NS.f(d.elev, 1) + '°' },
            { class:'r', html:d.snr == null ? '—' : NS.f(d.snr, 0) },
            d.infra ? '＋' + NS.f(d.infra.dt, 1) + ' s / ' + NS.f(d.infra.amp, 2) + ' Pa' : '<span class="hint">未検出</span>',
            d.cloud ? badge('曇天で不検出', 'warn') : (d.swir ? badge('SWIR 同時', 'info') : '')
          ] };
        })));
    NS.add(detail, el('div', { class:'grid g-3-2' }, [mp, detTable]));

    /* --- エネルギー二重推定・軌道 --- */
    var eb = [];
    [0.02, 0.05, 0.10].forEach(function (tau) {
      eb.push({ y:NS.photoMass(e.ErJ, e.vInf, tau), label:'τ=' + (tau * 100) + '%', color:'var(--c-info)',
        top:NS.f(NS.photoMass(e.ErJ, e.vInf, tau), 1) + ' kg' });
    });
    NS.add(detail, el('div', { class:'grid g3' }, [
      panel('エネルギーの二重推定', { note:'光学と音響の独立推定' }, [
        NS.chart.bars({ bars:[
          { y:e.EKt * 4.184e3, label:'光学', color:'var(--c-info)', top:NS.f(e.EKt * 4.184e3, 2) + ' GJ' },
          { y:e.EinfKt * 4.184e3, label:'インフラサウンド', color:'var(--c-infra)', top:NS.f(e.EinfKt * 4.184e3, 2) + ' GJ' }
        ], width:300, height:170, yLabel:'全エネルギー GJ' }),
        NS.kv([
          ['放射エネルギー Er', NS.f(e.ErJ / 1e9, 3) + ' GJ'],
          ['光学 全エネルギー', '<b>' + NS.f(e.EKt * 4.184e3, 2) + ' GJ</b>（' + e.EKt.toExponential(2) + ' kt・TNT ' + NS.f(e.EKt * 1e6, 0) + ' kg）'],
          ['音響 全エネルギー', '<b>' + NS.f(e.EinfKt * 4.184e3, 2) + ' GJ</b>（' + e.EinfKt.toExponential(2) + ' kt・周期 ' + NS.f(e.infraP, 2) + ' s）'],
          ['両者の比', NS.f(ratio, 2) + ' 倍　<span class="hint">' + (ratio < 2 && ratio > 0.5 ? '（因子 2 以内で整合）' : '（要検討）') + '</span>']
        ], 'wide'),
        el('div', { class:'note', text:'光学は Brown et al. (2002) の Er–E 関係、音響は AFTAC の周期–収量関係を用いた。独立な二つの推定が一致することが、単独センサー観測にない本観測網の強みである。' })
      ]),
      panel('光度質量の発光効率依存', { note:'m = 2·Er / (τ v²)' }, [
        NS.chart.bars({ bars:eb, width:300, height:170, yLabel:'kg' }),
        el('div', { class:'note', text:'発光効率 τ の不確かさが質量推定の最大の誤差要因。インフラサウンドによるエネルギー独立推定と減速からの動的質量を突き合わせて τ を制約する。' })
      ]),
      panel('突入前の日心軌道', { note:'黄道 J2000' }, [
        NS.kv([
          ['輻射点（J2000）', 'α ' + NS.f(e.radiant.ra, 1) + '° / δ ' + NS.f(e.radiant.dec, 1) + '°'],
          ['視輻射点', 'α ' + NS.f(e.radiant.raApp, 1) + '° / δ ' + NS.f(e.radiant.decApp, 1) + '°'],
          ['流星群', e.shower],
          ['軌道長半径 a', NS.f(e.orbit.a, 3) + ' au'], ['離心率 e', NS.f(e.orbit.e, 3)],
          ['軌道傾斜角 i', NS.f(e.orbit.i, 2) + '°'], ['近日点距離 q', NS.f(e.orbit.q, 3) + ' au'],
          ['遠日点距離 Q', NS.f(e.orbit.Q, 3) + ' au'], ['近日点引数 ω', NS.f(e.orbit.w, 1) + '°'],
          ['昇交点黄経 Ω', NS.f(e.orbit.node, 2) + '°'],
          ['Tisserand T_J', NS.f(e.orbit.Tj, 2) + '　<span class="hint">（' + e.orbit.cls + '・小惑星起源）</span>']
        ], 'wide'),
        el('div', { class:'note', text:'T_J > 3 は小惑星的な軌道であることを示す。q = ' + NS.f(e.orbit.q, 2) + ' au、Q = ' + NS.f(e.orbit.Q, 2) + ' au は地球近傍小惑星（' + e.orbit.cls + '）と整合する。'
          + '輻射点・地心速度・軌道要素は、多点三角測量で決めた軌跡と突入速度から、自転補正と天頂引力の補正を経て求めている。' })
      ])
    ]));

    /* --- 太陽系 3D --- */
    if (NS.orbit3dPanel) NS.add(detail, el('div', { style:{ marginTop:'14px' } }, NS.orbit3dPanel(e)));

    /* --- インフラサウンド波形 --- */
    var infraDet = e.det.filter(function (d) { return d.infra; });
    if (infraDet.length) {
      var ws = infraDet.map(function (d, i) {
        return { name:NS.ST[d.id].name, color:['var(--accent)','var(--c-info)','var(--c-ok)','var(--c-warn)'][i % 4],
          pts:NS.wavePacket({ P:d.infra.P, amp:d.infra.amp, seed:e.id + d.id, dur:26, pre:9, width:1.9, noise:0.018 })
            .map(function (p) { return [p[0] + d.infra.dt, p[1] + (infraDet.length - 1 - i) * 1.1]; }), width:1.1 };
      });
      NS.add(detail, el('div', { class:'grid g-2-1' }, [
        panel('インフラサウンド波形（局別・時刻同期）', { note:'GNSS 同期。横軸は発光ピークからの経過秒' }, [
          NS.chart.line({ series:ws, width:560, height:220, xLabel:'発光からの経過秒', yLabel:'気圧変動（相対 Pa）',
            xFmt:function (v) { return NS.f(v, 0) + 's'; }, yFmt:function () { return ''; },
            rules:infraDet.map(function (d, i) { return { x:d.infra.dt, color:'var(--muted)', dash:'2 3', label:NS.ST[d.id].id }; }) }),
          el('div', { class:'note', text:'到達時刻差から音源高度と位置を拘束する。見かけの音速は ' + NS.f(0.30, 2) + ' km/s 前後で、伝搬経路の高層風で変動する。' })
        ]),
        panel('到達時刻と方位', null, NS.table(['観測局', '到達', '周期 P', '振幅', '到来方位'],
          infraDet.map(function (d) {
            return [NS.ST[d.id].name, { class:'r', html:'＋' + NS.f(d.infra.dt, 1) + ' s' },
              { class:'r', html:NS.f(d.infra.P, 2) + ' s' }, { class:'r', html:NS.f(d.infra.amp, 2) + ' Pa' },
              { class:'r', html:NS.f(d.infra.az, 1) + '°' }];
          })))
      ]));
    }

    /* --- スペクトル --- */
    NS.add(detail, specPanel(e));

    /* --- 落下域・回収 --- */
    if (e.strewn) {
      NS.add(detail, el('div', { class:'grid g-2-1' }, [
        panel('落下域（ストルーンフィールド）の推定', { note:'暗黒飛行（ダークフライト）の風補正：上空は気象庁 数値予報 GPV（MSM）＋ 高層気象観測、地上付近は自局の気象センサー' }, [
          NS.table(['質量区分', '推定個数', '推定落下位置', '備考'], e.strewn.bins.map(function (b) {
            return [el('b', { text:b.m }), { class:'r', html:String(b.n) }, { class:'mono sm', html:NS.latlon(b.lat, b.lon) },
              { class:'sm', html:'重い破片ほど風下側（' + NS.compass(e.strewn.az) + '）に届かず手前に落下' }];
          })),
          el('div', { class:'note', text:'中心 ' + NS.latlon(e.strewn.lat, e.strewn.lon) + '、長半径 ' + e.strewn.a + ' km・短半径 ' + e.strewn.b +
            ' km、長軸方位 ' + e.strewn.az + '°。最大確率密度は ' + Math.round(e.strewn.pMax * 100) + ' %。' })
        ]),
        panel('回収調査の状況', { note:'文理学部・理工学部の合同班' }, [
          NS.kv([['状態', e.recovery.status], ['担当', e.recovery.teams], ['捜索範囲', e.recovery.area], ['回収数', e.recovery.found + ' 個']], 'wide'),
          el('div', { class:'note', text:'UAV による空撮と地上班の踏査を組み合わせ、確率密度の高い区画から順に捜索する。付属校の生徒が地元での聞き取りと目撃情報の収集を担当する。' })
        ])
      ]));
    }

    /* --- 通報 --- */
    NS.add(detail, panel('通報と対応（G-7）', { note:'検出から自治体配信まで ' + NS.f(e.alert.issuedDt, 0) + ' 秒' }, [
      el('ul', { class:'tl' }, NS.alertLog().filter(function (a) { return a.ev === e.id; }).reverse().map(function (a) {
        return el('li', { class:a.lvl === '通報' ? '' : 'i-info' }, [
          el('div', { class:'tt', text:NS.fmtJST(a.t) + ' JST（発生 +' + NS.f((a.t - e.t) / 1000, 0) + ' 秒）' }),
          el('div', { class:'tx' }, [el('span', { class:'tg', text:a.lvl }), a.text])
        ]);
      })),
      el('div', { class:'chips', style:{ marginTop:'8px' } }, e.alert.recipients.map(function (r) { return badge(r, 'info'); }))
    ]));
  }

  function autoDetail(e) {
    return panel(e.name, { note:e.id + ' · ' + NS.fmtJST(e.t) + ' JST', tools:badge('自動検出のみ', 'dim') }, [
      el('div', { class:'grid g4' }, [
        kpi('絶対等級', NS.f(e.absMag, 1), '等', e.shower + (e.showerCode !== 'SPO' ? '（' + e.showerCode + '）' : '')),
        kpi('同時検出', e.stationsDet, '局', '視野内 ' + e.stationsFov + ' 局'),
        kpi('突入速度', NS.f(e.vInf, 1), 'km/s', e.showerCode !== 'SPO' ? e.showerEn + ' の典型値に一致' : '発光 ' + NS.km(e.begin.alt, 0) + ' → ' + NS.km(e.end.alt, 0)),
        kpi('全エネルギー', NS.sig(e.EKt * 1e3), '× 10⁻³ kt', '光学推定のみ')
      ]),
      el('div', { class:'chips', style:{ marginTop:'12px' } }, [
        e.showerCode !== 'SPO' ? badge(e.shower + '（' + e.showerCode + '）　輻射点 ' +
          NS.f(e.radiant.ra / 15, 1) + 'h ' + (e.radiant.dec >= 0 ? '+' : '') + NS.f(e.radiant.dec, 0) + '°' +
          (e.zhr != null ? '　推定 ZHR ' + NS.f(e.zhr, 1) : ''), 'info') : badge('散在流星', 'dim'),
        e.hasInfra ? badge('インフラサウンド検出あり', 'ok') : badge('インフラサウンド未検出', 'dim'),
        e.hasSpec ? badge('分光データあり', 'ok') : badge('分光なし', 'dim'),
        badge('検出局：' + (e.stationIds || []).join(' / '), '')
      ]),
      el('div', { class:'note', text:'この事象はエッジ計算機の自動検出と多点対応づけのみが完了している。詳細な軌道決定・落下域推定は、絶対等級 −6 等より明るい事象、または隕石落下の可能性がある事象について実施する。左の一覧から「房総沖 大火球」を選ぶと、完全な解析例を表示する。' })
    ]);
  }
};

/* 分光パネル（火球・再突入共通）
   自然天体の線同定と相対強度は実際の流星スペクトル（S. Abe et al. 2000 ほか）に、
   デブリの分子バンドと局面の推移は Watanabe, Abe, Arima & Hanayama (ACM 2026) に基づく。 */
function buildSpecSvg(o) {
  var pts = o.pts, lines = o.lines, bands = o.bands || [], W = o.w || 900, H = 320;
  var lo = 350, hi = 900, art = o.art, col = art ? 'var(--accent)' : 'var(--c-spec)';
  var isMarker = function (e2) { return NS.ARTIFICIAL_MARKERS.indexOf(e2) >= 0; };
  var m = { l:52, r:14, t:64, b:44 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  var X = NS.chart.scale(lo, hi, m.l, m.l + iw), Y = NS.chart.scale(0, 1.1, m.t + ih, m.t);
  var uid = (art ? 'a' : 'n') + (o.uid || '');
  var g = NS.s('svg', { viewBox:'0 0 ' + W + ' ' + H, class:'chart', role:'img',
    'aria-label':'発光スペクトル（波長 350〜900 nm）' });

  /* 可視スペクトルの色帯 */
  var defs = NS.s('defs'), lg = NS.s('linearGradient', { id:'vis' + uid, x1:'0', x2:'1' });
  [[380,'#2A0A4A'],[420,'#3A12A8'],[450,'#1240E0'],[485,'#00B7C8'],[510,'#22C24A'],[550,'#B9DC1E'],
   [580,'#F5D908'],[600,'#F58A08'],[640,'#E22B1C'],[700,'#7A0A08'],[740,'#2A0402']].forEach(function (c) {
    NS.add(lg, NS.s('stop', { offset:((c[0] - 380) / 360 * 100).toFixed(1) + '%', 'stop-color':c[1] }));
  });
  NS.add(defs, lg); NS.add(g, defs);
  NS.add(g, NS.s('rect', { x:X(380), y:m.t - 22, width:X(740) - X(380), height:11, fill:'url(#vis' + uid + ')', opacity:0.9 }));
  NS.add(g, NS.s('text', { x:X(380) - 5, y:m.t - 13, class:'axl', 'text-anchor':'end', text:'可視' }));

  /* 目盛 */
  [0, 0.25, 0.5, 0.75, 1.0].forEach(function (v) {
    NS.add(g, NS.s('line', { x1:m.l, x2:m.l + iw, y1:Y(v), y2:Y(v), class:'grid' }));
    NS.add(g, NS.s('text', { x:m.l - 6, y:Y(v) + 3.5, class:'axl', 'text-anchor':'end', text:NS.f(v, 2) }));
  });
  for (var wl = 400; wl <= 900; wl += 50) {
    NS.add(g, NS.s('line', { x1:X(wl), x2:X(wl), y1:m.t, y2:m.t + ih, class:'grid grid-v' }));
    NS.add(g, NS.s('text', { x:X(wl), y:H - 24, class:'axl', 'text-anchor':'middle', text:String(wl) }));
  }
  NS.add(g, NS.s('text', { x:m.l + iw / 2, y:H - 8, class:'axt', 'text-anchor':'middle', text:'波長 [nm]' }));
  NS.add(g, NS.s('text', { x:6, y:m.t - 34, class:'axt', text:'相対強度' }));

  /* 分子バンドの寄与（帯と、寄与だけの曲線） */
  bands.forEach(function (b) {
    if (!(b.amp > 0.02)) return;
    var D = b.def, red = D.deg === 'red', broad = D.deg === 'broad';
    /* バンドヘッドを近いもの同士でまとめ、系列ごとに帯を描く */
    var hs = D.heads.map(function (h) { return h[0]; }).sort(function (p, q) { return p - q; });
    var cl = [], cur = [hs[0]];
    for (var i2 = 1; i2 < hs.length; i2++) {
      if (hs[i2] - cur[cur.length - 1] > 30) { cl.push(cur); cur = []; }
      cur.push(hs[i2]);
    }
    cl.push(cur);
    var big = cl.slice().sort(function (p, q) { return q.length - p.length; })[0];
    cl.forEach(function (c) {
      var x0 = c[0] - (broad ? D.tau * 2 : red ? 4 : D.tau * 2.0);
      var x1 = c[c.length - 1] + (broad ? D.tau * 2 : red ? D.tau * 2.2 : 4);
      NS.add(g, NS.s('rect', { x:X(x0), y:m.t + 16, width:Math.max(2, X(x1) - X(x0)), height:ih - 16,
        fill:D.color, opacity:0.09 }));
      if (c === big) NS.add(g, NS.s('text', { x:(X(x0) + X(x1)) / 2, y:m.t + 12, 'text-anchor':'middle',
        style:'font-size:10px;font-weight:700', fill:D.color, text:D.name }));
    });
    var lo2 = hs[0] - (broad ? D.tau * 2.4 : red ? 6 : D.tau * 2.6);
    var hi2b = hs[hs.length - 1] + (broad ? D.tau * 2.4 : red ? D.tau * 2.8 : 6);
    var d2 = '';
    for (var w2 = lo2; w2 <= hi2b; w2 += 0.5) {
      var yv = b.amp * NS.bandValue(D, w2, 1.19);
      d2 += (d2 ? 'L' : 'M') + X(w2).toFixed(2) + ' ' + Y(yv).toFixed(2);
    }
    NS.add(g, NS.s('path', { d:d2, fill:'none', stroke:D.color, 'stroke-width':1.1, 'stroke-dasharray':'3 2', opacity:0.9 }));
  });

  /* スペクトル本体 */
  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join('');
  NS.add(g, NS.s('path', { d:d + 'L' + X(hi).toFixed(2) + ' ' + Y(0) + 'L' + X(lo).toFixed(2) + ' ' + Y(0) + 'Z',
    fill:col, opacity:0.13, stroke:'none' }));
  NS.add(g, NS.s('path', { d:d, fill:'none', stroke:col, 'stroke-width':1.1, 'stroke-linejoin':'round' }));

  /* 主要線のラベル */
  var peakAt = function (wl0) {
    var best = 0;
    for (var i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i][0] - wl0) > 2.0) continue;
      if (pts[i][1] > best) best = pts[i][1];
    }
    return best;
  };
  var thr = o.labelMin == null ? 0.30 : o.labelMin;
  var lastX = [-1e9, -1e9];
  lines.filter(function (l) { return l.s >= thr; }).sort(function (p, q) { return p.wl - q.wl; })
    .forEach(function (l) {
      var x = X(l.wl), row = 0;
      if (x - lastX[0] < 26) { row = 1; if (x - lastX[1] < 26) return; }
      lastX[row] = x;
      var pk = peakAt(l.wl), y = Y(pk) - 8 - row * 12;
      if (y < m.t + 22) y = m.t + 22 + row * 12;
      var hi2 = art && isMarker(l.el);
      NS.add(g, NS.s('line', { x1:x, x2:x, y1:Y(pk) - 3, y2:y + 2,
        stroke:hi2 ? 'var(--accent)' : 'var(--muted)', 'stroke-width':0.7, opacity:0.6 }));
      NS.add(g, NS.s('text', { x:x, y:y, 'text-anchor':'middle',
        style:'font-size:9.5px;' + (hi2 ? 'font-weight:700;' : ''), fill:hi2 ? 'var(--accent)' : 'var(--ink2)',
        text:l.el }));
    });
  return g;
}

/* 参照図（利用者が assets/ に画像を置いた場合のみ表示） */
function specRefBox() {
  var box = el('div', { class:'specref', hidden:'hidden' });
  ['assets/spectrum_ref1.png', 'assets/spectrum_ref2.png', 'assets/spectrum_ref3.png'].forEach(function (src, i) {
    var fig = el('figure', { class:'specfig', hidden:'hidden' });
    var img = el('img', { src:src, alt:'参照スペクトル ' + (i + 1),
      onload:function () { fig.hidden = false; box.hidden = false; },
      onerror:function () { if (fig.parentNode) fig.parentNode.removeChild(fig); } });
    NS.add(fig, [img, el('figcaption', { text:['参照：流星スペクトルの線同定例（350–900 nm）',
      '参照：しし座流星群のスペクトル（S. Abe et al. 2000）',
      '参照：ロケットデブリ再突入の分光（Watanabe et al., ACM 2026）'][i] })]);
    NS.add(box, fig);
  });
  return box;
}

/* 組成（元素グループ）の ON / OFF ボタン。自然天体・人工天体どちらでも使う */
function compChips(groups, state, onChange, idp) {
  return el('div', { class:'chips' }, groups.map(function (g) {
    return el('button', { class:'chip band', id:idp + g.key, 'aria-pressed':state[g.key] ? 'true' : 'false',
      style:{ '--bc':g.color }, title:g.note, onclick:function (ev) {
        state[g.key] = !state[g.key];
        var b = ev.currentTarget;
        b.setAttribute('aria-pressed', state[g.key] ? 'true' : 'false');
        onChange();
      } }, [el('i', { class:'bdot', style:{ background:g.color } }), g.name]);
  }));
}
/* 組成ごとの内訳表 */
function compTable(groups, state, lines, toggle, idp) {
  return NS.table(['組成', '含まれる線', '意味', '最強線の相対強度'], groups.map(function (g) {
    var ls = lines.filter(function (l) { return g.els.indexOf(l.el) >= 0; });
    var strongest = ls.slice().sort(function (a, b) { return b.s - a.s; })[0];
    return { attrs:{ class:'clk' + (state[g.key] ? ' on' : ''), onclick:function () { toggle(g.key); } }, cells:[
      el('b', { style:{ color:g.color }, text:g.name }),
      { class:'sm mono', html:g.els.join('、') },
      { class:'sm', html:g.note },
      state[g.key] ? (strongest ? NS.bar(Math.min(1, strongest.s), 'info') : NS.badge('表示中', 'ok'))
                   : el('span', { class:'hint', text:'OFF' })
    ] };
  }), 'wide');
}

function specPanel(e, o) {

  o = o || {};
  var sp = e.spectrum, art = sp.kind === 'artificial', W = o.w || 900;
  var isMarker = function (e2) { return NS.ARTIFICIAL_MARKERS.indexOf(e2) >= 0; };

  /* ---- 弾道飛翔体：組成 ＋ 分子バンドの ON / OFF（局面の切り替えは持たない） ---- */
  if (sp.kind === 'ballistic') {
    var bState = {}, bBand = { C2:true, CN:true, FeO:true };
    NS.COMP_BALLISTIC.forEach(function (g) { bState[g.key] = true; });
    var bChart = el('div'), bChips = el('div', { class:'spec-lines' }), bInfo = el('div');
    var bDraw = function () {
      var r = NS.ballisticSpectrum({ comp:bState, bands:bBand });
      NS.clear(bChart);
      NS.add(bChart, buildSpecSvg({ pts:r.pts, lines:r.lines, bands:r.bands, art:true, w:W, uid:'b', labelMin:0.24 }));
      NS.clear(bChips);
      NS.add(bChips, r.lines.slice().sort(function (p, q) { return q.s - p.s; }).slice(0, 14).map(function (l) {
        return el('span', { class:'sl' + (l.el === 'C₂ 帯' ? ' hi' : ''), text:l.el + ' ' + NS.f(l.wl, 1) + ' nm' });
      }));
      NS.add(bChips, r.bands.map(function (x) {
        return el('span', { class:'sl band', style:{ borderColor:x.def.color, color:x.def.color },
          text:x.def.name + '　' + x.def.Texc });
      }));
      NS.clear(bInfo);
      NS.add(bInfo, compTable(NS.COMP_BALLISTIC, bState, NS.LINES_BALLISTIC, bToggle, 'bcomp-'));
    };
    var bToggle = function (k) {
      bState[k] = !bState[k];
      var x = document.getElementById('bcomp-' + k);
      if (x) x.setAttribute('aria-pressed', bState[k] ? 'true' : 'false');
      bDraw();
    };
    var bandBtns = el('div', { class:'chips' }, NS.BANDS_BALLISTIC.map(function (x) {
      return el('button', { class:'chip band', id:'bband-' + x.key, 'aria-pressed':bBand[x.key] ? 'true' : 'false',
        style:{ '--bc':x.color }, title:x.label, onclick:function (ev) {
          bBand[x.key] = !bBand[x.key];
          ev.currentTarget.setAttribute('aria-pressed', bBand[x.key] ? 'true' : 'false');
          bDraw();
        } }, [el('i', { class:'bdot', style:{ background:x.color } }), x.name]);
    }));
    var bPan = panel('発光スペクトル（4K 分光カメラ ＋ 回折格子 600 lpm）',
      { note:(sp.station ? sp.station + ' · ' + sp.expo + ' · ' : '') + '炭素系アブレータ由来の C₂ と CN が卓越',
        tools:badge('弾道再突入体と判定', 'crit') }, [
      el('div', { class:'specbar' }, [
        el('span', { class:'lbl', text:'分子バンド' }), bandBtns,
        el('div', { class:'spacer' })
      ]),
      el('div', { class:'specbar' }, [
        el('span', { class:'lbl', text:'組成（原子線）' }),
        compChips(NS.COMP_BALLISTIC, bState, function () { bDraw(); }, 'bcomp-')
      ]),
      bChart,
      bChips,
      el('div', { class:'note', text:sp.note }),
      el('div', { style:{ marginTop:'10px' } }, bInfo),
      el('div', { style:{ marginTop:'10px' } }, NS.table(['分子種', 'バンド', '励起温度', '生成機構と意味', '参考'],
        NS.BANDS_BALLISTIC.map(function (x) {
          return [el('b', { style:{ color:x.color }, text:x.name }),
            { class:'sm', html:x.label.replace(/^[^（]*（/, '').replace(/）$/, '') },
            { class:'sm', html:x.Texc }, { class:'sm', html:x.origin },
            { class:'sm', html:'<span class="hint">' + x.ref + '</span>' }];
        }))),
      specRefBox(),
      el('div', { class:'src', text:'弾道再突入体のスペクトルは、炭素系アブレータ（カーボンフェノリック）をもつ再突入体に一般に期待される'
        + '化学種から構成した想定値である。C₂ スワンバンドと CN の同定、および Al I が弱いことの意味づけは、'
        + '「はやぶさ」カプセル（S. Abe et al. 2011, PASJ）およびロケットデブリ（Watanabe et al., ACM 2026）の'
        + '実測スペクトルとの対比による。表示している波形そのものはデモ用の合成スペクトルであり、実観測データではない。' })
    ]);
    bDraw();
    return bPan;
  }

  /* ---- 自然天体：静的表示 ---- */
  if (!art) {
    var nState = {}; NS.COMP_NATURAL.forEach(function (g) { nState[g.key] = true; });
    var nChart = el('div'), nChips = el('div', { class:'spec-lines' }), nInfo = el('div');
    var nDraw = function () {
      var ls = NS.filterByComp(sp.lines, NS.COMP_NATURAL, nState);
      var pts = NS.synthSpectrum(ls, { seed:sp.seed, cont:sp.cont, fwhm:sp.fwhm || 2.8, lo:350, hi:900, n:1200 });
      NS.clear(nChart);
      NS.add(nChart, buildSpecSvg({ pts:pts, lines:ls, art:false, w:W, uid:'f' }));
      NS.clear(nChips);
      NS.add(nChips, ls.slice().sort(function (p, q) { return q.s - p.s; }).slice(0, 18).map(function (l) {
        return el('span', { class:'sl', text:l.el + ' ' + NS.f(l.wl, 1) + ' nm' });
      }));
      NS.clear(nInfo);
      NS.add(nInfo, compTable(NS.COMP_NATURAL, nState, sp.lines, nToggle, 'ncomp-'));
    };
    var nToggle = function (k) {
      nState[k] = !nState[k];
      var b = document.getElementById('ncomp-' + k);
      if (b) b.setAttribute('aria-pressed', nState[k] ? 'true' : 'false');
      nDraw();
    };
    var natPan = panel('発光スペクトル（4K 分光カメラ ＋ 回折格子 600 lpm）',
      { note:(sp.station ? sp.station + ' · ' + sp.expo + ' · ' : '') + '自然天体（コンドライト的組成）· 連続光は約 '
             + NS.CONT_T_NATURAL.toLocaleString() + ' K の黒体',
        tools:badge('自然天体と判定', 'ok') }, [
      el('div', { class:'specbar' }, [
        el('span', { class:'lbl', text:'組成' }),
        compChips(NS.COMP_NATURAL, nState, function () { nDraw(); }, 'ncomp-')
      ]),
      nChart,
      nChips,
      el('div', { style:{ marginTop:'10px' } }, nInfo),
      el('div', { class:'note', text:sp.note }),
      el('div', { class:'note', html:'背景の連続光は、衝撃加熱された空気とアブレーション・プラズマの熱放射である。'
        + 'ここでは約 <b>' + NS.CONT_T_NATURAL.toLocaleString() + ' K の黒体</b>としてプランクの式から与えており、'
        + 'ウィーンの変位則どおり <b>580 nm 付近</b>でなだらかな極大をとる。輝線はこの弱い連続光の上に乗る。' }),
      el('div', { class:'note', text:'分子バンド（AlO 450–560 nm・CN 386–422 nm・TiO 515–725 nm）は検出されない。'
        + 'これらはスペースデブリ再突入に特徴的で、自然天体と人工天体を分ける有力な指標になる（デブリ再突入の画面で ON / OFF を切り替えて比較できる）。' }),
      specRefBox(),
      el('div', { class:'src', text:'線同定と相対強度は、実際に取得された流星スペクトル（S. Abe et al., 2000, しし座流星群の分光観測 ほか）の代表例に合わせて構成した。表示している波形そのものはデモ用の合成スペクトルであり、実観測データではない。回折格子は 600 本/mm（600 lpm）を想定。' })
    ]);
    nDraw();
    return natPan;
  }

  /* ---- 人工天体：局面 ＋ 分子バンドの ON / OFF ---- */
  var state = { phase:'ablation', bands:{ AlO:true, CN:true, TiO:true, FeO:false }, comp:{} };
  NS.COMP_ARTIFICIAL.forEach(function (g) { state.comp[g.key] = true; });
  var compBox = el('div');
  var chartBox = el('div'), infoBox = el('div'), chipsBox = el('div', { class:'spec-lines' });
  var phaseNote = el('div', { class:'note' });

  function redraw() {
    var r = NS.debrisSpectrum({ phase:state.phase, bands:state.bands, comp:state.comp });
    NS.clear(chartBox);
    NS.add(chartBox, buildSpecSvg({ pts:r.pts, lines:r.lines, bands:r.bands, art:true, w:W, uid:'d', labelMin:0.22 }));
    NS.clear(phaseNote);
    NS.add(phaseNote, [
      el('b', { text:r.phase.name + '（' + r.phase.ja + '）　高度 約 ' + r.phase.alt + ' km　黒体温度 約 ' + r.phase.T.toLocaleString() + ' K　' }),
      r.phase.note
    ]);
    NS.clear(chipsBox);
    var top = r.lines.slice().sort(function (p, q) { return q.s - p.s; }).slice(0, 14);
    NS.add(chipsBox, top.map(function (l) {
      return el('span', { class:'sl' + (isMarker(l.el) ? ' hi' : ''), text:l.el + ' ' + NS.f(l.wl, 1) + ' nm' });
    }));
    NS.add(chipsBox, r.bands.map(function (b) {
      return el('span', { class:'sl band', style:{ borderColor:b.def.color, color:b.def.color },
        text:b.def.name + '　' + b.def.Texc });
    }));
    NS.clear(compBox);
    NS.add(compBox, compTable(NS.COMP_ARTIFICIAL, state.comp, NS.LINES_ARTIFICIAL, compToggle, 'acomp-'));
    NS.clear(infoBox);
    NS.add(infoBox, NS.table(['分子種', 'バンド', '励起温度', '生成機構と意味', 'この局面での強度'],
      NS.BANDS_DEBRIS.map(function (b) {
        var amt = (NS.DEBRIS_PHASES.filter(function (p) { return p.key === state.phase; })[0].bands[b.key] || 0);
        return { attrs:{ class:'clk' + (state.bands[b.key] ? ' on' : ''), onclick:function () { toggle(b.key); } }, cells:[
          el('b', { style:{ color:b.def === undefined ? b.color : b.color }, text:b.name }),
          { class:'sm', html:b.label.replace(/^[^（]*（/, '').replace(/）$/, '') },
          { class:'sm', html:b.Texc },
          { class:'sm', html:b.origin + '<br><span class="hint">' + b.ref + '</span>' },
        ].concat([state.bands[b.key] ? NS.bar(amt, 'info') : el('span', { class:'hint', text:'OFF' })]) };
      })));
  }
  function compToggle(k) {
    state.comp[k] = !state.comp[k];
    var b = document.getElementById('acomp-' + k);
    if (b) b.setAttribute('aria-pressed', state.comp[k] ? 'true' : 'false');
    redraw();
  }
  function toggle(k) {
    state.bands[k] = !state.bands[k];
    var btn = document.getElementById('bandbtn-' + k);
    if (btn) btn.setAttribute('aria-pressed', state.bands[k] ? 'true' : 'false');
    redraw();
  }

  var phaseSeg = el('div', { class:'seg' }, NS.DEBRIS_PHASES.map(function (p) {
    return el('button', { text:p.ja, title:p.name + '（高度 約 ' + p.alt + ' km）',
      'aria-pressed':p.key === state.phase ? 'true' : 'false', onclick:function (ev) {
        state.phase = p.key;
        Array.prototype.forEach.call(ev.target.parentNode.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        ev.target.setAttribute('aria-pressed', 'true');
        redraw();
      } });
  }));
  var bandChips = el('div', { class:'chips' }, NS.BANDS_DEBRIS.map(function (b) {
    return el('button', { class:'chip band', id:'bandbtn-' + b.key, 'aria-pressed':state.bands[b.key] ? 'true' : 'false',
      style:{ '--bc':b.color }, title:b.label, onclick:function () { toggle(b.key); } },
      [el('i', { class:'bdot', style:{ background:b.color } }), b.name]);
  }));

  var pan = panel('発光スペクトル（4K 分光カメラ ＋ 回折格子 600 lpm）',
    { note:(sp.station ? sp.station + ' · ' + sp.expo + ' · ' : '') + '人工物由来の金属線と酸化物バンドを検出',
      tools:badge('人工天体と判定', 'crit') }, [
    el('div', { class:'specbar' }, [
      el('span', { class:'lbl', text:'再突入の局面' }), phaseSeg,
      el('div', { class:'spacer' }),
      el('span', { class:'lbl', text:'分子（酸化物）バンド' }), bandChips
    ]),
    el('div', { class:'specbar' }, [
      el('span', { class:'lbl', text:'組成（原子線）' }),
      compChips(NS.COMP_ARTIFICIAL, state.comp, function () { redraw(); }, 'acomp-')
    ]),
    phaseNote,
    chartBox,
    chipsBox,
    el('div', { class:'note', text:sp.note }),
    el('div', { style:{ marginTop:'10px' } }, compBox),
    el('div', { style:{ marginTop:'10px' } }, infoBox),
    specRefBox(),
    el('div', { class:'src', text:'分子バンド（AlO・CN・TiO・FeO）の同定、励起温度、および 発光開始 → アブレーション → 爆発 → 分裂 → 終端 の推移は、'
      + 'Watanabe, Abe, Arima & Hanayama「Spectroscopic Study of Rocket Debris during Atmospheric Re-entry」（ACM 2026）による '
      + 'LM-3B 第 2 段の再突入分光観測（2024-12-21、石垣島天文台、Sony α7S ＋ SAMYANG 24mm F1.4 ＋ Edmund Optics 600 grooves/mm 透過型回折格子）に基づく。'
      + '同観測では CN の励起温度 約 12,000 K、AlO の励起温度 約 5,000–9,000 K、平均表面温度 5,436 K（サンプルリターンカプセルの約 2 倍）が得られている。'
      + '表示している波形そのものはデモ用の合成スペクトルであり、実観測データではない。' })
  ]);
  redraw();
  return pan;
}
NS.specPanel = specPanel;

/* =========================================================================
   スペースデブリ再突入（G-2）
   ========================================================================= */
NS.V.reentry = function (root, go, arg) {
  var list = NS.REENTRIES || [NS.FLAGSHIP.reentry];
  var e = (NS.EVMAP[arg] && NS.EVMAP[arg].kind === 'reentry') ? NS.EVMAP[arg] : list[0];
  var bal = !!e.ballistic;
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'再突入天体の光学・分光・音響観測' }),
    el('p', { text:'公開軌道要素から再突入を予報し、光学・SWIR・分光・インフラサウンドで実観測する。破片化の過程と大気への金属注入量を地上から直接推定する。速度・経路角・継続時間・スペクトルの組み合わせで、自然火球・軌道デブリ・弾道飛翔体を区別する（サブテーマ G-2 / DT-1）。' }),
    el('div', { class:'seg', style:{ marginTop:'10px' } }, list.map(function (x) {
      return el('button', { text:x.tab || (x.scenario ? '弾道飛翔体（想定シナリオ）' : '軌道デブリ（衛星の再突入）'),
        title:x.name, 'aria-pressed':x.id === e.id ? 'true' : 'false',
        onclick:function () { go('reentry', x.id); } });
    }))
  ]));
  if (e.scenario) {
    NS.add(root, el('div', { class:'scnbanner', style:{ marginBottom:'14px' } }, [
      el('b', { text:e.scenarioTitle || '訓練用の想定シナリオです' }),
      el('span', { text:e.scenarioNote })]));
  }

  /* 予報リスト（軌道デブリのときだけ。弾道飛翔体は軌道要素が公開されない） */
  if (!bal) NS.add(root, panel('再突入 予報（今後 5 日）', { note:'公開軌道要素（TLE）＋大気密度モデルによる推定。予報窓は残存寿命に比例して広がる' },
    NS.table(['対象', 'NORAD / COSPAR', '種別', '質量', '予報時刻 (JST)', '予報窓', '近地点/遠地点', '傾斜角', '日本上空', '可視の見込み'],
      NS.FORECAST.map(function (f) {
        return [el('b', { text:f.name }), { class:'mono sm', html:f.norad + '<br>' + f.cospar }, f.type,
          { class:'r', html:f.mass + ' kg' }, { class:'mono', html:NS.fmtJST(f.t, { sec:false }) },
          { class:'r', html:'± ' + NS.f(f.windowMin, 0) + ' 分' },
          { class:'r mono sm', html:f.perigee + ' / ' + f.apogee + ' km' }, { class:'r', html:f.inc + '°' },
          f.overJapan ? badge('通過あり', 'warn') : badge('なし', 'dim'),
          NS.bar(f.pVisible, f.pVisible > 0.4 ? 'warn' : 'info')];
      }))));

  /* 観測事例 */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel(e.name,
    { note:e.id + ' · ' + NS.fmtJST(e.t, { ms:true }) + ' JST · ' + e.objName,
      tools:e.scenario ? badge('想定シナリオ（実観測ではない）', 'warn') : badge(e.stationsDet + ' 局同時検出', 'ok') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' }, text:e.summary }),
    el('div', { class:'grid g4' }, [
      kpi('最大絶対等級', NS.f(e.absMag, 1), '等', '継続 ' + NS.f(e.dur, 1) + ' 秒', { acc:true }),
      kpi('突入速度', NS.f(e.vInf, 2), 'km/s', '自然火球（11〜72 km/s）より明確に遅い'),
      kpi('経路角', NS.f(e.entryAngle, 2), '°',
          bal ? '軌道デブリ（1〜3°）よりはるかに急 ＝ 弾道軌道の特徴' : '極めて浅い ＝ 人工天体の特徴'),
      kpi('対象質量', e.objMass, 'kg', e.objArea)
    ])
  ])));

  /* 予報精度（弾道飛翔体は軌道要素が無いので、落下点の独立推定に置き換える） */
  var b = e.ballistic;
  NS.add(root, el('div', { class:'grid g3', style:{ marginTop:'14px' } }, [
    e.plan ? panel('真値との照合（観測網の較正）', { note:e.plan.src }, [
      NS.table(['量', '真値（飛行計画・GNSS）', '本観測網の推定', '差'], e.plan.rows.map(function (r) {
        return [el('b', { text:r.k }), { class:'mono sm', html:r.truth }, { class:'mono sm', html:r.obs },
          { class:'r mono', html:r.diff }];
      })),
      el('div', { class:'note', text:e.plan.note })
    ]) : bal ? panel('落下点の独立推定', { note:'8 局のインフラサウンド到達時刻差の交会による' }, [
      NS.kv([
        ['J-ALERT', b.jalert.label],
        ['本観測網の落下時刻', NS.fmtJST(e.t + (e.dur + 42) * 1000, { sec:true }) + '（推定誤差 ± ' + NS.f(b.splashErrSec, 1) + ' 秒）'],
        ['推定落下点', NS.latlon(e.impact.lat, e.impact.lon) + '<br><span class="hint">' + e.impact.name + '</span>'],
        ['落下点の誤差', '<b>± ' + NS.f(b.splashErrKm, 1) + ' km</b>（音響交会）／ ± 6.1 km（光学の軌跡延長）'],
        ['海域', b.eez],
        ['防衛省の予測との差', '<b>' + NS.f(e.predict.errKm, 1) + ' km</b> / ' + NS.f(e.predict.errMin, 1) + ' 分']
      ], 'wide'),
      el('div', { class:'note', text:b.note })
    ]) : panel('予報と実測の比較', { note:'再突入予報の検証（G-2 の中核指標）' }, [
      NS.kv([
        ['予報発出', NS.f(-e.predict.issued, 1) + ' 時間前'],
        ['使用軌道要素', e.predict.srcTLE],
        ['予報窓', '± ' + e.predict.windowMin + ' 分'],
        ['時刻誤差（実測−予報）', '<b>' + NS.f(e.predict.errMin, 1) + ' 分</b>'],
        ['位置誤差', '<b>' + NS.f(e.predict.errKm, 0) + ' km</b>'],
        ['判定', '予報窓内。位置誤差は軌道方向に沿った成分が支配的']
      ], 'wide'),
      el('div', { class:'note', text:'再突入予報の誤差は主に大気密度モデルと姿勢（断面積）の不確かさに由来する。実観測による検証データを蓄積し、JAXA 宇宙状況把握（SSA）へ共有する。' })
    ]),
    panel('破片化シーケンス', { note:'光度曲線のフレアと破片数の対応' },
      NS.table(['経過', '高度', '破片数', '事象'], e.frag.map(function (f) {
        return [{ class:'r mono', html:'+' + NS.f(f.t, 1) + ' s' }, { class:'r', html:NS.km(f.alt) },
          { class:'r', html:String(f.n) }, { class:'sm', html:f.note }];
      }))),
    panel(bal ? '大気へのアブレーション質量' : '大気への金属注入量の推定', { note:'アブレーション質量の元素分配' }, [
      NS.chart.bars({ bars:(e.ablation.parts || [
        { el:'Al', kg:e.ablation.alKg, color:'var(--accent)' },
        { el:'Cu', kg:e.ablation.cuKg, color:'var(--c-warn)' },
        { el:'Li', kg:e.ablation.liKg, color:'var(--c-info)' }
      ]).map(function (x) { return { y:x.kg, label:x.el, color:x.color, top:NS.f(x.kg, x.kg < 1 ? 2 : 1) }; }),
        height:150, yLabel:'kg' }),
      NS.kv([['総アブレーション質量', NS.f(e.ablation.totalKg, 0) + ' kg（対象質量の ' + Math.round(e.ablation.totalKg / e.objMass * 100) + '%）'],
             ['その他', e.ablation.other]], 'wide'),
      el('div', { class:'note', text:e.ablation.note })
    ])
  ]));

  /* 飛行の時系列（ロックーン方式など、計画の分かっている飛行） */
  if (e.timeline) {
    NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('飛行の時系列（ロックーン方式）', {
      note:'気球で成層圏まで運び、そこからロケットを空中発射する。空中発射の時刻を 0 秒とする',
      tools:badge('頂点 ' + e.ballistic.apogeeKm + ' km', 'info') }, [
      el('ul', { class:'tl' }, e.timeline.map(function (x) {
        return el('li', { class:'i-info' }, [
          el('div', { class:'tt', text:x.t }),
          el('div', { class:'tx', text:x.ev })
        ]);
      })),
      el('div', { class:'note', text:'ロックーン方式は、気球で大気の濃い層を越えてから点火するので、'
        + '同じ推進薬でも到達高度を稼げる。打上げ地点が洋上で、飛行計画が事前に共有されるため、'
        + '観測網にとっては「いつ・どこで・どんな速度で落ちてくるかが分かっている再突入」になる。' })
    ])));
  }

  /* 光度曲線 + 地図 */
  var series = e.det.map(function (d, i) {
    var r = NS.rng(e.id + d.id), off = d.mag - e.absMag;
    return { name:NS.ST[d.id].name, color:['var(--accent)','var(--c-info)','var(--c-ok)','var(--c-warn)','var(--c-sky)','var(--c-spec)'][i % 6],
      pts:e.lightcurve.map(function (p) { return [p[0], p[1] + off + r.norm(0, 0.08)]; }), width:1.15, opacity:i === 0 ? 1 : 0.6 };
  });
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawStations({ state:function (st) { return NS.stationState(st, NS.now()); } });
  M.addOverlay(s('path', { d:NS.geoLinePath(e.begin, e.end), stroke:'var(--c-info)', 'stroke-width':2.6, fill:'none',
    'stroke-linecap':'round', 'vector-effect':'non-scaling-stroke' }));
  e.det.forEach(function (d) {
    var st = NS.ST[d.id]; if (!st) return;
    M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, { lat:(e.begin.lat + e.end.lat) / 2, lon:(e.begin.lon + e.end.lon) / 2 }, 16),
      stroke:'var(--c-info)', 'stroke-width':0.9, 'stroke-dasharray':'3 3', fill:'none', opacity:0.45, 'vector-effect':'non-scaling-stroke' }));
  });
  M.fit([e.begin, e.end], 0.9);
  e.frag.forEach(function (f) {
    var lat = e.begin.lat + (e.end.lat - e.begin.lat) * (f.t / e.dur), lon = e.begin.lon + (e.end.lon - e.begin.lon) * (f.t / e.dur);
    var p = M.pt(lon, lat);
    var g = M.addOverlay(s('circle', { cx:p[0], cy:p[1], r:M.px(3.5 + f.n * 0.35), fill:'var(--accent)', 'fill-opacity':0.5, stroke:'var(--accent)', 'stroke-width':1, 'vector-effect':'non-scaling-stroke' }));
    M.tipOn(g, '<b>+' + NS.f(f.t, 1) + ' s · ' + NS.km(f.alt) + '</b><span class="mt-d">破片 ' + f.n + ' 個</span><span class="mt-x">' + f.note + '</span>');
  });
  if (e.impact) {
    /* 発光終了から海面までは光らない（暗黒飛行）。音だけがこの区間を飛び越える */
    M.addOverlay(s('path', { d:NS.geoLinePath(e.end, e.impact), stroke:'var(--c-crit)', 'stroke-width':2,
      'stroke-dasharray':'5 4', fill:'none', 'vector-effect':'non-scaling-stroke', opacity:0.85 }));
    var ip = M.pt(e.impact.lon, e.impact.lat);
    M.addOverlay(s('circle', { cx:ip[0], cy:ip[1], r:M.px(6.5), fill:'none', stroke:'var(--c-crit)',
      'stroke-width':1.6, 'vector-effect':'non-scaling-stroke' }));
    var ig = M.addOverlay(s('path', { d:'M' + (ip[0] - M.px(5)) + ' ' + ip[1] + 'h' + M.px(10) +
      'M' + ip[0] + ' ' + (ip[1] - M.px(5)) + 'v' + M.px(10), stroke:'var(--c-crit)', 'stroke-width':1.6,
      'vector-effect':'non-scaling-stroke' }));
    M.tipOn(ig, '<b>推定落下点</b><span class="mt-d">' + NS.latlon(e.impact.lat, e.impact.lon) +
      '</span><span class="mt-x">' + e.impact.name + '</span>');
    M.fit([e.begin, e.end, e.impact], 0.7);
  } else {
    M.fit([e.begin, e.end], 0.9);
  }
  var mp = panel(e.impact ? '地上軌跡・暗黒飛行・推定落下点' : '地上軌跡と破片化地点',
    { note:e.impact ? '実線は発光区間、赤の破線は発光終了（高度 27 km）から海面までの暗黒飛行。✕ が推定落下点。市区町村の境界は国土数値情報 行政区域データ（国土交通省）による'
                    : '円の大きさは破片数。市区町村の境界は国土数値情報 行政区域データ（国土交通省）による' }, []);
  var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);

  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('光度曲線（局別）', { note:bal ? '22 秒の発光。急な経路角のため短時間で深く入り、減速が強い区間で最大光度になる'
                                          : '38 秒にわたる長い発光。4 回の主フレアが破片化に対応' }, [
      NS.chart.line({ series:series, width:660, height:250, xLabel:'発光開始からの秒数', yLabel:'絶対等級',
        yDomain:[e.absMag > -7.5 ? 3.2 : 2.6, e.absMag - 1.0], xFmt:function (v) { return NS.f(v, 0) + 's'; }, yFmt:function (v) { return NS.f(v, 0); },
        rules:e.frag.map(function (f) { return { x:f.t, color:'var(--muted)', dash:'2 3' }; }) }),
      NS.chart.legend(series.map(function (x) { return [x.name, x.color, 'line']; })),
      el('div', { class:'note', text:bal ? '自然火球は 0.5〜8 秒、軌道デブリは 20〜120 秒。22 秒という長さは軌道デブリに近いが、経路角 38° と速度 5.9 km/s の組み合わせはどちらとも重ならない。急な経路角では大気の密度が急に増すため、光度曲線の立ち上がりが鋭くなる。'
                                          : '自然火球の継続時間は通常 1〜5 秒。38 秒という長い発光と浅い経路角は、円軌道からの人工天体の再突入に特有である。' })
    ]),
    mp
  ]));

  /* --- インフラサウンドの解析 --- */
  var reInfra = e.det.filter(function (d) { return d.infra; });
  if (reInfra.length) {
    /* 音は経路のうち各局にいちばん近い点から届く（NS.infraGeom で求めてある） */
    var cel = reInfra.map(function (d) {
      return { d:d, st:NS.ST[d.id], slant:d.infra.km, c:d.infra.cel || (d.infra.km / d.infra.dt) };
    });
    var cAvg = cel.reduce(function (a, x) { return a + x.c; }, 0) / cel.length;
    var cSd = Math.sqrt(cel.reduce(function (a, x) { return a + (x.c - cAvg) * (x.c - cAvg); }, 0) / cel.length);
    var srcAlt = reInfra.reduce(function (a, d) { return a + (d.infra.src ? d.infra.src.alt : 0); }, 0) / reInfra.length;
    var ws2 = reInfra.map(function (d, i) {
      return { name:NS.ST[d.id].name, color:['var(--accent)','var(--c-info)','var(--c-ok)','var(--c-warn)'][i % 4],
        pts:NS.wavePacket({ P:d.infra.P, amp:d.infra.amp, seed:e.id + d.id, dur:Math.max(30, e.dur * 2),
                            pre:10, width:d.infra.P * 1.4, noise:0.02 })
          .map(function (p) { return [p[0] + d.infra.dt, p[1] + (reInfra.length - 1 - i) * 1.1]; }), width:1.1 };
    });
    NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
      panel('インフラサウンド波形（局別・時刻同期）', {
        note:'GNSS 同期。横軸は発光ピークからの経過秒。' + (bal
          ? '経路角が急なので音源は一点に近く、各局の波形はよく似た形になる'
          : '経路角が浅く軌跡が長いので音源は線状に伸び、局ごとに到達が大きくばらつく') }, [
        NS.chart.line({ series:ws2, width:560, height:220, xLabel:'発光からの経過秒', yLabel:'気圧変動（相対 Pa）',
          xFmt:function (v) { return NS.f(v, 0) + 's'; }, yFmt:function () { return ''; },
          rules:reInfra.map(function (d) { return { x:d.infra.dt, color:'var(--muted)', dash:'2 3', label:NS.ST[d.id].id }; }) }),
        el('div', { class:'note', html:'各局の到達時刻と音源までの距離から求めた<b>見かけの音速は '
          + NS.f(cAvg, 3) + ' ± ' + NS.f(cSd, 3) + ' km/s</b>。'
          + '成層圏の東西風で経路ごとに数 % ばらつくので、この差そのものが高層風の情報になる（G-4）。' })
      ]),
      panel('到達・周期・方位', { note:'周期 P から AFTAC の周期–収量関係でエネルギーを出す' }, [
        NS.table(['観測局', '距離', '到達', '周期 P', '振幅', '到来方位', '見かけ音速'],
          cel.map(function (x) {
            return [NS.ST[x.d.id].name, { class:'r', html:NS.km(x.slant, 0) },
              { class:'r', html:'＋' + NS.f(x.d.infra.dt, 1) + ' s' },
              { class:'r', html:NS.f(x.d.infra.P, 2) + ' s' },
              { class:'r', html:NS.f(x.d.infra.amp, 2) + ' Pa' },
              { class:'r', html:NS.f(x.d.infra.az, 1) + '°' },
              { class:'r mono sm', html:NS.f(x.c, 3) }];
          })),
        NS.kv([
          ['代表周期 P', NS.f(e.infraP, 2) + ' s'],
          ['音響エネルギー', NS.sig(e.EinfKt * 1e3) + ' × 10⁻³ kt <span class="hint">（AFTAC 周期–収量関係）</span>'],
          ['光学エネルギー', NS.sig(e.ErKt * 1e3) + ' × 10⁻³ kt <span class="hint">（放射エネルギーから）</span>'],
          ['音源（各局の最寄り点）', '平均高度 ' + NS.km(srcAlt, 0) + '　<span class="hint">経路のうち、その局にいちばん近い点から届く</span>']
        ], 'wide'),
        el('div', { class:'note', text:'光学と音響は独立な二つのエネルギー推定で、両者が factor 2 以内で一致すれば'
          + '発光効率の仮定が妥当だったことになる。再突入体は自然火球より遅いぶん発光効率が小さく、'
          + '光学だけでは過小評価になりやすいので、音響側の拘束が効く。' })
      ])
    ]));
  }

  /* SWIR + 検出局 */
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    panel('SWIR 冷却カメラによる熱放射観測', { note:'ZWO ASI992MM Pro（IMX992 InGaAs, 0.4–1.7 µm）· '
      + NS.t('設置 ') + NS.swirStations().length + NS.t(' 局中 ') + e.swirObs.stations.length + NS.t(' 局で取得') }, [
      el('div', { class:'split' }, [
        NS.chart.gauge({ value:e.swirObs.tempK, min:800, max:3000, unit:'K（破片表面）', text:String(e.swirObs.tempK),
          color:'var(--accent)', zones:[[800, 930, 'var(--c-info)'], [930, 2400, 'var(--c-warn)'], [2400, 3000, 'var(--c-crit)']],
          minLabel:'800', maxLabel:'3000' }),
        el('div', { style:{ flex:'1', minWidth:'240px' } }, NS.kv([
          ['観測波長帯', e.swirObs.band],
          ['推定温度', e.swirObs.tempK + ' ± ' + e.swirObs.tempErr + ' K'],
          ['アルミ合金の融点', '約 930 K'], ['酸化アルミの沸点', '約 3250 K'],
          ['取得局', e.swirObs.stations.map(function (i) { return NS.ST[i].name; }).join('・')]
        ], 'wide'))
      ]),
      el('div', { class:'note', text:e.swirObs.note })
    ]),
    panel('検出局', { note:'視野内 ' + e.stationsFov + ' 局 / 検出 ' + e.stationsDet + ' 局' },
      NS.table(['観測局', '最大等級', '仰角', 'SWIR', '音響'], e.det.map(function (d) {
        return { attrs:{ class:'clk', onclick:function () { go('station', d.id); } }, cells:[
          NS.ST[d.id].name, { class:'r', html:NS.mag(d.mag) }, { class:'r', html:NS.f(d.elev, 1) + '°' },
          d.swir ? badge('取得', 'info') : '<span class="hint">—</span>',
          d.infra ? '＋' + NS.f(d.infra.dt, 0) + ' s' : '<span class="hint">—</span>'] };
      })))
  ]));

  /* 地球上の推定軌道とフィッティング（軌道デブリのときだけ。弾道飛翔体は周回しない） */
  if (!bal && NS.debrisTrackPanel) {
    NS.add(root, el('div', { class:'grid', style:{ gap:'14px', marginTop:'14px' } }, NS.debrisTrackPanel(e, go)));
  }

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, specPanel(e, { w:1180 })));

  /* 弾道飛翔体シナリオ：J-ALERT との関係と学校の対応 */
  if (bal) {
    NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
      panel('J-ALERT との関係', { note:'警報を出すのは国。本観測網は「落ちた場所と時刻」を後から独立に確かめる',
        tools:badge('本観測網は警報を出さない', 'warn') }, [
        el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
          text:'弾道飛翔体の探知・警報は、防衛省の早期警戒衛星とレーダー、内閣官房・消防庁の J-ALERT が担う。'
            + '本観測網にその役割はなく、代われるものでもない。できるのは、警報が出たあとに残る「結局どこへ落ちたのか」'
            + 'という問いに、光学と音の実測から独立した答えを出すことである。自治体と学校が屋外活動の再開を判断するとき、'
            + 'また航行警報の解除を検討するときに、この独立推定が材料になる。' }),
        NS.table(['時刻', '担い手', '内容'], [
          [{ class:'mono sm', html:'−8 分 06 秒' }, badge('防衛省・内閣官房', 'crit'), 'J-ALERT 発出。落下予測海域と時刻を通知'],
          [{ class:'mono sm', html:'0 秒' }, badge('本観測網', 'info'), '8 局の全天カメラが再突入発光を検出'],
          [{ class:'mono sm', html:'+22 秒' }, badge('本観測網', 'info'), '多点三角測量で軌跡を決定（経路角 38.0°・速度 5.9 km/s）'],
          [{ class:'mono sm', html:'+64 秒' }, badge('本観測網', 'info'), '軌跡の延長から落下点を推定（± 6.1 km）'],
          [{ class:'mono sm', html:'+9 分 12 秒' }, badge('本観測網', 'info'), '8 局のインフラサウンド到達時刻差の交会で落下点を確定（± 3.8 km）'],
          [{ class:'mono sm', html:'+12 分 14 秒' }, badge('本観測網', 'ok'), '茨城県・県教委・海保第三管区へ観測結果を情報提供'],
          [{ class:'mono sm', html:'+20 分' }, badge('自治体・学校', 'ok'), '落下海域が陸から 210 km 沖と確認され、屋外活動を再開']
        ], 'wide'),
        el('div', { class:'note', text:'警報・避難の判断は内閣官房・防衛省・消防庁の発表が優先する。本観測網の推定値は、'
          + '不確かさ（± 3.8 km / ± 2.4 秒）を必ず併記して提供する。' })
      ]),
      panel('学校と自治体の対応（G-7）', { note:'J-ALERT が鳴ったあと、現場で足りないのは「終わったかどうか」の判断材料' }, [
        NS.table(['局面', '現場で起きること', '本観測網が出せるもの'], [
          ['警報中', '屋内退避。登校時間帯なら通学路で足止めが生じる', '（観測網の役割なし。国の警報に従う）'],
          ['落下直後', '「どこに落ちたか」が分からないまま待機が続く', '再突入発光の検出と、軌跡からの落下点の速報（+64 秒）'],
          ['確認', '報道や発表を待つ時間が長く、再開の判断ができない', '音響交会による落下点の確定（± 3.8 km）と落下時刻（± 2.4 秒）'],
          ['再開', '屋外活動・部活動・下校をいつ戻すかの判断', '陸域からの距離と、破片が陸へ到達しないことの根拠'],
          ['事後', '記録が残らず、次の訓練に活かせない', '波形・映像・解析の一式を保存し、訓練の検証材料にする']
        ], 'wide'),
        el('div', { class:'note', text:'茨城・福島・千葉の付属校 3 校を対象に、J-ALERT の受信から再開判断までを通した訓練を'
          + '危機管理学部と合同で設計する。観測網は訓練のたびに「実際に何秒で何が分かったか」を記録し、手順の見直しに使う。' })
      ])
    ]));
  }

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('自然火球・軌道デブリ・弾道飛翔体の識別',
    { note:'本観測網が同一事象について同時に得る指標。3 者は速度と経路角の組み合わせで重ならない' },
    NS.table(['指標', '自然火球', '軌道デブリ（衛星）', '弾道飛翔体（再突入体）', 'この事象'], [
      ['突入速度', '11.2 – 72 km/s', '7.4 – 8.0 km/s', '4 – 7 km/s',
        el('b', { text:NS.f(e.vInf, 2) + ' km/s' })],
      ['経路角', '10 – 80°', '0.5 – 3°', '25 – 50°', el('b', { text:NS.f(e.entryAngle, 1) + '°' })],
      ['継続時間', '0.5 – 8 秒', '20 – 120 秒', '15 – 40 秒', el('b', { text:NS.f(e.dur, 1) + ' 秒' })],
      ['最強の原子線', 'Mg I 518 / Na I 589', 'Al I 394・396', 'Fe I 多重項・Cr I 425–429',
        el('b', { text:bal ? 'Fe I・Cr I → 弾道' : 'Al・Cu・Li → 衛星' })],
      ['分子バンド', '検出されない', 'AlO・CN・TiO', 'C₂ スワンバンド・CN（強）',
        el('b', { text:bal ? 'C₂ 検出 → 炭素アブレータ' : 'AlO・CN・TiO → 衛星' })],
      ['アルミの強さ', '（該当なし）', '最強', 'ごく弱い', el('b', { text:bal ? '弱い → 弾道' : '最強 → 衛星' })],
      ['リチウム（電池）', '検出されない', 'Li I 670.8 を検出', '検出されない',
        el('b', { text:bal ? '未検出 → 電池を持たない' : '検出 → 衛星' })],
      ['表面温度（SWIR）', '2,000 K 前後', '約 2,100 K（アルミの気化域）', '2,500 K 以上（炭素アブレータ）',
        el('b', { text:e.swirObs.tempK + ' K' })],
      ['事前情報との照合', '該当なし', '公開 TLE と一致', 'J-ALERT の落下予測と照合',
        el('b', { text:bal ? '予測との差 ' + NS.f(e.predict.errKm, 1) + ' km' : '一致（' + e.predict.errMin + ' 分差）' })]
    ]))));

};

/* =========================================================================
   インフラサウンド（G-4）
   ========================================================================= */
NS.V.infra = function (root, go, arg) {
  var evs = NS.INFRA;
  var sel = NS.EVMAP[arg] && (NS.EVMAP[arg].kind === 'infrasound' || NS.EVMAP[arg].kind === 'seismic') ? NS.EVMAP[arg] : evs[0];

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'インフラサウンド全国アレイ' }),
    el('p', { text:'全 14 局に 2 台ずつ（基線約 60 m のペア配置）設置したインフラサウンドセンサーを GNSS で時刻同期し、全国を一つのアレイとして扱う。火山噴火・雷・ロケット・津波・火球衝撃波を検知・定位し、線状降水帯の早期検知や成層圏風の逆推定にも用いる（サブテーマ G-4 / DT-4）。' })
  ]));

  NS.add(root, el('div', { class:'grid g4' }, [
    kpi('検出事象（24 時間）', 1846, '件', '雷 1,842 · 火山 1 · 火球 2 · ロケット 1', { icon:'〰', acc:true }),
    kpi('見かけの音速', '0.30', 'km/s', '直達波（Iw）· 成層圏反射波は 0.28 km/s 前後'),
    kpi('観測周波数帯', '0.1 – 1000', 'Hz', '株式会社サヤ INF03 · 130/110 dB SPL 切替'),
    kpi('定位精度（較正事象）', '3.1', 'km', '種子島の打上げを既知音源として検証')
  ]));

  var listWrap = el('div', { class:'evlist' });
  evs.forEach(function (e) {
    NS.add(listWrap, NS.evRow(e, function (x) { go('infra', x.id); }, sel.id));
  });
  var listPanel = panel('主な検出事象', { note:(evs.length + 1) + ' 件（うち 1 件は訓練用の想定シナリオ）' }, []);
  listPanel.querySelector('.panel-b').classList.add('flush');
  listPanel.querySelector('.panel-b').appendChild(listWrap);
  var rb = NS.rainband();
  NS.add(listWrap, el('div', { class:'evrow', role:'button', tabindex:'0', onclick:function () {
      go('weather'); setTimeout(function () {
        var t2 = document.getElementById('rainband'); if (t2) t2.scrollIntoView({ block:'start' }); }, 60);
    } }, [
    el('div', { class:'ei', text:'🌧' }),
    el('div', null, [
      el('div', { class:'en' }, [rb.name, badge('気象 →', 'info')]),
      el('div', { class:'em', text:NS.fmtJST(rb.t, { sec:false }) + ' JST · ' + NS.ago(rb.t) })
    ]),
    el('div', { class:'ev' }, [rb.strikesTotal.toLocaleString() + ' 回', el('small', { text:rb.det.length + ' 局' })])
  ]));

  var detail = el('div', { class:'grid', style:{ gap:'14px' } });
  NS.add(root, el('div', { class:'grid g-1-2', style:{ marginTop:'14px' } }, [listPanel, detail]));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('防災科研（NIED）の公開データとの突き合わせ',
    { note:'火口近傍の空振計と突き合わせて、遠方からの規模推定を較正する' },
    [NS.niedTable('火山'), el('div', { class:'src', text:NS.niedNote })])));

  var e = sel;
  if (e.kind === 'seismic') { renderSeismic(); } else { renderInfra(); }

  function renderInfra() {
    if (e.scenario) {
      NS.add(detail, el('div', { class:'scnbanner' }, [
        el('b', { text:'訓練用の想定シナリオです' }),
        el('span', { text:e.scenarioNote })]));
    }
    NS.add(detail, panel(e.name, { note:e.id + ' · ' + NS.fmtJST(e.t) + ' JST · ' + e.cls,
      tools:e.scenario ? badge('想定シナリオ（実観測ではない）', 'warn')
        : (e.srcKnown ? badge('音源既知（較正可能）', 'ok') : badge('音源推定', 'info')) }, [
      el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' }, text:e.summary }),
      el('div', { class:'grid g4' }, [
        kpi('検出局数', e.det.length, '局', '全 14 局中'),
        kpi('最大振幅', NS.f(e.peakPa, 2), 'Pa', '周波数帯 ' + e.freq),
        kpi('定位誤差', '±' + NS.f(e.locErr, 1), 'km', e.srcKnown ? '既知の音源位置との差' : '交会法の 1σ'),
        e.plume ? kpi('推定 噴煙高度', NS.f(e.plume, 1), 'km', '空振の振幅と周期から推定（VEI ' + e.vei + ' 相当・' + e.ref + ' を参考）')
                : kpi('見かけの音速', NS.f(e.cel, 3), 'km/s', '到達時刻差から推定')
      ])
    ]));

    /* 波形 */
    var ws = e.det.map(function (d, i) {
      return { name:NS.ST[d.id].name, color:['var(--c-infra)','var(--c-info)','var(--c-warn)','var(--accent)'][i % 4],
        pts:NS.wavePacket({ P:d.P, amp:d.amp, seed:e.id + d.id, dur:Math.max(60, d.P * 22), pre:Math.max(60, d.P * 22) * 0.35, width:d.P * 2.4, noise:0.012 })
          .map(function (p) { return [p[0] + d.dt, p[1] / Math.max(0.2, e.peakPa) * 1.0 + (e.det.length - 1 - i) * 1.5]; }), width:1.1 };
    });
    var tmax = Math.max.apply(null, e.det.map(function (d) { return d.dt; }));
    var useMin = tmax > 900;
    NS.add(detail, panel('波形（時刻同期・局別）', { note:'横軸は発生時刻からの経過時間。振幅は最大値で規格化して縦にずらして表示' }, [
      NS.chart.line({ series:ws, width:900, height:250, xLabel:useMin ? '発生からの経過（分）' : '発生からの経過（秒）', yLabel:'気圧変動（規格化）',
        xFmt:function (v) { return useMin ? NS.f(v / 60, 0) : NS.f(v, 0); }, yFmt:function () { return ''; },
        rules:e.det.map(function (d) { return { x:d.dt, color:'var(--muted)', dash:'2 3', label:NS.ST[d.id].id }; }) }),
      NS.chart.legend(e.det.map(function (d, i) { return [NS.ST[d.id].name + '（' + NS.f(d.dist, 0) + ' km）', ws[i].color, 'line']; }))
    ]));

    /* 地図：方位交会 */
    var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
    M.drawStations({ state:function (st) { return NS.stationState(st, NS.now()); } });
    e.det.forEach(function (d) {
      var st = NS.ST[d.id];
      var p0 = M.pt(st.lon, st.lat);
      /* 到来方位から音源方向へ伸ばす扇（誤差角） */
      var L = d.dist * 1.35;
      [-d.azErr, 0, d.azErr].forEach(function (da, k) {
        var az = (d.az + da) * NS.d2r;
        var lat2 = st.lat + L * Math.cos(az) / 111.32, lon2 = st.lon + L * Math.sin(az) / (111.32 * Math.cos(st.lat * NS.d2r));
        M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, { lat:lat2, lon:lon2 }, 12),
          stroke:'var(--c-infra)', 'stroke-width':k === 1 ? 1.6 : 0.7, 'stroke-dasharray':k === 1 ? null : '3 3',
          fill:'none', opacity:k === 1 ? 0.85 : 0.4, 'vector-effect':'non-scaling-stroke' }));
      });
      /* 到達時刻の等時線 */
      M.addOverlay(s('path', { d:NS.geoCirclePath(st.lat, st.lon, d.dist), stroke:'var(--c-infra)', 'stroke-width':0.8,
        'stroke-dasharray':'2 4', fill:'none', opacity:0.35, 'vector-effect':'non-scaling-stroke' }));
    });
    M.fit([e.src].concat(e.det.map(function (d) { return { lat:NS.ST[d.id].lat, lon:NS.ST[d.id].lon }; })), 0.35);
    var sp = M.pt(e.src.lon, e.src.lat);
    M.addOverlay(s('circle', { cx:sp[0], cy:sp[1], r:M.px(5.5), fill:'var(--accent)', stroke:'var(--panel)', 'stroke-width':1.4, 'vector-effect':'non-scaling-stroke' }));
    var kx = Math.abs(M.pt(e.src.lon + 0.1, e.src.lat)[0] - sp[0]) / (0.1 * 111.32 * Math.cos(e.src.lat * NS.d2r));
    M.addOverlay(s('circle', { cx:sp[0], cy:sp[1], r:e.locErr * kx, fill:'var(--accent)', 'fill-opacity':0.18,
      stroke:'var(--accent)', 'stroke-width':1, 'vector-effect':'non-scaling-stroke' }));
    M.fit([e.src].concat(e.det.map(function (d) { return { lat:NS.ST[d.id].lat, lon:NS.ST[d.id].lon }; })), 0.35);
    var mp = panel('音源定位', { note:'実線は各局の到来方位、破線は方位誤差と到達時刻の等時線。赤丸は推定音源位置。市区町村の境界は国土数値情報 行政区域データ（国土交通省）による' }, []);
    var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);

    var tbl = panel('到達時刻・方位', { note:e.src.name },
      NS.table(['観測局', '距離', '到達', '到来方位', '振幅', '周期', '位相'], e.det.map(function (d) {
        return { attrs:{ class:'clk', onclick:function () { go('station', d.id); } }, cells:[
          NS.ST[d.id].name, { class:'r', html:NS.f(d.dist, 1) + ' km' }, { class:'r mono', html:'＋' + NS.f(d.dt, 1) + ' s' },
          { class:'r', html:NS.f(d.az, 1) + '° ±' + NS.f(d.azErr, 1) + '°' }, { class:'r', html:NS.f(d.amp, 2) + ' Pa' },
          { class:'r', html:NS.f(d.P, 1) + ' s' }, { class:'sm', html:'<span style="white-space:nowrap">' + d.phase + '</span>' }] };
      })));
    NS.add(detail, el('div', { class:'grid g-3-2' }, [mp, tbl]));

    if (e.ashfall) {
      NS.add(detail, panel('降灰の想定と学校対応', { note:'空振から求めた火口位置と噴煙高度を、降灰予測の初期値として使う' },
        [NS.table(['地域（観測局からの目安）', '想定降灰', '学校の対応'], e.ashfall.map(function (a) {
          return [{ class:'sm', html:a[0] }, el('b', { text:a[1] }), { class:'sm', html:a[2] }];
        })),
         el('div', { class:'note', text:'降灰の分布は上空の風に強く依存する。本観測網は気象庁の数値予報 GPV（MSM）の風を使って初期の降灰域を見積もり、気象庁の降灰予報が出るまでの間、各校が自分の位置で判断できる材料を出す。気象庁の噴火警報・降灰予報が優先する。' })]));
    }
    NS.add(detail, panel('解釈と応用', null, [
      el('p', { style:{ margin:0 }, text:e.note }),
      e.strikes ? el('div', { class:'note', text:'落雷回数 ' + e.strikes.toLocaleString() + ' 回（6 時間）。気象センサーの気圧・雨量と同期させることで、降水帯の到達を数分先取りして学校へ伝えられる。' }) : null
    ]));
  }

  function renderSeismic() {
    NS.add(detail, panel(e.name, { note:e.id + ' · ' + NS.fmtJST(e.t) + ' JST · ' + e.cls }, [
      el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' }, text:e.summary }),
      el('div', { class:'grid g3' }, [
        kpi('判定局数', e.det.length, '局', '全 14 局で常時微動を記録'),
        kpi('最大 PGA', NS.f(e.det[0].pga, 1), 'gal', e.det[0].id + ' 局'),
        kpi('判定', '全局 継続使用可', '', '固有振動数の低下 5% 未満')
      ])
    ]));
    var bars = [];
    e.det.forEach(function (d) {
      bars.push({ y:d.f0pre, label:NS.ST[d.id].name + ' 前', color:'var(--muted)', top:NS.f(d.f0pre, 2) });
      bars.push({ y:d.f0, label:'後', color:'var(--accent)', top:NS.f(d.f0, 2) });
    });
    NS.add(detail, el('div', { class:'grid g2' }, [
      panel('校舎 1 次固有振動数の変化', { note:'常時微動計（DT-6）· 地震前後の比較' }, [
        NS.chart.bars({ bars:bars, width:450, height:200, yLabel:'Hz', yMax:5 }),
        el('div', { class:'note', text:'固有振動数は剛性の平方根に比例するため、低下率は構造損傷の指標になる。5 % を超えた場合に「点検要」を自動発報する。' })
      ]),
      panel('局別判定', null, NS.table(['観測局', '震央距離', '地震前 f₀', '地震後 f₀', '変化', 'PGA', '判定'],
        e.det.map(function (d) {
          return [NS.ST[d.id].name, { class:'r', html:NS.f(d.dist, 1) + ' km' }, { class:'r', html:NS.f(d.f0pre, 2) + ' Hz' },
            { class:'r', html:NS.f(d.f0, 2) + ' Hz' }, { class:'r', html:NS.f(d.drift, 1) + ' %' },
            { class:'r', html:NS.f(d.pga, 1) + ' gal' }, badge(d.judge, 'ok')];
        })))
    ]));
    NS.add(detail, panel('意義', null, el('p', { style:{ margin:0 }, text:e.note +
      ' 観測局を載せる校舎そのものを観測対象にすることで、地震直後に「この校舎を避難所として使えるか」を数分で判断できる。工学部（建築）・理工学部（建築・機械）・生産工学部が担当する。' })));
  }
};

})(NS);
