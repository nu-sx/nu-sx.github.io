/* NU-SORA デモ / リモート望遠鏡
   船橋局のガンダム望遠鏡（400 / 200 mm）と、船橋・郡山の Draco スマート望遠鏡を
   遠隔から操作する画面。視野に入る恒星はエール輝星星表（BSC5）の実データを
   接平面（gnomonic）投影で描き、それより暗い星は等級分布に従って補っている。 */
'use strict';
(function (NS) {
var el = NS.el, panel = NS.panel, kv = NS.kv, badge = NS.badge, f = NS.f, D2R = Math.PI / 180;
NS.V = NS.V || {};        /* views より先に読み込まれても壊れないようにする */

/* ---------------- 望遠鏡 ---------------- */
/* 月の平均視直径（度）。31.09′。視野との大小比較に使う。 */
NS.MOON_DIAM_DEG = 0.5181;

NS.SCOPES = [
  /* 視野は ZWO ASI174MM の公称 5.86 µm 角・1936 × 1216（実寸 11.34 × 7.13 mm）と焦点距離から求めた値 */
  { id:'GDM-P', name:'ガンダム望遠鏡 主鏡', short:'主鏡 400', st:'FNB', ap:400, fl:1520, fr:3.8,
    fovX:0.4276, fovY:0.2686, res:0.795, cam:'ZWO ASI174MM-Cool', px:'1936 × 1216（5.86 µm 角）',
    lim:{ 1:14.2, 10:16.8, 60:18.4, 300:19.8 }, modes:['lif', 'debris', 'astro'] },
  { id:'GDM-S', name:'ガンダム望遠鏡 副鏡', short:'副鏡 200', st:'FNB', ap:200, fl:600, fr:3.0,
    fovX:1.0833, fovY:0.6805, res:2.0145, cam:'ZWO ASI174MM-Cool', px:'1936 × 1216（5.86 µm 角）',
    lim:{ 1:12.6, 10:15.2, 60:16.8, 300:18.2 }, modes:['lif', 'debris', 'astro'] },
  { id:'DRC-F', name:'Draco 船橋局', short:'Draco 船橋', st:'FNB', ap:90, fl:340, fr:3.8,
    fovX:1.70, fovY:1.30, res:1.5, cam:'1/1.3" 50 MP CMOS', px:'8192 × 6144（ビニングで 4096 × 3072）',
    lim:{ 1:11.4, 10:14.0, 60:16.2, 300:19.5 }, modes:['astro', 'debris', 'wide'] },
  { id:'DRC-K', name:'Draco 郡山局（工学部）', short:'Draco 郡山', st:'KYM', ap:90, fl:340, fr:3.8,
    fovX:1.70, fovY:1.30, res:1.5, cam:'1/1.3" 50 MP CMOS', px:'8192 × 6144（ビニングで 4096 × 3072）',
    lim:{ 1:11.7, 10:14.4, 60:16.6, 300:19.9 }, modes:['astro', 'debris', 'wide'] }
];
NS.SCOPE_MODES = {
  lif:    { name:'月面衝突閃光', icon:'☾', note:'月の夜側を 60 fps で撮り、動体検出にかける' },
  debris: { name:'デブリ追尾',   icon:'🛰', note:'公開軌道要素から予報した通過を、恒星時追尾を打ち消して追う' },
  astro:  { name:'天体観測',     icon:'✦', note:'恒星時追尾で長時間露出する' },
  wide:   { name:'広角',         icon:'◍', note:'視野 85.7° の広角カメラ。天の川を丸ごと写す' }
};

/* 月面衝突閃光が観測できる夜。夜側（地球照側）が地球を向いているのは
   月齢 3–10 と 20–27 のあいだで、なかでも上弦ごろの月齢 7 は夜側が広く取れて
   条件がよい。既定ではその月齢にいちばん近い夜へ送る。 */
NS.LIF_AGE = 7;
NS.nextLifNight = function (want, station) {
  var st = station || NS.ST.FNB;
  var base = NS.tonightAt(18), aim = want == null ? NS.LIF_AGE : want;
  var best = null, bd = 1e9, alt = base, ad = 1e9;
  /* 夜（18:00 から翌 04:00 まで）を 15 分きざみに見て、月が十分高く、
     月齢が目標にいちばん近い時刻を選ぶ。月齢 7 なら宵のうちに高く昇っている。 */
  for (var d = 0; d < 32; d++) {
    for (var q = 0; q < 40; q++) {
      var tt = base + d * 86400e3 + q * 900e3;
      var age = NS.moonPhase(tt) * 29.530588853;
      var dif = Math.abs(age - aim);
      if (dif < ad) { ad = dif; alt = tt; }         /* 高度を問わない控えの候補 */
      if (NS.moonAlt(tt, st.lat, st.lon) < 25) continue;
      if (dif < bd) { bd = dif; best = tt; }
    }
  }
  return best || alt;
};

/* 観測目標。α・δ は J2000。 */
NS.SCOPE_TARGETS = [
  { id:'moon',   name:'月（夜側・地球照）', kind:'moon',  mode:'lif',    ra:null, dec:null, mag:-10.2 },
  { id:'m42',    name:'M42 オリオン大星雲', kind:'neb',   mode:'astro',  ra:83.82,  dec:-5.39,  mag:4.0, sz:0.55, col:'#C77DBB' },
  { id:'m31',    name:'M31 アンドロメダ銀河', kind:'neb', mode:'astro',  ra:10.68,  dec:41.27,  mag:3.4, sz:0.62, col:'#B9A16B' },
  { id:'m45',    name:'M45 プレアデス星団', kind:'clus',  mode:'astro',  ra:56.75,  dec:24.12,  mag:1.6, sz:0.50 },
  { id:'phae',   name:'(3200) Phaethon', kind:'ast',     mode:'astro',  ra:117.4,  dec:22.6,   mag:15.2 },
  { id:'gem',    name:'ふたご座流星群 輻射点', kind:'rad', mode:'astro', ra:112.0,  dec:33.0,   mag:null },
  { id:'per',    name:'ペルセウス座流星群 輻射点', kind:'rad', mode:'astro', ra:46.2, dec:57.4, mag:null },
  { id:'sat',    name:'再突入予報天体（TLE 追尾）', kind:'sat', mode:'debris', ra:88.5, dec:12.0, mag:7.2 },
  { id:'geo',    name:'静止衛星帯（東経 110°）', kind:'geo', mode:'debris', ra:196.0, dec:-6.4, mag:12.1 }
];

/* ---------------- 目標天体の実写（DSS2） ----------------
   NASA/GSFC SkyView から取り出した Digitized Sky Survey 2 の合成画像。
   向きは北が上・東が左で、観測画面と同じ。画角と視野中心を持たせてあるので、
   鏡筒を変えても、指向をずらしても、実際の見かけの大きさで貼れる。 */
var SKY_BASE = (function () {
  var sc = document.currentScript && document.currentScript.src;
  return sc ? sc.replace(/js\/telescope\.js.*$/, '') : '';
})();
NS.SKY_PHOTOS = {
  m42:{ file:'m42.jpg', ra:83.822, dec:-5.391,  w:1.40, h:1.40 },
  m31:{ file:'m31.jpg', ra:10.684, dec:41.035, w:3.60, h:3.132 },
  m45:{ file:'m45.jpg', ra:56.750, dec:24.117, w:2.60, h:2.60 }
};
/* 画像は使うときに読み、届いたら cb で描き直してもらう */
NS.skyPhoto = function (id, cb) {
  var p = NS.SKY_PHOTOS[id];
  if (!p) return null;
  if (p.img) return p.ok ? p.img : null;
  p.img = new Image();
  p.img.onload = function () { p.ok = true; if (cb) cb(); };
  p.img.onerror = function () { p.ok = false; };
  p.img.src = SKY_BASE + 'assets/sky/' + p.file;
  return null;
};

/* ---------------- 視野の描画 ---------------- */
/* 接平面投影。中心 (ra0, dec0) から見た (ra, dec) の視野内座標を度で返す。 */
function gnomonic(ra, dec, ra0, dec0) {
  var r = ra * D2R, d = dec * D2R, r0 = ra0 * D2R, d0 = dec0 * D2R;
  var cd = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(r - r0);
  if (cd <= 0.02) return null;                       /* 視野の裏側 */
  return [ Math.cos(d) * Math.sin(r - r0) / cd / D2R,
           (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(r - r0)) / cd / D2R ];
}
/* 視野内の暗い星を、等級分布 N(<m) ∝ 10^(0.35 m) に従って生成する（星表の限界より暗い側を補う） */
function fieldStars(ra0, dec0, fovX, fovY, limMag) {
  var key = Math.round(ra0 * 4) + '|' + Math.round(dec0 * 4) + '|' + Math.round(limMag * 2);
  var r = NS.rng('fld' + key);
  var area = fovX * fovY;
  /* 銀緯が低いほど星が多い。ごく粗い近似 */
  var gb = Math.abs(dec0) < 30 ? 1.7 : 1.0;
  /* 回転しても四隅が空かないよう、対角ぶんの正方形に撒く */
  var side = Math.hypot(fovX, fovY) * 1.02;
  var n = Math.min(900, Math.round(side * side * gb * 42 * Math.pow(10, 0.34 * (limMag - 9))));
  var out = [];
  for (var i = 0; i < n; i++) {
    var m = limMag - Math.log10(1 - r() * (1 - Math.pow(10, -0.34 * (limMag - 6.5)))) / 0.34;
    out.push([ (r() - 0.5) * side, (r() - 0.5) * side, Math.min(limMag, m), r() ]);
  }
  return out;
}

NS.ScopeView = function (opts) {
  opts = opts || {};
  var W = opts.width || 620, H = Math.round(W * 0.66);
  var cv = el('canvas', { width:W * 2, height:H * 2, class:'scopeview',
    style:{ width:'100%', maxWidth:W + 'px', height:'auto', display:'block' } });
  var ctx = cv.getContext('2d'); ctx.scale(2, 2);
  /* 星野は数千個を描くので毎フレームは重い。指向・露出・ゲインが変わったときだけ
     裏画面へ描き直し、ふだんはそれを貼るだけにする（全天カメラと同じ考え方）。 */
  var bg = el('canvas', { width:W * 2, height:H * 2 });
  var bctx = bg.getContext('2d'); bctx.scale(2, 2);
  /* 視野のずれ（度）。月モードでは枠を、星野モードでは指向そのものを動かす。
     度で持つので、鏡筒や表示倍率が変わっても同じ場所を指したままになる。 */
  /* fovRot はカメラのポジションアングル（度）。北から東回りを正とする。
     画面は北が上・東が左なので、正の回転は反時計回りに見える。 */
  var A = { node:cv, W:W, H:H, t0:performance.now(), _key:null,
            fovOff:{ x:0, y:0 }, fovRot:0, _moon:null, _S:null };
  function rotLocal(dx, dy, th) {                  /* 画面 → 枠のローカル座標 */
    var c = Math.cos(th * D2R), sn = Math.sin(th * D2R);
    return [dx * c - dy * sn, dx * sn + dy * c];
  }

  /* --- マウス操作 -----------------------------------------------------
     月モード：観測視野の枠をドラッグして、月面のどこを写すかを決める。
     星野モード：画面そのものが視野なので、ドラッグすると指向（α・δ）が動く。 */
  var drag = null, raf = 0;
  function toCanvas(e2) {
    var r = cv.getBoundingClientRect();
    return [(e2.clientX - r.left) / r.width * W, (e2.clientY - r.top) / r.height * H];
  }
  function onFrame(p) {
    var m = A._moon;
    if (!m) return false;
    var l = rotLocal(p[0] - m.nx, p[1] - m.fcy, m.th || 0);
    return Math.abs(l[0]) <= m.fw / 2 + 8 && Math.abs(l[1]) <= m.fh / 2 + 8;
  }
  function onHandle(p) {
    var m = A._moon;
    if (!m) return false;
    var l = rotLocal(p[0] - m.nx, p[1] - m.fcy, m.th || 0);
    return Math.hypot(l[0], l[1] + m.hd) <= 11;
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; if (A._S) A.draw(A._S); });
  }
  cv.addEventListener('pointermove', function (e2) {
    if (!drag) {                                   /* 掴めるところで手の形にする */
      var S = A._S, q = toCanvas(e2);
      cv.style.cursor = (S && S.target.kind === 'moon')
        ? (onHandle(q) ? 'crosshair' : (onFrame(q) ? 'move' : 'default')) : 'grab';
      return;
    }
    var p = toCanvas(e2), dx = p[0] - drag.x, dy = p[1] - drag.y;
    if (drag.kind === 'rot') {
      /* ハンドルがマウスの方を向くような回転角を求める（画面上：北が上・東が左） */
      var mx = p[0] - drag.cx, my = p[1] - drag.cy;
      if (Math.hypot(mx, my) > 6) {
        var a = Math.atan2(-mx, -my) / D2R;
        A.fovRot = Math.round(((a + 540) % 360 - 180) * 10) / 10;
      }
    } else if (drag.kind === 'fov') {
      var m = A._moon;
      var lim = NS.MOON_DIAM_DEG * 1.1;            /* 月から離れすぎないようにする */
      A.fovOff.x = Math.max(-lim, Math.min(lim, drag.ox + dx / m.pxDeg));
      A.fovOff.y = Math.max(-lim, Math.min(lim, drag.oy + dy / m.pxDeg));
    } else {
      var S2 = A._S, sc = S2.scope;
      var fx = S2.mode === 'wide' ? 85.7 : sc.fovX, fy = S2.mode === 'wide' ? 64.3 : sc.fovY;
      var kx = W / fx, ky = H / fy;
      var dec = Math.max(-88, Math.min(88, drag.dec + dy / ky));
      S2.dec = dec;
      S2.ra = (drag.ra + (dx / kx) / Math.max(0.08, Math.cos(dec * D2R)) + 360) % 360;
    }
    schedule();
  });
  cv.addEventListener('pointerdown', function (e2) {
    var S = A._S; if (!S) return;
    var p = toCanvas(e2);
    if (S.target.kind === 'moon') {
      if (onHandle(p)) {
        drag = { kind:'rot', cx:A._moon.nx, cy:A._moon.fcy };
        A.dragging = 'rot';
        cv.setPointerCapture(e2.pointerId); e2.preventDefault();
        return;
      }
      if (!onFrame(p)) return;
      drag = { kind:'fov', x:p[0], y:p[1], ox:A.fovOff.x, oy:A.fovOff.y };
    } else {
      drag = { kind:'pan', x:p[0], y:p[1], ra:S.ra, dec:S.dec };
      cv.style.cursor = 'grabbing';
    }
    A.dragging = true;
    cv.setPointerCapture(e2.pointerId);
    e2.preventDefault();
  });
  function endDrag() {
    if (!drag) return;
    var kind = drag.kind;
    drag = null; A.dragging = false; cv.style.cursor = 'default';
    if (A.onMoved) A.onMoved(kind);
    schedule();
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', function () { if (!drag) cv.style.cursor = 'default'; });

  /* 実データの月面地図など、あとから届いたものを反映させる */
  function redrawScope() { if (A._S) { A._key = null; A.draw(A._S); } }

  A.draw = function (S) {
    A._S = S;
    var sc = S.scope, tg = S.target, exp = S.exp, gain = S.gain;
    var lim = (sc.lim[exp] || sc.lim[300]) + (gain - 100) / 140;
    ctx.clearRect(0, 0, W, H);
    /* 背景（空の明るさに応じたかぶり） */
    /* lum は空の明るさ（かぶり）。外側の bg（裏画面）と名前が衝突しないようにする。 */
    var st = NS.ST[sc.st], sb = NS.skyBrightness(st, S.t);
    var lum = Math.max(0, Math.min(1, (21.6 - (sb.mag == null ? st.sqm : sb.mag)) / 5));
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgb(' + Math.round(6 + lum * 26) + ',' + Math.round(8 + lum * 26) + ',' + Math.round(14 + lum * 30) + ')');
    g.addColorStop(1, 'rgb(' + Math.round(4 + lum * 20) + ',' + Math.round(6 + lum * 20) + ',' + Math.round(11 + lum * 24) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (!S.open) {                                   /* ハウジング／ドームが閉じている */
      ctx.fillStyle = 'rgba(0,0,0,0.86)'; ctx.fillRect(0, 0, W, H);
      ctx.font = '600 15px -apple-system,"Hiragino Sans",sans-serif';
      ctx.fillStyle = 'rgba(222,131,48,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(NS.t('ハウジング閉 — 観測条件が成立していません'), W / 2, H / 2);
      A.overlay(S, lim);
      return;
    }

    if (tg.kind === 'moon') { drawMoon(S); }
    else {
      var key = [sc.id, S.mode, f(S.ra, 3), f(S.dec, 3), S.exp, S.gain, S.bin, f(S.seeing, 2), f(S.track, 2),
                 f(A.fovRot, 1), NS.skyPhoto(tg.id) ? 'p' : '-'].join('|');
      if (key !== A._key) { A._key = key; drawField(S, lim); }   /* 裏画面を作り直す */
      ctx.drawImage(bg, 0, 0, W, H);
      drawTarget(S);                                             /* 動くものだけ毎フレーム */
    }
    A.overlay(S, lim);
  };

  /* --- 星野（裏画面に描く） --- */
  function drawField(S, lim) {
    var sc = S.scope;
    var fx = S.mode === 'wide' ? 85.7 : sc.fovX, fy = S.mode === 'wide' ? 64.3 : sc.fovY;
    /* 回転させるので縦横のスケールは揃える（実際の検出器も画素が正方形で等方） */
    var kx = Math.min(W / fx, H / fy), ky = kx;
    var cth = Math.cos(-A.fovRot * D2R), sth = Math.sin(-A.fovRot * D2R);
    var rBase = Math.max(0.7, S.seeing / 3600 * kx * 0.8);
    var sky = NS.unpackSky ? NS.unpackSky() : null;
    var jit = S.track * 0.6;

    /* 背景のかぶり（空の明るさ） */
    var st = NS.ST[sc.st], sb = NS.skyBrightness(st, S.t);
    var lum = Math.max(0, Math.min(1, (21.6 - (sb.mag == null ? st.sqm : sb.mag)) / 5));
    bctx.clearRect(0, 0, W, H);
    bctx.fillStyle = 'rgb(' + Math.round(6 + lum * 24) + ',' + Math.round(8 + lum * 24) + ',' + Math.round(14 + lum * 28) + ')';
    bctx.fillRect(0, 0, W, H);

    /* 目標天体の実写（DSS2）。恒星より先に敷いて、この上に星像とノイズを乗せる。 */
    var tgt = S.target, photo = (tgt.kind === 'neb' || tgt.kind === 'clus')
      ? NS.skyPhoto(tgt.id, function () { A._key = null; if (A._S) A.draw(A._S); }) : null;
    if (photo) {
      var P = NS.SKY_PHOTOS[tgt.id], gp = gnomonic(P.ra, P.dec, S.ra, S.dec);
      if (gp) {
        var upx = -gp[0] * kx, upy = -gp[1] * ky;
        var ppx = W / 2 + upx * cth + upy * sth, ppy = H / 2 - upx * sth + upy * cth;
        /* 露出とゲインで淡いところの出かたが変わる */
        var br = 0.62 + 0.24 * Math.log(S.exp / 10) / Math.LN10 + 0.24 * Math.log(S.gain / 180) / Math.LN10;
        bctx.save();
        bctx.translate(ppx, ppy); bctx.rotate(-A.fovRot * D2R);
        bctx.globalCompositeOperation = 'lighter';
        bctx.globalAlpha = Math.max(0.2, Math.min(1, br));
        bctx.drawImage(photo, -P.w * kx / 2, -P.h * kx / 2, P.w * kx, P.h * kx);
        bctx.restore();
      }
    }

    function star(dx, dy, mag, bv) {
      /* 東が左・北が上。そのうえでカメラの回転角ぶん回す */
      var ux = -dx * kx, uy = -dy * ky;
      var x = W / 2 + ux * cth + uy * sth, y = H / 2 - ux * sth + uy * cth;
      if (x < -8 || x > W + 8 || y < -8 || y > H + 8) return;
      var amp = Math.pow(10, -0.4 * (mag - lim));
      if (amp < 0.015) return;
      /* 明るい星ほど大きく・濃く。等級の差が見た目に出るように広めに振る */
      var rr = Math.min(6, rBase * (0.5 + 1.6 * Math.pow(amp, 0.28))) + jit * 0.3;
      var a = Math.min(1, 0.22 + 0.62 * Math.pow(amp, 0.30));
      /* NS.bvColor は [B−V, r, g, b] を返すので、色は 1〜3 番目を使う */
      var c = (NS.bvColor && bv != null) ? NS.bvColor(bv).slice(1) : [232, 238, 248];
      bctx.beginPath(); bctx.arc(x, y, rr, 0, 7);
      bctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
      bctx.fill();
      if (amp > 400) {          /* にじみを描くのは視野内でごく少数の明るい星だけ */
        var gg = bctx.createRadialGradient(x, y, 0, x, y, rr * 4);
        gg.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.22)');
        gg.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        bctx.fillStyle = gg; bctx.beginPath(); bctx.arc(x, y, rr * 4, 0, 7); bctx.fill();
      }
    }
    /* 星表の実データ（視野に入るものだけ） */
    if (sky) {
      var cosLim = Math.cos(Math.max(fx, fy) * 0.9 * D2R);
      var sd0 = Math.sin(S.dec * D2R), cd0 = Math.cos(S.dec * D2R);
      for (var i2 = 0; i2 < sky.n; i2++) {
        if (sky.mag[i2] > lim) continue;
        if (sd0 * sky.sinD[i2] + cd0 * sky.cosD[i2] < cosLim - 0.02) continue;   /* まず粗くふるう */
        var p = gnomonic(sky.ra[i2], sky.dec[i2], S.ra, S.dec);
        if (!p || Math.hypot(p[0], p[1]) > Math.hypot(fx, fy) * 0.56) continue;
        star(p[0], p[1], sky.mag[i2], sky.bv[i2]);
      }
    }
    /* 星表より暗い星を補う（実写を貼ったときは、写真に写っている星と二重になるので撒かない） */
    /* 暗い星は K・M 型（B−V 0.8–1.6 の橙〜赤）が多数を占めるので、その向きに寄せる */
    if (!photo) fieldStars(S.ra, S.dec, fx, fy, lim).forEach(function (s2) {
      star(s2[0], s2[1], s2[2], 0.15 + Math.pow(s2[3], 0.65) * 1.45);
    });
    /* ノイズ。点を何千個も打つと重いので、小さなタイルを 1 枚作って敷き詰める。 */
    var nz = Math.max(0, (S.gain - 100) / 900 + (1 / Math.sqrt(S.exp)) * 0.06);
    if (nz > 0.004) {
      var pat = noiseTile(Math.min(1, nz * 5));
      if (pat) {
        bctx.save();
        bctx.globalAlpha = 0.5;
        bctx.fillStyle = pat;
        bctx.fillRect(0, 0, W, H);
        bctx.restore();
      }
    }
  }

  /* ノイズのタイル。強さ（0–1）ごとに 1 枚だけ作って使い回す。 */
  var noiseCache = {};
  function noiseTile(amp) {
    var key = Math.round(amp * 10);
    if (noiseCache[key] !== undefined) return noiseCache[key];
    var N = 72, tc = el('canvas', { width:N, height:N }), tx = tc.getContext('2d');
    var img = tx.createImageData(N, N), d = img.data, r = NS.rng('nzt' + key);
    for (var i = 0; i < d.length; i += 4) {
      var v = 128 + (r() - 0.5) * 190 * amp;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = Math.round(52 * amp);
    }
    tx.putImageData(img, 0, 0);
    noiseCache[key] = bctx.createPattern(tc, 'repeat');
    return noiseCache[key];
  }

  /* --- 目標天体（動くので毎フレーム描く） --- */
  function drawTarget(S) {
    var sc = S.scope, tg = S.target;
    var fx = S.mode === 'wide' ? 85.7 : sc.fovX, fy = S.mode === 'wide' ? 64.3 : sc.fovY;
    var kx = Math.min(W / fx, H / fy), ky = kx;
    var el2 = (performance.now() - A.t0) / 1000;
    if (tg.kind === 'neb' || tg.kind === 'clus') {
      /* 実写（DSS2）は裏画面に貼ってあるので、ここでは代替のぼかしだけを描く */
      if (!NS.skyPhoto(tg.id)) {
        var rx = tg.sz * kx, ry = tg.sz * ky * 0.72;
        var col = tg.col || '#8FB9E0';
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-A.fovRot * D2R); ctx.scale(1, ry / rx);
        /* グラデーションは変換後の座標系で作らないと、中心がずれる */
        var gg2 = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        gg2.addColorStop(0, col + 'b0'); gg2.addColorStop(0.4, col + '4a'); gg2.addColorStop(1, col + '00');
        ctx.fillStyle = gg2; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
      }
    } else if (tg.kind === 'ast') {
      var mx = W / 2 + Math.cos(el2 * 0.18) * 22, my = H / 2 + Math.sin(el2 * 0.18) * 9;
      ctx.beginPath(); ctx.arc(mx, my, 2.6, 0, 7); ctx.fillStyle = '#F2C14E'; ctx.fill();
      ctx.strokeStyle = 'rgba(242,193,78,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.stroke();
    } else if (tg.kind === 'sat' || tg.kind === 'geo') {
      var len = tg.kind === 'geo' ? 8 : 34;
      ctx.strokeStyle = 'rgba(69,133,204,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(W / 2 - len, H / 2 - len * 0.28); ctx.lineTo(W / 2 + len, H / 2 + len * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 3.2, 0, 7); ctx.fillStyle = '#7FB2E5'; ctx.fill();
    } else if (tg.kind === 'rad') {
      ctx.strokeStyle = 'rgba(214,64,95,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      var ph2 = (el2 % 7) / 7;
      if (ph2 < 0.12) {
        var a2 = 1 - ph2 / 0.12, L = 120 * (ph2 / 0.12);
        ctx.strokeStyle = 'rgba(255,235,205,' + a2.toFixed(2) + ')'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(W / 2 + 24, H / 2 - 10);
        ctx.lineTo(W / 2 + 24 + L * 0.9, H / 2 - 10 + L * 0.42); ctx.stroke();
      }
    }
  }

  /* --- 月（月面衝突閃光モード） --- */
  function drawMoon(S) {
    /* 月と視野を同じ角スケールで描く。月の視直径は平均 31.09′（＝0.5181°）。
       視野が月より広い副鏡では月が小さく、狭い主鏡では月が大きく見える。 */
    var sc = S.scope;
    var halfDeg = Math.max(NS.MOON_DIAM_DEG / 2, sc.fovX / 2, sc.fovY / 2) * 1.16;
    var pxDeg = Math.min(W, H) * 0.5 / halfDeg;    /* 1 度あたりの px */
    var R = NS.MOON_DIAM_DEG / 2 * pxDeg, CX = W / 2, CY = H / 2 + 4;
    var ph = NS.moonPhase(S.t);                    /* 0 = 新月, 0.5 = 満月 */
    var fI = NS.moonIllum(S.t);                    /* 輝面比 */
    var waxing = ph < 0.5;                         /* 上弦へ向かう＝西（画面右）が光る */

    /* 月面（海・クレーター・光条を月面座標から起こした画像。js/moon.js）。
       キャンバスは 2 倍に拡大して描いているので、装置画素にあわせて作る。 */
    var mimg = NS.moonImage
      ? NS.moonImage(Math.round(4 * R), fI, waxing, function () { redrawScope(); })
      : null;
    if (mimg) {
      ctx.drawImage(mimg, CX - R, CY - R, 2 * R, 2 * R);
    } else {                                       /* 念のための代替表示 */
      ctx.save();
      ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.clip();
      ctx.fillStyle = '#191C22'; ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);
      ctx.fillStyle = '#C9CBD0';
      for (var y = -R; y <= R; y += 1) {
        var w = Math.sqrt(Math.max(0, R * R - y * y));
        var t = (1 - 2 * fI) * w;
        if (waxing) ctx.fillRect(CX + t, CY + y, Math.max(0, w - t), 1);
        else        ctx.fillRect(CX - w, CY + y, Math.max(0, w - t), 1);
      }
      ctx.restore();
    }
    /* 明るい側の縁に出るにじみ（夜側を写す露出では実際にこう見える） */
    /* 内側（半径 0）から作らないと、円の内部が塗りつぶされてしまう */
    var gl = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 1.13);
    gl.addColorStop(0, 'rgba(198,206,220,0)');
    gl.addColorStop(0.87, 'rgba(198,206,220,0)');
    gl.addColorStop(0.90, 'rgba(198,206,220,0.17)');
    gl.addColorStop(1, 'rgba(198,206,220,0)');
    ctx.save();
    ctx.beginPath();
    if (waxing) ctx.rect(CX - R * 0.15, CY - R * 1.2, R * 1.4, R * 2.4);
    else        ctx.rect(CX - R * 1.25, CY - R * 1.2, R * 1.4, R * 2.4);
    ctx.clip();
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(CX, CY, R * 1.13, 0, 7); ctx.fill();
    ctx.restore();
    /* 夜側の縁が背景に沈まないよう、ごく薄い輪郭を添える */
    ctx.strokeStyle = 'rgba(150,165,190,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.stroke();

    /* 観測視野（カメラが実際に写す範囲）を長方形で示す。既定では夜側の中心に向ける。 */
    var fw = sc.fovX * pxDeg, fh = sc.fovY * pxDeg;
    var nx = CX + (waxing ? -R * 0.42 : R * 0.42);
    /* 視野が月面全体を収められるなら中心に置き、収まらないなら夜側へ寄せる */
    if (fw >= R * 2 && fh >= R * 2) nx = CX;
    var baseX = nx, baseY = CY;
    nx += A.fovOff.x * pxDeg;                      /* ドラッグ量（度）を px に戻す */
    var fcy = CY + A.fovOff.y * pxDeg;
    A._moon = { CX:CX, CY:CY, R:R, pxDeg:pxDeg, fw:fw, fh:fh,
                nx:nx, fcy:fcy, baseX:baseX, baseY:baseY, waxing:waxing, fI:fI };
    var th = A.fovRot;
    ctx.save();
    ctx.translate(nx, fcy); ctx.rotate(-th * D2R);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = A.dragging ? 'rgba(214,64,95,0.95)' : 'rgba(214,64,95,0.72)';
    ctx.lineWidth = A.dragging ? 1.6 : 1.2;
    ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
    /* 四隅に掴み代を出して、動かせることが分かるようにする */
    ctx.setLineDash([]); ctx.lineWidth = 1.6;
    var cs = 7;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
      var x0 = q[0] * fw / 2, y0 = q[1] * fh / 2;
      ctx.beginPath();
      ctx.moveTo(x0 - q[0] * cs, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, y0 - q[1] * cs);
      ctx.stroke();
    });
    /* 回転ハンドル：枠の上に伸ばした棒の先の丸 */
    var hd = fh / 2 + 18;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(214,64,95,0.55)';
    ctx.beginPath(); ctx.moveTo(0, -fh / 2); ctx.lineTo(0, -hd); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -hd, 5, 0, 7);
    ctx.fillStyle = A.dragging === 'rot' ? 'rgba(214,64,95,0.95)' : 'rgba(214,64,95,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(214,64,95,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    A._moon.th = th; A._moon.hd = hd;
    /* ラベルは長方形の左上、枠の外に出す */
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = 'rgba(232,121,143,0.92)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    var off = (A.fovOff.x || A.fovOff.y)
      ? '   ' + NS.t('中心から') + ' ' + f(A.fovOff.x * 60, 1) + '′ / ' + f(-A.fovOff.y * 60, 1) + '′' : '';
    if (th) off += '   ' + NS.t('回転') + ' ' + (th > 0 ? '+' : '') + f(th, 1) + '°';
    /* 回転後の外接矩形の左上に置く。画面の端と上部の文字に重ならないよう内側へ寄せる */
    var ca = Math.abs(Math.cos(th * D2R)), sa = Math.abs(Math.sin(th * D2R));
    var bw = (fw * ca + fh * sa) / 2, bh = (fw * sa + fh * ca) / 2;
    ctx.fillText(NS.t('観測視野') + '  ' + f(sc.fovX * 60, 1) + '′ × ' + f(sc.fovY * 60, 1) + '′' + off,
                 Math.max(18, nx - bw), Math.max(66, fcy - bh - 24));
    ctx.textBaseline = 'bottom'; ctx.fillStyle = 'rgba(170,182,200,0.75)';
    ctx.fillText(NS.t('月齢 ') + f(ph * 29.53, 1) + NS.t('　輝面比 ') + Math.round(fI * 100) + ' %', CX, CY - R - 8);

    /* 衝突閃光（数秒ごとに夜側で点滅する） */
    /* 衝突閃光は望遠鏡では分解されない点光源で、継続も 1〜数フレームしかない。
       目立たせすぎると実際の見え方から離れるので、小さな点像と控えめな検出枠で描く。 */
    var el3 = (performance.now() - A.t0) / 1000, cyc = el3 % 9;
    if (cyc < 0.34) {
      var r2 = NS.rng('flash' + Math.floor(el3 / 9));
      /* 閃光は「視野の内側」かつ「月の夜側」でしか検出できない。両方を満たす点を選ぶ。 */
      var fx2 = nx, fy2 = fcy;
      for (var k = 0; k < 40; k++) {
        var lx = (r2() - 0.5) * fw * 0.86, ly = (r2() - 0.5) * fh * 0.86;
        var ct = Math.cos(-A.fovRot * D2R), st2 = Math.sin(-A.fovRot * D2R);
        var px2 = nx + lx * ct - ly * st2, py2 = fcy + lx * st2 + ly * ct;
        var dx2 = px2 - CX, dy2 = py2 - CY;
        if (dx2 * dx2 + dy2 * dy2 > R * R * 0.88) continue;          /* 月の外 */
        var wHalf = Math.sqrt(Math.max(0, R * R - dy2 * dy2));
        var term = (1 - 2 * fI) * wHalf;                              /* 明暗境界 */
        if (waxing ? (dx2 >= term) : (dx2 <= -term)) continue;        /* 昼側は不可 */
        fx2 = px2; fy2 = py2; break;
      }
      var amp = Math.max(0, 1 - cyc / 0.34);
      var rad = 5 * amp + 1.6;
      var gg = ctx.createRadialGradient(fx2, fy2, 0, fx2, fy2, rad);
      gg.addColorStop(0, 'rgba(255,244,214,' + (0.80 * amp).toFixed(2) + ')');
      gg.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fx2, fy2, rad, 0, 7); ctx.fill();
      /* 芯は 1 px 強の点 */
      ctx.beginPath(); ctx.arc(fx2, fy2, 1.1, 0, 7);
      ctx.fillStyle = 'rgba(255,250,232,' + (0.95 * amp).toFixed(2) + ')'; ctx.fill();
      /* 検出枠は細い破線で小さく */
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(214,64,95,0.6)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(fx2, fy2, 7, 0, 7); ctx.stroke();
      ctx.restore();
      /* ラベルが明るい側にはみ出すと閃光が昼側にあるように見えるので、内側へ寄せる */
      ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = 'rgba(232,121,143,0.85)';
      ctx.textBaseline = 'middle';
      if (waxing) { ctx.textAlign = 'right'; ctx.fillText(NS.t('閃光候補'), fx2 - 10, fy2); }
      else        { ctx.textAlign = 'left';  ctx.fillText(NS.t('閃光候補'), fx2 + 10, fy2); }
    }
  }

  /* --- 画面に重ねる情報 --- */
  A.overlay = function (S, lim) {
    var sc = S.scope;
    ctx.save();
    /* 十字線 */
    ctx.strokeStyle = 'rgba(120,200,170,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 26, H / 2); ctx.lineTo(W / 2 - 8, H / 2);
    ctx.moveTo(W / 2 + 8, H / 2); ctx.lineTo(W / 2 + 26, H / 2);
    ctx.moveTo(W / 2, H / 2 - 26); ctx.lineTo(W / 2, H / 2 - 8);
    ctx.moveTo(W / 2, H / 2 + 8); ctx.lineTo(W / 2, H / 2 + 26);
    ctx.stroke();
    /* 枠 */
    ctx.strokeStyle = 'rgba(150,165,190,0.28)';
    ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
    /* 方位（北が上・東が左） */
    ctx.font = '9.5px ui-monospace, monospace'; ctx.fillStyle = 'rgba(170,182,200,0.75)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('N', W / 2, 14); ctx.textBaseline = 'bottom';
    ctx.fillText('S', W / 2, H - 14);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('E', 14, H / 2);
    ctx.textAlign = 'right'; ctx.fillText('W', W - 14, H / 2);
    /* 左上：望遠鏡と露出 */
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = 'rgba(226,232,242,0.92)';
    ctx.fillText(sc.id + '  ' + NS.fmtJST(S.t, { sec:true }) + (S.live ? '' : ' ' + NS.t('（再現）')), 18, 20);
    ctx.fillStyle = 'rgba(200,212,230,0.72)';
    ctx.fillText(S.exp + ' s × ' + S.frames + '  gain ' + S.gain + '  bin' + S.bin +
                 (S.filter !== 'none' ? '  ' + S.filter : ''), 18, 34);
    ctx.fillText(NS.t('限界等級') + ' ' + f(lim, 1) + '  ' + NS.t('視野') + ' ' +
                 (S.mode === 'wide' ? '85.7° × 64.3°' : f(sc.fovX, 2) + '° × ' + f(sc.fovY, 2) + '°'), 18, 48);
    /* 右上：座標 */
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(226,232,242,0.92)';
    ctx.fillText('α ' + f(S.ra, 3) + '°   δ ' + (S.dec >= 0 ? '+' : '') + f(S.dec, 3) + '°', W - 18, 20);
    ctx.fillStyle = 'rgba(200,212,230,0.72)';
    ctx.fillText(NS.t('追尾残差') + ' ' + f(S.track, 2) + '″/min   ' + NS.t('シーイング') + ' ' + f(S.seeing, 2) + '″', W - 18, 34);
    /* 右下：模擬表示 */
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textBaseline = 'bottom';
    ctx.fillText(NS.t('模擬映像（デモ）'), W - 18, H - 18);
    /* 露出インジケータ */
    if (S.running) {
      var p = ((performance.now() - A.t0) / 1000 % S.exp) / S.exp;
      ctx.fillStyle = 'rgba(214,64,95,0.85)';
      ctx.fillRect(18, H - 22, (W - 36) * p, 3);
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(226,232,242,0.8)';
      ctx.fillText(NS.t('露光中') + ' ' + Math.ceil(S.exp * (1 - p)) + ' s', 18, H - 28);
    }
    ctx.restore();
  };
  return A;
};

