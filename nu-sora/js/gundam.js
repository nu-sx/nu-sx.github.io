/* NU-SORA デモ / 船橋局「ガンダム望遠鏡」
   月面衝突閃光観測専用望遠鏡システム（日本大学理工学部・船橋キャンパス）。
   諸元と 2018 年ふたご座流星群の観測結果は、Abe et al.「遊星人」(2024) の
   実測値を用いている。リモート運用とデジタルツイン試験の部分はデモ用の模擬。 */
'use strict';
(function (NS) {
var el = NS.el, s = NS.s, panel = NS.panel, kv = NS.kv, badge = NS.badge, f = NS.f;

/* ---------------- 諸元（実データ） ---------------- */
NS.GUNDAM = {
  name:'ガンダム望遠鏡',
  formal:'月面衝突閃光観測専用望遠鏡システム',
  site:{ lat:35 + 43 / 60 + 31.152 / 3600, lon:140 + 3 / 60 + 32.328 / 3600, alt:40,
         label:'日本大学理工学部 船橋キャンパス' },
  mount:'昭和機械製作所 フォーク式赤道儀 35EF（2 筒同架）',
  built:'日本大学理工学研究所「先導研究推進助成金」により構築',
  /* 視野と分解能はセンサーの実寸から求める（下の NS.gdFov / NS.gdPix）。
     ASI174MM は 5.86 µm 角・1936 × 1216 なので、実寸は 11.345 × 7.126 mm（対角 13.4 mm）。
     この値で計算すると、遊星人 (2024) 表 1 の 1.08° × 0.68°・2.0 ″/px（副鏡 600 mm）と一致する。 */
  sensor:{ pitch:0.00586, nx:1936, ny:1216 },
  tubes:[
    { key:'primary',   name:'主鏡 RiFast 400', maker:'Officina Stellare', type:'カセグレン式',
      dia:400, fl:1520, fr:3.8 },
    { key:'secondary', name:'副鏡 Veloce 200', maker:'Officina Stellare', type:'カセグレン式',
      dia:200, fl:600,  fr:3.0 }
  ],
  camera:{ model:'ZWO ASI174MM-Cool', pix:'1936 × 1216', pitch:5.86, exp:16.7, fps:60,
           adc:12, iface:'USB3.0', band:'350 – 800 nm（量子効率 20 % 以上）',
           note:'GPS に同期した冷却式高感度 CMOS。フィルター無しでカセグレン焦点に直結し、SER 形式の動画で記録する' },
  /* 2018 年ふたご座流星群キャンペーンの実測（電通大と同時検出が成立した 11 個） */
  lif:{
    date:'2018-12-15', span:'17:30 – 20:40 JST（約 3 時間）',
    moonAge:7.3, moonIllum:49, vImpact:34.4, rho:3000,
    etaModel:1.4e-3, etaMin:5.0e-4,
    massIndex:'1.78 ± 0.16', sizeIndex:'3.23 ± 0.28', craterIndex:'3.43 ± 0.51',
    rate:4.8e-7, fluxLo:2.1e-5, fluxHi:5.9e-5,
    posErr:'緯度方向 1.5 km / 経度方向 5 km',
    events:[
      /* id, JST, 経度, 緯度, R 等級, 衝突天頂角, KE(η=1.4e-3), 質量 g, 直径 cm, クレータ径 m */
      ['B','17:29:34',-56.5, 31.6, 7.3,24.5,5.03e7, 85.0,3.78,2.99],
      ['C','17:58:49',-51.1, 38.7,10.5,32.9,2.47e6,  4.2,1.39,1.13],
      ['D','18:09:47',-58.0,  0.9,10.2,14.1,3.49e6,  5.9,1.55,1.33],
      ['E','18:44:04',-52.0,-22.9, 9.0,36.7,1.01e7, 17.1,2.22,1.73],
      ['G','19:23:07',-44.1, -9.3, 8.6,31.3,1.45e7, 24.5,2.50,1.98],
      ['H','19:25:42',-75.0,-56.5, 6.4,66.6,1.10e8,185.2,4.90,2.78],
      ['I','19:28:46',-48.7, -7.5, 7.8,26.6,3.25e7, 55.0,3.27,2.60],
      ['J','19:35:56',-65.2, 28.7, 9.0,19.0,1.05e7, 17.8,2.25,1.87],
      ['K','19:54:34',-66.1, 25.5, 9.4,15.7,7.19e6, 12.1,1.98,1.66],
      ['L','20:22:12',-75.8,  0.1, 7.9,12.0,2.73e7, 46.2,3.09,2.55],
      ['M','20:35:52',-32.7, 24.5, 8.6,37.4,1.53e7, 25.8,2.54,1.96]
    ]
  }
};

/* センサーの実寸と焦点距離から視野（度）を出す。fov = 2·atan(寸法 / 2f) */
NS.gdFov = function (fl) {
  var S = NS.GUNDAM.sensor, w = S.pitch * S.nx, h = S.pitch * S.ny;
  return { x:2 * Math.atan(w / 2 / fl) * NS.r2d, y:2 * Math.atan(h / 2 / fl) * NS.r2d };
};
/* 1 画素あたりの分解能（秒角） */
NS.gdPix = function (fl) {
  return Math.atan(NS.GUNDAM.sensor.pitch / fl) * NS.r2d * 3600;
};
/* センサー実寸の表記 */
NS.gdSensor = function () {
  var S = NS.GUNDAM.sensor;
  return NS.f(S.pitch * S.nx, 2) + ' × ' + NS.f(S.pitch * S.ny, 2) + ' mm';
};
NS.GUNDAM.tubes.forEach(function (t) {
  var v = NS.gdFov(t.fl);
  t.fovX = v.x; t.fovY = v.y;
  t.fov = NS.f(v.x, 3) + ' × ' + NS.f(v.y, 3);
  t.fovMin = NS.f(v.x * 60, 1) + '′ × ' + NS.f(v.y * 60, 1) + '′';
  t.res = NS.gdPix(t.fl);
});

/* 発光効率 η(v) = 1.5e-3 · exp(−(9.3 km/s)² / v²) */
NS.lifEta = function (v) { return 1.5e-3 * Math.exp(-Math.pow(9.3, 2) / (v * v)); };
/* 衝突運動エネルギー → 質量 m = 2 KE / v² */
NS.lifMass = function (ke, v) { return 2 * ke / Math.pow(v * 1000, 2); };

/* ---------------- 観測モードとリモート運用 ---------------- */
NS.GD_MODES = [
  { key:'lif',    label:'月面衝突閃光', icon:'☾', tube:'両筒',
    target:'月の夜側（地球照側）', cad:'60 fps 連続', product:'SER 動画 → 動体検出',
    note:'月齢 3 – 10 と 20 – 27 の、夜側が地球を向く時期に観測する' },
  { key:'debris', label:'スペースデブリ', icon:'🛰', tube:'副鏡 200 mm',
    target:'LEO / GEO の追跡目標', cad:'0.5 – 30 s 露出', product:'測光光度曲線・軌道改良',
    note:'広い視野（1.08° × 0.68°）で捕捉し、光度変化から自転周期と姿勢を推定する' },
  { key:'astro',  label:'天体観測', icon:'✦', tube:'主鏡 400 mm',
    target:'小惑星・彗星・恒星掩蔽・変光星', cad:'1 – 120 s 露出', product:'測光・位置測定',
    note:'分解能 0.8″ を活かした位置測定と、掩蔽による小天体の形状推定' }
];

/* 観測条件のインターロック（デモ：局の気象・空の明るさから判定する） */
NS.gdInterlock = function (t, station) {
  var st = station || NS.ST.FNB, w = NS.weather(st, t);
  var items = [
    { key:'rain',  label:'雨量計',        ok:w.rain < 0.2,   val:f(w.rain, 1) + ' mm/h',  lim:'0.2 mm/h 未満' },
    { key:'wind',  label:'風速',          ok:w.wind < 12,    val:f(w.wind, 1) + ' m/s',   lim:'12 m/s 未満' },
    { key:'cloud', label:'雲量（全天カメラ）', ok:w.cloud < 0.5, val:Math.round(w.cloud * 100) + ' %', lim:'50 % 未満' },
    { key:'hum',   label:'湿度',          ok:w.rh < 90,      val:f(w.rh, 0) + ' %',       lim:'90 % 未満' },
    /* 太陽高度は気象オブジェクトが持つ（skyBrightness は薄明のとき mag を返さないだけ） */
    { key:'sun',   label:'太陽高度',      ok:w.sunAlt < -6,  val:f(w.sunAlt, 1) + '°',    lim:'−6° 以下（市民薄明より暗い）' }
  ];
  var open = items.every(function (x) { return x.ok; });
  return { items:items, open:open, w:w, st:st };
};

/* 予約キュー（デモ：日付から決まる固定の並び） */
NS.gdQueue = function (t) {
  var r = NS.rng(NS.hash('gundam' + new Date(t + NS.JST).getUTCDate()));
  var base = NS.tonightAt(19);
  var rows = [
    { mode:'debris', name:'GEO 静止衛星帯 サーベイ（東経 110° 付近）', min:45, who:'理工・航空宇宙' },
    { mode:'lif',    name:'月面衝突閃光モニター（夜側・地球照）',       min:150, who:'理工・物理／NU-SX' },
    { mode:'astro',  name:'(3200) Phaethon 測光',                       min:40, who:'理工・NU-SX' },
    { mode:'debris', name:'再突入予報天体の追跡（TLE 追尾）',           min:35, who:'理工・航空宇宙' },
    { mode:'astro',  name:'恒星掩蔽（小惑星による）',                   min:25, who:'文理・付属校合同' }
  ];
  var tt = base;
  return rows.map(function (x, i) {
    var o = { t0:tt, t1:tt + x.min * 60000, mode:x.mode, name:x.name, min:x.min, who:x.who,
              pri:i === 1 ? '最優先' : (i === 0 ? '通常' : '通常'),
              stat:i === 0 ? '実行中' : (i === 1 ? '待機' : '予約') };
    tt = o.t1 + 5 * 60000;
    return o;
  });
};

/* デジタルツイン試験：実機とモデルの差（デモ） */
NS.gdTwin = function (t) {
  var r = NS.rng(NS.hash('gdtwin' + Math.floor(t / 3600e3)));
  return {
    point:0.6 + r() * 0.5,           /* 指向残差 arcmin */
    track:0.9 + r() * 0.6,           /* 追尾残差 arcsec/min */
    seeing:2.1 + r() * 1.4,          /* シーイング arcsec */
    focusDrift:12 + r() * 9,         /* 焦点ドリフト µm/℃ */
    latency:210 + r() * 90,          /* 指令往復遅延 ms */
    flexure:0.8 + r() * 0.4          /* 鏡筒たわみ arcmin（子午線越え） */
  };
};

/* ---------------- 月面図（衝突閃光の位置） ---------------- */
function moonMap(size) {
  var R = size * 0.46, CX = size / 2, CY = size / 2;
  var g = s('svg', { viewBox:'0 0 ' + size + ' ' + size, class:'moonmap', role:'img',
    'aria-label':'月面衝突閃光の発生位置' });
  NS.add(g, s('circle', { cx:CX, cy:CY, r:R, fill:'#23262B', stroke:'#575F6B', 'stroke-width':1 }));
  /* 昼夜の境（この日は月齢 7.3 の半月で、西側＝経度が負の側が夜） */
  NS.add(g, s('path', { d:'M' + CX + ' ' + (CY - R) + 'A' + R + ' ' + R + ' 0 0 0 ' + CX + ' ' + (CY + R) + 'Z',
    fill:'#101216', opacity:0.85 }));
  NS.add(g, s('text', { x:CX - R * 0.55, y:CY - R * 0.86, class:'axl', 'text-anchor':'middle',
    fill:'var(--muted)', text:'夜側（地球照）' }));
  NS.add(g, s('text', { x:CX + R * 0.5, y:CY - R * 0.86, class:'axl', 'text-anchor':'middle',
    fill:'var(--muted)', text:'昼側' }));
  /* 経緯線（正射投影） */
  for (var la = -60; la <= 60; la += 30) {
    var y = CY - R * Math.sin(la * NS.d2r), rx = R * Math.cos(la * NS.d2r);
    NS.add(g, s('ellipse', { cx:CX, cy:y, rx:rx, ry:0.6, fill:'none', stroke:'#6B737F', 'stroke-width':0.4, opacity:0.5 }));
  }
  for (var lo = -60; lo <= 60; lo += 30) {
    var d = '', first = true;
    for (var v = -90; v <= 90; v += 5) {
      var p = proj(lo, v, R, CX, CY);
      d += (first ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); first = false;
    }
    NS.add(g, s('path', { d:d, fill:'none', stroke:'#6B737F', 'stroke-width':0.4, opacity:0.5 }));
  }
  NS.add(g, s('text', { x:CX, y:size - 4, class:'axl', 'text-anchor':'middle', fill:'var(--muted)',
    text:'正射投影（地球から見た月面）・左が西（経度 −）' }));
  return { node:g, R:R, CX:CX, CY:CY };
}
function proj(lon, lat, R, CX, CY) {
  return [CX + R * Math.cos(lat * NS.d2r) * Math.sin(lon * NS.d2r), CY - R * Math.sin(lat * NS.d2r)];
}

/* ---------------- 画面 ---------------- */
NS.gundamSection = function (go) {
  var G = NS.GUNDAM, L = G.lif, t = NS.now();
  var out = [];
  var kpi = NS.kpi;

  /* --- 見出し --- */
  out.push(panel('ガンダム望遠鏡　' + G.formal, {
    note:G.site.label + '　' + NS.latlon(G.site.lat, G.site.lon) + ' · 標高 ' + G.site.alt + ' m',
    tools:badge('リモート運用 × デジタルツイン試験', 'info') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'船橋局には、観測網の標準機材に加えて、口径 400 mm と 200 mm のカセグレン式望遠鏡を 1 台のフォーク式赤道儀に同架した「ガンダム望遠鏡」がある。月面衝突閃光の観測のために構築されたシステムで、屋上観測網が捉える地球大気への突入現象に対して、同じ流星物質が「大気のない月面に衝突したとき」を同時に押さえられる。スペースデブリの追跡と一般の天体観測にも使い、遠隔操作と観測計画の自動化を通じてデジタルツインの試験台とする。' }),
    el('div', { class:'grid g4' }, [
      kpi('口径', '400 / 200', 'mm', '焦点距離 1,520 / 600 mm。2 筒を 1 台の赤道儀に同架', { acc:true, icon:'⊙' }),
      kpi('画素分解能', NS.f(G.tubes[0].res, 2) + ' / ' + NS.f(G.tubes[1].res, 2), '″/px', 'ASI174MM（画素 5.86 µm 角）を付けた場合'),
      kpi('撮像速度', '60', 'fps', '露出 16.7 ms · SER 形式で記録'),
      kpi('検出実績', '11', '個', '2018 年ふたご座流星群・約 3 時間')
    ])
  ]));

  /* --- 光学系の諸元 --- */
  out.push(el('div', { class:'grid g-2-1' }, [
    panel('光学系と赤道儀', { note:'Abe et al.「遊星人」(2024) 表 1 の構成。視野と画素分解能は ZWO ASI174MM のセンサー実寸と焦点距離から算出した' }, [
      NS.table(['鏡筒', 'メーカー・形式', '口径 (mm)', '焦点距離 (mm)', 'F 値', '画素分解能 (″/px)', '視野 (deg)', '視野 (分角)'],
        G.tubes.map(function (x) {
          return [el('b', { text:x.name }), { class:'sm', html:x.maker + '<br><span class="hint">' + x.type + '</span>' },
            { class:'r mono', html:String(x.dia) }, { class:'r mono', html:String(x.fl) },
            { class:'r mono', html:'F' + x.fr.toFixed(1) }, { class:'r mono', html:NS.f(x.res, 2) },
            { class:'r mono', html:x.fov }, { class:'r mono', html:x.fovMin }];
        })),
      el('div', { class:'note', html:'視野は ZWO ASI174MM のセンサー実寸 <b>' + NS.gdSensor() + '</b>（5.86 µm 角 × 1936 × 1216）と焦点距離から '
        + '<b>2·atan(寸法 / 2f)</b> で求めた。主鏡の視野 ' + G.tubes[0].fovMin + ' は<b>月の視直径（約 31′）より狭い</b>ため、'
        + '月面全体は覆えない。副鏡の ' + G.tubes[1].fovMin + ' が月面全体を収め、主鏡が ' + NS.f(G.tubes[0].res, 2)
        + ' ″/px の細かさで位置を詰める、という役割分担になる。' }),
      kv([
        ['赤道儀', G.mount],
        ['焦点', 'カセグレン焦点にフィルター無しで直結'],
        ['構築', G.built + '（株式会社昭和機械製作所の協力による）'],
        ['設置座標', NS.latlon(G.site.lat, G.site.lon) + ' · 標高 ' + G.site.alt + ' m'],
        ['屋上観測網との関係', '船橋局の全天カメラ・分光カメラ・気象センサーと同じ時刻系（GNSS）で同期し、同一の突入現象を大気側と月面側から押さえる']
      ], 'wide')
    ]),
    panel('検出器', { note:G.camera.model }, [
      kv([
        ['画素数', G.camera.pix + '（' + G.camera.pitch + ' µm 角）　<span class="hint">センサー ' + NS.gdSensor() + '</span>'],
        ['露出時間', G.camera.exp + ' ms'],
        ['フレームレート', G.camera.fps + ' fps'],
        ['ADC', G.camera.adc + ' bit'],
        ['インターフェース', G.camera.iface],
        ['波長感度', G.camera.band],
        ['時刻同期', 'GPS 同期']
      ], 'wide'),
      el('div', { class:'note', text:G.camera.note })
    ])
  ]));

  /* --- 観測モード --- */
  out.push(panel('3 つの観測モード', { note:'同架した 2 筒を目的に応じて使い分ける' },
    el('div', { class:'grid g3' }, NS.GD_MODES.map(function (m) {
      return el('div', { class:'modecard' }, [
        el('div', { class:'mc-h' }, [el('span', { class:'mc-i', text:m.icon }), el('b', { text:m.label })]),
        kv([['使用鏡筒', m.tube], ['対象', m.target], ['取得', m.cad], ['成果物', m.product]]),
        el('div', { class:'note', text:m.note })
      ]);
    }))));

  /* === 月面衝突閃光 === */
  out.push(NS.gdLifPanel());
  /* === スペースデブリ === */
  out.push(NS.gdDebrisPanel(go));
  /* === 天体観測 === */
  out.push(NS.gdAstroPanel());
  /* === リモート運用 === */
  out.push(NS.gdRemotePanel(t));
  /* === デジタルツイン === */
  out.push(NS.gdTwinPanel(t));

  out.push(el('div', { class:'src', html:'光学系の諸元は下記論文 表 1 のとおりで、視野と画素分解能は '
    + 'ZWO ASI174MM の画素 5.86 µm 角・1936 × 1216（実寸 11.34 × 7.13 mm）と焦点距離（1,520 / 600 mm）から 2·atan(寸法 / 2f) で求めた。'
    + 'この計算は、同論文 表 1 の 0.42° × 0.27°・0.8 ″/px（主鏡）と 1.08° × 0.68°・2.0 ″/px（副鏡）を再現する。<br>'
    + '2018 年ふたご座流星群の観測結果（11 個の閃光・質量・直径・クレータ径・フラックス・各指数）は、'
    + '阿部新助・柳澤正久・小野寺圭祐「ふたご座流星群の月面衝突閃光から探る活動小惑星 Phaethon の cm サイズ粒子」'
    + '<i>日本惑星科学会誌 遊星人</i> <b>33</b> (3), 262–269 (2024)　'
    + '<a href="https://doi.org/10.14909/yuseijin.33.3_262" target="_blank" rel="noopener">doi:10.14909/yuseijin.33.3_262</a>　'
    + 'の実測値による。リモート運用画面・観測予約・デジタルツインの残差はデモ用の模擬値である。' }));
  return out;
};


