/* NU-SORA デモ / 画面：気象・熱中症、夜空の明るさ、通報、データ公開、デモについて */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, s_ = NS.s, panel = NS.panel, badge = NS.badge, kpi = NS.kpi;

/* =========================================================================
   気象・熱中症（G-6 / DT-3・DT-6）
   ========================================================================= */
NS.V.weather = function (root, go, arg) {
  var t = NS.now();
  var rows = NS.STATIONS.map(function (st) { return { st:st, w:NS.weather(st, t) }; });
  rows.sort(function (a, b) { return b.w.wbgt - a.w.wbgt; });
  var maxW = rows[0], nDanger = rows.filter(function (r) { return r.w.wbgt >= 31; }).length;
  var nStrict = rows.filter(function (r) { return r.w.wbgt >= 28; }).length;
  var rain = rows.filter(function (r) { return r.w.rain > 0.5; });

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'気象・熱中症環境　学校微気候ツイン' }),
    el('p', { text:'各局の複合気象センサーから WBGT（暑さ指数）を算出し、屋上 1 点の観測を校庭・体育館へダウンスケーリングして部活動の判断を支援する。線状降水帯は、雨量計だけでなくインフラサウンドによる雷放電の方位交会と 2 周波 GNSS の可降水量を組み合わせて早期に検知する（サブテーマ G-6 / G-4 / DT-3・DT-4）。' })
  ]));

  NS.add(root, el('div', { class:'grid g4' }, [
    kpi('最高 WBGT', NS.f(maxW.w.wbgt, 1), '℃', maxW.st.name + ' · ' + NS.wbgtLevel(maxW.w.wbgt).label, { acc:true, icon:'🌡' }),
    kpi('厳重警戒以上', nStrict, '/ 14 局', 'うち危険（31℃ 以上）' + nDanger + ' 局'),
    kpi('降水中', rain.length, '/ 14 局', rain.length ? rain.map(function (r) { return r.st.name; }).join('・') : 'なし'),
    kpi('観測項目', 6, '種', '気温・湿度・気圧・風向風速・雨量・日射（Vaisala WXT530 系）')
  ]));

  /* 地図 + ランキング */
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawStations({ state:function (st) { return NS.stationState(st, t); },
    halo:function (st) { return { r:19, color:NS.WBGT_SCALE(NS.weather(st, t).wbgt), opacity:0.9 }; },
    labelText:function (st) { return st.name + ' ' + NS.f(NS.weather(st, t).wbgt, 1) + '℃'; },
    tipExtra:function (st) {
      var w = NS.weather(st, t), l = NS.wbgtLevel(w.wbgt);
      return 'WBGT <b>' + NS.f(w.wbgt, 1) + '℃</b>（' + l.label + '）<br>気温 ' + NS.f(w.temp, 1) + '℃ / 湿度 ' + NS.f(w.rh, 0) +
        '% / 風 ' + NS.f(w.wind, 1) + ' m/s<br>日射 ' + NS.f(w.solar, 3) + ' kW/m² · 雲量 ' + Math.round(w.cloud * 100) + '%<br>' + l.advice;
    } });
  var mp = panel('全国 WBGT 分布', { note:'Ono & Tonouchi (2014) の屋外 WBGT 推定式による算出',
    tools:NS.refreshTool(function () { NS.rerender(); }) }, []);
  var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);
  NS.add(mb, el('div', { class:'maplegend' }, [
    el('span', null, [el('i', { class:'gradbar', style:{ background:'linear-gradient(90deg,#3B7EA1,#4FA07A,#D9B23C,#DE8330,#C43D2E,#8E1B2C)' } }), ' 18 ← WBGT ℃ → 35']),
    el('span', { html:'21 注意 · 25 警戒 · 28 厳重警戒 · <b>31 以上 危険（運動は原則中止）</b>' })
  ]));

  var rank = panel('局別の現況（WBGT 降順）', { note:NS.fmtJST(t) + ' JST' },
    NS.table(['観測局', 'WBGT', '区分', '気温', '湿度', '風', '日射', '雲量'], rows.map(function (r) {
      var l = NS.wbgtLevel(r.w.wbgt);
      return { attrs:{ class:'clk', onclick:function () { go('station', r.st.id); } }, cells:[
        el('b', { text:r.st.name }),
        { class:'r', html:'<b style="color:' + l.color + '">' + NS.f(r.w.wbgt, 1) + '</b>' },
        badge(l.label, l.n >= 4 ? 'crit' : l.n === 3 ? 'warn' : l.n === 2 ? '' : 'ok'),
        { class:'r', html:NS.f(r.w.temp, 1) + '℃' }, { class:'r', html:NS.f(r.w.rh, 0) + '%' },
        { class:'r', html:NS.f(r.w.wind, 1) }, { class:'r', html:NS.f(r.w.solar, 2) },
        { class:'r', html:Math.round(r.w.cloud * 100) + '%' }
      ] };
    })));
  NS.add(root, el('div', { class:'grid g-3-2', style:{ marginTop:'14px' } }, [mp, rank]));

  /* 校庭ダウンスケーリング */
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    panel('校庭内の WBGT 分布（屋上 1 点からのダウンスケーリング）',
      { note:maxW.st.name + ' · 校舎 3D モデルによる日影と地表面被覆を考慮（DT-3）' }, [
      schoolYard(maxW.st, maxW.w),
      el('div', { class:'note', text:'屋上に置いた 1 台の気象センサーの値を、校舎の日影・地表面（土／人工芝／アスファルト）・風の遮蔽から校庭の各地点へ配分する。同一校庭内で WBGT が 3〜4℃ 違うことがあり、屋上値だけでは部活動の可否を判断できない。' })
    ]),
    panel('活動の判断支援', { note:'スポーツ科学部・医学部の指針（G-6）' }, [
      NS.table(['WBGT', '区分', '対応'], [
        ['31 ℃ 以上', badge('危険', 'crit'), '屋外での運動を原則中止。屋内も空調のない場所は中止'],
        ['28 – 31 ℃', badge('厳重警戒', 'warn'), '激しい運動は中止。10–20 分ごとに休憩と給水'],
        ['25 – 28 ℃', badge('警戒', ''), '積極的に休息。運動の合間に必ず給水'],
        ['21 – 25 ℃', badge('注意', 'ok'), '死亡事故の発生あり。水分補給を'],
        ['21 ℃ 未満', badge('ほぼ安全', 'ok'), '通常の水分補給を']
      ]),
      el('div', { class:'note', text:'各付属校の顧問端末へ 10 分ごとに自校の値と校庭内分布を配信し、判断の記録を残す。全国 14 校の同一仕様データにより、地域差・時間帯差の統計解析が可能になる。' })
    ])
  ]));

  /* 24h 推移 */
  var series = NS.STATIONS.map(function (st, i) {
    var pts = [];
    for (var h = -24; h <= 0; h += 0.5) pts.push([h, NS.weather(st, t + h * 3600e3).wbgt]);
    return { name:st.name, color:i < 6 ? ['var(--accent)','var(--c-info)','var(--c-ok)','var(--c-warn)','var(--c-sky)','var(--c-spec)'][i] : 'var(--muted)',
      pts:pts, width:i < 6 ? 1.5 : 0.8, opacity:i < 6 ? 1 : 0.4 };
  });
  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('WBGT の 24 時間推移（全 14 局）', { note:'太線は大学キャンパス拠点 7 局' }, [
      NS.chart.line({ series:series, width:660, height:230, xLabel:'現在からの時間', yLabel:'WBGT ℃',
        xFmt:function (v) { return NS.f(v, 0) + 'h'; }, yFmt:function (v) { return NS.f(v, 0); },
        rules:[{ y:28, color:'var(--c-warn)', label:'28 厳重警戒' }, { y:31, color:'var(--c-crit)', label:'31 危険' }, { y:25, color:'var(--c-cau)', label:'25 警戒' }] }),
      NS.chart.legend(series.slice(0, 6).map(function (x) { return [x.name, x.color, 'line']; }))
    ]),
    panel('降水と雷（線状降水帯の監視）', { note:'気象センサーの雨量とインフラサウンドの雷検知を統合' }, [
      NS.chart.bars({ bars:rows.map(function (r) {
        return { y:r.w.rain, label:r.st.id, color:r.w.rain > 20 ? 'var(--c-crit)' : r.w.rain > 5 ? 'var(--c-warn)' : 'var(--c-info)',
          title:r.st.name + ' ' + NS.f(r.w.rain, 1) + ' mm/h', top:r.w.rain > 0.5 ? NS.f(r.w.rain, 0) : '' };
      }), width:660, height:170, yLabel:'mm/h', yMax:Math.max(12, Math.max.apply(null, rows.map(function (r) { return r.w.rain; })) * 1.15) }),
      NS.kv([
        ['直近 24 時間の落雷検知', '<b>1,842</b> 回（インフラサウンド・関東南部）'],
        ['降水帯の移動', '34 km/h · 方位 072°'],
        ['学校への注意喚起', '検知から 4 分で 5 校へ発報（G-7 の試行）'],
        ['連携', '気象庁レーダーとの突き合わせで検知の妥当性を検証']
      ], 'wide'),
      el('div', { class:'split', style:{ marginTop:'8px' } }, [
        el('button', { class:'iconbtn', text:'↓ 線状降水帯の統合検知事例へ', onclick:function () {
          var t = document.getElementById('rainband'); if (t) t.scrollIntoView({ behavior:'smooth', block:'start' }); } }),
        el('button', { class:'iconbtn', text:'雷の検出事例を見る →', onclick:function () { go('infra', 'NUS-IS-T-0118'); } })
      ])
    ])
  ]));

  NS.add(root, el('div', { id:'rainband' }, NS.rainbandSection(go)));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('防災科研（NIED）の公開データとの突き合わせ',
    { note:'線状降水帯の判定の検証と、通報先を決める際の土砂災害リスクの重ね合わせ' },
    [NS.niedTable('気象'), el('div', { class:'src', text:NS.niedNote })])));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('気象データの他分野への利用', null,
    NS.table(['用途', '使うデータ', '担当学部', '対応テーマ'], [
      ['暗黒飛行（ダークフライト）の風補正（隕石落下域）', '各局の地上風・気温 ＋ 気象庁 数値予報 GPV（MSM）・高層気象観測', '理工学部（航空宇宙）', 'G-1 / DT-1'],
      ['熱中症環境の校内マップ', '気温・湿度・風・日射（WBGT）', 'スポーツ科学部・医学部', 'G-6 / DT-3'],
      ['農業・生態系への影響', '高密度の気温・降水・日射', '生物資源科学部', 'DT-3'],
      ['太陽光発電量と星空予報', '日射・雲量・全天画像', '理工学部・文理学部', 'DT-2'],
      ['線状降水帯の早期検知', 'インフラサウンド（雷放電の方位交会）＋ GNSS 可降水量 ＋ 雨量・気圧', '理工学部（精密機械・航空宇宙）・文理学部（地球科学）・危機管理学部', 'G-4・G-6 / DT-4'],
      ['成層圏風の逆推定', 'インフラサウンド到達時刻 ＋ 地上気象', '理工学部・文理学部（地球科学）', 'G-4 / DT-4'],
      ['校舎の使用可否判定', '微動計 ＋ 気温（剛性の温度依存の補正）', '工学部・理工学部（建築）', 'G-6 / DT-6']
    ]))));
};

/* 校庭 WBGT 分布の簡易可視化 */
function schoolYard(st, w) {
  var NX = 26, NY = 15, CW = 24, CH = 22, PAD = 30;
  var g = s('svg', { viewBox:'0 0 ' + (NX * CW + PAD * 2) + ' ' + (NY * CH + PAD * 2 + 18), class:'chart' });
  var sunAz = 180 + (w.sunAlt > 0 ? ((NS.jstParts(NS.now()).h - 12) * 15) : 40);
  var shadeLen = w.sunAlt > 3 ? Math.min(11, 5 / Math.tan(Math.max(6, w.sunAlt) * NS.d2r)) : 11;
  var r = NS.rng(st.id + '|yard');
  var vals = [];
  for (var y = 0; y < NY; y++) {
    for (var x = 0; x < NX; x++) {
      /* 校舎（左上のブロック）と体育館（右下） */
      var inBld = (x < 7 && y < 4) || (x > 20 && y > 11);
      var shaded = (x < 7 + shadeLen && x >= 7 && y < 4 + shadeLen * 0.35) || inBld;
      /* 地表面：中央は土のグラウンド、周囲はアスファルト、左下は樹木 */
      var tree = (x < 5 && y > 11);
      var surf = tree ? -2.4 : (x > 3 && x < 23 && y > 3 && y < 12) ? 0.4 : 1.1;
      var v = w.wbgt + surf + (shaded ? -2.2 : 0.9) - (tree ? 0.6 : 0) + r.norm(0, 0.22)
        - (x === 0 || y === 0 || x === NX - 1 || y === NY - 1 ? 0.3 : 0);
      vals.push({ x:x, y:y, v:v, bld:inBld, tree:tree, shaded:shaded && !inBld });
    }
  }
  vals.forEach(function (c) {
    var X = PAD + c.x * CW, Y = PAD + c.y * CH;
    NS.add(g, s('rect', { x:X, y:Y, width:CW, height:CH, fill:c.bld ? 'var(--rule2)' : NS.WBGT_SCALE(c.v),
      opacity:c.bld ? 1 : 0.92, stroke:'none' }, s('title', { text:c.bld ? '建物' : 'WBGT ' + NS.f(c.v, 1) + '℃' + (c.shaded ? '（日影）' : '') + (c.tree ? '（樹木）' : '') })));
  });
  /* 注記 */
  var lab = function (x, y, tx, anchor) {
    NS.add(g, s('text', { x:PAD + x * CW, y:PAD + y * CH, class:'axl', fill:'var(--ink)', 'text-anchor':anchor || 'start',
      'paint-order':'stroke', stroke:'var(--panel)', 'stroke-width':2.6, text:tx }));
  };
  lab(0.3, 2.4, '校舎');
  lab(21.3, 13.4, '体育館');
  lab(11, 8.2, 'グラウンド（土）', 'middle');
  lab(0.3, 13.6, '樹木');
  NS.add(g, s('text', { x:PAD, y:NY * CH + PAD + 14, class:'axl', text:'← 約 130 m →' }));
  NS.add(g, s('text', { x:NX * CW + PAD, y:NY * CH + PAD + 14, class:'axl', 'text-anchor':'end',
    text:'屋上センサー値 ' + NS.f(w.wbgt, 1) + '℃ / 校庭内 ' +
      NS.f(Math.min.apply(null, vals.filter(function (c) { return !c.bld; }).map(function (c) { return c.v; })), 1) + '–' +
      NS.f(Math.max.apply(null, vals.map(function (c) { return c.v; })), 1) + '℃' }));
  return g;
}

/* =========================================================================
   夜空の明るさ（G-3 / DT-2）
   ========================================================================= */
