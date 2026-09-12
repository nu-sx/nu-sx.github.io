/* NU-SORA デモ / 画面：ダッシュボード・観測局マップ・観測局一覧・観測局詳細 */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, panel = NS.panel, badge = NS.badge;
NS.V = NS.V || {};

/* ---------- 集計ヘルパ ---------- */
NS.netSummary = function () {
  var t = NS.now(), ok = 0, warn = 0, down = 0, up = 0, night = 0, clear = 0, sqm = [], wbgt = [];
  NS.STATIONS.forEach(function (st) {
    var s2 = NS.stationState(st, t);
    if (s2.status === 'ok') ok++; else if (s2.status === 'warn') warn++; else down++;
    up += s2.uptime;
    if (s2.night) { night++; if (s2.weather.cloud < 0.35) clear++; }
    var sb = NS.skyBrightness(st, t);
    if (sb.mag != null) sqm.push(sb.mag);
    wbgt.push({ st:st, v:s2.weather.wbgt });
  });
  wbgt.sort(function (a, b) { return b.v - a.v; });
  var nominal = NS.STATIONS.reduce(function (a, b) { return a + b.sqm; }, 0) / NS.STATIONS.length;
  return { t:t, ok:ok, warn:warn, down:down, sqmNominal:nominal, uptime:up / NS.STATIONS.length, night:night, clear:clear,
    sqmMean:sqm.length ? sqm.reduce(function (a, b) { return a + b; }, 0) / sqm.length : null,
    sqmN:sqm.length, wbgtMax:wbgt[0], wbgt:wbgt,
    moon:NS.moonIllum(t), moonAge:NS.moonPhase(t) * 29.53 };
};
/* 今夜の検出見込み（局ごとの空の条件から） */
NS.tonightCount = function (at) {
  var t = at == null ? NS.now() : at, tot = 0, per = [];
  NS.STATIONS.forEach(function (st) {
    var r = NS.rng(st.id + '|cnt|' + NS.fmtJST(t, { dateOnly:true }));
    var sb = NS.skyBrightness(st, t);
    var base = 12 * Math.pow(10, 0.30 * (st.sqm - 19.0));      /* 暗い空ほど多い */
    var el2 = sb.mag == null ? 0 : (1 - Math.min(1, sb.w.cloud * 1.05)) * (1 - 0.30 * NS.moonIllum(t));
    var hoursIn = Math.max(0.25, Math.min(1, (-sb.w.sunAlt - 12) / 6));
    var n = Math.round(base * el2 * hoursIn * r.range(0.7, 1.3));
    per.push({ st:st, n:n, cloud:sb.w.cloud, sqm:sb.mag });
    tot += n;
  });
  return { total:tot, per:per };
};
NS.recentFireballs = function (days) {
  var t = NS.now(), lim = t - days * 86400e3;
  return NS.EVENTS.filter(function (e) { return e.t >= lim && e.kind === 'fireball'; });
};

/* ---------- 小部品 ---------- */
function kpi(label, value, unit, sub, opt) {
  opt = opt || {};
  return el('div', { class:'kpi' + (opt.acc ? ' acc' : '') + (opt.spark ? ' has-spark' : '') }, [
    el('div', { class:'kl' }, [opt.icon ? el('span', { text:opt.icon }) : null, label]),
    el('div', { class:'kv' }, [String(value), unit ? el('small', { text:unit }) : null]),
    sub ? el('div', { class:'ks', html:sub }) : null,
    opt.spark ? NS.chart.spark(opt.spark, { color:opt.sparkColor || 'var(--accent)' }) : null
  ]);
}
NS.kpi = kpi;
function evIcon(e) { return e.kind === 'fireball' ? '☄' : e.kind === 'reentry' ? '🛰' : e.kind === 'infrasound' ? '〰' : e.kind === 'seismic' ? '▤' : '✦'; }
NS.evIcon = evIcon;
function evRow(e, onClick, sel) {
  var right, sub;
  if (e.kind === 'fireball' || e.kind === 'meteor') { right = NS.mag(e.absMag); sub = e.stationsDet + ' 局'; }
  else if (e.kind === 'reentry') { right = NS.mag(e.absMag); sub = e.stationsDet + ' 局'; }
  else if (e.kind === 'infrasound') { right = NS.f(e.peakPa, 2) + ' Pa'; sub = e.det.length + ' 局'; }
  else { right = 'M' + (e.name.match(/M([\d.]+)/) || [, '—'])[1]; sub = e.det.length + ' 局'; }
  var r = el('div', { class:'evrow' + (sel === e.id ? ' on' : '') + (e.scenario ? ' scn' : ''), onclick:function () { onClick(e); }, role:'button', tabindex:'0' }, [
    el('div', { class:'ei', text:evIcon(e) }),
    el('div', null, [
      el('div', { class:'en' }, [e.name,
        e.scenario ? badge('想定シナリオ', 'warn') : (e.auto ? null : badge('解析済', 'info'))]),
      el('div', { class:'em', text:NS.fmtJST(e.t) + ' JST · ' + NS.ago(e.t) })
    ]),
    el('div', { class:'ev' }, [right, el('small', { text:sub })])
  ]);
  r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') onClick(e); });
  return r;
}
NS.evRow = evRow;

/* =========================================================================
   ダッシュボード
   ========================================================================= */
