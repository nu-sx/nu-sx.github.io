/* NU-SORA デモ / MQTT リモート観測サーバ（AWS IoT Core）

   14 局のエッジ計算機と運用画面のあいだを MQTT でつなぐ。局は常時接続して
   テレメトリと検出イベントを publish し、運用画面からの指令は cmd トピックで
   降ろして ack を受ける。望遠鏡のように「状態を合わせたい」ものはデバイスシャドウ
   （desired / reported）で扱い、接続が切れていても復帰時に追いつけるようにする。

   ・接続は MQTT over TLS 8883、局ごとの X.509 クライアント証明書で相互認証する
   ・運用画面（ブラウザ）は MQTT over WebSocket（443）＋ Cognito の一時認証情報
   ・トピックは nusora/{種別}/{局}/{装置} の 4 階層にそろえ、IoT ポリシーは
     局ごとに自分の前置詞だけを許す（他局のトピックには触れない）
   ・ルールエンジンで保存・相関付け・通報へ分岐させる */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, f = NS.f;

/* ---------------- 設計値 ---------------- */
NS.MQTT = {
  endpoint:'a3xxxxxxxxxx-ats.iot.ap-northeast-1.amazonaws.com',
  region:'ap-northeast-1（東京）',
  port:{ device:8883, browser:443 },
  keepAlive:30,
  prefix:'nusora',
  /* 単価は変わるので、申請時に最新値で引き直す前提の概算 */
  price:{ msg:1.20, conn:0.096, rule:0.18, shadow:1.25 }
};

/* トピック設計。dir は 局→雲（up）／雲→局（down）／双方向（both）。 */
NS.MQTT_TOPICS = [
  { t:'nusora/tlm/{局}/status',     dir:'up',   qos:1, hz:'30 秒', n:2,
    what:'稼働状態・機材別の可否・ディスク残量・室温' },
  { t:'nusora/tlm/{局}/weather',    dir:'up',   qos:0, hz:'60 秒', n:1,
    what:'気温・湿度・気圧・風向風速・雨量・日射・WBGT' },
  { t:'nusora/tlm/{局}/sqm',        dir:'up',   qos:0, hz:'60 秒', n:1,
    what:'夜空輝度（mag/arcsec²）・雲量' },
  { t:'nusora/tlm/{局}/cosmic',     dir:'up',   qos:0, hz:'60 秒', n:1,
    what:'宇宙線計数（cpm）・気圧補正値' },
  { t:'nusora/tlm/{局}/gnss',       dir:'up',   qos:0, hz:'30 秒', n:2,
    what:'時刻同期の残差・可降水量・電離圏 TEC' },
  { t:'nusora/evt/{局}/fireball',   dir:'up',   qos:1, hz:'事象ごと', n:0,
    what:'火球検出（時刻・方位・仰角・等級・クリップの保存先）' },
  { t:'nusora/evt/{局}/infrasound', dir:'up',   qos:1, hz:'事象ごと', n:0,
    what:'音響検出（到達時刻・到来方位・振幅・卓越周期）' },
  { t:'nusora/evt/{局}/lif',        dir:'up',   qos:1, hz:'事象ごと', n:0,
    what:'月面衝突閃光の候補（フレーム番号・輝度・座標）' },
  { t:'nusora/cmd/{局}/{装置}',     dir:'down', qos:1, hz:'操作ごと', n:0,
    what:'指向・露出・ゲイン・録画・ハウジング開閉などの指令' },
  { t:'nusora/cmd/{局}/{装置}/ack', dir:'up',   qos:1, hz:'指令ごと', n:0,
    what:'指令の受領と完了（往復時間の測定にも使う）' },
  { t:'$aws/things/{局}/shadow/*',  dir:'both', qos:1, hz:'変化時', n:0,
    what:'デバイスシャドウ。望遠鏡の目標状態（desired）と実状態（reported）' }
];

