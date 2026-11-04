/* NU-SORA デモ / 観測網の規模の切り替え（現状の 14 局 ⇔ オール日大）
   オール日大＝全学部のキャンパスと全付属校の屋上に観測局を置いた将来構想。拠点の一覧は
   提案書「日本大学_全学部・付属校分布図」に基づく（座標は学校単位の代表点）。
   切り替えはページを読み直して行う（観測値の模擬生成が局の一覧を前提に組まれているため）。
   画面の文言に埋め込まれた「14 局」などの局数は、描画の出口で現在の局数に置き換える。 */
'use strict';
(function (NS) {

NS.NETS = [{ id:'14', label:'14局', title:'現状の研究計画（大学キャンパス 7・付属校 7）' },
           { id:'all', label:'オール日大', title:'全学部・全付属校に展開した将来構想' }];
NS.NET = '14';
try { NS.NET = localStorage.getItem('nusora-net') || '14'; } catch (e) {}
/* ?net=all を付けた URL で直接オール日大版を開ける（共有用） */
var q = /[?&]net=(14|all)/.exec(location.search);
if (q) NS.NET = q[1];
if (NS.NET !== 'all') NS.NET = '14';

NS.setNet = function (id) {
  if (id === NS.NET) return;
  try { localStorage.setItem('nusora-net', id); } catch (e) {}
  var s = location.search.replace(/([?&])net=[^&]*&?/, '$1').replace(/[?&]$/, '');
  if (id === 'all') s += (s ? '&' : '?') + 'net=all';
  location.href = location.pathname + s + location.hash;
};

/* オール日大の拠点。base＝現状 14 局のどの局がその拠点を担うか（局の素性・イベントは引き継ぐ）。
   [id, 局名, 英名, 種別(u=学部 / s=付属校), 都道府県, 市区町村, 緯度, 経度, 標高, 夜空輝度, 設置機関, base] */
var ALL = [
  ['SRG','駿河台局','Surugadai','u','東京都','千代田区',35.6995,139.7640,70, null,'理工学部（駿河台）・歯学部','SRG'],
  ['MSK','三崎町局','Misakicho','u','東京都','千代田区',35.7010,139.7530,20, 17.90,'法学部・経済学部・通信教育部'],
  ['ICG','市ヶ谷局','Ichigaya','u','東京都','千代田区',35.6935,139.7415,30, 17.95,'日本大学本部'],
  ['SKS','桜上水局','Sakurajosui','u','東京都','世田谷区',35.6668,139.6318,80, null,'文理学部','SKS'],
  ['KNT','砧局','Kinuta','u','東京都','世田谷区',35.6335,139.6150,40, 18.60,'商学部'],
  ['SGJ','三軒茶屋局','Sangenjaya','u','東京都','世田谷区',35.6430,139.6690,40, 18.20,'危機管理学部・スポーツ科学部'],
  ['EKD','江古田局','Ekoda','u','東京都','練馬区',35.7375,139.6735,45, 18.40,'芸術学部'],
  ['TKZ','所沢局','Tokorozawa','u','埼玉県','所沢市',35.7900,139.4520,85, 19.40,'芸術学部（所沢校舎）'],
  ['ITB','板橋局','Itabashi','u','東京都','板橋区',35.7495,139.7000,40, 18.30,'医学部・医学部附属板橋病院'],
  ['FNB','船橋局','Funabashi','u','千葉県','船橋市',35.7265,140.0530,70, null,'理工学部（船橋）・薬学部・短期大学部（船橋）','FNB'],
  ['TDN','津田沼局','Tsudanuma','u','千葉県','習志野市',35.6940,140.0135,60, null,'生産工学部（津田沼）','TDN'],
  ['MMM','実籾局','Mimomi','u','千葉県','習志野市',35.7000,140.0430,30, 19.30,'生産工学部（実籾）'],
  ['MTD','松戸局','Matsudo','u','千葉県','松戸市',35.7800,139.9050,30, 18.80,'松戸歯学部'],
  ['SNN','湘南局','Shonan','u','神奈川県','藤沢市',35.3750,139.4700,65, null,'生物資源科学部','SNN'],
  ['MSM','三島局','Mishima','u','静岡県','三島市',35.1210,138.9170,80, null,'国際関係学部・短期大学部（三島）','MSM'],
  ['KYM','郡山局','Koriyama','u','福島県','郡山市',37.3900,140.3830,280, null,'工学部','KYM'],
  ['HYS','日吉局','Hiyoshi','s','神奈川県','横浜市港北区',35.5290,139.6320,45, 18.70,'日本大学高等学校・中学校'],
  ['SKO','櫻丘局','Sakuragaoka','s','東京都','世田谷区',35.6660,139.6330,50, 18.40,'日本大学櫻丘高等学校'],
  ['TRG','鶴ヶ丘局','Tsurugaoka','s','東京都','杉並区',35.6735,139.6560,50, 18.40,'日本大学鶴ヶ丘高等学校'],
  ['FJS','藤沢局','Fujisawa','s','神奈川県','藤沢市',35.3760,139.4720,50, 19.60,'日本大学藤沢高等学校・中学校・小学校'],
  ['BZN','豊山局','Buzan','s','東京都','文京区',35.7230,139.7360,30, 18.00,'日本大学豊山高等学校・中学校'],
  ['BZJ','豊山女子局','Buzan Joshi','s','東京都','板橋区',35.7770,139.6870,30, 18.40,'日本大学豊山女子高等学校・中学校'],
  ['MSH','日大三島局','Nichidai Mishima','s','静岡県','三島市',35.1240,138.9200,50, 20.40,'日本大学三島高等学校・中学校'],
  ['MSE','明誠局','Meisei','s','山梨県','上野原市',35.6250,139.1050,300, 20.90,'日本大学明誠高等学校'],
  ['YMG','山形局','Yamagata','s','山形県','山形市',38.2650,140.3300,175, null,'日本大学山形高等学校','YMG'],
  ['NRS','習志野局','Narashino','s','千葉県','船橋市',35.7280,140.0560,30, 19.35,'日本大学習志野高等学校'],
  ['THK','日大東北局','Nichidai Tohoku','s','福島県','郡山市',37.3960,140.3620,245, 20.20,'日本大学東北高等学校'],
  ['YCH','日大幼稚園局','NU Kindergarten','s','東京都','杉並区',35.6760,139.6560,50, 18.40,'日本大学幼稚園'],
  ['ICH','日大一局','Nichidai Daiichi','s','東京都','墨田区',35.6975,139.7950,10, 17.90,'日本大学第一高等学校・中学校'],
  ['CHB','千葉日大一局','Chiba Nichidai Daiichi','s','千葉県','船橋市',35.7300,140.0620,30, 19.30,'千葉日本大学第一高等学校・中学校・小学校'],
  ['NI2','日大二局','Nichidai Daini','s','東京都','杉並区',35.7100,139.6300,50, 18.50,'日本大学第二高等学校・中学校'],
  ['NI3','日大三局','Nichidai Daisan','s','東京都','町田市',35.5950,139.4200,110, 19.20,'日本大学第三高等学校・中学校'],
  ['MGR','目黒局','Meguro','s','東京都','目黒区',35.6420,139.7020,35, 18.10,'目黒日本大学高等学校・中学校・幼稚園'],
  ['NGN','長野局','Nagano','s','長野県','長野市',36.6300,138.2000,395, null,'長野日本大学高等学校・中学校・小学校','NGN'],
  ['TCR','土浦局','Tsuchiura','s','茨城県','土浦市',36.0850,140.2050,50, null,'土浦日本大学高等学校・附属幼稚園','TCR'],
  ['TCC','土浦中等局','Tsuchiura Secondary','s','茨城県','土浦市',36.0950,140.1800,30, 20.30,'土浦日本大学中等教育学校'],
  ['IWS','岩瀬局','Iwase','s','茨城県','桜川市',36.3450,140.1000,80, 20.90,'岩瀬日本大学高等学校'],
  ['OGK','大垣局','Ogaki','s','岐阜県','大垣市',35.3700,136.6200,35, null,'大垣日本大学高等学校','OGK'],
  ['MYZ','宮崎局','Miyazaki','s','宮崎県','宮崎市',31.9300,131.4200,55, null,'宮崎日本大学高等学校・中学校','MYZ'],
  ['SPR','札幌局','Sapporo','s','北海道','北広島市',42.9800,141.5600,75, null,'札幌日本大学高等学校・中学校','SPR'],
  ['SNO','佐野局','Sano','s','栃木県','佐野市',36.3100,139.5800,60, 20.40,'佐野日本大学高等学校'],
  ['SNC','佐野中等局','Sano Secondary','s','栃木県','佐野市',36.3150,139.5850,60, 20.40,'佐野日本大学中等教育学校'],
  ['NGS','長崎局','Nagasaki','s','長崎県','諫早市',32.8500,130.0500,55, null,'長崎日本大学高等学校・中学校','NGS']
];

/* data.js から呼ぶ。現状 14 局の一覧を受け取り、選ばれている観測網の局一覧を返す */
NS.buildNetwork = function (base) {
  if (NS.NET !== 'all') return base;
  var byId = {}; base.forEach(function (s) { byId[s.id] = s; });
  var nNew = 0;
  return ALL.map(function (a) {
    if (a[11]) {
      var b = byId[a[11]], o = {};
      for (var k in b) o[k] = b[k];
      o.host = a[10]; o.core = true;
      return o;
    }
    /* 拡張局の設置は研究期間の後（2029 年度以降）に順次 */
    var d = new Date(Date.UTC(2029, 3, 10) + (nNew++) * 9 * 86400e3);
    return { id:a[0], name:a[1], en:a[2], kind:a[3], pref:a[4], city:a[5], lat:a[6], lon:a[7], alt:a[8],
      swir:false, draco:false, host:a[10], role:a[3] === 'u' ? '学部拠点（拡張）' : '付属校拠点（拡張）', ext:true,
      sqm:a[9], noise:Math.max(0.6, Math.min(1.7, 1.7 - (a[9] - 17.9) * 0.35)),
      inst:d.toISOString().slice(0, 10) };
  });
};

/* ---- 文言の局数を置き換える ---- */
function counts() {
  var L = NS.STATIONS || [];
  return { n:L.length, u:L.filter(function (s) { return s.kind === 'u'; }).length,
           s:L.filter(function (s) { return s.kind !== 'u'; }).length };
}
NS.netText = function (str) {
  if (NS.NET !== 'all' || typeof str !== 'string' || str.indexOf('14') < 0 && str.indexOf('7') < 0) return str;
  var c = counts();
  if (!c.n) return str;
  return str
    .replace(/(^|[^0-9.,:+\-–])14(\s?)(局|点|校|拠点)/g, '$1' + c.n + '$2$3')
    .replace(/×\s?14(?![0-9])/g, '×' + c.n)
    .replace(/(大学キャンパス(?:拠点)?\s?)7(?![0-9])/g, '$1' + c.u)
    .replace(/(付属校(?:拠点)?\s?)7(?![0-9])/g, '$1' + c.s)
    .replace(/\b14([ -])(stations?|schools|sites|points|locations)\b/g, c.n + '$1$2')
    .replace(/\b14 \((?=7 university)/g, c.n + ' (')
    .replace(/\b7 (university campus)/g, c.u + ' $1')
    .replace(/\b7 (affiliated|school sites)/g, c.s + ' $1');
};

var _el = NS.el, _s = NS.s, _add = NS.add;
var TEXT_ATTR = { text:1, html:1, title:1, 'aria-label':1, placeholder:1, label:1 };
function fixAttrs(attrs) {
  if (!attrs || NS.NET !== 'all') return attrs;
  var o = null;
  for (var k in attrs) {
    if (TEXT_ATTR[k] && typeof attrs[k] === 'string') {
      var v = NS.netText(attrs[k]);
      if (v !== attrs[k]) { if (!o) { o = {}; for (var q2 in attrs) o[q2] = attrs[q2]; } o[k] = v; }
    }
  }
  return o || attrs;
}
NS.el = function (tag, attrs, kids) { return _el(tag, fixAttrs(attrs), kids); };
NS.s  = function (tag, attrs, kids) { return _s(tag, fixAttrs(attrs), kids); };
NS.add = function (parent, kids) {
  if (NS.NET === 'all' && kids != null) {
    if (typeof kids === 'string') kids = NS.netText(kids);
    else if (Array.isArray(kids)) kids = kids.map(function (k) { return typeof k === 'string' ? NS.netText(k) : k; });
  }
  return _add(parent, kids);
};

/* index.html に直接書かれた文言（フッターなど） */
function fixStatic() {
  if (NS.NET !== 'all' || !document.getElementById('main')) return;   /* ポータル本体のページだけ（トップページは自前で置き換える） */
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
  while ((n = w.nextNode())) { var v = NS.netText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  var m = document.querySelector('meta[name="description"]');
  if (m) m.setAttribute('content', NS.netText(m.getAttribute('content')));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixStatic);
else fixStatic();

/* 英語の見出し語 */
if (window.NS_EN) {
  window.NS_EN['14局'] = '14 stations';
  window.NS_EN['オール日大'] = 'All Nihon U';
  window.NS_EN['観測網の規模'] = 'Network scale';
  window.NS_EN['現状の研究計画（大学キャンパス 7・付属校 7）'] = 'Current research plan (7 university campuses, 7 schools)';
  window.NS_EN['全学部・全付属校に展開した将来構想'] = 'Future plan covering every faculty and affiliated school';
  window.NS_EN['学部拠点（拡張）'] = 'Faculty site (expansion)';
  window.NS_EN['付属校拠点（拡張）'] = 'School site (expansion)';
  window.NS_EN['オール日大構想'] = 'All Nihon U plan';
  ALL.forEach(function (a) { if (!window.NS_EN[a[1]]) window.NS_EN[a[1]] = a[2]; });
}

})(NS);