NS.V.skyglow = function (root, go, arg) {
  var t = NS.now();
  var rows = NS.STATIONS.map(function (st) { return { st:st, sb:NS.skyBrightness(st, t) }; });
  var meas = rows.filter(function (r) { return r.sb.mag != null; });
  var sorted = NS.STATIONS.slice().sort(function (a, b) { return b.sqm - a.sqm; });

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'夜空の明るさ　全国輝度マップと寄与分離' }),
    el('p', { text:'全 14 局に夜空輝度計（Unihedron SQM-LU-DL、視野 FWHM 約 20°）を天頂向きに設置し、全天カメラの恒星測光と相互較正する。人工光（光害）・月・雲・衛星コンステレーションの寄与を分離し、経年変化を測る（サブテーマ G-3 / DT-2）。' })
  ]));

  NS.add(root, el('div', { class:'grid g4' }, [
    kpi('最も暗い局', NS.f(sorted[0].sqm, 2), 'mag/arcsec²', sorted[0].name + ' · Bortle ' + NS.bortle(sorted[0].sqm).n, { acc:true, icon:'✦' }),
    kpi('最も明るい局', NS.f(sorted[sorted.length - 1].sqm, 2), 'mag/arcsec²', sorted[sorted.length - 1].name + ' · Bortle ' + NS.bortle(sorted[sorted.length - 1].sqm).n),
    kpi('局間の差', NS.f(sorted[0].sqm - sorted[sorted.length - 1].sqm, 2), '等', '明るさで約 ' + NS.f(Math.pow(10, 0.4 * (sorted[0].sqm - sorted[sorted.length - 1].sqm)), 0) + ' 倍'),
    kpi('夜間測定中', meas.length, '/ 14 局', meas.length ? '平均 ' + NS.f(meas.reduce(function (a, b) { return a + b.sb.mag; }, 0) / meas.length, 2) + ' mag/arcsec²' : '全局が薄明・昼間')
  ]));

  /* 地図 */
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawStations({ state:function (st) { return NS.stationState(st, t); },
    halo:function (st) { var sb = NS.skyBrightness(st, t);
      return { r:19, color:NS.SQM_SCALE(sb.mag == null ? st.sqm : sb.mag), opacity:sb.mag == null ? 0.42 : 0.92 }; },
    labelText:function (st) { var sb = NS.skyBrightness(st, t); return st.name + ' ' + NS.f(sb.mag == null ? st.sqm : sb.mag, 2) + (sb.mag == null ? '*' : ''); },
    tipExtra:function (st) {
      var sb = NS.skyBrightness(st, t);
      if (sb.mag == null) return '薄明・昼間のため測定なし<br>平常値 ' + NS.f(st.sqm, 2) + ' mag/arcsec²';
      var b = NS.bortle(sb.mag);
      return '<b>' + NS.f(sb.mag, 2) + ' mag/arcsec²</b>（Bortle ' + b.n + '：' + b.label + '）<br>' +
        '平常値 ' + NS.f(st.sqm, 2) + ' / 光害量 ' + NS.f(sb.lp, 2) + ' 等<br>' +
        '雲の寄与 ' + NS.f(sb.cloudEffect, 2) + ' 等 · 月の寄与 ' + NS.f(sb.moonEffect, 2) + ' 等';
    } });
  var mp = panel('全国 夜空輝度マップ', { note:'夜間の局は現在値、昼間・薄明の局は平常値（* 印・淡く表示）',
    tools:NS.refreshTool(function () { NS.rerender(); }) }, []);
  var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);
  NS.add(mb, el('div', { class:'maplegend' }, [
    el('span', null, [el('i', { class:'gradbar', style:{ background:'linear-gradient(90deg,#FFF1C9,#F08A3C,#B4562F,#5C4A8C,#2C3A82,#101A44)' } }),
      ' 明 17.5 ← mag/arcsec² → 22.0 暗']),
    el('span', { html:'自然な暗夜は 21.9 mag/arcsec²。数値が小さいほど空が明るい' })
  ]));

  var rank = panel('局別の平常値（暗い順）', { note:'Bortle スケールは Bortle (2001) による区分' },
    NS.table(['観測局', '平常値', 'Bortle', '空の状態', '現在値', '光害量'], sorted.map(function (st) {
      var b = NS.bortle(st.sqm), sb = NS.skyBrightness(st, t);
      return { attrs:{ class:'clk', onclick:function () { go('station', st.id); } }, cells:[
        el('b', { text:st.name }),
        { class:'r', html:'<b>' + NS.f(st.sqm, 2) + '</b>' },
        { class:'c', html:String(b.n) }, { class:'sm', html:b.label },
        { class:'r', html:sb.mag == null ? '<span class="hint">薄明</span>' : NS.f(sb.mag, 2) },
        { class:'r', html:NS.f(21.9 - st.sqm, 2) + ' 等' }
      ] };
    })));
  NS.add(root, el('div', { class:'grid g-3-2', style:{ marginTop:'14px' } }, [mp, rank]));

  /* 一晩の推移 + 寄与分離 */
  var night = [];
  for (var h = -14; h <= 0; h += 0.25) night.push(h);
  var nSeries = [NS.ST.NGN, NS.ST.YMG, NS.ST.FNB, NS.ST.SRG].map(function (st, i) {
    var pts = [];
    night.forEach(function (h) { var b = NS.skyBrightness(st, t + h * 3600e3); if (b.mag != null) pts.push([h, b.mag]); });
    return { name:st.name, color:['var(--c-sky)','var(--c-info)','var(--c-ok)','var(--accent)'][i], pts:pts, width:1.6 };
  }).filter(function (x) { return x.pts.length > 3; });

  /* 寄与分離（明るさの加算量を等級差から算出） */
  var stFocus = NS.ST.FNB;
  var xs = [], comp = { lp:[], moon:[], cloud:[], sat:[] };
  night.forEach(function (h) {
    var b = NS.skyBrightness(stFocus, t + h * 3600e3);
    if (b.mag == null) return;
    xs.push(h);
    comp.lp.push(Math.max(0, b.lp));
    comp.moon.push(Math.max(0, -b.moonEffect));
    comp.cloud.push(Math.max(0, -b.cloudEffect));
    comp.sat.push(Math.max(0, -b.satEffect) * 40);   /* 見やすさのため 40 倍に拡大 */
  });

  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('一晩の夜空輝度の推移', { note:'暗い局（長野・山形）と明るい局（船橋・駿河台）の比較' },
      nSeries.length ? [
        NS.chart.line({ series:nSeries, width:660, height:230, xLabel:'現在からの時間', yLabel:'mag/arcsec²（上ほど暗い）',
          xFmt:function (v) { return NS.f(v, 0) + 'h'; }, yFmt:function (v) { return NS.f(v, 1); },
          rules:[{ y:21.9, color:'var(--muted)', label:'自然夜空 21.9' }] }),
        NS.chart.legend(nSeries.map(function (x) { return [x.name, x.color, 'line']; })),
        el('div', { class:'note', text:'暗い局では雲が空を暗くし、明るい局では都市光を反射して空を明るくする（符号が逆転する）。この差を使えば、雲量の独立推定にも使える。' })
      ] : el('div', { class:'hint', text:'現在は昼間・薄明のため夜間データがない。日没後に再表示される。' })),
    panel('明るさの寄与分離（' + stFocus.name + '）', { note:'自然夜空を基準とした超過分（等級）。衛星の寄与は 40 倍に拡大して表示' },
      xs.length > 3 ? [
        NS.chart.stack({ x:xs, series:[
          { name:'人工光（光害）', color:'#E08A3C', v:comp.lp },
          { name:'月', color:'#C8CBD2', v:comp.moon },
          { name:'雲による都市光の反射', color:'#8C97A3', v:comp.cloud },
          { name:'衛星コンステレーション（×40）', color:'#7C6FD0', v:comp.sat }
        ], width:660, height:230, yLabel:'超過等級', xFmt:function (v) { return NS.f(v, 0) + 'h'; }, yFmt:function (v) { return NS.f(v, 1); } }),
        NS.chart.legend([['人工光（光害）', '#E08A3C'], ['月', '#C8CBD2'], ['雲の反射', '#8C97A3'], ['衛星（×40）', '#7C6FD0']]),
        el('div', { class:'note', text:'軌道上の衛星・デブリによる散乱光は天頂の夜空輝度を自然値より約 1 % 高めうると推定されている（Kocifaj et al. 2021, MNRAS Letters）。1 % は 0.011 等に相当し、光害の数等という寄与に比べて小さいため、全国 14 点・長期の均質観測で月・雲・人工光を差し引いて初めて分離できる。' })
      ] : el('div', { class:'hint', text:'夜間データの蓄積待ち。' }))
  ]));

  /* 経年トレンド */
  var years = [], tr = { NGN:[], FNB:[], SRG:[], MYZ:[] };
  for (var y = 0; y <= 60; y++) {
    var yr = 2028 + y / 12;
    years.push(yr);
    Object.keys(tr).forEach(function (k) {
      var st = NS.ST[k], r = NS.rng(k + 'trend' + y);
      var slope = k === 'SRG' ? -0.021 : k === 'FNB' ? -0.016 : k === 'MYZ' ? -0.009 : -0.004;  /* 等/年の明化 */
      tr[k].push([yr, st.sqm + slope * (y / 12) + 0.09 * Math.sin(2 * Math.PI * y / 12) + r.norm(0, 0.035)]);
    });
  }
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    panel('夜空輝度の経年トレンド（5 年分・デモ）', { note:'月・雲の寄与を除いた月平均値。負の傾きは空が明るくなっていることを示す' }, [
      NS.chart.line({ series:Object.keys(tr).map(function (k, i) {
        return { name:NS.ST[k].name, color:['var(--c-sky)','var(--c-ok)','var(--accent)','var(--c-warn)'][i], pts:tr[k], width:1.4 };
      }), width:900, height:230, xLabel:'年', yLabel:'mag/arcsec²', xFmt:function (v) { return NS.f(v, 0); }, yFmt:function (v) { return NS.f(v, 1); } }),
      NS.chart.legend(Object.keys(tr).map(function (k, i) { return [NS.ST[k].name, ['var(--c-sky)','var(--c-ok)','var(--accent)','var(--c-warn)'][i], 'line']; })),
      el('div', { class:'note', text:'都心局（駿河台）で −0.021 等/年、内陸暗夜（長野）で −0.004 等/年。都市部の LED 化・再開発と、衛星コンステレーションの増加という二つの要因を、地域差から分離することを目指す。' })
    ]),
    panel('Bortle スケール', { note:'夜空の暗さの標準的な区分' },
      NS.table(['等級', 'mag/arcsec²', '空の状態', '該当局'], [
        ['1', '≥ 21.99', '極めて暗い空', '—'],
        ['2', '21.89 – 21.99', '典型的な暗い空', '—'],
        ['3', '21.69 – 21.89', '田舎の空', '—'],
        ['4', '21.25 – 21.69', '田舎と郊外の遷移', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 4; }).map(function (x) { return x.name; }).join('・') || '—'],
        ['5', '20.49 – 21.25', '郊外の空', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 5; }).map(function (x) { return x.name; }).join('・') || '—'],
        ['6', '19.50 – 20.49', '明るい郊外', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 6; }).map(function (x) { return x.name; }).join('・') || '—'],
        ['7', '18.94 – 19.50', '郊外と都市の遷移', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 7; }).map(function (x) { return x.name; }).join('・') || '—'],
        ['8', '18.38 – 18.94', '都市の空', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 8; }).map(function (x) { return x.name; }).join('・') || '—'],
        ['9', '< 18.38', '市街中心部', NS.STATIONS.filter(function (x) { return NS.bortle(x.sqm).n === 9; }).map(function (x) { return x.name; }).join('・') || '—']
      ]))
  ]));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('夜空輝度データの用途', null,
    NS.table(['用途', '内容', '担当'], [
      ['光害の全国マップ', '14 点の均質・連続測定による経年変化。自治体の照明政策への基礎資料', '理工学部・文理学部（地理）'],
      ['衛星コンステレーションの影響', '月・雲・人工光を差し引いた残差から軌道上散乱光の寄与を抽出', '理工学部（航空宇宙）'],
      ['流星検出効率の品質管理', '夜空輝度と限界等級から各局の検出効率を較正し、発生頻度の推定に反映', '理工学部（G-1 と共用）'],
      ['星空観光・星空予報', '雲量・輝度・月齢から「星が見える度」を予報し、地域へ発信', '国際関係学部・芸術学部'],
      ['生態系への影響', '夜間光と昆虫・鳥類・農作物への影響評価', '生物資源科学部'],
      ['教育・探究学習', '生徒が自校の空の明るさを測り、全国と比べる', '付属校・文理学部（教育）']
    ]))));

  /* ---- 環境省への報告（G-3 社会実装） ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('環境省への報告（星空観察・光害対策）', {
    note:'経年データを国の施策に載せる。既存事業に合わせた形で出し、足りない部分を補う',
    tools:badge('提案', 'info') }, [
    el('div', { class:'note', html:'環境省は星空公団と共同で、<b>平成 30 年度から夏（8 月）と冬（1 月）の新月前後 2 週間</b>に'
      + '「星空観察」を実施している。デジタル一眼で天頂を撮った RAW 画像から夜空の明るさ（mag/arcsec²）を求めるもので、'
      + '結果は国立環境研究所「環境展望台」の環境 GIS に<b>「星空観察結果」</b>として地図公開されている。'
      + '本観測網は<b>同じ量（天頂の mag/arcsec²）を 14 局で通年・連続に測る</b>ので、'
      + '年 2 回・1 晩の点観測を時間方向に埋め、経年変化の検出力を上げられる。' }),
    NS.table(['提案するデータセット', '中身', '粒度・頻度', '既存事業との関係'], [
      ['① 天頂夜空輝度の連続値', 'SQM-LU-DL（視野 FWHM 約 20°）の実測値。機器温度・較正日つき',
       '1 分値／全 14 局／通年', '年 2 回の調査の「間」を埋める'],
      ['② 条件をそろえた夜間代表値', '天文薄明後・月没・雲量 10 % 未満に限った夜ごとの中央値',
       '1 夜 1 値・月別統計', '環境省の調査値とそのまま比較できる形'],
      ['③ 経年トレンド', '局別の回帰係数（等/年）と ±1σ、変化点（LED 化・再開発との対応）',
       '年 1 回更新', '「明るくなっているか」を数字で示す'],
      ['④ 実施要領に沿った天頂画像', 'RAW・SS 15–60 s・F2.8–8・35 mm 換算 40–85 mm・ISO 400–1600、長辺を東西に向けて自動撮影',
       '夏・冬の調査期間に自動投稿', '既存事業への参加データそのもの'],
      ['⑤ 全天の輝度分布', '全天カメラの測光から方位・高度別の輝度図（どの方角の光が効いているか）',
       '10 分ごと／全 14 局', '天頂 1 点では分からない光源の向きを補う'],
      ['⑥ 人工光成分（光害量）', '月・雲・大気光・衛星の寄与を差し引いた残差。衛星データ（VIIRS DNB）との突合つき',
       '1 夜 1 値', '上向き光束と地上の skyglow を結ぶ'],
      ['⑦ 肉眼観察とのペア', '付属校の生徒による肉眼観察（見えた星の数）と同時刻の実測値',
       '調査期間・全 7 付属校', '肉眼観察の較正と教育（G-8）'],
      ['⑧ メタデータ', '機器個体番号・較正履歴・設置高さ・周囲の遮蔽（魚眼写真）・GNSS 時刻同期',
       '変更時', '第三者が再解析できる条件を残す']
    ]),
    el('div', { class:'note', html:'提供形式は、地図に重ねられる <b>CSV / GeoJSON</b>（緯度経度・時刻・値・条件フラグ）と '
      + '<b>読み取り専用 API</b>（このデモの「データ公開と API」と同じ設計）を想定し、ライセンスは CC BY 4.0 とする。'
      + '自治体の照明改修（防犯灯の LED 化・色温度の変更）の前後で ② と ⑤ を比べれば、施策の効果がその場で測れる。' }),
    el('div', { class:'src', html:'参考：環境省「星空を見よう」観察の手引き（https://www.env.go.jp/air/life/hoshizorakansatsu/）、'
      + '国立環境研究所 環境展望台 環境 GIS「星空観察結果」（https://tenbou.nies.go.jp/gis/）、'
      + '環境省「光害対策ガイドライン」（平成 10 年策定・令和 3 年改訂）。'
      + '本デモの数値は模擬データであり、実測値ではない。' })
  ])));
};

/* =========================================================================
   通報・アラート（G-7）
   ========================================================================= */
