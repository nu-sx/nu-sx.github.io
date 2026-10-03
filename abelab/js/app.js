/* NU-AbeLab / 画面の骨格
   上部に観測局・時間範囲・自動更新のピッカーを置き、下にパネルの格子を描く。
   Grafana の「局ごとの DAQ 監視」画面の操作感に合わせてある。 */
'use strict';
(function (AL) {

var el = AL.el;
var VIEWS = [
  { id: 'overview', label: '概観',     hint: '3 局の稼働と検出の全体像' },
  { id: 'station',  label: '局別監視', hint: '局ごとの DAQ 監視' },
  { id: 'events',   label: '検出結果', hint: 'イベントの分布と一覧' },
  { id: 'pairs',    label: '同時観測', hint: '木曽 × 明野の視野と時刻合わせ' },
  { id: 'plan',     label: '観測条件', hint: '月・薄明・流星群・天候' },
  { id: 'link',     label: 'データ連携', hint: '観測局とのデータのやり取り' }
];
var RANGES = [
  { id: '6h',  label: '直近 6 時間',  ms: 6 * 3600e3 },
  { id: '24h', label: '直近 24 時間', ms: 24 * 3600e3 },
  { id: '3d',  label: '直近 3 日',    ms: 3 * 86400e3 },
  { id: '7d',  label: '直近 7 日',    ms: 7 * 86400e3 },
  { id: '30d', label: '直近 30 日',   ms: 30 * 86400e3 }
];
var REFRESH = [
  { id: 'off', label: '手動', ms: 0 },
  { id: '1m',  label: '1 分', ms: 60e3 },
  { id: '5m',  label: '5 分', ms: 300e3 },
  { id: '15m', label: '15 分', ms: 900e3 }
];

var ui = AL.ui = { view: 'overview', stations: AL.STL.slice(), range: '24h', refresh: '5m', tz: 'jst' };
try {
  var saved = JSON.parse(localStorage.getItem('nu-abelab') || '{}');
  ['view', 'range', 'refresh', 'tz'].forEach(function (k) { if (saved[k]) ui[k] = saved[k]; });
  if (Array.isArray(saved.stations) && saved.stations.length) ui.stations = saved.stations.filter(function (s) { return AL.ST[s]; });
} catch (e) {}
function save() { try { localStorage.setItem('nu-abelab', JSON.stringify(ui)); } catch (e) {} }

var head, main, clockEl, lastEl, timer = null, lastAt = 0;

function picker(label, kids) {
  return el('div', { class: 'picker' }, [el('span', { class: 'lbl', text: label }), el('div', { class: 'val' }, kids)]);
}
function select(opts, value, onChange) {
  var s = el('select', { onchange: function () { onChange(s.value); } });
  opts.forEach(function (o) {
    var op = el('option', { value: o.id, text: o.label });
    if (o.id === value) op.selected = true;
    s.appendChild(op);
  });
  return s;
}

function buildHead() {
  AL.clear(head);
  /* 1 段目：名前と時計 */
  var r1 = el('div', { class: 'topbar-row' }, [
    el('div', { class: 'brand' }, [
      el('span', { class: 'lab', text: 'NU-AbeLab' }),
      el('b', { text: '流星観測ダッシュボード' }),
      el('span', { class: 'sub', text: '日本大学 理工学部 航空宇宙工学科 阿部研究室　船橋・木曽・明野' })
    ]),
    (function () {
      var on = AL.STL.filter(function (id) { return AL.data.status(id, AL.now()).state === 'observing'; }).length;
      var obs = AL.STL.filter(function (id) { return AL.data.cond(AL.st(id), AL.now()).obs; }).length;
      return AL.state(obs === 0 ? 'idle' : on === obs ? 'good' : 'warning',
        obs === 0 ? '観測時間外（昼間・薄明）' : '観測中 ' + on + ' / ' + obs + ' 局',
        obs === 0 ? '☀' : '●');
    })(),
    (clockEl = el('div', { class: 'clock' })),
    el('button', { class: 'btn', text: ui.tz === 'jst' ? 'JST' : 'UTC', title: '時刻の基準を切り替える',
      onclick: function () { ui.tz = ui.tz === 'jst' ? 'utc' : 'jst'; AL.tz = ui.tz; save(); render(true); } })
  ]);
  /* 2 段目：局・期間・更新 */
  var chips = AL.STL.map(function (id) {
    var st = AL.st(id), on = ui.stations.indexOf(id) >= 0;
    return el('button', { class: 'chip', 'aria-pressed': String(on), title: st.full,
      onclick: function () {
        var i = ui.stations.indexOf(id);
        if (i >= 0) { if (ui.stations.length > 1) ui.stations.splice(i, 1); }
        else ui.stations = AL.STL.filter(function (x) { return x === id || ui.stations.indexOf(x) >= 0; });
        save(); render(true);
      } }, [el('span', { class: 'swatch', style: { background: st.hex } }), st.name]);
  });
  var r2 = el('div', { class: 'topbar-row' }, [
    picker('観測局', chips),
    picker('時間範囲', [select(RANGES, ui.range, function (v) { ui.range = v; save(); render(); })]),
    picker('自動更新', [select(REFRESH, ui.refresh, function (v) { ui.refresh = v; save(); arm(); render(); })]),
    el('button', { class: 'btn icon', text: '⟳ 更新', onclick: function () { render(); } }),
    (lastEl = el('span', { class: 'note' })),
    el('span', { style: { marginLeft: 'auto' } }),
    el('span', { class: 'note', text: AL.data.source === 'real' ? '実データを表示中' : '模擬データ（デモ）' })
  ]);
  AL.add(head, [r1, r2]);
  /* 3 段目：タブ */
  var tabs = el('div', { class: 'tabs', role: 'tablist' }, VIEWS.map(function (v) {
    return el('button', { class: 'tab', role: 'tab', 'aria-selected': String(v.id === ui.view), title: v.hint,
      onclick: function () { ui.view = v.id; location.hash = v.id; save(); render(true); } }, [v.label]);
  }));
  head.appendChild(tabs);
}

function tick() {
  if (clockEl) {
    var t = AL.now();
    clockEl.innerHTML = '<b>' + AL.hms(t) + '</b> ' + (AL.tz === 'jst' ? 'JST' : 'UTC') + '　' + AL.ymd(t);
  }
  if (lastEl && lastAt) lastEl.textContent = '最終更新 ' + AL.ago(lastAt);
}
function arm() {
  if (timer) clearInterval(timer);
  var r = REFRESH.filter(function (x) { return x.id === ui.refresh; })[0];
  if (r && r.ms) timer = setInterval(function () { render(); }, r.ms);
}

function render(rebuildHead) {
  AL.tz = ui.tz;
  var now = AL.now();
  var R = RANGES.filter(function (x) { return x.id === ui.range; })[0] || RANGES[1];
  ui.t1 = now; ui.t0 = now - R.ms; ui.rangeLabel = R.label; ui.rangeMs = R.ms;
  if (rebuildHead !== false) buildHead();
  AL.clear(main);
  var fn = AL.V[ui.view] || AL.V.overview;
  try { fn(main, ui); }
  catch (e) {
    main.appendChild(el('div', { class: 'note', style: { color: 'var(--critical)' },
      text: '描画でエラーが発生した: ' + e.message }));
    if (window.console) console.error(e);
  }
  lastAt = Date.now();
  tick();
}
AL.render = render;

function boot() {
  document.body.appendChild(el('a', { class: 'skiplink', href: '#main', text: '本文へ' }));
  document.body.appendChild(el('div', { class: 'demo-bar' }, [
    el('b', { text: 'デモ版' }),
    '　表示している観測値・イベントは模擬データです（「同時観測」の気象衛星ひまわりは気象庁の実データ）。',
    el('span', { style: { opacity: .8 } }, ['　実データは ', el('code', { text: 'AL.ingest.ufo() / .csv() / .status()' }), ' から差し込めます。'])
  ]));
  head = el('header', { class: 'topbar' });
  main = el('main', { id: 'main' });
  document.body.appendChild(head);
  document.body.appendChild(main);
  document.body.appendChild(el('footer', null, [
    el('b', { text: 'NU-AbeLab 流星観測ダッシュボード' }), '　日本大学 理工学部 航空宇宙工学科 阿部研究室', el('br'),
    '観測局：日本大学 船橋キャンパス／東京大学 木曽観測所／東京大学宇宙線研究所 明野観測所。', el('br'),
    '機材・運用の諸元は DIMS（Dark matter and Interstellar Meteoroid Study）に準拠：' +
    'Canon ME20F-SH 系（35 mm フルサイズ CMOS）＋24 mm レンズ、視野 73.7° × 53.1°、1920 × 1080・30 fps、' +
    'トリガーは UFOCapture、日没 30 分後から日の出 30 分前まで自動運用。' +
    '木曽（方位 50°・仰角 38°）と船橋（方位 0°・仰角 47°）を固定し、明野は 2 局以上でカバーできる' +
    '面積が最大になる向き（方位 25°・仰角 46.5°）を既定とした（「同時観測」の地図から変えられる）。', el('br'),
    '参考：S. Abe et al., “DIMS (Dark matter and Interstellar Meteoroid Study) Experiment”, PoS(ICRC2025)529。', el('br'),
    '地図：都道府県境界は国土数値情報を簡略化したもの。気象衛星ひまわりの画像は気象庁（https://www.jma.go.jp/）から取得している。', el('br'),
    el('span', { style: { opacity: .75 }, text: '本ページは静的なデモで、外部への通信は気象衛星を選んだときの気象庁サーバーへの取得だけである。' })
  ]));

  var h = (location.hash || '').replace('#', '');
  if (VIEWS.some(function (v) { return v.id === h; })) ui.view = h;
  window.addEventListener('hashchange', function () {
    var k = (location.hash || '').replace('#', '');
    if (VIEWS.some(function (v) { return v.id === k; }) && k !== ui.view) { ui.view = k; save(); render(true); }
  });
  render(true);
  arm();
  setInterval(tick, 1000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})(AL);