NS.V.dashboard = function (root, go) {
  var n = NS.netSummary(), tn = NS.tonightCount(NS.nextMidnight());
  var fb30 = NS.recentFireballs(14), fb7 = NS.recentFireballs(7);
  var infra24 = NS.INFRA.filter(function (e) { return e.t > NS.now() - 86400e3; });
  var lvl = fb30.some(function (e) { return e.absMag < -11 && e.t > NS.now() - 5 * 86400e3; }) ? '注意' : '平常';

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'総合ダッシュボード' }),
    el('p', { text:'全国 14 局の観測局から集約した「日本の空」の現況。火球・スペースデブリ再突入・インフラサウンド・気象・夜空輝度を 24 時間連続で監視する。' })
  ]));

  /* 状態バー */
  var statusPanel = panel('観測網の状態', { note:'GNSS 時刻同期・全局共通仕様' }, [
    el('div', { class:'split', style:{ marginBottom:'12px' } }, [
      el('span', { class:'lvl ' + lvl }, [el('span', { class:'dot' }), '警戒レベル：' + lvl]),
      el('div', { class:'spacer' }),
      badge('稼働 ' + n.ok + ' 局', 'ok'),
      n.warn ? badge('一部障害 ' + n.warn + ' 局', 'warn') : null,
      n.down ? badge('停止 ' + n.down + ' 局', 'crit') : null,
      badge('データ取得 正常', 'ok')
    ]),
    el('div', { class:'grid g4' }, [
      kpi('観測網 稼働率', NS.f(n.uptime, 2), '%', '直近 30 日平均', { acc:true,
        spark:Array.from({ length:24 }, function (_, i) { return 99.2 + NS.rng('up' + i)() * 0.8; }) }),
      kpi('夜間観測中', n.night, '/ 14 局', n.clear + ' 局が晴天（雲量 35% 未満）'),
      kpi('今夜の検出見込み', tn.total, '個', '深夜 1 時前後の空の条件による 14 局の延べ検出数の推定', { icon:'☄' }),
      kpi('月齢', NS.f(n.moonAge, 1), '', '輝面比 ' + Math.round(n.moon * 100) + '% ' + (n.moon > 0.6 ? '（観測条件やや不良）' : '（良好）'))
    ])
  ]);
  NS.add(root, statusPanel);

  /* KPI 行 */
  NS.add(root, el('div', { class:'grid g4', style:{ marginTop:'14px' } }, [
    kpi('火球（14 日）', fb30.length, '件', fb7.length + ' 件が直近 7 日 · 0 等より明るい事象',
      { icon:'☄', spark:Array.from({ length:30 }, function (_, i) { return NS.rng('fb' + i)() * 3; }), sparkColor:'var(--c-crit)' }),
    kpi('インフラサウンド事象（24 h）', infra24.length + 1842, '件', '内訳：雷 1,842 · 火山 1 · その他 ' + infra24.length,
      { icon:'〰', sparkColor:'var(--c-infra)' }),
    kpi('全国平均 夜空輝度', NS.f(n.sqmMean == null ? n.sqmNominal : n.sqmMean, 2), 'mag/arcsec²',
      n.sqmN ? n.sqmN + ' 局で夜間測定中' : '全局が薄明・昼間のため 14 局の平常値の平均を表示', { icon:'✦', sparkColor:'var(--c-sky)' }),
    kpi('最高 WBGT', NS.f(n.wbgtMax.v, 1), '℃', n.wbgtMax.st.name + ' · ' + NS.wbgtLevel(n.wbgtMax.v).label,
      { icon:'🌡', sparkColor:'var(--c-warn)' })
  ]));

  /* 地図 + イベント */
  var mapPanel, evPanel;
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawFov([30]);
  M.drawStations({ state:function (st) { return NS.stationState(st, NS.now()); },
    halo:function (st) {
      var sb = NS.skyBrightness(st, NS.now()), m = sb.mag == null ? st.sqm : sb.mag;
      return { r:6 + (22 - m) * 5, color:NS.SQM_SCALE(m), opacity:sb.mag == null ? 0.14 : 0.28 };
    },
    tipExtra:function (st, s2) {
      var sb = NS.skyBrightness(st, NS.now());
      return '状態：' + (s2.status === 'ok' ? '正常' : s2.status === 'warn' ? '一部障害' : '停止') +
        ' / ' + s2.obsMode + '<br>夜空輝度：' + (sb.mag == null ? '— （薄明・昼間）' : NS.f(sb.mag, 2) + ' mag/arcsec²') +
        '<br>雲量：' + Math.round(s2.weather.cloud * 100) + '% · 気温 ' + NS.f(s2.weather.temp, 1) + '℃';
    } });
  /* 直近火球の地上軌跡 */
  var fbShow = NS.FLAGSHIP.fireball;
  M.addOverlay(s('path', { d:NS.geoLinePath(fbShow.begin, fbShow.end), stroke:'var(--accent)', 'stroke-width':2.2,
    fill:'none', 'stroke-linecap':'round', opacity:0.9, 'vector-effect':'non-scaling-stroke' }));
  var ee = M.pt(fbShow.end.lon, fbShow.end.lat);
  M.addOverlay(s('circle', { cx:ee[0], cy:ee[1], r:M.px(4), fill:'var(--accent)' }));

  /* ---- 気象庁の衛星画像オーバーレイ ---- */
  var sat = NS.jmaSatLayer(M);
  var satStat = el('span', { class:'jma-stat' });
  M.onView = function () { sat.update(); };
  var satChips = el('div', { class:'chips' }, [{ key:null, name:'なし' }].concat(NS.JMA_BANDS).map(function (b) {
    var btn = el('button', { class:'chip', text:b.name, 'aria-pressed':b.key === null ? 'true' : 'false',
      title:b.desc || '衛星画像を重ねない', onclick:function () {
        Array.prototype.forEach.call(btn.parentNode.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        sat.setBand(b.key, function (msg) { satStat.textContent = msg; });
      } });
    return btn;
  }));
  var satOp = el('input', { type:'range', min:'15', max:'100', value:'62', class:'jma-op',
    title:'衛星画像の不透明度', oninput:function (e) { sat.setOpacity(e.target.value / 100); } });
  var satBar = el('div', { class:'mapbar jma-bar' }, [
    el('span', { class:'lbl', text:'気象庁 ひまわり' }), satChips,
    el('span', { class:'lbl', text:'濃さ' }), satOp,
    satStat, el('div', { class:'spacer' }),
    el('span', { class:'hint', text:'出典：気象庁。ON にしたときだけ気象庁のサーバーから取得する' })
  ]);

  mapPanel = panel('観測局配置と現況', { note:'ホイールで拡大・ドラッグで移動／局をクリックするとその局の全データ一覧へ（拡大すると市区町村の境界を表示）',
    tools:el('div', { class:'split' }, [NS.refreshTool(function () { NS.rerender(); }),
    el('div', { class:'seg' }, ['all', 'kanto', 'kyushu', 'tohoku'].map(function (k) {
      var b = el('button', { text:NS.VIEWS[k].name, 'aria-pressed':k === 'all' ? 'true' : 'false',
        onclick:function () {
          M.goto(k, true);
          Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
        } });
      return b;
    }))]) }, []);
  mapPanel.querySelector('.panel-b').classList.add('flush');
  mapPanel.querySelector('.panel-b').appendChild(satBar);
  mapPanel.querySelector('.panel-b').appendChild(M.node);
  mapPanel.querySelector('.panel-b').appendChild(el('div', { class:'maplegend' }, [
    el('span', { html:'<i style="background:var(--c-u)"></i>大学キャンパス拠点 7 局' }),
    el('span', { html:'<i style="background:var(--c-s);border-radius:50%"></i>付属校拠点 7 局' }),
    el('span', { html:'<i style="border:1px solid var(--accent);background:none"></i>視野円（高度 100 km を仰角 30° 以上、地表半径 ' + Math.round(NS.groundRadius(100, 30)) + ' km）' }),
    el('span', { html:'<i style="background:var(--accent)"></i>直近の火球の地上軌跡' })
  ]));

  var evPanelBody = el('div', { class:'evlist' });
  NS.EVENTS.slice(0, 9).forEach(function (e) {
    NS.add(evPanelBody, evRow(e, function (ev) { go(ev.kind === 'reentry' ? 'reentry' : 'fireball', ev.id); }));
  });
  evPanel = panel('直近の検出イベント', { note:'自動検出 → 多点解析',
    tools:el('button', { class:'iconbtn', text:'カタログ全件 →', onclick:function () { go('fireball'); } }) }, []);
  evPanel.querySelector('.panel-b').classList.add('flush');
  evPanel.querySelector('.panel-b').appendChild(evPanelBody);

  var alerts = NS.alertLog().slice(0, 7);
  var alertPanel = panel('通報・対応ログ', { note:'G-7 社会実装',
    tools:el('button', { class:'iconbtn', text:'すべて →', onclick:function () { go('alerts'); } }) },
    el('ul', { class:'tl' }, alerts.map(function (a) {
      var cls = a.lvl === '通報' || a.lvl === '注意喚起' ? '' : a.lvl === '検出' ? 'i-warn' : a.lvl === '対応' || a.lvl === '判定' ? 'i-ok' : 'i-info';
      return el('li', { class:cls }, [
        el('div', { class:'tt', text:NS.fmtJST(a.t) + ' JST' }),
        el('div', { class:'tx' }, [el('span', { class:'tg', text:a.lvl }), a.text])
      ]);
    })));

  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    mapPanel, el('div', { class:'grid', style:{ gap:'14px' } }, [evPanel, alertPanel])
  ]));

  /* ---- 気象庁 天気図（図法が地図と異なるため参照図として並べる） ---- */
  var chartImg = el('img', { class:'jma-chart', alt:'気象庁 天気図', hidden:'hidden' });
  var chartStat = el('div', { class:'hint', text:'「表示」を押すと気象庁から天気図を取得する' });
  var chartKind = { set:'near/now' };
  function loadChart() {
    chartStat.textContent = '気象庁から取得中…';
    NS.jmaWeatherMapList().then(function (d) {
      var parts = chartKind.set.split('/'), arr = (d[parts[0]] || {})[parts[1]] || [];
      if (!arr.length) { chartStat.textContent = '該当する天気図がありません'; return; }
      var file = arr[arr.length - 1], vt = NS.jmaChartTime(file);
      chartImg.src = NS.jmaWeatherMapUrl(file);
      chartImg.hidden = false;
      chartStat.innerHTML = (vt ? NS.fmtJST(vt, { sec:false }) + ' JST' : '') +
        '　<span class="hint">出典：気象庁</span>';
    })['catch'](function (e) { chartStat.textContent = '取得できませんでした（' + e.message + '）'; });
  }
  var chartSeg = el('div', { class:'seg' }, [['実況', 'near/now'], ['24 時間予想', 'near/ft24'],
    ['48 時間予想', 'near/ft48'], ['アジア実況', 'asia/now']].map(function (x) {
    return el('button', { text:x[0], 'aria-pressed':x[1] === chartKind.set ? 'true' : 'false', onclick:function (ev) {
      chartKind.set = x[1];
      Array.prototype.forEach.call(ev.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.target.setAttribute('aria-pressed', 'true');
      loadChart();
    } });
  }));
  var chartPanel = panel('気象庁 天気図', {
    note:'地上天気図。図法が観測局マップと異なるため重ねず、参照図として並べる',
    tools:el('div', { class:'split' }, [chartSeg,
      el('button', { class:'iconbtn', text:'表示', onclick:loadChart })]) },
    [chartStat, chartImg,
     el('div', { class:'src', text:'出典：気象庁（https://www.jma.go.jp/bosai/weather_map/）。画像は気象庁のサーバーから直接取得している。ひまわりの衛星画像（可視・赤外・水蒸気・真彩色）は Web メルカトルのタイルで配信されているため、上の観測局マップに直接重ねられる。' })]);

  var envPanel = panel('気象庁データの使いどころ', { note:'観測網の解析に取り込む公開データ' },
    NS.table(['データ', '用途', '対応'], [
      ['ひまわり 可視・赤外・水蒸気', '全天カメラの雲量判定の裏づけ、観測可能な局の見極め', 'G-3 / DT-2'],
      ['数値予報 GPV（MSM）', '暗黒飛行（ダークフライト）の風補正（地上 1.5 km 〜 30 km）', 'G-1 / DT-1'],
      ['高層気象観測（ラジオゾンデ）', '同（30 km 以上）、インフラサウンドの伝搬計算', 'G-1 / G-4'],
      ['解析雨量・レーダー', '線状降水帯の判定の検証', 'G-6 / DT-4'],
      ['噴火速報・降灰予報', 'インフラサウンドによる火山の定位結果との突き合わせ', 'G-4'],
      ['津波警報・検潮所の潮位', '電離圏 TEC からの津波規模推定の検証', 'G-5 / DT-5'],
      ['震源速報', '微動計による校舎判定の起動条件', 'G-6 / DT-6']
    ]));
  NS.add(root, el('div', { class:'grid g-1-2', style:{ marginTop:'14px' } }, [chartPanel, envPanel]));

  /* 局別カード */
  var cards = el('div', { class:'stgrid' }, NS.liveOrder().map(function (st) {
    var s2 = NS.stationState(st, NS.now()), sb = NS.skyBrightness(st, NS.now());
    return el('div', { class:'stcard ' + (s2.status === 'ok' ? '' : s2.status), onclick:function () { go('station', st.id); },
      role:'button', tabindex:'0' }, [
      el('div', { class:'sn' }, [st.name, el('span', { class:'sid', text:st.id })]),
      el('div', { class:'sr', text:st.pref + ' ' + st.city + '　' + (st.kind === 'u' ? '大学' : '付属校') + (st.swir ? ' · SWIR' : '') }),
      el('div', { class:'sv' }, [el('span', { text:s2.obsMode }), el('span', { text:NS.f(s2.uptime, 1) + '%' })]),
      el('div', { class:'sv' }, [
        el('span', { text:'SQM ' + (sb.mag == null ? '—' : NS.f(sb.mag, 2)) }),
        el('span', { text:'雲 ' + Math.round(s2.weather.cloud * 100) + '%' })
      ]),
      NS.bar(s2.uptime / 100, s2.status === 'ok' ? 'ok' : s2.status === 'warn' ? 'warn' : 'crit')
    ]);
  }));
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('観測局の稼働状況（14 局）',
    { note:'全局が同一のフル構成。カードをクリックするとその局の全データ一覧へ',
      tools:el('button', { class:'iconbtn', text:'観測局一覧 →', onclick:function () { go('stations'); } }) }, cards)));
};

