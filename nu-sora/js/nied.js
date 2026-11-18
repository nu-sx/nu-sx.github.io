/* NU-SORA デモ / 防災科学技術研究所（NIED）の公開データとの連携
   到達確認済みの公開サイトのみを載せる。本デモは NIED のデータを直接取得しておらず、
   「本観測網のどのデータを、NIED のどの観測網と突き合わせるか」を示すための対応表である。
   出典：防災科研 データ公開一覧 https://www.bosai.go.jp/sp/activity_special/data/ */
'use strict';
(function (NS) {

NS.NIED = [
  { key:'kyoshin', name:'K-NET・KiK-net', ja:'基盤的強震観測網',
    url:'https://www.kyoshin.bosai.go.jp/',
    what:'全国約 1,700 点の強震計。地表と地中の加速度波形',
    use:'本観測網の微動計（14 局・校舎屋上）の記録を、近傍の K-NET 観測点と突き合わせて、地盤の揺れと校舎の応答を分離する',
    tags:['地震', '災害'] },
  { key:'hinet', name:'Hi-net', ja:'高感度地震観測網',
    url:'https://www.hinet.bosai.go.jp/',
    what:'全国約 800 点の高感度地震計。微小地震まで捉える連続波形',
    use:'火球の衝撃波は地面も揺らすため、大火球の到達時刻を Hi-net の連続波形から探し、インフラサウンドの到達時刻と突き合わせて音源高度を拘束する',
    tags:['火球', '地震'] },
  { key:'fnet', name:'F-net', ja:'広帯域地震観測網',
    url:'https://www.fnet.bosai.go.jp/top.php',
    what:'広帯域地震計 73 点。長周期の地面変動とモーメントテンソル解',
    use:'大気重力波・ラム波による地面の応答（空振と地動の結合）を長周期側で確認する。火山噴火・大規模爆発の規模推定に使う',
    tags:['火球', '火山', '地震'] },
  { key:'seafloor', name:'S-net・DONET', ja:'海底地震津波観測網',
    url:'https://www.seafloor.bosai.go.jp/',
    what:'日本海溝・南海トラフの海底に敷設した地震計と水圧計',
    use:'津波の実測（水圧計）を、本観測網の電離圏 TEC から推定した津波規模の検証に使う。海面変動 → 大気 → 電離圏という結合の出発点を押さえる',
    tags:['津波', '地震'] },
  { key:'jrisq', name:'J-RISQ', ja:'地震被害推定即時公開システム',
    url:'https://www.j-risq.bosai.go.jp/',
    what:'地震発生後に約 250 m メッシュで震度分布と被害を即時推定',
    use:'校舎の使用可否判定（微動計・DT-6）を、周辺の推定震度と並べて自治体へ示す。学校が避難所として使えるかの判断材料になる',
    tags:['地震', '災害'] },
  { key:'jshis', name:'J-SHIS', ja:'地震ハザードステーション',
    url:'https://www.j-shis.bosai.go.jp/',
    what:'全国地震動予測地図、表層地盤増幅率、活断層',
    use:'各観測局の地盤条件（増幅率）を取り込み、微動計の記録から校舎固有振動数を同定する際の基準にする',
    tags:['地震'] },
  { key:'vnet', name:'V-net', ja:'基盤的火山観測網',
    url:'https://www.vnet.bosai.go.jp/',
    what:'全国 16 火山の地震計・傾斜計・空振計・GNSS',
    use:'本観測網のインフラサウンドによる火山の定位結果を、V-net の火口近傍の空振計と突き合わせて、遠方からの規模推定を較正する',
    tags:['火山'] },
  { key:'crs', name:'NIED クライシスレスポンス', ja:'災害時情報集約',
    url:'https://crs.bosai.go.jp/',
    what:'災害発生時に各機関の情報を集約して地図で公開（SIP4D）',
    use:'落下域確率地図・線状降水帯の判定・校舎判定を、この枠組みへ流し込む形式で出力する。自治体が既に見ている画面に載せることが社会実装の近道になる',
    tags:['災害', '火球', '気象'] },
  { key:'landslide', name:'地すべり地形分布図', ja:'地形・土砂',
    url:'https://dil-opac.bosai.go.jp/publication/nied_tech_note/landslidemap/',
    what:'全国の地すべり地形を判読した図集',
    use:'線状降水帯の通報先を決める際に、土砂災害の危険度が高い区域を重ねる。通学路の判断に使う',
    tags:['気象', '災害'] },
  { key:'data', name:'防災科研 データ公開一覧', ja:'総合',
    url:'https://www.bosai.go.jp/sp/activity_special/data/',
    what:'地震・火山・気象・土砂・雪氷・総合防災の公開データ一覧',
    use:'本観測網が参照・検証に用いる外部データの入口',
    tags:['火球', '地震', '火山', '気象', '災害'] }
];

/* 分類で絞った対応表を返す */
NS.niedTable = function (tag, opt) {
  opt = opt || {};
  var rows = NS.NIED.filter(function (d) { return !tag || d.tags.indexOf(tag) >= 0; });
  return NS.table(['観測網・データ', '内容', '本観測網での使いみち'], rows.map(function (d) {
    return [NS.el('span', null, [
        NS.el('a', { href:d.url, target:'_blank', rel:'noopener' }, NS.el('b', { text:d.name })),
        NS.el('br'), NS.el('span', { class:'sm', text:d.ja })]),
      { class:'sm', html:d.what },
      { class:'sm', html:d.use }];
  }), { class:'refs' });
};
NS.niedNote = '出典：防災科学技術研究所（NIED）データ公開一覧 https://www.bosai.go.jp/sp/activity_special/data/ 。'
  + '本デモは NIED のデータを直接取得していない。実運用で「本観測網のどのデータを、どの観測網と突き合わせて検証するか」の対応を示している。';

})(NS);
