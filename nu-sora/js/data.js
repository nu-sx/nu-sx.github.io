/* NU-SORA デモ / 観測局・機材・模擬観測データ生成
   ※ここで生成される観測値・イベントはすべて模擬データ（デモ用）。実観測ではない。 */
'use strict';
(function (NS) {

/* =========================================================================
   1. 観測局（14局）— 座標・設置機関は提案書「観測局配置図」に基づく実データ
   ========================================================================= */
NS.STATIONS = [
  { id:'FNB', name:'船橋局',   en:'Funabashi',  kind:'u', pref:'千葉県',  city:'船橋市',
    lat:35.7265, lon:140.0530, alt:70,  swir:true, draco:true,  host:'理工学部（船橋）・薬学部・短期大学部・日本大学習志野高等学校', role:'ハブ局' },
  { id:'KYM', name:'郡山局',   en:'Koriyama',   kind:'u', pref:'福島県',  city:'郡山市',
    lat:37.3900, lon:140.3830, alt:280, swir:true, draco:true,  host:'工学部・日本大学東北高等学校', role:'東北拠点' },
  { id:'SNN', name:'湘南局',   en:'Shonan',     kind:'u', pref:'神奈川県',city:'藤沢市',
    lat:35.3750, lon:139.4700, alt:65,  swir:false, host:'生物資源科学部・日本大学藤沢高等学校・中学校・小学校', role:'南関東' },
  { id:'MSM', name:'三島局',   en:'Mishima',    kind:'u', pref:'静岡県',  city:'三島市',
    lat:35.1210, lon:138.9170, alt:80,  swir:false, host:'国際関係学部・短期大学部（三島）・日本大学三島高等学校・中学校', role:'東海・富士' },
  { id:'TDN', name:'津田沼局', en:'Tsudanuma',  kind:'u', pref:'千葉県',  city:'習志野市',
    lat:35.6940, lon:140.0135, alt:60,  swir:false, host:'生産工学部（津田沼・実籾）', role:'近接基線・筐体設計' },
  { id:'SKS', name:'桜上水局', en:'Sakurajosui',kind:'u', pref:'東京都',  city:'世田谷区',
    lat:35.6668, lon:139.6318, alt:80,  swir:false, host:'文理学部・日本大学櫻丘高等学校', role:'都心' },
  { id:'SRG', name:'駿河台局', en:'Surugadai', kind:'u', pref:'東京都',  city:'千代田区',
    lat:35.6995, lon:139.7640, alt:70,  swir:false, host:'理工学部（駿河台）・歯学部', role:'都心' },
  { id:'SPR', name:'札幌局',   en:'Sapporo',    kind:'s', pref:'北海道',  city:'北広島市',
    lat:42.9800, lon:141.5600, alt:75,  swir:false, host:'札幌日本大学高等学校・中学校', role:'北海道' },
  { id:'YMG', name:'山形局',   en:'Yamagata',   kind:'s', pref:'山形県',  city:'山形市',
    lat:38.2650, lon:140.3300, alt:175, swir:false, host:'日本大学山形高等学校', role:'東北日本海側' },
  { id:'NGN', name:'長野局',   en:'Nagano',     kind:'s', pref:'長野県',  city:'長野市',
    lat:36.6300, lon:138.2000, alt:395, swir:false, host:'長野日本大学高等学校・中学校・小学校', role:'内陸暗夜' },
  { id:'TCR', name:'土浦局',   en:'Tsuchiura',  kind:'s', pref:'茨城県',  city:'土浦市',
    lat:36.0850, lon:140.2050, alt:50,  swir:false, host:'土浦日本大学高等学校・附属幼稚園', role:'北関東' },
  { id:'OGK', name:'大垣局',   en:'Ogaki',      kind:'s', pref:'岐阜県',  city:'大垣市',
    lat:35.3700, lon:136.6200, alt:35,  swir:false, host:'大垣日本大学高等学校', role:'中部' },
  { id:'NGS', name:'長崎局',   en:'Nagasaki',   kind:'s', pref:'長崎県',  city:'諫早市',
    lat:32.8500, lon:130.0500, alt:55,  swir:false, host:'長崎日本大学高等学校・中学校', role:'九州北・火山' },
  { id:'MYZ', name:'宮崎局',   en:'Miyazaki',   kind:'s', pref:'宮崎県',  city:'宮崎市',
    lat:31.9300, lon:131.4200, alt:55,  swir:false, host:'宮崎日本大学高等学校・中学校', role:'九州南・射場' }
];
NS.ST = {}; NS.STATIONS.forEach(function (s, i) { s.idx = i; NS.ST[s.id] = s; });

/* 局ごとの素性：光害の強さ（自然夜空 21.9 からの差）、地上騒音、設置日 */
var SITE = {
  FNB:{ sqm:19.35, noise:1.15, inst:'2027-08-05' }, KYM:{ sqm:20.25, noise:0.85, inst:'2027-08-19' },
  SNN:{ sqm:19.60, noise:1.00, inst:'2027-09-02' }, MSM:{ sqm:20.45, noise:0.80, inst:'2027-09-16' },
  TDN:{ sqm:19.30, noise:1.20, inst:'2027-08-12' },
  SKS:{ sqm:18.40, noise:1.45, inst:'2027-07-22' }, SRG:{ sqm:17.90, noise:1.70, inst:'2027-07-08' },
  SPR:{ sqm:20.35, noise:0.75, inst:'2028-05-18' }, YMG:{ sqm:20.60, noise:0.70, inst:'2028-04-20' },
  NGN:{ sqm:21.15, noise:0.60, inst:'2028-05-11' }, TCR:{ sqm:20.30, noise:0.80, inst:'2028-04-13' },
  OGK:{ sqm:20.50, noise:0.90, inst:'2028-06-08' }, NGS:{ sqm:20.90, noise:0.75, inst:'2028-06-22' },
  MYZ:{ sqm:20.80, noise:0.80, inst:'2028-07-06' }
};
NS.STATIONS.forEach(function (s) { Object.assign(s, SITE[s.id]); });

/* =========================================================================
   2. 全局共通のフル構成（機材調査資料 3.1〜3.3 に基づく）
   ========================================================================= */
NS.EQUIPMENT = [
  { key:'allsky', cat:'光学', name:'高感度全天カメラ ×2',   model:'Sony STARVIS2 IMX664 + Hi3519DV500（M16 4mm F1.0, 画角約95°）',
    spec:'2688×1520 / 25 fps, PoE, UFOCaptureIP', target:'流星・火球の検出と多点測位', all:true },
  { key:'color',  cat:'光学', name:'カラー補助カメラ',       model:'TP-Link Tapo C325WB（1/1.88" starlight, 4.1mm F1.0）',
    spec:'2560×1440 / 20 fps', target:'火球の色情報（測光は主カメラ）', all:true },
  { key:'spec',   cat:'光学', name:'4K分光カメラ',           model:'Sony ZV-E10 + SEL15F14G + 回折格子 600 lpm（AVerMedia BU113）',
    spec:'3840×2160 / 29.97p, UFOCaptureHD2', target:'火球・再突入体の発光分光（350–900 nm の元素同定）', all:true },
  { key:'swir',   cat:'光学', name:'SWIR冷却カメラ',         model:'ZWO ASI992MM Pro（IMX992 InGaAs, 0.4–1.7 µm, 2段TEC −35℃）',
    spec:'2592×2056 / 3.45 µm, USB3.0', target:'再突入破片の熱放射・薄雲越しの火球', all:false, at:['FNB','KYM'] },
  { key:'infra',  cat:'音響', name:'インフラサウンドセンサー ×2', model:'株式会社サヤ INF03（0.1–1000 Hz, 130/110 dB SPL 切替）',
    spec:'GNSS同期ロガー, ペア配置（基線約 60 m）', target:'火球衝撃波・火山・雷・津波・ロケット', all:true },
  { key:'met',    cat:'気象', name:'複合気象センサー',       model:'Vaisala WXT530 系',
    spec:'気温・湿度・気圧・風向風速・雨量・日射', target:'WBGT／暗黒飛行（ダークフライト）の地上風補正／微気候', all:true },
  { key:'sqm',    cat:'環境', name:'夜空輝度計',             model:'Unihedron SQM-LU-DL ＋ 窓付き野外ハウジング',
    spec:'視野 FWHM 約20°, IRカット, 1–80 s サンプリング, mag/arcsec²', target:'光害・衛星コンステレーションの寄与分離', all:true },
  { key:'hro',    cat:'電波', name:'電波流星受信機',         model:'HRO 方式受信機（53.755 MHz）＋ 3 素子八木',
    spec:'前方散乱エコー計数', target:'昼間・悪天候時の流星計数', all:true },
  { key:'gnss',   cat:'測地', name:'2周波GNSS受信機',        model:'測地級2周波受信機（PPS 出力, GPS/QZSS/Galileo）',
    spec:'時刻同期 < 1 ms, 30 s TEC', target:'全局時刻同期・電離圏TEC', all:true },
  { key:'seis',   cat:'構造', name:'微動計',                 model:'3成分加速度計（常時微動）',
    spec:'100 Hz サンプリング', target:'校舎固有振動数・地震後の使用可否判定', all:true },
  { key:'cray',   cat:'宇宙線', name:'宇宙線計測器（素粒子検出器）', model:'素粒子検出器（プラスチックシンチレータ）',
    spec:'シンチレータ 5×5×1 cm ＋ SiPM 型光センサー ＋ ESP32。OLED 表示・USB 給電・ブラウザで波形と計数を表示。1 分値を常時記録', target:'宇宙線ミューオンの連続計数（気圧効果・フォーブッシュ減少・雷雲ガンマ線）', all:true },
  { key:'draco',  cat:'光学', name:'Draco スマート望遠鏡（特注ハウジング）', model:'DWARFLAB Draco（口径 90 mm・焦点距離 340 mm F3.8／50 MP 1/1.3" ＋ 広角 1/1.55"）',
    spec:'露出 1/10000–300 s, 内蔵ガイド, センサー回転で視野回転を補正, USB3.0 / Ethernet',
    target:'流星群・突発天体・人工衛星の自動追尾観測と付属校のリモート観測（船橋局・郡山局＝工学部 の 2 局）', all:false, at:['FNB','KYM'] },
  { key:'pc',     cat:'基盤', name:'制御PC・電源',           model:'8コア16スレッド / 32 GB / NVMe 2 TB ＋ UPS ＋ 雷サージ対策 ＋ PoEスイッチ',
    spec:'UFOCaptureIP / HD2, GNSS時刻付与, 一次保存', target:'取得・一次処理・伝送', all:true }
];
NS.eqAt = function (st) { return NS.EQUIPMENT.filter(function (e) { return e.all || (e.at && e.at.indexOf(st.id) >= 0); }); };

/* =========================================================================
   3. デモ時刻の基準
   ========================================================================= */
NS.T0 = Date.now();                       /* ページを開いた実時刻を「現在」とする */
NS.clock = function () { return NS.T0 + (Date.now() - NS.T0); };
/* 直近の（または次の）深夜 1 時 JST */
NS.nextMidnight = function () {
  var p = NS.jstParts(NS.now());
  var base = Date.UTC(p.y, p.mo - 1, p.d) - NS.JST + 3600e3;   /* 今日の 01:00 JST */
  return p.h >= 1 ? base + 86400e3 : base;
};
/* 「今夜」の JST hh 時。夕方以降なら翌未明側、未明なら前夜側を指す */
NS.tonightAt = function (hh) {
  var p = NS.jstParts(NS.now());
  var base = Date.UTC(p.y, p.mo - 1, p.d) - NS.JST;
  var t = base + hh * 3600e3;
  if (hh < 12 && p.h >= 12) t += 86400e3;
  if (hh >= 12 && p.h < 12) t -= 86400e3;
  return t;
};
/* 全天表示の既定時刻：いま夜なら現在時刻、昼・薄明なら今夜 23 時 */
NS.defaultSkyTime = function () {
  var now = NS.now();
  var dark = NS.STATIONS.some(function (st) { return NS.solarAlt(now, st.lat, st.lon) < -12; });
  return dark ? { t:now, live:true, label:'現在' } : { t:NS.tonightAt(23), live:false, label:'今夜 23:00' };
};
/* n 夜前の JST hh:mm:ss を UTC ミリ秒で返す（夜間イベントの配置用） */
NS.night = function (nBack, hh, mm, ss, ms) {
  var p = NS.jstParts(NS.now());
  var base = Date.UTC(p.y, p.mo - 1, p.d) - NS.JST;      /* 今日の 00:00 JST */
  var t = base - nBack * 86400e3 + (hh * 3600 + (mm || 0) * 60 + (ss || 0)) * 1000 + (ms || 0);
  if (hh >= 12) t -= 86400e3;                            /* 18時などは「前夜」に置く */
  return t;
};

/* =========================================================================
   4. 気象・夜空輝度・WBGT の模擬生成（局×時刻で決定論的）
   ========================================================================= */
/* 日射（kW/m²）: 太陽高度の粗い近似 */
NS.solarAlt = function (t, lat, lon) {
  var d = new Date(t), doy = Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400e3);
  var dec = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * NS.d2r;
  var hUTC = (t / 3600e3) % 24;
  var H = ((hUTC + lon / 15) - 12) * 15 * NS.d2r;
  var la = lat * NS.d2r;
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)) * NS.r2d;
};
/* 月相（0=新月,0.5=満月）と月高度の粗い近似 */
NS.moonPhase = function (t) {
  var syn = 29.530588853 * 86400e3, ref = Date.UTC(2000, 0, 6, 18, 14);
  return (((t - ref) % syn) + syn) % syn / syn;
};
NS.moonIllum = function (t) { return (1 - Math.cos(2 * Math.PI * NS.moonPhase(t))) / 2; };
NS.moonAlt = function (t, lat, lon) {
  /* 月の位置は太陽から位相分ずれる、という粗い扱い（デモ用） */
  var ph = NS.moonPhase(t);
  return NS.solarAlt(t - ph * 29.53 * 86400e3 * 0 - 0, lat, lon + 0) * 0 +
    (function () {
      var hUTC = (t / 3600e3) % 24;
      var H = ((hUTC + lon / 15) - 12 - ph * 24) * 15 * NS.d2r;
      var dec = 18 * Math.sin(2 * Math.PI * (t / 86400e3) / 27.32) * NS.d2r, la = lat * NS.d2r;
      return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)) * NS.r2d;
    })();
};
/* 上空の風プロファイル（暗黒飛行（ダークフライト）の風補正に用いる）
   実運用では気象庁の公開データを用いる：
     ・数値予報 GPV / メソモデル（MSM）… 水平 5 km・鉛直 16 層、3 時間ごと、地上〜約 10 hPa
     ・高層気象観測（ラジオゾンデ）… 館野・八丈島・輪島など、00/12 UTC
     ・毎時大気解析（地上風）
   本デモでは、これらに相当する形の模擬プロファイル（地上〜40 km）を生成する。 */