/* ルールエンジンの分岐 */
NS.MQTT_RULES = [
  { name:'tlm-store',   sql:"SELECT * FROM 'nusora/tlm/+/+'",
    act:'Timestream へ書き込み（1 分値・保持 13 か月）', why:'気象・輝度・宇宙線の時系列' },
  { name:'evt-fanout',  sql:"SELECT * FROM 'nusora/evt/+/+'",
    act:'Lambda（多点相関）→ DynamoDB → SNS', why:'複数局の検出を突き合わせて 1 事象にまとめる' },
  { name:'clip-index',  sql:"SELECT clip, station, t FROM 'nusora/evt/+/fireball'",
    act:'S3 のクリップを索引化（Glacier へ階層化）', why:'映像の実体は局から直接 S3 へ置く' },
  { name:'alert-relay', sql:"SELECT * FROM 'nusora/evt/+/+' WHERE mag < -8",
    act:'SNS → 自治体・教育委員会・危機管理部', why:'明るい事象だけを通報経路へ流す' },
  { name:'health',      sql:"SELECT * FROM 'nusora/tlm/+/status' WHERE disk_free_gb < 200",
    act:'CloudWatch アラーム → 運用当番へ通知', why:'ディスクと室温の異常を早く拾う' }
];

/* 局あたり 1 日のメッセージ数を、上の設計から数える */
NS.mqttRates = function () {
  var n = NS.STATIONS.length, perMin = 0;
  NS.MQTT_TOPICS.forEach(function (x) { perMin += x.n; });
  var tlmDay = perMin * 60 * 24 * n;                 /* 定期テレメトリ */
  var evtDay = 180;                                  /* 検出イベント（全局合計・デモ想定） */
  var cmdDay = 240;                                  /* 指令と ack（合計） */
  var total = tlmDay + evtDay + cmdDay;
  var P = NS.MQTT.price;
  var mo = {
    msg:  total * 30 / 1e6 * P.msg,
    conn: n * 60 * 24 * 30 / 1e6 * P.conn,
    rule: total * 30 / 1e6 * P.rule,
    shadow: 2000 * 30 / 1e6 * P.shadow
  };
  mo.total = mo.msg + mo.conn + mo.rule + mo.shadow;
  return { perMin:perMin, perStationDay:perMin * 60 * 24, tlmDay:tlmDay, evtDay:evtDay,
           cmdDay:cmdDay, total:total, mo:mo };
};

/* ---------------- 構成図 ---------------- */
NS.mqttArch = function () {
  var W = 940, H = 300;
  var svg = s('svg', { viewBox:'0 0 ' + W + ' ' + H, class:'chart', role:'img',
    style:{ width:'100%', height:'auto', display:'block' } });
  var defs = s('defs', {}, s('marker', { id:'mqar', viewBox:'0 0 10 10', refX:9, refY:5,
    markerWidth:6, markerHeight:6, orient:'auto-start-reverse' },
    s('path', { d:'M0 0 L10 5 L0 10 z', fill:'var(--muted)' })));
  NS.add(svg, defs);

  function box(x, y, w, h, title, sub, color) {
    var g = s('g', {});
    NS.add(g, s('rect', { x:x, y:y, width:w, height:h, rx:7,
      fill:'var(--panel2)', stroke:color || 'var(--line)', 'stroke-width':1.2 }));
    NS.add(g, s('text', { x:x + w / 2, y:y + (sub ? 20 : h / 2 + 4), 'text-anchor':'middle',
      class:'mqt', text:title }));
    if (sub) sub.split('\n').forEach(function (ln, i) {
      NS.add(g, s('text', { x:x + w / 2, y:y + 38 + i * 13, 'text-anchor':'middle', class:'mqs', text:ln }));
    });
    NS.add(svg, g);
    return { x:x, y:y, w:w, h:h };
  }
  function arrow(x1, y1, x2, y2, label, dash) {
    NS.add(svg, s('path', { d:'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, stroke:'var(--muted)',
      'stroke-width':1.3, fill:'none', 'marker-end':'url(#mqar)',
      'stroke-dasharray':dash ? '5 4' : null, opacity:0.85 }));
    if (label) NS.add(svg, s('text', { x:(x1 + x2) / 2, y:(y1 + y2) / 2 - 6, 'text-anchor':'middle',
      class:'mqs', text:label }));
  }

  box(14, 96, 170, 92, NS.t('観測局 ×14'), NS.t('エッジ計算機') + '\n' + NS.t('検出・一次処理'), 'var(--c-s)');
  box(300, 96, 190, 92, 'AWS IoT Core', NS.t('MQTT ブローカー') + '\n' + NS.t('デバイスシャドウ'), 'var(--accent)');
  box(596, 18, 150, 62, NS.t('ルールエンジン'), NS.t('SQL で分岐'));
  box(596, 100, 150, 62, 'Timestream / S3', NS.t('時系列・映像'));
  box(596, 182, 150, 62, 'Lambda / SNS', NS.t('相関付け・通報'));
  box(790, 100, 136, 62, NS.t('公開 API'), '/api/v1/…');
  box(300, 224, 190, 62, NS.t('運用画面（本デモ）'), NS.t('MQTT over WebSocket'));

  arrow(184, 130, 300, 130, 'MQTT / TLS 8883');
  arrow(184, 158, 300, 158, 'X.509 相互認証', true);
  arrow(490, 118, 596, 60, NS.t('publish'));
  arrow(746, 49, 830, 100, NS.t('書き込み'));
  arrow(746, 131, 790, 131, '');
  arrow(596, 131, 490, 131, NS.t('cmd / shadow'));
  arrow(596, 213, 490, 165, NS.t('通報'), true);
  /* 運用画面との往復は近いので、ラベルは矢印の左右に振り分ける */
  arrow(372, 224, 372, 190, '');
  NS.add(svg, s('text', { x:366, y:210, 'text-anchor':'end', class:'mqs', text:NS.t('指令') }));
  arrow(424, 190, 424, 224, '', true);
  NS.add(svg, s('text', { x:430, y:210, 'text-anchor':'start', class:'mqs', text:NS.t('状態') }));
  return svg;
};

