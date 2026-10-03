/* NU-AbeLab / 画面 ①概観 ②局別監視 */
'use strict';
(function (AL) {

var el = AL.el, panel = AL.panel, C = AL.chart;
AL.V = AL.V || {};

/* 稼働状態の見せ方。色だけに意味を持たせず、記号と語を必ず添える */
var STATE = {
  observing: { kind: 'good',     icon: '●', label: '観測中' },
  clouded:   { kind: 'warning',  icon: '☁', label: '曇天' },
  degraded:  { kind: 'serious',  icon: '▲', label: '縮退運転' },
  fault:     { kind: 'critical', icon: '■', label: '障害' },
  standby:   { kind: 'idle',     icon: '○', label: '待機（薄明）' },
  daytime:   { kind: 'idle',     icon: '☀', label: '昼間' }
};
AL.stateBadge = function (s) { var x = STATE[s] || STATE.daytime; return AL.state(x.kind, x.label, x.icon); };
/* canvas は CSS 変数を解決できないので、図に使う色は実体で持つ。
   状態色は系列色とは別系統（good / warning / serious / critical）で、記号と語を必ず添える。 */
AL.STATE_HEX = { observing: '#0ca30c', clouded: '#fab219', degraded: '#ec835a',
                 fault: '#d03b3b', standby: '#3a4048', daytime: '#23282e' };
AL.stateColor = function (s) { return AL.STATE_HEX[s] || AL.STATE_HEX.daytime; };

/* 選択中の局・期間でまとめて数えるための下ごしらえ */
AL.summary = function (ids, t0, t1) {
  var byStation = {}, total = { n: 0, recSec: 0, activeSec: 0, bytes: 0, obsSec: 0 };
  ids.forEach(function (id) {
    var rows = AL.data.hourly(id, t0, t1);
    var s = { id: id, n: 0, recSec: 0, activeSec: 0, bytes: 0, obsSec: 0, rows: rows };
    rows.forEach(function (h) {
      var w = AL.clamp((Math.min(t1, h.t + 3600e3) - Math.max(t0, h.t)) / 3600e3, 0, 1);
      s.n += h.n * w; s.recSec += h.recSec * w; s.bytes += h.bytes * w;
      if (h.cond.obs) s.obsSec += 3600 * w;
      s.activeSec += h.activeSec * w;
    });
    s.n = Math.round(s.n);
    byStation[id] = s;
    total.n += s.n; total.recSec += s.recSec; total.bytes += s.bytes;
    total.activeSec += s.activeSec; total.obsSec += s.obsSec;
  });
  return { by: byStation, total: total };
};
/* 時系列用：1 時間ごとの検出数 */
function hourSeries(ids, t0, t1) {
  return ids.map(function (id) {
    var st = AL.st(id);
    return { id: id, name: st.name, color: st.hex,
             points: AL.data.hourly(id, t0, t1).map(function (h) { return [h.t, h.n]; }) };
  });
}
/* 状態タイムラインの区間（同じ状態が続くところをまとめる） */
function stateSpans(id, t0, t1) {
  var rows = AL.data.hourly(id, t0, t1), spans = [], cur = null;
  var step = 15 * 60e3;
  for (var t = t0; t < t1; t += step) {
    var R = AL.data.rate(AL.st(id), t + step / 2);
    var s = R.state;
    if (!cur || cur.state !== s) { cur = { state: s, t0: t, t1: t + step }; spans.push(cur); }
    else cur.t1 = t + step;
  }
  return spans.map(function (s) {
    var x = STATE[s.state] || STATE.daytime;
    return { t0: s.t0, t1: s.t1, label: x.label, color: AL.stateColor(s.state) };
  });
}
AL.stateSpans = stateSpans;

/* ================= ① 概観 ================= */
AL.V.overview = function (root, ui) {
  var ids = ui.stations, t0 = ui.t0, t1 = ui.t1, now = AL.now();
  var sum = AL.summary(ids, t0, t1);
  var g = el('div', { class: 'grid' });

  /* --- 局カード --- */
  ids.forEach(function (id) {
    var st = AL.st(id), s = AL.data.status(id, now), S = sum.by[id];
    var diskF = s.diskUsedGB / s.diskGB;
    var card = panel(st.name + '局', { note: st.full.replace(/^(日本大学|東京大学宇宙線研究所|東京大学) /, ''),
      right: [AL.stateBadge(s.state)], cls: 'stcard' });
    card.style.borderLeft = '3px solid ' + st.hex;
    card.classList.add('c4');
    var body = card.querySelector('.body');
    AL.add(body, AL.stat(AL.int(S.n), '件', ui.rangeLabel + 'の検出', { color: st.hex }));
    var dl = el('dl');
    var prev = AL.data.nightSummary(id, AL.nightOf(now - (AL.data.cond(st, now).obs ? 0 : 20 * 3600e3)));
    [['トリガー率', s.rate > 0 ? AL.f(s.rate, 0) + ' 件/時'
        : (prev.obsHours ? AL.f(prev.n / prev.obsHours, 0) + ' 件/時（前夜平均）' : '—')],
     ['限界等級', s.cond.obs ? AL.mag(s.cond.limMag) + ' 等'
        : (prev.nc ? AL.mag(prev.lim) + ' 等（前夜平均）' : '—')],
     ['雲量', AL.pct(s.cond.cloud)],
     ['気温', AL.f(s.cond.temp, 1) + ' ℃'],
     ['最終イベント', s.lastEvent ? AL.ago(s.lastEvent, now) : '—']
    ].forEach(function (r) { AL.add(dl, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]); });
    AL.add(body, dl);
    AL.add(body, el('div', { style: { marginTop: '8px' } }, [
      el('div', { class: 'meterrow' }, [
        el('span', { class: 'lb', text: 'ディスク' }),
        AL.meter(diskF, diskF > 0.9 ? 'var(--critical)' : diskF > 0.8 ? 'var(--warning)' : '#5a6472'),
        el('span', { class: 'vv', text: (diskF > 0.9 ? '■ ' : diskF > 0.8 ? '▲ ' : '') + AL.pct(diskF) })
      ])
    ]));
    if (s.fault) AL.add(body, el('div', { class: 'note', style: { color: 'var(--serious)', marginTop: '4px' },
      text: '▲ ' + s.fault.text }));
    g.appendChild(card);
  });

  /* --- 検出数の時系列 --- */
  var ser = hourSeries(ids, t0, t1);
  var p1 = panel('検出イベント数', { note: '1 時間ごと・局別の積み上げ', col: 'c8',
    right: [el('span', { class: 'note', text: ui.rangeLabel }) ] });
  var b1 = p1.querySelector('.body');
  C.timeseries(b1, { t0: t0, t1: t1, series: ser, kind: 'bar', stack: true, step: 3600e3,
    height: 196, yfmt: function (v) { return AL.int(v); }, tipfmt: function (v) { return AL.int(v) + ' 件'; } });
  C.legend(b1, ser.map(function (s) {
    return { name: s.name, color: s.color, value: AL.int(AL.sum(s.points.map(function (p) { return p[1]; }))) + ' 件' };
  }), { square: true });
  g.appendChild(p1);

  /* --- 期間の合計 --- */
  var pairs = AL.data.pairs(t0, t1);
  var p2 = panel('期間の集計', { col: 'c4', note: ui.rangeLabel });
  var b2 = p2.querySelector('.body');
  AL.add(b2, AL.stat(AL.int(sum.total.n), '件', '検出イベント（全選択局）'));
  var kv = el('div');
  [['同時観測（木曽×明野）', AL.int(pairs.length) + ' 組'],
   ['観測時間', AL.dur(sum.total.obsSec)],
   ['録画時間', AL.dur(sum.total.recSec)],
   ['記録量', AL.bytes(sum.total.bytes / 1024)],
   ['1 時間あたり', AL.f(sum.total.obsSec > 0 ? sum.total.n / (sum.total.obsSec / 3600) : 0, 1) + ' 件/時']
  ].forEach(function (r) {
    AL.add(kv, el('div', { class: 'meterrow', style: { gridTemplateColumns: '1fr auto' } }, [
      el('span', { class: 'lb', text: r[0] }), el('span', { class: 'vv', text: r[1] })
    ]));
  });
  AL.add(b2, kv);
  g.appendChild(p2);

  /* --- 稼働状態のタイムライン --- */
  var p3 = panel('稼働状態', { note: '観測中 / 曇天 / 縮退 / 障害 / 待機・昼間', col: 'c12' });
  var b3 = p3.querySelector('.body');
  C.timeline(b3, { t0: t0, t1: t1, rows: ids.map(function (id) {
    return { name: AL.st(id).name, spans: stateSpans(id, t0, t1) };
  }) });
  C.legend(b3, Object.keys(STATE).map(function (k) {
    return { name: STATE[k].icon + ' ' + STATE[k].label, color: AL.stateColor(k) };
  }), { square: true, force: true });
  g.appendChild(p3);

  /* --- 直近イベント --- */
  var ev = AL.data.events(ids, t0, t1, 60);
  var p4 = panel('直近の検出イベント', { note: '新しい順・最大 60 件', col: 'c7' });
  AL.add(p4.querySelector('.body'), AL.table(
    ['時刻', '局', ['等級', 'num'], ['継続', 'num'], ['角速度', 'num'], '群', '同時'],
    ev.map(function (e) {
      var st = AL.st(e.st);
      return [AL.stamp(e.t, { sec: true, date: false, tz: false }),
        el('span', null, [el('span', { class: 'swatch', style: { display: 'inline-block', width: '8px', height: '8px',
          borderRadius: '2px', background: st.hex, marginRight: '5px' } }), st.name]),
        AL.mag(e.mag), AL.f(e.dur, 2) + ' s', AL.f(e.vang, 1) + ' °/s',
        e.shower || '散在', e.shared ? '◎' : ''];
    }), { max: '330px' }));
  g.appendChild(p4);

  /* --- 今夜の条件 --- */
  var st0 = AL.st(ids[0] || 'KSO');
  var n = AL.night(now, st0), act = AL.activeShowers(now);
  var p5 = panel('今夜の観測条件', { note: st0.name + '局の時刻', col: 'c5' });
  var b5 = p5.querySelector('.body');
  AL.add(b5, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' } }, [
    AL.stat(AL.f(n.moon.age, 1), '日', '月齢', { sm: true }),
    AL.stat(AL.pct(n.moon.illum), '', '輝面比', { sm: true }),
    AL.stat(AL.f(n.darkHours, 1), 'h', '暗夜時間', { sm: true })
  ]));
  var rows = [
    ['観測開始（日没 +30 分）', n.obsStart ? AL.stamp(n.obsStart, { date: false }) : '—'],
    ['天文薄明終了', n.duskEnd ? AL.stamp(n.duskEnd, { date: false }) : '—'],
    ['天文薄明開始', n.dawnStart ? AL.stamp(n.dawnStart, { date: false }) : '—'],
    ['観測終了（日の出 −30 分）', n.obsEnd ? AL.stamp(n.obsEnd, { date: false }) : '—'],
    ['観測可能時間', AL.f(n.obsHours, 1) + ' 時間']
  ];
  AL.add(b5, AL.table(['', ['', 'num']], rows.map(function (r) { return [r[0], r[1]]; }), { scroll: false }));
  AL.add(b5, el('div', { class: 'note', style: { marginTop: '6px' },
    text: '活動中の流星群：' + (act.length ? act.slice(0, 4).map(function (x) {
      return x.name + '（ZHR ' + AL.f(x.zhr, 0) + '）';
    }).join('・') : 'なし（散在流星のみ）') }));
  g.appendChild(p5);

  root.appendChild(g);
};