NS.windProfile = function (lat, lon, t) {
  var r = NS.rng('wind|' + Math.round(lat * 4) + '|' + Math.round(lon * 4) + '|' + Math.floor(t / 10800e3));
  var doy = (t / 86400e3) % 365.25;
  var seas = -Math.cos(2 * Math.PI * (doy - 15) / 365.25);       /* 冬 -1 → 夏 +1 */
  var jetAlt = 11.5 - 0.8 * seas;                                 /* 亜熱帯ジェットの高度 */
  var jetSpd = 62 - 26 * seas + r.norm(0, 8);                     /* 冬に強い */
  var out = [];
  [0, 0.5, 1, 2, 3, 5, 7, 9, 11, 13, 15, 18, 21, 25, 30, 35, 40].forEach(function (h) {
    var spd, dir;
    if (h <= 1.5) {                       /* 接地層：自局の気象センサーで実測する高度帯 */
      spd = Math.max(0.5, 3.2 + 2.4 * h + r.norm(0, 1.2));
      dir = 200 + 40 * r() + 26 * h;
    } else if (h < 20) {                  /* 対流圏：ジェット気流 */
      spd = jetSpd * Math.exp(-Math.pow((h - jetAlt) / 5.2, 2)) + 6 + r.norm(0, 2.6);
      dir = 262 + 18 * Math.sin(h / 5) + r.norm(0, 7);
    } else {                              /* 成層圏：季節で東西が反転する */
      spd = Math.abs(14 * seas) + 4 + 0.5 * (h - 20) + r.norm(0, 3);
      dir = (seas > 0 ? 92 : 268) + r.norm(0, 12);
    }
    out.push({ alt:h, spd:Math.max(0.3, spd), dir:((dir % 360) + 360) % 360,
               temp:h < 11 ? 15 - 6.5 * h : (h < 20 ? -56.5 : -56.5 + 1.8 * (h - 20)),
               src:h <= 1.5 ? '自局 気象センサー' : (h <= 30 ? '気象庁 MSM（GPV）' : '気象庁 ラジオゾンデ') });
  });
  return { levels:out, jetAlt:jetAlt, jetSpd:jetSpd,
           source:'気象庁 数値予報 GPV（メソモデル MSM, 水平 5 km・3 時間ごと）＋ 高層気象観測（ラジオゾンデ：館野・八丈島）',
           note:'地上 1.5 km 以下は各観測局の複合気象センサーの実測値で置き換える' };
};
/* 局の気象（時刻 t）。滑らかに変化する決定論的合成 */
NS.weather = function (st, t) {
  var hr = t / 3600e3;
  var r = NS.rng(st.id + '|' + Math.floor(t / 86400e3));
  var doy = (t / 86400e3) % 365.25;
  var seas = -Math.cos(2 * Math.PI * (doy - 15) / 365.25);        /* 冬 -1 → 夏 +1 */
  var lat0 = (38 - st.lat) / 10;                                   /* 南ほど暖かい */
  var wave = function (p, a, ph) { return a * Math.sin(2 * Math.PI * (hr / p) + ph); };
  var sun = NS.solarAlt(t, st.lat, st.lon);
  var solar = Math.max(0, Math.sin(Math.max(0, sun) * NS.d2r)) * 0.95;   /* kW/m² 快晴時 */
  var cloudBase = 0.5 + 0.42 * Math.sin(2 * Math.PI * hr / 61 + r() * 6) + 0.22 * Math.sin(2 * Math.PI * hr / 17 + r() * 6);
  var cloud = Math.max(0, Math.min(1, cloudBase * (0.75 + 0.45 * r())));
  solar *= (1 - 0.78 * cloud);
  var temp = 15 + 11 * seas + 2.6 * lat0 + 5.4 * Math.max(-0.35, Math.sin((sun + 8) * NS.d2r)) - 1.2 * cloud + wave(53, 1.6, r() * 6) - st.alt * 0.0055;
  var rh = Math.max(22, Math.min(99, 62 + 26 * cloud - 0.9 * (temp - 18) + wave(41, 7, r() * 6)));
  var wind = Math.max(0.2, 2.6 + 2.3 * cloud + wave(29, 1.9, r() * 6) + (st.id === 'MYZ' || st.id === 'NGS' ? 0.8 : 0));
  var press = 1011 + wave(97, 7, r() * 6) - (cloud > 0.8 ? 4 : 0);
  var rain = cloud > 0.86 ? Math.max(0, (cloud - 0.86) * 62 * (0.4 + r())) : 0;
  var wbgt = 0.735 * temp + 0.0374 * rh + 0.00292 * temp * rh + 7.619 * solar - 4.557 * solar * solar - 0.0572 * wind - 4.064;
  return { t:t, temp:temp, rh:rh, wind:wind, dir:(180 + 150 * Math.sin(2 * Math.PI * hr / 73 + r() * 6) + 360) % 360,
           press:press, solar:solar, cloud:cloud, rain:rain, wbgt:wbgt, sunAlt:sun };
};
/* 夜空輝度 mag/arcsec²（大きいほど暗い）。都市では雲が空を明るくする */
NS.skyBrightness = function (st, t) {
  var w = NS.weather(st, t);
  if (w.sunAlt > -12) return { mag:null, w:w, twilight:true };
  var nat = 21.90, lp = Math.max(0, nat - st.sqm);          /* 光害による明るさ増分（等） */
  var urban = lp / 4.0;                                      /* 都市度 0–1 */
  var cloudEffect = w.cloud * (urban > 0.55 ? -(1.6 * urban) : (0.32 - 1.2 * urban));
  var m = NS.moonAlt(t, st.lat, st.lon), ill = NS.moonIllum(t);
  var moonEffect = m > 0 ? -(2.7 * ill * Math.pow(Math.sin(m * NS.d2r), 0.6)) : 0;
  var sat = -0.012 - 0.006 * NS.rng(st.id + Math.floor(t / 3600e3))();   /* 衛星コンステレーション寄与（≈1%） */
  var jitter = NS.rng(st.id + '|sb|' + Math.floor(t / 1800e3)).norm(0, 0.018);
  var mag = st.sqm + cloudEffect + moonEffect + sat + jitter;
  return { mag:mag, w:w, twilight:false, nat:nat, lp:lp, cloudEffect:cloudEffect, moonEffect:moonEffect, satEffect:sat, moonAlt:m, moonIllum:ill };
};
NS.bortle = function (mag) {
  if (mag == null) return { n:'—', label:'薄明中' };
  var tb = [[21.99,1,'極めて暗い空'],[21.89,2,'典型的な暗い空'],[21.69,3,'田舎の空'],[21.25,4,'田舎と郊外の遷移'],
            [20.49,5,'郊外の空'],[19.50,6,'明るい郊外'],[18.94,7,'郊外と都市の遷移'],[18.38,8,'都市の空'],[0,9,'市街中心部']];
  for (var i = 0; i < tb.length; i++) if (mag >= tb[i][0]) return { n:tb[i][1], label:tb[i][2] };
  return { n:9, label:'市街中心部' };
};
NS.wbgtLevel = function (v) {
  if (v >= 31) return { n:4, label:'危険',       color:'var(--c-crit)',  advice:'運動は原則中止。屋外活動を停止する' };
  if (v >= 28) return { n:3, label:'厳重警戒',   color:'var(--c-warn)',  advice:'激しい運動は中止。10–20 分ごとに休憩と給水' };
  if (v >= 25) return { n:2, label:'警戒',       color:'var(--c-cau)',   advice:'積極的に休息。運動の合間に水分補給' };
  if (v >= 21) return { n:1, label:'注意',       color:'var(--c-ok)',    advice:'死亡事故の発生あり。水分補給を' };
  return { n:0, label:'ほぼ安全', color:'var(--c-ok)', advice:'通常の水分補給を' };
};

