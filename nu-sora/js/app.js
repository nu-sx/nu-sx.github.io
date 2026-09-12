/* NU-SORA デモ / アプリ本体：ルーティング・ヘッダ・時計・テーマ */
'use strict';
(function (NS) {
var el = NS.el;

/* 画面は 2 段に分ける。1 段目＝横断的な画面、2 段目＝観測テーマごとの画面 */
var TABS = [
  { id:'dashboard', label:'ダッシュボード',   tag:'OVERVIEW',      icon:'◎', row:0 },
  { id:'map',       label:'観測局マップ',     tag:'NETWORK',       icon:'⊕', row:0 },
  { id:'stations',  label:'観測局・機材',     tag:'PF-1',          icon:'⚙', row:0 },
  { id:'telescope', label:'リモート望遠鏡',   tag:'PF-1',          icon:'⊙', row:0 },
  { id:'data',      label:'データ・API',      tag:'PF-2',          icon:'⌗', row:0 },
  { id:'about',     label:'このデモについて', tag:'',              icon:'ⓘ', row:0 },
  { id:'fireball',  label:'火球・隕石',       tag:'G-1',           icon:'☄', row:1 },
  { id:'reentry',   label:'デブリ再突入',     tag:'G-2',           icon:'🛰', row:1 },
  { id:'infra',     label:'インフラサウンド', tag:'G-4',           icon:'〰', row:1 },
  { id:'quake',     label:'地震・津波',       tag:'G-5 / DT-5',    icon:'▤', row:1 },
  { id:'weather',   label:'気象・熱中症',     tag:'G-6',           icon:'🌧', row:1 },
  { id:'skyglow',   label:'夜空の明るさ',     tag:'G-3',           icon:'✦', row:1 },
  { id:'alerts',    label:'通報・社会実装',   tag:'G-7',           icon:'⚑', row:1 }
];
var ROW_LABEL = ['観測網', '観測テーマ'];
var PARENT = { station:'stations' };

var leaveFns = [];
NS.onLeave = function (f) { leaveFns.push(f); };

function go(view, arg) {
  location.hash = '#' + view + (arg ? '/' + arg : '');
}
NS.go = go;

function parseHash() {
  var h = (location.hash || '').replace(/^#/, '');
  if (!h) return { view:'dashboard', arg:null };
  var p = h.split('/');
  return { view:p[0], arg:p[1] ? decodeURIComponent(p[1]) : null };
}

/* 現在の画面を描き直す（更新ボタン用。スクロール位置を保つ） */
NS.rerender = function () {
  var y = window.scrollY || 0;
  render({ keepScroll: true });
  window.scrollTo(0, y);
};

function render(opt) {
  opt = opt || {};
  var r = parseHash();
  if (!NS.V[r.view]) r = { view:'dashboard', arg:null };
  leaveFns.forEach(function (f) { try { f(); } catch (e) {} });
  leaveFns = [];
  var main = document.getElementById('main');
  NS.clear(main);
  var active = PARENT[r.view] || r.view;
  Array.prototype.forEach.call(document.querySelectorAll('nav.tabs button'), function (b) {
    b.setAttribute('aria-selected', b.getAttribute('data-v') === active ? 'true' : 'false');
  });
  try {
    NS.V[r.view](main, go, r.arg);
  } catch (err) {
    NS.add(main, el('div', { class:'panel' }, el('div', { class:'panel-b' }, [
      el('h3', { text:'表示に失敗しました' }),
      el('pre', { class:'api', text:String(err && err.stack || err) })
    ])));
    if (window.console) console.error(err);
  }
  if (!opt.keepScroll) { main.scrollIntoView({ block:'start' }); window.scrollTo(0, 0); }
}

function buildHeader() {
  var head = document.getElementById('head');
  NS.clear(head);
  var clock = el('div', { class:'clock' }, [
    el('div', { class:'jst', id:'clk-jst', text:'--:--:--' }),
    el('div', { class:'utc', id:'clk-utc', text:'---- UTC' })
  ]);
  var themeBtn = el('button', { class:'iconbtn', id:'themebtn', text:'配色', title:'明暗の配色を切り替える',
    onclick:function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('nusora-theme', cur); } catch (e) {}
      themeBtn.textContent = NS.t(cur === 'light' ? '配色：明' : '配色：暗');
      render();
    } });
  var langBtn = el('div', { class:'seg langseg' }, NS.LANGS.map(function (L) {
    return el('button', { text:L.short, title:L.label, 'aria-pressed':NS.lang === L.id ? 'true' : 'false',
      onclick:function () { NS.setLang(L.id); } });
  }));
  var saved = 'dark';
  try { saved = localStorage.getItem('nusora-theme') || 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', saved);
  themeBtn.textContent = NS.t(saved === 'light' ? '配色：明' : '配色：暗');

  NS.add(head, el('div', { class:'top-in' }, [
    el('div', { class:'brand' }, [
      el('div', { class:'eyebrow', text:'NU-SORA · Nihon University Sky Observation and Resilience Array' }),
      el('h1', { text:'日本大学 全学屋上観測網「ソラ」' }),
      el('div', { class:'sub', text:'観測ポータル デモ版　全国 14 局 ／ 全天光学カメラ・4K分光カメラ・インフラサウンド・気象・夜空輝度計・GNSS' })
    ]),
    el('div', { class:'hstat' }, [
      el('span', { class:'badge ok', id:'netbadge' }, [el('span', { class:'dot' }), '観測網 稼働中']),
      clock, langBtn, themeBtn
    ])
  ]));
  NS.add(head, el('nav', { class:'tabs', role:'tablist' }, [0, 1].map(function (row) {
    return el('div', { class:'tabrow' }, [
      el('span', { class:'grp', text:ROW_LABEL[row] })
    ].concat(TABS.filter(function (t) { return t.row === row; }).map(function (t) {
      return el('button', { role:'tab', 'data-v':t.id, 'aria-selected':'false',
        title:t.label + (t.tag ? '（' + t.tag + '）' : ''), onclick:function () { go(t.id); } }, [
        el('span', { class:'ic', text:t.icon }),
        el('span', { class:'lb', text:t.label }),
        t.tag ? el('span', { class:'tg', text:t.tag }) : null
      ]);
    })));
  })));
}

NS.rebuildChrome = function () { buildHeader(); };

function tick() {
  var t = NS.now();
  var j = document.getElementById('clk-jst'), u = document.getElementById('clk-utc');
  if (j) j.textContent = NS.fmtJST(t, { timeOnly:true });
  if (u) u.textContent = NS.fmtJST(t, { dateOnly:true }) + NS.t(' JST ／ ') + NS.fmtUTC(t) + ' UTC';
  var b = document.getElementById('netbadge');
  if (b) {
    var n = NS.netSummary();
    b.className = 'badge ' + (n.down ? 'warn' : 'ok');
    NS.clear(b);
    NS.add(b, [el('span', { class:'dot' }), NS.t('観測網 ') + n.ok + '/' + NS.STATIONS.length + NS.t(' 局 稼働中')]);
  }
}

function boot() {
  NS.buildCatalog();
  if (NS.applyPageLang) NS.applyPageLang();
  buildHeader();
  window.addEventListener('hashchange', function () { render(); });
  render();
  tick();
  setInterval(tick, 1000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})(NS);