NS.V.alerts = function (root, go, arg) {
  var log = NS.alertLog();
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'通報と社会実装' }),
    el('p', { text:'観測を「情報」で終わらせず「行動」に変える。落下域確率地図と警報を自治体・教育委員会・学校へ届け、対応訓練と法的・保険上の論点整理まで一体で進める（サブテーマ G-7 / PF-3）。' })
  ]));

  var wfState = { key:'fireball' };
  var wfBox = el('div');
  var wfSel = el('div', { class:'chips' }, NS.WORKFLOWS.map(function (w) {
    return el('button', { class:'chip wfchip', 'aria-pressed':w.key === wfState.key ? 'true' : 'false',
      onclick:function (ev) {
        wfState.key = w.key;
        Array.prototype.forEach.call(ev.target.closest('.chips').children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        ev.target.closest('button').setAttribute('aria-pressed', 'true');
        buildWf();
      } }, [el('span', { class:'wfic', text:w.icon }), w.name, el('span', { class:'wftag', text:w.tag })]);
  }));
  function buildWf() {
    var wf = NS.WF[wfState.key];
    NS.clear(wfBox);
    var stageBox = el('div', { class:'stagebox' });
    var d = workflow(wf, function (i) {
      d.select(i);
      NS.clear(stageBox);
      NS.add(stageBox, NS.stageDetail(wf, i, go));
    });
    NS.add(wfBox, [
      el('div', { class:'wflead' }, [el('b', { text:wf.name }), '　', wf.lead,
        el('span', { class:'hint', text:'　所要：' + wf.total })]),
      d.node, stageBox]);
    d.select(0);
    NS.add(stageBox, NS.stageDetail(wf, 0, go));
  }
  NS.add(root, panel('通報ワークフロー',
    { note:'災害の種類ごとに手順が違う。系統を選び、各段階をクリックすると解析経過が開く', tools:null },
    [wfSel, wfBox]));
  buildWf();

  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    panel('通報・対応ログ（全件）', { note:log.length + ' 件' },
      el('ul', { class:'tl' }, log.map(function (a) {
        var cls = a.lvl === '通報' || a.lvl === '注意喚起' ? '' : a.lvl === '検出' ? 'i-warn' : (a.lvl === '対応' || a.lvl === '判定') ? 'i-ok' : 'i-info';
        var ev = NS.EVMAP[a.ev];
        return el('li', { class:cls }, [
          el('div', { class:'tt', text:NS.fmtJST(a.t) + ' JST' }),
          el('div', { class:'tx' }, [el('span', { class:'tg', text:a.lvl }), a.text]),
          (ev || a.ev === 'NUS-LR-2028-0908-01') ? el('button', { class:'iconbtn', style:{ marginTop:'3px', padding:'2px 8px', fontSize:'10.5px' },
            text:(ev ? ev.name : NS.rainband().name) + ' →', onclick:function () {
              if (!ev) { go('weather'); setTimeout(function () {
                var t2 = document.getElementById('rainband'); if (t2) t2.scrollIntoView({ block:'start' }); }, 60); return; }
              go(ev.kind === 'reentry' ? 'reentry' : (ev.kind === 'infrasound' || ev.kind === 'seismic') ? 'infra' : 'fireball', ev.id);
            } }) : null
        ]);
      }))),
    el('div', { class:'grid', style:{ gap:'14px' } }, [
      panel('警戒レベルの定義', { note:'危機管理学部と共同で設計' },
        NS.table(['レベル', '発報の条件', '受け手と行動'], [
          [el('span', { class:'lvl 平常', text:'平常' }), '通常の観測（流星・気象・輝度）', '公開ポータルでの表示のみ'],
          [el('span', { class:'lvl 注意', text:'注意' }), '−8 等より明るい火球、または残存質量 0.1 kg 以上の推定', '該当自治体・教育委員会へ落下域確率地図を配信'],
          [el('span', { class:'lvl 警戒', text:'警戒' }), '残存質量 10 kg 以上、または人口密集域に落下域が重なる', '自治体防災担当へ電話連絡、学校へ屋内退避の連絡'],
          [el('span', { class:'lvl 重大', text:'重大' }), '被害の可能性がある落下、制御外再突入の破片落下', '自治体・消防・警察・JAXA へ同時通報、記者発表']
        ])),
      panel('連携先（想定）', { note:'申請前に内諾を得る' }, [
        el('div', { class:'chips' }, ['千葉県山武市 防災課', '千葉県東金市 防災課', '千葉県教育委員会', '福島県郡山市', '静岡県三島市',
          '長野県長野市', '鹿児島県（火山連携）', 'JAXA 宇宙状況把握（SSA）', 'NICT（宇宙天気）', '国立天文台', '高知工科大学（インフラサウンド）',
          '気象庁（火山・雷の突き合わせ）', '損害保険会社（落下物責任）'].map(function (x) { return badge(x, 'info'); })),
        el('div', { class:'note', text:'法学部が機器貸与契約・設置協定・観測データの証拠性・宇宙活動法上の論点を整備し、危機管理学部が通報訓練とリスクコミュニケーションを担当する。' })
      ])
    ])
  ]));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('防災科研（NIED）の公開データとの連携',
    { note:'自治体が既に見ている画面に載せることが社会実装の近道になる' },
    [NS.niedTable('災害'), el('div', { class:'src', text:NS.niedNote })])));

  NS.add(root, el('div', { class:'grid g3', style:{ marginTop:'14px' } }, [
    panel('通報の実績（デモ）', null, [
      NS.kv([['自治体への配信', '4 件'], ['学校への注意喚起', '11 件'], ['JAXA への情報共有', '2 件'],
             ['通報訓練の実施', '2 市 · 3 校'], ['平均 配信所要時間', '3 分 51 秒'], ['誤報', '0 件（うち保留判断 1 件）']], 'wide')
    ]),
    panel('法的・保険上の論点（法学部）', null, el('ul', { style:{ margin:0, paddingLeft:'1.2em', fontSize:'12.5px', color:'var(--ink2)' } }, [
      el('li', { text:'隕石・再突入破片による損害の責任主体（宇宙損害責任条約・宇宙活動法）' }),
      el('li', { text:'観測データの証拠性（時刻同期・改変防止・保存期間）' }),
      el('li', { text:'別法人の付属校への機器設置に関する貸与契約と設置協定' }),
      el('li', { text:'落下物の所有権（土地所有者・発見者・国）' }),
      el('li', { text:'空のみを撮像する画角設定と映像の公開範囲（個人情報）' })
    ].map(function (x) { return x; }))),
    panel('教育への統合（G-8 / PF-4）', null, el('ul', { style:{ margin:0, paddingLeft:'1.2em', fontSize:'12.5px', color:'var(--ink2)' } }, [
      el('li', { text:'生徒による自動検出の誤検出検証（雲・虫・飛行機・人工衛星の判別）を探究学習として制度化' }),
      el('li', { text:'各校が「自校のツイン」（DT-7）を持ち、自校の空を再現して探究する' }),
      el('li', { text:'全国生徒研究発表会の開催と、学校防災計画への観測局の組み込み' }),
      el('li', { text:'落下域通報を用いた避難訓練（危機管理学部と共同）' })
    ]))
  ]));
};

/* =========================================================================
   通報ワークフロー（複数系統）
   ========================================================================= */
NS.WORKFLOWS = [
  { key:'fireball', name:'火球・隕石落下', tag:'G-1 / DT-1', icon:'☄',
    lead:'房総沖 大火球（−11.8 等・7 局同時検出）。検出から自治体配信まで 3 分 42 秒',
    total:'3 分 42 秒', link:function (go) { go('fireball', NS.FLAGSHIP.fireball.id); },
    linkText:'この事象の全解析を見る →',
    steps:[
      { key:'fb-detect',  name:'検出',     at:'0 秒',    dt:0 },
      { key:'fb-match',   name:'多点対応', at:'+18 秒',  dt:18 },
      { key:'fb-traj',    name:'軌跡決定', at:'+41 秒',  dt:41 },
      { key:'fb-strewn',  name:'落下域',   at:'+128 秒', dt:128 },
      { key:'fb-notify',  name:'通報',     at:'+222 秒', dt:222 },
      { key:'fb-verify',  name:'確認',     at:'+244 秒', dt:244 },
      { key:'fb-respond', name:'対応',     at:'+30 分',  dt:1800 }
    ] },
  { key:'rainband', name:'線状降水帯', tag:'G-4・G-6 / DT-4', icon:'🌧',
    lead:'千葉県東部 線状降水帯。帯の西 26–69 km の局が、雨量計より前に音で捉える',
    total:'形成から 58 分', link:function (go) { go('weather'); setTimeout(function () {
      var t = document.getElementById('rainband'); if (t) t.scrollIntoView({ block:'start' }); }, 60); },
    linkText:'統合検知の全体を見る →',
    steps:[
      { key:'rb-form',   name:'形成',   at:'0 分',   dt:0 },
      { key:'rb-detect', name:'検知',   at:'+12 分', dt:12 },
      { key:'rb-locate', name:'定位',   at:'+28 分', dt:28 },
      { key:'rb-pwv',    name:'前兆',   at:'+46 分', dt:46 },
      { key:'rb-judge',  name:'判定',   at:'+54 分', dt:54 },
      { key:'rb-notify', name:'通報',   at:'+58 分', dt:58 },
      { key:'rb-verify', name:'実測',   at:'+180 分',dt:180 },
      { key:'rb-clear',  name:'解除',   at:'+380 分',dt:380 }
    ] },
  { key:'tsunami', name:'津波', tag:'G-4・G-5 / DT-4・DT-5', icon:'〰',
    lead:'三陸沖 M7.8 の地震と津波。電離圏 TEC とインフラサウンドから津波の規模を独立に見積もる',
    total:'地震発生から 28 分', link:null, linkText:null,
    steps:[
      { key:'ts-quake',  name:'地震検知', at:'0 分',   dt:0 },
      { key:'ts-tec',    name:'電離圏',   at:'+8 分',  dt:8 },
      { key:'ts-acou',   name:'音響',     at:'+13 分', dt:13 },
      { key:'ts-hole',   name:'電離圏ホール', at:'+19 分', dt:19 },
      { key:'ts-est',    name:'規模推定', at:'+26 分', dt:26 },
      { key:'ts-notify', name:'通報',     at:'+28 分', dt:28 },
      { key:'ts-verify', name:'検証',     at:'+95 分', dt:95 }
    ] },
  { key:'volcano', name:'火山噴火', tag:'G-4 / DT-4', icon:'⛰',
    lead:'桜島 昭和火口の噴火。3 局のインフラサウンドで定位し、成層圏風まで逆推定する',
    total:'噴火から 12 分', link:function (go) { go('infra', 'NUS-IS-A-0412'); },
    linkText:'インフラサウンドの解析を見る →',
    steps:[
      { key:'vo-erupt',  name:'噴火',     at:'0 秒',    dt:0 },
      { key:'vo-detect', name:'直達波',   at:'+273 秒', dt:273 },
      { key:'vo-locate', name:'定位',     at:'+520 秒', dt:520 },
      { key:'vo-notify', name:'通報',     at:'+12 分',  dt:720 },
      { key:'vo-strat',  name:'成層圏風', at:'+44 分',  dt:2641 }
    ] }
];
NS.WF = {}; NS.WORKFLOWS.forEach(function (w) { NS.WF[w.key] = w; });

function workflow(wf, onSelect) {
  var steps = wf.steps, W = 1000, H = 138, bw = W / steps.length;
  var g = s_('svg', { viewBox:'0 0 ' + W + ' ' + H, class:'chart wf', role:'group', 'aria-label':wf.name + ' の通報ワークフロー' });
  var boxes = [];
  steps.forEach(function (st, i) {
    var x = i * bw + 6, iw = bw - (steps.length > 7 ? 18 : 22);
    var grp = s_('g', { class:'wfstep', role:'button', tabindex:'0',
      'aria-label':st.name + ' ' + st.at + ' の解析経過を開く' });
    var rect = s_('rect', { x:x, y:30, width:iw, height:82, rx:5 });
    boxes.push(rect);
    NS.add(grp, rect);
    NS.add(grp, s_('text', { x:x + 10, y:18, class:'axl wfat', text:st.at }));
    NS.add(grp, s_('text', { x:x + 10, y:50, class:'wfname', text:st.name }));
    (NS.WF_TEXT[st.key] || []).forEach(function (line, k) {
      NS.add(grp, s_('text', { x:x + 10, y:69 + k * 14, class:'axl wfdesc', text:line }));
    });
    NS.add(grp, s_('text', { x:x + iw - 8, y:105, class:'wfmore', 'text-anchor':'end', text:'詳細 →' }));
    grp.addEventListener('click', function () { onSelect(i); });
    grp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } });
    NS.add(g, grp);
    if (i < steps.length - 1) {
      var ax = x + iw + 2;
      NS.add(g, s_('path', { d:'M' + ax + ' 71 l7 0 m-3 -3 l3 3 l-3 3', stroke:'var(--muted)', 'stroke-width':1.3, fill:'none' }));
    }
  });
  return { node:g, select:function (i) {
    boxes.forEach(function (r, k) { r.setAttribute('class', k === i ? 'on' : ''); });
  } };
}

/* 各段階の図中の短い説明（2 行） */
NS.WF_TEXT = {
  'fb-detect':['エッジ AI が', '火球候補を判定'], 'fb-match':['全局データを', '時刻で突き合わせ'],
  'fb-traj':['三角測量', '残差 41 m'], 'fb-strewn':['暗黒飛行の', '風補正'],
  'fb-notify':['自治体・教育委', 'へ自動配信'], 'fb-verify':['インフラサウンド', 'でエネルギー検証'],
  'fb-respond':['被害確認', '回収捜索の判断'],
  'rb-form':['房総半島東部で', '対流セルが並ぶ'], 'rb-detect':['雷放電音を', '3 局で連続検知'],
  'rb-locate':['方位交会で', '帯状配列を確認'], 'rb-pwv':['GNSS 可降水量', 'が 43→58 mm'],
  'rb-judge':['6 条件成立で', '自動判定'], 'rb-notify':['3 市・3 校へ', '発報'],
  'rb-verify':['雨量計で', '48 mm/h を実測'], 'rb-clear':['雷放電が減り', '解除連絡'],
  'ts-quake':['微動計で P 波', '気象庁震源速報'], 'ts-tec':['TEC に音波共振', '4.4 / 3.6 mHz'],
  'ts-acou':['大気重力波が', '到達'], 'ts-hole':['TEC 減少開始', '電離圏ホール'],
  'ts-est':['減少率から', '波高を推定'], 'ts-notify':['沿岸の学校へ', '判断材料を配信'],
  'ts-verify':['検潮所の実測と', '突き合わせ'],
  'vo-erupt':['噴煙高度', '2,300 m'], 'vo-detect':['宮崎局に', '直達波が到達'],
  'vo-locate':['3 局の方位交会', '誤差 ±6.8 km'], 'vo-notify':['降灰予測と', '学校連絡'],
  'vo-strat':['成層圏反射波から', '高層風を逆推定']
};

/* ---- 各段階の解析経過 ---- */
NS.stageDetail = function (wf, i, go) {
  var st = wf.steps[i], k = st.key;
  var e = NS.FLAGSHIP.fireball, rb = NS.rainband(), ts = NS.tsunami(), vo = NS.INFRA[0];
  var base = k.indexOf('fb-') === 0 ? e.t : k.indexOf('rb-') === 0 ? rb.t : k.indexOf('ts-') === 0 ? ts.t : vo.t;
  var unit = k.indexOf('rb-') === 0 || k.indexOf('ts-') === 0 ? 60000 : 1000;
  var when = NS.fmtJST(base + st.dt * unit, { ms:unit === 1000 && st.dt < 300 }) + ' JST';
  var head = el('div', { class:'stagehead' }, [
    el('span', { class:'stageno', text:(i + 1) + ' / ' + wf.steps.length }),
    el('b', { text:st.name }),
    el('span', { class:'hint', text:'発生 ' + st.at + '　' + when }),
    el('div', { class:'spacer' }),
    wf.link ? el('button', { class:'iconbtn', text:wf.linkText, onclick:function () { wf.link(go); } }) : null
  ]);
  var body = el('div', { class:'grid', style:{ gap:'12px', marginTop:'10px' } });
  var B = NS.STAGE[k];
  if (B) B(body, { e:e, rb:rb, ts:ts, vo:vo, go:go, at:function (dt) { return NS.fmtJST(base + dt * unit) + ' JST'; } });
  else NS.add(body, el('div', { class:'hint', text:'（解析経過の記述を準備中）' }));
  return el('div', { class:'stagepanel' }, [head, body]);
};

