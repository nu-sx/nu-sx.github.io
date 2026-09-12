/* NU-SORA デモ / 宇宙線計測（全 14 局）の解説と解析
   Accel Kitchen「素粒子検出器組み立てキット」を全局に置き、1 分ごとの計数を常時記録する。
   1 台では見えない数 % の変動を、同じ局にある気圧計で補正し、14 局を足し合わせて読む。 */
'use strict';
(function (NS) {
var el = NS.el, panel = NS.panel, kv = NS.kv, badge = NS.badge, f = NS.f;

NS.crSection = function (go) {
  var t = NS.now(), kpi = NS.kpi, out = el('div', { class:'grid', style:{ gap:'14px' } });

  /* 全 14 局の合計。1 台では統計に埋もれる数 % が、14 局と長い平均でようやく見えてくる */
  var day = NS.crNetSeries(30, 24);                    /* 30 日・日平均 */
  var hr  = NS.crNetSeries(10, 3);                     /* 10 日・3 時間平均 */
  var refAll = day.reduce(function (a, b) { return a + b.corr; }, 0) / day.length;
  var pct = function (v) { return (v / refAll - 1) * 100; };
  var dayPts  = day.map(function (x) { return [x.h / 24, pct(x.corr)]; });
  var lo = dayPts.reduce(function (a, b) { return b[1] < a[1] ? b : a; }, dayPts[0]);

  var hrRef = hr.reduce(function (a, b) { return a + b.corr; }, 0) / hr.length;
  var rawPts = hr.map(function (x) { return [x.h / 24, (x.raw / hrRef - 1) * 100]; });
  var corPts = hr.map(function (x) { return [x.h / 24, (x.corr / hrRef - 1) * 100]; });
  var prPts  = hr.map(function (x) { return [x.h / 24, x.press]; });

  /* 補正がどれだけ効いたかを相関係数で示す */
  function corr2(a, b) {
    var n = a.length, ma = 0, mb = 0;
    for (var i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var sab = 0, saa = 0, sbb = 0;
    for (var j = 0; j < n; j++) {
      var da = a[j] - ma, db = b[j] - mb;
      sab += da * db; saa += da * da; sbb += db * db;
    }
    return sab / Math.sqrt(saa * sbb);
  }
  var pArr = hr.map(function (x) { return x.press; });
  var rRaw = corr2(pArr, hr.map(function (x) { return x.raw; }));
  var rCor = corr2(pArr, hr.map(function (x) { return x.corr; }));
  var pMin = Math.min.apply(null, pArr), pMax = Math.max.apply(null, pArr);

  var now14 = 0, now14c = 0;
  NS.STATIONS.forEach(function (st) { var c = NS.cosmicRay(st, t); now14 += c.cpm; now14c += c.corr; });
  var sigma1 = Math.sqrt(NS.CR.base), sigmaDay = Math.sqrt(NS.CR.base * NS.STATIONS.length * 1440);

  out.appendChild(panel('宇宙線計測で何を見るか', {
    note:'1 台では統計に埋もれる数 % の変動を、14 局と長い平均で読み取る',
    tools:badge('素粒子検出器（プラスチックシンチレータ）', 'info') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'地上に降ってくる宇宙線ミューオンの数は、いつもほぼ一定に見える。しかし実際には頭上の大気の量（気圧）と'
        + '成層圏の気温、そして太陽活動でわずかに上下しており、その幅は数 % しかない。'
        + '受光面 25 cm² の検出器 1 台では 1 分あたりの計数が 30 前後しかなく、統計のばらつき（±√N ≒ ' + f(sigma1, 1) + '）だけで'
        + '±17 % 揺れてしまう。つまり 1 台・短時間では原理的に見えない。'
        + '同じ装置を 14 局に置き、同じ局の気圧計で補正して 1 日ぶん足し合わせると、ばらつきは ±0.1 % まで下がり、'
        + '気圧効果もフォーブッシュ減少もはっきり数値として出る。この「数を増やして時間をかける」という手続きそのものが、'
        + '観測網を持つことの意味であり、そのまま探究学習の教材になる（G-8）。' }),
    el('div', { class:'grid g4' }, [
      kpi('全 14 局の合計計数', f(now14, 0), 'cpm', '気圧補正後 ' + f(now14c, 0) + ' cpm', { acc:true, icon:'✷' }),
      kpi('1 局・1 分の統計誤差', '± ' + f(sigma1 / NS.CR.base * 100, 1), '%', '計数 ' + f(NS.CR.base, 0) + ' cpm・受光面 25 cm²'),
      kpi('14 局・1 日の統計誤差', '± ' + f(sigmaDay / (NS.CR.base * NS.STATIONS.length * 1440) * 100, 2), '%',
          '約 ' + (NS.CR.base * NS.STATIONS.length * 1440 / 1000).toFixed(0) + ' 千カウント／日'),
      kpi('直近 30 日の最大減少', f(lo[1], 1), '%', 'フォーブッシュ減少（' + f(-lo[0], 1) + ' 日前）')
    ])
  ]));

  out.appendChild(el('div', { class:'grid g2' }, [
    panel('気圧効果とその補正（全 14 局合計・直近 10 日）', { note:'3 時間平均。紫＝生の計数、赤＝気圧補正後。下は同じ期間の平均気圧' }, [
      NS.chart.line({ width:560, height:210, series:[
          { pts:rawPts, color:'var(--c-spec)', width:1.5 },
          { pts:corPts, color:'var(--accent)', width:1.7 }
        ], xLabel:'現在からの日数', yLabel:'平常値からのずれ %',
        rules:[{ y:0, color:'var(--muted)', dash:'3 3' }],
        xFmt:function (v) { return f(v, 0) + 'd'; }, yFmt:function (v) { return f(v, 1); } }),
      NS.chart.legend([['生の計数', 'var(--c-spec)', 'line'], ['気圧補正後', 'var(--accent)', 'line']]),
      kv([['生の計数と気圧', '<b>r = ' + f(rRaw, 2) + '</b>（気圧が上がると計数が下がる）'],
          ['補正後と気圧', '<b>r = ' + f(rCor, 2) + '</b>（相関が消えている）'],
          ['気圧の変動幅', f(pMin, 1) + ' – ' + f(pMax, 1) + ' hPa（' + f(pMax - pMin, 1) + ' hPa）'],
          ['計数への効き', '± ' + f((pMax - pMin) / 2 * 0.15, 2) + ' %（−0.15 %/hPa）']], 'wide'),
      NS.chart.line({ width:560, height:110, series:[{ pts:prPts, color:'var(--c-met)', width:1.6, area:true }],
        yLabel:'気圧 hPa', margin:{ l:46, r:12, t:10, b:22 },
        xFmt:function (v) { return f(v, 0) + 'd'; }, yFmt:function (v) { return f(v, 0); } }),
      el('div', { class:'note', text:'気圧が下がると計数は上がり、上がると下がる。補正するとこの逆相関が消えて平坦になり、'
        + '残った変動が太陽活動や大気上層の気温によるものになる。気圧計を同じ屋上に持っていることが、ここで効いてくる。' })
    ]),
    panel('フォーブッシュ減少（全 14 局合計・直近 30 日）', { note:'日平均・気圧補正後。太陽コロナ質量放出（CME）の通過で数 % 下がり、数日かけて戻る' }, [
      NS.chart.line({ width:560, height:210, series:[{ pts:dayPts, color:'var(--accent)', width:1.8, dots:2 }],
        xLabel:'現在からの日数', yLabel:'平常値からのずれ %',
        rules:[{ y:0, color:'var(--muted)', dash:'4 3', label:'平常値' },
               { x:lo[0], color:'var(--c-crit)', dash:'3 3', label:'フォーブッシュ減少' }],
        xFmt:function (v) { return f(v, 0) + 'd'; }, yFmt:function (v) { return f(v, 1); } }),
      kv([
        ['減少量', '<b>' + f(lo[1], 1) + ' %</b>（' + f(-lo[0], 1) + ' 日前）'],
        ['統計誤差', '± ' + f(sigmaDay / (NS.CR.base * NS.STATIONS.length * 1440) * 100, 2) + ' %（14 局・1 日平均）'],
        ['回復', '約 3 日かけて緩やかに戻る'],
        ['原因', 'CME に伴う磁場の壁が、銀河宇宙線を一時的に遮る'],
        ['突き合わせ', 'NICT 宇宙天気予報・地磁気擾乱（Dst 指数）・本観測網の電離圏 TEC（G-5）'],
        ['意味', '宇宙天気の地上への影響を、学校の屋上で直接測れる']
      ], 'wide'),
      el('div', { class:'note', text:'フォーブッシュ減少は世界の中性子モニタ網で日常的に観測されている現象で、'
        + '同じものを安価な検出器を数多く置くことでも捉えられる。2 周波 GNSS の電離圏 TEC（DT-5）と同じ事象を別の物理で見ることになる。' })
    ])
  ]));

  /* ---- 他のセンサーとの組み合わせ ---- */
  out.appendChild(panel('ほかのセンサーと組み合わせて分かること', { note:'宇宙線計測は単独では意味が薄い。同じ屋上の他の装置と結んで初めて効く' },
    NS.table(['読みたい現象', '宇宙線計測が示すもの', '組み合わせる装置', '対応テーマ'], [
      ['大気の厚みの変化', '気圧効果（−0.15 %/hPa）。標高による増加も同じ物理で説明できる', '複合気象センサー（気圧）', badge('G-6', 'info')],
      ['成層圏の気温', '気温効果（−0.09 %/K）。ミューオンの生成高度が変わる', '高層気象観測・インフラサウンドの成層圏反射波', badge('G-4 / G-6', 'info')],
      ['太陽活動と宇宙天気', 'フォーブッシュ減少・太陽地上増加（GLE）', '2 周波 GNSS（電離圏 TEC）・NICT 宇宙天気', badge('G-5 / DT-5', 'info')],
      ['雷雲の電場', '雷雲ガンマ線（TGE）。放電の直前に増え、放電と同時に止まる', 'インフラサウンド（雷放電）・気象センサー', badge('G-4 / G-6', 'info')],
      ['地磁気の遮断能', '南北で計数が数 % 違う（札幌 10.2 GV ／ 宮崎 11.9 GV）', '全 14 局の南北配置そのもの', badge('G-5', 'info')],
      ['検出器の健全性', '計数が平常値から外れ続けたら装置の異常', '制御 PC の稼働監視', badge('PF-1', 'info')],
      ['生徒の探究学習', '自分で組み立て、自校の空の下で測り、全国と比べる', '付属校 7 局', badge('G-8 / DT-7', 'ok')]
    ]), 'wide'));

  /* ---- 雷雲ガンマ線 ---- */
  out.appendChild(panel('雷雲ガンマ線（TGE）とインフラサウンドの同時観測', {
    note:'雷は音と放射線の両方を出す。同じ屋上で両方を測れる観測網は多くない' }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'発達した雷雲の中では電場によって電子が加速され、制動放射でガンマ線が出る。地上でこれを捉えたものを'
        + '雷雲ガンマ線（thunderstorm ground enhancement, TGE）と呼び、日本海側の冬季雷では日常的に観測されている。'
        + '本観測網はインフラサウンドで雷放電の位置を、宇宙線計測器で放射線の増加を、同じ局で同時に記録できる。'
        + '「放電の直前に増え、放電と同時に止まる」という時間関係を押さえられれば、雷雲内部の電場の状態を外から推定できる。'
        + 'TGE は数十 % に達することもあり、数 % の気圧効果と違って 1 台でもはっきり見える。' }),
    NS.table(['時間関係', 'インフラサウンド', '宇宙線計測器', '読み取れること'], [
      ['雷雲の接近', '遠方の雷放電音を方位交会で検知', '計数は平常', '雷雲がどちらから来るか'],
      ['直上に来る前', '放電音の頻度が上がる', '<b>計数が数 % – 数十 % 増える</b>', '雲内の電場が強まり、電子加速が起きている'],
      ['放電の瞬間', '強い衝撃音（0.6–14 Hz）', '<b>増加が急に止まる</b>', '放電で電場が解消された'],
      ['通過後', '放電音が遠ざかる', '数分かけて平常へ戻る', '雷雲が離れた']
    ], 'wide'),
    el('div', { class:'note', html:'日本では Enoto et al. (2017, <i>Nature</i>) が冬季雷に伴うガンマ線で光核反応を捉えるなど、'
      + '雷と高エネルギー現象の研究が進んでいる。本観測網の狙いはその追試ではなく、'
      + '<b>雷を「音」と「放射線」の両方で同時に記録する多点網</b>をつくることにある。線状降水帯の検知（G-6）で用いる雷放電の'
      + '方位交会と、同じ事象を別の物理で確かめられる。' }),
    el('div', { class:'split', style:{ marginTop:'10px' } }, [
      el('button', { class:'iconbtn', text:'線状降水帯の統合検知へ →', onclick:function () { go('weather'); } }),
      el('button', { class:'iconbtn', text:'インフラサウンド全国アレイへ →', onclick:function () { go('infra'); } })
    ])
  ]));

  out.appendChild(el('div', { class:'src', html:'装置：Accel Kitchen 株式会社「素粒子検出器組み立てキット」'
    + '（<a href="https://shop.accel-kitchen.com/items/131852452" target="_blank" rel="noopener">shop.accel-kitchen.com/items/131852452</a>）。'
    + 'プラスチックシンチレータ 5×5×1 cm、SiPM 型光センサー、ESP32、OLED 表示、USB 給電、ブラウザで波形と計数を表示。'
    + '中高生・大学初年次の教材として設計されており、組み立てそのものを探究学習に組み込める。'
    + '物理定数（気圧効果 −0.15 %/hPa、気温効果 −0.09 %/K、遮断能、フォーブッシュ減少の振幅と回復時間）は宇宙線物理の一般的な値を用い、'
    + '計数のばらつきはポアソン統計で与えている。表示している計数はデモ用の模擬データであり、実観測ではない。' }));
  return out;
};