/* ================= 月面衝突閃光 ================= */
NS.gdLifPanel = function () {
  var G = NS.GUNDAM, L = G.lif, kpi = NS.kpi;
  var mm = moonMap(360);
  /* 発生位置を打つ。丸の大きさは R 等級（明るいほど大きい） */
  L.events.forEach(function (e) {
    var p = proj(e[2], e[3], mm.R, mm.CX, mm.CY);
    var r = Math.max(2.6, 10 - (e[4] - 6.4) * 1.4);
    NS.add(mm.node, s('circle', { cx:p[0], cy:p[1], r:r + 3.5, fill:'#F2C14E', opacity:0.16 }));
    NS.add(mm.node, s('circle', { cx:p[0], cy:p[1], r:r, fill:'#F2C14E', opacity:0.9 },
      s('title', { text:'Flash ' + e[0] + ' · ' + e[1] + ' JST · R = ' + e[4] + ' 等' })));
    NS.add(mm.node, s('text', { x:p[0] + r + 3, y:p[1] + 3, class:'axl', fill:'#F2C14E', text:e[0] }));
  });

  /* 最大 R 等級の累積分布（冪 r = 2.35 ± 0.42） */
  var mags = L.events.map(function (e) { return e[4]; }).sort(function (a, b) { return a - b; });
  var cum = mags.map(function (m, i) { return [m, i + 1]; });
  var magChart = NS.chart.line({
    width:440, height:210, series:[{ pts:cum, color:'var(--accent)', width:2, dots:3 }],
    xDomain:[6, 11], yDomain:[0, 12], xLabel:'最大 R 等級', yLabel:'累積個数 N(<R)',
    xFmt:function (v) { return v.toFixed(0); }, yFmt:function (v) { return v.toFixed(0); }
  });

  /* 質量と直径 */
  var masses = L.events.map(function (e) { return e[7]; }).sort(function (a, b) { return a - b; });
  var massChart = NS.chart.bars({
    width:440, height:200,
    bars:L.events.map(function (e) { return { x:e[0], y:e[7], color:'var(--c-info)', label:e[0] }; }),
    yLabel:'衝突メテオロイド質量 (g)', xLabel:'Flash ID'
  });

  return panel('① 月面衝突閃光（LIF）観測　2018 年ふたご座流星群', {
    note:L.date + ' ' + L.span + ' · 月齢 ' + L.moonAge + '（' + L.moonIllum + ' %）· 電気通信大学（約 50 km）と同時検出が成立した 11 個',
    tools:NS.badge('実観測データ', 'ok') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'月には大気がないため、流星物質はそのまま地面に衝突して閃光を出す。大気中で燃え尽きる地上の流星観測と組み合わせると、同じ母天体から出た粒子の、質量の大きい側の分布を直接押さえられる。船橋局の屋上観測網がふたご座流星群を大気側で数えている同じ夜に、ガンダム望遠鏡が月面側を数える、という使い方をする。' }),
    el('div', { class:'grid g4' }, [
      kpi('検出した閃光', L.events.length, '個', '約 3 時間（太陽黄経 262.894° – 263.026°）', { acc:true, icon:'☾' }),
      kpi('衝突頻度', '4.8×10⁻⁷', 'h⁻¹km⁻²', '質量フラックス ' + (L.fluxLo * 1e5).toFixed(1) + ' – ' + (L.fluxHi * 1e5).toFixed(1) + '×10⁻⁵ g h⁻¹km⁻²'),
      kpi('質量指数 s', L.massIndex, '', 'CMOR・NASA MSFC の s = 1.68 ± 0.04 と調和的'),
      kpi('位置測定精度', '0.1 – 0.5', '°', '従来の約 10 倍。誤差 ' + L.posErr)
    ]),
    el('div', { class:'grid g2', style:{ marginTop:'12px' } }, [
      el('div', null, [
        el('div', { class:'phead', text:'発生位置（月面図）' }),
        mm.node,
        el('div', { class:'note', text:'丸の大きさは最大 R 等級（明るいほど大きい）。11 個すべてが夜側（地球照側）に集中しているのは、この時期にふたご座流星群の放射点方向が月の夜側を向いていたため。' })
      ]),
      el('div', null, [
        el('div', { class:'phead', text:'最大 R 等級の累積分布' }), magChart,
        el('div', { class:'note', html:'冪指数 <b>r = 2.35 ± 0.42</b>。NELIOTA（口径 1.2 m, r = 3.42 ± 0.22）や NASA（0.35 / 0.5 m, 群流星 r = 3.65 ± 0.40）と比べて明るい閃光の割合が高く、活動小惑星 (3200) Phaethon を母天体にもつ流星群の特徴と考えられる。' }),
        el('div', { class:'phead', style:{ marginTop:'10px' }, text:'衝突メテオロイドの推定質量' }), massChart
      ])
    ]),
    el('div', { style:{ marginTop:'12px' } }, NS.table(
      ['Flash', '時刻 (JST)', '経度 (°)', '緯度 (°)', 'R 等級', '衝突天頂角 (°)', '衝突エネルギー (J)', '質量 (g)', '直径 (cm)', 'クレータ径 (m)'],
      L.events.map(function (e) {
        return [el('b', { text:e[0] }), { class:'mono sm', html:e[1] },
          { class:'r mono', html:f(e[2], 1) }, { class:'r mono', html:f(e[3], 1) },
          { class:'r mono', html:f(e[4], 1) }, { class:'r mono', html:f(e[5], 1) },
          { class:'r mono', html:NS.expo(e[6]) }, { class:'r mono', html:f(e[7], 1) },
          { class:'r mono', html:f(e[8], 2) }, { class:'r mono', html:f(e[9], 2) }];
      }))),
    el('div', { class:'grid g2', style:{ marginTop:'12px' } }, [
      panel('エネルギーと質量の求め方', { note:'発光効率 η の仮定が最大の不確かさ' }, kv([
        ['発光エネルギー', 'E<sub>total</sub> = f<sub>λ</sub> Δλ f π d² t　（Δλ = 1607 Å, d = 3.956×10¹⁰ cm, t = 0.01667 s, f = 2）'],
        ['等級', 'フィルター無しの観測波長に近い Gaia DR2 G バンドで測光し、Johnson-Cousins R バンドへ変換'],
        ['発光効率', 'η = 1.5×10⁻³ exp{ −(9.3 km/s)² / v² }。本解析ではモデル値 η = 1.4×10⁻³ と最小値 η = 5.0×10⁻⁴ の 2 通りを採用'],
        ['運動エネルギー', 'KE = E<sub>total</sub> / η'],
        ['質量', 'm = 2 KE / v²　（月面衝突速度 v = 34.4 km/s）'],
        ['直径', 'ふたご座流星群の平均密度 ρ = 3,000 kg/m³ から換算'],
        ['クレータ径', 'π スケーリング則による月面レゴリス上のリム直径'],
        ['黒体温度', '分光観測から 2,000 – 4,000 K']
      ], 'wide')),
      panel('屋上観測網との組み合わせ', { note:'大気側と月面側を同じ夜に押さえる' }, [
        NS.table(['観測する側', '使う装置', '得られる量', '質量範囲'], [
          ['地球大気（流星）', '全天カメラ 14 局・4K 分光カメラ', '突入軌道・発光曲線・組成', 'µg – kg'],
          ['月面（衝突閃光）', 'ガンダム望遠鏡 400 / 200 mm', '衝突エネルギー・質量・クレータ径', 'g – 数百 g'],
          ['電波（HRO）', '電波流星受信機 14 局', '昼間・曇天でも計数できる出現数', 'µg – mg']
        ], 'wide'),
        el('div', { class:'note', html:'月面衝突閃光の継続監視は、将来の月面活動における衝突リスクの評価につながるほか、月震計と組み合わせれば月の内部構造の推定にも使える。本研究では衝突地点を' + L.posErr + 'の精度で決められたため、NASA の月周回衛星 LRO の狭視野カメラ（空間分解能 0.5 m）による衝突クレータの同定が期待される。クレータ径が判明すれば、未解明の発光効率 η を決められる。' })
      ])
    ])
  ]);
};

