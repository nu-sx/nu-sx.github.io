/* NU-SORA デモ / 画面：地震・津波（全センサー統合／デジタルツイン処理） */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, panel = NS.panel, badge = NS.badge, kpi = NS.kpi;

/* 海底 → 地殻 → 大気 → 電離圏 の結合を、どのセンサーがどの層を見ているかとして描く */
function couplingDiagram(ts) {
  var W = 1000, H = 330, m = { l:96, r:150, t:26, b:34 };
  var iw = W - m.l - m.r, ih = H - m.t - m.b;
  var g = s('svg', { viewBox:'0 0 ' + W + ' ' + H, class:'chart twin', role:'img',
    'aria-label':'海底から電離圏までの結合と、各層を観測するセンサー' });
  var LAYERS = [
    { name:'電離圏', sub:'高度 250–350 km', color:'#7C6FD0', h:0.22,
      sensors:['2 周波 GNSS（TEC）'], obs:['音波共振 4.4 / 3.6 mHz（+8 分）', '津波性電離圏ホール −1.85 TECU（+19 分）'] },
    { name:'中間圏・成層圏', sub:'高度 20–100 km', color:'#4585CC', h:0.20,
      sensors:['全天カメラ', 'インフラサウンド（成層圏反射波）'], obs:['大気光の擾乱（夜間）', '成層圏を経由した音波の到達'] },
    { name:'対流圏', sub:'地表 – 高度 20 km', color:'#3FA07A', h:0.22,
      sensors:['インフラサウンド（LF 0.005–0.1 Hz）', '複合気象センサー（気圧）'], obs:['大気重力波・ラム波（+13 分）', '気圧変動'] },
    { name:'地殻・校舎', sub:'地表', color:'#C9A227', h:0.18,
      sensors:['微動計（3 成分加速度）'], obs:['P 波・S 波の到達', '校舎の固有振動数の変化'] },
    { name:'海底・海面', sub:'震源', color:'#D6405F', h:0.18,
      sensors:['（本観測網では直接観測しない）'], obs:['断層すべり → 海面変動 → 津波'] }
  ];
  var y = m.t;
  LAYERS.forEach(function (L) {
    var hh = ih * L.h;
    NS.add(g, s('rect', { x:m.l, y:y, width:iw, height:hh - 3, rx:3, fill:L.color, 'fill-opacity':0.11,
      stroke:L.color, 'stroke-opacity':0.45, 'stroke-width':1 }));
    NS.add(g, s('text', { x:m.l - 8, y:y + hh / 2 - 4, 'text-anchor':'end',
      style:'font-size:12px;font-weight:700', fill:L.color, text:L.name }));
    NS.add(g, s('text', { x:m.l - 8, y:y + hh / 2 + 9, 'text-anchor':'end', class:'axl', text:L.sub }));
    L.sensors.forEach(function (sn, i) {
      NS.add(g, s('text', { x:m.l + 10, y:y + 15 + i * 13, style:'font-size:10.5px;font-weight:700',
        fill:'var(--ink)', text:'▸ ' + sn }));
    });
    L.obs.forEach(function (o, i) {
      NS.add(g, s('text', { x:m.l + iw * 0.44, y:y + 15 + i * 13, class:'axl', fill:'var(--ink2)', text:o }));
    });
    y += hh;
  });
  /* 下から上へ伝わる矢印 */
  var ax = m.l + iw + 26;
  NS.add(g, s('path', { d:'M' + ax + ' ' + (m.t + ih - 6) + 'L' + ax + ' ' + (m.t + 10) +
    ' m-5 8 l5 -8 l5 8', stroke:'var(--accent)', 'stroke-width':1.8, fill:'none' }));
  ['+19 分 電離圏ホール', '+13 分 大気重力波', '+8 分 TEC 共振', '0 分 地震'].forEach(function (tx, i) {
    NS.add(g, s('text', { x:ax + 9, y:m.t + 16 + i * (ih / 4.3), class:'axl', fill:'var(--ink2)', text:tx }));
  });
  NS.add(g, s('text', { x:ax - 4, y:m.t + 6, class:'axl', 'text-anchor':'end', fill:'var(--accent)', text:'伝搬' }));
  NS.add(g, s('text', { x:m.l + 10, y:H - 12, class:'axl', text:'観測するセンサー' }));
  NS.add(g, s('text', { x:m.l + iw * 0.44, y:H - 12, class:'axl', text:'この事象で捉えたもの' }));
  return g;
}