/* ---------------- 実際に流れているメッセージ（模擬） ---------------- */
NS.mqttMonitor = function (opts) {
  opts = opts || {};
  var box = el('div', { class:'cmdlog mqlog' }), rows = [], n = 0;
  var st = NS.STATIONS, t0 = NS.now();

  function pick(r) {
    var k = r(), s2 = st[Math.floor(r() * st.length)], id = s2.id;
    var now = new Date(NS.now());
    var ts = now.toISOString().replace('Z', 'Z');
    var w = NS.weather(s2, NS.now()), sb = NS.skyBrightness(s2, NS.now());
    if (k < 0.30) return { topic:'nusora/tlm/' + id + '/status', qos:1, dir:'up',
      body:'{"t":"' + ts + '","mode":"' + (w.sunAlt < -6 ? 'observing' : 'standby')
        + '","housing":"' + (w.sunAlt < -6 && w.rain < 0.2 ? 'open' : 'closed')
        + '","disk_free_gb":' + Math.round(900 + r() * 900) + ',"room_c":' + f(21 + r() * 4, 1) + '}' };
    if (k < 0.52) return { topic:'nusora/tlm/' + id + '/weather', qos:0, dir:'up',
      body:'{"t":"' + ts + '","temp_c":' + f(w.temp, 1) + ',"rh":' + f(w.rh, 0)
        + ',"p_hpa":' + f(w.press, 1) + ',"wind_ms":' + f(w.wind, 1) + ',"wbgt":' + f(w.wbgt, 1) + '}' };
    if (k < 0.68) return { topic:'nusora/tlm/' + id + '/sqm', qos:0, dir:'up',
      body:'{"t":"' + ts + '","mag_arcsec2":' + f(sb.mag == null ? s2.sqm : sb.mag, 2)
        + ',"cloud":' + f(w.cloud, 2) + ',"moon_alt":' + f(sb.moonAlt == null ? 0 : sb.moonAlt, 1) + '}' };
    if (k < 0.80) return { topic:'nusora/tlm/' + id + '/cosmic', qos:0, dir:'up',
      body:'{"t":"' + ts + '","cpm":' + f(NS.cosmicRay(s2, NS.now()).cpm, 1)
        + ',"p_hpa":' + f(w.press, 1) + ',"corrected":' + f(NS.cosmicRay(s2, NS.now()).corr, 1) + '}' };
    if (k < 0.87) return { topic:'nusora/tlm/' + id + '/gnss', qos:0, dir:'up',
      body:'{"t":"' + ts + '","sync_ms":' + f(0.2 + r() * 0.5, 2) + ',"pwv_mm":' + f(18 + r() * 22, 1)
        + ',"tec_tecu":' + f(9 + r() * 14, 1) + '}' };
    if (k < 0.92) return { topic:'nusora/evt/' + id + '/fireball', qos:1, dir:'up', hot:true,
      body:'{"t":"' + ts + '","mag":' + f(-1 - r() * 6, 1) + ',"az":' + f(r() * 360, 1)
        + ',"alt":' + f(15 + r() * 60, 1) + ',"dur_s":' + f(0.4 + r() * 2.4, 2)
        + ',"clip":"s3://nusora-clips/' + id + '/' + now.getUTCFullYear() + '/…mp4"}' };
    if (k < 0.96) return { topic:'nusora/cmd/' + id + '/gdm-p', qos:1, dir:'down', hot:true,
      body:'{"cmd":"slew","ra_deg":' + f(r() * 360, 3) + ',"dec_deg":' + f(r() * 60 - 20, 3)
        + ',"by":"funabashi-ops","req_id":"' + (1000 + Math.floor(r() * 8999)) + '"}' };
    return { topic:'$aws/things/nusora-' + id + '/shadow/update/accepted', qos:1, dir:'both',
      body:'{"state":{"reported":{"fps":' + [30, 60, 100][Math.floor(r() * 3)]
        + ',"recording":' + (r() < 0.4) + ',"filter":"' + ['none', 'g′', 'r′', 'i′'][Math.floor(r() * 4)] + '"}}}' };
  }

  function tick() {
    var r = NS.rng('mqtt' + (n++));
    var m = pick(r);
    var row = el('div', { class:'cl ' + (m.hot ? 'k-ok' : 'k-cmd') }, [
      el('span', { class:'clt', text:NS.fmtJST(NS.now(), { sec:true }) }),
      el('span', { class:'mqd ' + m.dir, text:m.dir === 'down' ? '↓' : (m.dir === 'up' ? '↑' : '⇅') }),
      el('span', { class:'mqt2', text:m.topic }),
      el('span', { class:'mqq', text:'QoS ' + m.qos }),
      el('span', { class:'mqb', text:m.body })
    ]);
    rows.unshift(row);
    box.insertBefore(row, box.firstChild);
    while (rows.length > (opts.max || 14)) { box.removeChild(rows.pop()); }
  }
  for (var i = 0; i < 8; i++) tick();
  var iv = setInterval(tick, opts.every || 900);
  NS.onLeave(function () { clearInterval(iv); });
  return box;
};