/* ---- 段階ごとの解析経過（NS.stageDetail から呼ぶ） ---- */
NS.STAGE = {
  /* ===== 火球・隕石落下 ===== */
  'fb-detect':function (b, c) {
    var e = c.e;
    NS.add(b, [
      NS.kv([['入力', '全天カメラ 2 台の連続フレーム（IMX664, 2688×1520 / 25 fps）'],
        ['処理', 'エッジ計算機でフレーム差分 → 深層学習で分類（流星・火球・飛行機・人工衛星・雲・虫）'],
        ['判定', '<b>火球候補</b>　信頼度 0.98'],
        ['この時点で分かること', '各局が「いつ・空のどこに」光を見たか。まだ高度も距離も分からない'],
        ['所要', '検出から 1.2 秒以内（局内で完結し、クラウドを経由しない）']], 'wide'),
      NS.table(['観測局', '検出時刻 (JST)', '仰角', 'S/N', '最大等級', '判定'], e.det.map(function (d) {
        return [NS.ST[d.id].name, { class:'mono sm', html:d.cloud ? '—' : c.at(0) },
          { class:'r', html:NS.f(d.elev, 1) + '°' }, { class:'r', html:d.snr == null ? '—' : NS.f(d.snr, 0) },
          { class:'r', html:d.mag == null ? '—' : NS.mag(d.mag) },
          d.cloud ? NS.badge('曇天で不検出', 'warn') : NS.badge('火球候補', 'ok')];
      })),
      el('div', { class:'note', text:'誤検出（飛行機・人工衛星・虫・雲の切れ間）はこの段階で深層学習が落とす。落としきれなかったものは付属校の生徒が目視で検証し、結果を学習データへ戻す（G-8）。' })]);
  },
  'fb-match':function (b, c) {
    var e = c.e, r0 = NS.rng('wfmatch');
    NS.add(b, [
      NS.kv([['入力', '各局の火球候補（発光開始時刻・方位・仰角の時系列）'],
        ['突き合わせ条件', 'GNSS 時刻が ±50 ms 以内、かつ各局の視線が空間で交わること'],
        ['結果', '<b>' + e.stationsDet + ' 局</b>が同一事象と判定（視野内 ' + e.stationsFov + ' 局）'],
        ['時刻残差', '± 12 ms（GNSS 同期 ＋ IP カメラの転送遅延補正後）'],
        ['この時点で分かること', '同じ一つの火球を何局が見たか。多点解析が成立するかどうか']], 'wide'),
      NS.table(['観測局', 'GNSS 時刻', '基準との差', '転送遅延補正', '対応づけ'], e.det.map(function (d) {
        var dm = d.cloud ? null : r0.norm(0, 9);
        return [NS.ST[d.id].name, { class:'mono sm', html:d.cloud ? '—' : c.at(0) },
          { class:'r', html:dm == null ? '—' : (dm > 0 ? '+' : '') + NS.f(dm, 0) + ' ms' },
          { class:'r sm', html:d.cloud ? '—' : NS.f(-780 - r0() * 90, 0) + ' ms' },
          d.cloud ? NS.badge('対象外', 'dim') : NS.badge('一致', 'ok')];
      })),
      el('div', { class:'note', text:'IP カメラは「画像が制御 PC に届いた時刻」で記録されるため、カメラごとに転送遅延をあらかじめ測って差し引く。この補正の質が多点観測の時刻精度を決める。' })]);
  },
  'fb-traj':function (b, c) {
    var e = c.e, altPts = [], vPts = [];
    for (var k = 0; k <= 50; k++) {
      var f = k / 50, tt = f * e.dur;
      altPts.push([tt, Math.max(e.end.alt, e.begin.alt - (e.begin.alt - e.end.alt) * (f - 0.06 * Math.pow(f, 2.6)))]);
      vPts.push([tt, e.vInf - e.decelMax * Math.pow(f, 4.2)]);
    }
    NS.add(b, [
      NS.kv([['入力', e.stationsDet + ' 局の方位・仰角の時系列（各局 ' + Math.round(e.dur * 25) + ' フレーム前後）'],
        ['処理', '多点三角測量。各局の視線がつくる平面の交線として大気圏内の直線軌跡を最小二乗で決める'],
        ['残差', '<b>41 m</b>（視線と軌跡の距離の標準偏差）'],
        ['発光開始', NS.km(e.begin.alt) + '　' + NS.latlon(e.begin.lat, e.begin.lon)],
        ['発光終了', NS.km(e.end.alt) + '　' + NS.latlon(e.end.lat, e.end.lon)],
        ['突入速度', NS.f(e.vInf, 1) + ' km/s　経路角 ' + NS.f(e.entryAngle, 1) + '°　方位 ' + NS.f(e.azimuth, 0) + '°'],
        ['この時点で分かること', '軌跡・速度・減速。突入前の日心軌道（どこから来たか）と終端の状態（どこへ落ちるか）が両方出る']], 'wide'),
      el('div', { class:'grid g2' }, [
        NS.chart.line({ series:[{ name:'高度', color:'var(--c-info)', pts:altPts, area:true }], width:450, height:150,
          xLabel:'発光からの秒数', yLabel:'高度 km', xFmt:function (v) { return NS.f(v, 1) + 's'; }, yFmt:function (v) { return NS.f(v, 0); } }),
        NS.chart.line({ series:[{ name:'速度', color:'var(--c-warn)', pts:vPts }], width:450, height:150,
          xLabel:'発光からの秒数', yLabel:'速度 km/s', xFmt:function (v) { return NS.f(v, 1) + 's'; }, yFmt:function (v) { return NS.f(v, 1); } })]),
      el('div', { class:'note', text:'終端の減速（最大 ' + NS.f(e.decelMax, 1) + ' km/s）が大きいほど、燃え尽きずに残った質量が大きい。これが次の段階の入力になる。' })]);
  },
  'fb-strewn':function (b, c) {
    var e = c.e, wind = NS.windProfile(e.end.lat, e.end.lon, e.t);
    var lv = wind.levels.filter(function (x) { return x.alt <= 30; });
    NS.add(b, [
      NS.kv([['入力（軌跡側）', '終端 ' + NS.km(e.end.alt) + '、残存質量 ' + NS.f(e.massTerminal, 2) + ' kg、終端速度 約 3 km/s'],
        ['入力（大気側）', '<b>' + wind.source + '</b>'],
        ['地上付近', wind.note],
        ['処理', '減速・アブレーションモデルで終端条件を決め、そこから<b>暗黒飛行（ダークフライト）</b>を数値積分。風・抗力係数・質量の不確かさをモンテカルロ（2,000 試行）で振る'],
        ['出力', '落下域の確率地図（長半径 ' + e.strewn.a + ' km・短半径 ' + e.strewn.b + ' km、長軸方位 ' + e.strewn.az + '°）'],
        ['この時点で分かること', 'どこを捜せば隕石が見つかるか。重い破片ほど風に流されず手前に落ちる']], 'wide'),
      el('div', { class:'grid g2' }, [
        NS.chart.line({ series:[
            { name:'風速', color:'var(--c-info)', pts:lv.map(function (x) { return [x.alt, x.spd]; }), area:true },
            { name:'風向', color:'var(--c-warn)', pts:lv.map(function (x) { return [x.alt, x.dir / 6]; }), dash:'4 3' }],
          width:450, height:170, xLabel:'高度 km', yLabel:'風速 m/s ／ 風向 ÷6 (°)',
          xFmt:function (v) { return NS.f(v, 0); }, yFmt:function (v) { return NS.f(v, 0); },
          rules:[{ x:wind.jetAlt, color:'var(--muted)', dash:'2 3', label:'ジェット気流' }] }),
        NS.table(['高度', '風向', '風速', '気温', '出典'], lv.filter(function (x, j) { return j % 2 === 0 || x.alt <= 3; }).map(function (x) {
          return [{ class:'r', html:NS.f(x.alt, 1) + ' km' }, { class:'r', html:NS.f(x.dir, 0) + '°（' + NS.compass(x.dir) + '）' },
            { class:'r', html:NS.f(x.spd, 1) + ' m/s' }, { class:'r', html:NS.f(x.temp, 0) + ' ℃' }, { class:'sm', html:x.src }];
        }))]),
      NS.table(['質量区分', '推定個数', '推定落下位置', '風の影響'], e.strewn.bins.map(function (b2, j) {
        return [el('b', { text:b2.m }), { class:'r', html:String(b2.n) }, { class:'mono sm', html:NS.latlon(b2.lat, b2.lon) },
          { class:'sm', html:['最も流されにくく手前に落ちる', '中程度', '風下側へ流される', '最も遠くまで流される'][j] }];
      })),
      el('div', { class:'src', text:'風データの出典：' + wind.source + '。気象庁の数値予報 GPV は気象業務支援センターを通じて提供されるものを利用し、高層気象観測の速報値とあわせて用いる。地上 1.5 km 以下は各観測局の複合気象センサーの実測値で置き換えるため、学校屋上の観測網そのものが暗黒飛行（ダークフライト）計算の精度に効く。' })]);
  },
  'fb-notify':function (b, c) {
    var e = c.e;
    NS.add(b, [
      NS.kv([['配信内容', '落下域の確率地図（GeoJSON ＋ 画像）、推定時刻、想定される破片の質量区分、根拠となる観測局の一覧'],
        ['配信先', e.alert.recipients.join('／')],
        ['所要時間', '検出から <b>' + NS.f(e.alert.issuedDt, 0) + ' 秒</b>（3 分 42 秒）。人手を介さない'],
        ['警戒レベル', e.alert.level + '（−8 等より明るい火球、または残存質量 0.1 kg 以上の推定で発報）'],
        ['受け手の行動', '該当区域の被害確認、学校への連絡、問い合わせ窓口の準備'],
        ['この時点で分かること', '観測が「情報」から「行動」へ変わる。ここが社会実装の要（G-7）']], 'wide'),
      el('div', { class:'chips', style:{ marginTop:'6px' } }, e.alert.recipients.map(function (r2) { return NS.badge(r2, 'info'); })),
      el('div', { class:'note', text:'誤報を避けるため、単独局の検出では発報しない。多点で軌跡が決まり、かつ残存質量の推定が閾値を超えた場合に限る。配信後に人が追認し、必要なら訂正を出す。' })]);
  },
  'fb-verify':function (b, c) {
    var e = c.e, inf = e.det.filter(function (d) { return d.infra; });
    NS.add(b, [
      NS.kv([['入力', 'インフラサウンドセンサー 2 台（基線約 60 m）の気圧波形、' + inf.length + ' 局'],
        ['処理', '到達時刻・周期・振幅から AFTAC の周期–収量関係で音響エネルギーを独立推定'],
        ['光学 全エネルギー', '<b>' + NS.f(e.EKt * 4.184e3, 2) + ' GJ</b>（Brown et al. 2002）'],
        ['音響 全エネルギー', '<b>' + NS.f(e.EinfKt * 4.184e3, 2) + ' GJ</b>（周期 ' + NS.f(e.infraP, 2) + ' s）'],
        ['両者の比', NS.f(e.EinfKt / e.EKt, 2) + ' 倍　<span class="hint">因子 2 以内で整合し、光学推定を裏づけた</span>'],
        ['この時点で分かること', '独立な二つの物理から同じ答えが出るか。単独センサーの観測網にはできない検証']], 'wide'),
      NS.table(['観測局', '到達', '周期 P', '振幅', '到来方位'], inf.map(function (d) {
        return [NS.ST[d.id].name, { class:'r mono', html:'＋' + NS.f(d.infra.dt, 1) + ' s' },
          { class:'r', html:NS.f(d.infra.P, 2) + ' s' }, { class:'r', html:NS.f(d.infra.amp, 2) + ' Pa' },
          { class:'r', html:NS.f(d.infra.az, 1) + '°' }];
      })),
      el('div', { class:'note', text:'音は光より約 15 分の 1 の速さで届くため、検証は通報の後になる。二つの推定が大きく食い違えば落下域を再計算して訂正を出す。' })]);
  },
  'fb-respond':function (b, c) {
    var e = c.e;
    NS.add(b, [NS.kv([['自治体からの回答', '山武市より「被害報告なし」。東金市も同様'],
      ['回収捜索', e.recovery.status + '　' + e.recovery.area], ['担当', e.recovery.teams],
      ['方法', '確率密度の高い区画から順に、UAV による空撮と地上班の踏査を組み合わせる'],
      ['地域との連携', '付属校の生徒が地元での聞き取りと目撃情報の収集を担当する'],
      ['この時点で分かること', '通報が実際に機能したか。次の事象に向けた閾値と手順の見直し材料になる']], 'wide'),
      el('div', { class:'note', text:'回収できた隕石は文理学部の地球科学で組成を分析し、突入前の日心軌道と突き合わせる。落下域の推定がどれだけ当たったかは、次の事象の精度評価にそのまま使える。' })]);
  }
};


/* ===== 線状降水帯 ===== */
NS.STAGE['rb-form'] = function (b, c) {
  var rb = c.rb;
  NS.add(b, [NS.kv([
    ['起きていること', '房総半島東部（茂原市付近）で、同じ場所に次々と対流セルが発生し、南北に並び始める'],
    ['この時点の観測', '<b>まだ何も観測されていない。</b>観測局は帯の西 26–69 km にあり、雨量計にも気圧にも変化はない'],
    ['帯の位置', '長さ ' + rb.lengthKm + ' km・幅 ' + rb.axis.width + ' km、房総半島東部を南北に走る'],
    ['帯の移動', '方位 ' + rb.move.az + '°（' + NS.compass(rb.move.az) + 'へ）' + NS.f(rb.move.speed, 1) + ' km/h'],
    ['なぜ難しいか', '線状降水帯は帯の直下でなければ雨量計に何も現れない。気象レーダーは捉えられるが、学校ごとの判断材料にはならない']], 'wide'),
    el('div', { class:'note', text:'この観測網が狙うのは、帯の直下にいなくても帯の発生を知ることである。手がかりは、帯の中で連続する雷放電が出す 0.6–14 Hz のインフラサウンドと、上空の水蒸気量である。' })]);
};
NS.STAGE['rb-detect'] = function (b, c) {
  var rb = c.rb, s3 = rb.det.slice(0, 3);
  NS.add(b, [NS.kv([
    ['入力', 'インフラサウンドセンサー 2 台（基線約 60 m）の気圧波形、全 14 局'],
    ['検知したもの', '0.6–14 Hz の雷放電音。10 分あたり <b>24 回</b>（この時点）'],
    ['検知局', s3.map(function (d) { return NS.ST[d.id].name; }).join('・') + ' の 3 局'],
    ['距離', '音源まで 26–62 km。<b>帯の直下にいない局が最初に捉えた</b>'],
    ['この時点で分かること', '東〜東南東の方向で、雷を伴う対流が連続して起きている']], 'wide'),
    NS.table(['観測局', '帯の軸まで', '到来方位', '方位のばらつき', '雷検知数（全期間）'], rb.det.map(function (d) {
      return [NS.ST[d.id].name, { class:'r', html:d.axisKm + ' km' },
        { class:'r mono', html:'<b>' + NS.f(d.az, 0) + '°</b>' }, { class:'r', html:'±' + NS.f(d.azSd, 1) + '°' },
        { class:'r', html:d.strikes.toLocaleString() }];
    })),
    el('div', { class:'note', text:'雷 1 回だけでは意味がない。10 分あたり 30 回を超え、かつ到来方位が一点に集中していることが、次の段階に進む条件になる。' })]);
};
NS.STAGE['rb-locate'] = function (b, c) {
  var rb = c.rb;
  NS.add(b, [NS.kv([
    ['入力', '5 局の到来方位（それぞれ ±' + NS.f(rb.det[2].azSd, 1) + '〜±' + NS.f(rb.det[1].azSd, 1) + '°）'],
    ['処理', '各局から方位線を引いて交会させ、雷放電ひとつひとつの位置を推定する'],
    ['出力', '音源が <b>長さ ' + rb.lengthKm + ' km・幅 ' + rb.axis.width + ' km の帯状</b>に並ぶことを確認'],
    ['定位精度', '±' + NS.f(rb.locErr, 1) + ' km（既知音源による較正値）'],
    ['帯の移動', '到来方位の時間変化から、方位 ' + rb.move.az + '° へ ' + NS.f(rb.move.speed, 1) + ' km/h'],
    ['この時点で分かること', '単発の雷雲ではなく、線状に並んだ対流であること。どちらへ動くか']], 'wide'),
    el('div', { class:'note', text:'「線状に並んでいる」という空間配列こそが線状降水帯の定義に直結する。単独局のインフラサウンドでは方位しか出ないが、5 局を束ねると形が出る。これが全国アレイの意味である。' }),
    el('button', { class:'iconbtn', text:'帯の推定位置と雷放電の定位（地図）を見る →', onclick:function () {
      c.go('weather'); setTimeout(function () { var t = document.getElementById('rainband'); if (t) t.scrollIntoView({ block:'start' }); }, 60); } })]);
};
NS.STAGE['rb-pwv'] = function (b, c) {
  var rb = c.rb, xs = rb.series.map(function (p) { return p.hh; });
  NS.add(b, [NS.kv([
    ['入力', '2 周波 GNSS の搬送波遅延から求めた可降水量（PWV）。全 14 局・5 分ごと'],
    ['変化', '船橋局で <b>43 → 58 mm（＋35 %）</b>。1 時間で 10 % 以上の上昇'],
    ['意味', '下層へ強い水蒸気の流入が続いている。線状降水帯が維持される条件'],
    ['同時に見る量', '地上気圧の低下（−6.2 hPa）、風向の south-westerly への揃い'],
    ['この時点で分かること', '帯が一過性ではなく、当面続く見込みであること'],
    ['原理', '国土地理院 GEONET で行われている GNSS 気象学と同じ。それを学校屋上で密に行う（G-5）']], 'wide'),
    NS.chart.line({ series:[
        { name:'可降水量 PWV', color:'var(--c-spec)', pts:rb.series.map(function (p) { return [p.hh, p.pwv]; }), area:true },
        { name:'気圧', color:'var(--c-warn)', pts:rb.series.map(function (p) { return [p.hh, p.press - 945]; }), dash:'4 3' }],
      width:900, height:170, xLabel:'JST', yLabel:'PWV mm ／ 気圧 −945 hPa',
      xFmt:function (v) { return NS.p2(Math.floor(v) % 24) + ':' + NS.p2(Math.round((v % 1) * 60)); },
      yFmt:function (v) { return NS.f(v, 0); },
      rules:[{ y:55, color:'var(--c-spec)', dash:'2 3', label:'判定閾値 55 mm' }] }),
    el('div', { class:'note', text:'雷（音）は「いま起きていること」を、可降水量（GNSS）は「これから続くかどうか」を示す。この二つが揃って初めて発報の根拠になる。' })]);
};
NS.STAGE['rb-judge'] = function (b, c) {
  var rb = c.rb;
  NS.add(b, [NS.kv([
    ['判定方式', '6 条件すべての成立で「線状降水帯の可能性」を自動判定'],
    ['判定時刻', '形成から 54 分。' + rb.leadMin + ' 分後に外部の大雨情報が発表された'],
    ['使うセンサー', 'インフラサウンド（雷）／2 周波 GNSS（可降水量）／複合気象センサー（気圧・雨量）'],
    ['この時点で分かること', '発報してよい状態かどうか。1 つでも欠ければ「監視」に留める']], 'wide'),
    NS.table(['指標', '閾値', '観測値', '担うセンサー', ''], rb.criteria.map(function (cr, j) {
      return [{ class:'sm', html:cr[0] }, { class:'sm', html:cr[1] }, { html:'<b>' + cr[2] + '</b>' },
        { class:'sm', html:['インフラサウンド', 'インフラサウンド', 'インフラサウンド', '2 周波 GNSS', '気象センサー', '気象センサー'][j] },
        cr[3] ? NS.badge('成立', 'ok') : NS.badge('不成立', 'dim')];
    })),
    el('div', { class:'note', text:'最初の 3 条件はインフラサウンドだけで満たせるが、それだけでは発報しない。水蒸気（GNSS）と気圧（気象センサー）の裏づけを必須にすることで、花火・爆発音・工事音による誤発報を防ぐ。' })]);
};
NS.STAGE['rb-notify'] = function (b, c) {
  var rb = c.rb;
  NS.add(b, [NS.kv([
    ['配信先（自治体）', '千葉県 山武市・東金市・茂原市 の防災担当'],
    ['配信先（学校）', '県東部の付属校 3 校'],
    ['配信内容', '帯の推定位置と向き（' + rb.lengthKm + ' × ' + rb.axis.width + ' km）、移動方位と速度、雷放電の密度、可降水量の推移'],
    ['所要時間', '判定から <b>4 分</b>'],
    ['先行時間', '外部の大雨情報に <b>' + rb.leadMin + ' 分</b>先行'],
    ['学校の対応', '登校時間帯の変更、部活動の中止、屋外行事の延期'],
    ['この時点で分かること', '各校が自分の位置と帯の位置を突き合わせて判断できる']], 'wide'),
    el('div', { class:'note', text:'気象庁の情報を置き換えるものではない。学校ごとに「自校がその帯の進路に入るか」を早く知るための補助であり、判断の記録を残して事後に検証する。' })]);
};
NS.STAGE['rb-verify'] = function (b, c) {
  var rb = c.rb, d0 = rb.det[0];
  NS.add(b, [NS.kv([
    ['実測（船橋局）', '最大 1 時間降水量 <b>' + NS.f(d0.rainMax, 1) + ' mm/h</b>、6 時間 ' + NS.f(d0.rain6h, 1) + ' mm'],
    ['最大瞬間風速', NS.f(d0.gust, 1) + ' m/s'],
    ['最低気圧', NS.f(d0.pressMin, 1) + ' hPa（' + NS.f(d0.pressDrop, 1) + ' hPa）'],
    ['帯の直下（推定）', '最大 1 時間降水量 ' + rb.rainPeak1h + ' mm/h（' + rb.rainPeakPlace + '）'],
    ['先行時間の実績', '雷放電の急増（+12 分）は、船橋局が 30 mm/h に達する（+150 分）より <b>2 時間以上</b>早い'],
    ['この時点で分かること', '音と水蒸気による予測が、実際の雨量で裏づけられたか']], 'wide'),
    NS.table(['観測局', '帯の軸まで', '6 h 雨量', '最大 1 h', '最大瞬間風速', 'PWV'], rb.det.map(function (d) {
      return [NS.ST[d.id].name, { class:'r', html:d.axisKm + ' km' }, { class:'r', html:NS.f(d.rain6h, 1) + ' mm' },
        { class:'r', html:NS.f(d.rainMax, 1) + ' mm/h' }, { class:'r', html:NS.f(d.gust, 1) + ' m/s' },
        { class:'r', html:d.pwv0 + '→' + d.pwvMax + ' mm' }];
    })),
    el('div', { class:'note', text:'帯の直下の降水量は雷放電の密度と船橋局の実測から推定した値であり、レーダー観測の代替ではない。運用では気象庁レーダー・解析雨量と突き合わせて検証する。' })]);
};
NS.STAGE['rb-clear'] = function (b, c) {
  NS.add(b, [NS.kv([
    ['解除の条件', '雷放電の検知が 10 分あたり 5 回を下回り、かつ可降水量が平常値へ戻ること'],
    ['解除時刻', '形成から 6.3 時間後'],
    ['連絡先', '発報した 3 市・3 校すべてへ解除を連絡'],
    ['記録', '判定の根拠・発報時刻・受け手の対応を事象ごとに保存し、閾値の見直しに使う'],
    ['この時点で分かること', '一連の運用が閉じたか。解除が遅れると次の発報が信用されなくなる']], 'wide'),
    el('div', { class:'note', text:'発報だけでなく解除まで自動で行えることが、学校現場で繰り返し使ってもらえる条件になる。危機管理学部が受け手への聞き取りを行い、文面と閾値を改訂する（G-7）。' })]);
};