/* =========================================================================
   Draco スマート望遠鏡（船橋局・郡山局）
   ========================================================================= */
NS.DRACO = {
  model:'DWARFLAB Draco', aperture:90, fl:340, fr:3.8, eqFl:1200,
  sensor:'1/1.3" 50 MP CMOS（画素 1.2 µm／2×2 ビニングで 2.4 µm・約 12 MP）',
  wide:'1/1.55" 広角カメラ（35 mm 換算 23.3 mm・視野 85.7°）',
  fov:'約 1.7° × 1.3°（望遠）', expo:'1/10000 – 300 秒', guide:'内蔵ガイド ＋ センサー回転による視野回転の補正',
  io:'USB 3.0 / Ethernet / NFC', batt:'10,000 mAh（約 5 時間）', mass:5.5,
  at:['FNB', 'KYM']
};
NS.dracoSection = function (st, go) {
  var kpi = NS.kpi, D = NS.DRACO, t = NS.now();
  var s2 = NS.stationState(st, t), w = s2.weather, sb = NS.skyBrightness(st, t);
  var open = w.rain < 0.2 && w.wind < 14 && w.rh < 92 && sb.sunAlt < -6;
  var out = [];

  out.push(panel('Draco スマート望遠鏡　' + st.name, {
    note:D.model + '　口径 ' + D.aperture + ' mm・焦点距離 ' + D.fl + ' mm（F' + D.fr.toFixed(1) + '）／特注ハウジング',
    tools:open ? badge('観測条件 成立', 'ok') : badge('ハウジング 閉（待機）', 'warn') }, [
    el('p', { style:{ margin:'0 0 12px', color:'var(--ink2)' },
      text:'全天カメラは視野 95° で空全体を見張り、ガンダム望遠鏡は主鏡 400 mm の視野 0.43° で一点を深く見る。その間を埋めるのが Draco である。'
        + '望遠で約 1.7°、広角で 85.7° という二つの視野を同時に持ち、極軸合わせも別のガイド鏡も要らずに 300 秒露出まで追尾できる。'
        + '観測網が拾った事象に数十秒で向けられる「素早い中望遠」として、船橋局と郡山局（工学部）の 2 局に、特注ハウジングとともに設置する。' }),
    el('div', { class:'grid g4' }, [
      kpi('口径 / 焦点距離', D.aperture + ' / ' + D.fl, 'mm', 'F' + D.fr.toFixed(1) + '（35 mm 換算 ' + D.eqFl + ' mm）', { acc:true, icon:'⊙' }),
      kpi('望遠の視野', '1.7 × 1.3', 'deg', D.sensor),
      kpi('広角の視野', '85.7', 'deg', D.wide + ' · 天の川を丸ごと写す'),
      kpi('最長露出', '300', '秒', D.guide)
    ])
  ]));

  out.push(el('div', { class:'grid g2' }, [
    panel('諸元', { note:D.model }, kv([
      ['光学系', '口径 ' + D.aperture + ' mm・焦点距離 ' + D.fl + ' mm（F' + D.fr.toFixed(1) + '）。折りたたみ光路'],
      ['主センサー', D.sensor],
      ['広角カメラ', D.wide],
      ['視野（望遠）', D.fov],
      ['露出', D.expo],
      ['追尾', D.guide + '。経緯台のままで長時間露出ができる'],
      ['接続', D.io + '（ハウジング内は Ethernet で局の制御 PC に直結）'],
      ['電源', D.batt + '。ハウジング内では常時給電とし、停電時のみ内蔵電池で退避'],
      ['質量', D.mass + ' kg（本体）']
    ], 'wide')),
    panel('特注ハウジング', { note:'屋上に常設して遠隔運用するための外装。本体は本来が可搬機のため、常設化はこちら側で受け持つ' }, [
      NS.table(['項目', '仕様', 'ねらい'], [
        ['形式', 'スライドルーフ式（電動・全開まで 18 秒）', '開いたときに視界を遮らない。ドームより低背で風荷重が小さい'],
        ['防水・防塵', 'IP65 相当（閉時）', '屋上の常設に耐える'],
        ['結露対策', 'ヒーター ＋ 除湿剤 ＋ 内気循環ファン', '光学面の曇りを防ぐ。湿度 92 % 超で自動的に閉じる'],
        ['インターロック', '雨感知器・風速計のハードウェア信号を直接入力', '通信が切れても自動で閉じる'],
        ['電源・通信', 'PoE ＋ 常時給電、Ethernet で制御 PC へ', '遠隔からの電源再投入に対応'],
        ['基準方位', '据付時に北を機械的に出す治具を同梱', '毎回の初期化を短くする'],
        ['温度', '−15 – ＋45 ℃ で動作', '札幌から宮崎まで同じ設計で置ける']
      ], 'wide'),
      el('div', { class:'note', text:'ハウジングは全 14 局へ展開することを見越して設計する。まず船橋局（ハブ局）と郡山局（東北拠点）で'
        + '1 年間運用し、結露・積雪・風の条件を実測してから横展開する。筐体設計は生産工学部が担当する。' })
    ])
  ]));

  out.push(panel('この望遠鏡の使いみち', { note:'全天カメラ（95°）→ Draco（1.7°）→ ガンダム望遠鏡 副鏡（1.08°）→ 主鏡（0.43°）と視野を絞っていく' },
    NS.table(['観測', '内容', '使うカメラ', '対応テーマ'], [
      ['流星群の輻射点監視', '極大夜に輻射点周辺を高感度で撮り続け、全天カメラでは暗すぎる流星まで数える', '広角', badge('G-1', 'info')],
      ['流星痕（永続痕）の追跡', '明るい火球のあとに残る発光雲を数分間追い、高層風の情報を得る', '望遠', badge('G-1 / G-4', 'info')],
      ['人工衛星・デブリの追尾', '再突入予報天体を通過に合わせて自動追尾し、光度変化から自転周期を出す', '望遠', badge('G-2', 'info')],
      ['突発天体のフォローアップ', '新星・超新星・GRB 可視残光の速報を受けて、数十秒で指向し測光する', '望遠', badge('G-1', 'info')],
      ['彗星の監視', 'コマの広がりと明るさを継続的に測る', '望遠', badge('G-1', 'info')],
      ['夜空の明るさの検証', '広角画像の背景輝度を夜空輝度計（SQM）と突き合わせる', '広角', badge('G-3 / DT-2', 'info')],
      ['付属校のリモート観測', '校舎から遠隔で指向・露出を操作し、自分の観測として記録を残す', '両方', badge('G-8 / DT-7', 'ok')]
    ]), 'wide'));

  out.push(panel('設置する 2 局', { note:'性格の違う 2 局で 1 年運用し、条件を実測してから横展開する' },
    NS.table(['観測局', '所在地', '夜空輝度', 'この局に置く理由'], NS.DRACO.at.map(function (id) {
      var x = NS.ST[id];
      return [el('b', { text:x.name }), x.pref + ' ' + x.city,
        { class:'r mono', html:f(x.sqm, 2) + ' mag/arcsec²' },
        { class:'sm', html:id === 'FNB'
          ? 'ハブ局。ガンダム望遠鏡（400 / 200 mm）と同じ屋上に置き、視野の広さで役割を分ける。分光・SWIR も揃うため、一つの事象を複数の装置で同時に押さえられる'
          : '東北拠点。船橋より空が暗く、冬季の積雪と低温でハウジングを試験できる。工学部（建築・機械）が筐体の実測を担当する' }];
    }), 'wide')));

  out.push(el('div', { class:'src', html:'装置：DWARFLAB Draco（口径 90 mm・焦点距離 340 mm F3.8、1/1.3" 50 MP ＋ 広角 1/1.55"、'
    + '露出 1/10000–300 秒、内蔵ガイド、USB 3.0 / Ethernet / NFC、10,000 mAh、本体 5.5 kg）。'
    + '諸元は <a href="https://www.dwarflab.com/us/products/draco-smart-telescope" target="_blank" rel="noopener">DWARFLAB 公式</a> による。'
    + 'ハウジングは本観測網のための特注品で、仕様は検討中の案である。表示している観測条件はデモ用の模擬データである。' }));
  return out;
};

})(NS);