/* ================= スペースデブリ ================= */
NS.gdDebrisPanel = function (go) {
  var kpi = NS.kpi, t = NS.now();
  var r = NS.rng(NS.hash('gddeb' + Math.floor(t / 6 / 3600e3)));
  var targets = [
    { name:'ロケット上段（LEO・姿勢制御喪失）', norad:'43155', alt:640, rate:1420, mag:8.4, spin:4.3, kind:'LEO' },
    { name:'静止衛星（運用終了・ドリフト軌道）', norad:'27820', alt:35786, rate:14,  mag:12.1, spin:126.0, kind:'GEO' },
    { name:'ミッション関連物体（LEO・小型）',   norad:'47301', alt:520, rate:1660, mag:11.5, spin:1.8, kind:'LEO' },
    { name:'再突入予報天体（残存寿命 4 日）',   norad:'54118', alt:212, rate:2980, mag:7.2, spin:0.9, kind:'再突入' }
  ];
  /* 自転による光度変化（デモ） */
  var tg = targets[0], n = 240, pts = [];
  for (var i = 0; i < n; i++) {
    var x = i * 0.05;                       /* 秒 */
    var ph = 2 * Math.PI * x / tg.spin;
    var v = tg.mag - 0.9 * Math.abs(Math.sin(ph)) - 0.35 * Math.sin(2 * ph + 0.7) + (r() - 0.5) * 0.12;
    pts.push([x, v]);
  }
  var lc = NS.chart.line({ width:460, height:210, series:[{ pts:pts, color:'var(--c-sky)', width:1.4 }],
    yDomain:[tg.mag + 0.6, tg.mag - 1.6], xLabel:'経過時間 (s)', yLabel:'見かけの等級',
    yFmt:function (v) { return v.toFixed(1); } });

  return panel('② スペースデブリ観測', {
    note:'副鏡 200 mm（視野 1.08° × 0.68°）で捕捉し、主鏡 400 mm で追跡する',
    tools:NS.badge('デモ用の模擬データ', 'warn') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'公開軌道要素（TLE）から予報した通過に合わせて自動で追尾し、測光する。光度の周期変化から物体の自転周期と姿勢の乱れが分かり、再突入の時期と破砕のしかたの予測に効く。デブリ再突入の画面で扱う「落ちてくる瞬間の分光」に対して、こちらは「落ちる前の状態」を押さえる役割を持つ。' }),
    el('div', { class:'grid g4' }, [
      kpi('追尾方式', 'TLE 追尾', '', '軌道要素から予報した通過を自動で追う', { icon:'🛰' }),
      kpi('捕捉視野', '1.08 × 0.68', 'deg', '副鏡 200 mm ＋ ASI174MM（65.0′ × 40.8′）'),
      kpi('測光の時間分解能', '16.7', 'ms', '高速自転体の光度変化も追える'),
      kpi('今夜の予定', targets.length, '目標', '静止衛星帯サーベイと再突入予報天体を含む')
    ]),
    el('div', { class:'grid g2', style:{ marginTop:'12px' } }, [
      el('div', null, [
        el('div', { class:'phead', text:'追跡目標（今夜）' }),
        NS.table(['目標', '軌道', '高度 (km)', '角速度 (″/s)', '推定等級', '自転周期 (s)'],
          targets.map(function (x) {
            return [el('b', { text:x.name }), NS.badge(x.kind, x.kind === '再突入' ? 'warn' : 'info'),
              { class:'r mono', html:x.alt.toLocaleString() }, { class:'r mono', html:x.rate.toLocaleString() },
              { class:'r mono', html:f(x.mag, 1) }, { class:'r mono', html:f(x.spin, 1) }];
          })),
        el('div', { class:'note', text:'角速度は視野を横切る速さ。LEO の物体は 1 秒あたり数百〜数千秒角で動くため、赤道儀の追尾速度を軌道要素から与えて恒星時追尾を打ち消す。' })
      ]),
      el('div', null, [
        el('div', { class:'phead', text:'光度曲線から求める自転周期（' + tg.name + '）' }), lc,
        el('div', { class:'note', html:'極大と極小の間隔から自転周期 <b>' + f(tg.spin, 1) + ' 秒</b>。周期の時間変化を追うと、姿勢制御を失った物体の減速（大気抵抗トルク）が見え、再突入予報の精度が上がる。' })
      ])
    ]),
    el('div', { class:'split', style:{ marginTop:'10px' } }, [
      el('button', { class:'iconbtn', text:'デブリ再突入の画面へ →', onclick:function () { go('reentry'); } }),
      el('button', { class:'iconbtn', text:'発光スペクトル（AlO・TiO）を見る →', onclick:function () { go('reentry'); } })
    ])
  ]);
};