/* 観測 → 特徴量 → サロゲートモデル → 配信 のパイプライン図 */
function surrogatePipeline() {
  var W = 1000, H = 168;
  var g = s('svg', { viewBox:'0 0 ' + W + ' ' + H, class:'chart', role:'img',
    'aria-label':'観測からサロゲートモデルを経て配信に至るパイプライン' });
  var STAGES = [
    { name:'観測', lines:['微動計 100 Hz', 'GNSS TEC 30 s', 'インフラサウンド', '気圧 1 min'], c:'#C9A227' },
    { name:'特徴量抽出', lines:['P 波初動振幅', 'TEC 減少率・共振振幅', '大気重力波の振幅', '到達時刻差'], c:'#3FA07A' },
    { name:'サロゲートモデル', lines:['事前学習済みの代理モデル', '入力 24 次元 → 出力 6 次元', '推論 12 ms', '不確かさも同時に出力'], c:'#D6405F' },
    { name:'判定・整形', lines:['閾値とフェイルセーフ', '気象庁情報との突き合わせ', '文面の自動生成', '配信先の選択'], c:'#4585CC' },
    { name:'配信', lines:['Web ポータル', 'スマートフォン通知', 'SNS（人の確認後）', '自治体 API・学校端末'], c:'#7C6FD0' }
  ];
  var bw = W / STAGES.length;
  STAGES.forEach(function (st, i) {
    var x = i * bw + 5, iw = bw - 26;
    NS.add(g, s('rect', { x:x, y:24, width:iw, height:H - 48, rx:5, fill:st.c, 'fill-opacity':0.10,
      stroke:st.c, 'stroke-opacity':0.55, 'stroke-width':1.2 }));
    NS.add(g, s('text', { x:x + 11, y:16, style:'font-size:12px;font-weight:700', fill:st.c, text:st.name }));
    st.lines.forEach(function (l, k) {
      NS.add(g, s('text', { x:x + 11, y:45 + k * 15, class:'axl', fill:'var(--ink2)', text:l }));
    });
    if (i < STAGES.length - 1) {
      var ax = x + iw + 4;
      NS.add(g, s('path', { d:'M' + ax + ' ' + (H / 2) + ' l11 0 m-5 -5 l5 5 l-5 5',
        stroke:'var(--muted)', 'stroke-width':1.5, fill:'none' }));
    }
  });
  return g;
}