/* =========================================================================
   5. 局の稼働状態
   ========================================================================= */
/* 実況グラフの並び順：基幹の船橋局・駿河台局を先頭に置き、
   以降は北（緯度の高い順）から南へ並べる。全局を横並びで見るときに位置関係が追いやすい。 */
NS.LIVE_HEAD = ['FNB', 'SRG'];
NS.liveOrder = function (list) {
  var src = (list || NS.STATIONS).slice();
  var head = [];
  NS.LIVE_HEAD.forEach(function (id) {
    for (var i = 0; i < src.length; i++) if (src[i].id === id) { head.push(src.splice(i, 1)[0]); break; }
  });
  src.sort(function (a, b) { return b.lat - a.lat; });
  return head.concat(src);
};

NS.stationState = function (st, t) {
  var r = NS.rng(st.id + '|st|' + Math.floor(t / 3600e3));
  var w = NS.weather(st, t);
  var sub = [];
  NS.eqAt(st).forEach(function (e) {
    var rr = NS.rng(st.id + e.key + Math.floor(t / 7200e3));
    var ok = rr() > 0.004;
    sub.push({ key:e.key, name:e.name, ok:ok, note:ok ? null : (rr() > 0.5 ? '再起動待ち' : '通信断') });
  });
  var down = sub.filter(function (s) { return !s.ok; });
  var status = down.length === 0 ? 'ok' : (down.length <= 1 ? 'warn' : 'down');
  /* SWIR 冷却カメラの設置局（船橋・郡山）。表記をデータ 1 か所から出す。 */
NS.swirStations = function () {
  return NS.STATIONS.filter(function (st) { return st.swir; });
};

/* デモの見栄えを安定させるため、既定は 14 局中 1 局を「一部障害」にする */
  var uptime = 99.9 - r() * 0.9 - (status === 'down' ? 2.5 : status === 'warn' ? 0.6 : 0);
  return { status:status, sub:sub, down:down, uptime:uptime, weather:w,
           latency:38 + r() * 90, disk:52 + r() * 34, night:w.sunAlt < -12,
           obsMode: w.sunAlt < -12 ? (w.cloud > 0.8 ? '曇天・待機' : '夜間観測') : (w.sunAlt < 0 ? '薄明・較正' : '昼間（電波・気象・微動）') };
};

})(NS);