/* ================= 天体観測 ================= */
NS.gdAstroPanel = function () {
  var kpi = NS.kpi;
  var progs = [
    ['(3200) Phaethon の測光', 'ふたご座流星群の母天体。近日点通過前後の明るさと色の変化を追い、ダスト放出の有無を調べる', '主鏡 400 mm', 'G-1'],
    ['小惑星による恒星掩蔽', '恒星が隠される時刻を多地点で測り、小天体の形と大きさを求める。付属校と合同で観測地点を分散させる', '副鏡 200 mm', 'G-8'],
    ['彗星の活動監視', 'コマの広がりと明るさの変化から、ダスト放出率を見積もる', '主鏡 400 mm', 'G-1'],
    ['変光星・食連星', '長時間の連続測光。観測装置の安定性（測光精度）の日常的な確認にもなる', '副鏡 200 mm', 'PF-1'],
    ['流星群の輻射点方向の監視', '全天カメラが検出した火球の対応天体を、拡大視野で追確認する', '主鏡 400 mm', 'G-1']
  ];
  return panel('③ 天体観測', { note:'分解能 0.8″ を活かした測光と位置測定',
    tools:NS.badge('デモ用の模擬データ', 'warn') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'月面衝突閃光とデブリの観測がない夜は、一般の天体観測にあてる。屋上観測網が「広く浅く」24 時間休まず見るのに対して、ガンダム望遠鏡は「狭く深く」見る。両者を組み合わせることで、観測網が拾った事象をその場で拡大追跡できる。' }),
    el('div', { class:'grid g4' }, [
      kpi('限界等級', '19.5', '等', '主鏡 400 mm · 露出 120 s の目安', { acc:true, icon:'✦' }),
      kpi('位置測定精度', '0.3', '″', 'Gaia DR3 を基準星に使った場合'),
      kpi('測光精度', '0.02', '等', '明るい標準星での 1σ'),
      kpi('付属校の利用', 'リモート', '', '校舎から遠隔で観測できる（G-8）')
    ]),
    el('div', { style:{ marginTop:'12px' } }, NS.table(['観測プログラム', 'ねらい', '使用鏡筒', '対応テーマ'],
      progs.map(function (x) {
        return [el('b', { text:x[0] }), { class:'sm', html:x[1] }, x[2], NS.badge(x[3], 'info')];
      }), 'wide'))
  ]);
};