/* 配信文面の自動生成（チャネルごとに長さと体裁を変える） */
function draftFor(ch, ts) {
  var when = NS.fmtJST(ts.t, { sec:false });
  var wave = NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1) + ' m';
  var head = 'NU-SORA 津波規模の独立推定';
  if (ch === 'push') {
    return { title:'【NU-SORA】津波規模の推定値',
      body:'推定沿岸波高 ' + wave + '（' + ts.quake.name + ' M' + ts.quake.mw + '）。'
        + '気象庁の津波警報が優先します。詳細はポータルへ。',
      meta:'スマートフォン通知（全角 70 字以内）' };
  }
  if (ch === 'sns') {
    return { title:'SNS 下書き（投稿前に人が確認）',
      body:'【' + head + '】' + when + ' の' + ts.quake.name + '（M' + ts.quake.mw + '）について、'
        + '電離圏 TEC の減少率と大気重力波から沿岸波高を ' + wave + ' と推定しました。'
        + '気象庁の津波警報・注意報が優先します。避難は警報に従ってください。'
        + '推定の根拠 → https://example.nu-sora/ts/' + ts.id + ' #NUSORA #津波',
      meta:'SNS（140 字程度・自動投稿はせず下書きのみ生成）' };
  }
  if (ch === 'api') {
    return { title:'自治体向け API（JSON）', json:{
      schema:'nu-sora/alert/v1', id:ts.id, kind:'tsunami_scale_estimate',
      issued_utc:new Date(ts.t + 28 * 60000).toISOString(),
      source_event:{ name:ts.quake.name, mw:ts.quake.mw, depth_km:ts.quake.depth,
        lat:ts.quake.lat, lon:ts.quake.lon, origin_utc:new Date(ts.t).toISOString() },
      estimate:{ coastal_wave_height_m:ts.estWave, uncertainty_m:ts.estErr,
        method:'surrogate model on ionospheric TEC depletion and atmospheric gravity waves',
        inference_ms:12, latency_min:28 },
      observations:{ gnss_tec_stations:5, infrasound_stations:2, seismometer_stations:13,
        tec_depletion_tecu:ts.holeMax, tec_rate_tecu_per_min:ts.holeRate },
      priority_notice:'JMA tsunami warning takes precedence over this estimate.',
      distribution:['sip4d', 'municipal_portal', 'school_terminal'] },
      meta:'SIP4D への流し込みを想定した JSON' };
  }
  return { title:'Web ポータル（全文）',
    body:'■ ' + head + '\n'
      + '発生：' + when + ' JST　' + ts.quake.name + '　M' + ts.quake.mw + '　深さ ' + ts.quake.depth + ' km\n'
      + '推定沿岸波高：' + wave + '（地震発生から 28 分後に確定）\n\n'
      + '■ 根拠\n'
      + '・電離圏 TEC の減少：' + NS.f(ts.holeMax, 2) + ' TECU（減少率 ' + NS.f(ts.holeRate, 2) + ' TECU/分）を 5 局の 2 周波 GNSS で観測\n'
      + '・大気重力波：0.8–4 mHz 帯の気圧変動を 2 局のインフラサウンドで観測\n'
      + '・微動計：全 14 局で P 波を検知、校舎の固有振動数に有意な変化なし\n'
      + '・これらを入力としたサロゲートモデルの推論結果（推論時間 12 ms）\n\n'
      + '■ 注意\n'
      + '・本推定は気象庁の津波警報・注意報を置き換えるものではありません。避難は警報に従ってください。\n'
      + '・本推定は警報の後に「どれくらいの規模か」を独立に見積もり、避難の継続判断を補うためのものです。\n'
      + '・推定には ±' + NS.f(ts.estErr, 1) + ' m の不確かさがあります。',
    meta:'Web ポータル（全文・根拠と注意を必ず併記）' };
}