/* ================= ② 局別監視 ================= */
AL.V.station = function (root, ui) {
  var t0 = ui.t0, t1 = ui.t1, now = AL.now();
  ui.stations.forEach(function (id) {
    var st = AL.st(id), s = AL.data.status(id, now);
    var rows = AL.data.hourly(id, t0, t1);
    var S = AL.summary([id], t0, t1).by[id];
    var g = el('div', { class: 'grid', style: { marginBottom: '14px' } });

    /* 見出し */
    var head = panel(st.name + '局 — ' + st.full, {
      col: 'c12', flat: true,
      note: (function () {
        var v = AL.fov(st);
        return st.cam + '／' + AL.f(v.fl, 0) + ' mm／視野 ' + AL.f(v.w, 1) + '° × ' + AL.f(v.h, 1) + '°／' +
               AL.compass16(st.az) + '（方位 ' + AL.f(st.az, 0) + '°）・仰角 ' + AL.f(st.el, 0) + '°' +
               '／インフラサウンド ' + AL.INFRA.model.split('（')[0];
      })(),
      right: [AL.stateBadge(s.state), el('span', { class: 'note', text: AL.latlon ? '' : '' })]
    });
    head.style.borderLeft = '3px solid ' + st.hex;
    AL.add(head.querySelector('.body'), el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(6,1fr)', gap: '6px', padding: '0 10px 8px' } }, [
      AL.stat(AL.int(S.n), '件', ui.rangeLabel + 'の検出', { sm: true, color: st.hex }),
      AL.stat(s.rate > 0 ? AL.f(s.rate, 0) : '—', '件/時', '現在のトリガー率', { sm: true }),
      AL.stat(AL.f(S.obsSec > 0 ? S.n / (S.obsSec / 3600) : 0, 1), '件/時', '期間平均', { sm: true }),
      AL.stat(AL.dur(S.recSec), '', '録画時間', { sm: true }),
      AL.stat(AL.bytes(S.bytes / 1024), '', '記録量', { sm: true }),
      AL.stat(s.lastEvent ? AL.ago(s.lastEvent, now) : '—', '', '最終イベント', { sm: true })
    ]));
    g.appendChild(head);

    /* トリガー率 */
    var p1 = panel('トリガー率', { note: '1 時間あたりの検出件数', col: 'c6' });
    C.timeseries(p1.querySelector('.body'), {
      t0: t0, t1: t1, height: 150,
      series: [{ name: st.name, color: st.hex, area: true, points: rows.map(function (h) { return [h.t, h.n]; }) }],
      yfmt: function (v) { return AL.int(v); }, tipfmt: function (v) { return AL.int(v) + ' 件/時'; }
    });
    g.appendChild(p1);

    /* 限界等級 */
    var p2 = panel('限界等級', { note: '空の暗さと雲から推定', col: 'c3' });
    C.timeseries(p2.querySelector('.body'), {
      t0: t0, t1: t1, height: 150, ymin: -1, ymax: 7,
      series: [{ name: '限界等級', color: '#5598e7', points: rows.map(function (h) { return [h.t, h.cond.obs ? h.cond.limMag : null]; }) }],
      yfmt: function (v) { return AL.f(v, 0); }, tipfmt: function (v) { return AL.mag(v) + ' 等'; }
    });
    g.appendChild(p2);

    /* 雲量 */
    var p3 = panel('雲量', { note: '0 = 快晴', col: 'c3' });
    C.timeseries(p3.querySelector('.body'), {
      t0: t0, t1: t1, height: 150, ymin: 0, ymax: 100,
      series: [{ name: '雲量', color: '#a3a8b0', area: true, points: rows.map(function (h) { return [h.t, h.cond.cloud * 100]; }) }],
      yfmt: function (v) { return AL.f(v, 0) + '%'; }, tipfmt: function (v) { return AL.f(v, 0) + ' %'; }
    });
    g.appendChild(p3);

    /* 機器の状態 */
    var p4 = panel('機器', { col: 'c4', note: st.pc });
    var b4 = p4.querySelector('.body');
    var dF = s.diskUsedGB / s.diskGB;
    [['ディスク', dF, (dF > 0.9 ? '■ ' : dF > 0.8 ? '▲ ' : '') + AL.bytes(s.diskUsedGB) + ' / ' + AL.bytes(s.diskGB),
       dF > 0.9 ? 'var(--critical)' : dF > 0.8 ? 'var(--warning)' : '#5a6472'],
     ['CPU', s.cpu / 100, (s.cpu > 85 ? '▲ ' : '') + AL.f(s.cpu, 0) + ' %', s.cpu > 85 ? 'var(--warning)' : '#5a6472'],
     ['筐体温度', AL.clamp(s.tempPC / 60, 0, 1), (s.tempPC > 45 ? '▲ ' : '') + AL.f(s.tempPC, 1) + ' ℃',
       s.tempPC > 45 ? 'var(--warning)' : '#5a6472']
    ].forEach(function (r) {
      AL.add(b4, el('div', { class: 'meterrow' }, [
        el('span', { class: 'lb', text: r[0] }), AL.meter(r[1], r[3]), el('span', { class: 'vv', text: r[2] })
      ]));
    });
    var remain = (s.diskGB - s.diskUsedGB) * 1024 / (S.bytes / Math.max(1, (t1 - t0) / 86400e3) || 1);
    AL.add(b4, AL.table(['', ['', 'num']], [
      ['連続稼働', AL.f(s.uptimeH / 24, 1) + ' 日'],
      ['記録レート', AL.f(AL.RIG.rateMBs, 0) + ' MB/s（' + AL.RIG.fps + ' fps 無圧縮）'],
      ['ディスク残り', isFinite(remain) ? AL.f(remain, 0) + ' 夜ぶん' : '—'],
      ['回線', st.net]
    ], { scroll: false }));
    g.appendChild(p4);

    /* 空の条件 */
    var p5 = panel('空の条件', { col: 'c4', note: '夜空輝度 ' + AL.f(st.sqm, 1) + ' mag/arcsec²（快晴・月なし）' });
    var b5 = p5.querySelector('.body');
    AL.add(b5, el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' } }, [
      AL.stat(s.cond.obs ? AL.f(s.cond.sqm, 2) : '—', '', '夜空輝度 mag/arcsec²', { sm: true }),
      AL.stat(s.cond.obs ? AL.mag(s.cond.limMag) : '—', '等', '限界等級', { sm: true }),
      AL.stat(AL.f(s.cond.moonAlt, 0), '°', '月の高度', { sm: true }),
      AL.stat(AL.pct(s.cond.illum), '', '月の輝面比', { sm: true })
    ]));
    AL.add(b5, el('div', { class: 'note', style: { marginTop: '6px' },
      text: '月が出ている間は背景が明るくなり、UFOCapture の閾値が上がって暗い流星が落ちる。' +
            'DIMS では暗夜（月なし・天文薄明の外）のデータだけを macro 探索に使う。' }));
    g.appendChild(p5);

    /* 障害・事象 */
    var inc = [];
    for (var d = AL.nightOf(t0); d <= AL.nightOf(t1); d += 86400e3) inc = inc.concat(AL.data.incidents(st, d));
    inc = inc.filter(function (x) { return x.t1 > t0 && x.t0 < t1; });
    var p6 = panel('事象ログ', { col: 'c4', note: inc.length ? inc.length + ' 件' : '期間内に異常なし' });
    AL.add(p6.querySelector('.body'), inc.length
      ? AL.table(['時刻', '種別', '内容', ['継続', 'num']], inc.map(function (x) {
          return [AL.stamp(x.t0, { date: false }),
                  AL.state(x.level === 'serious' ? 'serious' : 'warning', x.kind, '▲'),
                  x.text, AL.dur((x.t1 - x.t0) / 1000)];
        }), { max: '150px' })
      : el('div', { class: 'note', text: 'この期間、停止や再起動は記録されていない。' }));
    g.appendChild(p6);

    root.appendChild(g);
  });
  if (!ui.stations.length) root.appendChild(el('div', { class: 'note', text: '観測局を 1 つ以上選んでください。' }));
};

})(AL);