/* ---------------- 画面（データ公開と API から呼ぶ） ---------------- */
NS.mqttPanels = function () {
  var panel = NS.panel, badge = NS.badge, R = NS.mqttRates(), M = NS.MQTT;
  var shadow = {
    state: {
      desired: { target:'moon', ra_deg:205.000, dec_deg:12.000, exposure_s:10, gain:180,
                 video_fps:60, recording:true, housing:'open' },
      reported: { target:'moon', ra_deg:205.000, dec_deg:12.000, exposure_s:10, gain:180,
                  video_fps:60, recording:true, housing:'open', temp_c:12.4, focus_hfd_as:3.2 },
      delta: {}
    },
    metadata: { reported: { recording: { timestamp:1789234567 } } },
    version: 4821
  };
  return [
    panel('MQTT リモート観測サーバ（AWS IoT Core）', {
      note:'14 局のエッジ計算機と運用画面を MQTT でつなぐ。テレメトリは局から上げ、指令は cmd トピックで降ろして ack を受ける',
      tools:badge(M.region, 'info') }, [
      NS.mqttArch(),
      NS.kv([
        ['エンドポイント', '<span class="mono">' + M.endpoint + '</span>'],
        ['接続', '局＝MQTT over TLS <b>' + M.port.device + '</b>（X.509 クライアント証明書で相互認証）／'
          + '運用画面＝MQTT over WebSocket <b>' + M.port.browser + '</b>（Cognito の一時認証情報）'],
        ['キープアライブ', M.keepAlive + ' 秒。切れているあいだの指令はデバイスシャドウに残り、復帰時に追いつく'],
        ['権限', '局ごとの IoT ポリシーで <span class="mono">nusora/+/{自局}/*</span> だけを許可し、他局のトピックには触れない'],
        ['ファーム更新', 'AWS IoT Jobs で検出ソフトの更新を段階配信（1 局ずつ → 全局）']
      ], 'wide')
    ]),
    panel('トピック設計', { note:'nusora/{種別}/{局}/{装置} の 4 階層にそろえる。QoS 1 は「必ず届く」側' },
      NS.table(['トピック', '向き', 'QoS', '頻度', '内容'], NS.MQTT_TOPICS.map(function (x) {
        return [{ class:'mono sm', html:x.t },
          x.dir === 'up' ? badge('局 → 雲', 'info') : x.dir === 'down' ? badge('雲 → 局', 'warn') : badge('双方向', ''),
          { class:'r', html:String(x.qos) }, { class:'r sm', html:x.hz }, { class:'sm', html:x.what }];
      }))),
    panel('ルールエンジンの分岐', { note:'届いたメッセージを SQL で選り分け、保存・相関付け・通報へ流す' },
      NS.table(['ルール', '選択', '流す先', 'ねらい'], NS.MQTT_RULES.map(function (x) {
        return [NS.el('b', { text:x.name }), { class:'mono sm', html:x.sql },
          { class:'sm', html:x.act }, { class:'sm', html:x.why }];
      }))),
    panel('デバイスシャドウ（望遠鏡）', {
      note:'目標状態（desired）と実状態（reported）を分けて持つ。回線が切れても、つながった時点で差分だけ適用される' },
      el('div', { class:'api', text:JSON.stringify(shadow, null, 2) })),
    panel('流量と費用の見積り', { note:'上のトピック設計から数えた 14 局ぶんの概算。単価は変わるので申請時に引き直す' }, [
      NS.table(['項目', '数量', '算出'], [
        ['定期テレメトリ', NS.f(R.tlmDay, 0) + ' 件/日', R.perMin + ' 件/分 × 60 × 24 × ' + NS.STATIONS.length + ' 局'],
        ['検出イベント', NS.f(R.evtDay, 0) + ' 件/日', '火球・音響・月面閃光の合計（想定）'],
        ['指令と ack', NS.f(R.cmdDay, 0) + ' 件/日', 'リモート観測の操作'],
        ['合計', '<b>' + NS.f(R.total, 0) + ' 件/日</b>', NS.f(R.total * 30 / 1e6, 2) + ' 百万件/月'],
        ['メッセージ料', '$' + NS.f(R.mo.msg, 2) + ' /月', '$' + NS.f(NS.MQTT.price.msg, 2) + ' / 百万件（5 KB 単位）'],
        ['常時接続', '$' + NS.f(R.mo.conn, 2) + ' /月', '$' + NS.f(NS.MQTT.price.conn, 3) + ' / 百万分 × 14 局'],
        ['ルール実行', '$' + NS.f(R.mo.rule, 2) + ' /月', '$' + NS.f(NS.MQTT.price.rule, 2) + ' / 百万件'],
        ['シャドウ操作', '$' + NS.f(R.mo.shadow, 2) + ' /月', '$' + NS.f(NS.MQTT.price.shadow, 2) + ' / 百万件'],
        ['月額の目安', '<b>$' + NS.f(R.mo.total, 2) + ' /月</b>', '別途、保存（S3・Timestream）と回線費']
      ]),
      el('div', { class:'note', text:'映像そのものは MQTT に載せない。局から S3 へ直接置き、MQTT ではその保存先だけを知らせる。'
        + 'この切り分けで、常時接続の費用は 1 局あたり月 100 円に届かない。' })
    ]),
    panel('流れているメッセージ（模擬）', { note:'実際のブローカーに接続しているわけではなく、設計どおりの内容を同じ形で流している',
      tools:badge('デモ', 'dim') }, NS.mqttMonitor({ max:14 }))
  ];
};

})(NS);