/* ===== 津波 ===== */
NS.STAGE['ts-quake'] = function (b, c) {
  var ts = c.ts, q = ts.quake, seis = ts.det.filter(function (d) { return d.kind === '微動計'; });
  NS.add(b, [NS.kv([
    ['地震', '<b>' + q.name + ' M' + q.mw + '</b>　深さ ' + q.depth + ' km　' + NS.latlon(q.lat, q.lon)],
    ['本観測網の入力', '全 14 局の微動計（3 成分加速度計・100 Hz）'],
    ['外部情報', q.src + '　／　' + NS.f(ts.jmaWarn.dt, 0) + ' 分後に' + ts.jmaWarn.text],
    ['この時点で分かること', '地震が起きたこと。<b>津波が来るかどうか、どれだけ来るかはまだ分からない</b>'],
    ['校舎の判定', '各局で地震前後の固有振動数を比較し、使用可否を自動判定（DT-6）']], 'wide'),
    NS.table(['観測局', 'P 波到達', '最大加速度', '校舎の判定'], seis.map(function (d) {
      return [NS.ST[d.id].name, { class:'mono sm', html:d.val.split(' / ')[0] },
        { class:'r', html:d.val.split(' / ')[1] }, NS.badge('継続使用可', 'ok')];
    })),
    el('div', { class:'note', text:'津波の高さは震源の断層すべり分布で決まるが、それが分かるまでには時間がかかる。ここから先、本観測網は「海面が動いた結果として大気と電離圏に何が起きたか」を直接測りにいく。' })]);
};
NS.STAGE['ts-tec'] = function (b, c) {
  var ts = c.ts, g = ts.det.filter(function (d) { return d.kind === 'GNSS' && d.dt < 19; });
  NS.add(b, [NS.kv([
    ['入力', '全 14 局の 2 周波 GNSS（L1/L2 の搬送波位相差から全電子数 TEC を算出、30 秒値）'],
    ['検知したもの', '<b>TEC の音波共振</b>。' + ts.resFreq[0] + ' mHz（周期 3.8 分）と ' + ts.resFreq[1] + ' mHz'],
    ['最初の検知', NS.ST[g[0].id].name + '　地震発生から <b>' + NS.f(g[0].dt, 1) + ' 分</b>'],
    ['物理', '海面と地殻の上下変動が音波として上方へ伝わり、高度 300 km 付近の電離圏を揺らす。大気の音波共振モードに対応する'],
    ['この時点で分かること', '海面が実際に大きく動いたこと。断層モデルを待たずに確認できる'],
    ['根拠', 'Kakinami et al. (2013) レイリー波に伴う電離圏さざ波ほか']], 'wide'),
    NS.table(['観測局', '検知', '内容', '備考'], g.map(function (d) {
      return [NS.ST[d.id].name, { class:'r mono', html:'+' + NS.f(d.dt, 1) + ' 分' }, d.val, { class:'sm', html:d.note || '' }];
    })),
    el('div', { class:'note', text:'GEONET は全国 1,300 点を超える密度を持つが、本観測網の 14 局は学校に置かれており、得られた擾乱をその場で学校の判断に結びつけられる点が違う（G-5）。' })]);
};
NS.STAGE['ts-acou'] = function (b, c) {
  var ts = c.ts, a = ts.det.filter(function (d) { return d.kind === 'インフラサウンド'; });
  NS.add(b, [NS.kv([
    ['入力', 'インフラサウンドセンサー（0.1 Hz 以下まで応答）。津波は 0.8–4 mHz の大気重力波を放射する'],
    ['検知したもの', '海面変動に伴う大気重力波。最初の到達は ' + NS.ST[a[0].id].name + '（+' + NS.f(a[0].dt, 1) + ' 分）'],
    ['振幅', a.map(function (d) { return NS.ST[d.id].name + ' ' + d.val.split(' / ')[1]; }).join('／')],
    ['意味', '電離圏（GNSS）とは独立な経路で、同じ海面変動を確認できる'],
    ['この時点で分かること', '二つの独立したセンサーが同じ事象を指している。誤検知の可能性が下がる'],
    ['根拠', 'Nishikawa et al. (2022) トンガ噴火の大気重力波が後続津波を励起した観測']], 'wide'),
    NS.table(['観測局', '到達', '周波数帯・振幅', '備考'], a.map(function (d) {
      return [NS.ST[d.id].name, { class:'r mono', html:'+' + NS.f(d.dt, 1) + ' 分' }, d.val, { class:'sm', html:d.note || '' }];
    })),
    el('div', { class:'note', text:'同じインフラサウンドセンサーが、火球の衝撃波（G-1）・火山噴火（G-4）・雷（G-6）・津波を一つの装置で捉える。一つのセンサー網が宇宙起源と地球起源の双方に効くことが、本観測網の設計思想である。' })]);
};
NS.STAGE['ts-hole'] = function (b, c) {
  var ts = c.ts;
  NS.add(b, [NS.kv([
    ['検知したもの', '<b>津波性電離圏ホール</b>。TEC が背景値から減少し始める'],
    ['開始', '地震発生から <b>19.4 分</b>（' + NS.ST['KYM'].name + '）'],
    ['最大減少', '<b>' + NS.f(ts.holeMax, 2) + ' TECU</b>　減少率 ' + NS.f(ts.holeRate, 2) + ' TECU/分'],
    ['物理', '津波が海面を押し下げる際の下向きの大気の動きで電離圏の電子が下方へ運ばれ、電子密度が局所的に減る'],
    ['重要な点', '減少の深さと速さが<b>津波の規模と相関する</b>。ここが次の段階の入力になる'],
    ['根拠', 'Kakinami et al. (2012) Tsunamigenic ionospheric hole（GRL 39, L00G27）']], 'wide'),
    NS.chart.line({ series:[
        { name:'TEC', color:'var(--c-info)', pts:ts.tec.map(function (p) { return [p.m, p.tec]; }), area:true },
        { name:'共振成分', color:'var(--c-warn)', pts:ts.tec.map(function (p) { return [p.m, 22.6 + p.res * 2]; }), dash:'3 3', opacity:0.8 }],
      width:900, height:200, xLabel:'地震発生からの経過（分）', yLabel:'TEC（TECU）',
      xFmt:function (v) { return NS.f(v, 0); }, yFmt:function (v) { return NS.f(v, 0); },
      rules:[{ x:8, color:'var(--c-warn)', dash:'3 3', label:'共振' }, { x:19, color:'var(--accent)', dash:'3 3', label:'ホール開始' },
             { x:26, color:'var(--c-ok)', dash:'3 3', label:'規模推定' }] }),
    el('div', { class:'note', text:'共振（+8 分）は「海面が動いた」ことしか示さないが、ホール（+19 分）はその大きさを含む。両方を見ることで、早さと確からしさを両立させる。' })]);
};
NS.STAGE['ts-est'] = function (b, c) {
  var ts = c.ts;
  NS.add(b, [NS.kv([
    ['入力', 'TEC 減少量 ' + NS.f(ts.holeMax, 2) + ' TECU、減少率 ' + NS.f(ts.holeRate, 2) + ' TECU/分、大気重力波の振幅'],
    ['処理', '減少率と津波波高の経験関係から沿岸波高を推定。GNSS 5 局・インフラサウンド 2 局の値を重み付け平均'],
    ['推定波高', '<b>' + NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1) + ' m</b>（沿岸）'],
    ['所要', '地震発生から 26 分。気象庁の津波警報（+' + NS.f(ts.jmaWarn.dt, 0) + ' 分）より遅いが、<b>規模の独立推定</b>という別の情報を出す'],
    ['この時点で分かること', '「津波が来る」ではなく「どれくらい来そうか」。避難の継続判断に効く'],
    ['根拠', 'Kamogawa et al. (2016) 電離圏ホール観測による宇宙からの津波早期警戒（Sci. Rep. 6, 37989）']], 'wide'),
    el('div', { class:'note', text:'警報より早いことを目指すのではない。警報が出たあと「解除してよいのか、まだ続くのか」を判断する材料が現場では足りない。そこを埋めるのがこの推定の役割である。' })]);
};
NS.STAGE['ts-notify'] = function (b, c) {
  var ts = c.ts;
  NS.add(b, [NS.kv([
    ['配信内容', '推定沿岸波高 ' + NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1) + ' m、TEC 擾乱の時系列、検知した局の一覧、推定の不確かさ'],
    ['配信先', ts.coastSchools.join('／')],
    ['位置づけ', '<b>' + ts.note + '</b>'],
    ['所要時間', '推定から 2 分'],
    ['受け手の行動', '避難の継続・生徒の引き渡し可否・翌日の登校判断'],
    ['この時点で分かること', '学校が自分で判断するための数字が、根拠つきで手元に届く']], 'wide'),
    el('div', { class:'chips', style:{ marginTop:'6px' } }, ts.coastSchools.map(function (x) { return NS.badge(x, 'info'); })),
    el('div', { class:'note', text:'この配信には必ず不確かさ（±' + NS.f(ts.estErr, 1) + ' m）と「気象庁の警報が優先する」旨を併記する。法学部・危機管理学部と文面を整備し、誤解を招く表現を避ける（G-7）。' })]);
};
NS.STAGE['ts-verify'] = function (b, c) {
  var ts = c.ts;
  NS.add(b, [NS.kv([
    ['実測', '<b>' + NS.f(ts.obsWave, 1) + ' m</b>（' + ts.obsPlace + '）'],
    ['推定', NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1) + ' m'],
    ['差', NS.f(ts.estWave - ts.obsWave, 1) + ' m（推定の不確かさの範囲内）'],
    ['検証に使う外部データ', '気象庁 検潮所の潮位記録、GEONET の TEC、気象庁 数値予報 GPV の高層風'],
    ['蓄積の意味', '事象ごとに推定と実測を突き合わせ、経験関係の係数を更新する'],
    ['この時点で分かること', '手法がどれだけ当たるか。当たらなければ配信をやめる判断も含む']], 'wide'),
    el('div', { class:'chips' }, ts.refs.map(function (x) { return NS.badge(x, ''); })),
    el('div', { class:'note', text:'日本では幸いにも大津波の頻度は低く、検証事例が集まりにくい。遠地津波（チリ・トンガなど）や火山起源の気象津波も対象に含めて、係数を鍛える必要がある。' })]);
};

/* ===== 火山噴火 ===== */
NS.STAGE['vo-erupt'] = function (b, c) {
  var vo = c.vo;
  NS.add(b, [NS.kv([
    ['事象', '<b>' + vo.name + '</b>　噴煙高度 2,300 m'],
    ['音源', vo.src.name + '　' + NS.latlon(vo.src.lat, vo.src.lon)],
    ['この時点の観測', 'まだ何も届いていない。音が最寄りの宮崎局に届くまで 4 分 33 秒かかる'],
    ['光では見えない理由', '夜間・悪天候・噴煙自体に遮られて、遠方から光学では捉えられないことが多い'],
    ['周波数帯', vo.freq]], 'wide'),
    el('div', { class:'note', text:'火山噴火は爆発的な体積変化として低周波の空気振動（インフラサウンド）を放射する。可聴音より減衰しにくく、数百 km 先まで届く。' })]);
};
NS.STAGE['vo-detect'] = function (b, c) {
  var vo = c.vo, d = vo.det[0];
  NS.add(b, [NS.kv([
    ['最初の検知', '<b>' + NS.ST[d.id].name + '</b>　噴火から ' + NS.f(d.dt, 1) + ' 秒'],
    ['距離', NS.f(d.dist, 1) + ' km'],
    ['到来方位', NS.f(d.az, 1) + '° ± ' + NS.f(d.azErr, 1) + '°（' + NS.compass(d.az) + '）'],
    ['最大振幅', NS.f(d.amp, 2) + ' Pa　周期 ' + NS.f(d.P, 1) + ' s'],
    ['位相', d.phase],
    ['この時点で分かること', '南西方向で爆発的な事象が起きた。単独局では方位しか出ない']], 'wide'),
    el('div', { class:'note', text:'各局はインフラサウンドセンサーを 2 台、基線約 60 m で置く。この 1 局内のペアだけでも到来方位が出せるので、1 局目の検知の時点で方向は分かる。' })]);
};
NS.STAGE['vo-locate'] = function (b, c) {
  var vo = c.vo;
  NS.add(b, [NS.kv([
    ['入力', vo.det.length + ' 局の到来方位と到達時刻'],
    ['処理', '方位線の交会と到達時刻差の等時線を重ねて音源位置を決める'],
    ['定位誤差', '<b>±' + NS.f(vo.locErr, 1) + ' km</b>（気象庁発表の火口位置との差）'],
    ['見かけの音速', NS.f(vo.cel, 3) + ' km/s'],
    ['較正', '種子島の打上げ（発生時刻・位置が既知）で定位精度 3.1 km を確認済み'],
    ['この時点で分かること', 'どの火山のどの火口か。規模の見積もりに進める']], 'wide'),
    NS.table(['観測局', '距離', '到達', '到来方位', '振幅', '位相'], vo.det.map(function (d) {
      return [NS.ST[d.id].name, { class:'r', html:NS.f(d.dist, 1) + ' km' }, { class:'r mono', html:'＋' + NS.f(d.dt, 1) + ' s' },
        { class:'r', html:NS.f(d.az, 1) + '° ±' + NS.f(d.azErr, 1) + '°' }, { class:'r', html:NS.f(d.amp, 2) + ' Pa' },
        { class:'sm', html:'<span style="white-space:nowrap">' + d.phase + '</span>' }];
    })),
    el('div', { class:'note', text:'既知の音源（ロケット打上げ）で日常的に較正できることが、この観測網の強みである。誤差が広がっていれば装置か伝搬経路に異常があると分かる。' })]);
};
NS.STAGE['vo-notify'] = function (b, c) {
  NS.add(b, [NS.kv([
    ['配信内容', '音源位置（±6.8 km）、振幅から推定した噴火規模、風向から求めた降灰の見込み方向'],
    ['配信先', '鹿児島県・宮崎県の防災担当、九州の付属校（宮崎日本大学高等学校・中学校）'],
    ['所要時間', '検知から 7 分'],
    ['学校の対応', '屋外活動の中止、窓の閉鎖、通学路の確認'],
    ['外部情報との関係', '気象庁の噴火速報・降灰予報が優先。本観測網は到達時刻と規模の独立確認を提供する'],
    ['この時点で分かること', '九州の学校が自分の位置と降灰の見込みを突き合わせられる']], 'wide'),
    el('div', { class:'note', text:'桜島は年間数百回噴火する。すべてを発報すると現場が疲弊するため、振幅が閾値を超えたものだけに絞り、平常の活動は記録のみとする。閾値は危機管理学部と現地の学校で決める。' })]);
};
NS.STAGE['vo-strat'] = function (b, c) {
  var vo = c.vo, far = vo.det[2];
  NS.add(b, [NS.kv([
    ['検知', '<b>' + NS.ST[far.id].name + '</b>（' + NS.f(far.dist, 0) + ' km）に ' + NS.f(far.dt / 60, 1) + ' 分後に到達'],
    ['位相', far.phase + '　周期 ' + NS.f(far.P, 1) + ' s、振幅 ' + NS.f(far.amp, 2) + ' Pa'],
    ['物理', '成層圏（高度 40–50 km）の風に乗って屈折し、地表へ戻ってくる経路。直達波より遅く、風下側にだけ現れる'],
    ['逆推定', '到達時刻と方位から、<b>高度 40–50 km の東西風速を約 62 m/s</b> と推定'],
    ['意義', '高層気象観測（ラジオゾンデ）は高度 30 km 程度までしか届かない。その上の風を音で測る'],
    ['この時点で分かること', '成層圏の風。暗黒飛行（ダークフライト）の風補正や、音の伝搬予測そのものの精度向上に還る']], 'wide'),
    el('div', { class:'note', text:vo.note }),
    el('div', { class:'note', text:'噴火という「災害」の観測が、そのまま成層圏の状態を測る手段になる。同じ波形が G-4（音源定位）と DT-4（音の大気ツイン）の両方に入る。' })]);
};

