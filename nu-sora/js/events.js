/* NU-SORA デモ / イベントカタログ（模擬データ）
   物理関係式は実在のものを用いるが、数値そのものはデモ用の作り物である。 */
'use strict';
(function (NS) {

/* ---------- 物理関係式（実在の経験式） ---------- */
/* 絶対等級 → 発光パワー（W）。0 等の流星を 1500 W とする慣用値 */
NS.lumPower = function (absMag) { return 1500 * Math.pow(10, -0.4 * absMag); };
/* 放射エネルギー Er(kt) → 全衝突エネルギー E(kt)。Brown et al. (2002) */
NS.brownE = function (ErKt) { return 8.2508 * Math.pow(ErKt, 0.885); };
/* インフラサウンド周期 P(s) → 収量 E(kt)。AFTAC 経験式 log10(E/2)=3.34 log10 P − 2.58 */
NS.aftacE = function (P) { return 2 * Math.pow(10, 3.34 * Math.log10(P) - 2.58); };
NS.aftacP = function (EKt) { return Math.pow(10, (Math.log10(EKt / 2) + 2.58) / 3.34); };
/* 発光効率 tau から光度質量 m = 2Er/(tau v²) */
NS.photoMass = function (ErJ, vKmS, tau) { return 2 * ErJ / ((tau || 0.05) * Math.pow(vKmS * 1000, 2)); };
NS.KT_J = 4.184e12;

/* ---------- 光度曲線の生成 ---------- */
NS.makeLightcurve = function (o) {
  /* o: {seed, dur(s), peakMag, beginMag, flares:[{at,amp,w}]} */
  var r = NS.rng(o.seed), pts = [], n = 220;
  var pk = o.peakAt == null ? 0.62 : o.peakAt;
  for (var i = 0; i <= n; i++) {
    var x = i / n, tt = x * o.dur;
    /* 基本形：非対称ガウス（減速で末端が切れる） */
    var w = x < pk ? 0.30 : 0.17;
    var base = Math.exp(-Math.pow((x - pk) / w, 2) * 1.6);
    var m = o.beginMag - (o.beginMag - o.peakMag) * base;
    (o.flares || []).forEach(function (f) {
      m -= f.amp * Math.exp(-Math.pow((x - f.at) / f.w, 2));
    });
    m += r.norm(0, 0.055);
    if (x > 0.985) m += (x - 0.985) * 260;   /* 終端で急消灯 */
    pts.push([tt, m]);
  }
  return pts;
};
/* 放射エネルギー（J）を光度曲線から積分 */
NS.integrateEr = function (lc) {
  var E = 0;
  for (var i = 1; i < lc.length; i++) {
    var dt = lc[i][0] - lc[i - 1][0];
    E += 0.5 * (NS.lumPower(lc[i][1]) + NS.lumPower(lc[i - 1][1])) * dt;
  }
  return E;
};

/* ---------- スペクトル線リスト ----------
   自然天体（流星）の線同定と相対強度は、実際に得られた流星スペクトルの
   代表例（S. Abe et al. 2000 のしし座流星群スペクトルほか）に合わせて構成した。
   s は連続光を含めたピーク高（1.0 = 最強線）、w は線幅の倍率。 */
NS.LINES_NATURAL = [
  { wl:366.0, el:'Fe I',  s:0.24 }, { wl:372.0, el:'Fe I',  s:0.31 }, { wl:375.8, el:'Fe I',  s:0.60 },
  { wl:382.9, el:'Mg I',  s:0.80 }, { wl:385.9, el:'Fe I',  s:0.52 }, { wl:393.4, el:'Ca II', s:0.95 },
  { wl:396.8, el:'Ca II', s:0.95 }, { wl:403.1, el:'Mn I',  s:0.46 }, { wl:413.2, el:'Fe I',  s:0.56 },
  { wl:422.7, el:'Ca I',  s:0.52 }, { wl:425.4, el:'Cr I',  s:0.47 }, { wl:438.3, el:'Fe I',  s:0.59 },
  { wl:448.1, el:'Mg II', s:0.72 }, { wl:457.1, el:'Mg I',  s:0.33 }, { wl:463.0, el:'N II',  s:0.30 },
  { wl:495.8, el:'Fe I',  s:0.40 }, { wl:502.7, el:'Fe I',  s:0.59 }, { wl:516.7, el:'Mg I',  s:0.62 },
  { wl:518.4, el:'Mg I',  s:0.94 }, { wl:527.0, el:'Fe I',  s:0.44 }, { wl:532.8, el:'Fe I',  s:0.47 },
  { wl:542.0, el:'Fe I',  s:0.39 }, { wl:558.0, el:'Ca I',  s:0.26 }, { wl:570.0, el:'N II',  s:0.33 },
  { wl:577.0, el:'Ca I',  s:0.36 }, { wl:589.2, el:'Na I',  s:0.95, w:1.35 },
  { wl:615.8, el:'O I',   s:0.56 }, { wl:620.3, el:'Ca I',  s:0.35 }, { wl:634.7, el:'Si II', s:0.82 },
  { wl:637.1, el:'Si II', s:0.66 }, { wl:646.0, el:'O I',   s:0.50 }, { wl:656.3, el:'H I',   s:0.51 },
  { wl:668.0, el:'N₂',    s:0.30, w:5.0 }, { wl:724.0, el:'N₂', s:0.22, w:7.0 },
  { wl:744.2, el:'N I',   s:0.52 }, { wl:746.8, el:'N I',   s:0.50 }, { wl:777.4, el:'O I',   s:0.94 },
  { wl:785.0, el:'N I',   s:0.39 }, { wl:822.3, el:'N I',   s:0.58 }, { wl:844.6, el:'O I',   s:0.30 },
  { wl:849.8, el:'Ca II', s:0.26 }, { wl:868.0, el:'N I',   s:0.54 }, { wl:871.9, el:'N I',   s:0.50 }
];
/* ---------- 連続光（黒体放射） ----------
   流星の発光は、原子の輝線に加えて、衝撃加熱された空気とアブレーションで生じた
   高温プラズマの熱放射（連続光）を伴う。自然天体の火球ではこの連続成分が
   およそ 5,000 K の黒体として現れるので、手で描いた折れ線ではなく
   プランクの式からそのまま作る。 */
NS.H_PLANCK = 6.62607015e-34; NS.C_LIGHT = 2.99792458e8; NS.K_BOLTZ = 1.380649e-23;
NS.planck = function (wlNm, T) {
  var l = wlNm * 1e-9;
  var x = NS.H_PLANCK * NS.C_LIGHT / (l * NS.K_BOLTZ * T);
  return (2 * NS.H_PLANCK * NS.C_LIGHT * NS.C_LIGHT) / (Math.pow(l, 5) * (Math.exp(x) - 1));
};
/* 波長 lo–hi nm を n 点に刻み、最大値が peak になるように規格化した [波長, 強度] の表 */
NS.blackbodyCont = function (T, peak, lo, hi, n) {
  var out = [], max = 0, i, w;
  for (i = 0; i <= n; i++) {
    w = lo + (hi - lo) * i / n;
    var v = NS.planck(w, T);
    if (v > max) max = v;
    out.push([Math.round(w * 10) / 10, v]);
  }
  return out.map(function (p) { return [p[0], Math.round(p[1] / max * peak * 1e4) / 1e4]; });
};
/* 自然天体：約 5,000 K の弱い黒体。ウィーンの変位則により極大は 580 nm 付近になる。 */
NS.CONT_T_NATURAL = 5000;
NS.CONT_NATURAL = NS.blackbodyCont(NS.CONT_T_NATURAL, 0.052, 350, 900, 110);

/* 人工天体（スペースデブリ再突入）。アルミ合金・銅配線・リチウム電池に由来する線が卓越し、
   自然天体で最強の Mg I 518 / Na I 589 が相対的に弱いことが識別の決め手になる。 */
NS.LINES_ARTIFICIAL = [
  { wl:371.0, el:'Fe I',  s:0.26 }, { wl:394.4, el:'Al I',  s:1.00 }, { wl:396.2, el:'Al I',  s:0.96 },
  { wl:393.4, el:'Ca II', s:0.34 }, { wl:398.2, el:'Ti I',  s:0.36 }, { wl:399.9, el:'Ti I',  s:0.30 },
  { wl:425.4, el:'Cr I',  s:0.48 }, { wl:427.5, el:'Cr I',  s:0.44 }, { wl:428.9, el:'Cr I',  s:0.40 },
  { wl:438.3, el:'Fe I',  s:0.42 }, { wl:460.7, el:'Sr I',  s:0.24 }, { wl:484.0, el:'AlO 帯', s:0.30, w:4.0 },
  { wl:508.1, el:'Ni I',  s:0.30 }, { wl:510.6, el:'Cu I',  s:0.70 }, { wl:515.3, el:'Cu I',  s:0.34 },
  { wl:518.4, el:'Mg I',  s:0.31 }, { wl:521.8, el:'Cu I',  s:0.38 }, { wl:527.0, el:'Fe I',  s:0.33 },
  { wl:578.2, el:'Cu I',  s:0.64 }, { wl:589.0, el:'Na I',  s:0.35 }, { wl:610.4, el:'Li I',  s:0.26 },
  { wl:670.8, el:'Li I',  s:0.60 }, { wl:744.2, el:'N I',   s:0.34 }, { wl:777.4, el:'O I',   s:0.52 },
  { wl:794.8, el:'Nb I',  s:0.20 }, { wl:822.3, el:'N I',   s:0.33 }, { wl:844.6, el:'O I',   s:0.24 },
  { wl:867.0, el:'Hf I',  s:0.16 }
];
NS.CONT_ARTIFICIAL = [[350,0.00],[365,0.06],[380,0.14],[400,0.17],[430,0.20],[460,0.22],[490,0.24],
  [520,0.26],[560,0.27],[600,0.28],[640,0.28],[680,0.26],[720,0.23],[760,0.20],[800,0.17],[840,0.14],
  [870,0.12],[900,0.10]];
/* ---------- 組成グループ（発光スペクトルの ON / OFF 用） ----------
   同じ由来をもつ原子線をひとまとめにし、どの組成が効いているかを切り替えて確かめられるようにする。
   自然天体は「岩石質・揮発性・大気起源」、人工天体は「機体構造・配線・電池・耐熱部材…」で分ける。 */
NS.COMP_NATURAL = [
  { key:'rock',  name:'岩石質（ケイ酸塩・金属）', els:['Mg I', 'Mg II', 'Si II', 'Ca I', 'Ca II', 'Fe I', 'Cr I', 'Mn I'],
    color:'#E0873A', note:'母天体そのものの組成。Mg I 518.4 と Ca II 393/397 が最強で、Fe I の多重項が全域に分布する' },
  { key:'volat', name:'揮発性（ナトリウム）', els:['Na I'],
    color:'#E5C04A', note:'Na I 589 nm。融点・蒸気圧が低く最初に気化する。Na I / Mg I の強度比が母天体の熱履歴を表す' },
  { key:'hyd',   name:'水素（含水鉱物・彗星由来）', els:['H I'],
    color:'#7FB2E5', note:'H I 656.3 nm。含水鉱物や彗星起源の揮発性成分を示唆する' },
  { key:'atmos', name:'大気起源（衝撃加熱された空気）', els:['O I', 'N I', 'N II', 'N₂'],
    color:'#5FA98B', note:'流星体ではなく周囲の大気の発光。突入速度が速いほど強くなるので、速度の独立指標になる' }
];
NS.COMP_ARTIFICIAL = [
  { key:'struct', name:'機体構造（アルミ合金）', els:['Al I', 'AlO 帯'],
    color:'#6FA8DC', note:'Al I 394.4 / 396.2 nm。人工物で最強になる線で、機体外板・構造材に由来する' },
  { key:'wire',   name:'配線・モーター（銅）', els:['Cu I'],
    color:'#D98A5A', note:'Cu I 510.6 / 521.8 / 578.2 nm。ハーネスとモーター巻線の銅' },
  { key:'batt',   name:'電池（リチウム）', els:['Li I'],
    color:'#C77DBB', note:'Li I 670.8 nm。自然天体にはまず現れないため、人工物の決め手の一つになる' },
  { key:'therm',  name:'耐熱部材・チタン合金', els:['Ti I', 'Nb I', 'Hf I'],
    color:'#B0A24A', note:'Ti・Nb・Hf。アルミより高融点の部材が残っていることを示す。成層圏エアロゾル中の宇宙機由来金属（Murphy et al. 2023）に対応する' },
  { key:'steel',  name:'ステンレス構体（鉄・クロム・ニッケル）', els:['Fe I', 'Cr I', 'Mn I', 'Ni I'],
    color:'#9AA3AE', note:'エンジンや圧力容器のステンレス。爆発で内部が露出した局面で急増する' },
  { key:'atmos',  name:'大気起源（衝撃加熱された空気）', els:['O I', 'N I', 'N₂'],
    color:'#5FA98B', note:'O I 777.4 nm ほか。人工物は突入速度が遅いため、自然火球より弱い' },
  { key:'other',  name:'その他（Ca・Sr・Mg・Na）', els:['Ca II', 'Sr I', 'Mg I', 'Na I'],
    color:'#8C93A0', note:'塗料・接着剤・搭載物などに由来すると考えられる微量成分。自然天体で最強の Mg I 518 と Na I 589 が相対的に弱いことが識別の決め手になる' }
];
/* 元素名 → 組成グループの索引 */
NS.compIndex = function (groups) {
  var m = {};
  groups.forEach(function (g) { g.els.forEach(function (e) { m[e] = g.key; }); });
  return m;
};
/* 選ばれている組成だけを残す */
NS.filterByComp = function (lines, groups, on) {
  var idx = NS.compIndex(groups);
  return lines.filter(function (l) {
    var k = idx[l.el];
    return k === undefined ? true : on[k] !== false;
  });
};

/* 人工天体で「あってはならない／弱いはず」の指標線 */
NS.ARTIFICIAL_MARKERS = ['Al I', 'Cu I', 'Li I', 'Ti I', 'Cr I', 'Nb I', 'Hf I', 'AlO 帯', 'Ni I', 'Sr I'];

/* ---------- スペースデブリ特有の分子（酸化物）バンド ----------
   Watanabe, Abe, Arima & Hanayama (ACM 2026)「Spectroscopic Study of Rocket Debris during
   Atmospheric Re-entry」による LM-3B 第2段の再突入分光（石垣島, 2024-12-21, Sony α7S ＋
   Edmund Optics 600 grooves/mm）で同定された化学種に基づく。
   deg: バンドの degradation 方向（red = 長波長側へ裾を引く / violet = 短波長側 / broad = 広い山）。 */
NS.BANDS_DEBRIS = [
  { key:'AlO', name:'AlO', label:'AlO（B²Σ⁺–X²Σ⁺ · 450–560 nm）', color:'#5FC8D8',
    Texc:'約 5,000 – 9,000 K', deg:'red', tau:6.5,
    heads:[[464.8, 0.55], [484.2, 1.00], [507.9, 0.80], [533.0, 0.54], [553.0, 0.30]],
    origin:'気化したアルミニウムが衝撃層の高温酸素と反応して生成される。終端まで残ることがあり、アルミ片が最後まで溶け残っていたことを示す',
    ref:'励起温度：アブレーション期 約 5,000 K、爆発・終端期 約 9,000 K（Cygnus OA-6 では 7,716 K / Löhle et al. 2021）' },
  { key:'CN', name:'CN', label:'CN（violet 系 · 386–422 nm）', color:'#8FD08B',
    Texc:'約 12,000 K', deg:'violet', tau:4.0,
    heads:[[388.3, 1.00], [414.0, 0.74], [421.6, 0.56]],
    origin:'残留推進剤（非対称ジメチルヒドラジン C₂H₈N₂）が衝撃層の高温窒素と反応して生成されると考えられる。急激な変化は燃料タンクの破壊を示す指標になりうる',
    ref:'ATV-1 の再突入でも CN 発光の急変が観測されている（Löhle et al. 2011）' },
  { key:'TiO', name:'TiO', label:'TiO（γ・γ′ 系 · 515–725 nm）', color:'#D08BE0',
    Texc:'約 3,000 – 5,000 K', deg:'red', tau:5.0,
    heads:[[519.2, 0.40], [616.2, 0.62], [620.7, 0.56], [625.0, 0.44], [705.6, 1.00], [713.7, 0.82], [719.4, 0.60]],
    origin:'耐熱部材・塗料・チタン合金のチタンが酸化して生成される。アルミより高融点の部材が残っていることを示す',
    ref:'自然天体の流星では通常検出されず、人工物の識別指標になる' },
  { key:'FeO', name:'FeO', label:'FeO（orange arc · 570–650 nm）', color:'#E0A06B',
    Texc:'—', deg:'broad', tau:20,
    heads:[[600.0, 1.00]],
    origin:'ステンレス製エンジン等の鉄が酸化して生成される。爆発でエンジンが露出した局面で強まる',
    ref:'爆発期には Fe I 420 nm・Mn I 403 nm も同時に強まる（ステンレス構体の露出）' }
];
NS.BANDMAP = {}; NS.BANDS_DEBRIS.forEach(function (b) { NS.BANDMAP[b.key] = b; });

/* 再突入の局面（Watanabe et al. 2026 の 5 段階） */
NS.DEBRIS_PHASES = [
  { key:'begin', name:'Beginning', ja:'発光開始', alt:79, T:3900, cont:0.55,
    el:{ 'Na I':1.6, 'Al I':0.30, 'Cu I':0.15, 'Li I':0.10, 'Fe I':0.20, 'Mn I':0.15, 'Cr I':0.15,
         'Ti I':0.15, 'Ni I':0.15, 'O I':0.35, 'N I':0.30, 'H I':0.10 },
    bands:{ AlO:0.10, CN:0.06, TiO:0.04, FeO:0.03 },
    note:'最初に Na I 589 nm が現れる。融点・蒸気圧の関係で、表面のナトリウムが先に気化する。' },
  { key:'ablation', name:'Ablation', ja:'アブレーション', alt:70, T:5000, cont:0.85,
    el:{ 'Na I':1.0, 'Al I':1.0, 'Cu I':0.55, 'Li I':0.40, 'Fe I':0.45, 'Mn I':0.40, 'Cr I':0.50,
         'Ti I':0.55, 'Ni I':0.45, 'O I':0.70, 'N I':0.60, 'H I':0.20 },
    bands:{ AlO:1.00, CN:0.85, TiO:0.35, FeO:0.15 },
    note:'AlO（450–550 nm）と CN（414 nm）が立ち上がる。AlO の励起温度は約 5,000 K で、気化した Al が衝撃層の高温酸素と反応して生成される。' },
  { key:'explosion', name:'Explosion', ja:'爆発', alt:64, T:9000, cont:1.00,
    el:{ 'Na I':0.85, 'Al I':1.0, 'Cu I':1.0, 'Li I':0.85, 'Fe I':1.0, 'Mn I':1.0, 'Cr I':0.95,
         'Ti I':0.80, 'Ni I':0.90, 'O I':1.15, 'N I':0.85, 'H I':0.45 },
    bands:{ AlO:0.85, CN:0.70, TiO:0.55, FeO:0.60 },
    note:'爆発でステンレス製エンジンが露出し、Fe I 420 nm・Mn I 403 nm が急増する。O I 630 nm も強まる。AlO の励起温度は約 9,000 K に上がる。' },
  { key:'fragment', name:'Fragmentation', ja:'分裂', alt:58, T:7200, cont:0.80,
    el:{ 'Na I':0.70, 'Al I':0.90, 'Cu I':0.75, 'Li I':0.70, 'Fe I':0.80, 'Mn I':0.70, 'Cr I':0.75,
         'Ti I':0.70, 'Ni I':0.70, 'O I':0.90, 'N I':0.75, 'H I':1.00 },
    bands:{ AlO:0.70, CN:0.95, TiO:0.50, FeO:0.40 },
    note:'H I 486 nm が現れる。残留推進剤（C₂H₈N₂）の解離を示すと考えられ、CN も同時に強い。' },
  { key:'term', name:'Termination', ja:'終端', alt:51, T:9000, cont:0.45,
    el:{ 'Na I':0.35, 'Al I':0.55, 'Cu I':0.30, 'Li I':0.25, 'Fe I':0.35, 'Mn I':0.30, 'Cr I':0.35,
         'Ti I':0.40, 'Ni I':0.30, 'O I':0.45, 'N I':0.35, 'H I':0.20 },
    bands:{ AlO:0.75, CN:0.30, TiO:0.45, FeO:0.20 },
    note:'全体が減光しても AlO が残る。アルミ片が再突入の最後まで溶け残っていたことを示唆する（励起温度 約 9,000 K）。' }
];

/* 分子バンドの形（バンドヘッドで立ち上がり、片側へ裾を引く） */
NS.bandValue = function (def, wl, sd) {
  var v = 0;
  for (var i = 0; i < def.heads.length; i++) {
    var h = def.heads[i][0], a = def.heads[i][1], f = wl - h;
    if (def.deg === 'broad') { v += a * Math.exp(-0.5 * f * f / (def.tau * def.tau)); continue; }
    var edge = 1 / (1 + Math.exp(-(def.deg === 'red' ? f : -f) / Math.max(0.6, sd * 0.9)));
    var tail = Math.exp(-Math.max(0, def.deg === 'red' ? f : -f) / def.tau);
    /* 回転構造の細かい起伏 */
    var rot = 1 + 0.16 * Math.sin((def.deg === 'red' ? f : -f) * 2.4);
    v += a * edge * tail * rot;
  }
  return Math.max(0, v);
};

/* 再突入スペクトルの合成。phase と バンドの ON/OFF を反映する */
NS.debrisSpectrum = function (opt) {
  opt = opt || {};
  var ph = null;
  for (var i = 0; i < NS.DEBRIS_PHASES.length; i++) if (NS.DEBRIS_PHASES[i].key === opt.phase) ph = NS.DEBRIS_PHASES[i];
  if (!ph) ph = NS.DEBRIS_PHASES[1];
  var on = opt.bands || {};
  var src = opt.comp ? NS.filterByComp(NS.LINES_ARTIFICIAL, NS.COMP_ARTIFICIAL, opt.comp) : NS.LINES_ARTIFICIAL;
  var lines = src.map(function (l) {
    var k = ph.el[l.el];
    return { wl:l.wl, el:l.el, s:l.s * (k == null ? 0.6 : k), w:l.w };
  });
  var bands = NS.BANDS_DEBRIS.filter(function (b) { return on[b.key]; })
    .map(function (b) { return { def:b, amp:(ph.bands[b.key] || 0) * (opt.gain == null ? 0.88 : opt.gain) }; });
  var cont = NS.CONT_ARTIFICIAL.map(function (c) { return [c[0], c[1] * ph.cont]; });
  return { phase:ph, lines:lines, bands:bands,
           pts:NS.synthSpectrum(lines, { seed:'RE-' + ph.key, cont:cont, fwhm:2.8, lo:350, hi:900, n:1200, bands:bands }) };
};

/* 折れ線の連続光を波長で内挿 */
function interpCont(tab, wl) {
  if (wl <= tab[0][0]) return tab[0][1];
  for (var i = 1; i < tab.length; i++) {
    if (wl <= tab[i][0]) {
      var f = (wl - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
      return tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * f;
    }
  }
  return tab[tab.length - 1][1];
}
/* 線リスト ＋ 連続光 → 合成スペクトル（横軸 nm, 縦軸 相対強度 0–1） */
NS.synthSpectrum = function (lines, o) {
  o = o || {};
  var lo = o.lo || 360, hi = o.hi || 900, n = o.n || 1080;
  var fw = o.fwhm || 2.8, cont = o.cont || NS.CONT_NATURAL;
  var r = NS.rng(o.seed || 'sp'), out = [];
  for (var i = 0; i < n; i++) {
    var wl = lo + (hi - lo) * i / (n - 1);
    var c = interpCont(cont, wl);
    var v = c;
    if (o.bands) for (var bj = 0; bj < o.bands.length; bj++) {
      v += o.bands[bj].amp * NS.bandValue(o.bands[bj].def, wl, fw / 2.355);
    }
    for (var j = 0; j < lines.length; j++) {
      var L = lines[j], sd = fw * (L.w || 1) / 2.355;
      var d = wl - L.wl;
      if (Math.abs(d) > 6 * sd) continue;
      var amp = L.s - interpCont(cont, L.wl);
      if (amp <= 0) continue;
      v += amp * Math.exp(-0.5 * d * d / (sd * sd));
    }
    /* 実測スペクトルらしい微細な構造とノイズ */
    v += c * 0.10 * Math.sin(wl * 1.9 + 2.1) * Math.sin(wl * 0.47);
    v += r.norm(0, 0.007);
    out.push([wl, Math.max(0, v)]);
  }
  var mx = 0;
  for (var k = 0; k < out.length; k++) if (out[k][1] > mx) mx = out[k][1];
  if (mx > 0) for (var q = 0; q < out.length; q++) out[q][1] /= mx;
  return out;
};

/* =========================================================================
   フラッグシップ・イベント
   ========================================================================= */
function fireballBoso() {
  var t = NS.night(3, 22, 41, 18, 420);
  var lc = NS.makeLightcurve({ seed:'FB-BOSO', dur:4.28, beginMag:2.0, peakMag:-11.8, peakAt:0.66,
                               flares:[{ at:0.58, amp:1.2, w:0.028 }, { at:0.73, amp:2.4, w:0.021 }, { at:0.80, amp:1.1, w:0.017 }] });
  var ErJ = NS.integrateEr(lc), ErKt = ErJ / NS.KT_J;
  var EKt = NS.brownE(ErKt), v = 17.4;
  var EinfKt = EKt * 1.66, P = NS.aftacP(EinfKt);   /* 音響推定は光学推定の 1.7 倍程度に収まる */
  var det = [
    { id:'FNB', mag:-11.8, elev:64.2, snr:212, infra:{ dt:243.6, P:P * 1.00, amp:0.42, az:118.4 } },
    { id:'TCR', mag:-11.6, elev:47.8, snr:168, infra:{ dt:278.1, P:P * 1.05, amp:0.31, az:151.7 } },
    { id:'SRG', mag:-11.7, elev:42.1, snr:154, infra:{ dt:318.4, P:P * 0.97, amp:0.24, az:103.2 } },
    { id:'SKS', mag:-11.5, elev:38.6, snr:131, infra:{ dt:353.0, P:P * 1.03, amp:0.19, az:100.6 } },
    { id:'SNN', mag:-11.4, elev:34.9, snr:118, infra:null },
    { id:'MSM', mag:-10.9, elev:25.4, snr: 74, infra:null },
    { id:'KYM', mag:-11.1, elev:24.1, snr: 66, infra:null },
    { id:'NGN', mag:null,  elev:19.8, snr:null, cloud:true, infra:null }
  ];
  return {
    id:'NUS-FB-2027-1118-01', kind:'fireball', t:t, name:'房総沖 大火球',
    summary:'房総半島東方沖の高度 97 km で発光し、山武市付近上空 24.6 km で終端。7 局同時光学検出と 4 局のインフラサウンド検出により、光学・音響の二重エネルギー推定が成立した事例。',
    absMag:-11.8, dur:4.28, stationsDet:7, stationsFov:8, lightcurve:lc,
    begin:{ lat:35.372, lon:141.115, alt:97.2 }, end:{ lat:35.600, lon:140.420, alt:24.6 },
    vInf:v, entryAngle:47.2, azimuth:292.0, decelMax:2.9,
    ErJ:ErJ, ErKt:ErKt, EKt:EKt, EinfKt:EinfKt, infraP:P,
    massPhoto:NS.photoMass(ErJ, v, 0.05), massTerminal:0.62, tau:0.05,
    radiant:{ ra:42.3, dec:18.6, raApp:41.1, decApp:17.9 }, vg:13.9, vh:38.4,
    shower:'散在（アンチヘリオン源）',
    /* 軌道要素・輻射点は NS.buildCatalog で軌跡から導き直す（下の値は導出前の初期値） */
    orbit:{ a:1.862, e:0.521, i:4.83, q:0.892, Q:2.832, w:212.4, node:347.61, Tj:3.55, cls:'アポロ型' },
    strewn:{ lat:35.638, lon:140.305, a:4.6, b:1.5, az:288, pMax:0.34,
      bins:[{ m:'≥ 500 g', n:1, lat:35.629, lon:140.336 }, { m:'100–500 g', n:3, lat:35.634, lon:140.318 },
            { m:'20–100 g', n:9, lat:35.641, lon:140.301 }, { m:'< 20 g', n:'多数', lat:35.648, lon:140.283 }] },
    det:det, spectrum:{ lines:NS.LINES_NATURAL, cont:NS.CONT_NATURAL, kind:'natural', seed:'FB-BOSO-SP',
      fwhm:2.8, station:'船橋局', expo:'4K30p · 積算 12 フレーム',
      note:'Ca II 393/397、Mg I 518、Na I 589、Si II 635、O I 777 が卓越し、Fe I 多重項が全域に分布する典型的な流星スペクトル。Na I / Mg I の強度比は普通コンドライト的な組成と整合する。O I・N I・N₂ は大気起源（衝撃加熱された空気の発光）で、突入速度が速いほど強くなる。人工物の指標線（Al I 394/396、Cu I 510/578、Li I 670.8）は検出されない。' },
    recovery:{ status:'捜索中', teams:'文理学部 地球科学・理工学部 航空宇宙（UAV 捜索）', area:'千葉県山武市・東金市', found:0 },
    alert:{ level:'注意', issuedDt:222, recipients:['千葉県山武市 防災課', '千葉県東金市 防災課', '千葉県教育委員会', '日本大学 危機管理部'] }
  };
}

function reentryDemo() {
  var t = NS.night(6, 4, 12, 36, 900);
  var lc = NS.makeLightcurve({ seed:'RE-DEMO', dur:196.9, beginMag:1.5, peakMag:-8.2, peakAt:0.48,
    flares:[{ at:0.31, amp:1.8, w:0.012 }, { at:0.46, amp:2.6, w:0.010 }, { at:0.58, amp:2.1, w:0.011 }, { at:0.71, amp:1.4, w:0.014 }] });
  var ErJ = NS.integrateEr(lc);
  var det = [
    { id:'MSM', mag:-8.2, elev:58.3, snr:184, swir:false,  infra:{ dt:196.2, P:1.35, amp:0.28, az:74.6 } },
    { id:'SNN', mag:-8.0, elev:49.6, snr:171, swir:false,  infra:{ dt:238.7, P:1.31, amp:0.21, az:242.0 } },
    { id:'SKS', mag:-7.6, elev:36.2, snr:128, swir:false, infra:{ dt:301.5, P:1.29, amp:0.14, az:228.4 } },
    { id:'SRG', mag:-7.5, elev:33.0, snr:119, swir:false, infra:null },
    { id:'FNB', mag:-7.3, elev:29.4, snr:104, swir:true,  infra:null },
    { id:'OGK', mag:-6.9, elev:21.8, snr: 61, swir:false, infra:null }
  ];
  return {
    id:'NUS-RE-2028-0704-02', kind:'reentry', t:t, name:'太陽同期軌道の地球観測衛星の制御外再突入',
    objName:'デモ衛星 A（NORAD 仮 ID 99214 / COSPAR 2024-DEMO-A・太陽同期軌道）',
    summary:'公開軌道要素からの再突入予報（予報窓 ±32 分）に対し、実際の発光を 6 局で捉えた事例。'
      + '三陸沖から小笠原の北へ、日本列島の東を南南西へ約 1,500 km なぞる経路で、'
      + '経路角 1.42°・速度 7.6 km/s・継続 3 分 17 秒という自然火球と明確に異なる突入条件を示した。'
      + '軌跡の向きと緯度から求めた軌道傾斜角は 97.4° で、地球観測衛星が使う太陽同期軌道にあたる。'
      + '分光では Al・Cu・Li を検出した。',
    absMag:-8.2, dur:196.9, stationsDet:6, stationsFov:7, lightcurve:lc,
    begin:{ lat:41.80, lon:142.60, alt:78.4 }, end:{ lat:28.48, lon:139.96, alt:41.2 },
    vInf:7.62, entryAngle:1.42, azimuth:190.0, ErJ:ErJ, ErKt:ErJ / NS.KT_J,
    objMass:264, objArea:'太陽電池パドル 2 翼 / 本体 1.1 × 0.8 × 0.6 m',
    predict:{ issued:-9.6, windowMin:32, srcTLE:'2028-07-03T14:22Z 元期', errKm:640, errMin:11.4 },
    frag:[ { t:61.0,  alt:66.9, n:2,  note:'パドル分離（主フレア −6.4 等）' },
           { t:90.2,  alt:61.4, n:5,  note:'本体分裂（最大フレア −8.2 等）' },
           { t:114.4, alt:56.8, n:9,  note:'二次分裂・尾を引く破片列' },
           { t:139.4, alt:52.1, n:14, note:'減光しつつ破片が分散' } ],
    swirObs:{ stations:['FNB'], band:'1.2–1.6 µm', tempK:2118, tempErr:140,
      note:'可視・近赤外・SWIR の三波長帯の強度比から破片表面温度を推定。アルミ合金の融点（約 930 K）を大きく超え、酸化アルミの気化領域に達している。' },
    ablation:{ totalKg:214, alKg:68.3, cuKg:5.1, liKg:0.42, other:'Ti・Nb・Hf 微量',
      note:'成層圏エアロゾル中の宇宙機由来金属（Murphy et al. 2023, PNAS）に対応する地上からの直接観測。' },
    infraP:1.32, EinfKt:NS.aftacE(1.32),
    det:det, spectrum:{ lines:NS.LINES_ARTIFICIAL, cont:NS.CONT_ARTIFICIAL, kind:'artificial', seed:'RE-DEMO-SP',
      fwhm:2.8, station:'三島局', expo:'4K30p · 積算 30 フレーム',
      note:'原子線では Al I 394.4 / 396.2 nm が最強で、Cu I 510.6 / 521.8 / 578.2 nm、Li I 670.8 nm、Ti I・Cr I・Ni I を伴う。自然天体で最強となる Mg I 518.4 と Na I 589.0 は相対的に弱く、Ca II 393/397 も卓越しない。さらに、自然天体には現れない分子（酸化物）バンド ― AlO（450–560 nm）、CN（386–422 nm）、TiO（515–725 nm）― が検出される点が決定的である。Al は機体構造、Cu は配線とモーター、Li は電池、Ti・Nb・Hf は耐熱部材、CN は残留推進剤に由来すると考えられる。上の「再突入の局面」を切り替えると、発光開始から終端までの化学種の入れ替わりを追える。' },
    alert:{ level:'情報', issuedDt:412, recipients:['JAXA 宇宙状況把握（SSA）', '内閣府 宇宙開発戦略推進事務局（情報共有）'] }
  };
}

/* ---------- 弾道飛翔体（再突入体）の発光 ----------
   炭素系アブレータ（カーボンフェノリック）の熱防護材をもつ再突入体は、
   人工衛星の再突入とも自然天体とも違うスペクトルを出す。
   ・C₂ スワンバンド（473 / 516 / 563 nm）と CN violet が強い ← 炭素アブレータ
   ・Fe I・Cr I・Ni I ← 鋼製の構体
   ・Al I・Cu I・Li I は弱いか出ない ← 太陽電池パドル・配線・電池がない
   この「炭素は強いがアルミは弱い」という組み合わせが、衛星デブリとの決定的な違いになる。 */
NS.LINES_BALLISTIC = [
  { wl:372.0, el:'Fe I',  s:0.44 }, { wl:385.9, el:'Fe I',  s:0.52 }, { wl:393.4, el:'Ca II', s:0.30 },
  { wl:394.4, el:'Al I',  s:0.18 }, { wl:396.2, el:'Al I',  s:0.16 },
  { wl:404.6, el:'Fe I',  s:0.48 }, { wl:413.2, el:'Fe I',  s:0.46 },
  { wl:425.4, el:'Cr I',  s:0.62 }, { wl:427.5, el:'Cr I',  s:0.58 }, { wl:428.9, el:'Cr I',  s:0.54 },
  { wl:438.3, el:'Fe I',  s:0.60 }, { wl:440.5, el:'Fe I',  s:0.50 },
  { wl:471.3, el:'C₂ 帯',  s:0.66, w:3.2 }, { wl:495.8, el:'Fe I', s:0.42 },
  { wl:508.1, el:'Ni I',  s:0.44 }, { wl:515.0, el:'C₂ 帯', s:0.92, w:3.6 },
  { wl:518.4, el:'Mg I',  s:0.26 }, { wl:527.0, el:'Fe I',  s:0.50 }, { wl:532.8, el:'Fe I', s:0.46 },
  { wl:544.0, el:'Si I',  s:0.34 }, { wl:561.0, el:'C₂ 帯', s:0.58, w:3.0 },
  { wl:589.0, el:'Na I',  s:0.30 }, { wl:615.8, el:'O I',   s:0.48 },
  { wl:634.7, el:'Si II', s:0.36 }, { wl:656.3, el:'H I',   s:0.30 },
  { wl:744.2, el:'N I',   s:0.52 }, { wl:777.4, el:'O I',   s:0.88 },
  { wl:794.8, el:'Nb I',  s:0.14 }, { wl:822.3, el:'N I',   s:0.48 },
  { wl:844.6, el:'O I',   s:0.34 }, { wl:868.0, el:'N I',   s:0.40 }
];
NS.CONT_BALLISTIC = [[350,0.00],[365,0.08],[380,0.18],[400,0.26],[430,0.33],[460,0.38],[490,0.42],
  [520,0.45],[560,0.47],[600,0.47],[640,0.45],[680,0.42],[720,0.38],[760,0.33],[800,0.28],[840,0.23],
  [870,0.20],[900,0.17]];

NS.BANDS_BALLISTIC = [
  { key:'C2', name:'C₂', label:'C₂（スワンバンド Δv=0 · 473 / 516 / 563 nm）', color:'#5FBF8B',
    Texc:'約 4,500 – 6,500 K', deg:'violet', tau:14,
    heads:[[516.5, 1.00], [473.7, 0.72], [563.5, 0.55]],
    origin:'炭素系アブレータ（カーボンフェノリック）の熱防護材が焼け、気化した炭素が二原子分子として発光する。衛星デブリでは通常この強さでは現れない',
    ref:'スワンバンドは彗星・炭素星でも見られる C₂ の代表的な電子遷移（d³Π–a³Π）' },
  { key:'CN', name:'CN', label:'CN（violet 系 · 386–422 nm）', color:'#7C8FE0',
    Texc:'約 9,000 – 13,000 K', deg:'red', tau:10,
    heads:[[388.3, 1.00], [387.1, 0.82], [421.6, 0.44]],
    origin:'アブレータ由来の炭素が衝撃層の高温窒素と反応して生成される。C₂ と同時に強く出ることが炭素アブレータの証拠になる',
    ref:'ロケットデブリでは残留推進剤由来、弾道再突入体では熱防護材由来と解釈が分かれる' },
  { key:'FeO', name:'FeO', label:'FeO（orange arc · 570–650 nm）', color:'#E0A06B',
    Texc:'—', deg:'broad', tau:20,
    heads:[[600.0, 1.00]],
    origin:'鋼製の構体・接合部の鉄が酸化して生成される。アブレータが焼け抜けて構体が露出した局面で強まる',
    ref:'Fe I 多重項の増加と同時に現れる' }
];
/* 弾道再突入体の組成グループ */
NS.COMP_BALLISTIC = [
  { key:'abl',   name:'炭素系アブレータ（熱防護材）', els:['C₂ 帯'],
    color:'#5FBF8B', note:'C₂ スワンバンド 473 / 516 / 563 nm。カーボンフェノリックが焼けて気化した炭素。弾道再突入体を衛星デブリから分ける最大の手がかり' },
  { key:'steel', name:'鋼製構体（鉄・クロム・ニッケル）', els:['Fe I', 'Cr I', 'Ni I'],
    color:'#9AA3AE', note:'Fe I 多重項と Cr I 425–429 nm。アブレータが焼け抜けて構体が露出すると急増する' },
  { key:'ins',   name:'断熱・充填材（ケイ素）', els:['Si I', 'Si II'],
    color:'#B0A24A', note:'シリカフェノリックや断熱材のケイ素。炭素系と併用されることが多い' },
  { key:'metal', name:'軽金属の痕跡（Al・Mg・Na）', els:['Al I', 'Mg I', 'Na I', 'Ca II'],
    color:'#6FA8DC', note:'Al I 394/396 nm はごく弱い。人工衛星の再突入では最強になる線がここでは目立たないことが、機体構成の違いを示す' },
  { key:'rare',  name:'耐熱合金の微量元素（Nb）', els:['Nb I'],
    color:'#C77DBB', note:'ノズル・スロート部などに使われる高融点金属。検出されれば推進系の一部が残っていたことを示す' },
  { key:'atmos', name:'大気起源（衝撃加熱された空気）', els:['O I', 'N I', 'H I'],
    color:'#5FA98B', note:'O I 777.4 nm と N I。経路角が急なほど、また速度が速いほど強くなる' }
];

/* 弾道再突入体のスペクトル（組成・バンドの ON / OFF に対応） */
NS.ballisticSpectrum = function (opt) {
  opt = opt || {};
  var on = opt.bands || { C2:true, CN:true, FeO:true };
  var src = opt.comp ? NS.filterByComp(NS.LINES_BALLISTIC, NS.COMP_BALLISTIC, opt.comp) : NS.LINES_BALLISTIC;
  var lines = src.map(function (l) { return { wl:l.wl, el:l.el, s:l.s, w:l.w }; });
  var bands = NS.BANDS_BALLISTIC.filter(function (b) { return on[b.key]; })
    .map(function (b) { return { def:b, amp:({ C2:0.95, CN:0.80, FeO:0.35 })[b.key] }; });
  return { lines:lines, bands:bands,
           pts:NS.synthSpectrum(lines, { seed:'RE-BALLISTIC', cont:NS.CONT_BALLISTIC, fwhm:2.8,
                                         lo:350, hi:900, n:1200, bands:bands }) };
};

/* ---------- 弾道飛翔体の再突入（想定シナリオ） ----------
   実際の発射・落下の記録ではない。J-ALERT が発出されたあとに、本観測網が
   「どこへ、いつ落ちたか」を独立に押さえられるかを確かめるための訓練用シナリオ。
   飛翔経路や機体諸元の推定を目的とするものではなく、公表されている落下海域の
   おおよその位置と、再突入体の一般的な熱防護材の構成だけを前提にしている。 */
NS.missileT = function () { return Date.UTC(2027, 9, 14, 20, 6, 31); };  /* 2027-10-15 05:06 JST */

function ballisticScenario() {
  var t = NS.missileT();
  var lc = NS.makeLightcurve({ seed:'RE-BAL', dur:22.4, beginMag:2.2, peakMag:-6.8, peakAt:0.62,
    flares:[{ at:0.55, amp:1.1, w:0.018 }, { at:0.74, amp:1.6, w:0.014 }, { at:0.86, amp:0.9, w:0.020 }] });
  var ErJ = 3.62e7;                       /* 発光効率 τ ≒ 0.4 %（低速のため小さい） */
  var det = [
    { id:'TCR', mag:-6.8, elev:38.9, snr:142, swir:false, infra:{ dt:552,  P:1.9, amp:2.81, az: 82.3 } },
    { id:'FNB', mag:-6.6, elev:32.8, snr:128, swir:true,  infra:{ dt:640,  P:2.0, amp:2.42, az: 71.1 } },
    { id:'TDN', mag:-6.5, elev:32.5, snr:121, swir:false, infra:{ dt:644,  P:2.0, amp:2.38, az: 69.9 } },
    { id:'KYM', mag:-6.5, elev:33.6, snr:118, swir:true,  infra:{ dt:637,  P:2.1, amp:2.35, az:129.9 } },
    { id:'SRG', mag:-6.2, elev:29.5, snr: 96, swir:false, infra:{ dt:715,  P:2.2, amp:2.06, az: 72.2 } },
    { id:'SKS', mag:-6.0, elev:27.8, snr: 88, swir:false, infra:{ dt:758,  P:2.2, amp:1.94, az: 72.4 } },
    { id:'SNN', mag:-5.7, elev:24.7, snr: 71, swir:false,  infra:{ dt:840,  P:2.4, amp:1.72, az: 66.3 } },
    { id:'YMG', mag:-5.4, elev:23.2, snr: 62, swir:false, infra:{ dt:888,  P:2.5, amp:1.63, az:145.9 } }
  ];
  return {
    id:'NUS-SC-BAL-2027', kind:'reentry', t:t, scenario:true,
    name:'北朝鮮 弾道ミサイル 再突入（2027 年 想定シナリオ）',
    objName:'弾道飛翔体の再突入体（型式・諸元は特定しない）',
    scenarioNote:'本事象は実際の発射・落下の記録ではない。J-ALERT（全国瞬時警報システム）が発出されたのち、'
      + '本観測網が落下時刻と落下海域を独立に押さえられるかを確かめるための訓練用シナリオである。'
      + '飛翔経路や機体諸元を推定することを目的とせず、発射の予知・切迫性を示すものでもない。'
      + '警報・避難の判断は内閣官房・防衛省・消防庁の発表が優先する。',
    summary:'茨城県 大洗の東 約 210 km の太平洋上に落下した想定で、再突入体の発光を 8 局が捉える。'
      + '突入速度 5.9 km/s・経路角 38.0°・継続 22.4 秒という組み合わせは、軌道デブリ（経路角 1〜3°）とも'
      + '自然火球（11 km/s 以上）とも重ならない。分光では炭素系アブレータ由来の C₂ スワンバンドと CN が強く、'
      + '人工衛星で最強となる Al I がごく弱いことから、熱防護材をもつ弾道再突入体と判別できる。',
    absMag:-6.8, dur:22.4, stationsDet:8, stationsFov:10, lightcurve:lc,
    begin:{ lat:36.398, lon:141.525, alt:100.0 }, end:{ lat:36.180, lon:142.529, alt:27.0 },
    impact:{ lat:36.100, lon:142.900, name:'茨城県 大洗の東 約 210 km の太平洋上' },
    vInf:5.90, entryAngle:38.0, azimuth:105.0, ErJ:ErJ, ErKt:ErJ / NS.KT_J,
    objMass:520, objArea:'再突入体（円錐形・底面直径 約 1 m 想定）',
    ballistic:{
      jalert:{ issuedDt:-486, label:'J-ALERT 発出（発射の探知から 4 分・落下予測 26 分前）' },
      apogeeKm:1000, rangeKm:1510, flightSec:1080,
      splashErrKm:3.8, splashErrSec:2.4, eez:'排他的経済水域（EEZ）の内側・領海の外',
      note:'落下点は 8 局のインフラサウンド到達時刻差の交会で決めた。光学の軌跡延長（±6.1 km）より'
        + '音のほうが精度が高いのは、発光終了の高度 27 km から海面までの暗黒飛行を音が飛び越えるため。'
    },
    predict:{ issued:-0.135, windowMin:6, srcTLE:'J-ALERT の落下予測（防衛省発表）', errKm:14.2, errMin:0.4 },
    frag:[ { t:12.6, alt:58.2, n:1, note:'アブレータ表面が発光を始める（主発光の立ち上がり）' },
           { t:16.4, alt:44.1, n:1, note:'最大光度 −6.8 等。減速が最も強い区間' },
           { t:18.9, alt:35.7, n:3, note:'小片の剥離（フレア 1.6 等分）。構体の一部が露出' },
           { t:22.4, alt:27.0, n:3, note:'発光終了。ここから海面まで約 35 km を暗黒飛行' } ],
    swirObs:{ stations:['FNB','KYM'], band:'1.2–1.6 µm', tempK:2860, tempErr:180,
      note:'炭素系アブレータの表面温度は 2,500 K を超える。アルミ合金が溶ける 930 K どころか、'
        + '酸化アルミの沸点 3,250 K に迫る。熱防護材が設計どおり働いていることを外から確認できる。' },
    ablation:{ totalKg:58, parts:[ { el:'C', kg:44.6, color:'var(--c-ok)' }, { el:'Si', kg:6.8, color:'var(--c-cau)' },
                                   { el:'Fe', kg:5.1, color:'var(--muted)' }, { el:'Al', kg:0.9, color:'var(--c-info)' },
                                   { el:'Nb', kg:0.2, color:'var(--c-spec)' } ],
      other:'Cu・Li は検出されない（配線・電池を持たない）',
      note:'アブレータは焼けて減ることで熱を逃がす仕組みなので、質量の減り方そのものが熱防護材の働きを表す。'
        + '衛星デブリでは Al が支配的になるのに対し、ここでは炭素が 8 割近くを占める。' },
    infraP:2.0, EinfKt:NS.aftacE(2.0),
    det:det,
    spectrum:{ kind:'ballistic', seed:'RE-BAL-SP', station:'土浦局', expo:'4K30p · 積算 24 フレーム',
      note:'C₂ スワンバンド（473 / 516 / 563 nm）と CN violet（386–422 nm）が全体を支配し、'
        + 'Fe I 多重項と Cr I 425–429 nm が重なる。人工衛星の再突入で最強になる Al I 394.4 / 396.2 nm はごく弱く、'
        + 'Cu I・Li I は検出されない。炭素が強くアルミが弱いというこの組み合わせが、'
        + '太陽電池パドルや電池をもつ衛星ではなく、炭素系アブレータの熱防護材をもつ再突入体であることを示す。'
        + '組成のボタンで各成分を切り替えると、どの線がどの部材に由来するかを確かめられる。' },
    alert:{ level:'情報', issuedDt:734,
      recipients:['内閣官房（事態対処・危機管理）', '防衛省（情報提供）', '茨城県 防災・危機管理課',
                  '茨城県教育委員会', '海上保安庁 第三管区（航行警報の参考）'] }
  };
}

/* ---------- ロックーン方式の弾道飛行（サブオービタル）の再突入 ----------
   気球で成層圏まで運んでから空中発射する「ロックーン」方式（AstroX が福島県
   南相馬市で開発）を想定した協力観測。飛行計画と機体の GNSS 追尾データが
   あらかじめ共有されるので、真値の分かっている再突入＝観測網の較正事象になる。
   突入速度は 1.5 km/s 台で、軌道デブリ（7〜8 km/s）とも自然火球（11 km/s 以上）とも
   桁で違う。発光は暗いが、経路が近いのでインフラサウンドは大振幅で届く。 */
function rockoonDemo() {
  var t = NS.night(9, 19, 52, 14, 300);
  var lc = NS.makeLightcurve({ seed:'RE-RKN', dur:6.8, beginMag:3.6, peakMag:-3.4, peakAt:0.58,
    flares:[{ at:0.64, amp:0.8, w:0.020 }] });
  var ErJ = 6.4e5;                        /* 低速なので発光効率は小さい（τ ≒ 0.15 %） */
  var det = [
    { id:'KYM', mag:-3.4, elev:52.6, snr:96, swir:true,  infra:{ dt:268.4, P:0.62, amp:1.24, az:104.8 } },
    { id:'YMG', mag:-3.1, elev:31.4, snr:64, swir:false, infra:{ dt:502.7, P:0.68, amp:0.46, az:128.3 } },
    { id:'TCR', mag:-2.9, elev:27.8, snr:58, swir:false, infra:{ dt:571.2, P:0.70, amp:0.38, az: 38.6 } },
    { id:'FNB', mag:-2.4, elev:18.9, snr:37, swir:true,  infra:{ dt:742.9, P:0.74, amp:0.21, az: 27.4 } },
    { id:'SNN', mag:-2.1, elev:15.2, snr:29, swir:false, infra:null }
  ];
  return {
    id:'NUS-RE-RKN-2028', kind:'reentry', t:t, scenario:true,
    tab:'ロックーン弾道飛行（協力観測）',
    scenarioTitle:'協力観測の想定です',
    name:'ロックーン方式 弾道飛行の再突入（協力観測）',
    objName:'サブオービタル機体 第 2 段（カーボン複合材 ＋ アルミ合金）',
    scenarioNote:'株式会社 AstroX（福島県南相馬市）が開発するロックーン方式'
      + '（気球で成層圏へ運び、そこからロケットを空中発射する方式）の弾道飛行を想定した、'
      + '事業者との協力観測の例である。実際の飛行計画・打上げ実績を示すものではなく、数値はすべて模擬データである。',
    summary:'気球で高度 20 km まで上げてから点火し、頂点 120 km に達した機体の第 2 段が、'
      + '発射点の東 82 km の海上へ落下する想定。突入速度 1.55 km/s・経路角 62° は、'
      + '軌道デブリ（7〜8 km/s・経路角 1〜3°）とも自然火球（11 km/s 以上）とも重ならない。'
      + '飛行計画と機体の GNSS 追尾という「真値」が手に入るので、'
      + '観測網の位置・時刻・エネルギー推定をそのまま較正できる数少ない機会になる。',
    absMag:-3.4, dur:6.8, stationsDet:5, stationsFov:7, lightcurve:lc,
    begin:{ lat:37.612, lon:141.480, alt:74.2 }, end:{ lat:37.548, lon:141.836, alt:31.5 },
    impact:{ lat:37.508, lon:142.010, name:'福島県 南相馬の東 約 82 km の太平洋上（洋上回収域）' },
    vInf:1.55, entryAngle:62.0, azimuth:104.0, ErJ:ErJ, ErKt:ErJ / NS.KT_J,
    objMass:180, objArea:'第 2 段（直径 0.42 m・全長 3.1 m）',
    ballistic:{ apogeeKm:120, rangeKm:82, flightSec:436, splashErrKm:0.9, splashErrSec:0.6,
      eez:'領海の外・排他的経済水域（EEZ）の内側（洋上回収域）',
      note:'落下点は 4 局のインフラサウンド到達時刻差の交会で決めた。' },
    plan:{
      src:'事業者から提供された飛行計画（打上げ 2 時間前）と、機体搭載 GNSS の追尾ログ（飛行後）',
      rows:[
        { k:'再突入時刻', truth:'20:07:14.62 JST', obs:'20:07:14.27 JST', diff:'−0.35 s' },
        { k:'発光開始高度', truth:'74.6 km', obs:'74.2 km', diff:'−0.4 km' },
        { k:'突入速度', truth:'1.59 km/s', obs:'1.55 km/s', diff:'−0.04 km/s（2.5 %）' },
        { k:'経路角', truth:'61.4°', obs:'62.0°', diff:'+0.6°' },
        { k:'着水点', truth:'37.512°N 142.004°E', obs:'37.508°N 142.010°E', diff:'0.7 km' },
        { k:'着水時刻', truth:'20:08:03.1 JST', obs:'20:08:02.5 JST', diff:'−0.6 s' }
      ],
      note:'真値が分かる再突入は、観測網にとって「ものさし合わせ」の機会である。'
        + 'ここで求めた系統差（時刻 −0.35 秒、速度 −2.5 %）は、真値のない自然火球や軌道デブリの'
        + '推定にそのまま補正として効かせられる。種子島の打上げをインフラサウンドの較正事象として'
        + '使うのと同じ考え方を、光学・分光・音響の三つに広げたものにあたる。'
    },
    timeline:[
      { t:'−2 時間 40 分', ev:'南相馬の沖合で気球を放球（洋上・船上放球）' },
      { t:'−0 時間 22 分', ev:'高度 20 km に到達。姿勢と方位を整える' },
      { t:'0 秒', ev:'空中発射（第 1 段点火）' },
      { t:'+2 分 06 秒', ev:'頂点 120 km を通過（サブオービタル）' },
      { t:'+6 分 58 秒', ev:'第 2 段が高度 74 km で発光開始（本観測網が検出）' },
      { t:'+7 分 47 秒', ev:'着水。洋上回収船が回収に向かう' }
    ],
    predict:{ issued:-2.0, windowMin:1, srcTLE:'事業者の飛行計画（打上げ 2 時間前に共有）', errKm:0.7, errMin:0.01 },
    frag:[ { t:1.9, alt:66.4, n:1, note:'アブレータ表面が発光を始める' },
           { t:3.9, alt:48.8, n:1, note:'最大光度 −3.4 等。減速が最も強い区間' },
           { t:4.4, alt:45.1, n:2, note:'小片の剥離（フレア 0.8 等分）' },
           { t:6.8, alt:31.5, n:2, note:'発光終了。ここから海面まで約 31 km を暗黒飛行' } ],
    swirObs:{ stations:['KYM','FNB'], band:'1.2–1.6 µm', tempK:1465, tempErr:120,
      note:'速度が 1.5 km/s 台と遅いため、よどみ点の加熱は弾道ミサイルの再突入体（2,800 K 級）より'
        + 'はるかに穏やかで、アルミ合金の融点（約 930 K）を少し超える程度にとどまる。'
        + '熱防護材の設計余裕を外から確かめられる。' },
    ablation:{ totalKg:2.4, parts:[ { el:'C', kg:1.32, color:'var(--c-ok)' }, { el:'Al', kg:0.78, color:'var(--c-info)' },
                                    { el:'Fe', kg:0.21, color:'var(--muted)' }, { el:'Si', kg:0.09, color:'var(--c-cau)' } ],
      other:'Cu・Li は微量（機体の電装が小さい）',
      note:'総アブレーション質量は機体質量の 1 % 台で、軌道デブリ（数十 %）とは比べものにならない。'
        + '低速の弾道飛行では、機体はほとんど燃えずに落ちてくる。' },
    infraP:0.68, EinfKt:NS.aftacE(0.68),
    det:det,
    spectrum:{ kind:'ballistic', seed:'RE-RKN-SP', station:'郡山局', expo:'4K30p · 積算 40 フレーム',
      note:'カーボン複合材の外皮に由来する C₂ スワンバンド（473 / 516 / 563 nm）と CN violet（386–422 nm）が出るが、'
        + '速度が遅いぶん励起温度が低く、大気起源の O I 777・N I は弱い。'
        + 'アルミ合金の Al I 394.4 / 396.2 nm は、衛星の再突入ほどではないが弾道ミサイルの再突入体よりは強く出る。'
        + '真値が分かっているので、このスペクトルは「既知組成の標準光源」として、'
        + '自然天体・軌道デブリのスペクトル同定の基準に使える。' },
    alert:{ level:'情報', issuedDt:96,
      recipients:['事業者（飛行安全）', '海上保安庁 第二管区（航行警報の参考）', '福島県 南相馬市 危機管理課',
                  'JAXA 宇宙状況把握（SSA）（情報共有）'] }
  };
}

/* ---------- インフラサウンド事象 ---------- */
NS.fujiT = function () { return Date.UTC(2028, 10, 23, 0, 41, 12); };   /* 2028-11-23 09:41 JST */

function infraEvents() {
  var now = NS.now();
  return [
    { id:'NUS-IS-A-0412', kind:'infrasound', cls:'火山', t: now - 13.6 * 3600e3, name:'桜島 昭和火口 噴火',
      src:{ lat:31.585, lon:130.657, name:'桜島（鹿児島県）' }, srcKnown:true,
      summary:'噴煙高度 2,300 m の噴火に伴うインフラサウンドを 3 局で検出。到達時刻差の交会で震源位置を推定し、気象庁発表の火口位置と 6.8 km で一致した。',
      det:[ { id:'MYZ', dist:82.4,  dt:273.2, az:245.6, azErr:2.4, amp:1.82, P:3.4, phase:'直達波（Iw）' },
            { id:'NGS', dist:151.3, dt:503.7, az:157.1, azErr:3.1, amp:0.74, P:3.8, phase:'直達波（Iw）' },
            { id:'OGK', dist:706.0, dt:2641.0, az:236.8, azErr:5.6, amp:0.11, P:5.2, phase:'成層圏反射波（Is）' } ],
      locErr:6.8, cel:0.302, note:'大垣局の成層圏反射波（Is）到達から、高度 40–50 km の東西風速を約 62 m/s と逆推定（G-4）。',
      peakPa:1.82, freq:'0.3–2.4 Hz' },
    { id:'NUS-IS-R-0221', kind:'infrasound', cls:'ロケット', t: now - 2.4 * 86400e3, name:'種子島宇宙センター 打上げ（較正事象）',
      src:{ lat:30.400, lon:130.968, name:'種子島宇宙センター 第2射点' }, srcKnown:true,
      summary:'発生時刻・位置が既知の打上げを較正事象として用い、アレイ処理の定位精度を検証。推定位置は真の射点から 3.1 km。',
      det:[ { id:'MYZ', dist:175.2, dt:581.4, az:212.3, azErr:1.8, amp:0.96, P:2.1, phase:'直達波（Iw）' },
            { id:'NGS', dist:285.6, dt:948.0, az:170.4, azErr:2.2, amp:0.38, P:2.4, phase:'直達波（Iw）' } ],
      locErr:3.1, cel:0.301, note:'既知音源による定位精度の検証。到達方位の系統誤差は 2° 以内。', peakPa:0.96, freq:'0.5–4.0 Hz' },
    { id:'NUS-IS-T-0118', kind:'infrasound', cls:'雷・線状降水帯', t: now - 31 * 3600e3, name:'関東南部 線状降水帯に伴う雷放電群',
      src:{ lat:35.82, lon:139.98, name:'埼玉県東部〜千葉県北西部' }, srcKnown:false,
      summary:'線状降水帯の通過に伴い、6 時間で 1,842 回の落雷起源インフラサウンドを検出。気象センサーの気圧・雨量と同期して降水帯の移動方向を追跡した。',
      det:[ { id:'FNB', dist:24.1, dt:79.0,  az:318.2, azErr:4.0, amp:2.41, P:0.42, phase:'直達波' },
            { id:'TCR', dist:41.8, dt:138.6, az:196.4, azErr:4.8, amp:1.63, P:0.44, phase:'直達波' },
            { id:'SRG', dist:29.6, dt:98.2,  az: 47.1, azErr:5.2, amp:1.88, P:0.40, phase:'直達波' },
            { id:'SKS', dist:41.3, dt:137.1, az: 41.6, azErr:5.6, amp:1.21, P:0.41, phase:'直達波' } ],
      locErr:11.2, cel:0.305, strikes:1842, note:'降水帯の移動速度 34 km/h、移動方位 072°。学校への注意喚起は雷検知から 4 分で発報（G-7 の試行）。',
      peakPa:2.41, freq:'0.8–14 Hz' },
    { id:'NUS-SC-FUJI-2028', kind:'infrasound', cls:'火山（想定シナリオ）', scenario:true,
      t: NS.fujiT(), name:'富士山 宝永火口 噴火（2028 年 想定シナリオ）',
      src:{ lat:35.3361, lon:138.7439, name:'富士山 宝永火口（静岡県駿東郡小山町・裾野市）' }, srcKnown:true,
      summary:'これは実際の観測ではなく、通報手順と学校対応を確かめるための訓練用シナリオである。1707 年の宝永噴火を参考に、南東斜面の宝永火口から噴煙高度 16 km の準プリニー式噴火が起きた場合に、本観測網の 11 局がどう捉えるかを計算した。三島局には 1 分 35 秒で 68 Pa の空振が到達し、20 分以内に東北地方まで検知が広がる。',
      det:[ { id:'MSM', dist:28.6,  dt:95.4,   az:326.7, azErr:1.2, amp:67.9, P:8.2, phase:'直達波（Iw）' },
            { id:'SNN', dist:66.0,  dt:220.0,  az:266.5, azErr:1.6, amp:28.3, P:7.8, phase:'直達波（Iw）' },
            { id:'SKS', dist:88.4,  dt:294.6,  az:245.7, azErr:1.8, amp:20.8, P:7.6, phase:'直達波（Iw）' },
            { id:'SRG', dist:100.8, dt:335.9,  az:246.7, azErr:1.9, amp:18.1, P:7.5, phase:'直達波（Iw）' },
            { id:'TDN', dist:121.6, dt:405.3,  az:251.3, azErr:2.1, amp:14.9, P:7.4, phase:'直達波（Iw）' },
            { id:'FNB', dist:126.2, dt:420.5,  az:250.3, azErr:2.1, amp:14.3, P:7.4, phase:'直達波（Iw）' },
            { id:'NGN', dist:152.0, dt:506.6,  az:161.1, azErr:2.4, amp:11.8, P:7.2, phase:'直達波（Iw）' },
            { id:'TCR', dist:156.0, dt:520.0,  az:238.2, azErr:2.4, amp:11.5, P:7.2, phase:'直達波（Iw）' },
            { id:'OGK', dist:192.7, dt:642.2,  az: 90.5, azErr:3.0, amp: 9.2, P:6.9, phase:'直達波（Iw）' },
            { id:'KYM', dist:271.5, dt:904.9,  az:213.2, azErr:3.8, amp: 6.4, P:6.6, phase:'成層圏反射波（Is）' },
            { id:'YMG', dist:355.0, dt:1183.2, az:203.9, azErr:4.6, amp: 4.8, P:6.4, phase:'成層圏反射波（Is）' } ],
      locErr:2.4, cel:0.300, peakPa:67.9, freq:'0.05 – 6 Hz',
      plume:16.0, vei:4, ref:'1707 年 宝永噴火',
      ashfall:[ ['三島局・湘南局（30–70 km、風下側）', '10 – 30 cm', '屋外活動の全面中止。校舎の屋根への堆積荷重に注意'],
                ['駿河台局・桜上水局（90–100 km）', '2 – 10 cm', '休校の判断。通学路の視界低下と交通の乱れ'],
                ['船橋局・津田沼局・土浦局（120–160 km）', '1 – 5 cm', '屋外活動の中止。空調フィルタの目詰まり'],
                ['郡山局・山形局（270–360 km）', '痕跡程度', '通常運用。降灰の観測に徹する'] ],
      note:'噴煙高度は空振の振幅と周期から推定する。全 11 局の到達時刻差で火口位置を ±2.4 km で決められるため、どの火口が開いたか（山頂か側火口か）を音だけで判別できる。これは降灰予測の初期値として効く。成層圏反射波（Is）が届く郡山局・山形局では、到達時刻から高度 40–50 km の東西風も同時に求まる。',
      scenarioNote:'本事象は実際の観測記録ではない。中央防災会議・富士山火山防災対策協議会が想定する宝永噴火級の噴火を参考に、本観測網の応答を計算した訓練用シナリオである。噴火の予知・切迫性を示すものではなく、発生時期を予測するものでもない。' },
    { id:'NUS-IS-Q-0106', kind:'seismic', cls:'地震', t: now - 4.2 * 86400e3, name:'茨城県南部の地震（M4.8）に伴う校舎応答',
      src:{ lat:36.03, lon:140.05, name:'茨城県南部 深さ 48 km' }, srcKnown:true,
      summary:'微動計（DT-6）で 3 局の校舎応答を記録。土浦局の校舎 1 次固有振動数は地震前 3.42 Hz → 地震後 3.38 Hz（−1.2 %）で、構造的な損傷を示す変化ではないと判定。',
      det:[ { id:'TCR', dist:11.4, f0:3.38, f0pre:3.42, drift:-1.2, pga:42.6, judge:'継続使用可' },
            { id:'FNB', dist:63.8, f0:2.91, f0pre:2.92, drift:-0.3, pga:18.1, judge:'継続使用可' },
            { id:'SKS', dist:78.2, f0:4.06, f0pre:4.06, drift: 0.0, pga: 9.4, judge:'継続使用可' } ],
      note:'固有振動数の低下が 5 % を超えた場合に「点検要」を自動発報する運用（工学部 建築・理工学部 建築の共同設計）。' }
  ];
}


/* =========================================================================
   流星群（IMO Meteor Shower Calendar / IMO Working List に基づく）
   activity：活動期間、peak：極大日、sol：極大の太陽黄経、zhr：極大 ZHR、
   v：大気圏突入速度 km/s、ra/dec：極大時の輻射点（J2000）、
   r：質量分布指数、B：活動プロファイルの減衰係数（ZHR = ZHRmax·10^(−B|Δλ☉|)）
   ========================================================================= */
NS.SHOWERS = [
  { code:'QUA', ja:'しぶんぎ座流星群',       en:'Quadrantids',
    start:[12,28], peak:[1,3],  end:[1,12],  sol:283.15, zhr:110, v:41, ra:230.0, dec:49.5, r:2.1, B:2.20 },
  { code:'LYR', ja:'こと座流星群',           en:'Lyrids',
    start:[4,14],  peak:[4,22], end:[4,30],  sol:32.32,  zhr:18,  v:49, ra:271.0, dec:34.0, r:2.1, B:0.22 },
  { code:'ETA', ja:'みずがめ座η流星群',      en:'η-Aquariids',
    start:[4,19],  peak:[5,6],  end:[5,28],  sol:45.5,   zhr:50,  v:66, ra:338.0, dec:-1.0, r:2.4, B:0.08 },
  { code:'CAP', ja:'やぎ座α流星群',          en:'α-Capricornids',
    start:[7,3],   peak:[7,30], end:[8,15],  sol:127.0,  zhr:5,   v:23, ra:307.0, dec:-10.2, r:2.5, B:0.037 },
  { code:'SDA', ja:'みずがめ座δ南流星群',    en:'Southern δ-Aquariids',
    start:[7,12],  peak:[7,30], end:[8,23],  sol:127.0,  zhr:25,  v:41, ra:340.5, dec:-16.4, r:3.2, B:0.091 },
  { code:'PER', ja:'ペルセウス座流星群',     en:'Perseids',
    start:[7,17],  peak:[8,12], end:[8,24],  sol:140.0,  zhr:100, v:59, ra:48.2,  dec:58.1, r:2.2, B:0.19 },
  { code:'AUR', ja:'ぎょしゃ座α流星群',      en:'α-Aurigids',
    start:[8,28],  peak:[9,1],  end:[9,5],   sol:158.6,  zhr:6,   v:66, ra:84.0,  dec:39.0, r:2.6, B:0.90 },
  { code:'SPE', ja:'ペルセウス座9月ε流星群', en:'September ε-Perseids',
    start:[9,5],   peak:[9,9],  end:[9,21],  sol:166.7,  zhr:5,   v:64, ra:48.0,  dec:40.0, r:2.9, B:0.40 },
  { code:'DRA', ja:'りゅう座流星群',         en:'October Draconids',
    start:[10,6],  peak:[10,8], end:[10,10], sol:195.4,  zhr:5,   v:20, ra:262.0, dec:54.0, r:2.6, B:2.50 },
  { code:'STA', ja:'おうし座南流星群',       en:'Southern Taurids',
    start:[9,10],  peak:[10,10],end:[11,20], sol:197.0,  zhr:5,   v:27, ra:48.0,  dec:14.0, r:2.3, B:0.026 },
  { code:'ORI', ja:'オリオン座流星群',       en:'Orionids',
    start:[10,2],  peak:[10,21],end:[11,7],  sol:208.0,  zhr:20,  v:66, ra:95.2,  dec:15.6, r:2.5, B:0.12 },
  { code:'NTA', ja:'おうし座北流星群',       en:'Northern Taurids',
    start:[10,20], peak:[11,12],end:[12,10], sol:230.0,  zhr:5,   v:29, ra:59.0,  dec:22.7, r:2.3, B:0.026 },
  { code:'LEO', ja:'しし座流星群',           en:'Leonids',
    start:[11,6],  peak:[11,17],end:[11,30], sol:235.27, zhr:12,  v:71, ra:154.3, dec:21.6, r:2.5, B:0.55 },
  { code:'MON', ja:'こいぬ座流星群',         en:'December Monocerotids',
    start:[11,27], peak:[12,9], end:[12,20], sol:257.0,  zhr:3,   v:41, ra:103.0, dec:8.0,  r:3.0, B:0.25 },
  { code:'GEM', ja:'ふたご座流星群',         en:'Geminids',
    start:[12,4],  peak:[12,14],end:[12,20], sol:262.2,  zhr:150, v:35, ra:113.5, dec:32.3, r:2.6, B:0.39 },
  { code:'URS', ja:'こぐま座流星群',         en:'Ursids',
    start:[12,17], peak:[12,22],end:[12,26], sol:270.7,  zhr:10,  v:33, ra:219.0, dec:75.3, r:3.0, B:0.90 }
];

/* 日付 → 年内通日（うるう年は考慮しない近似） */
var MD = [0,31,59,90,120,151,181,212,243,273,304,334];
function doyOf(m, d) { return MD[m - 1] + d; }
function doyT(t) { var p = NS.jstParts(t); return doyOf(p.mo, p.d) + p.h / 24; }
/* 年をまたぐ期間も扱う日数差（−182〜182） */
function dayDiff(a, b) { var d = a - b; while (d > 182.6) d -= 365.25; while (d < -182.6) d += 365.25; return d; }
/* 期間内かどうか */
function inPeriod(doy, s, e) {
  if (s <= e) return doy >= s && doy <= e;
  return doy >= s || doy <= e;            /* 年をまたぐ */
}
/* 輻射点の地平高度（度）。地平下なら負 */
NS.radiantAlt = function (raDeg, decDeg, t, lat, lon) {
  var lst = NS.lst(t, lon);
  var ha = (lst - raDeg) * NS.d2r, dec = decDeg * NS.d2r, la = lat * NS.d2r;
  return Math.asin(Math.max(-1, Math.min(1,
    Math.sin(dec) * Math.sin(la) + Math.cos(dec) * Math.cos(la) * Math.cos(ha)))) * NS.r2d;
};
/* ある時刻に活動している流星群。zhr は IMO の ZHR = ZHRmax·10^(−B|Δ|) による推定値 */
NS.activeShowers = function (t, st) {
  st = st || NS.ST.FNB;
  var doy = doyT(t), out = [];
  NS.SHOWERS.forEach(function (sh) {
    var s = doyOf(sh.start[0], sh.start[1]), e = doyOf(sh.end[0], sh.end[1]);
    if (!inPeriod(doy, s, e)) return;
    var dd = Math.abs(dayDiff(doy, doyOf(sh.peak[0], sh.peak[1])));
    var zhr = sh.zhr * Math.pow(10, -sh.B * dd);
    if (zhr < 0.25) return;
    var alt = NS.radiantAlt(sh.ra, sh.dec, t, st.lat, st.lon);
    out.push({ sh:sh, zhr:zhr, alt:alt, dDays:dayDiff(doy, doyOf(sh.peak[0], sh.peak[1])),
      /* 観測される出現数は ZHR に輻射点高度の正弦をかけたものに比例する */
      rate:alt > 5 ? zhr * Math.pow(Math.sin(alt * NS.d2r), 0.7) : 0 });
  });
  out.sort(function (a, b) { return b.rate - a.rate; });
  return out;
};
/* 散在流星の基準（夜半前後の ZHR 相当） */
NS.SPORADIC_ZHR = 10;
/* その時刻に最もふさわしい母集団を 1 つ選ぶ（重みつき） */
NS.pickShower = function (t, st, rnd) {
  var act = NS.activeShowers(t, st);
  var tot = NS.SPORADIC_ZHR, i;
  for (i = 0; i < act.length; i++) tot += act[i].rate;
  var x = rnd() * tot;
  if (x < NS.SPORADIC_ZHR) return null;                 /* 散在 */
  x -= NS.SPORADIC_ZHR;
  for (i = 0; i < act.length; i++) { x -= act[i].rate; if (x <= 0) return act[i]; }
  return null;
};

/* ---------- 通常の流星・小火球の自動生成（直近14夜） ---------- */
function routineEvents() {
  var out = [], now = NS.now(), ref = NS.ST.FNB;
  for (var n = 0; n <= 13; n++) {
    var r = NS.rng('rt|' + n + '|' + NS.fmtJST(NS.night(n, 23, 0), { dateOnly:true }));
    var k = r.int(1, 4);
    for (var j = 0; j < k; j++) {
      var hh = r.int(19, 28), t = NS.night(n, hh % 24, r.int(0, 59), r.int(0, 59));
      if (hh >= 24) t += 86400e3;
      if (t > now) continue;
      /* 母集団は IMO の活動期間・極大・ZHR と輻射点高度から重みつきで選ぶ */
      var pick = NS.pickShower(t, ref, r);
      var sh = pick ? pick.sh : null;
      var shower = sh ? sh.ja : '散在';
      var v = sh ? Math.max(11.2, sh.v + r.norm(0, 1.1)) : r.range(11.5, 68);
      var rad = sh ? { ra:sh.ra, dec:sh.dec } : { ra:r() * 360, dec:r.range(-25, 70) };
      var m = -(1.0 + Math.pow(r(), 2.4) * 9.6);
      var nst = Math.max(2, Math.min(9, Math.round(2 + (-m) * 0.62 + r.norm(0, 0.9))));
      var idx = NS.STATIONS.slice().sort(function () { return r() - 0.5; }).slice(0, nst).map(function (s2) { return s2.id; });
      out.push({ id:'NUS-FB-' + NS.fmtJST(t, { dateOnly:true }).replace(/-/g, '') + '-' + NS.p2(j + 3),
        kind:m < -4 ? 'fireball' : 'meteor', t:t, name:(m < -4 ? '火球' : '流星') + '（' + shower + '）',
        absMag:m, dur:r.range(0.6, 3.4), stationsDet:nst, stationsFov:nst + r.int(0, 3), vInf:v,
        shower:shower, showerCode:sh ? sh.code : 'SPO', showerEn:sh ? sh.en : 'Sporadic',
        zhr:pick ? pick.zhr : null, radAlt:pick ? pick.alt : null,
        radiant:{ ra:rad.ra, dec:rad.dec }, stationIds:idx, auto:true,
        EKt:NS.brownE(NS.lumPower(m) * r.range(0.25, 0.5) * r.range(0.6, 3.4) / NS.KT_J),
        hasInfra:m < -8 && r() > 0.4, hasSpec:m < -6 && r() > 0.35,
        begin:{ alt:r.range(88, 112) }, end:{ alt:r.range(28, 82) } });
    }
  }
  return out.sort(function (a, b) { return b.t - a.t; });
}

/* ---------- 再突入予報（今後） ---------- */
/* ---------- 再突入体の候補カタログ（フィッティング用） ----------
   観測から求まるのは軌道傾斜角・周期・速度で、そこへ公開カタログを突き合わせて物体を絞る。
   下は本デモ用の仮想の物体で、実在の衛星ではない。 */
NS.DEBRIS_CANDIDATES = [
  { name:'デモ衛星 A', norad:'99214', cospar:'2024-DEMO-A', inc:97.4, alt:172, mass:264,
    type:'地球観測衛星（太陽同期軌道）', tOff:11.4 },
  { name:'デモ衛星 B', norad:'99331', cospar:'2023-DEMO-C', inc: 51.6, alt:198, mass:1180,
    type:'通信衛星（第2世代）', tOff:-36.2 },
  { name:'デモ上段 C', norad:'99418', cospar:'2026-DEMO-B', inc: 97.9, alt:154, mass:920,
    type:'ロケット上段（太陽同期軌道）', tOff:64.8 },
  { name:'デモ衛星 D', norad:'99502', cospar:'2025-DEMO-F', inc: 62.5, alt:210, mass:260,
    type:'地球観測衛星', tOff:-88.1 },
  { name:'デモ破片 E', norad:'99677', cospar:'2019-DEMO-K', inc: 22.8, alt:141, mass:45,
    type:'衝突破片', tOff:142.6 }
];

function reentryForecast() {
  var now = NS.now(), out = [];
  var objs = [
    ['デモ衛星 B', '99331', '2023-DEMO-C', 1180, 8.4, '通信衛星（第2世代）'],
    ['デモ上段 C', '99418', '2026-DEMO-B',  920, 31.2, 'ロケット上段'],
    ['デモ衛星 D', '99502', '2025-DEMO-F',  260, 62.5, '地球観測衛星'],
    ['デモ破片 E', '99677', '2019-DEMO-K',   45, 96.8, '衝突破片']
  ];
  objs.forEach(function (o, i) {
    var r = NS.rng('re|' + o[1]);
    var t = now + o[4] * 3600e3;
    var win = 8 + o[4] * 0.42;
    out.push({ name:o[0], norad:o[1], cospar:o[2], mass:o[3], type:o[5], t:t, windowMin:win,
      perigee:Math.round(r.range(112, 148)), apogee:Math.round(r.range(150, 240)), inc:NS.f(r.range(43, 98), 1),
      overJapan:r() > 0.55, pVisible:r.range(0.05, 0.62), src:'公開軌道要素（TLE）＋大気密度モデル' });
  });
  return out.sort(function (a, b) { return a.t - b.t; });
}

/* ---------- 組み立て ---------- */
/* 各局のインフラサウンド到達を、発光経路の幾何から決め直す。
   音は経路のうち「その局にいちばん近い点」から届くので、その斜距離を見かけの音速で割る。
   見かけの音速は成層圏の風で経路ごとに数 % ばらつくため、局ごとに ±4 % の幅を持たせる。
   こうしておくと、到達時刻・到来方位・距離が互いに矛盾せず、画面の解析がそのまま成り立つ。 */
NS.infraGeom = function (e, cel0) {
  if (!e || !e.det || !e.begin || !e.end) return e;
  var N = 80;
  e.det.forEach(function (d) {
    var st = NS.ST[d.id], best = null;
    for (var i = 0; i <= N; i++) {
      var f = i / N;
      var la = e.begin.lat + (e.end.lat - e.begin.lat) * f;
      var lo = e.begin.lon + (e.end.lon - e.begin.lon) * f;
      var al = e.begin.alt + (e.end.alt - e.begin.alt) * f;
      var g = NS.dist(st.lat, st.lon, la, lo);
      var r = Math.sqrt(g * g + al * al);
      if (!best || r < best.r) best = { r:r, g:g, lat:la, lon:lo, alt:al, f:f };
    }
    /* いちばん近い点を見込む仰角。局からの見えかたはこれで決まる。 */
    d.elev = Math.round(Math.atan2(best.alt, best.g) * NS.r2d * 10) / 10;
    d.dist = Math.round(best.r);
    if (!d.infra) return;
    var c = (cel0 || 0.300) * (1 + (NS.rng('cel' + e.id + d.id)() - 0.5) * 0.08);
    d.infra.dt = Math.round(best.r / c * 10) / 10;
    d.infra.az = Math.round(NS.bearing(st.lat, st.lon, best.lat, best.lon) * 10) / 10;
    d.infra.km = Math.round(best.r);
    d.infra.cel = c;
    d.infra.src = best;
  });
  return e;
};

NS.buildCatalog = function () {
  var fb = fireballBoso(), re = reentryDemo(), bal = ballisticScenario(), rkn = rockoonDemo();
  /* 輻射点・地心速度・日心軌道は、軌跡（発光点・終端点）と突入速度から導く（js/orbit3d.js）。
     こうしておくと、軌道は必ず発生時刻の地球の位置を通り、3D 描画とも矛盾しない。 */
  if (NS.orbitFromTrack) {
    var od = NS.orbitFromTrack(fb);
    if (od) {
      fb.orbit = od.orbit; fb.radiant = od.radiant;
      fb.vg = od.vg; fb.vh = od.vh;
      fb.entryAngle = od.entryAngle; fb.azimuth = od.azimuth;
    }
  }
  NS.FLAGSHIP = { fireball:fb, reentry:re, ballistic:bal, rockoon:rkn };
  NS.REENTRIES = [re, bal, rkn];
  NS.INFRA = infraEvents();
  NS.FORECAST = reentryForecast();
  NS.EVENTS = [fb, re].concat(routineEvents()).sort(function (a, b) { return b.t - a.t; });
  NS.EVENTS.forEach(function (e) { NS.EVMAP = NS.EVMAP || {}; NS.EVMAP[e.id] = e; });
  NS.INFRA.forEach(function (e) { NS.EVMAP[e.id] = e; });
  NS.EVMAP[bal.id] = bal;        /* 想定シナリオは一覧には出さず、画面から辿れるようにだけしておく */
  NS.EVMAP[rkn.id] = rkn;
  /* インフラサウンドの到達は、経路の幾何から求め直す（見かけの音速 0.30 km/s 前後） */
  [fb, re, bal, rkn].forEach(function (x) { NS.infraGeom(x, 0.300); });
  NS.DEBRIS_CANDIDATES.forEach(function (c) { c.t = re.t + c.tOff * 60000; });
  return NS.EVENTS;
};

/* ---------- 通報・アラート履歴（G-7 社会実装） ---------- */
NS.alertLog = function () {
  var fb = NS.FLAGSHIP.fireball, re = NS.FLAGSHIP.reentry, now = NS.now();
  return [
    { t:fb.t,                 lvl:'検出',   ev:fb.id, text:'7 局で同時検出。エッジ AI が火球候補として自動判定（信頼度 0.98）' },
    { t:fb.t + 41e3,          lvl:'解析',   ev:fb.id, text:'多点三角測量による軌跡決定が完了（残差 41 m）。絶対等級 −11.8、突入速度 17.4 km/s' },
    { t:fb.t + 128e3,         lvl:'解析',   ev:fb.id, text:'暗黒飛行（ダークフライト）の風補正（気象庁 数値予報 GPV ＋ 高層気象観測 ＋ 自局の気象センサー）による落下域確率地図を生成' },
    { t:fb.t + 222e3,         lvl:'通報',   ev:fb.id, text:'千葉県山武市・東金市の防災課、千葉県教育委員会へ落下域確率地図を自動配信（検出から 3 分 42 秒）' },
    { t:fb.t + (fb.det[0].infra ? fb.det[0].infra.dt : 243.6) * 1000, lvl:'確認', ev:fb.id,
      text:'船橋局でインフラサウンド到達を確認。音響エネルギー推定値が光学推定と 2 倍以内で整合' },
    { t:fb.t + 1830e3,        lvl:'対応',   ev:fb.id, text:'山武市より「被害報告なし」の回答。翌朝から回収捜索を開始（UAV 2 機・地上班 6 名）' },
    { t:re.t - 9.6 * 3600e3,  lvl:'予報',   ev:re.id, text:'公開軌道要素から再突入予報を発出（予報窓 ±32 分、日本上空通過の可能性 62 %）' },
    { t:re.t,                 lvl:'検出',   ev:re.id, text:'6 局で再突入発光を検出。経路角 1.4°・継続 3 分 17 秒から人工物と即時判定' },
    { t:re.t + 412e3,         lvl:'共有',   ev:re.id, text:'JAXA 宇宙状況把握（SSA）へ観測結果を共有。予報誤差 11.4 分 / 640 km を報告' },
    { t:now - 31 * 3600e3 + 240e3, lvl:'注意喚起', ev:'NUS-IS-T-0118', text:'線状降水帯に伴う雷放電群を検知。関東 5 校へ屋外活動の中止を推奨（検知から 4 分）' },
    { t:now - 4.2 * 86400e3 + 900e3, lvl:'判定', ev:'NUS-IS-Q-0106', text:'地震後の校舎固有振動数チェックを 3 局で自動実施。いずれも「継続使用可」' },
    { t:NS.rainband().t + 12 * 60e3, lvl:'検知', ev:'NUS-LR-2028-0908-01',
      text:'房総半島東部で雷放電音を連続検知（3 局・10 分あたり 24 回）。線状降水帯の形成を監視状態へ' },
    { t:NS.rainband().t + 54 * 60e3, lvl:'判定', ev:'NUS-LR-2028-0908-01',
      text:'インフラサウンドの方位交会・GNSS 可降水量・気圧の 6 条件が成立し、線状降水帯の可能性を自動判定' },
    { t:NS.rainband().t + 58 * 60e3, lvl:'通報', ev:'NUS-LR-2028-0908-01',
      text:'千葉県 山武市・東金市・茂原市 と県東部の付属校 3 校へ発報（判定から 4 分、外部の大雨情報に 34 分先行）' },
    { t:NS.rainband().t + 380 * 60e3, lvl:'対応', ev:'NUS-LR-2028-0908-01',
      text:'雷放電の検知が 10 分あたり 5 回を下回り、帯の解消を判定。学校へ解除連絡' }
  ].sort(function (a, b) { return b.t - a.t; });
};

})(NS);

/* =========================================================================
   線状降水帯（千葉県の事例を模した模擬イベント）
   気象センサーだけでなく、インフラサウンドによる雷放電の検知・方位交会と
   2周波GNSSの可降水量（PWV）を組み合わせて、帯の形成を早期に捉える構成。
   ========================================================================= */
(function (NS) {
  /* 帯の軸（房総半島東部を南北に走る）と幅 */
  var AXIS = { a:{ lat:35.20, lon:140.22 }, b:{ lat:35.88, lon:140.42 }, width:22 };

  NS.rainband = function () {
    if (NS._rb) return NS._rb;
    var t0 = NS.night(2, 4, 20);                 /* 2 日前 04:20 JST 形成 */
    var r = NS.rng('rainband');

    /* --- 局別の検知状況 --- */
    var st = [
      { id:'FNB', axisKm:26, strikes:1182, az:131.4, azSd:7.2, rain6h:118.4, rainMax:48.2, gust:21.6,
        pressMin:996.4, pressDrop:-6.2, pwv0:43, pwvMax:61, tDet:12 },
      { id:'TCR', axisKm:22, strikes:486,  az:172.1, azSd:9.4, rain6h:34.6,  rainMax:12.4, gust:14.2,
        pressMin:1000.8, pressDrop:-2.8, pwv0:41, pwvMax:54, tDet:16 },
      { id:'SRG', axisKm:51, strikes:372,  az:109.3, azSd:6.1, rain6h:22.8,  rainMax:8.6,  gust:12.8,
        pressMin:1001.6, pressDrop:-2.1, pwv0:42, pwvMax:55, tDet:14 },
      { id:'SKS', axisKm:62, strikes:244,  az:102.4, azSd:6.6, rain6h:16.2,  rainMax:6.0,  gust:11.4,
        pressMin:1002.1, pressDrop:-1.7, pwv0:41, pwvMax:53, tDet:19 },
      { id:'SNN', axisKm:69, strikes:198,  az: 75.8, azSd:8.3, rain6h:9.4,   rainMax:4.2,  gust:10.6,
        pressMin:1002.9, pressDrop:-1.2, pwv0:43, pwvMax:51, tDet:23 }
    ];

    /* --- 10 分値の時系列（04:00〜11:00 JST） --- */
    var series = [], nS = 43;
    for (var i = 0; i < nS; i++) {
      var min = i * 10, hh = 4 + min / 60;                       /* JST 時 */
      var x = (min - 20) / 60;                                    /* 形成からの時間 */
      var bell = function (c, w) { return Math.exp(-Math.pow((x - c) / w, 2)); };
      var strikes = Math.max(0, Math.round(96 * bell(2.5, 1.55) + 18 * bell(4.6, 0.9) + r.norm(0, 4)));
      if (x < 0) strikes = 0;
      var rain = Math.max(0, 48.2 * bell(3.0, 0.85) + 14 * bell(4.4, 0.7) + r.norm(0, 1.1));
      if (x < 1.6) rain = Math.max(0, rain * Math.max(0, (x - 0.9) / 0.7));
      var pwv = 43 + 18 * Math.exp(-Math.pow((x - 1.7) / 1.9, 2)) + r.norm(0, 0.5);
      var press = 1002.6 - 6.2 * Math.exp(-Math.pow((x - 2.9) / 1.35, 2)) + r.norm(0, 0.18);
      series.push({ hh:hh, min:min, strikes:strikes, rain:rain, pwv:pwv, press:press });
    }

    /* --- 雷放電の定位点（帯の中に分布） --- */
    var pts = [], rp = NS.rng('rb-pts');
    for (var k = 0; k < 170; k++) {
      var f = rp(), along = Math.pow(rp(), 0.85);
      var lat = AXIS.a.lat + (AXIS.b.lat - AXIS.a.lat) * along;
      var lon = AXIS.a.lon + (AXIS.b.lon - AXIS.a.lon) * along;
      var off = rp.norm(0, AXIS.width / 2.6);                     /* 軸からのずれ km */
      /* 軸に直交する向き（おおむね東西）へずらす */
      lon += off / (111.32 * Math.cos(lat * NS.d2r));
      var tt = 0.2 + 4.6 * Math.pow(rp(), 0.8);
      pts.push({ lat:lat, lon:lon, h:tt, w:0.6 + 1.6 * rp() });
    }

    var tl = [
      { dt:0,   kind:'形成',   src:'—',              text:'房総半島東部（茂原市付近）で対流セルが次々と発生し、南北に並び始める' },
      { dt:12,  kind:'検知',   src:'インフラサウンド', text:'船橋・駿河台・桜上水の 3 局が 0.6–14 Hz の雷放電音を連続検知（10 分あたり 24 回）' },
      { dt:28,  kind:'定位',   src:'インフラサウンド', text:'5 局の到来方位を交会し、音源が長さ 78 km・幅 22 km の帯状に並ぶことを確認（定位精度 ±9 km）' },
      { dt:46,  kind:'前兆',   src:'2 周波 GNSS',     text:'船橋局の可降水量（PWV）が 43 → 58 mm（＋35 %）。下層への強い水蒸気流入を示す' },
      { dt:54,  kind:'判定',   src:'統合判定',        text:'「雷放電 ≥ 30 回/10 分」「到来方位の集中 ≤ ±10°」「音源の線状配列」「PWV ≥ 55 mm」の 4 条件が成立し、線状降水帯の可能性を自動判定' },
      { dt:58,  kind:'通報',   src:'G-7',            text:'千葉県 山武市・東金市・茂原市 の防災担当と、県東部の付属校 3 校へ発報（判定から 4 分）' },
      { dt:88,  kind:'外部情報', src:'気象庁',        text:'「顕著な大雨に関する情報」が発表。本デモの自動判定はこれに 34 分先行した' },
      { dt:180, kind:'実測',   src:'気象センサー',    text:'帯の西縁が船橋局に到達。最大 1 時間降水量 48.2 mm、最大瞬間風速 21.6 m/s、気圧 996.4 hPa' },
      { dt:380, kind:'衰弱',   src:'インフラサウンド', text:'雷放電の検知が 10 分あたり 5 回を下回り、帯の解消を判定。学校への解除連絡' }
    ];

    NS._rb = {
      id:'NUS-LR-2028-0908-01', kind:'rainband', t:t0, name:'千葉県東部 線状降水帯',
      axis:AXIS, move:{ az:285, speed:9.2 }, lengthKm:78,
      durMin:380, strikesTotal:2482, strikesPeak:96,
      rainPeak1h:82, rainPeakPlace:'茂原市付近（帯の直下・推定）',
      leadMin:34, locErr:9.0, freq:'0.6 – 14 Hz',
      det:st, series:series, pts:pts, timeline:tl,
      criteria:[
        ['雷放電の検知頻度', '≥ 30 回 / 10 分（2 局以上）', '96 回 / 10 分', true],
        ['到来方位の集中度', '標準偏差 ≤ ±10°', '±6.1 〜 ±9.4°', true],
        ['音源の空間配列', '長さ ≥ 50 km・幅 ≤ 30 km の線状', '78 km × 22 km', true],
        ['GNSS 可降水量（PWV）', '≥ 55 mm、かつ 1 時間で ＋10 % 以上', '61 mm（＋42 %）', true],
        ['地上気圧', '3 時間で −2 hPa 以上の低下', '−6.2 hPa', true],
        ['降水強度（帯の直下）', '≥ 30 mm/h が 3 時間継続', '48.2 mm/h（船橋局・帯の西縁）', true]
      ],
      ref:'参照した実事象：2023 年 9 月 8 日、台風第 13 号に伴い千葉県で線状降水帯が発生し、気象庁が「顕著な大雨に関する情報」を発表した事例（茂原市などで記録的な大雨）。本デモの数値は当該事象を模した模擬データであり、実際の観測記録ではない。'
    };
    return NS._rb;
  };
})(NS);

/* =========================================================================
   津波（地震 → 電離圏 TEC ＋ インフラサウンド）の模擬イベント
   Kakinami et al. (2012) の津波性電離圏ホール、Kamogawa et al. (2016) の
   TEC 減少率による津波早期警戒、Nishikawa et al. (2022) のトンガ噴火に
   伴う大気重力波・ラム波の観測を踏まえた構成。
   ========================================================================= */
(function (NS) {
  NS.tsunami = function () {
    if (NS._ts) return NS._ts;
    var t0 = NS.now() - 5.3 * 86400e3;            /* 5 日前の地震発生時刻 */
    var r = NS.rng('tsunami');

    /* --- 電離圏 TEC の時系列（地震発生からの分） --- */
    var tec = [];
    for (var m = -10; m <= 120; m += 2) {
      var base = 22 + 2.2 * Math.sin(2 * Math.PI * (m + 60) / 720) + r.norm(0, 0.06);
      /* 音波共振（約 4.4 mHz ＝ 周期 3.8 分）：発生 8 分後から */
      var res = m > 8 ? 0.55 * Math.exp(-Math.pow((m - 26) / 20, 2)) * Math.sin(2 * Math.PI * (m - 8) / 3.8) : 0;
      /* 津波性電離圏ホール：19 分後から電子密度が減少 */
      var hole = m > 19 ? -1.85 * Math.exp(-Math.pow((m - 38) / 17, 2)) : 0;
      tec.push({ m:m, tec:base + res + hole, res:res, hole:hole });
    }

    return (NS._ts = {
      id:'NUS-TS-2028-0703-01', kind:'tsunami', t:t0, name:'三陸沖の地震（M7.8）と津波',
      quake:{ lat:38.32, lon:143.86, depth:24, mw:7.8, name:'三陸沖', src:'気象庁 震源速報（参考情報として取り込む）' },
      det:[
        { id:'FNB', kind:'微動計', dt:0.0,  val:'P 波 +112 s / PGA 6.8 gal', note:'校舎応答に異常なし' },
        { id:'TCR', kind:'微動計', dt:0.0,  val:'P 波 +104 s / PGA 9.1 gal', note:'校舎応答に異常なし' },
        { id:'KYM', kind:'GNSS',   dt:8.2,  val:'TEC 共振 4.4 mHz / 振幅 0.55 TECU', note:'最初に擾乱を捉えた局' },
        { id:'YMG', kind:'GNSS',   dt:9.6,  val:'TEC 共振 4.4 mHz / 振幅 0.48 TECU', note:'' },
        { id:'TCR', kind:'GNSS',   dt:11.4, val:'TEC 共振 3.6 mHz / 振幅 0.41 TECU', note:'' },
        { id:'FNB', kind:'GNSS',   dt:12.8, val:'TEC 共振 3.6 mHz / 振幅 0.33 TECU', note:'' },
        { id:'SPR', kind:'GNSS',   dt:14.1, val:'TEC 共振 4.4 mHz / 振幅 0.27 TECU', note:'' },
        { id:'KYM', kind:'インフラサウンド', dt:13.2, val:'0.8–4 mHz 帯 / 0.42 Pa', note:'大気重力波の到達' },
        { id:'FNB', kind:'インフラサウンド', dt:16.7, val:'0.8–4 mHz 帯 / 0.31 Pa', note:'' },
        { id:'KYM', kind:'GNSS',   dt:19.4, val:'TEC 減少 開始', note:'津波性電離圏ホール' },
        { id:'TCR', kind:'GNSS',   dt:22.1, val:'TEC 減少 −1.85 TECU（最大）', note:'減少率 −0.11 TECU/分' }
      ],
      tec:tec, holeMax:-1.85, holeRate:-0.11, resFreq:[4.4, 3.6],
      estWave:2.4, estErr:0.8, obsWave:2.1, obsPlace:'宮古 検潮所',
      jmaWarn:{ dt:3.0, text:'津波警報（岩手・宮城・福島）' },
      coastSchools:['日本大学山形高等学校（内陸・避難所指定）', '土浦日本大学高等学校', '日本大学東北高等学校'],
      refs:['Kakinami et al. (2012) 津波性電離圏ホール', 'Kamogawa et al. (2016) TEC 減少率による早期警戒',
            'Nishikawa et al. (2022) トンガ噴火の大気重力波と後続津波'],
      note:'本観測網は気象庁の津波警報を置き換えるものではない。警報の後に届く「実際にどれだけの津波が来るか」を、電離圏と大気の応答から独立に見積もり、沿岸から離れた学校の判断材料として補うことを目的とする。'
    });
  };
})(NS);