/* ================= リモート運用 ================= */
NS.gdRemotePanel = function (t) {
  var kpi = NS.kpi, itl = NS.gdInterlock(t), q = NS.gdQueue(t), tw = NS.gdTwin(t);
  var modeOf = function (k) { return NS.GD_MODES.filter(function (m) { return m.key === k; })[0]; };
  var lamp = function (ok) { return el('span', { class:'lamp ' + (ok ? 'on' : 'off') }); };

  return panel('④ リモート運用', {
    note:'船橋校舎の観測室と、各学部・付属校からの遠隔操作',
    tools:itl.open ? NS.badge('観測条件 成立', 'ok') : NS.badge('観測条件 不成立（待機）', 'warn') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'ドームの開閉・鏡筒の指向・カメラの露出を遠隔から操作する。観測条件のインターロックは船橋局の複合気象センサーと全天カメラの実測で判定し、どれか一つでも外れると自動で閉じる。観測予約は学部横断のキューで管理し、月面衝突閃光の好条件（月齢と夜側の向き）が最優先で割り込む。' }),
    el('div', { class:'grid g2' }, [
      el('div', null, [
        el('div', { class:'phead', text:'観測条件インターロック（船橋局の実測で判定）' }),
        NS.table(['項目', '現在値', '開放条件', '判定'], itl.items.map(function (x) {
          return [el('b', { text:x.label }), { class:'r mono', html:x.val }, { class:'sm', html:x.lim },
            x.ok ? NS.badge('可', 'ok') : NS.badge('不可', 'warn')];
        })),
        el('div', { class:'grid g3', style:{ marginTop:'10px' } }, [
          el('div', { class:'statcard' }, [lamp(itl.open), el('div', null, [el('b', { text:'ドーム' }),
            el('div', { class:'hint', text:itl.open ? '開（観測中）' : '閉（待機）' })])]),
          el('div', { class:'statcard' }, [lamp(true), el('div', null, [el('b', { text:'赤道儀' }),
            el('div', { class:'hint', text:'追尾中 · 指令遅延 ' + Math.round(tw.latency) + ' ms' })])]),
          el('div', { class:'statcard' }, [lamp(true), el('div', null, [el('b', { text:'カメラ冷却' }),
            el('div', { class:'hint', text:'−10 ℃ 到達 · 安定' })])])
        ]),
        el('div', { class:'note', text:'インターロックはデモとして船橋局の気象センサー・全天カメラ・太陽高度から判定している。実運用では雨感知器と風速計のハードウェア信号を直接ドーム制御に入れ、通信が切れた場合も自動で閉じる設計とする。' })
      ]),
      el('div', null, [
        el('div', { class:'phead', text:'観測予約キュー（今夜）' }),
        NS.table(['時刻 (JST)', 'モード', '観測', '所要', '申請', '状態'], q.map(function (x) {
          var m = modeOf(x.mode);
          return [{ class:'mono sm', html:NS.fmtJST(x.t0, { sec:false, timeOnly:true }) + ' –<br>' + NS.fmtJST(x.t1, { sec:false, timeOnly:true }) },
            { class:'sm', html:m.icon + ' ' + m.label }, el('b', { text:x.name }),
            { class:'r mono', html:x.min + ' 分' }, { class:'sm', html:x.who },
            x.stat === '実行中' ? NS.badge('実行中', 'ok') : x.stat === '待機' ? NS.badge('待機', 'info') : NS.badge('予約', '')];
        })),
        el('div', { class:'note', html:'月面衝突閃光は月齢 3 – 10 と 20 – 27 の限られた期間しか観測できないため、<b>最優先</b>で割り込む。空いた時間をデブリ追跡と天体観測に自動で埋める計画作成を、そのままデジタルツインの試験対象にしている。' })
      ])
    ])
  ]);
};