/* =========================================================================
   データ公開・API
   ========================================================================= */
NS.V.data = function (root, go, arg) {
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'データ公開と API' }),
    el('p', { text:'全局のデータを学内クラウドに集約し、研究者・自治体・学校の 3 階層でアクセス制御する。カメラは空のみを撮像し、映像の学外公開は検出クリップに限定する（PF-2）。' })
  ]));

  NS.add(root, el('div', { class:'grid g3' }, [
    panel('3 階層のアクセス', { note:'個人情報とデータ保護（理工学部 五味が安全設計を担当）' },
      NS.table(['階層', '対象', '公開する内容'], [
        ['第 1 層', '一般・学校・報道', 'イベントカタログ（時刻・等級・軌道・落下域の概略）、夜空輝度マップ、WBGT、検出クリップ'],
        ['第 2 層', '自治体・教育委員会', '落下域確率地図（詳細）、警報、局別の気象・雷、校舎判定'],
        ['第 3 層', '研究者（申請制）', '生映像・波形・分光の原データ、較正情報、軌道解の共分散']
      ])),
    panel('公開データ', { note:'2 年間の到達目標' },
      NS.table(['データ', '内容', '公開時期'], [
        ['火球カタログ', '1 年分の全事象（軌跡・軌道・エネルギー）', '令和10年度'],
        ['再突入観測事例集', '分光・SWIR・音響を含む事例集', '令和10年度'],
        ['夜空輝度マップ', '14 点の連続データと全国マップ', '令和10年度'],
        ['インフラサウンド', '波形と検出イベント（公開 API）', '令和9年度末'],
        ['気象', '14 点の 1 分値（公開 API）', '令和9年度末'],
        ['白書・ガイドライン', '宇宙起源災害への学校・自治体対応', '令和10年度']
      ])),
    panel('カタログ統計（デモ）', null, [
      NS.kv([
        ['登録イベント', NS.EVENTS.length.toLocaleString() + ' 件（直近 14 日）'],
        ['うち火球（0 等より明るい）', NS.EVENTS.filter(function (e) { return e.kind === 'fireball'; }).length + ' 件'],
        ['多点（4 局以上）', NS.EVENTS.filter(function (e) { return e.stationsDet >= 4; }).length + ' 件'],
        ['分光取得', NS.EVENTS.filter(function (e) { return e.spectrum || e.hasSpec; }).length + ' 件'],
        ['インフラサウンド同時', NS.EVENTS.filter(function (e) { return e.hasInfra || (e.det && e.det.some(function (d) { return d.infra; })); }).length + ' 件'],
        ['1 日あたりの生成データ量', '約 1.4 TB（14 局合計・一次映像を含む）'],
        ['長期保存', '検出クリップと較正データを恒久保存、連続映像は 30 日'],
        ['時刻精度', 'GNSS 同期 < 1 ms（IP カメラは転送遅延を局ごとに補正）']
      ], 'wide')
    ])
  ]));

  var sampleFb = NS.FLAGSHIP.fireball;
  var json = {
    id: sampleFb.id, kind: 'fireball',
    t_utc: new Date(sampleFb.t).toISOString(), t_jst: NS.fmtJST(sampleFb.t, { ms:true }),
    abs_mag_peak: Number(sampleFb.absMag.toFixed(1)), duration_s: Number(sampleFb.dur.toFixed(2)),
    stations_detected: sampleFb.stationsDet, stations_in_fov: sampleFb.stationsFov,
    begin: { lat:sampleFb.begin.lat, lon:sampleFb.begin.lon, alt_km:sampleFb.begin.alt },
    end: { lat:sampleFb.end.lat, lon:sampleFb.end.lon, alt_km:sampleFb.end.alt },
    v_inf_kms: sampleFb.vInf, entry_angle_deg: sampleFb.entryAngle, azimuth_deg: sampleFb.azimuth,
    energy: { radiated_gj: Number((sampleFb.ErJ / 1e9).toFixed(3)), total_kt_optical: Number(sampleFb.EKt.toExponential(3)),
              total_kt_infrasound: Number(sampleFb.EinfKt.toExponential(3)), method_optical:'Brown et al. 2002', method_infrasound:'AFTAC period-yield' },
    mass: { photometric_kg: Number(sampleFb.massPhoto.toFixed(1)), terminal_kg: sampleFb.massTerminal, tau: sampleFb.tau },
    orbit: { a_au:+sampleFb.orbit.a.toFixed(4), e:+sampleFb.orbit.e.toFixed(4), i_deg:+sampleFb.orbit.i.toFixed(3),
             q_au:+sampleFb.orbit.q.toFixed(4), Q_au:+sampleFb.orbit.Q.toFixed(4),
             peri_deg:+sampleFb.orbit.w.toFixed(3), node_deg:+sampleFb.orbit.node.toFixed(3),
             tisserand_j:+sampleFb.orbit.Tj.toFixed(2), cls:sampleFb.orbit.cls },
    radiant: { ra_deg:+sampleFb.radiant.ra.toFixed(2), dec_deg:+sampleFb.radiant.dec.toFixed(2),
               ra_app_deg:+sampleFb.radiant.raApp.toFixed(2), dec_app_deg:+sampleFb.radiant.decApp.toFixed(2),
               v_g_kms:+sampleFb.vg.toFixed(2), v_h_kms:+sampleFb.vh.toFixed(2) },
    strewn_field: { center:{ lat:sampleFb.strewn.lat, lon:sampleFb.strewn.lon },
                    semi_major_km:sampleFb.strewn.a, semi_minor_km:sampleFb.strewn.b, azimuth_deg:sampleFb.strewn.az },
    stations: sampleFb.det.map(function (d) { return { id:d.id, mag:d.mag, elev_deg:d.elev, snr:d.snr, infrasound_delay_s:d.infra ? d.infra.dt : null }; })
  };
  NS.add(root, el('div', { class:'grid g-1-2', style:{ marginTop:'14px' } }, [
    panel('公開 API（設計案）', { note:'読み取り専用・JSON' }, el('div', { class:'api', html:
      '<span class="m">GET</span> /api/v1/<span class="k">stations</span>                <span class="c"># 14局の諸元・稼働状態</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">stations</span>/{id}/status     <span class="c"># 機材別の稼働・観測モード</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">events</span>?from=&to=&min_mag= <span class="c"># 火球・流星カタログ</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">events</span>/{id}              <span class="c"># 軌跡・軌道・エネルギー・落下域</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">events</span>/{id}/lightcurve   <span class="c"># 局別の光度曲線</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">events</span>/{id}/spectrum     <span class="c"># 分光（要 第3層）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">reentry</span>/forecast         <span class="c"># 再突入予報（TLE 由来）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">infrasound</span>/events        <span class="c"># 音響イベントと定位結果</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">infrasound</span>/{id}/waveform <span class="c"># 波形（要 第3層）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">weather</span>?station=&res=1min <span class="c"># 気象 1 分値・WBGT</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">skybrightness</span>?station=    <span class="c"># 夜空輝度（SQM）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">tec</span>?station=              <span class="c"># 電離圏 TEC（2周波GNSS）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">structure</span>/{id}/modes      <span class="c"># 校舎固有振動数（要 第2層）</span>\n' +
      '<span class="m">GET</span> /api/v1/<span class="k">alerts</span>                    <span class="c"># 発報履歴</span>\n\n' +
      '<span class="c"># 認証：第2層・第3層は API キー（申請制）。全時刻は UTC と JST を併記。</span>' })),
    panel('レスポンス例', { note:'GET /api/v1/events/' + sampleFb.id },
      el('div', { class:'api', text:JSON.stringify(json, null, 2) }))
  ]));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('デジタルツイン（DT-1〜DT-7）',
    { note:'実測で常時更新される仮想モデル。可視化だけのダッシュボードとは区別する' },
    NS.table(['ツイン', '対象', '観測網から得るデータ', '目的・what-if'], [
      ['DT-1 上空大気圏', '日本上空 0–120 km の火球・再突入体と周囲大気', '多点全天動画、インフラサウンド、風プロファイル、公開軌道要素', '発生数分後に落下域の確率地図を自治体・学校へ配信'],
      ['DT-2 空の明るさ・雲', '各局上空の夜空輝度、雲量・雲形、透明度', '夜空輝度計、全天画像、日射計、気象衛星', '全国輝度マップ、衛星・光害の寄与分離、星空予報'],
      ['DT-3 学校微気候', '校庭・体育館・屋上の WBGT・日射・風', '気象センサー、雲量、校舎 3D モデル', '時間帯・場所別の熱中症リスク予測'],
      ['DT-4 音の大気', '地表〜成層圏の音波伝搬場と音源', '14 局インフラサウンド、高層風、既知音源', '火山・津波・爆発の即時検知と定位、成層圏風の逆推定'],
      ['DT-5 電離圏', '日本上空の TEC 分布と擾乱', '2 周波 GNSS、GEONET、NICT', 'GNSS 測位誤差予報、津波・噴火起源の電離圏波動'],
      ['DT-6 校舎構造', '観測局を載せる校舎の固有振動数・剛性', '微動計、温度', '地震直後の校舎使用可否の即時判定'],
      ['DT-7 学びのツイン', '各付属校の「自校のツイン」と探究記録', '自校局の全データ、生徒追加センサー', '生徒が自校の空を再現して探究し、結果を観測網へ還元']
    ]))));
};

/* =========================================================================
   このデモについて
   ========================================================================= */
