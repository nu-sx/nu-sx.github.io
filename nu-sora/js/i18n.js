/* NU-SORA デモ / 日本語・英語の切り替え
   画面に文字が出る所（NS.el の text/html、NS.s の text、NS.add に渡した文字列）を
   すべて通す層をつくり、辞書で置き換える。描画側のコードには一切手を入れない。
   辞書に無い文字列は、最長一致で語句ごとに分割して訳す。数字・記号はそのまま通る。 */
'use strict';
(function (NS) {

NS.LANGS = [{ id:'ja', label:'日本語', short:'JA' }, { id:'en', label:'English', short:'EN' }];
NS.lang = 'ja';
try { NS.lang = localStorage.getItem('nusora-lang') || 'ja'; } catch (e) {}
/* ?lang=en を付けた URL で直接 英語版を開ける（共有用） */
var q = /[?&]lang=(ja|en)/.exec(location.search);
if (q) NS.lang = q[1];
if (NS.lang !== 'en') NS.lang = 'ja';

var DICT = null;          /* 完全一致の辞書 */
var BY1 = null;           /* 先頭 1 文字 → その文字で始まる見出し語（長い順） */
var CACHE = null;

function build() {
  DICT = window.NS_EN || {};
  BY1 = {};
  CACHE = {};
  for (var k in DICT) {
    if (!k) continue;
    var c = k.charAt(0);
    (BY1[c] || (BY1[c] = [])).push(k);
  }
  for (var c2 in BY1) BY1[c2].sort(function (a, b) { return b.length - a.length; });
}

var JA = /[぀-ヿ㐀-鿿＀-￯　-〿]/;

/* 文字列を訳す。完全一致 → 最長一致の分割 → そのまま、の順に試す。 */
NS.t = function (str) {
  if (NS.lang !== 'en' || str == null) return str;
  var s = String(str);
  if (!s || !JA.test(s)) return str;            /* 日本語が無ければ触らない */
  if (!DICT) build();
  if (CACHE[s] !== undefined) return CACHE[s];
  var hit = DICT[s];
  if (hit !== undefined) { CACHE[s] = hit; return hit; }
  /* 貪欲な最長一致だと、短い見出し語が括弧だけをさらって後ろの長い語を壊す
     （例：「… m</b>（」が「（地震発生から 28 分後に確定）」の頭を食べてしまう）。
     そこで「訳せずに残る日本語の文字数」を最小にする分割を、後ろから動的計画法で決める。 */
  var n = s.length, best = new Array(n + 1);
  best[n] = { cost:0, len:0, tr:null };
  for (var i = n - 1; i >= 0; i--) {
    var ch = s.charAt(i);
    var b = { cost:best[i + 1].cost + (JA.test(ch) ? 1 : 0), len:1, tr:null };
    var list = BY1[ch];
    if (list) {
      for (var j = 0; j < list.length; j++) {
        var k = list[j];
        if (k.length > n - i) continue;
        if (s.substr(i, k.length) !== k) continue;
        var c = best[i + k.length].cost;
        if (c < b.cost || (c === b.cost && k.length > b.len)) b = { cost:c, len:k.length, tr:DICT[k] };
      }
    }
    best[i] = b;
  }
  var out = '';
  for (var p = 0; p < n; ) { var e = best[p]; out += (e.tr === null ? s.charAt(p) : e.tr); p += e.len; }
  out = out.replace(/ {2,}/g, ' ').replace(/ ([,.)）」])/g, '$1')
           .replace(/\( /g, '(').replace(/ +$/, '');
  CACHE[s] = out;
  return out;
};

/* ---- 描画の出口を包む ---- */
var _el = NS.el, _s = NS.s, _add = NS.add;
var TEXT_ATTR = { text:1, html:1, title:1, 'aria-label':1, placeholder:1, label:1 };

function wrapAttrs(attrs) {
  if (!attrs || NS.lang !== 'en') return attrs;
  var o = null;
  for (var k in attrs) {
    if (TEXT_ATTR[k] && typeof attrs[k] === 'string' && JA.test(attrs[k])) {
      if (!o) { o = {}; for (var q in attrs) o[q] = attrs[q]; }
      o[k] = NS.t(attrs[k]);
    }
  }
  return o || attrs;
}
NS.el = function (tag, attrs, kids) { return _el(tag, wrapAttrs(attrs), kids); };
NS.s  = function (tag, attrs, kids) { return _s(tag, wrapAttrs(attrs), kids); };
NS.add = function (parent, kids) {
  if (NS.lang === 'en' && kids != null) {
    if (typeof kids === 'string') kids = NS.t(kids);
    else if (Array.isArray(kids)) kids = kids.map(function (k) { return typeof k === 'string' ? NS.t(k) : k; });
  }
  return _add(parent, kids);
};

/* 方位（北北東 …）は 1 文字ずつ辞書に載せると他の語を壊すので、関数側で訳す */
var COMPASS = { '北':'N', '北北東':'NNE', '北東':'NE', '東北東':'ENE', '東':'E', '東南東':'ESE',
  '南東':'SE', '南南東':'SSE', '南':'S', '南南西':'SSW', '南西':'SW', '西南西':'WSW',
  '西':'W', '西北西':'WNW', '北西':'NW', '北北西':'NNW' };
var _compass = NS.compass;
NS.compass = function (deg) { var v = _compass(deg); return NS.lang === 'en' ? (COMPASS[v] || v) : v; };

/* 日付・時刻の言い回し（NS.ago は「○分前」を返す） */
var AGO = { '秒':'s', '分':'min', '時間':'h', '日':'d' };
var _ago = NS.ago;
NS.ago = function (t, ref) {
  var s = _ago(t, ref);
  if (NS.lang !== 'en') return s;
  var m = /^(.*?)\s*(秒|分|時間|日)前$/.exec(s);
  return m ? m[1] + ' ' + AGO[m[2]] + ' ago' : NS.t(s);
};

/* ---- 静的な部分（index.html・<title>・<html lang>）---- */
NS.PAGE_TEXT = {
  ja:{ title:'日本大学 全学屋上観測網「ソラ」 NU-SORA', lang:'ja' },
  en:{ title:'NU-SORA — Nihon University Sky Observation and Resilience Array', lang:'en' }
};
NS.applyPageLang = function () {
  var p = NS.PAGE_TEXT[NS.lang] || NS.PAGE_TEXT.ja;
  document.title = p.title;
  document.documentElement.setAttribute('lang', p.lang);
  document.body.setAttribute('data-lang', NS.lang);
};

NS.setLang = function (id) {
  if (id !== 'ja' && id !== 'en') return;
  if (id === NS.lang) return;
  NS.lang = id;
  CACHE = {};
  try { localStorage.setItem('nusora-lang', id); } catch (e) {}
  NS.applyPageLang();
  if (NS.rebuildChrome) NS.rebuildChrome();
  NS.rerender();
};

})(NS);