/* =========================================================================
   観測局マップ（レイヤ切替）
   ========================================================================= */
NS.V.map = function (root, go, arg) {
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'観測局マップ' }),
    el('p', { text:'14 局の配置・視野・観測値を地図上で重ねて見る。視野円は高度 100 km の発光点を各仰角以上で見込める地表範囲を示し、円が重なる領域で多点同時観測（三角測量）が成立する。船橋局と津田沼局は 5.1 km しか離れていないが、これは短基線のインフラサウンドアレイとして方位推定の精度を上げ、全天カメラの相互較正にも使える。局のマーカーをクリックすると、その局の全データ一覧（全天カメラ・インフラサウンド・気象・夜空輝度・電波流星 FFT・GNSS・微動計）へ移動する。' })
  ]));
  var state = { layer:'status', elevs:{ 5:false, 10:false, 15:false, 20:false, 30:true, 45:false }, ev:null };
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });

  var LAYERS = {
    status:{ name:'稼働状態', legend:function () {
      return [el('span', { html:'<i style="background:var(--c-ok)"></i>正常' }), el('span', { html:'<i style="background:var(--c-warn)"></i>一部障害' }),
              el('span', { html:'<i style="background:var(--muted)"></i>停止' })]; } },
    sqm:{ name:'夜空輝度（光害）', legend:function () {
      return [el('span', null, [el('i', { class:'gradbar', style:{ background:'linear-gradient(90deg,#FFF1C9,#F08A3C,#B4562F,#5C4A8C,#2C3A82,#101A44)' } }),
        ' 明 17.5 ← mag/arcsec² → 22.0 暗']), el('span', { class:'hint', text:'昼間・薄明の局は灰色' })]; } },
    wbgt:{ name:'WBGT（熱中症）', legend:function () {
      return [el('span', null, [el('i', { class:'gradbar', style:{ background:'linear-gradient(90deg,#3B7EA1,#4FA07A,#D9B23C,#DE8330,#C43D2E,#8E1B2C)' } }),
        ' 18 ← ℃ → 35']), el('span', { html:'<i style="background:#C43D2E"></i>31℃ 以上＝危険' })]; } },
    cloud:{ name:'雲量', legend:function () {
      return [el('span', null, [el('i', { class:'gradbar', style:{ background:'linear-gradient(90deg,#2F6FA8,#8C97A3,#E8EAED)' } }), ' 快晴 ← → 曇天'])]; } },
    events:{ name:'イベント', legend:function () {
      return [el('span', { html:'<i style="background:var(--accent)"></i>火球の地上軌跡' }),
              el('span', { html:'<i style="background:var(--c-info)"></i>再突入の地上軌跡' }),
              el('span', { html:'<i style="background:var(--c-infra);border-radius:50%"></i>インフラサウンド音源' }),
              el('span', { html:'<i style="background:var(--c-crit);border-radius:50%"></i>隕石落下推定域' })]; } }
  };

  function paint() {
    var t = NS.now();
    M.drawFov(NS.ELEVS.filter(function (e) { return state.elevs[e]; }));
    M.clearOverlay();
    var opt = { state:function (st) { return NS.stationState(st, t); } };
    if (state.layer === 'sqm') {
      opt.halo = function (st) { var sb = NS.skyBrightness(st, t);
        return { r:17, color:sb.mag == null ? 'var(--muted)' : NS.SQM_SCALE(sb.mag), opacity:0.85 }; };
      opt.labelText = function (st) { var sb = NS.skyBrightness(st, t); return st.name + (sb.mag == null ? '' : ' ' + NS.f(sb.mag, 1)); };
    } else if (state.layer === 'wbgt') {
      opt.halo = function (st) { var w = NS.weather(st, t); return { r:17, color:NS.WBGT_SCALE(w.wbgt), opacity:0.85 }; };
      opt.labelText = function (st) { return st.name + ' ' + NS.f(NS.weather(st, t).wbgt, 1) + '℃'; };
    } else if (state.layer === 'cloud') {
      opt.halo = function (st) { var w = NS.weather(st, t); return { r:17, color:NS.CLOUD_SCALE(w.cloud), opacity:0.8 }; };
      opt.labelText = function (st) { return st.name + ' ' + Math.round(NS.weather(st, t).cloud * 100) + '%'; };
    }
    opt.tipExtra = function (st, s2) {
      var sb = NS.skyBrightness(st, t), w = s2.weather;
      return '夜空輝度 ' + (sb.mag == null ? '—' : NS.f(sb.mag, 2) + ' mag/arcsec² · Bortle ' + NS.bortle(sb.mag).n) +
        '<br>WBGT ' + NS.f(w.wbgt, 1) + '℃ · 雲量 ' + Math.round(w.cloud * 100) + '% · 気温 ' + NS.f(w.temp, 1) + '℃' +
        '<br>' + s2.obsMode;
    };
    M.drawStations(opt);

    if (state.layer === 'events') {
      var fb = NS.FLAGSHIP.fireball, re = NS.FLAGSHIP.reentry;
      [[fb, 'var(--accent)'], [re, 'var(--c-info)']].forEach(function (pr) {
        var e = pr[0];
        var p = M.addOverlay(s('path', { d:NS.geoLinePath(e.begin, e.end), stroke:pr[1], 'stroke-width':2.4, fill:'none',
          'stroke-linecap':'round', 'vector-effect':'non-scaling-stroke' }));
        M.tipOn(p, '<b>' + e.name + '</b><span class="mt-s">' + NS.fmtJST(e.t) + ' JST</span><span class="mt-d">' +
          NS.mag(e.absMag) + ' · ' + e.stationsDet + ' 局 · ' + NS.km(e.begin.alt) + ' → ' + NS.km(e.end.alt) + '</span>');
        var a = M.pt(e.begin.lon, e.begin.lat), b = M.pt(e.end.lon, e.end.lat);
        M.addOverlay(s('circle', { cx:a[0], cy:a[1], r:M.px(3.5), fill:'none', stroke:pr[1], 'stroke-width':1.4, 'vector-effect':'non-scaling-stroke' }));
        M.addOverlay(s('circle', { cx:b[0], cy:b[1], r:M.px(4), fill:pr[1] }));
        e.det.forEach(function (d) {
          var st = NS.ST[d.id]; if (!st) return;
          M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, e.end, 16), stroke:pr[1],
            'stroke-width':0.7, 'stroke-dasharray':'2 3', fill:'none', opacity:0.45, 'vector-effect':'non-scaling-stroke' }));
        });
      });
      /* 落下推定域 */
      var sw = fb.strewn, c = M.pt(sw.lon, sw.lat);
      var kx = Math.abs(M.pt(sw.lon + 0.1, sw.lat)[0] - c[0]) / (0.1 * 111.32 * Math.cos(sw.lat * NS.d2r));
      var ky = Math.abs(M.pt(sw.lon, sw.lat + 0.1)[1] - c[1]) / (0.1 * 111.32);
      var ell = M.addOverlay(s('ellipse', { cx:c[0], cy:c[1], rx:sw.a * kx, ry:sw.b * ky,
        transform:'rotate(' + (90 - sw.az) + ' ' + c[0] + ' ' + c[1] + ')',
        fill:'var(--c-crit)', 'fill-opacity':0.22, stroke:'var(--c-crit)', 'stroke-width':1.3, 'vector-effect':'non-scaling-stroke' }));
      M.tipOn(ell, '<b>隕石落下推定域（暗黒飛行（ダークフライト）の風補正後）</b><span class="mt-d">長半径 ' + sw.a + ' km / 短半径 ' + sw.b +
        ' km · 最大確率密度 ' + Math.round(sw.pMax * 100) + '%</span><span class="mt-x">千葉県山武市・東金市</span>');
      /* インフラサウンド音源 */
      NS.INFRA.forEach(function (e) {
        if (!e.src) return;
        var p2 = M.pt(e.src.lon, e.src.lat);
        var col = e.kind === 'seismic' ? 'var(--c-warn)' : 'var(--c-infra)';
        var g = M.addOverlay(s('g', null, [
          s('circle', { cx:p2[0], cy:p2[1], r:M.px(10), fill:col, 'fill-opacity':0.2, stroke:col, 'stroke-width':1.1, 'vector-effect':'non-scaling-stroke' }),
          s('circle', { cx:p2[0], cy:p2[1], r:M.px(3.4), fill:col })
        ]));
        M.tipOn(g, '<b>' + e.name + '</b><span class="mt-s">' + e.cls + ' · ' + NS.fmtJST(e.t) + ' JST</span>' +
          '<span class="mt-d">' + e.src.name + ' · ' + e.det.length + ' 局検出' + (e.locErr ? ' · 定位誤差 ±' + e.locErr + ' km' : '') + '</span>');
        e.det.forEach(function (d) {
          var st = NS.ST[d.id]; if (!st) return;
          M.addOverlay(s('path', { d:NS.geoLinePath({ lat:st.lat, lon:st.lon }, e.src, 16), stroke:col,
            'stroke-width':0.8, 'stroke-dasharray':'3 3', fill:'none', opacity:0.4, 'vector-effect':'non-scaling-stroke' }));
        });
      });
    }
    NS.clear(legend);
    NS.add(legend, LAYERS[state.layer].legend());
  }

  var bar = el('div', { class:'mapbar' }, [
    el('span', { class:'lbl', text:'レイヤ' }),
    el('div', { class:'chips' }, Object.keys(LAYERS).map(function (k) {
      var b = el('button', { class:'chip', text:LAYERS[k].name, 'aria-pressed':k === state.layer ? 'true' : 'false',
        onclick:function () {
          state.layer = k;
          Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true'); paint();
        } });
      return b;
    })),
    el('div', { class:'spacer' }),
    el('span', { class:'lbl', text:'視野（仰角）' }),
    el('div', { class:'chips' }, NS.ELEVS.map(function (e) {
      var b = el('button', { class:'chip', text:e + '°', 'aria-pressed':state.elevs[e] ? 'true' : 'false',
        title:'地表半径 ' + Math.round(NS.groundRadius(100, e)) + ' km',
        onclick:function () { state.elevs[e] = !state.elevs[e]; b.setAttribute('aria-pressed', state.elevs[e] ? 'true' : 'false'); paint(); } });
      return b;
    })),
    el('div', { class:'seg' }, Object.keys(NS.VIEWS).map(function (k) {
      return el('button', { text:NS.VIEWS[k].name, 'aria-pressed':k === 'all' ? 'true' : 'false', onclick:function (e) {
        M.goto(k, true);
        Array.prototype.forEach.call(e.target.parentNode.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        e.target.setAttribute('aria-pressed', 'true');
      } });
    }))
  ]);
  var legend = el('div', { class:'maplegend' });
  var refresh = NS.refreshTool(function () { paint(); });
  var p = panel('全国 14 局', { note:'高度 100 km 基準の視野円。局をクリックで全データ一覧へ。更新しても表示範囲とレイヤは保たれる',
    tools:refresh }, []);
  var body = p.querySelector('.panel-b'); body.classList.add('flush');
  NS.add(body, [bar, M.node, legend]);
  NS.add(root, p);
  paint();

  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('視野の重なりと多点観測', { note:'高度 100 km の発光点。基線の長さで役割が変わる' },
      [NS.table(['基線', '距離', '役割'], [
        ['局内のインフラサウンド対', '約 60 m', '1 局だけで音の到来方位を出す'],
        ['船橋局 − 津田沼局', '5.1 km', '短基線アレイとして方位推定を精密化。全天カメラの相互較正と検出効率の比較にも使う'],
        ['船橋局 − 桜上水局', '38 km', '首都圏での火球の三角測量'],
        ['桜上水局 − 郡山局', '215 km', '関東〜東北にまたがる大火球の測位'],
        ['札幌局 − 宮崎局', NS.f(NS.dist(NS.ST.SPR.lat, NS.ST.SPR.lon, NS.ST.MYZ.lat, NS.ST.MYZ.lon), 0) + ' km', '成層圏を経由した音波の伝搬と、全国規模の音源定位']
      ]),
      NS.table(['仰角', '地表半径', '想定される用途'], NS.ELEVS.map(function (e) {
        var r = NS.groundRadius(100, e);
        return [e + '°', NS.f(r, 0) + ' km', e >= 45 ? '高精度の測光・分光' : e >= 30 ? '軌跡決定の標準条件（設計基準）' :
          e >= 15 ? '検出は可能・測位精度は低下' : '大火球のみ・低仰角の減光が大きい'];
      }))]),
    panel('観測局の一覧', { note:'座標は概略位置', tools:el('button', { class:'iconbtn', text:'詳細一覧 →', onclick:function () { go('stations'); } }) },
      NS.table(['観測局', '所在地', '種別', '標高', '設置'], NS.STATIONS.map(function (st) {
        return { attrs:{ class:'clk', onclick:function () { go('station', st.id); } },
          cells:[el('b', { text:st.name }), st.pref + ' ' + st.city, st.kind === 'u' ? '大学キャンパス' : '付属校',
                 { class:'r', html:st.alt + ' m' }, { html:'<span class="sm">' + st.inst + '</span>' }] };
      })))
  ]));
};