NS.V.about = function (root, go) {
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'このデモについて' }),
    el('p', { text:'令和9年度 日本大学特別研究の申請に向けた、観測ポータル「ソラ」のデモ版である。観測網の設計は申請書のとおりで、表示されている観測値とイベントは一部模擬データである。気象庁のひまわり衛星画像と天気図は実データを気象庁のサーバーから取得している。' })
  ]));
  NS.add(root, el('div', { class:'grid g2' }, [
    panel('実データ（申請書に基づく）', { note:'このデモで正確に反映している内容' },
      el('ul', { style:{ margin:0, paddingLeft:'1.2em', fontSize:'12.5px', color:'var(--ink2)' } }, [
        '観測局 14 局の名称・所在地・座標・設置機関（大学キャンパス拠点 7 局／付属校拠点 7 局）。生産工学部は津田沼・実籾の両キャンパスを津田沼局が代表する',
        'SWIR 冷却カメラの設置局（船橋・郡山の 2 局）',
        '全局共通のフル構成（機材の型式・仕様・価格帯・用途）',
        '宇宙線計測器：Accel Kitchen「素粒子検出器組み立てキット」（プラスチックシンチレータ 5×5×1 cm ＋ SiPM ＋ ESP32）を全 14 局に設置。気圧効果 −0.15 %/hPa・気温効果 −0.09 %/K・地磁気の遮断能・フォーブッシュ減少は宇宙線物理の一般的な値',
        'ガンダム望遠鏡（口径 400 mm F3.8 ／ 200 mm F3.0・船橋局）の諸元。視野は ZWO ASI174MM の公称画素 5.86 µm 角・1936 × 1216（実寸 11.34 × 7.13 mm）と焦点距離（1,520 / 600 mm）から 2·atan(寸法/2f) で算出し、主鏡 0.428° × 0.269°・副鏡 1.083° × 0.680° となる（遊星人 2024 表 1 の 0.42° × 0.27°・1.08° × 0.68° を再現する）。2018 年ふたご座流星群の月面衝突閃光 11 個の観測結果は、阿部新助・柳澤正久・小野寺圭祐「ふたご座流星群の月面衝突閃光から探る活動小惑星 Phaethon の cm サイズ粒子」日本惑星科学会誌 遊星人 33 (3), 262–269 (2024)',
        'Draco スマート望遠鏡（DWARFLAB、口径 90 mm・焦点距離 340 mm F3.8、1/1.3" 50 MP ＋ 広角 1/1.55"、露出 1/10000–300 秒、内蔵ガイド）を船橋局・郡山局に特注ハウジングとともに設置。諸元は DWARFLAB 公式による',
        '視野円の算出（高度 100 km を仰角 30° 以上で見込める地表半径 ' + Math.round(NS.groundRadius(100, 30)) + ' km）',
        '日本の都道府県境界（国土数値情報を簡略化したデータ）',
        '全国 1,893 市区町村の境界：国土数値情報 行政区域データ（国土交通省, N03）を簡略化したもの。局所マップを拡大したときに、必要な都道府県の分だけを読み込んで表示する',
        'サブテーマ G-1〜G-8 とデジタルツイン DT-1〜DT-7 の対応',
        '月面：NASA 月周回衛星 LRO の実データ（LROC 広角カメラ全球モザイクと LOLA レーザー高度計の地形）。NASA/GSFC Scientific Visualization Studio「CGI Moon Kit」（SVS 4720, パブリックドメイン）から表側 ±105° を切り出し、リモート望遠鏡の月面描画に使っている',
        'メシエ天体（M42・M31・M45）：Digitized Sky Survey 2（DSS2）の実写。NASA/GSFC SkyView から IR・Red・Blue の 3 板を取得し、背景を平坦化して合成した。リモート望遠鏡のリアルタイム画面で、視野中心と画角にあわせて貼っている（DSS は Space Telescope Science Institute が米国政府交付金 NAG W-2166 により作成。原板はパロマー天文台オシュキン・シュミット望遠鏡と英国シュミット望遠鏡による）',
        '恒星 9,096 個の位置・等級・色指数：エール輝星星表 第5版（BSC5, Hoffleit & Warren 1991, CDS/VizieR V/50）',
        '星座線 752 本：IAU 公式星座図形（Stellarium「modern_iau」スカイカルチャー, CC BY-SA 4.0）',
        '天の川：Tycho-2 の V<11.5 星数密度（Hog et al. 2000, CDS I/259）を 1 度グリッドに集計したもの',
        '物理関係式：Brown et al. (2002) の Er–E 関係、AFTAC の周期–収量関係、Ono & Tonouchi (2014) の WBGT 推定式、Bortle (2001) の空の等級',
        '気象庁 ひまわり衛星画像（可視 B03・赤外 B13・水蒸気 B08・真彩色）と地上天気図：気象庁のサーバーから実データを取得して観測局マップに重ねている',
        '流星群の活動期間・極大日・極大時の太陽黄経・ZHR：IMO Meteor Shower Calendar / IMO Working List（主要 16 群）',
        '防災科学技術研究所（NIED）の公開観測網との対応：K-NET・KiK-net／Hi-net／F-net／S-net・DONET／J-RISQ／J-SHIS／V-net／クライシスレスポンス',
        '自然天体の発光スペクトルの連続光：約 5,000 K の黒体放射（プランクの式）。ウィーンの変位則により 580 nm 付近で極大となる',
        '発光スペクトルの線同定と相対強度：実際に取得された流星スペクトル（S. Abe et al. 2000 のしし座流星群スペクトルほか）の代表例に合わせて構成。回折格子は 600 本/mm を想定',
        'スペースデブリの分子（酸化物）バンド AlO・CN・TiO・FeO の同定、励起温度、発光開始→アブレーション→爆発→分裂→終端の推移：Watanabe, Abe, Arima & Hanayama (ACM 2026) による LM-3B 第2段の再突入分光観測',
        '線状降水帯の参照事象：2023 年 9 月 8 日に千葉県で発生し気象庁が「顕著な大雨に関する情報」を発表した事例'
      ].map(function (x) { return el('li', { text:x }); }))),
    panel('模擬データ（デモ用の作り物）', { note:'実際の観測結果ではない' },
      el('ul', { style:{ margin:0, paddingLeft:'1.2em', fontSize:'12.5px', color:'var(--ink2)' } }, [
        'すべてのイベント（火球・再突入・インフラサウンド・線状降水帯・地震応答）とその解析値',
        '発光スペクトルの波形そのもの（線同定は実測に基づくが、波形は合成）',
        '気象・夜空輝度・WBGT・雲量・稼働率などの観測値',
        '宇宙線の計数と Draco・特注ハウジングの観測条件（物理の関係式は実際のものだが、表示している値は模擬）',
        '全天カメラの映像（雲・流星・人工衛星の軌跡・空の明るさ）',
        '再突入予報の対象天体（NORAD 仮 ID 99xxx / COSPAR 2xxx-DEMO-x）',
        '通報ログ・連携自治体との実績',
        '経年トレンド・カタログ統計'
      ].map(function (x) { return el('li', { text:x }); })))
  ]));
  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('観測網の名称', null, NS.kv([
      ['正式名称（英）', 'Nihon University Sky Observation and Resilience Array（NU-SORA）'],
      ['和名', '日本大学 全学屋上観測網「ソラ」'],
      ['主幹', '理工学部（理工学研究所）・宇宙科学研究ユニット NU-SX'],
      ['局数', '14 局（大学キャンパス拠点 7・付属校拠点 7）'],
      ['近接基線', '船橋局 − 津田沼局 5.1 km。方位推定とカメラの相互較正に使う'],
      ['南北の広がり', '北端：<b>札幌局</b>（札幌日本大学高等学校・中学校）42.98°N<br>南端：<b>宮崎局</b>（宮崎日本大学高等学校・中学校）31.93°N'],
      ['局間の最大距離', NS.f(NS.dist(NS.ST.SPR.lat, NS.ST.SPR.lon, NS.ST.MYZ.lat, NS.ST.MYZ.lon), 0) + ' km']
    ], 'wide')),
    panel('参考資料・リンク', null, el('ul', { style:{ margin:0, paddingLeft:'1.2em', fontSize:'12.5px' } }, [
      ['NU-SX 公式サイト', 'https://aero.cst.nihon-u.ac.jp/nu-sx/'],
      ['Abe Space Science Lab（日本大学 理工学部 航空宇宙工学科）', 'https://aero.cst.nihon-u.ac.jp/abe-s/'],
      ['理工学部プレスリリース（NU-SX 設立）', 'https://www.cst.nihon-u.ac.jp/news/20260312_2211/'],
      ['日本大学 付属校一覧', 'https://www.nihon-u.ac.jp/affiliate_school/'],
      ['エール輝星星表 第5版（BSC5, CDS/VizieR V/50）', 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'],
      ['IAU 公式星座図形（Stellarium modern_iau, CC BY-SA 4.0）', 'https://github.com/Stellarium/stellarium/blob/master/skycultures/modern_iau/description.md'],
      ['Tycho-2 星表（Hog et al. 2000, CDS I/259）', 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/259'],
      ['SonotaCo Network Japan（UFOCapture）', 'https://sonotaco.jp/'],
      ['株式会社サヤ INF03（インフラサウンド）', 'https://www.saya-net.com/products/inf03.html'],
      ['Unihedron SQM-LU-DL（夜空輝度計）', 'https://unihedron.com/projects/sqm-lu-dl/'],
      ['高知工科大学 インフラサウンド研究室', 'https://www.kochi-tech.ac.jp/research/research_center/advanced_engineering/infrasound.html']
    ].map(function (x) {
      return el('li', null, [el('a', { href:x[1], target:'_blank', rel:'noopener', text:x[0] })]);
    })))
  ]));

  /* ---- 参考文献 ---- */
  var lnk = function (href, label) {
    return el('a', { href:href, target:'_blank', rel:'noopener', class:'doi', text:label });
  };
  var cite = function (authors, year, title, journal, links) {
    var kids = [el('b', { text:authors + ' ' }), '(' + year + '), ', el('i', { text:'“' + title + '”' })];
    if (journal) kids.push(', ' + journal);
    if (links && links.length) {
      kids.push(el('br'));
      links.forEach(function (l) { kids.push(lnk(l[1], l[0])); });
    }
    return el('span', null, kids);
  };
  var refTable = function (rows) { return NS.table(['文献', 'デモ内での対応'], rows, { class:'refs' }); };

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('参考文献 ― 流星・火球・スペースデブリ再突入',
    { note:'研究代表者らの主な先行研究。表題の下のリンクから原著にアクセスできる' }, refTable([
    [cite('Abe, S.', 2026, 'A calibrated dust-trail model of the Leonid meteoroid stream and forecasts of the 2031–2035 encounters', null,
      [['arXiv:2608.25456', 'https://arxiv.org/abs/2608.25456'], ['データ: Zenodo', 'https://zenodo.org/records/22084210']]),
     'しし座流星群のダストトレイルと地球軌道の交差から流星嵐を予報する。本観測網が検証対象とする「いつ・どこで・どれだけ流れるか」の理論側。DT-1（上空大気圏ツイン）の予報入力に対応する'],
    [cite('Abe, S., et al.', 2020, 'Sodium variation in Geminid meteoroids from (3200) Phaethon', 'Planetary and Space Science, 194, 105040',
      [['doi:10.1016/j.pss.2020.105040', 'https://doi.org/10.1016/j.pss.2020.105040']]),
     'ふたご座流星群の Na I 589 nm の強度変化から母天体（3200）Phaethon の熱進化を読む。「火球・隕石」画面の発光スペクトルで Na／Mg 比を組成の指標として扱う根拠（G-1）'],
    [cite('Abe, S., et al.', 2011, 'Near-Ultraviolet and Visible Spectroscopy of HAYABUSA Spacecraft Re-Entry', 'Publications of the Astronomical Society of Japan, 63, 1011–1021',
      [['doi:10.1093/pasj/63.5.1011', 'https://doi.org/10.1093/pasj/63.5.1011']]),
     '「はやぶさ」再突入の近紫外・可視分光。Fe I・Mg I・Al I・Cr I・Ni I・Cu I・Li I を同定し、人工物の材料組成を発光から読み出せることを実証した。「デブリ再突入」画面の分光（G-2）が直接引き継ぐ手法'],
    [cite('Abe, S.', 2009, 'Meteoroids and Meteors – Observations and Connection to Parent Bodies', 'Lecture Notes in Physics, 758, 129–166, Springer',
      [['doi:10.1007/978-3-540-76935-4_5', 'https://doi.org/10.1007/978-3-540-76935-4_5']]),
     '流星の観測手法（撮像・分光）と、軌道・密度・強度・組成から母天体へ遡る枠組みの総説。本デモ全体の観測設計と解析フローの土台'],
    [cite('Abe, S., et al.', 2000, 'First Results of High-Definition TV Spectroscopic Observations of the 1999 Leonid Meteor Shower', 'Earth, Moon, and Planets, 82–83, 369–377',
      [['doi:10.1023/A:1017055120356', 'https://doi.org/10.1023/A:1017055120356']]),
     '「火球・隕石」画面の自然天体スペクトルの線同定（Ca II・Mg I・Na I・Si II・O I・N I・N₂）と相対強度の基準'],
    [cite('阿部新助・柳澤正久・小野寺圭祐', 2024, 'ふたご座流星群の月面衝突閃光から探る活動小惑星 Phaethon の cm サイズ粒子', '日本惑星科学会誌 遊星人, 33 (3), 262–269',
      [['doi:10.14909/yuseijin.33.3_262', 'https://doi.org/10.14909/yuseijin.33.3_262'],
       ['J-STAGE', 'https://www.jstage.jst.go.jp/article/yuseijin/33/3/33_262/_article/-char/ja']]),
     '船橋局の「ガンダム望遠鏡」（口径 400 / 200 mm）による 2018 年ふたご座流星群の月面衝突閃光観測。約 3 時間で 11 個を検出し、メテオロイド質量 8–350 g・直径 1.7–5.9 cm・クレータ径 1–4 m を導いた。「リモート望遠鏡」画面の諸元と、船橋局の月面衝突閃光の解析はこの成果に基づく'],
    [cite('Watanabe, K., Abe, S., Arima, N. & Hanayama, H.', 2026, 'Spectroscopic Study of Rocket Debris during Atmospheric Re-entry', 'ACM 2026（Asteroids, Comets, Meteors 2026 発表）', null),
     'LM-3B 第2段の再突入分光（石垣島天文台・600 grooves/mm）。「デブリ再突入」画面の分子（酸化物）バンド AlO・CN・TiO と、発光開始→アブレーション→爆発→分裂→終端の局面推移はこの成果に基づく']
  ]))));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('参考文献 ― インフラサウンド・音響観測',
    { note:'高知工科大学 山本真行研究室らによる先行研究。本観測網のインフラサウンド系（G-4 / DT-4）の設計根拠' }, refTable([
    [cite('Yamamoto, M.-Y., Ishihara, Y., Hiramatsu, Y., Kitamura, K., Ueda, M., Shiba, Y., Furumoto, M. & Fujita, K.', 2011,
      'Detection of Acoustic/Infrasonic/Seismic Waves Generated by Hypersonic Re-Entry of the HAYABUSA Capsule and Fragmented Parts of the Spacecraft',
      'Publications of the Astronomical Society of Japan, 63, 971–978',
      [['doi:10.1093/pasj/63.5.971', 'https://doi.org/10.1093/pasj/63.5.971']]),
     '「はやぶさ」カプセルと分離破片の超音速再突入が生む音波・インフラサウンド・地震波を同時検出した先行例。本デモが火球・再突入について光学とインフラサウンドを同一局で同時に取ることの直接の根拠（G-1・G-2）'],
    [cite('Nishikawa, Y., Yamamoto, M.-Y., Sansom, E. K., Devillepoix, H. A. R., Towner, M. C., et al.', 2022,
      'Modeling of 3D trajectory of Hayabusa2 re-entry based on acoustic observations',
      'Publications of the Astronomical Society of Japan, 74, 308–317',
      [['doi:10.1093/pasj/psab126', 'https://doi.org/10.1093/pasj/psab126']]),
     '音響観測だけから再突入体の 3 次元軌跡を復元する。「インフラサウンド」画面の到達時刻差・到来方位の交会による音源定位と、光学が使えない条件での軌跡推定に対応する'],
    [cite('Nishikawa, Y., Yamamoto, M.-Y., Nakajima, K., Hamama, I., Saito, H., Kakinami, Y., Yamada, M. & Ho, T.-C.', 2022,
      'Observation and simulation of atmospheric gravity waves exciting subsequent tsunami along the coastline of Japan after Tonga explosion event',
      'Scientific Reports, 12, 22354',
      [['doi:10.1038/s41598-022-25854-3', 'https://doi.org/10.1038/s41598-022-25854-3']]),
     '2022 年フンガ・トンガ噴火のラム波・大気重力波が日本沿岸の「後続津波」を励起した過程を、高知工科大学のインフラサウンド観測網で捉えた。火山噴火・津波を音で捉える DT-4（音の大気ツイン）の中核となる先行研究'],
    [cite('Nishikawa, Y., Yamamoto, M.-Y., Yokota, A., Hasumi, Y. & Hamajima, G.', 2024,
      'Specification of INF01LE, INF03, and INF04LE infrasound sensors for the observation and detection of destructive geophysical events',
      'Discover Geoscience, 2, 82',
      [['doi:10.1007/s44288-024-00083-5', 'https://doi.org/10.1007/s44288-024-00083-5']]),
     '本観測網が全 14 局に 2 台ずつ搭載する <b>INF03</b> を含むセンサー群の性能評価。周波数帯・感度・耐環境性の仕様は本デモの機材構成（PF-1）が依拠する一次情報'],
    [cite('Fujita, K., Yamamoto, M.-Y., Abe, S., Ishihara, Y., Iiyama, O., Kakinami, Y., et al.', 2011,
      "An Overview of JAXA's Ground-Observation Activities for HAYABUSA Reentry",
      'Publications of the Astronomical Society of Japan, 63, 961–969',
      [['doi:10.1093/pasj/63.5.961', 'https://doi.org/10.1093/pasj/63.5.961']]),
     '光学・分光・インフラサウンド・地震・電離圏を一つの事象に同時投入した地上観測キャンペーンの全体像。単発の遠征として行われたこの体制を、14 局の常設網として恒常化するのが本観測網の構想である']
  ]))));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('参考文献 ― 電離圏・GNSS',
    { note:'全 14 局の 2 周波 GNSS が担う電離圏観測（G-5 / DT-5）の設計根拠' }, refTable([
    [cite('Kakinami, Y., Kamogawa, M., Tanioka, Y., Watanabe, S., Gusman, A. R., Liu, J.-Y., Watanabe, Y. & Mogi, T.', 2012,
      'Tsunamigenic ionospheric hole', 'Geophysical Research Letters, 39, L00G27',
      [['doi:10.1029/2011GL050159', 'https://doi.org/10.1029/2011GL050159']]),
     '津波が電離圏に「穴」（電子密度の減少）を開けることを発見した研究。海面変動が大気を通じて電離圏まで伝わることを示し、DT-5（電離圏ツイン）で津波起源の擾乱を検出する根拠になる'],
    [cite('Kakinami, Y., Kamogawa, M., Watanabe, S., Odaka, M., Mogi, T., Liu, J.-Y., Sun, Y.-Y. & Yamada, T.', 2013,
      'Ionospheric ripples excited by superimposed wave fronts associated with Rayleigh waves in the thermosphere',
      'Journal of Geophysical Research: Space Physics, 118, 905–911',
      [['doi:10.1002/jgra.50099', 'https://doi.org/10.1002/jgra.50099']]),
     '地震のレイリー波が熱圏で重なり合って電離圏にさざ波を立てる過程。地震・噴火起源の電離圏波動を読む手がかりであり、微動計（DT-6）と GNSS（DT-5）を同一局で持つことの意味を裏づける'],
    [cite('Kamogawa, M., Orihara, Y., Tsurudome, C., Tomida, Y., Kanaya, T., Ikeda, D., Gusman, A. R., Kakinami, Y., Liu, J.-Y. & Toyoda, A.', 2016,
      'A possible space-based tsunami early warning system using observations of the tsunami ionospheric hole',
      'Scientific Reports, 6, 37989',
      [['doi:10.1038/srep37989', 'https://doi.org/10.1038/srep37989']]),
     '電離圏ホールの観測を津波の早期警戒に使う構想。観測を警報へつなぐという点で、本デモの通報ワークフロー（G-7）と同じ発想であり、GNSS 側からの入力に対応する'],
    [cite('Kakinami, Y., Saito, H., Yamamoto, T., Chen, C.-H., Yamamoto, M.-Y., Nakajima, K., Liu, J.-Y. & Watanabe, S.', 2021,
      'Onset Altitudes of Co-Seismic Ionospheric Disturbances Determined by Multiple Distributions of GNSS TEC After the Foreshock of the 2011 Tohoku Earthquake on March 9, 2011',
      'Earth and Space Science, 8, e2020EA001217',
      [['doi:10.1029/2020EA001217', 'https://doi.org/10.1029/2020EA001217']]),
     'GNSS TEC の多点分布から擾乱の発生高度を決める手法。全 14 局の 2 周波 GNSS を GEONET と組み合わせて使う（G-5）ことの技術的な裏づけになる']
  ]))));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('関連する実装',
    { note:'NU-SX (Shinsuke Abe) が公開している、観測と理論を「動かして確かめる」ためのアプリ（いずれも無料・iPhone / iPad / Mac）' }, refTable([
    [el('span', null, [
      el('b', { text:'Meteorium（メテオリウム）' }), '　宇宙科学デジタルツイン アプリ', el('br'),
      el('span', { class:'refsub', text:'NU-SX (Shinsuke Abe) 2026　流星群のダストトレイルと流星嵐' }), el('br'),
      lnk('https://aero.cst.nihon-u.ac.jp/abe-s/2026/08/31/meteorium%ef%bc%88%e3%83%a1%e3%83%86%e3%82%aa%e3%83%aa%e3%82%a6%e3%83%a0%ef%bc%89/', '紹介記事'),
      lnk('https://apps.apple.com/jp/app/id6798546441', 'App Store')
    ]),
     '太陽系を俯瞰してダストトレイルと地球軌道の交差を見せ、そのまま地上視点に降りて流星雨の見え方を再現する。論文の計算結果をそのまま動かせる「宇宙科学デジタルツイン」の先行実装であり、本観測網の PF-2（デジタルツイン）・DT-7（学びのツイン）が目指す形を、観測データ側から補完する'],
    [el('span', null, [
      el('b', { text:'Astrarium（アストラリウム）' }), '　星空アプリ', el('br'),
      el('span', { class:'refsub', text:'NU-SX (Shinsuke Abe) 2026　その場の空の星座・天体を再現' }), el('br'),
      lnk('https://aero.cst.nihon-u.ac.jp/abe-s/2026/08/01/%e3%83%97%e3%83%a9%e3%83%8d%e3%82%bf%e3%83%aa%e3%82%a6%e3%83%a0%e3%82%a2%e3%83%97%e3%83%aa%e3%82%92%e3%80%80%e5%85%ac%e9%96%8b/', '紹介記事'),
      lnk('https://apps.apple.com/jp/app/id6795053748', 'App Store')
    ]),
     '観測地・日時を指定してその空に見える星座・天体を再現する。本デモの「全天カメラ」が用いているエール輝星星表（BSC5）・IAU 公式星座図形・Tycho-2 の天の川は、いずれもこのアプリのために整備されたデータをそのまま取り込んだもので、描画の考え方も共通する。付属校の生徒が自分の空と観測画像を見比べる導入として DT-7（学びのツイン）・G-8（探究）に接続する'],
    [el('span', null, [
      el('b', { text:'Cometarium（コメタリウム）' }), '　彗星ビューア', el('br'),
      el('span', { class:'refsub', text:'NU-SX (Shinsuke Abe) 2026　彗星の位置・光度・尾を物理モデルで描く' }), el('br'),
      lnk('https://apps.apple.com/jp/app/id6801072934', 'App Store')
    ]),
     '彗星が「いつ・どこに・どれだけ輝き・どんな尾を引くか」を、実測の軌道と物理モデルで描く。COBS（彗星観測データベース）の観測に光度式を当てはめ ±3σ 帯とともに示す手法は、本デモが火球の光度曲線とエネルギー推定の不確かさを併記する姿勢と同じである。恒星を B−V 色指数と実視等級で描く点、空の明るさを等/平方秒角で扱う点（G-3）も共通し、流星群の母天体である彗星の側から DT-1 を補完する']
  ]))));
};

})(NS);