/* ================= デジタルツイン試験 ================= */
NS.gdTwinPanel = function (t) {
  var kpi = NS.kpi, tw = NS.gdTwin(t);
  var rows = [
    ['指向', '天球上の指定座標に向ける', f(tw.point, 2) + '′', '1.5′ 以内', '極軸誤差・たわみ・エンコーダ分解能をモデル化し、補正表を自動更新'],
    ['追尾', '恒星時追尾の残差', f(tw.track, 2) + '″/min', '2″/min 以内', 'ピリオディックエラーを学習して先回り補正する'],
    ['鏡筒たわみ', '子午線越え前後の指向差', f(tw.flexure, 2) + '′', '1.2′ 以内', '重力方向と鏡筒姿勢から残差を予測するモデル'],
    ['焦点', '外気温変化による焦点移動', f(tw.focusDrift, 0) + ' µm/℃', '±25 µm 以内', '気象センサーの気温からモデルで先に焦点を動かす'],
    ['シーイング', '大気ゆらぎによる星像の広がり', f(tw.seeing, 2) + '″', '—', '全天カメラの星像から推定し、露出時間の自動決定に使う'],
    ['指令遅延', '遠隔操作の往復遅延', Math.round(tw.latency) + ' ms', '400 ms 以内', '遅延を見込んだ先読み指令で、高速移動天体の追尾を保つ']
  ];
  return panel('⑤ デジタルツイン試験台としての利用', {
    note:'実機とモデルの差を常時測り、観測網全体のデジタルツイン（DT-1 – DT-7）の検証に使う',
    tools:NS.badge('デモ用の模擬データ', 'warn') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'観測網のデジタルツインは、屋上の各センサーを仮想空間に写して「観測される前に予測する」ことを目指す。ただし予測がどれだけ当たるかは、実機と突き合わせなければ分からない。ガンダム望遠鏡は、指向・追尾・焦点という物理量が数値で厳密に測れるため、モデルと実機の差を定量化する試験台として適している。ここで確立した「モデル ↔ 実機の差を測り、モデルを直す」手順を、そのまま全 14 局のセンサーツインに適用する。' }),
    el('div', { class:'grid g4' }, [
      kpi('指向残差', f(tw.point, 2), '′', '目標 1.5′ 以内', { acc:true, icon:'◎' }),
      kpi('追尾残差', f(tw.track, 2), '″/min', '目標 2″/min 以内'),
      kpi('指令往復遅延', Math.round(tw.latency), 'ms', '遠隔操作の応答性'),
      kpi('シーイング', f(tw.seeing, 2), '″', '全天カメラの星像から推定')
    ]),
    el('div', { style:{ marginTop:'12px' } }, NS.table(
      ['項目', '測る量', '現在の残差', '目標', 'モデル側の扱い'], rows.map(function (x) {
        return [el('b', { text:x[0] }), { class:'sm', html:x[1] }, { class:'r mono', html:x[2] },
          { class:'r mono sm', html:x[3] }, { class:'sm', html:x[4] }];
      }), 'wide')),
    el('div', { class:'note', html:'DT-1（落下域）・DT-4（音源定位）・DT-5（地震応答）の各ツインは、いずれも「センサーの実測とモデル予測の差」を縮める設計になっている。'
      + 'ガンダム望遠鏡では同じ枠組みを、誤差 1′ 以下という厳しい条件で試せる。遠隔操作の遅延を含めた制御まで検証できる点も、'
      + '将来の無人観測局（付属校拠点の自動運用）にそのまま生きる。' })
  ]);
};

})(NS);