/* ---------------- 画面 ---------------- */
NS.V.telescope = function (root, go, arg) {
  var kpi = NS.kpi;
  var defT = NS.defaultSkyTime();
  var S = {
    scope:NS.SCOPES[0], mode:'lif', target:NS.SCOPE_TARGETS[0],
    ra:0, dec:0, exp:10, gain:180, frames:30, bin:1, filter:'none',
    running:true, open:true, seeing:2.4, track:1.1, focus:3.2, log:[],
    /* 昼間は観測条件が成立しないので、既定では今夜の星空を映す（全天カメラと同じ扱い） */
    t:defT.t, live:defT.live, tLabel:defT.label
  };
  var view = NS.ScopeView({ width:620 });
  var statBox = el('div'), logBox = el('div', { class:'cmdlog' }), guideBox = el('div');

  function itl() { return NS.gdInterlock ? NS.gdInterlock(S.t, NS.ST[S.scope.st]) : { open:true, items:[] }; }
  function pushLog(txt, kind) {
    S.log.unshift({ t:NS.now(), txt:txt, kind:kind || 'cmd' });
    S.log = S.log.slice(0, 9);
    NS.clear(logBox);
    S.log.forEach(function (l) {
      NS.add(logBox, el('div', { class:'cl ' + l.kind }, [
        el('span', { class:'ct', text:NS.fmtJST(l.t, { timeOnly:true }) }),
        el('span', { text:l.txt })]));
    });
  }
  function redraw() {
    var i = itl();
    S.open = i.open && S.domeOpen !== false;
    var r = NS.rng('scope' + S.scope.id + Math.floor(S.t / 60000));
    S.seeing = 1.8 + r() * 1.6;
    S.track = 0.7 + r() * 0.9;
    S.focus = 2.6 + r() * 1.4;
    view.draw(S);
    NS.clear(statBox); NS.add(statBox, statusTable(i));
    NS.clear(guideBox); NS.add(guideBox, guideChart());
  }
  /* 枠を動かしたら、どこを向けたかをログに残す */
  view.onMoved = function (kind) {
    if (kind === 'rot') {
      pushLog(NS.t('カメラ回転角を変更：') + (view.fovRot > 0 ? '+' : '') + f(view.fovRot, 1) + '°', 'cmd');
      redraw(); return;
    }
    if (kind === 'fov') {
      var o2 = view.fovOff;
      pushLog(NS.t('観測視野を移動：月の中心から ') + f(o2.x * 60, 1) + '′ / ' + f(-o2.y * 60, 1) + '′', 'cmd');
    } else {
      pushLog(NS.t('指向を移動：') + 'α ' + f(S.ra, 3) + '°  δ ' + (S.dec >= 0 ? '+' : '') + f(S.dec, 3) + '°', 'cmd');
    }
    redraw();
  };

  function setTarget(tg) {
    S.target = tg;
    S.mode = tg.mode;
    view.fovOff.x = 0; view.fovOff.y = 0; view.fovRot = 0;   /* 目標を変えたら視野のずれ・回転は戻す */
    if (tg.ra != null) { S.ra = tg.ra; S.dec = tg.dec; }
    else { S.ra = 205.0; S.dec = 12.0; }
    if (tg.kind === 'moon') {
      /* 月面衝突閃光は月齢が限られるので、次の観測好機の夜へ表示時刻を送る */
      S.t = NS.nextLifNight(); S.live = false;
      S.tLabel = NS.t('観測好機');
      if (tsegRef) Array.prototype.forEach.call(tsegRef.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      pushLog(NS.t('月齢の条件から、次の観測好機へ表示時刻を送った：') + NS.fmtJST(S.t, { sec:false })
        + '（' + NS.t('月齢 ') + f(NS.moonPhase(S.t) * 29.53, 1) + '）', 'ok');
    }
    view.t0 = performance.now();
    pushLog(NS.t('目標を変更：') + tg.name + (tg.ra != null ?
      '（α ' + f(tg.ra, 2) + '° δ ' + f(tg.dec, 2) + '°）' : ''), 'ok');
    redraw();
  }
  function nudge(dRa, dDec) {
    S.ra = (S.ra + dRa + 360) % 360;
    S.dec = Math.max(-89, Math.min(89, S.dec + dDec));
    pushLog(NS.t('微動：') + 'Δα ' + (dRa >= 0 ? '+' : '') + f(dRa, 3) + '°  Δδ ' + (dDec >= 0 ? '+' : '') + f(dDec, 3) + '°');
    redraw();
  }

  function statusTable(i) {
    var sc = S.scope, st = NS.ST[sc.st];
    return kv([
      ['望遠鏡', '<b>' + sc.name + '</b>（' + st.name + '）'],
      ['光学系', '口径 ' + sc.ap + ' mm・焦点距離 ' + sc.fl + ' mm（F' + sc.fr.toFixed(1) + '）・分解能 ' + sc.res.toFixed(1) + '″'],
      ['カメラ', sc.cam + '　' + sc.px],
      ['指向', 'α ' + f(S.ra, 3) + '°　δ ' + (S.dec >= 0 ? '+' : '') + f(S.dec, 3) + '°'],
      ['カメラ回転角', (view.fovRot > 0 ? '+' : '') + f(view.fovRot, 1) + '°　<span class="hint">北から東回り。枠の上のハンドルで回せる</span>'],
      ['追尾残差', f(S.track, 2) + ' ″/min　<span class="hint">目標 2″/min 以内</span>'],
      ['シーイング', f(S.seeing, 2) + ' ″　<span class="hint">全天カメラの星像から推定</span>'],
      ['焦点（HFD）', f(S.focus, 2) + ' ″　<span class="hint">気温からモデルで先に動かす</span>'],
      ['指令往復遅延', Math.round(210 + NS.rng('lat' + Math.floor(NS.now() / 30000))() * 90) + ' ms'],
      ['ハウジング', S.open ? '<b style="color:var(--c-ok)">開（観測中）</b>' : '<b style="color:var(--c-warn)">閉（待機）</b>'],
      ['観測条件', i.items.filter(function (x) { return x.ok; }).length + ' / ' + i.items.length + ' 項目が成立']
    ], 'wide');
  }
  function guideChart() {
    var pts = [], p2 = [];
    for (var k = -120; k <= 0; k++) {
      var r = NS.rng('gd' + S.scope.id + k);
      pts.push([k, r.norm(0, S.track * 0.42)]);
      p2.push([k, r.norm(0, S.track * 0.38)]);
    }
    return el('div', null, [
      NS.chart.line({ width:420, height:130, series:[
          { pts:pts, color:'var(--c-ok)', width:1.1 }, { pts:p2, color:'var(--c-info)', width:1.1 }],
        yDomain:[-2.4, 2.4], xLabel:'現在からの秒', yLabel:'ガイド誤差 ″',
        rules:[{ y:0, color:'var(--muted)', dash:'3 3' }],
        xFmt:function (v) { return f(v, 0); }, yFmt:function (v) { return f(v, 1); } }),
      NS.chart.legend([['赤経方向', 'var(--c-ok)', 'line'], ['赤緯方向', 'var(--c-info)', 'line']])
    ]);
  }

  /* --- 見出し --- */
  NS.add(root, el('div', { class:'page-h' }, [
    el('h2', { text:'リモート望遠鏡　ガンダム望遠鏡・Draco スマート望遠鏡' }),
    el('p', { text:'船橋局のガンダム望遠鏡（口径 400 / 200 mm）と、船橋局・郡山局（工学部）の 2 局に置いた Draco スマート望遠鏡（口径 90 mm・特注ハウジング）を'
      + '遠隔から操作する。観測網が拾った事象へ数十秒で望遠鏡を向けられることが、この画面のねらいである。'
      + '視野に入る恒星はエール輝星星表（BSC5）の実データを接平面投影で描いており、指向を変えれば星の並びもそれに従って変わる。' }),
    el('div', { class:'seg', style:{ marginTop:'10px' } }, NS.SCOPES.map(function (sc) {
      return el('button', { text:sc.short, title:sc.name + '（' + NS.ST[sc.st].name + '）',
        'aria-pressed':sc.id === S.scope.id ? 'true' : 'false', onclick:function (ev) {
          Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
          ev.currentTarget.setAttribute('aria-pressed', 'true');
          S.scope = sc;
          if (sc.modes.indexOf(S.mode) < 0) { S.mode = sc.modes[0]; }
          pushLog(NS.t('望遠鏡を選択：') + sc.name, 'ok');
          redraw();
        } });
    }))
  ]));

  /* --- 実況画面 ＋ 操作盤 --- */
  var tsegRef = null;
  var TSEG = [['現在', null], ['今夜 20:00', 20], ['今夜 23:00', 23], ['今夜 02:00', 2], ['今夜 04:00', 4]];
  var tseg = el('div', { class:'seg' }, TSEG.map(function (v) {
    var pressed = (v[1] === null) ? S.live : (!S.live && v[0] === S.tLabel);
    return el('button', { text:v[0], 'aria-pressed':pressed ? 'true' : 'false', onclick:function (ev) {
      Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.currentTarget.setAttribute('aria-pressed', 'true');
      if (v[1] === null) { S.t = NS.now(); S.live = true; S.tLabel = '現在'; }
      else { S.t = NS.tonightAt(v[1]); S.live = false; S.tLabel = v[0]; }
      pushLog(NS.t('表示時刻を変更：') + NS.fmtJST(S.t, { sec:false }), 'cmd');
      redraw();
    } });
  }));
  tsegRef = tseg;
  var viewPanel = panel('リアルタイム画面', {
    note:'恒星は BSC5、メシエ天体は DSS2 の実写、月面は LRO の実データ。それより暗い星とノイズはデモ用の模擬。赤い破線の枠（観測視野）はドラッグで移動、枠の上のハンドルで回転できる' }, [
    el('div', { class:'specbar' }, [
      el('span', { class:'lbl', text:'表示時刻' }), tseg,
      el('div', { class:'spacer' }),
      el('button', { class:'iconbtn', text:'露光 開始／停止', onclick:function (ev) {
        S.running = !S.running;
        ev.currentTarget.style.opacity = S.running ? 1 : 0.5;
        pushLog(S.running ? NS.t('露光を開始した') : NS.t('露光を停止した'), S.running ? 'ok' : 'warn');
        redraw();
      } }),
      el('button', { class:'iconbtn', text:'ハウジング 開／閉', onclick:function () {
        S.domeOpen = S.domeOpen === false ? true : false;
        pushLog(S.domeOpen === false ? NS.t('ハウジングを閉じた') : NS.t('ハウジングを開いた'),
                S.domeOpen === false ? 'warn' : 'ok');
        redraw();
      } })
    ]),
    view.node,
    el('div', { class:'src', text:'月面は、NASA の月周回衛星 LRO の実データ（LROC 広角カメラの全球モザイクと '
      + 'LOLA レーザー高度計の地形）を、月面座標から手前半球へ正射影して描いている。'
      + '太陽光の当たり方は Lommel–Seeliger の反射則 I ∝ μ₀/(μ₀+μ) で求め、地形の斜面ぶん入射角を動かすので、'
      + '明暗境界に近いほどクレーターの影が長く伸びる。夜側は地球照で、海がうっすら見える明るさに合わせてある'
      + '（月面衝突閃光を狙う露出）。地図は NASA/GSFC Scientific Visualization Studio「CGI Moon Kit」による'
      + '（パブリックドメイン）。'
      + 'メシエ天体は NASA/GSFC SkyView から取り出した Digitized Sky Survey 2（DSS2）の実写で、'
      + 'IR・Red・Blue の 3 板を背景を平坦化して合成し、視野中心と画角にあわせて貼っている。'
      + 'DSS は Space Telescope Science Institute が米国政府交付金 NAG W-2166 により作成したもので、'
      + '原板はパロマー天文台オシュキン・シュミット望遠鏡と英国シュミット望遠鏡による。' })]);

  /* 操作盤 */
  var padBtn = function (label, dRa, dDec) {
    return el('button', { class:'padb', text:label, onclick:function () {
      var stp = S.step || 0.05;
      if (S.target.kind === 'moon') {              /* 月モードでは視野の枠を動かす */
        view.fovOff.x -= dRa * stp;                /* 東（左）へ動かすと枠は左へ */
        view.fovOff.y -= dDec * stp;
        pushLog(NS.t('観測視野を移動：月の中心から ') + f(view.fovOff.x * 60, 1) + '′ / '
                + f(-view.fovOff.y * 60, 1) + '′', 'cmd');
        redraw();
      } else nudge(dRa * stp, dDec * stp);
    } });
  };
  var stepSeg = el('div', { class:'seg' }, [['0.01°', 0.01], ['0.05°', 0.05], ['0.2°', 0.2], ['1°', 1]].map(function (v, i) {
    return el('button', { text:v[0], 'aria-pressed':i === 1 ? 'true' : 'false', onclick:function (ev) {
      Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
      ev.currentTarget.setAttribute('aria-pressed', 'true');
      S.step = v[1];
    } });
  }));
  var pad = el('div', { class:'slewpad' }, [
    el('span'), padBtn('▲', 0, 1), el('span'),
    padBtn('◀', 1, 0), el('span', { class:'padc', text:'指向' }), padBtn('▶', -1, 0),
    el('span'), padBtn('▼', 0, -1), el('span')
  ]);
  var numRow = function (label, opts2, cur, set) {
    return el('div', { class:'ctlrow' }, [
      el('span', { class:'cl-l', text:label }),
      el('div', { class:'seg' }, opts2.map(function (v) {
        return el('button', { text:String(v[0]), 'aria-pressed':v[1] === cur() ? 'true' : 'false', onclick:function (ev) {
          Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
          ev.currentTarget.setAttribute('aria-pressed', 'true');
          set(v[1]); redraw();
        } });
      }))
    ]);
  };
  var ctl = panel('リモート操作', { note:'船橋校舎の観測室と、各学部・付属校の端末から同じ画面で操作する' }, [
    el('div', { class:'ctlrow' }, [
      el('span', { class:'cl-l', text:'目標' }),
      el('select', { class:'sel', onchange:function (ev) {
        setTarget(NS.SCOPE_TARGETS[ev.currentTarget.selectedIndex]);
      } }, NS.SCOPE_TARGETS.map(function (tg) {
        return el('option', { text:tg.name + '（' + NS.SCOPE_MODES[tg.mode].name + '）' });
      }))
    ]),
    el('div', { class:'ctlrow' }, [el('span', { class:'cl-l', text:'微動ステップ' }), stepSeg]),
    pad,
    numRow('露出 (s)', [['1', 1], ['10', 10], ['60', 60], ['300', 300]], function () { return S.exp; }, function (v) { S.exp = v; pushLog(NS.t('露出を ') + v + NS.t(' 秒に設定'), 'cmd'); }),
    numRow('ゲイン', [['100', 100], ['180', 180], ['300', 300], ['500', 500]], function () { return S.gain; }, function (v) { S.gain = v; pushLog(NS.t('ゲインを ') + v + NS.t(' に設定'), 'cmd'); }),
    numRow('積算', [['1', 1], ['30', 30], ['120', 120], ['600', 600]], function () { return S.frames; }, function (v) { S.frames = v; pushLog(NS.t('積算枚数を ') + v + NS.t(' に設定'), 'cmd'); }),
    el('div', { class:'ctlrow' }, [
      el('span', { class:'cl-l', text:'カメラ回転角' }),
      el('div', { class:'seg' }, [['−15°', -15], ['−5°', -5], ['0°', 0], ['＋5°', 5], ['＋15°', 15]].map(function (v) {
        return el('button', { text:v[0], onclick:function () {
          view.fovRot = v[1] === 0 ? 0 : Math.round(((view.fovRot + v[1] + 540) % 360 - 180) * 10) / 10;
          pushLog(NS.t('カメラ回転角を変更：') + (view.fovRot > 0 ? '+' : '') + f(view.fovRot, 1) + '°', 'cmd');
          redraw();
        } });
      }))
    ]),
    numRow('ビニング', [['1×1', 1], ['2×2', 2]], function () { return S.bin; }, function (v) { S.bin = v; }),
    /* 測光に使うフィルター。g′r′i′ は SDSS 系、BV・VR は同時 2 色測光に使う組み合わせ */
    numRow('フィルター', [['なし', 'none'], ['g\u2032', 'g\u2032'], ['r\u2032', 'r\u2032'], ['i\u2032', 'i\u2032'],
                     ['BV', 'BV'], ['VR', 'VR']],
      function () { return S.filter; },
      function (v) { S.filter = v; pushLog(NS.t('フィルターを ') + (v === 'none' ? NS.t('なし') : v) + NS.t(' に切り替えた'), 'cmd'); redraw(); }),
    el('div', { class:'split', style:{ marginTop:'8px' } }, [
      el('button', { class:'iconbtn', text:'自動導入（GoTo）', onclick:function () {
        pushLog(NS.t('自動導入を実行：') + S.target.name + NS.t('（所要 18 秒・整定 4 秒）'), 'ok'); redraw(); } }),
      el('button', { class:'iconbtn', text:'オートフォーカス', onclick:function () {
        pushLog(NS.t('オートフォーカス：HFD ') + f(S.focus, 2) + ' ″ → ' + f(S.focus * 0.72, 2) + ' ″', 'ok');
        S.focus *= 0.72; redraw(); } }),
      el('button', { class:'iconbtn', text:'1 枚 取得', onclick:function () {
        pushLog(NS.t('露光を取得：') + S.exp + ' s × 1・gain ' + S.gain + NS.t('（保存しました）'), 'ok'); } }),
      el('button', { class:'iconbtn', text:'視野を戻す', onclick:function () {
        view.fovOff.x = 0; view.fovOff.y = 0; view.fovRot = 0;
        pushLog(NS.t('観測視野の位置と回転を既定へ戻した'), 'ok');
        redraw();
      } })
    ])
  ]);

  NS.add(root, el('div', { class:'grid g-3-2', style:{ marginTop:'14px' } }, [viewPanel, ctl]));

  /* --- 状態・ガイド・ログ --- */
  NS.add(root, el('div', { class:'grid g3', style:{ marginTop:'14px' } }, [
    panel('望遠鏡の状態', { note:'30 秒ごとに更新' }, statBox),
    panel('オートガイドの残差', { note:'直近 2 分。赤経・赤緯それぞれの誤差' }, guideBox),
    panel('操作ログ', { note:'誰がいつ何をしたかを残す。訓練と事後検証に使う' }, [
      logBox,
      el('div', { class:'note', text:'付属校からの操作も同じログに残る。観測の記録が「誰の観測か」を含むことで、'
        + '生徒の探究学習の成果として扱える（G-8 / DT-7）。' })
    ])
  ]));

  /* --- 三段構えの説明 --- */
  NS.add(root, el('div', { style:{ marginTop:'14px' } }, panel('視野の受け渡し', {
    note:'同じ事象を、広さの違う視野で順に受け渡す。数字は ZWO ASI174MM の公称 5.86 µm 角から求めた値' },
    [NS.table(['装置', '視野', '分解能', '役割', '設置'], [
      ['全天カメラ（IMX664 ×2）', '約 95°', '約 6′/px', '空全体を 24 時間見張り、事象を見つける', '全 14 局'],
      ['Draco 広角カメラ', '85.7°', '約 1.6′/px', '流星群の輻射点や天の川を広く押さえる', '船橋・郡山（工学部）の 2 局'],
      ['Draco 望遠', '1.70° × 1.30°', '1.5″', '見つけた事象へ数十秒で向け、測光する', '船橋・郡山（工学部）の 2 局'],
      ['ガンダム望遠鏡 副鏡 200 mm', '1.083° × 0.680°（65.0′ × 40.8′）', '2.01″/px', '月面全体を収める。目標の捕捉にも使う', '船橋'],
      ['ガンダム望遠鏡 主鏡 400 mm', '0.428° × 0.269°（25.7′ × 16.1′）', '0.80″/px', '月面衝突閃光・掩蔽など、深く細かく見る', '船橋']
    ], 'wide'),
    el('div', { class:'note', text:'全天カメラが「どこで何が起きたか」を出し、Draco が「そこを拡大して測る」、'
      + 'ガンダム望遠鏡が「さらに深く押さえる」。この受け渡しを自動化できれば、突発天体への追随が人の判断を待たずに進む。' }),
    el('div', { class:'src', html:'リアルタイム画面の恒星はエール輝星星表（BSC5, 9,096 個）の位置・等級・色指数を接平面投影で描いている。'
      + 'それより暗い星は等級分布 N(&lt;m) &prop; 10^(0.34 m) に従って生成した模擬であり、ノイズ・目標天体・月面衝突閃光の描画も模擬である。'
      + '追尾残差・シーイング・HFD・指令遅延はデモ用の値で、実測ではない。<br>'
      + 'ガンダム望遠鏡による月面衝突閃光の成果は、'
      + '阿部新助・柳澤正久・小野寺圭祐「ふたご座流星群の月面衝突閃光から探る活動小惑星 Phaethon の cm サイズ粒子」'
      + '<i>日本惑星科学会誌 遊星人</i> <b>33</b> (3), 262–269 (2024)　'
      + '<a href="https://doi.org/10.14909/yuseijin.33.3_262" target="_blank" rel="noopener">doi:10.14909/yuseijin.33.3_262</a>　'
      + 'による。Draco の諸元は '
      + '<a href="https://www.dwarflab.com/us/products/draco-smart-telescope" target="_blank" rel="noopener">DWARFLAB 公式</a> による。' })]
  )));

  /* 起動 */
  setTarget(NS.SCOPE_TARGETS[0]);
  pushLog(NS.t('接続しました：') + S.scope.name, 'ok');
  var tick = setInterval(function () { view.draw(S); }, 500);
  var slow = setInterval(redraw, 30000);
  NS.onLeave(function () { clearInterval(tick); clearInterval(slow); });
};

})(NS);
