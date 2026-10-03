/* NU-AbeLab / 画面 ⑥データ連携
   観測局と手元のあいだで何を・どれだけ・どの経路で運ぶかをまとめる。
   数値は机上の仮定ではなく、いま画面に出ている観測条件・画角から計算している。 */
'use strict';
(function (AL) {

var el = AL.el, panel = AL.panel, C = AL.chart;
var SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, kids) {
  var e = document.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}
/* 直近 14 夜の平均で、1 夜あたりの件数・録画時間・記録量を出す */
function nightly(id, now) {
  var n = 0, rec = 0, gb = 0, k = 0;
  for (var d = 1; d <= 14; d++) {
    var s = AL.data.nightSummary(id, AL.nightOf(now - d * 86400e3));
    n += s.n; rec += s.recSec; gb += s.bytes / 1024; k++;
  }
  return { n: n / k, rec: rec / k, gb: gb / k };
}

AL.V.link = function (root, ui) {
  var now = AL.now();
  var g = el('div', { class: 'grid' });
  var L = AL.LINK;
  var per = {}, tot = { n: 0, rec: 0, gb: 0 };
  AL.STL.forEach(function (id) {
    per[id] = nightly(id, now);
    tot.n += per[id].n; tot.rec += per[id].rec; tot.gb += per[id].gb;
  });
  var state = { codec: 'ffv1', bwScale: 1 };

  /* ================= 1. データ量 ================= */
  var p1 = panel('運ぶデータの量', { col: 'c4', note: '直近 14 夜の平均。画角を変えると追随する' });
  var b1 = p1.querySelector('.body');
  AL.add(b1, AL.stat(AL.f(tot.gb, 0), 'GB', '3 局合計・1 夜あたりの映像'));
  AL.add(b1, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
    AL.stat(AL.int(tot.n), '件', '1 夜の検出', { sm: true }),
    AL.stat(AL.f(tot.gb * 365 / 1024, 1), 'TB', '年間（無圧縮）', { sm: true }),
    AL.stat(AL.f(tot.gb * 1024 / Math.max(1, tot.n), 0), 'MB', '1 クリップ', { sm: true }),
    AL.stat(AL.f(tot.n * L.evtBytes / 1024 / 1024, 2), 'MB', 'メタデータ（1 夜）', { sm: true })
  ]));
  AL.add(b1, AL.table(['局', ['件数', 'num'], ['録画', 'num'], ['記録量', 'num']],
    AL.STL.map(function (id) {
      var x = per[id];
      return [AL.st(id).name, AL.f(x.n, 0), AL.dur(x.rec), AL.f(x.gb, 0) + ' GB'];
    }), { scroll: false }));
  AL.add(b1, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '無圧縮 YUYV422 は 1920 × 1080 × 2 byte × 30 fps ＝ ' + AL.f(AL.RIG.rateMBs, 0) +
          ' MB/s。映像とメタデータでは量が 5 桁ちがう。この差が、連携を層に分ける理由になる。' }));
  g.appendChild(p1);

  /* ================= 2. 三層の流れ ================= */
  var p2 = panel('三層に分けて運ぶ', { col: 'c8',
    note: '軽いものは即時に、重いものは観測が終わってから' });
  (function () {
    var W = 900, H = 320;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'display:block' });
    function box(x, y, w, h, title, lines, color) {
      var gg = sv('g');
      gg.appendChild(sv('rect', { x: x, y: y, width: w, height: h, rx: 4, fill: color + '1a', stroke: color, 'stroke-width': 1.3 }));
      gg.appendChild(sv('text', { x: x + 10, y: y + 18, fill: '#e6e7ea', 'font-size': 12, 'font-weight': 700 }, title));
      (lines || []).forEach(function (t, i) {
        gg.appendChild(sv('text', { x: x + 10, y: y + 34 + i * 13, fill: '#a3a8b0', 'font-size': 10.5 }, t));
      });
      svg.appendChild(gg);
      return gg;
    }
    function arrow(x0, y0, x1, y1, label, color, dash) {
      svg.appendChild(sv('line', { x1: x0, y1: y0, x2: x1, y2: y1, stroke: color, 'stroke-width': 1.6,
        'stroke-dasharray': dash || null, 'marker-end': 'url(#arw)' }));
      if (label) svg.appendChild(sv('text', { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 5, fill: '#a3a8b0',
        'font-size': 10, 'text-anchor': 'middle' }, label));
    }
    var defs = sv('defs');
    defs.appendChild(sv('marker', { id: 'arw', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6,
      markerHeight: 6, orient: 'auto-start-reverse' }, [sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#a3a8b0' })]));
    svg.appendChild(defs);

    box(10, 18, 190, 250, '観測局（3 局）', [
      'UFOCapture HD2 / 制御 PC', 'ME20F-SH ＋ 24 mm', '',
      '・トリガーごとに AVI / BMP /', '　JPG / XML を書く',
      '・XML から要点を抜いて JSON 化', '・ローカルに 10 夜ぶん保持',
      '・回線が切れてもキューに貯める'], '#5598e7');

    box(255, 18, 250, 62, '① テレメトリ', [
      '死活・ディスク・気温・雲量・空の明るさ',
      AL.LINK.tlmSec + ' 秒ごと／' + AL.f(AL.LINK.tlmBytes / 1024, 1) + ' kB　MQTT QoS 0'], '#199e70');
    box(255, 96, 250, 70, '② 検出イベント（メタデータ）', [
      '時刻・等級・継続・角速度・群・保存先',
      '事象ごと／' + AL.f(AL.LINK.evtBytes / 1024, 1) + ' kB　MQTT QoS 1',
      '1 夜 ' + AL.f(tot.n * AL.LINK.evtBytes / 1048576, 1) + ' MB（3 局合計）'], '#fab219');
    box(255, 182, 250, 86, '③ 映像の本体', [
      'AVI（可逆圧縮）＋ 閲覧用 H.264',
      '夜明け後にまとめて／帯域制限つき',
      '1 夜 ' + AL.f(tot.gb, 0) + ' GB（無圧縮）',
      'rsync over SSH または S3 マルチパート'], '#d95926');

    box(560, 18, 150, 250, '集約サーバー', [
      '・時系列 DB（①）', '・イベント DB（②）', '・オブジェクト保管（③）',
      '', '・2 局以上の突き合わせ', '・夜ごとのマニフェスト照合', '', '学内 or クラウド'], '#a3a8b0');
    box(760, 18, 130, 120, 'ダッシュボード', ['AL.ingest.status()', 'AL.ingest.ufo()', 'AL.ingest.csv()'], '#5598e7');
    box(760, 160, 130, 108, '指令（下り）', ['録画の開始・停止', 'ゲイン / 閾値', 'マスクの更新', 'MQTT cmd → ack'], '#b877d9');

    arrow(200, 50, 253, 50, '', '#199e70');
    arrow(200, 130, 253, 130, '', '#fab219');
    arrow(200, 215, 253, 215, '', '#d95926');
    arrow(505, 50, 558, 50, '', '#199e70');
    arrow(505, 130, 558, 130, '', '#fab219');
    arrow(505, 215, 558, 215, '', '#d95926');
    arrow(710, 80, 758, 80, '', '#5598e7');
    arrow(758, 214, 712, 214, '', '#b877d9');
    arrow(560, 296, 205, 296, '指令は同じ経路を逆向きに（MQTT cmd / ack）', '#b877d9', '4 3');
    p2.querySelector('.body').appendChild(svg);
  })();
  g.appendChild(p2);

  /* ================= 3. 層ごとの諸元 ================= */
  var p3 = panel('層ごとの諸元', { col: 'c7', note: '遅延の要求がちがうので、経路も分ける' });
  AL.add(p3.querySelector('.body'), AL.table(
    ['層', '内容', '頻度', ['1 回', 'num'], ['1 日', 'num'], '経路', '遅れてよい時間'],
    [['①', '死活・気象・空の状態', AL.LINK.tlmSec + ' 秒', '1 kB',
      AL.f(86400 / AL.LINK.tlmSec * AL.LINK.tlmBytes * 3 / 1048576, 1) + ' MB', 'MQTT / TLS 8883', '1 分'],
     ['②', '検出イベントのメタデータ', '事象ごと', '2 kB',
      AL.f(tot.n * AL.LINK.evtBytes / 1048576, 1) + ' MB', 'MQTT / TLS 8883', '10 秒'],
     ['③', '映像・マスク・ピークホールド', '夜明け後', AL.f(tot.gb * 1024 / Math.max(1, tot.n), 0) + ' MB',
      AL.f(tot.gb, 0) + ' GB', 'rsync over SSH / S3', '翌日の日没まで'],
     ['④', '指令と ack', '操作ごと', '0.5 kB', '— ', 'MQTT / TLS 8883', '1 秒'],
     ['⑤', '夜ごとのマニフェスト', '1 夜 1 回', '50 kB', '0.15 MB', 'MQTT ＋ 保管先に同送', '翌日']
    ], { scroll: false }));
  AL.add(p3.querySelector('.body'), el('div', { class: 'note', style: { marginTop: '6px' },
    text: '①②④は合わせて 1 日 10 MB 程度で、観測所の回線を圧迫しない。' +
          '帯域を食うのは③だけなので、③は観測が終わってから、帯域に上限をつけて流す。' }));
  g.appendChild(p3);

  /* ================= 4. 回線と所要時間 ================= */
  var p4 = panel('回線と転送時間', { col: 'c5', right: [] });
  (function () {
    var b = p4.querySelector('.body');
    var selC = el('select', { onchange: function () { state.codec = selC.value; draw(); } },
      L.codec.map(function (c) { return el('option', { value: c.key, text: c.name, selected: c.key === state.codec ? '' : null }); }));
    AL.add(p4.querySelector('header .right'), [el('span', { class: 'ctl' }, ['保存形式', selC])]);
    var host = el('div');
    b.appendChild(host);
    function draw() {
      AL.clear(host);
      var cd = L.codec.filter(function (c) { return c.key === state.codec; })[0];
      var rows = AL.STL.map(function (id) {
        var st = AL.st(id), gb = per[id].gb / cd.ratio;
        var MBs = st.bw * 0.7 / 8;                           /* 実効 70 % */
        var hrs = gb * 1024 / MBs / 3600;
        var win = 12;                                        /* 夜明けから日没までの余裕 */
        return [st.name, st.bw + ' Mbps', AL.f(gb, 0) + ' GB', AL.f(MBs, 0) + ' MB/s',
          el('span', { style: { color: hrs > win ? 'var(--critical)' : hrs > win * 0.5 ? 'var(--warning)' : 'var(--text-1)' },
            text: (hrs < 1 ? AL.f(hrs * 60, 0) + ' 分' : AL.f(hrs, 1) + ' 時間') + (hrs > win ? ' ■' : hrs > win * 0.5 ? ' ▲' : '') })];
      });
      AL.add(host, AL.table(['局', ['回線', 'num'], ['1 夜', 'num'], ['実効', 'num'], ['転送時間', 'num']], rows, { scroll: false }));
      AL.add(host, el('div', { class: 'note', style: { marginTop: '6px' },
        text: cd.note + '　実効帯域は公称の 70 % とした。昼のうち（約 12 時間）に送り終われば、' +
              '次の夜の観測に影響しない。■ は間に合わない、▲ は余裕がないことを示す。' }));
    }
    draw();
  })();
  g.appendChild(p4);

  /* ================= 5. MQTT のトピック ================= */
  var p5 = panel('MQTT のトピック設計', { col: 'c6',
    note: L.prefix + '/{種別}/{局}/{装置}　局は自分の前置詞だけに権限を持つ' });
  AL.add(p5.querySelector('.body'), AL.table(
    ['トピック', '向き', 'QoS', '頻度', '内容'],
    [[L.prefix + '/tlm/{局}/status', '局→中央', 1, '30 秒', '稼働状態・ディスク残量・CPU・筐体温度'],
     [L.prefix + '/tlm/{局}/sky', '局→中央', 0, '60 秒', '雲量・夜空輝度・限界等級・気温'],
     [L.prefix + '/evt/{局}/meteor', '局→中央', 1, '事象ごと', '時刻・等級・継続・角速度・群・クリップの保存先'],
     [L.prefix + '/evt/{局}/manifest', '局→中央', 1, '1 夜 1 回', 'その夜のファイル一覧と SHA-256'],
     [L.prefix + '/cmd/{局}/{装置}', '中央→局', 1, '操作ごと', '録画の開始停止・ゲイン・閾値・マスク更新・再送要求'],
     [L.prefix + '/cmd/{局}/{装置}/ack', '局→中央', 1, '指令ごと', '受領と完了（往復時間の測定にも使う）']
    ], { scroll: false }));
  AL.add(p5.querySelector('.body'), el('div', { class: 'note', style: { marginTop: '6px' },
    text: '局は X.509 のクライアント証明書で相互認証し、ダッシュボードは WebSocket（443）でつなぐ。' +
          '切断中のテレメトリは局側のキューに貯め、復帰時にまとめて送る（QoS 1）。' +
          'NU-SORA の MQTT 設計（AWS IoT Core）と同じ流儀なので、集約基盤は共用できる。' }));
  g.appendChild(p5);

  /* ================= 6. 受け渡しの形式 ================= */
  var p6 = panel('受け渡しの形式', { col: 'c6', note: 'ダッシュボードの取り込み口と 1 対 1 で対応する' });
  (function () {
    var b = p6.querySelector('.body');
    var ex = {
      evt: '{\n  "t": "2026-10-03T21:14:52.431+09:00",   // GPS 時刻\n  "st": "KSO",\n  "mag": -1.4,          // 等級\n  "dur": 0.82,          // 継続 [s]\n  "vang": 13.2,         // 角速度 [deg/s]\n  "shower": "ORI",\n  "az": 52.1, "el": 38.4,\n  "frames": 25,\n  "clip": "s3://nuabe/KSO/20261003/M20261003_211452_KSO.avi",\n  "sha256": "9f1c…"\n}',
      sts: '{\n  "KSO": { "state": "observing", "diskUsedGB": 3210,\n           "diskGB": 8192, "cpu": 32, "tempPC": 28,\n           "cond": { "cloud": 0.1, "limMag": 5.4 },\n           "lastEvent": 1791017400000 }\n}',
      csv: '時刻,局,等級,継続,角速度,群,ファイル,同時\n2026-10-03T21:14:52+09:00,KSO,-1.4,0.82,13.2,ORI,M20261003_211452_KSO.avi,T1\n2026-10-03T21:14:52+09:00,AKN,-1.1,0.79,12.8,ORI,M20261003_211452_AKN.avi,T1'
    };
    var tabs = [['evt', 'イベント JSON', 'AL.ingest.csv() / 直接 events へ'],
                ['sts', '死活 JSON', 'AL.ingest.status()'],
                ['csv', 'CSV（1 行 1 イベント）', 'AL.ingest.csv()']];
    var pre = el('pre', { style: { margin: '6px 0 0', padding: '8px 10px', background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: '3px', fontSize: '11px', lineHeight: '1.6',
      fontFamily: 'var(--mono)', overflow: 'auto', maxHeight: '210px', whiteSpace: 'pre' } });
    var cap = el('div', { class: 'note' });
    var seg = el('div', { class: 'seg', style: { display: 'flex', gap: '4px' } }, tabs.map(function (t, i) {
      return el('button', { class: 'btn', 'aria-pressed': i === 0 ? 'true' : 'false', text: t[1],
        onclick: function (e) {
          Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', 'false'); x.style.borderColor = ''; });
          e.target.setAttribute('aria-pressed', 'true'); e.target.style.borderColor = 'var(--series-1)';
          pre.textContent = ex[t[0]]; cap.textContent = '取り込み口：' + t[2];
        } });
    }));
    seg.children[0].style.borderColor = 'var(--series-1)';
    pre.textContent = ex.evt; cap.textContent = '取り込み口：' + tabs[0][2];
    AL.add(b, [seg, pre, cap]);
    AL.add(b, el('div', { class: 'note', style: { marginTop: '6px' },
      text: 'UFOCapture が書く A.XML / M.XML をそのまま送ってもよい（AL.ingest.ufo()）。' +
            '局側で XML から要点だけを抜いて JSON にすると 1 件 2 kB に収まり、回線にも保存先にもやさしい。' }));
  })();
  g.appendChild(p6);

  /* ================= 7. 時刻 ================= */
  var p7 = panel('時刻の合わせ方', { col: 'c5', note: '同時観測の精度を決めるのは時刻' });
  (function () {
    var b = p7.querySelector('.body');
    AL.add(b, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
      AL.stat('33', 'ms', '1 フレーム（30 fps）', { sm: true }),
      AL.stat('±130', 'ms', '今の PC 時計のずれ', { sm: true, color: 'var(--warning)' })
    ]));
    AL.add(b, AL.table(['方式', ['精度', 'num'], '必要なもの', '可否'],
      [['NTP（公開サーバー）', '±10–50 ms', 'なし', AL.state('warning', '不足', '▲')],
       ['NTP（局内 GPS 時計）', '±1–5 ms', 'GPS 受信機', AL.state('good', '可', '●')],
       ['PTP（IEEE 1588）', '±0.1 ms', '対応 NIC とスイッチ', AL.state('good', '可', '●')],
       ['GPS 時刻の映像重畳', '±1 ms', 'タイムインサーター', AL.state('good', '最良', '●')]
      ], { scroll: false }));
    AL.add(b, el('div', { class: 'note', style: { marginTop: '6px' },
      text: '2 局の時刻がフレーム長（33 ms）より粗いと、同じ流星かどうかの判定と速度の推定が甘くなる。' +
            '当面は各局に GPS 時計を置いて NTP を局内に閉じ、将来は映像へ GPS 時刻を重畳して ' +
            '1 フレーム単位で突き合わせる。画面の「時刻差」の分布は、この効き具合を見るためのもの。' }));
  })();
  g.appendChild(p7);

  /* ================= 8. 取り込みを試す ================= */
  var p8 = panel('取り込みを試す', { col: 'c7', note: '下の欄に貼って「取り込む」。この画面がそのまま実データに切り替わる' });
  (function () {
    var b = p8.querySelector('.body');
    var sample = '時刻,局,等級,継続,角速度,群,ファイル,同時\n' +
      AL.stamp(now - 3600e3, { sec: true, tz: false }).replace(' ', 'T') + '+09:00,KSO,-1.4,0.82,13.2,ORI,M_KSO.avi,T1\n' +
      AL.stamp(now - 3600e3, { sec: true, tz: false }).replace(' ', 'T') + '+09:00,AKN,-1.1,0.79,12.8,ORI,M_AKN.avi,T1\n' +
      AL.stamp(now - 1800e3, { sec: true, tz: false }).replace(' ', 'T') + '+09:00,FNB,2.1,0.30,19.0,,M_FNB.avi,';
    var ta = el('textarea', { rows: 6, spellcheck: 'false', style: {
      width: '100%', background: 'var(--bg)', color: 'var(--text-1)', border: '1px solid var(--border-2)',
      borderRadius: '3px', fontFamily: 'var(--mono)', fontSize: '11px', padding: '7px', resize: 'vertical' } });
    ta.value = sample;
    var out = el('div', { class: 'note', style: { marginTop: '6px' } });
    AL.add(b, [ta, el('div', { style: { display: 'flex', gap: '8px', marginTop: '7px', alignItems: 'center' } }, [
      el('button', { class: 'btn', text: '取り込む', onclick: function () {
        try {
          var txt = ta.value.trim(), n = 0;
          if (txt.charAt(0) === '<') n = AL.ingest.ufo(txt, AL.STL[1]);
          else if (txt.charAt(0) === '{') { n = AL.ingest.status(JSON.parse(txt)); }
          else n = AL.ingest.csv(txt);
          out.textContent = n + ' 件を取り込んだ。表示は実データに切り替わっている（AL.data.source = "' +
            AL.data.source + '"）。「検出結果」や「概観」で確かめられる。';
          out.style.color = 'var(--good)';
          AL.render(true);
        } catch (e) {
          out.textContent = '取り込めなかった：' + e.message; out.style.color = 'var(--critical)';
        }
      } }),
      el('button', { class: 'btn', text: '模擬データに戻す', onclick: function () {
        AL.ingest.clear(); out.textContent = '模擬データに戻した。'; out.style.color = 'var(--text-3)';
        AL.render(true);
      } }),
      el('span', { class: 'note', text: 'CSV・死活 JSON・UFOCapture の XML を受け付ける' })
    ]), out]);
  })();
  g.appendChild(p8);

  /* ================= 9. 運用の決めごと ================= */
  var p9 = panel('運用の決めごと', { col: 'c5' });
  AL.add(p9.querySelector('.body'), el('ul', { style: { margin: 0, paddingLeft: '1.1em', fontSize: '12px',
    color: 'var(--text-2)', lineHeight: '1.9' } }, [
    el('li', { text: '局で 10 夜ぶん（約 2 TB）を保持する。送れたかどうかに関わらず、その期間は消さない。' }),
    el('li', { text: '夜ごとにマニフェスト（ファイル名・大きさ・SHA-256）を作って送る。中央はこれと突き合わせ、' +
      '欠けたファイルだけを cmd トピックで再送要求する。' }),
    el('li', { text: '回線が切れている間、テレメトリとイベントは局側のキューに貯め、復帰時に時刻つきでまとめて送る。' }),
    el('li', { text: '転送は夜明け後に始め、日没 1 時間前で必ず止める（観測と録画を優先する）。' }),
    el('li', { text: '帯域は観測所の回線の 50 % を上限にし、rsync の --bwlimit で縛る。' }),
    el('li', { text: '可逆圧縮した本体は 1 年保管、閲覧用 H.264 は常時保管。測光に使うのは可逆のほうだけ。' }),
    el('li', { text: '回線で間に合わない局は、月に 1 度の可搬ディスク輪番を併用する（1 回 2–3 TB）。' }),
    el('li', { text: '同時観測の判定は中央で行う。局は自分が見たものだけを送り、突き合わせは持ち込まない。' })
  ]));
  g.appendChild(p9);

  root.appendChild(g);
};

})(AL);