/* =========================================================================
   観測局一覧
   ========================================================================= */
NS.V.stations = function (root, go) {
  var t = NS.now();
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'観測局と機材構成' }),
    el('p', { text:'全 14 局を同一のフル構成とする。同じ装置・同じ処理で観測することが、発生頻度の統計的推定と学部間の共同作業を成立させる前提になる。' })
  ]));
  NS.add(root, panel('全局共通のフル構成', { note:'機材調査資料 3.1–3.3 に基づく構成（1 局あたり約 300 万円）' },
    el('div', { class:'eqlist' }, NS.EQUIPMENT.map(function (e) {
      return el('div', { class:'eqrow' }, [
        el('span', { class:'ec', text:e.cat }),
        el('div', null, [
          el('div', { class:'en' }, [e.name, e.all ? null :
            el('span', { class:'badge info', title:e.at.map(function (i) { return NS.ST[i].name; }).join('・'),
              text:e.at.length + ' 局のみ' })]),
          el('div', { class:'ed', text:e.model }),
          el('div', { class:'et', text:e.spec })
        ]),
        el('div', { class:'et', style:{ maxWidth:'19em', textAlign:'right' }, text:e.target })
      ]);
    }))));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('観測局 一覧（14 局）',
    { note:'局をクリックすると、その局の全データ一覧（全センサーの実況と諸元）を開く' },
    NS.table(['観測局', 'ID', '所在地', '種別', '設置機関', '座標 / 標高', '状態', '稼働率'],
      NS.STATIONS.map(function (st) {
        var s2 = NS.stationState(st, t);
        return { attrs:{ class:'clk', onclick:function () { go('station', st.id); } }, cells:[
          el('b', { text:st.name }), { class:'mono sm', html:st.id },
          st.pref + ' ' + st.city,
          st.kind === 'u' ? '大学キャンパス拠点' : '付属校拠点',
          { html:'<span class="sm">' + st.host + (st.swir ? ' <b style="color:var(--accent)">＋SWIR</b>' : '') + '</span>' },
          { class:'mono sm', html:NS.f(st.lat, 3) + '°N ' + NS.f(st.lon, 3) + '°E<br>' + st.alt + ' m' },
          badge(s2.status === 'ok' ? '正常' : s2.status === 'warn' ? '一部障害' : '停止', s2.status === 'ok' ? 'ok' : s2.status === 'warn' ? 'warn' : 'crit'),
          { class:'r', html:NS.f(s2.uptime, 2) + '%' }
        ] };
      })))));

  /* 全局の全天カメラ（表示時刻を切り替えられる） */
  var skies = [], def = NS.defaultSkyTime();
  var grid = el('div', { class:'skygrid' }, NS.liveOrder().map(function (st) {
    var A = NS.AllSky(st, { size:260, showConst:false, showGrid:false });
    A.setTime(def.t, def.live);
    skies.push(A);
    var mode = el('span', { class:'hint' });
    A._mode = mode;
    return el('div', { class:'skycard', onclick:function () { go('station', st.id); } }, [
      A.node,
      el('div', { class:'sc-h' }, [el('b', { text:st.name }), mode])
    ]);
  }));
  function applySkyTime(t, live, label) {
    skies.forEach(function (A) {
      A.setTime(t, live);
      var s2 = NS.stationState(A.station, t);
      NS.clear(A._mode);
      NS.add(A._mode, live ? s2.obsMode : label + '（再現）');
    });
    NS.clear(skyNote);
    NS.add(skyNote, live
      ? '現在時刻の空。' + (def.live ? '' : '')
      : '現在は昼間・薄明のため、' + NS.fmtJST(t, { sec:false }) + ' JST の星空を再現して表示している。');
  }
  var skyNote = el('span', { class:'panel-note' });
  var TIMES = [['現在', null], ['今夜 20:00', 20], ['今夜 23:00', 23], ['今夜 02:00', 2], ['今夜 04:00', 4]];
  var seg = el('div', { class:'seg' }, TIMES.map(function (x) {
    var pressed = (x[1] === null) ? def.live : (!def.live && x[0] === def.label);
    return el('button', { text:x[0], 'aria-pressed':pressed ? 'true' : 'false', onclick:function (e) {
      Array.prototype.forEach.call(e.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      e.target.setAttribute('aria-pressed', 'true');
      if (x[1] === null) applySkyTime(NS.now(), true, '現在');
      else applySkyTime(NS.tonightAt(x[1]), false, x[0]);
    } });
  }));
  var p2 = panel('全天カメラ（全 14 局）',
    { note:'恒星はエール輝星星表（BSC5）9,096 個、天の川は Tycho-2 の星数密度。雲・流星・人工衛星の軌跡・空の明るさは模擬',
      tools:seg }, [el('div', { style:{ marginBottom:'8px' } }, skyNote), grid]);
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, p2));
  applySkyTime(def.t, def.live, def.label);
  skies.forEach(function (A) { A.start(); });
  NS.onLeave(function () { skies.forEach(function (A) { A.stop(); }); });

  /* ---- インフラサウンド 実況グラフ（全 14 局） ---- */
  var infState = { chans:['HF', 'MF', 'LF'], win:300 };
  var strips = [];
  var infGrid = el('div', { class:'infgrid' }, NS.liveOrder().map(function (st) {
    var S = NS.InfraStrip(st, { chans:infState.chans, win:infState.win, width:300 });
    strips.push(S);
    var s2 = NS.stationState(st, NS.now());
    var bad = s2.sub.filter(function (x) { return x.key === 'infra' && !x.ok; })[0];
    return el('div', { class:'infcard' + (bad ? ' bad' : ''), onclick:function () { go('station', st.id); },
      role:'button', tabindex:'0' }, [
      el('div', { class:'inf-h' }, [
        el('b', { text:st.name }), el('span', { class:'sid', text:st.id }),
        el('div', { class:'spacer' }),
        bad ? badge(bad.note, 'warn') : el('span', { class:'hint', text:'風 ' + NS.f(s2.weather.wind, 1) + ' m/s' })
      ]),
      S.node
    ]);
  }));
  function applyInf() {
    strips.forEach(function (S) { S.setChans(infState.chans); S.setWin(infState.win); });
  }
  var chChips = el('div', { class:'chips' }, NS.INFRA_CH.map(function (C) {
    var on = infState.chans.indexOf(C.key) >= 0;
    var b2 = el('button', { class:'chip chch', 'aria-pressed':on ? 'true' : 'false',
      style:{ '--bc':C.color }, title:C.name + '　' + C.band + '　' + C.unit,
      onclick:function () {
        var i = infState.chans.indexOf(C.key);
        if (i >= 0) { if (infState.chans.length === 1) return; infState.chans.splice(i, 1); }
        else infState.chans = NS.INFRA_CH.filter(function (x) {
          return x.key === C.key || infState.chans.indexOf(x.key) >= 0; }).map(function (x) { return x.key; });
        b2.setAttribute('aria-pressed', infState.chans.indexOf(C.key) >= 0 ? 'true' : 'false');
        applyInf();
      } }, [el('i', { class:'bdot', style:{ background:C.color } }), C.name,
            el('span', { class:'chband', text:C.band })]);
    return b2;
  }));
  var winSeg = el('div', { class:'seg' }, [['1 分', 60], ['5 分', 300], ['10 分', 600], ['30 分', 1800], ['1 時間', 3600]]
    .map(function (x) {
      return el('button', { text:x[0], 'aria-pressed':x[1] === infState.win ? 'true' : 'false', onclick:function (ev) {
        infState.win = x[1];
        Array.prototype.forEach.call(ev.target.parentNode.children, function (c2) { c2.setAttribute('aria-pressed', 'false'); });
        ev.target.setAttribute('aria-pressed', 'true');
        applyInf();
      } });
    }));
  var pInf = panel('インフラサウンド 実況グラフ（全 14 局）', {
    note:'複合型センサー（サヤ INF03 ／ 高知工科大学と共同開発の ADXII-INF01 系）の 6 チャンネル。0.5 秒ごとに更新',
    tools:el('div', { class:'split' }, [winSeg, NS.refreshTool(function () { applyInf(); })]) },
    [el('div', { class:'infbar' }, [el('span', { class:'lbl', text:'チャンネル' }), chChips]),
     infGrid,
     el('div', { class:'note', text:'HF（1–20 Hz）は雷放電・爆発音・近傍の人工雑音、MF（0.1–1 Hz）は海洋起源の脈動微気圧振動（マイクロバロム）と火球の衝撃波、LF（0.005–0.1 Hz）は大気重力波・津波・気圧変動を捉える帯域。X・Y・Z は 3 成分加速度で、常時微動から校舎の固有振動数を求め、地震後の使用可否判定（DT-6）に使う。' }),
     el('div', { class:'src', text:'表示の体裁は、一般財団法人 日本気象協会「インフラサウンド・モニタリング・ネットワーク」の実況グラフ（micos-sc.jwa.or.jp/infrasound-net/observed/）および高知工科大学インフラサウンド観測ネットワーク KISONS（geosci.mydns.jp/infrasound/graph.php）を参考にした。表示している波形はデモ用の模擬データであり、実観測ではない。' })]);
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, pInf));
  strips.forEach(function (S) { S.start(); });
  NS.onLeave(function () { strips.forEach(function (S) { S.stop(); }); });

  /* ---- 複合気象センサー（全 14 局） ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('複合気象センサー（全 14 局）',
    { note:'Vaisala WXT530 系。気温・湿度・気圧・風向風速・雨量・日射を 1 分値で取得し、WBGT を算出する',
      tools:NS.refreshTool(function () { NS.rerender(); }) },
    [el('div', { class:'sngrid' }, NS.sensorCards('met', go)),
     el('div', { class:'note', text:'地上 1.5 km 以下の風は暗黒飛行（ダークフライト）の風補正にそのまま使われる（G-1）。WBGT は屋上 1 点の値で、校庭内の分布は校舎 3D モデルでダウンスケーリングする（G-6 / DT-3）。' })])));

  /* ---- 夜空輝度計（全 14 局） ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('夜空輝度計（全 14 局）',
    { note:'Unihedron SQM-LU-DL ＋ 窓付き野外ハウジング。視野 FWHM 約 20°、天頂向き、IR カット',
      tools:NS.refreshTool(function () { NS.rerender(); }) },
    [el('div', { class:'sngrid' }, NS.sensorCards('sqm', go)),
     el('div', { class:'note', text:'昼間・薄明の局は平常値を表示している。全天カメラの恒星測光と相互較正し、人工光・月・雲・衛星コンステレーションの寄与を分離する（G-3 / DT-2）。' })])));

  /* ---- 電波流星受信機（HRO / FFT 画面） ---- */
  var hroState = { win:600 };
  var hros = [];
  var hroGrid = el('div', { class:'hrogrid' }, NS.liveOrder().map(function (st) {
    var F = NS.HroFft(st, { win:hroState.win });
    hros.push(F);
    F.render();
    var rate = Math.round(NS.hroRate(st, NS.now()));
    return el('div', { class:'hrocard', onclick:function () { go('station', st.id); }, role:'button', tabindex:'0' }, [
      el('div', { class:'hro-h' }, [el('b', { text:st.name }), el('span', { class:'sid', text:st.id }),
        el('div', { class:'spacer' }), el('span', { class:'hint', text:rate + ' echo/h' })]),
      F.node]);
  }));
  var hroSeg = el('div', { class:'seg' }, [['5 分', 300], ['10 分', 600], ['30 分', 1800], ['1 時間', 3600]].map(function (x) {
    return el('button', { text:x[0], 'aria-pressed':x[1] === hroState.win ? 'true' : 'false', onclick:function (ev) {
      hroState.win = x[1];
      Array.prototype.forEach.call(ev.target.parentNode.children, function (c2) { c2.setAttribute('aria-pressed', 'false'); });
      ev.target.setAttribute('aria-pressed', 'true');
      hros.forEach(function (F) { F.setWin(x[1]); });
    } });
  }));
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('電波流星受信機（全 14 局・FFT 画面）',
    { note:'HRO 方式：53.755 MHz の連続波ビーコンの前方散乱を受信。表示は HROFFT 形式のスペクトログラム（横軸 時刻／縦軸 ビーコンからの周波数差／色 強度）',
      tools:el('div', { class:'split' }, [hroSeg, NS.refreshTool(function () { hros.forEach(function (F) { F.render(); }); })]) },
    [hroGrid,
     el('div', { class:'hrolegend' }, [
       el('span', null, [el('i', { class:'gradbar', style:{ width:'120px', background:'linear-gradient(90deg,#040610,#0c1c5c,#0a6e96,#14a55a,#d2c828,#eb6e1e,#f53c3c,#fff6ee)' } }), ' 弱 ← 受信強度 → 強']),
       el('span', { html:'0 Hz の横線＝ビーコンの直接波' }),
       el('span', { html:'短い輝点＝過疎エコー（暗い流星）' }),
       el('span', { html:'太い横帯＝過密エコー（明るい流星）' }),
       el('span', { html:'立ち上がりの周波数降下＝ヘッドエコー' })]),
     el('div', { class:'note', text:'流星が残すプラズマ柱に電波が前方散乱され、見通し外の局にビーコンが届く。光学が使えない昼間・曇天・満月期でも流星数を数え続けられるため、全天カメラの検出効率の較正と、流星群の活動プロファイルの連続監視に使う。エコー継続時間は流星の明るさとおおむね対応する。' })])));
  NS.onLeave(function () { hros.forEach(function (F) { F.stop(); }); });
  hros.forEach(function (F) { F.start(); });

  /* ---- 2 周波 GNSS 受信機（全 14 局） ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('2 周波 GNSS 受信機（全 14 局）',
    { note:'測地級 2 周波受信機（L1/L2、PPS 出力）。全局の時刻同期と電離圏 TEC を担う',
      tools:NS.refreshTool(function () { NS.rerender(); }) },
    [el('div', { class:'sngrid' }, NS.sensorCards('gnss', go)),
     el('div', { class:'note', text:'PPS 出力は全局共通の時刻基準で、多点三角測量とインフラサウンドの到達時刻差はこの精度に支えられている（同期 < 1 ms）。L1/L2 の搬送波位相差から求める TEC は、電離圏擾乱の検出（G-5 / DT-5）と GNSS 気象学による可降水量の算出に使う。' })])));

  /* ---- 宇宙線計測器（全 14 局） ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('宇宙線計測器（全 14 局）',
    { note:'素粒子検出器（プラスチックシンチレータ）。シンチレータ 5×5×1 cm ＋ SiPM 型光センサー ＋ ESP32。1 分ごとの計数を常時記録',
      tools:NS.refreshTool(function () { NS.rerender(); }) },
    [el('div', { class:'sngrid' }, NS.sensorCards('cray', go)),
     el('div', { class:'note', text:'海面での計数は毎分 30 前後で、気圧が 1 hPa 上がるとおよそ 0.15 % 下がる（気圧効果）。'
       + 'この観測網は同じ局に気圧計を持っているので、計数をその場で気圧補正でき、残った変動を太陽活動や雷雲の寄与として読める。'
       + '1 台では統計が足りない変化も、14 局を足し合わせれば見えてくる。' })])));

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, NS.crSection(go)));
};

/* =========================================================================
   観測局 詳細
   ========================================================================= */