NS.V.quake = function (root, go, arg) {
  var ts = NS.tsunami(), q = ts.quake, t = NS.now();
  var seis = NS.EVMAP['NUS-IS-Q-0106'];

  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'地震・津波　全センサーの統合とデジタルツイン' }),
    el('p', { text:'海底の変動は、地殻を揺らし、大気に音波と重力波を放ち、電離圏の電子密度を変える。本観測網は微動計・インフラサウンド・気象センサー・2 周波 GNSS を同一地点に揃えているため、この一連の結合を一つの局で追える。地震そのものは気象庁と防災科研の観測網が担うので、本観測網は「その後に大気と電離圏で何が起きたか」を受け持つ（サブテーマ G-4・G-5・G-6 / DT-4・DT-5・DT-6）。' })
  ]));

  NS.add(root, el('div', { class:'grid g4' }, [
    kpi('直近の地震', 'M' + q.mw, '', q.name + '　深さ ' + q.depth + ' km', { acc:true, icon:'▤' }),
    kpi('電離圏の応答', '+8', '分', 'TEC に音波共振（' + ts.resFreq.join(' / ') + ' mHz）'),
    kpi('推定沿岸波高', NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1), 'm', '実測 ' + NS.f(ts.obsWave, 1) + ' m（' + ts.obsPlace + '）'),
    kpi('校舎の判定', '14 / 14', '局 継続使用可', '固有振動数の低下は 5 % 未満')
  ]));

  /* ---- 統合デジタルツイン図 ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('鉛直方向の結合とセンサーの対応',
    { note:'一つの事象が層を越えて伝わる過程を、どのセンサーがどの層を見ているかとして示す（DT-4・DT-5・DT-6 の接点）' },
    [couplingDiagram(ts),
     el('div', { class:'note', text:'デジタルツインは可視化だけの仕組みではない。ここでは、観測された TEC の擾乱と大気重力波の振幅から津波の規模を逆算し、その結果を検潮所の実測と突き合わせて係数を更新する、という同化の流れそのものを指す。層ごとに別の研究室が持っていたデータを、同一地点・同一時刻で並べられることが本観測網の要点である。' })])));

  /* ---- 地図：震央・観測局・検知状況 ---- */
  var M = NS.Map({ onStation:function (st) { go('station', st.id); } });
  M.drawStations({ state:function (st) { return NS.stationState(st, t); },
    halo:function (st) {
      var d = ts.det.filter(function (x) { return x.id === st.id; });
      if (!d.length) return null;
      return { r:16, color:'var(--c-sky)', opacity:0.34 };
    },
    tipExtra:function (st) {
      var d = ts.det.filter(function (x) { return x.id === st.id; });
      if (!d.length) return 'この事象では検知なし';
      return d.map(function (x) { return x.kind + '　+' + NS.f(x.dt, 1) + ' 分　' + x.val; }).join('<br>');
    } });
  var qp = M.pt(q.lon, q.lat);
  M.addOverlay(s('circle', { cx:qp[0], cy:qp[1], r:M.px(18), fill:'var(--c-crit)', 'fill-opacity':0.12,
    stroke:'var(--c-crit)', 'stroke-width':1, 'vector-effect':'non-scaling-stroke' }));
  M.addOverlay(s('path', { d:'M' + (qp[0] - M.px(7)) + ' ' + qp[1] + 'h' + M.px(14) +
    'M' + qp[0] + ' ' + (qp[1] - M.px(7)) + 'v' + M.px(14), stroke:'var(--c-crit)', 'stroke-width':2,
    'vector-effect':'non-scaling-stroke' }));
  ts.det.forEach(function (d) {
    var st = NS.ST[d.id]; if (!st) return;
    M.addOverlay(s('path', { d:NS.geoLinePath({ lat:q.lat, lon:q.lon }, { lat:st.lat, lon:st.lon }, 16),
      stroke:d.kind === 'GNSS' ? 'var(--c-sky)' : d.kind === 'インフラサウンド' ? 'var(--c-infra)' : 'var(--c-warn)',
      'stroke-width':0.9, 'stroke-dasharray':'3 3', fill:'none', opacity:0.45, 'vector-effect':'non-scaling-stroke' }));
  });
  M.fit([{ lat:q.lat, lon:q.lon }].concat(NS.STATIONS.map(function (st) { return { lat:st.lat, lon:st.lon }; })), 0.15);
  var mp = panel('震央と検知した観測局', { note:'✕ が震央。破線は震央と検知局を結ぶ（色＝センサーの種類）。拡大すると市区町村の境界を表示する（国土数値情報 行政区域データ）' }, []);
  var mb = mp.querySelector('.panel-b'); mb.classList.add('flush'); mb.appendChild(M.node);
  NS.add(mb, el('div', { class:'maplegend' }, [
    el('span', { html:'<i style="background:var(--c-warn)"></i>微動計' }),
    el('span', { html:'<i style="background:var(--c-sky)"></i>2 周波 GNSS（TEC）' }),
    el('span', { html:'<i style="background:var(--c-infra)"></i>インフラサウンド' })]));

  var detTable = panel('検知の時系列', { note:ts.det.length + ' 件・' + NS.fmtJST(ts.t, { sec:false }) + ' JST の地震' },
    NS.table(['経過', '観測局', 'センサー', '内容'], ts.det.map(function (d) {
      return { attrs:{ class:'clk', onclick:function () { go('station', d.id); } }, cells:[
        { class:'r mono', html:'+' + NS.f(d.dt, 1) + ' 分' }, NS.ST[d.id].name,
        badge(d.kind, d.kind === 'GNSS' ? 'info' : d.kind === 'インフラサウンド' ? 'ok' : 'warn'),
        { class:'sm', html:d.val + (d.note ? '　<span class="hint">' + d.note + '</span>' : '') }] };
    })));
  NS.add(root, el('div', { class:'grid g-3-2', style:{ marginTop:'14px' } }, [mp, detTable]));

  /* ---- TEC 時系列 ---- */
  NS.add(root, el('div', { class:'grid g-2-1', style:{ marginTop:'14px' } }, [
    panel('電離圏 TEC の時系列', { note:'2 周波 GNSS。地震発生を 0 分とする' }, [
      NS.chart.line({ series:[
          { name:'TEC', color:'var(--c-info)', pts:ts.tec.map(function (p) { return [p.m, p.tec]; }), area:true },
          { name:'共振成分（拡大）', color:'var(--c-warn)', pts:ts.tec.map(function (p) { return [p.m, 22.6 + p.res * 2]; }), dash:'3 3' }],
        width:900, height:220, xLabel:'地震発生からの経過（分）', yLabel:'TEC（TECU）',
        xFmt:function (v) { return NS.f(v, 0); }, yFmt:function (v) { return NS.f(v, 0); },
        rules:[{ x:8, color:'var(--c-warn)', dash:'3 3', label:'音波共振' },
               { x:19, color:'var(--accent)', dash:'3 3', label:'電離圏ホール' },
               { x:26, color:'var(--c-ok)', dash:'3 3', label:'規模推定' }] }),
      el('div', { class:'note', text:'共振（+8 分）は海面が動いたことを示し、ホール（+19 分）はその大きさを含む。前者は早く、後者は確からしい。両方を見ることで早さと確度を両立させる。' })
    ]),
    panel('津波規模の推定と検証', null, [
      NS.kv([
        ['TEC 最大減少', NS.f(ts.holeMax, 2) + ' TECU'],
        ['減少率', NS.f(ts.holeRate, 2) + ' TECU/分'],
        ['推定沿岸波高', '<b>' + NS.f(ts.estWave, 1) + ' ± ' + NS.f(ts.estErr, 1) + ' m</b>'],
        ['実測', NS.f(ts.obsWave, 1) + ' m（' + ts.obsPlace + '）'],
        ['差', NS.f(ts.estWave - ts.obsWave, 1) + ' m（不確かさの範囲内）'],
        ['外部情報', ts.jmaWarn.text + '（+' + NS.f(ts.jmaWarn.dt, 0) + ' 分）']
      ], 'wide'),
      el('div', { class:'note', text:ts.note }),
      el('div', { class:'chips', style:{ marginTop:'8px' } }, ts.refs.map(function (x) { return badge(x, ''); })),
      el('button', { class:'iconbtn', style:{ marginTop:'8px' }, text:'通報ワークフロー（津波）を見る →',
        onclick:function () { go('alerts'); } })
    ])
  ]));

  /* ---- サロゲートモデルによる即時推定と通報（稼働状態） ---- */
  var live = { n:0, ms:12.4, t0:NS.now() };
  var liveNode = el('div', { class:'srg-live' });
  function renderLive() {
    var up = (NS.now() - live.t0) / 1000;
    live.n = 41280 + Math.floor(up / 30);                 /* 30 秒ごとに 1 回推論する想定 */
    var r = NS.rng('srg' + Math.floor(NS.now() / 2000));
    live.ms = 10.5 + r() * 4.5;
    NS.clear(liveNode);
    NS.add(liveNode, [
      el('span', { class:'srg-dot' }),
      el('b', { text:'稼働中' }),
      el('span', { class:'srg-kv', html:'最終推論 <b>' + NS.fmtJST(NS.now()) + '</b>' }),
      el('span', { class:'srg-kv', html:'推論時間 <b>' + NS.f(live.ms, 1) + '</b> ms' }),
      el('span', { class:'srg-kv', html:'本日の推論 <b>' + (2880).toLocaleString() + '</b> 回（30 秒ごと）' }),
      el('span', { class:'srg-kv', html:'累計 <b>' + live.n.toLocaleString() + '</b> 回' }),
      el('span', { class:'srg-kv', html:'配信キュー <b>0</b> 件' }),
      el('span', { class:'srg-kv', html:'現在の判定 <b style="color:var(--c-ok)">平常</b>' })
    ]);
  }
  renderLive();
  var liveTimer = setInterval(renderLive, 2000);
  NS.onLeave(function () { clearInterval(liveTimer); });

  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('サロゲートモデルによる即時推定と通報',
    { note:'観測が入った瞬間に推定して配信する。数値計算そのものは間に合わないため、事前に学習させた代理モデルに置き換える',
      tools:NS.refreshTool(function () { renderLive(); }) },
    [liveNode, surrogatePipeline(),
     el('div', { class:'note', html:'津波の伝播・浸水は非線形長波方程式を解いて求めるが、高解像度で計算すると数十分から数時間かかり、避難の判断には間に合わない。そこで断層すべりと海底地形の組み合わせを変えた多数のシナリオをあらかじめ計算しておき、その入出力関係を学習した<b>サロゲートモデル（代理モデル）</b>に置き換える。推論は 12 ミリ秒で終わるので、観測が届いた瞬間に沿岸波高・到達時刻・不確かさを返せる。デジタルツインが「見せるだけ」で終わらないのは、この置き換えがあるためである。' })])));

  NS.add(root, el('div', { class:'grid g2', style:{ marginTop:'14px' } }, [
    panel('サロゲートモデルの諸元', { note:'事前学習は学内クラウドで行い、推論は各局のエッジ計算機と中央の両方で走らせる' },
      NS.kv([
        ['入力', '24 次元（TEC 減少率・共振振幅・大気重力波振幅・気圧変動・P 波初動・到達時刻差・震源の緯度経度深さ・Mw）'],
        ['出力', '6 次元（沿岸波高・到達時刻・浸水域の広がり・それぞれの不確かさ）'],
        ['学習データ', '断層すべり分布と潮位条件を変えた数値計算 <b>18,000 シナリオ</b>（南海トラフ・日本海溝・日本海東縁）'],
        ['検証', 'シナリオの 15 % を検証用に残し、沿岸波高の平均絶対誤差 <b>0.31 m</b>'],
        ['推論時間', '<b>12 ms</b>（中央）／ 38 ms（エッジ計算機）'],
        ['更新頻度', '平常時は 30 秒ごと、地震検知後は 1 秒ごと'],
        ['再学習', '事象ごとに実測（検潮所・S-net）と突き合わせ、四半期ごとに係数を更新'],
        ['限界', '学習範囲の外（想定外の断層・遠地津波）では外挿になるため、不確かさを大きく出して人の判断に委ねる']
      ], 'wide')),
    panel('フェイルセーフ', { note:'誤報を出さないための設計。危機管理学部・法学部と整備する' },
      NS.table(['条件', '扱い'], [
        ['単独センサーのみの検知', '発報しない（監視状態に留める）'],
        ['気象庁の警報と矛盾', '<b>気象庁の警報が優先</b>。本推定は参考値として併記するに留める'],
        ['学習範囲外の入力', '不確かさを拡大して出力し、自動配信は止めて人の確認へ回す'],
        ['推論時間が閾値超過', '前回の推定を保持し、劣化モード（単純な経験式）に切り替える'],
        ['配信後に推定が変わった', '訂正を同じ経路で必ず配信する。取り消しは行わず訂正として残す'],
        ['SNS への投稿', '自動投稿はしない。下書きを生成し、人が確認してから投稿する']
      ]))
  ]));

  /* ---- 配信文面のプレビュー ---- */
  var chState = { ch:'web' };
  var draftBox = el('div');
  function renderDraft() {
    var d = draftFor(chState.ch, ts);
    NS.clear(draftBox);
    NS.add(draftBox, [
      el('div', { class:'split', style:{ marginBottom:'8px' } }, [
        el('b', { text:d.title }), el('span', { class:'hint', text:d.meta })]),
      d.json ? el('div', { class:'api', text:JSON.stringify(d.json, null, 2) })
             : el('div', { class:'draft', text:d.body }),
      chState.ch === 'sns'
        ? el('div', { class:'note', text:'SNS は自動投稿しない。この下書きを担当者が確認し、必要なら手を入れてから投稿する。未確定の推定値を含むため、取り消しではなく訂正で運用する。' })
        : el('div', { class:'note', text:'どの経路でも「気象庁の警報が優先する」ことと不確かさを必ず併記する。文面は法学部・危機管理学部と整備した定型から自動生成する。' })
    ]);
  }
  var chSeg = el('div', { class:'seg' }, [['Web ポータル', 'web'], ['スマートフォン通知', 'push'],
    ['SNS 下書き', 'sns'], ['自治体 API', 'api']].map(function (x) {
    return el('button', { text:x[0], 'aria-pressed':x[1] === chState.ch ? 'true' : 'false', onclick:function (ev) {
      chState.ch = x[1];
      Array.prototype.forEach.call(ev.target.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.target.setAttribute('aria-pressed', 'true');
      renderDraft();
    } });
  }));
  renderDraft();
  NS.add(root, el('div', { class:'grid g-3-2', style:{ marginTop:'14px' } }, [
    panel('配信文面（自動生成）', { note:'同じ推定結果から、経路ごとに長さと体裁を変えて出す', tools:chSeg }, draftBox),
    panel('配信経路', { note:'到達手段を複数持つことが、届かない事態を防ぐ' },
      NS.table(['経路', '所要', '対象'], [
        ['Web ポータル（本デモ）', '即時', '誰でも。根拠と不確かさを全文で示す'],
        ['スマートフォン通知（Push）', '数秒', '登録した教職員・自治体担当・保護者'],
        ['学校端末・デジタルサイネージ', '数秒', '各付属校の職員室・昇降口'],
        ['自治体向け API（SIP4D 準拠）', '即時', '防災担当の既存システムへ流し込む'],
        ['SNS', '人の確認後', '一般向け。自動投稿はしない'],
        ['メール・FAX', '1 分以内', '通信手段が限られる連絡先への冗長経路']
      ]))
  ]));

  /* ---- 校舎の判定（DT-6） ---- */
  var rows = NS.STATIONS.map(function (st) {
    var r = NS.rng(st.id + '|seis'), f0 = 2.6 + r() * 1.9;
    var pre = f0 * (1 + r.range(0.000, 0.012));
    var d = seis && seis.det.filter(function (x) { return x.id === st.id; })[0];
    var pga = d ? d.pga : 0.4 + r() * 12;
    var drift = ((f0 - pre) / pre) * 100;
    return { st:st, f0:f0, pre:pre, drift:drift, pga:pga };
  }).sort(function (a, b) { return b.pga - a.pga; });
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('校舎の使用可否判定（全 14 局・DT-6）',
    { note:'常時微動から同定した 1 次固有振動数を地震前後で比較する。低下が 5 % を超えたら「点検要」を自動発報する' },
    [NS.table(['観測局', '設置校', '地震前 f₀', '地震後 f₀', '変化', '最大加速度', '判定'], rows.map(function (r) {
      return { attrs:{ class:'clk', onclick:function () { go('station', r.st.id); } }, cells:[
        el('b', { text:r.st.name }), { class:'sm', html:r.st.host.split('・')[0] },
        { class:'r', html:NS.f(r.pre, 2) + ' Hz' }, { class:'r', html:NS.f(r.f0, 2) + ' Hz' },
        { class:'r', html:NS.f(r.drift, 1) + ' %' }, { class:'r', html:NS.f(r.pga, 1) + ' gal' },
        Math.abs(r.drift) < 5 ? badge('継続使用可', 'ok') : badge('点検要', 'warn')] };
    })),
     el('div', { class:'note', text:'固有振動数は剛性の平方根に比例するため、低下率は構造的な損傷の指標になる。学校は多くの自治体で避難所に指定されており、地震直後に「この校舎を使ってよいか」を数分で答えられることの意味は大きい。工学部（建築）・理工学部（建築・機械）・生産工学部が担当する。' })])));

  /* ---- 防災科研との連携 ---- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('防災科学技術研究所（NIED）の公開データとの突き合わせ',
    { note:'本観測網だけでは閉じない。既存の基盤観測網と突き合わせて初めて検証になる' },
    [NS.niedTable('地震'), el('div', { class:'src', text:NS.niedNote })])));
};

})(NS);