/* =========================================================================
   線状降水帯セクション（気象・熱中症 画面に差し込む）
   気象センサー × インフラサウンド × 2周波GNSS の統合検知デモ
   ========================================================================= */
(function (NS) {
var el = NS.el, s = NS.s, panel = NS.panel, badge = NS.badge, kpi = NS.kpi;

/* 帯の軸から幅 w km の帯状ポリゴンを地図座標で作る */
function bandPath(M, axis, widthKm, shiftKm, shiftAz) {
  var a = axis.a, b = axis.b;
  var dx = (b.lon - a.lon) * 111.32 * Math.cos((a.lat + b.lat) / 2 * NS.d2r);
  var dy = (b.lat - a.lat) * 111.32;
  var L = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / L, ny = dx / L;                    /* 軸に直交する単位ベクトル（km） */
  var h = widthKm / 2;
  var sx = 0, sy = 0;
  if (shiftKm) { sx = shiftKm * Math.sin(shiftAz * NS.d2r); sy = shiftKm * Math.cos(shiftAz * NS.d2r); }
  var toLL = function (p, ox, oy) {
    return { lat:p.lat + (oy) / 111.32, lon:p.lon + (ox) / (111.32 * Math.cos(p.lat * NS.d2r)) };
  };
  var c = [toLL(a, nx * h + sx, ny * h + sy), toLL(b, nx * h + sx, ny * h + sy),
           toLL(b, -nx * h + sx, -ny * h + sy), toLL(a, -nx * h + sx, -ny * h + sy)];
  var d = '';
  c.forEach(function (p, i) { var xy = M.pt(p.lon, p.lat); d += (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1); });
  return d + 'Z';
}

NS.rainbandSection = function (go) {
  var rb = NS.rainband();
  var wrap = el('div', { class:'grid', style:{ gap:'14px', marginTop:'14px' } });
  var jst = function (dt) { return NS.fmtJST(rb.t + dt * 60000, { sec:false, timeOnly:true }); };

  /* ---- 見出し ---- */
  NS.add(wrap, panel('線状降水帯の統合検知　' + rb.name,
    { note:rb.id + ' · ' + NS.fmtJST(rb.t, { sec:false }) + ' JST 形成 · 継続 ' + Math.round(rb.durMin / 60 * 10) / 10 + ' 時間',
      tools:badge('気象センサー × インフラサウンド × GNSS', 'info') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'線状降水帯は、帯の直下でなければ雨量計に何も現れない。一方で、帯の中で連続する雷放電は 0.6–14 Hz のインフラサウンドとして 50–70 km 離れた局にも届く。観測局は帯の西 26–69 km にあり直接の大雨は受けていないが、5 局の到来方位を交会することで帯の位置・長さ・向き・移動を、雨量計より前に捉えられる。ここに 2 周波 GNSS の可降水量を重ねて、水蒸気の流入と併せて判定する。' }),
    el('div', { class:'grid g4' }, [
      kpi('先行時間', rb.leadMin, '分', 'インフラサウンドによる自動判定が外部の大雨情報に先行', { acc:true, icon:'〰' }),
      kpi('雷放電の検知', rb.strikesTotal.toLocaleString(), '回', 'ピーク ' + rb.strikesPeak + ' 回 / 10 分 · ' + rb.freq),
      kpi('帯の推定規模', rb.lengthKm + ' × ' + rb.axis.width, 'km', '方位交会による定位精度 ±' + NS.f(rb.locErr, 1) + ' km'),
      kpi('帯の移動', NS.f(rb.move.speed, 1), 'km/h', '方位 ' + rb.move.az + '°（' + NS.compass(rb.move.az) + 'へ）· 到来方位の時間変化から推定')
    ])
  ]));

  /* ---- 地図：帯・雷放電の定位点・到来方位 ---- */
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawStations({ state:function (st) { return NS.stationState(st, NS.now()); } });
  /* 帯（形成時 → 3 時間後） */
  M.addOverlay(s('path', { d:bandPath(M, rb.axis, rb.axis.width, 0, 0), fill:'var(--c-info)', 'fill-opacity':0.16,
    stroke:'var(--c-info)', 'stroke-width':1.3, 'vector-effect':'non-scaling-stroke' }));
  var shift = rb.move.speed * 3;
  M.addOverlay(s('path', { d:bandPath(M, rb.axis, rb.axis.width, shift, rb.move.az), fill:'none',
    stroke:'var(--c-info)', 'stroke-width':1.1, 'stroke-dasharray':'5 4', opacity:0.6, 'vector-effect':'non-scaling-stroke' }));
  M.fit([rb.axis.a, rb.axis.b, { lat:NS.ST.SNN.lat, lon:NS.ST.SNN.lon }, { lat:NS.ST.TCR.lat, lon:NS.ST.TCR.lon }], 0.30);
  /* 雷放電の定位点（時刻で色分け） */
  var tcol = NS.colorScale([[0.2, '#4585CC'], [2.4, '#C9A227'], [4.8, '#D6405F']]);
  var pr = M.px(1.9);
  rb.pts.forEach(function (p) {
    var xy = M.pt(p.lon, p.lat);
    M.addOverlay(s('circle', { cx:xy[0], cy:xy[1], r:pr, fill:tcol(p.h), 'fill-opacity':0.8 }));
  });
  /* 各局の到来方位 */
  rb.det.forEach(function (d) {
    var st = NS.ST[d.id], p0 = M.pt(st.lon, st.lat);
    var L = 1.06 * NS.dist(st.lat, st.lon, (rb.axis.a.lat + rb.axis.b.lat) / 2, (rb.axis.a.lon + rb.axis.b.lon) / 2);
    [-d.azSd, 0, d.azSd].forEach(function (da, k) {
      var az = (d.az + da) * NS.d2r;
      var lat2 = st.lat + L * Math.cos(az) / 111.32, lon2 = st.lon + L * Math.sin(az) / (111.32 * Math.cos(st.lat * NS.d2r));
      M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, { lat:lat2, lon:lon2 }, 12),
        stroke:'var(--c-infra)', 'stroke-width':k === 1 ? 1.5 : 0.7, 'stroke-dasharray':k === 1 ? null : '3 3',
        fill:'none', opacity:k === 1 ? 0.9 : 0.38, 'vector-effect':'non-scaling-stroke' }));
    });
  });
  /* 移動ベクトル */
  var mc = { lat:(rb.axis.a.lat + rb.axis.b.lat) / 2, lon:(rb.axis.a.lon + rb.axis.b.lon) / 2 };
  var mt = { lat:mc.lat + shift * Math.cos(rb.move.az * NS.d2r) / 111.32,
             lon:mc.lon + shift * Math.sin(rb.move.az * NS.d2r) / (111.32 * Math.cos(mc.lat * NS.d2r)) };
  var mp0 = M.pt(mc.lon, mc.lat), mp1 = M.pt(mt.lon, mt.lat);
  M.addOverlay(s('path', { d:'M' + mp0[0] + ' ' + mp0[1] + 'L' + mp1[0] + ' ' + mp1[1],
    stroke:'var(--accent)', 'stroke-width':2, fill:'none', 'vector-effect':'non-scaling-stroke' }));
  M.addOverlay(s('circle', { cx:mp1[0], cy:mp1[1], r:M.px(4), fill:'var(--accent)' }));

  var mapPanel = panel('帯の推定位置と雷放電の定位', {
    note:'緑の実線は各局のインフラサウンド到来方位（破線は方位のばらつき）。点は雷放電の推定位置で、色は発生時刻。青の破線は 3 時間後の帯の位置。市区町村の境界は国土数値情報 行政区域データ（国土交通省）による' }, []);
  var mb = mapPanel.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);
  NS.add(mb, el('div', { class:'maplegend' }, [
    el('span', { html:'<i style="background:var(--c-info);opacity:.45"></i>推定された帯（' + rb.lengthKm + ' × ' + rb.axis.width + ' km）' }),
    el('span', { html:'<i style="background:var(--c-infra)"></i>インフラサウンド到来方位' }),
    el('span', null, [el('i', { class:'gradbar', style:{ width:'96px', background:'linear-gradient(90deg,#4585CC,#C9A227,#D6405F)' } }), ' 雷放電 早い ← → 遅い']),
    el('span', { html:'<i style="background:var(--accent)"></i>帯の移動（' + rb.move.az + '° · ' + NS.f(rb.move.speed, 1) + ' km/h）' })
  ]));

  /* ---- 時系列 ---- */
  var xs = rb.series.map(function (p) { return p.hh; });
  var xf = function (v) { return NS.p2(Math.floor(v) % 24) + ':' + NS.p2(Math.round((v % 1) * 60)); };
  var rules = [
    { x:rb.t ? 4 + (12 + 20) / 60 : 0, color:'var(--c-infra)', dash:'3 3', label:'検知' },
    { x:4 + (54 + 20) / 60, color:'var(--accent)', dash:'3 3', label:'判定' },
    { x:4 + (88 + 20) / 60, color:'var(--c-warn)', dash:'3 3', label:'外部情報' }
  ];
  var chartPanel = panel('検知の時系列（10 分値）', { note:'雷放電はインフラサウンド、降水強度・気圧は気象センサー、可降水量は 2 周波 GNSS による' }, [
    NS.chart.bars({ bars:rb.series.map(function (p) {
        return { y:p.strikes, label:(p.min % 60 === 0 ? xf(p.hh) : ''), color:p.strikes >= 30 ? 'var(--c-infra)' : 'var(--muted)',
                 title:xf(p.hh) + '　' + p.strikes + ' 回 / 10 分' };
      }), width:660, height:150, margin:{ l:48, r:12, t:12, b:22 }, yLabel:'雷放電 回 / 10 分（全局合計）' }),
    NS.chart.line({ series:[
        { name:'降水強度', color:'var(--c-info)', pts:rb.series.map(function (p) { return [p.hh, p.rain]; }), area:true },
        { name:'可降水量 PWV', color:'var(--c-spec)', pts:rb.series.map(function (p) { return [p.hh, p.pwv]; }), dash:'4 3' }
      ], width:660, height:160, margin:{ l:48, r:12, t:12, b:24 }, xLabel:'JST', yLabel:'mm/h ・ PWV mm',
      xFmt:xf, yFmt:function (v) { return NS.f(v, 0); }, rules:rules.concat([{ y:55, color:'var(--c-spec)', dash:'2 3', label:'PWV 判定閾値 55 mm' }]) }),
    NS.chart.line({ series:[{ name:'気圧', color:'var(--c-warn)', pts:rb.series.map(function (p) { return [p.hh, p.press]; }) }],
      width:660, height:120, margin:{ l:48, r:12, t:10, b:24 }, xLabel:'JST', yLabel:'気圧 hPa', xFmt:xf, yFmt:function (v) { return NS.f(v, 0); } }),
    NS.chart.legend([['雷放電（インフラサウンド）', 'var(--c-infra)'], ['降水強度（雨量計）', 'var(--c-info)'],
                     ['可降水量（GNSS）', 'var(--c-spec)', 'line'], ['気圧', 'var(--c-warn)', 'line']]),
    el('div', { class:'note', text:'雷放電の急増（' + jst(12) + '）は、船橋局で 30 mm/h に達する（' + jst(150) + '）より 2 時間以上早い。帯の直下にない局でも、音と水蒸気で帯の発生を捉えられることがこの構成の要点である。' })
  ]);
  NS.add(wrap, el('div', { class:'grid g-3-2' }, [mapPanel, chartPanel]));

  /* ---- 局別・判定条件・経過 ---- */
  NS.add(wrap, el('div', { class:'grid g3' }, [
    panel('局別の検知状況', { note:'帯の軸からの距離順' },
      NS.table(['観測局', '帯まで', '雷検知', '到来方位', '6 h 雨量', '最大 1 h', 'PWV'],
        rb.det.map(function (d) {
          return { attrs:{ class:'clk', onclick:function () { go('station', d.id); } }, cells:[
            el('b', { text:NS.ST[d.id].name }),
            { class:'r', html:d.axisKm + ' km' },
            { class:'r', html:d.strikes.toLocaleString() },
            { class:'r mono', html:'<b>' + NS.f(d.az, 0) + '°</b> ±' + NS.f(d.azSd, 1) + '°' },
            { class:'r', html:NS.f(d.rain6h, 1) },
            { class:'r', html:NS.f(d.rainMax, 1) },
            { class:'r', html:d.pwv0 + '→' + d.pwvMax }
          ] };
        }))),
    panel('自動判定の条件', { note:'6 条件すべての成立で「線状降水帯の可能性」を発報' },
      NS.table(['指標', '閾値', '観測値', ''], rb.criteria.map(function (c) {
        return [{ class:'sm', html:c[0] }, { class:'sm', html:c[1] }, { html:'<b>' + c[2] + '</b>' },
          c[3] ? badge('成立', 'ok') : badge('不成立', 'dim')];
      }))),
    panel('降水と被害の想定', { note:'帯の直下（推定）' }, [
      NS.kv([
        ['最大 1 時間降水量', '<b>' + rb.rainPeak1h + ' mm/h</b>（' + rb.rainPeakPlace + '）'],
        ['帯の継続', NS.f(rb.durMin / 60, 1) + ' 時間'],
        ['最大瞬間風速', NS.f(rb.det[0].gust, 1) + ' m/s（船橋局）'],
        ['最低気圧', NS.f(rb.det[0].pressMin, 1) + ' hPa（' + NS.f(rb.det[0].pressDrop, 1) + ' hPa）'],
        ['通報先', '千葉県 山武市・東金市・茂原市／県東部の付属校 3 校'],
        ['学校の対応', '登校時間帯の変更、部活動の中止、屋外行事の延期']
      ], 'wide'),
      el('div', { class:'note', text:'帯の直下の降水量は、方位交会で求めた雷放電の密度と船橋局の実測から推定した値であり、レーダー観測の代替ではない。運用では気象庁レーダー・解析雨量と突き合わせて検証する。' })
    ])
  ]));

  NS.add(wrap, el('div', { class:'grid g-2-1' }, [
    panel('検知から通報までの経過', { note:'形成（' + NS.fmtJST(rb.t, { sec:false, timeOnly:true }) + ' JST）からの経過分' },
      el('ul', { class:'tl' }, rb.timeline.map(function (a) {
        var cls = a.kind === '通報' || a.kind === '判定' ? '' : a.kind === '実測' || a.kind === '衰弱' ? 'i-ok' : 'i-info';
        return el('li', { class:cls }, [
          el('div', { class:'tt', text:jst(a.dt) + ' JST（＋' + a.dt + ' 分）　' + a.src }),
          el('div', { class:'tx' }, [el('span', { class:'tg', text:a.kind }), a.text])
        ]);
      }))),
    panel('三つのセンサーの役割', { note:'同一局・同一時刻の観測を組み合わせる' }, [
      NS.table(['センサー', '捉えるもの', '特徴'], [
        ['インフラサウンド（0.1–1000 Hz）', '雷放電の音波と、帯内の対流に伴う気圧擾乱',
          '<span class="sm">帯の直下でなくても 50–70 km 先を検知。方位交会で位置・長さ・向き・移動が出る。<b>最も早い</b></span>'],
        ['2 周波 GNSS（可降水量）', '観測局上空の水蒸気総量（PWV）',
          '<span class="sm">降水が始まる前に水蒸気の流入が現れる。GEONET と同じ原理を学校屋上で実施</span>'],
        ['複合気象センサー', '雨量・気圧・風向風速・気温',
          '<span class="sm">最も確実だが、帯が到達してからでないと分からない。判定の確定と検証に使う</span>'],
        ['全天カメラ', '雲底の様子と発雷の閃光',
          '<span class="sm">夜間は発雷の光でインフラサウンドの検知を裏づけ、誤検知（工事音・爆発音）を排除できる</span>']
      ]),
      el('div', { class:'note', text:'インフラサウンドは火球の衝撃波（G-1）・火山噴火（G-4）と同じ装置・同じ波形処理を使う。一つのセンサー網が、宇宙起源の災害と気象災害の双方に効くことが本観測網の設計思想である。' })
    ])
  ]));

  NS.add(wrap, el('div', { class:'src', style:{ marginTop:'0' }, text:rb.ref }));
  return wrap;
};
})(NS);