NS.V.station = function (root, go, arg) {
  var st = NS.ST[arg] || NS.STATIONS[0];
  var t = NS.now(), s2 = NS.stationState(st, t), sb = NS.skyBrightness(st, t), w = s2.weather;

  NS.add(root, el('div', { class:'page-h' }, [
    el('div', { class:'split' }, [
      el('button', { class:'iconbtn', text:'← 観測局一覧', onclick:function () { go('stations'); } }),
      el('div', { class:'seg' }, NS.STATIONS.map(function (x) {
        return el('button', { text:x.id, title:x.name, 'aria-pressed':x.id === st.id ? 'true' : 'false',
          onclick:function () { go('station', x.id); } });
      }))
    ]),
    el('h2', { text:st.name + '　' + st.en + ' Station　全データ一覧', style:{ marginTop:'8px' } }),
    el('p', { html:st.pref + ' ' + st.city + '　' + st.host + '　<span class="mono">' + NS.latlon(st.lat, st.lon) + ' · 標高 ' + st.alt + ' m</span>' }),
    el('div', { class:'chips', style:{ marginTop:'8px' } },
      [['全天カメラ', 'sky'], ['インフラサウンド', 'inf'], ['気象・WBGT', 'met'], ['夜空輝度', 'sqm'],
       ['電波流星 FFT', 'hro'], ['2 周波 GNSS', 'gnss'], ['微動計', 'seis'], ['機材・実績', 'eq']]
      .concat([['宇宙線', 'cray']])
      .concat(st.draco ? [['Draco 望遠鏡', 'draco']] : [])
      .concat(st.id === 'FNB' ? [['ガンダム望遠鏡', 'gundam']] : [])
      .map(function (x) {
        return el('button', { class:'chip', text:x[0], onclick:function () {
          var n = document.getElementById('sec-' + x[1]);
          if (n) n.scrollIntoView({ behavior:'smooth', block:'start' });
        } });
      }))
  ]));

  /* 疑似ライブ + 現況 */
  var A = NS.AllSky(st, { size:460, showNames:true });
  var defT = NS.defaultSkyTime();
  A.setTime(defT.t, defT.live);
  var skyNote2 = el('div', { class:'note' });
  function setSky(t, live, label) {
    A.setTime(t, live);
    NS.clear(skyNote2);
    NS.add(skyNote2, '恒星はエール輝星星表（BSC5）の 9,096 個、星座線は IAU 公式星座図形、天の川は Tycho-2 の星数密度を用い、地方恒星時から地平座標へ変換して描いている（等距離魚眼投影・北が上・東が左）。色は B−V 色指数による。'
      + (live ? '現在時刻の空を表示している。' : '現在は昼間・薄明のため、' + NS.fmtJST(t, { sec:false }) + ' JST の星空を再現して表示している。')
      + '雲・流星・人工衛星の軌跡・空の明るさはデモ用の模擬である。');
  }
  var TSEG = [['現在', null], ['今夜 20:00', 20], ['今夜 23:00', 23], ['今夜 02:00', 2], ['今夜 04:00', 4]];
  var tseg = el('div', { class:'seg' }, TSEG.map(function (x) {
    var pressed = (x[1] === null) ? defT.live : (!defT.live && x[0] === defT.label);
    return el('button', { text:x[0], 'aria-pressed':pressed ? 'true' : 'false', onclick:function (e) {
      Array.prototype.forEach.call(e.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      e.target.setAttribute('aria-pressed', 'true');
      if (x[1] === null) setSky(NS.now(), true, '現在'); else setSky(NS.tonightAt(x[1]), false, x[0]);
    } });
  }));
  var skyPanel = panel('全天カメラ', {
    note:'IMX664 全天カメラ ×2 · UFOCaptureIP',
    tools:el('div', { class:'split' }, [
      tseg,
      el('button', { class:'iconbtn', text:'星座線', onclick:function (e) { A.showConst = !A.showConst; e.target.style.opacity = A.showConst ? 1 : 0.5; A._bgKey = null; } }),
      el('button', { class:'iconbtn', text:'星名', onclick:function (e) { A.showNames = !A.showNames; e.target.style.opacity = A.showNames ? 1 : 0.5; A._bgKey = null; } }),
      el('button', { class:'iconbtn', text:'目盛', onclick:function (e) { A.showGrid = !A.showGrid; e.target.style.opacity = A.showGrid ? 1 : 0.5; } }),
      el('button', { class:'iconbtn', text:'早送り ×120', 'data-on':'0', onclick:function (e) {
        var on = e.target.getAttribute('data-on') === '1';
        e.target.setAttribute('data-on', on ? '0' : '1');
        e.target.textContent = on ? '早送り ×120' : '実時間に戻す';
        A.t0 = A.t; A.started = performance.now();
        A.speed = on ? 1 : 120;
      } })
    ])
  }, [A.node, skyNote2]);
  setSky(defT.t, defT.live, defT.label);
  A.start();
  NS.onLeave(function () { A.stop(); });

  var wl = NS.wbgtLevel(w.wbgt), bt = NS.bortle(sb.mag);
  var nowPanel = panel('現在の観測値', { note:NS.fmtJST(t) + ' JST 時点' }, [
    el('div', { class:'split', style:{ marginBottom:'10px' } }, [
      badge(s2.status === 'ok' ? '正常稼働' : s2.status === 'warn' ? '一部障害' : '停止', s2.status === 'ok' ? 'ok' : s2.status === 'warn' ? 'warn' : 'crit'),
      badge(s2.obsMode, 'info'), st.swir ? badge('SWIR 設置局', '') : null,
      el('div', { class:'spacer' }), el('span', { class:'hint', text:'稼働率 ' + NS.f(s2.uptime, 2) + '%' })
    ]),
    NS.kv([
      ['夜空輝度', sb.mag == null ? '<span class="hint">薄明・昼間のため測定なし</span>' :
        '<b>' + NS.f(sb.mag, 2) + '</b> mag/arcsec²　<span class="hint">Bortle ' + bt.n + '（' + bt.label + '）</span>', sb.mag == null ? '' : 'hi'],
      ['雲量', Math.round(w.cloud * 100) + ' %'],
      ['気温 / 湿度', NS.f(w.temp, 1) + ' ℃ / ' + NS.f(w.rh, 0) + ' %'],
      ['気圧', NS.f(w.press, 1) + ' hPa'],
      ['風', NS.f(w.wind, 1) + ' m/s　' + NS.compass(w.dir) + '（' + NS.f(w.dir, 0) + '°）'],
      ['日射', NS.f(w.solar, 3) + ' kW/m²'],
      ['降水', w.rain > 0 ? NS.f(w.rain, 1) + ' mm/h' : 'なし'],
      ['WBGT', '<b style="color:' + wl.color + '">' + NS.f(w.wbgt, 1) + ' ℃</b>　' + wl.label],
      ['太陽高度', NS.f(w.sunAlt, 1) + '°'],
      ['月', '月齢 ' + NS.f(NS.moonPhase(t) * 29.53, 1) + '　輝面比 ' + Math.round(NS.moonIllum(t) * 100) + '%'],
      ['伝送遅延', NS.f(s2.latency, 0) + ' ms'],
      ['一次保存', NS.f(s2.disk, 0) + ' % 使用']
    ], 'wide')
  ]);
  NS.add(root, el('div', { class:'grid g-3-2', id:'sec-sky' }, [skyPanel, nowPanel]));

  /* 24 時間の時系列 */
  var hrs = [], sqmPts = [], tempPts = [], wbgtPts = [], cloudPts = [];
  for (var i = -24 * 4; i <= 0; i++) {
    var tt = t + i * 900e3, hh = i / 4;
    var ww = NS.weather(st, tt), bb = NS.skyBrightness(st, tt);
    hrs.push(hh);
    tempPts.push([hh, ww.temp]); wbgtPts.push([hh, ww.wbgt]); cloudPts.push([hh, ww.cloud * 100]);
    if (bb.mag != null) sqmPts.push([hh, bb.mag]);
  }
  var xf = function (v) { return NS.fmtJST(t + v * 3600e3, { timeOnly:true, sec:false }); };
  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' }, id:'sec-met' }, [
    panel('夜空輝度の 24 時間推移', { note:'夜間（太陽高度 −12° 以下）のみ測定' },
      sqmPts.length > 3 ? [NS.chart.line({ series:[{ name:'SQM', color:'var(--c-sky)', pts:sqmPts, area:true, dots:0 }],
        width:660, height:180, yLabel:'mag/arcsec²（上ほど暗い）', xFmt:xf, yFmt:function (v) { return NS.f(v, 1); },
        rules:[{ y:21.9, color:'var(--muted)', label:'自然夜空 21.9' }, { y:st.sqm, color:'var(--accent)', label:'この局の平常値 ' + NS.f(st.sqm, 2) }] }),
        el('div', { class:'note', text:'この局の光害量は自然夜空に対して ' + NS.f(21.9 - st.sqm, 2) + ' 等分。雲は都市部では空を明るくし、暗い場所では暗くする。' })]
        : el('div', { class:'hint', text:'現在は昼間・薄明のため夜間データがない。日没後に再表示される。' })),
    panel('気温・WBGT・雲量の 24 時間推移', { note:'複合気象センサー（Vaisala WXT530 系）' }, [
      NS.chart.line({ series:[
        { name:'気温', color:'var(--c-warn)', pts:tempPts },
        { name:'WBGT', color:'var(--c-crit)', pts:wbgtPts, dash:'4 3' },
        { name:'雲量', color:'var(--muted)', pts:cloudPts.map(function (p) { return [p[0], p[1] / 5]; }), opacity:0.55, area:true, areaOpacity:0.10 }
      ], width:660, height:180, xFmt:xf, yLabel:'℃ / 雲量 ÷5 (%)',
        rules:[{ y:28, color:'var(--c-warn)', label:'WBGT 28 厳重警戒' }, { y:31, color:'var(--c-crit)', label:'31 危険' }] }),
      NS.chart.legend([['気温 (℃)', 'var(--c-warn)', 'line'], ['WBGT (℃)', 'var(--c-crit)', 'line'], ['雲量 (%÷5)', 'var(--muted)']])
    ])
  ]));

  /* ---- この局のインフラサウンド（6 チャンネル） ---- */
  var stInf = { chans:['HF', 'MF', 'LF', 'X', 'Y', 'Z'], win:300 };
  var S1 = NS.InfraStrip(st, { chans:stInf.chans, win:stInf.win, width:640, rowH:30 });
  var infSeg = el('div', { class:'seg' }, [['1 分', 60], ['5 分', 300], ['10 分', 600], ['30 分', 1800], ['1 時間', 3600]]
    .map(function (x) {
      return el('button', { text:x[0], 'aria-pressed':x[1] === stInf.win ? 'true' : 'false', onclick:function (ev) {
        stInf.win = x[1];
        Array.prototype.forEach.call(ev.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        ev.target.setAttribute('aria-pressed', 'true');
        S1.setWin(x[1]);
      } });
    }));
  var infStat = s2.sub.filter(function (x) { return x.key === 'infra'; })[0];
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' }, id:'sec-inf' }, [
    panel('インフラサウンド 実況グラフ', { note:'サヤ INF03 ×2（基線約 60 m）。0.5 秒ごとに更新', tools:infSeg },
      [S1.node, el('div', { class:'note', text:'HF は雷放電・爆発音・近傍の人工雑音、MF は海洋起源の脈動微気圧振動（マイクロバロム）と火球の衝撃波、LF は大気重力波・津波・気圧変動。X・Y・Z は 3 成分加速度で常時微動を記録する。窓が長く搬送波を解像できない帯域は ±包絡線の帯として描いている。' })]),
    panel('インフラサウンドの諸元', null, [
      NS.kv([
        ['機材', '株式会社サヤ INF03 × 2'],
        ['配置', 'ペア配置（基線 約 60 m）'],
        ['周波数帯', '0.1 – 1000 Hz'],
        ['測定範囲', '130 / 110 dB SPL 切替'],
        ['時刻同期', 'GNSS 同期ロガー（< 1 ms）'],
        ['単独局でできること', '到来方位の推定'],
        ['全国アレイでできること', '音源の定位・規模推定・成層圏風の逆推定'],
        ['状態', infStat && infStat.ok ? '正常' : (infStat ? infStat.note : '—')]
      ], 'wide'),
      el('button', { class:'iconbtn', style:{ marginTop:'8px' }, text:'全国アレイの解析を見る →',
        onclick:function () { go('infra'); } })
    ])
  ]));

  /* ---- この局の夜空輝度計 ---- */
  var sbNow = NS.skyBrightness(st, t), magNow = sbNow.mag == null ? st.sqm : sbNow.mag, btNow = NS.bortle(magNow);
  /* ---- この局の 2 周波 GNSS ---- */
  var gs = NS.gnssState(st, t), tecPts = [];
  for (var gi = -24; gi <= 0; gi++) tecPts.push([gi, NS.gnssState(st, t + gi * 3600e3).tec]);
  /* ---- この局の微動計 ---- */
  var seisR = NS.rng(st.id + '|seis');
  var f0 = 2.6 + seisR() * 1.9, pga = 0.6 + seisR() * 1.4;
  NS.add(root, el('div', { class:'grid g3', style:{ marginTop:'14px' } }, [
    el('div', { id:'sec-sqm' }, panel('夜空輝度計', { note:'Unihedron SQM-LU-DL ＋ 窓付き野外ハウジング' }, [
      el('div', { class:'big', style:{ color:NS.SQM_SCALE(magNow) } },
        NS.f(magNow, 2) + ' mag/arcsec²' + (sbNow.mag == null ? '（平常値）' : '')),
      NS.kv([
        ['Bortle 等級', btNow.n + '　' + btNow.label],
        ['この局の平常値', NS.f(st.sqm, 2) + ' mag/arcsec²'],
        ['光害量', NS.f(21.9 - st.sqm, 2) + ' 等（自然夜空 21.9 に対して）'],
        ['月の寄与', sbNow.mag == null ? '—' : NS.f(sbNow.moonEffect, 2) + ' 等'],
        ['雲の寄与', sbNow.mag == null ? '—' : NS.f(sbNow.cloudEffect, 2) + ' 等'],
        ['衛星の寄与', sbNow.mag == null ? '—' : NS.f(sbNow.satEffect, 3) + ' 等'],
        ['視野', 'FWHM 約 20°（天頂向き）'],
        ['サンプリング', '1 – 80 秒、IR カット']
      ], 'wide'),
      el('button', { class:'iconbtn', style:{ marginTop:'8px' }, text:'全国の夜空輝度マップ →', onclick:function () { go('skyglow'); } })
    ])),
    el('div', { id:'sec-gnss' }, panel('2 周波 GNSS 受信機', { note:'測地級 L1/L2、PPS 出力' }, [
      el('div', { class:'big' }, NS.f(gs.tec, 1) + ' TECU'),
      NS.chart.line({ series:[{ name:'TEC', color:'var(--c-info)', pts:tecPts, area:true }],
        width:300, height:110, margin:{ l:40, r:10, t:10, b:22 }, xLabel:'時間', yLabel:'TECU',
        xFmt:function (v) { return NS.f(v, 0) + 'h'; }, yFmt:function (v) { return NS.f(v, 0); } }),
      NS.kv([
        ['受信衛星', gs.n + ' 機（GPS ' + gs.sats.GPS + ' / QZSS ' + gs.sats.QZSS + ' / Galileo ' + gs.sats.Galileo + ' / GLONASS ' + gs.sats.GLONASS + '）'],
        ['PDOP', NS.f(gs.pdop, 2)],
        ['PPS 同期', (gs.ppsNs > 0 ? '+' : '') + NS.f(gs.ppsNs, 0) + ' ns'],
        ['取得間隔', gs.rate],
        ['用途', '全局の時刻同期／電離圏 TEC／GNSS 気象学（可降水量）']
      ], 'wide')
    ])),
    el('div', { id:'sec-seis' }, panel('微動計・そのほか', { note:'3 成分加速度計（常時微動）' }, [
      NS.kv([
        ['校舎 1 次固有振動数', '<b>' + NS.f(f0, 2) + ' Hz</b>（常時微動から同定）'],
        ['直近の最大加速度', NS.f(pga, 2) + ' gal'],
        ['判定', '継続使用可（低下 5 % 未満）'],
        ['サンプリング', '100 Hz・3 成分'],
        ['用途', '地震直後の校舎の使用可否判定（DT-6）'],
        ['電波流星受信機', 'HRO 53.755 MHz ＋ 3 素子八木　' + Math.round(NS.hroRate(st, t)) + ' echo/h'],
        ['4K 分光カメラ', 'Sony ZV-E10 ＋ 回折格子 600 lpm'],
        ['SWIR 冷却カメラ', st.swir ? 'ZWO ASI992MM Pro（設置局）'
          : NS.t('未設置（') + NS.swirStations().map(function (x) { return NS.t(x.name); }).join(NS.t('・'))
            + NS.t(' の ') + NS.swirStations().length + NS.t(' 局のみ）')],
        ['制御 PC', '8 コア 16 スレッド / 32 GB / NVMe 2 TB'],
        ['一次保存', NS.f(s2.disk, 0) + ' % 使用　伝送遅延 ' + NS.f(s2.latency, 0) + ' ms']
      ], 'wide')
    ]))
  ]));

  /* ---- この局の電波流星 FFT ---- */
  var stHro = { win:600 };
  var F1 = NS.HroFft(st, { win:stHro.win, width:640, height:150 });
  var hroSeg2 = el('div', { class:'seg' }, [['5 分', 300], ['10 分', 600], ['30 分', 1800], ['1 時間', 3600]].map(function (x) {
    return el('button', { text:x[0], 'aria-pressed':x[1] === stHro.win ? 'true' : 'false', onclick:function (ev) {
      stHro.win = x[1];
      Array.prototype.forEach.call(ev.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.target.setAttribute('aria-pressed', 'true');
      F1.setWin(x[1]);
    } });
  }));
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' }, id:'sec-hro' }, [
    panel('電波流星受信機（FFT 画面）', { note:'HRO 53.755 MHz の前方散乱。HROFFT 形式のスペクトログラム', tools:hroSeg2 },
      [F1.node, el('div', { class:'hrolegend' }, [
        el('span', null, [el('i', { class:'gradbar', style:{ width:'110px', background:'linear-gradient(90deg,#040610,#0c1c5c,#0a6e96,#14a55a,#d2c828,#eb6e1e,#f53c3c,#fff6ee)' } }), ' 弱 ← 受信強度 → 強']),
        el('span', { html:'0 Hz＝直接波' }), el('span', { html:'短い輝点＝過疎エコー' }),
        el('span', { html:'太い横帯＝過密エコー' }), el('span', { html:'周波数降下＝ヘッドエコー' })])]),
    panel('流星エコーの計数', null, [
      NS.kv([
        ['現在の発生率', '<b>' + Math.round(NS.hroRate(st, t)) + '</b> echo/h'],
        ['日周変化', '明け方（6 時ごろ）に極大、夕方に極小'],
        ['受信対象', '53.755 MHz 連続波ビーコンの前方散乱'],
        ['アンテナ', '3 素子八木'],
        ['光学との関係', '昼間・曇天・満月期でも計数できるため、全天カメラの検出効率の較正に使う'],
        ['エコー継続時間', '流星の明るさとおおむね対応（過疎エコー 0.1 秒未満／過密エコー 数秒〜数十秒）']
      ], 'wide')
    ])
  ]));
  S1.start(); F1.start();
  NS.onLeave(function () { S1.stop(); F1.stop(); });

  /* 機材状態 */
  var eq = NS.eqAt(st);
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' }, id:'sec-eq' }, [
    panel('搭載機材と稼働状態', { note:eq.length + ' 系統' },
      NS.table(['系統', '機材', '型式・仕様', '状態'], eq.map(function (e) {
        var sub = s2.sub.filter(function (x) { return x.key === e.key; })[0];
        return [{ class:'sm', html:e.cat }, el('b', { text:e.name }),
          { class:'sm', html:e.model + '<br><span class="hint">' + e.spec + '</span>' },
          sub && sub.ok ? badge('正常', 'ok') : badge(sub ? sub.note : '不明', 'warn')];
      }))),
    panel('この局の観測実績（デモ）', { note:'設置 ' + st.inst + ' 以降' }, [
      NS.kv([
        ['累積 流星検出', '<b>' + (12480 + NS.hash(st.id) % 6000).toLocaleString() + '</b> 個'],
        ['火球（0 等より明るい）', (68 + NS.hash(st.id + 'f') % 40) + ' 件'],
        ['多点同時観測に寄与', (41 + NS.hash(st.id + 'm') % 26) + ' 件'],
        ['インフラサウンド事象', (1240 + NS.hash(st.id + 'i') % 900).toLocaleString() + ' 件'],
        ['再突入の光学捕捉', (2 + NS.hash(st.id + 'r') % 5) + ' 件'],
        ['分光取得', (9 + NS.hash(st.id + 's') % 14) + ' 件'],
        ['生徒による検証件数', (320 + NS.hash(st.id + 'k') % 500).toLocaleString() + ' 件']
      ], 'wide'),
      el('div', { class:'note', text:'付属校拠点では、生徒が自動検出の誤検出（雲・虫・飛行機・人工衛星）を目視で検証する作業を探究学習として組み込む（G-8 / DT-7）。' })
    ])
  ]));

  /* 宇宙線計測器（全局） */
  if (NS.cosmicRay) {
    var cr = NS.cosmicRay(st, t), tge = NS.crTGE(st, t);
    var crPts = [];
    for (var ci = -180; ci <= 0; ci += 3) crPts.push([ci, NS.cosmicRay(st, t + ci * 60000).cpm]);
    NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' }, id:'sec-cray' }, [
      panel('宇宙線計測器', { note:'素粒子検出器（プラスチックシンチレータ）· シンチレータ 5×5×1 cm ＋ SiPM 型光センサー ＋ ESP32' }, [
        NS.chart.line({ series:[{ pts:crPts, color:'var(--c-spec)', width:1.2 }], width:660, height:200,
          xLabel:'現在からの分', yLabel:'計数 cpm', rules:[{ y:cr.mean, color:'var(--accent)', dash:'4 3', label:'期待値' }],
          xFmt:function (v) { return NS.f(v, 0); }, yFmt:function (v) { return NS.f(v, 0); } }),
        el('div', { class:'note', text:'計数はポアソン統計に従うため、1 分値は期待値のまわりに ±√N でばらつく。'
          + 'この装置で読みたいのは 1 分ごとの上下ではなく、長時間平均に残る数 % の変化である。' })
      ]),
      panel('計数と補正', { note:NS.f(cr.cpm, 1) + ' cpm（統計誤差 ± ' + NS.f(cr.sigma, 1) + '）' }, [
        NS.kv([
          ['1 分あたりの計数', '<b>' + NS.f(cr.cpm, 1) + '</b> cpm'],
          ['気圧補正後', '<b>' + NS.f(cr.corr, 1) + '</b> cpm'],
          ['現地気圧（同じ屋上の実測）', NS.f(cr.pSta, 1) + ' hPa（海面補正 ' + NS.f(cr.press, 1) + ' hPa）'],
          ['気圧効果：天気ぶん', NS.f(cr.baro, 2) + ' %（平年の現地気圧からのずれ。補正で取り除く）'],
          ['気圧効果：標高ぶん', '＋' + NS.f(cr.alt, 2) + ' %（標高 ' + st.alt + ' m。常に一定なので残す）'],
          ['地磁気の遮断能', NS.f(cr.rig, 2) + ' GV（北ほど低く、計数は上がる）'],
          ['太陽活動の寄与', NS.f(cr.solar.total * 100, 2) + ' %'],
          ['受光面積', '25 cm²（5 × 5 cm）']
        ], 'wide'),
        tge ? el('div', { class:'scnbanner', style:{ marginTop:'10px' } }, [
          el('b', { text:'雷雲ガンマ線（TGE）' }),
          el('span', { text:'平常比 ＋' + Math.round(tge.amp * 100) + ' %（' + tge.band + '・継続 ' + tge.dur + ' 分）。' + tge.note })
        ]) : el('div', { class:'note', text:'雷雲ガンマ線は検知していない。雨量 4 mm/h 以上かつ雲量 85 % 超のときに監視状態へ入る。' })
      ])
    ]));
  }

  /* 船橋局・郡山局：Draco スマート望遠鏡 */
  if (st.draco && NS.dracoSection) {
    NS.add(root, el('div', { class:'grid', style:{ gap:'14px', marginTop:'14px' }, id:'sec-draco' },
      NS.dracoSection(st, go)));
  }

  /* 船橋局のみ：月面衝突閃光観測専用望遠鏡「ガンダム望遠鏡」 */
  if (st.id === 'FNB' && NS.gundamSection) {
    NS.add(root, el('div', { class:'grid', style:{ gap:'14px', marginTop:'14px' }, id:'sec-gundam' },
      NS.gundamSection(go)));
  }

  /* この局が関わった主なイベント */
  var rel = NS.EVENTS.filter(function (e) {
    return (e.det && e.det.some(function (d) { return d.id === st.id; })) || (e.stationIds && e.stationIds.indexOf(st.id) >= 0);
  }).slice(0, 8);
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('この局が検出した主なイベント', null,
    rel.length ? NS.table(['日時 (JST)', 'イベント', '種別', '絶対等級', '同時観測'],
      rel.map(function (e) {
        return { attrs:{ class:'clk', onclick:function () { go(e.kind === 'reentry' ? 'reentry' : 'fireball', e.id); } },
          cells:[{ class:'mono sm', html:NS.fmtJST(e.t) }, e.name, e.kind === 'fireball' ? '火球' : e.kind === 'reentry' ? '再突入' : '流星',
                 { class:'r', html:NS.mag(e.absMag) }, { class:'r', html:e.stationsDet + ' 局' }] };
      })) : el('div', { class:'hint', text:'該当なし' }))));
};

})(NS);
