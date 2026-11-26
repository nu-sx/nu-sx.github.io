#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
spec_planner.py
===============
分光観測プランナー (Spectroscopic Observation Planner)

meteor_spec_designer.py をもとに、Web 版 (meteor_spec_planner.html) と
名称・分子バンド (N2, N2+ を追加) をそろえた版。計算ロジックは同じ。

センサーサイズ・ピクセルサイズ・レンズ焦点距離・F値から視野角を計算し、
対物部に置いた Edmund 透過型グレーティング(溝本数・設計波長)による
0次像・1次スペクトルのセンサー面上の配置、画角内に占める割合、
波長分散、ブレーズ効率などを GUI で対話的に評価する。

必要環境:
    Python 3.8+ / tkinter / numpy / matplotlib

起動方法:
    python spec_planner.py
    python spec_planner.py --selftest   # 計算ロジックの自己検証のみ

作成: 2026-07 (Shinsuke Abe)
ライセンス: MIT
"""

import sys
import math
import argparse

import numpy as np

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------
ARCSEC_PER_RAD = 206264.806

# ---------------------------------------------------------------------------
# 流星スペクトル輝線カタログ
# ---------------------------------------------------------------------------
# 参考資料:
#   - common_meteor_spectra.png : 実験室データ (Fe/Mg/Na/Ca II/Cr/Si II/O/H 他)
#       の波長 [Å] と相対強度。強い同定線に番号付与。
#   - spectrum-lines-identified-in-the-Geminid-spectrum.pdf : ふたご群流星で
#       同定された輝線 (測定nm / 実験室nm / 原子・イオン / 備考)。
#
# 各エントリ: (名称, 波長 nm, 種別グループ, 強度ランク, 既定でON)
#   強度ランク 3 = 非常に強い(very strong), 2 = 強い(strong), 1 = 通常
# GUI の「輝線を選択…」ダイアログで、グループ単位・個別に On/Off できる。
METEOR_LINES = [
    # --- Ca II (H/K, 電離カルシウム。紫端の非常に強い共鳴線) ---
    ("Ca II K", 393.4, "Ca II", 3, True),
    ("Ca II H", 396.8, "Ca II", 3, True),
    # --- Ca I (中性カルシウム) ---
    ("Ca I", 422.7, "Ca I", 2, True),
    ("Ca I", 558.9, "Ca I", 1, False),
    ("Ca I", 615.6, "Ca I", 1, False),
    ("Ca I", 643.9, "Ca I", 1, False),
    # --- Mn I ---
    ("Mn I", 403.1, "Mn I", 1, False),
    # --- Mg I (中性マグネシウム。b 三重線が非常に強い) ---
    ("Mg I", 383.8, "Mg I", 1, False),
    ("Mg I", 457.1, "Mg I", 1, False),
    ("Mg I b1", 516.7, "Mg I", 3, True),
    ("Mg I b2", 517.3, "Mg I", 3, True),
    ("Mg I b4", 518.4, "Mg I", 3, True),
    ("Mg I", 552.8, "Mg I", 1, False),
    # --- Na I (D 線。非常に強い) ---
    ("Na I D2", 589.0, "Na I", 3, True),
    ("Na I D1", 589.6, "Na I", 3, True),
    # --- Cr I (クロム) ---
    ("Cr I", 425.4, "Cr I", 1, False),
    ("Cr I", 427.5, "Cr I", 1, False),
    ("Cr I", 428.9, "Cr I", 1, False),
    ("Cr I", 469.8, "Cr I", 1, False),
    ("Cr I", 520.8, "Cr I", 1, False),
    # --- Si II (電離ケイ素) ---
    ("Si II", 570.6, "Si II", 1, False),
    ("Si II", 634.7, "Si II", 2, False),
    ("Si II", 637.1, "Si II", 2, False),
    # --- Fe I (中性鉄。多数の多重線。流星スペクトルの骨格) ---
    ("Fe I", 383.4, "Fe I", 1, False),
    ("Fe I", 404.6, "Fe I", 2, False),
    ("Fe I", 420.2, "Fe I", 1, False),
    ("Fe I", 427.2, "Fe I", 2, False),
    ("Fe I", 429.4, "Fe I", 2, True),
    ("Fe I", 438.4, "Fe I", 3, True),
    ("Fe I", 440.5, "Fe I", 2, False),
    ("Fe I", 446.2, "Fe I", 2, False),
    ("Fe I", 470.0, "Fe I", 1, False),
    ("Fe I", 488.6, "Fe I", 1, False),
    ("Fe I", 495.8, "Fe I", 1, False),
    ("Fe I", 503.5, "Fe I", 1, False),
    ("Fe I", 511.6, "Fe I", 1, False),
    ("Fe I", 527.0, "Fe I", 2, False),
    ("Fe I", 532.8, "Fe I", 2, False),
    ("Fe I", 537.1, "Fe I", 1, False),
    ("Fe I", 539.7, "Fe I", 1, False),
    ("Fe I", 561.6, "Fe I", 1, False),
    ("Fe I", 573.1, "Fe I", 1, False),
    ("Fe I", 581.6, "Fe I", 1, False),
    ("Fe I", 595.9, "Fe I", 1, False),
    ("Fe I", 625.3, "Fe I", 1, False),
    ("Fe I", 631.8, "Fe I", 1, False),
    ("Fe I", 650.2, "Fe I", 1, False),
    ("Fe I", 659.3, "Fe I", 1, False),
    ("Fe I", 666.3, "Fe I", 1, False),
    ("Fe I", 672.7, "Fe I", 1, False),
    ("Fe I", 743.1, "Fe I", 1, False),
    # --- H (バルマー Hα) ---
    ("Hα", 656.3, "H", 2, True),
    # --- N I (中性窒素。大気起源。流星終端で出現/消失) ---
    ("N I", 745.1, "N I", 1, False),
    ("N I", 868.3, "N I", 1, True),
    # --- O I (中性酸素。近赤外の強い三重線) ---
    ("O I", 777.4, "O I", 3, True),
    ("O I", 844.6, "O I", 2, True),
]

# 種別グループの表示色 (ダイアログの見出し・図中のラベル/ティック)
GROUP_COLORS = {
    "Ca II": "#1f77b4", "Ca I": "#17becf", "Mn I": "#8c564b",
    "Mg I": "#2ca02c", "Na I": "#ff7f0e", "Cr I": "#9467bd",
    "Si II": "#7f7f7f", "Fe I": "#d62728", "H": "#e377c2",
    "N I": "#bcbd22", "O I": "#005f5f",
}

# グループの表示順 (ダイアログでの並び)
GROUP_ORDER = ["Ca II", "Ca I", "Mg I", "Na I", "Fe I", "Cr I",
               "Si II", "Mn I", "H", "N I", "O I"]

# 分子バンド (名称, 短波長端 nm, 長波長端 nm)
# OH (A-X) 紫外 ~309 nm。
# AlO (B-X) 青緑系: Δv=+1 ヘッド 464.8, Δv=0 484.2, Δv=-1 507.9,
#   Δv=-2 533.7 nm (ヘッドから赤側に発達) — 流星・永続痕で顕著。
# TiO γ' (B-X): ヘッド 615.9/619.3 nm, TiO γ (A-X): ヘッド 705.7/712.6/719.9 nm
#   (いずれも赤側に発達)。
# N2+ 第一負帯 (1N, B-X): (0,0) ヘッド 391.4, (0,1) ヘッド 427.8 nm
#   (ヘッドから紫側に発達)。
# N2 第一正帯 (1PG, B-A): Δv=+4 〜 +1 の各シーケンス (赤〜近赤外)。
# 4 要素目はラベルの段 (0=上段, 0.5=下段)
# 5 要素目はブラケットの段 (0=上段, 1=下段)。N2 1PG は TiO と波長が重なるため
#   N2, N2+ は下段に描く。
MOLECULAR_BANDS = [
    ("OH (A-X)", 306.0, 320.0, 0, 0),
    ("AlO (B-X)", 465.0, 534.0, 0.5, 0),
    ("TiO γ'", 615.0, 630.0, 0, 0),
    ("TiO γ", 705.0, 720.0, 0.5, 0),
    ("N₂⁺ 1N (0,0)", 385.0, 391.4, 0, 1),
    ("N₂⁺ 1N (0,1)", 421.0, 427.8, 0.5, 1),
    ("N₂ 1PG Δv=+4", 570.0, 600.0, 0, 1),
    ("N₂ 1PG Δv=+3", 625.0, 688.0, 0.5, 1),
    ("N₂ 1PG Δv=+2", 705.0, 775.0, 0, 1),
    ("N₂ 1PG Δv=+1", 854.0, 891.0, 0.5, 1),
]

# ---------------------------------------------------------------------------
# プリセット
# ---------------------------------------------------------------------------
# センサー: 名称 -> (画素サイズ um, 横画素数, 縦画素数)
SENSOR_PRESETS = {
    "ZWO ASI6200MM Pro (IMX455, フルサイズ)": (3.76, 9576, 6388),
    "ZWO ASI2600MM Pro (IMX571, APS-C)":      (3.76, 6248, 4176),
    "ZWO ASI1600MM (4/3)":                    (3.80, 4656, 3520),
    "ZWO ASI294MM Pro (IMX492, 4/3)":         (4.63, 4144, 2822),
    "ZWO ASI174MM (IMX174, 1/1.2\")":         (5.86, 1936, 1216),
    "ZWO ASI290MM (IMX290, 1/2.8\")":         (2.90, 1936, 1096),
    "ZWO ASI585MM (IMX585, 1/1.2\")":         (2.90, 3840, 2160),
    "Watec 902H2 Ultimate (1/2\" CCD)":       (8.40,  752,  582),
    "Sony α7S (フルサイズ)":                   (8.40, 4240, 2832),
    "カスタム (手動入力)":                      None,
}

# レンズ: 名称 -> (焦点距離 mm, F値)
LENS_PRESETS = {
    "広角 6 mm F1.2 (CCTV)":   (6.0, 1.2),
    "広角 8 mm F1.4 (CCTV)":   (8.0, 1.4),
    "12 mm F1.2":              (12.0, 1.2),
    "16 mm F1.4":              (16.0, 1.4),
    "25 mm F1.4":              (25.0, 1.4),
    "35 mm F1.4":              (35.0, 1.4),
    "50 mm F1.2":              (50.0, 1.2),
    "85 mm F1.4":              (85.0, 1.4),
    "135 mm F2.0":             (135.0, 2.0),
    "カスタム (手動入力)":       None,
}

# グレーティング: 名称 -> (溝本数 gr/mm, 設計(ブレーズ)波長 nm)
# Edmund Optics 透過型グレーティング・ビームスプリッタ (#46-067〜#46-074) は
# 設計波長 632.8 nm。ブレーズドタイプ (300/600/1200 gr/mm, 50×50 mm 角:
# #49-583 / #49-584 / #49-586) の設計波長はブレーズ角と屈折率 n=1.52 (B270)
# からの推定値 (編集可)。Star Analyser (Paton Hawksley) は参考として収録。
GRATING_PRESETS = {
    "Edmund #46-067/068  70 本/mm (λd=632.8 nm)":       (70.0, 632.8),
    "Edmund #46-069/070  80 本/mm (λd=632.8 nm)":       (80.0, 632.8),
    "Edmund #46-071/072  92 本/mm (λd=632.8 nm)":       (92.0, 632.8),
    "Edmund #46-073/074 110 本/mm (λd=632.8 nm)":       (110.0, 632.8),
    "Edmund #49-583  300 本/mm 17.5° (50×50 mm)":       (300.0, 560.0),
    "Edmund #49-584  600 本/mm 28.7° (50×50 mm)":       (600.0, 520.0),
    "Edmund #49-586 1200 本/mm 36.9° (50×50 mm)":       (1200.0, 405.0),
    "Star Analyser SA-100 (100 本/mm)":                  (100.0, 550.0),
    "Star Analyser SA-200 (200 本/mm)":                  (200.0, 550.0),
    "カスタム (手動入力)":                                None,
}


# ---------------------------------------------------------------------------
# 計算コア (GUI から独立した純関数)
# ---------------------------------------------------------------------------
def grating_angle(m, g_per_mm, lam_nm, alpha_rad=0.0):
    """回折角 θ_m を返す (rad)。伝搬しない場合は None。

    格子方程式 (透過型・入射角 α):
        sin(θ_m) = m * g * λ + sin(α)
    g: 溝本数 [本/mm], λ: 波長 [nm] → g*λ は 1e-6 を掛けて無次元化。
    """
    s = m * g_per_mm * lam_nm * 1.0e-6 + math.sin(alpha_rad)
    if abs(s) >= 1.0:
        return None
    return math.asin(s)


def cutoff_wavelength(m, g_per_mm, alpha_rad=0.0):
    """次数 m が伝搬できる最大波長 (nm)。m=0 のとき None。"""
    if m == 0:
        return None
    lim = (1.0 - math.sin(alpha_rad)) if m > 0 else (1.0 + math.sin(alpha_rad))
    return lim / (abs(m) * g_per_mm * 1.0e-6)


def blaze_efficiency(m, lam_nm, blaze_nm):
    """スカラー近似のブレーズ効率 η_m(λ) = sinc^2(m − λ_b/λ)。

    sinc(x) = sin(πx)/(πx)。1次の効率が λ=λ_b で最大になる簡易モデル。
    絶対値ではなく相対比較用。
    """
    lam = np.asarray(lam_nm, dtype=float)
    x = m - blaze_nm / lam
    return np.sinc(x) ** 2   # np.sinc は sin(πx)/(πx)


def wavelength_to_rgb(lam_nm):
    """波長 (nm) → 近似 RGB (0-1)。可視域外はグレー。"""
    w = float(lam_nm)
    if w < 380 or w > 780:
        return (0.55, 0.55, 0.55)
    if w < 440:
        r, g, b = -(w - 440) / 60.0, 0.0, 1.0
    elif w < 490:
        r, g, b = 0.0, (w - 440) / 50.0, 1.0
    elif w < 510:
        r, g, b = 0.0, 1.0, -(w - 510) / 20.0
    elif w < 580:
        r, g, b = (w - 510) / 70.0, 1.0, 0.0
    elif w < 645:
        r, g, b = 1.0, -(w - 645) / 65.0, 0.0
    else:
        r, g, b = 1.0, 0.0, 0.0
    # 端の減光
    if w < 420:
        f = 0.3 + 0.7 * (w - 380) / 40.0
    elif w > 700:
        f = 0.3 + 0.7 * (780 - w) / 80.0
    else:
        f = 1.0
    return (r * f, g * f, b * f)


def compute_system(params):
    """観測システムの全評価値を計算して辞書で返す。

    params (dict):
        pix_um     : 画素サイズ [µm]
        nx, ny     : 画素数 (横, 縦)
        f_mm       : 焦点距離 [mm]
        fnum       : F値
        g_per_mm   : 溝本数 [本/mm]
        blaze_nm   : 設計(ブレーズ)波長 [nm]
        lam_min_nm : 評価波長範囲下限 [nm]
        lam_max_nm : 評価波長範囲上限 [nm]
        x0_frac    : 0次像の水平位置 (センサー半幅に対する割合, −1〜+1)
    """
    pix_um = params["pix_um"]
    nx, ny = params["nx"], params["ny"]
    f = params["f_mm"]
    fnum = params["fnum"]
    g = params["g_per_mm"]
    blaze = params["blaze_nm"]
    lam1 = params["lam_min_nm"]
    lam2 = params["lam_max_nm"]
    x0_frac = params.get("x0_frac", 0.0)

    r = {}

    # --- 基本光学量 -------------------------------------------------------
    pix_mm = pix_um / 1000.0
    w = nx * pix_mm                      # センサー横幅 [mm]
    h = ny * pix_mm                      # センサー縦幅 [mm]
    d = math.hypot(w, h)                 # 対角 [mm]
    r["sensor_w_mm"], r["sensor_h_mm"], r["sensor_d_mm"] = w, h, d

    fov_h = 2.0 * math.atan(w / (2.0 * f))       # 水平視野 [rad]
    fov_v = 2.0 * math.atan(h / (2.0 * f))
    fov_d = 2.0 * math.atan(d / (2.0 * f))
    r["fov_h_deg"] = math.degrees(fov_h)
    r["fov_v_deg"] = math.degrees(fov_v)
    r["fov_d_deg"] = math.degrees(fov_d)
    r["fov_h_rad"] = fov_h

    r["scale_arcsec"] = ARCSEC_PER_RAD * pix_mm / f      # 中心の画素スケール
    r["aperture_mm"] = f / fnum                           # 有効口径

    # --- 0次像 (視野角 α に対応) -----------------------------------------
    x0 = x0_frac * w / 2.0                # センサー上の 0次位置 [mm]
    alpha = math.atan2(x0, f)             # 0次に対応する入射角 [rad]
    r["x0_mm"], r["alpha_deg"] = x0, math.degrees(alpha)

    # --- 1次スペクトル ----------------------------------------------------
    lam_cut = cutoff_wavelength(1, g, alpha)          # 伝搬限界波長
    lam_hi = min(lam2, lam_cut) if lam_cut else lam2  # 実効上限
    r["lam_cutoff_nm"] = lam_cut
    r["lam_eff_max_nm"] = lam_hi

    th1_lo = grating_angle(1, g, lam1, alpha)
    th1_hi = grating_angle(1, g, lam_hi, alpha)
    r["theta1_min_deg"] = math.degrees(th1_lo) if th1_lo is not None else None
    r["theta1_max_deg"] = math.degrees(th1_hi) if th1_hi is not None else None

    if th1_lo is not None and th1_hi is not None:
        x1_lo = f * math.tan(th1_lo)      # λmin の像位置 [mm]
        x1_hi = f * math.tan(th1_hi)      # λmax の像位置 [mm]
        r["x1_min_mm"], r["x1_max_mm"] = x1_lo, x1_hi
        r["spec_len_mm"] = x1_hi - x1_lo
        r["spec_len_px"] = (x1_hi - x1_lo) / pix_mm

        # 角度スパンと視野に占める割合 -------------------------------------
        span1 = th1_hi - th1_lo                        # 1次のみ
        span_full = th1_hi - alpha                     # 0次〜1次λmax
        r["frac_spec_fov"] = span1 / fov_h
        r["frac_full_fov"] = span_full / fov_h
        r["span_spec_deg"] = math.degrees(span1)
        r["span_full_deg"] = math.degrees(span_full)

        # センサー右端で捉えられる最大波長 ---------------------------------
        th_edge = math.atan2(w / 2.0, f)
        s_edge = math.sin(th_edge) - math.sin(alpha)
        lam_edge = s_edge / (g * 1.0e-6)               # [nm]
        r["lam_at_edge_nm"] = lam_edge
        r["fits_on_sensor"] = (x1_hi <= w / 2.0) and (x1_lo >= -w / 2.0)

        # センサー上に載る波長範囲と、評価帯域のうち捉えられる割合 ----------
        lam_lo_cap = max(lam1, 0.0)
        lam_hi_cap = min(lam_hi, lam_edge)
        r["band_captured_frac"] = max(0.0, (lam_hi_cap - lam_lo_cap)) / (lam2 - lam1)
        r["lam_captured_lo"], r["lam_captured_hi"] = lam_lo_cap, lam_hi_cap
    else:
        r["fits_on_sensor"] = False
        r["frac_spec_fov"] = r["frac_full_fov"] = None
        r["spec_len_mm"] = r["spec_len_px"] = None
        r["band_captured_frac"] = 0.0

    # --- 波長分散 (逆線分散) ---------------------------------------------
    # x = f tanθ, sinθ = gλ+sinα → dx/dλ = f g cosθ^-3 (単位系: mm, nm)
    disp = {}
    for lam in (400.0, 500.0, 600.0, 700.0, 800.0):
        th = grating_angle(1, g, lam, alpha)
        if th is None:
            disp[lam] = None
            continue
        dx_dlam = f * (g * 1.0e-6) / math.cos(th) ** 3   # [mm/nm]
        disp[lam] = pix_mm / dx_dlam                      # [nm/px]
    r["dispersion_nm_per_px"] = disp

    # 2画素サンプリングでの分解能 R = λ/(2Δλ) @550nm
    if disp.get(500.0) and disp.get(600.0):
        dl550 = (disp[500.0] + disp[600.0]) / 2.0
        r["R_2px_550"] = 550.0 / (2.0 * dl550)
    else:
        r["R_2px_550"] = None

    # --- 推奨 0次位置 -----------------------------------------------------
    # 0次と 1次λmax がセンサー中心に対して対称になる x0 を反復で求める
    def spread(x0f):
        a = math.atan2(x0f * w / 2.0, f)
        t = grating_angle(1, g, lam_hi, a)
        if t is None:
            return None
        return x0f * w / 2.0 + f * math.tan(t)   # 左右バランス (0 が理想)

    best = None
    for x0f in np.linspace(-0.95, 0.0, 96):
        s = spread(x0f)
        if s is None:
            continue
        if best is None or abs(s) < abs(best[1]):
            best = (x0f, s)
    r["recommend_x0_frac"] = best[0] if best else None

    # --- ブレーズ効率 (代表値) -------------------------------------------
    r["eff_1st_at_blaze"] = float(blaze_efficiency(1, blaze, blaze))
    r["eff_0th_at_blaze"] = float(blaze_efficiency(0, blaze, blaze))
    lam_c = 0.5 * (lam1 + lam2)
    r["eff_1st_at_center"] = float(blaze_efficiency(1, lam_c, blaze))
    r["eff_0th_at_center"] = float(blaze_efficiency(0, lam_c, blaze))

    return r


# ---------------------------------------------------------------------------
# 自己検証
# ---------------------------------------------------------------------------
def selftest(verbose=True):
    """計算コアの数値検証。既知の解析値と比較する。"""
    ok = True

    def check(name, got, exp, tol):
        nonlocal ok
        good = (abs(got - exp) <= tol)
        ok &= good
        if verbose:
            print(f"  [{'OK' if good else 'NG'}] {name}: got={got:.6g} exp={exp:.6g}")

    # 1) 視野角: 36mm センサー, f=50mm → 2 atan(0.36) = 39.5978°
    p = dict(pix_um=3.76, nx=9576, ny=6388, f_mm=50.0, fnum=1.2,
             g_per_mm=300.0, blaze_nm=560.0,
             lam_min_nm=300.0, lam_max_nm=1000.0, x0_frac=0.0)
    r = compute_system(p)
    w = 9576 * 3.76e-3
    check("sensor_w_mm", r["sensor_w_mm"], w, 1e-9)
    check("fov_h_deg", r["fov_h_deg"], math.degrees(2 * math.atan(w / 100.0)), 1e-9)

    # 2) 画素スケール: 206264.8 * 0.00376 / 50 = 15.511 "/px
    check("scale_arcsec", r["scale_arcsec"], 206264.806 * 0.00376 / 50.0, 1e-6)

    # 3) 回折角: g=300, λ=500nm → sinθ = 0.15 → θ=8.6269°
    th = grating_angle(1, 300.0, 500.0, 0.0)
    check("theta(300gr,500nm)", math.degrees(th), math.degrees(math.asin(0.15)), 1e-9)

    # 4) 伝搬限界: g=1200 → λcut = 1/(1200e-6) = 833.33 nm
    check("cutoff(1200gr)", cutoff_wavelength(1, 1200.0), 833.3333, 0.01)

    # 5) 分散: g=300, f=50, pix=3.76µm, θ≈0 → 0.2507 nm/px
    dl = r["dispersion_nm_per_px"][400.0]
    th400 = math.asin(300e-6 * 400)
    exp = 0.00376 / (50.0 * 300e-6 / math.cos(th400) ** 3)
    check("dispersion@400nm", dl, exp, 1e-9)

    # 6) ブレーズ効率: λ=λb で 1次=1, 0次=sinc(1)^2=0
    check("eff1(blaze)", float(blaze_efficiency(1, 560.0, 560.0)), 1.0, 1e-12)
    check("eff0(blaze)", float(blaze_efficiency(0, 560.0, 560.0)), 0.0, 1e-12)

    # 7) 入射角つき格子方程式: α=5°, g=100, λ=600 → sinθ=0.06+sin5°
    a = math.radians(5.0)
    th = grating_angle(1, 100.0, 600.0, a)
    check("theta(alpha=5deg)", math.sin(th), 0.06 + math.sin(a), 1e-12)

    # 8) 占有率: 対称性チェック (x0=0 で span_full/fov ≈ θ1max/fov_h)
    th_max = grating_angle(1, 300.0, r["lam_eff_max_nm"], 0.0)
    check("frac_full_fov", r["frac_full_fov"], th_max / r["fov_h_rad"], 1e-12)

    print("SELFTEST:", "ALL PASSED" if ok else "FAILURES PRESENT")
    return ok


# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
def setup_japanese_font():
    """matplotlib 用の日本語フォントを探して設定。見つかれば True。"""
    import matplotlib
    from matplotlib import font_manager
    candidates = [
        "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic",
        "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", "IPAexGothic",
        "IPAGothic", "TakaoGothic", "MS Gothic",
    ]
    installed = {f.name for f in font_manager.fontManager.ttflist}
    for name in candidates:
        if name in installed:
            matplotlib.rcParams["font.family"] = name
            matplotlib.rcParams["axes.unicode_minus"] = False
            return True
    matplotlib.rcParams["axes.unicode_minus"] = False
    return False


def run_gui():
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox
    import matplotlib
    matplotlib.use("TkAgg")
    jp_font = setup_japanese_font()
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

    # 日本語フォントが無い環境ではプロット内ラベルを英語にフォールバック
    L = (lambda ja, en: ja if jp_font else en)

    root = tk.Tk()
    root.title("分光観測プランナー  (Spectroscopic Observation Planner)")
    root.geometry("1420x860")

    # ---------------- 左: 入力パネル (縦スクロール可能) ----------------
    # マウスホイール処理 (Windows/macOS の <MouseWheel>, Linux の Button-4/5)。
    # 対象ウィジェット部分木すべてに直接バインドし、return "break" で
    # 他キャンバス (輝線選択ダイアログ) への二重スクロールを防ぐ。
    def _wheel_handler(target_canvas):
        def h(e):
            num = getattr(e, "num", 0)
            if num == 4:
                target_canvas.yview_scroll(-1, "units")
            elif num == 5:
                target_canvas.yview_scroll(1, "units")
            else:
                target_canvas.yview_scroll(-1 if e.delta > 0 else 1, "units")
            return "break"
        return h

    def _bind_wheel_tree(widget, handler):
        widget.bind("<MouseWheel>", handler, add="+")
        widget.bind("<Button-4>", handler, add="+")
        widget.bind("<Button-5>", handler, add="+")
        for ch in widget.winfo_children():
            _bind_wheel_tree(ch, handler)

    left_outer = ttk.Frame(root)
    left_outer.pack(side=tk.LEFT, fill=tk.Y)
    left_canvas = tk.Canvas(left_outer, borderwidth=0, highlightthickness=0,
                            width=400)
    left_sb = ttk.Scrollbar(left_outer, orient="vertical",
                            command=left_canvas.yview)
    left_canvas.configure(yscrollcommand=left_sb.set)
    left_sb.pack(side=tk.RIGHT, fill=tk.Y)
    left_canvas.pack(side=tk.LEFT, fill=tk.Y, expand=False)

    left = ttk.Frame(left_canvas, padding=8)
    _left_win = left_canvas.create_window((0, 0), window=left, anchor="nw")

    def _on_left_config(_e=None):
        # スクロール範囲を内容に合わせ、キャンバス幅も内容の自然幅へ揃える
        left_canvas.configure(scrollregion=left_canvas.bbox("all"),
                              width=left.winfo_reqwidth())
    left.bind("<Configure>", _on_left_config)

    vars_ = {}
    scales = {}                      # key -> ttk.Scale (プリセット反映用)
    _sync = {"busy": False}          # 入力欄⇔スライダーの相互更新ガード

    def add_param(parent, row, label, key, default, lo, hi, step,
                  is_int=False, width=7):
        """ラベル + 数値入力欄 + スライダー を 1 行に配置。

        入力欄とスライダーは双方向同期する。スライダー操作で入力欄が更新され、
        入力欄への直接入力・プリセット選択でスライダー位置が追従する。
        """
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=1)
        v = tk.StringVar(value=str(default))
        vars_[key] = v
        e = ttk.Entry(parent, textvariable=v, width=width)
        e.grid(row=row, column=1, sticky="we", pady=1)
        sc = ttk.Scale(parent, from_=lo, to=hi, value=float(default), length=120)
        sc.grid(row=row, column=2, sticky="we", padx=(6, 0), pady=1)
        scales[key] = sc
        parent.columnconfigure(2, weight=1)

        def on_scale(val):
            if _sync["busy"]:
                return
            _sync["busy"] = True
            try:
                f = float(val)
                if is_int:
                    v.set(str(int(round(f))))
                else:
                    f = round(f / step) * step
                    v.set(f"{f:g}")
            finally:
                _sync["busy"] = False
            update()
        sc.configure(command=on_scale)

        def on_var(*_):
            if _sync["busy"]:
                return
            try:
                f = float(v.get())
            except ValueError:
                return
            _sync["busy"] = True
            try:
                sc.set(min(max(f, lo), hi))
            finally:
                _sync["busy"] = False
        v.trace_add("write", on_var)
        return e

    # --- センサー ---
    fs = ttk.LabelFrame(left, text=" センサー ", padding=6)
    fs.pack(fill=tk.X, pady=3)
    sensor_cb = ttk.Combobox(fs, values=list(SENSOR_PRESETS.keys()),
                             state="readonly", width=34)
    sensor_cb.set("ZWO ASI294MM Pro (IMX492, 4/3)")
    sensor_cb.grid(row=0, column=0, columnspan=3, sticky="we", pady=2)
    add_param(fs, 1, "画素サイズ [µm]", "pix_um", 4.63, 1.0, 12.0, 0.01)
    add_param(fs, 2, "横画素数", "nx", 4144, 512, 12000, 1, is_int=True)
    add_param(fs, 3, "縦画素数", "ny", 2822, 512, 9000, 1, is_int=True)
    sensor_size_lbl = ttk.Label(fs, text="", foreground="#555")
    sensor_size_lbl.grid(row=4, column=0, columnspan=3, sticky="w")

    def on_sensor(_=None):
        v = SENSOR_PRESETS.get(sensor_cb.get())
        if v:
            vars_["pix_um"].set(v[0]); vars_["nx"].set(v[1]); vars_["ny"].set(v[2])
        update()
    sensor_cb.bind("<<ComboboxSelected>>", on_sensor)

    # --- レンズ ---
    fl = ttk.LabelFrame(left, text=" レンズ ", padding=6)
    fl.pack(fill=tk.X, pady=3)
    lens_cb = ttk.Combobox(fl, values=list(LENS_PRESETS.keys()),
                           state="readonly", width=34)
    lens_cb.set("50 mm F1.2")
    lens_cb.grid(row=0, column=0, columnspan=3, sticky="we", pady=2)
    add_param(fl, 1, "焦点距離 [mm]", "f_mm", 50.0, 2.0, 300.0, 0.5)
    add_param(fl, 2, "F値", "fnum", 1.2, 0.8, 22.0, 0.1)

    def on_lens(_=None):
        v = LENS_PRESETS.get(lens_cb.get())
        if v:
            vars_["f_mm"].set(v[0]); vars_["fnum"].set(v[1])
        update()
    lens_cb.bind("<<ComboboxSelected>>", on_lens)

    # --- グレーティング ---
    fg = ttk.LabelFrame(left, text=" 透過型グレーティング (対物) ", padding=6)
    fg.pack(fill=tk.X, pady=3)
    grat_cb = ttk.Combobox(fg, values=list(GRATING_PRESETS.keys()),
                           state="readonly", width=34)
    grat_cb.set("Edmund #49-583  300 本/mm 17.5° (50×50 mm)")
    grat_cb.grid(row=0, column=0, columnspan=3, sticky="we", pady=2)
    add_param(fg, 1, "溝本数 [本/mm]", "g_per_mm", 300.0, 10, 1200, 1)
    add_param(fg, 2, "設計(ブレーズ)波長 [nm]", "blaze_nm", 560.0, 300, 1000, 1)
    add_param(fg, 3, "評価波長 下限 [nm]", "lam_min_nm", 300.0, 200, 900, 5)
    add_param(fg, 4, "評価波長 上限 [nm]", "lam_max_nm", 1000.0, 400, 1200, 5)

    def on_grat(_=None):
        v = GRATING_PRESETS.get(grat_cb.get())
        if v:
            vars_["g_per_mm"].set(v[0]); vars_["blaze_nm"].set(v[1])
        update()
    grat_cb.bind("<<ComboboxSelected>>", on_grat)

    # --- 配置 ---
    fp = ttk.LabelFrame(left, text=" 配置 (0次像の水平位置) ", padding=6)
    fp.pack(fill=tk.X, pady=3)
    x0_var = tk.DoubleVar(value=0.0)
    x0_lbl = ttk.Label(fp, text="0次位置: 中心 (0.00)")
    x0_lbl.pack(anchor="w")
    x0_scale = ttk.Scale(fp, from_=-0.95, to=0.95, variable=x0_var,
                         command=lambda _v: update())
    x0_scale.pack(fill=tk.X)
    ttk.Label(fp, text="−1=左端, 0=中心, +1=右端 (分散は右向き)",
              foreground="#555").pack(anchor="w")

    def apply_recommended():
        rr = last_result.get("r")
        if rr and rr.get("recommend_x0_frac") is not None:
            x0_var.set(rr["recommend_x0_frac"])
            update()
    ttk.Button(fp, text="推奨位置に設定 (0次+1次を中央配置)",
               command=apply_recommended).pack(fill=tk.X, pady=2)

    # --- 流星輝線の表示選択 ---
    fline = ttk.LabelFrame(left, text=" 流星スペクトル輝線 (On/Off) ", padding=6)
    fline.pack(fill=tk.X, pady=3)
    line_count_lbl = ttk.Label(fline, text="", foreground="#555")
    line_count_lbl.pack(anchor="w")
    ttk.Button(fline, text="輝線を選択… (種別・個別に On/Off)",
               command=lambda: open_line_selector()).pack(fill=tk.X, pady=2)

    # --- ボタン ---
    fb = ttk.Frame(left)
    fb.pack(fill=tk.X, pady=4)
    ttk.Button(fb, text="計算 / 更新", command=lambda: update()).pack(
        side=tk.LEFT, expand=True, fill=tk.X, padx=1)
    ttk.Button(fb, text="レポート保存", command=lambda: save_report()).pack(
        side=tk.LEFT, expand=True, fill=tk.X, padx=1)
    ttk.Button(fb, text="図を保存", command=lambda: save_figure()).pack(
        side=tk.LEFT, expand=True, fill=tk.X, padx=1)

    # --- 結果テキスト ---
    fr = ttk.LabelFrame(left, text=" 計算結果 ", padding=4)
    fr.pack(fill=tk.BOTH, expand=True, pady=3)
    txt = tk.Text(fr, width=46, height=24, font=("Courier", 11))
    txt.pack(fill=tk.BOTH, expand=True)

    # ---------------- 右: 図 ----------------
    fig = Figure(figsize=(9.2, 8.4), dpi=100)
    ax1 = fig.add_subplot(2, 1, 1)   # センサー面レイアウト
    ax2 = fig.add_subplot(2, 1, 2)   # ブレーズ効率
    fig.subplots_adjust(hspace=0.32, left=0.08, right=0.97, top=0.95, bottom=0.07)
    canvas = FigureCanvasTkAgg(fig, master=root)
    canvas.get_tk_widget().pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

    last_result = {}

    # ------------------------------------------------------------------
    # 輝線 / 分子バンドの表示 On/Off 状態
    # ------------------------------------------------------------------
    # line_vars[i]  : METEOR_LINES[i]     の表示可否 (BooleanVar)
    # band_vars[j]  : MOLECULAR_BANDS[j]  の表示可否 (BooleanVar)
    line_vars = {i: tk.BooleanVar(value=bool(e[4]))
                 for i, e in enumerate(METEOR_LINES)}
    band_vars = {j: tk.BooleanVar(value=True)
                 for j in range(len(MOLECULAR_BANDS))}
    selector_state = {"win": None}

    def enabled_line_count():
        return (sum(1 for v in line_vars.values() if v.get())
                + sum(1 for v in band_vars.values() if v.get()))

    def open_line_selector():
        """流星輝線・分子バンドを個別/種別に On/Off するダイアログ。"""
        win = selector_state.get("win")
        if win is not None and win.winfo_exists():
            win.deiconify(); win.lift(); win.focus_force()
            return
        win = tk.Toplevel(root)
        selector_state["win"] = win
        win.title("流星スペクトル輝線の選択 (On/Off)")
        win.geometry("360x620")

        # 上部: 一括操作ボタン
        top = ttk.Frame(win, padding=6)
        top.pack(fill=tk.X)

        def set_all(on):
            for v in line_vars.values():
                v.set(on)
            for v in band_vars.values():
                v.set(on)
            update()

        def set_strong_only():
            # 強度ランク 3 (非常に強い) のみを表示
            for i, e in enumerate(METEOR_LINES):
                line_vars[i].set(e[3] >= 3)
            for v in band_vars.values():
                v.set(False)
            update()

        def set_default():
            for i, e in enumerate(METEOR_LINES):
                line_vars[i].set(bool(e[4]))
            for v in band_vars.values():
                v.set(True)
            update()

        ttk.Button(top, text="全選択", width=8,
                   command=lambda: set_all(True)).grid(row=0, column=0, padx=2)
        ttk.Button(top, text="全解除", width=8,
                   command=lambda: set_all(False)).grid(row=0, column=1, padx=2)
        ttk.Button(top, text="強線のみ", width=8,
                   command=set_strong_only).grid(row=0, column=2, padx=2)
        ttk.Button(top, text="既定に戻す", width=10,
                   command=set_default).grid(row=0, column=3, padx=2)
        ttk.Label(win, text="■=非常に強い  ●=強い  ・=通常 (強度は参考資料に基づく)",
                  foreground="#555", padding=(8, 0)).pack(anchor="w")

        # 中央: スクロール可能なチェックボックス領域
        mid = ttk.Frame(win)
        mid.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)
        cv = tk.Canvas(mid, borderwidth=0, highlightthickness=0)
        sb = ttk.Scrollbar(mid, orient="vertical", command=cv.yview)
        inner = ttk.Frame(cv)
        inner.bind("<Configure>",
                   lambda _e: cv.configure(scrollregion=cv.bbox("all")))
        cv.create_window((0, 0), window=inner, anchor="nw")
        cv.configure(yscrollcommand=sb.set)
        cv.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)

        rank_mark = {3: "■", 2: "●", 1: "・"}

        # 種別グループごとに見出し + 一括トグル + 個別チェック
        by_group = {}
        for i, e in enumerate(METEOR_LINES):
            by_group.setdefault(e[2], []).append(i)
        ordered = [g for g in GROUP_ORDER if g in by_group]
        ordered += [g for g in by_group if g not in GROUP_ORDER]

        for grp in ordered:
            idxs = by_group[grp]
            col = GROUP_COLORS.get(grp, "#333")
            hdr = ttk.Frame(inner)
            hdr.pack(fill=tk.X, pady=(6, 0))
            tk.Label(hdr, text=f"● {grp}", fg=col,
                     font=("", 10, "bold")).pack(side=tk.LEFT)

            def _toggle_group(gidx=idxs):
                # グループ内が全ONなら全OFF、そうでなければ全ON
                allon = all(line_vars[k].get() for k in gidx)
                for k in gidx:
                    line_vars[k].set(not allon)
                update()
            ttk.Button(hdr, text="種別ごと切替", width=12,
                       command=_toggle_group).pack(side=tk.RIGHT)

            for k in idxs:
                name, lam, _grp, rank, _def = METEOR_LINES[k]
                cb = ttk.Checkbutton(
                    inner,
                    text=f"  {rank_mark[rank]} {name}  {lam:.1f} nm",
                    variable=line_vars[k], command=update)
                cb.pack(anchor="w")

        # 分子バンド
        hdr = ttk.Frame(inner)
        hdr.pack(fill=tk.X, pady=(10, 0))
        tk.Label(hdr, text="● 分子バンド (OH/AlO/TiO)", fg="#7B2FBE",
                 font=("", 10, "bold")).pack(side=tk.LEFT)
        for j, (name, la, lb, _row, _lvl) in enumerate(MOLECULAR_BANDS):
            ttk.Checkbutton(
                inner, text=f"  {name}  {la:.0f}–{lb:.0f} nm",
                variable=band_vars[j], command=update).pack(anchor="w")

        # 生成済みの全ウィジェットにホイールスクロールをバインド
        wheel = _wheel_handler(cv)
        cv.bind("<MouseWheel>", wheel, add="+")
        cv.bind("<Button-4>", wheel, add="+")
        cv.bind("<Button-5>", wheel, add="+")
        _bind_wheel_tree(inner, wheel)

        ttk.Button(win, text="閉じる", command=win.withdraw).pack(pady=6)

    # ------------------------------------------------------------------
    def read_params():
        try:
            p = dict(
                pix_um=float(vars_["pix_um"].get()),
                nx=int(float(vars_["nx"].get())),
                ny=int(float(vars_["ny"].get())),
                f_mm=float(vars_["f_mm"].get()),
                fnum=float(vars_["fnum"].get()),
                g_per_mm=float(vars_["g_per_mm"].get()),
                blaze_nm=float(vars_["blaze_nm"].get()),
                lam_min_nm=float(vars_["lam_min_nm"].get()),
                lam_max_nm=float(vars_["lam_max_nm"].get()),
                x0_frac=float(x0_var.get()),
            )
        except ValueError:
            return None
        if (p["pix_um"] <= 0 or p["nx"] <= 0 or p["ny"] <= 0 or p["f_mm"] <= 0
                or p["fnum"] <= 0 or p["g_per_mm"] <= 0
                or p["lam_min_nm"] >= p["lam_max_nm"]):
            return None
        return p

    def fmt(v, nd=2, unit=""):
        if v is None:
            return "—"
        return f"{v:.{nd}f}{unit}"

    def build_report(p, r):
        lines = []
        A = lines.append
        A("=== 基本光学量 ===")
        A(f"センサー: {r['sensor_w_mm']:.2f} × {r['sensor_h_mm']:.2f} mm "
          f"({p['nx']}×{p['ny']}px, {p['pix_um']}µm)")
        A(f"視野角  水平: {r['fov_h_deg']:.2f}°  垂直: {r['fov_v_deg']:.2f}°")
        A(f"        対角: {r['fov_d_deg']:.2f}°")
        A(f"画素スケール: {r['scale_arcsec']:.2f} 秒角/px "
          f"({r['scale_arcsec']/60:.3f} 分角/px)")
        A(f"有効口径: {r['aperture_mm']:.1f} mm (f={p['f_mm']}mm, F{p['fnum']})")
        A("")
        A("=== 1次スペクトル (対物グレーティング) ===")
        A(f"0次像位置: {r['x0_mm']:+.2f} mm (視野角 {r['alpha_deg']:+.2f}°)")
        if r.get("lam_cutoff_nm"):
            A(f"伝搬限界波長: {r['lam_cutoff_nm']:.0f} nm"
              + ("  ← 上限をこれ以上は回折不可" if r['lam_cutoff_nm'] < p['lam_max_nm'] else ""))
        A(f"回折角: {fmt(r['theta1_min_deg'])}° (λ{p['lam_min_nm']:.0f}) 〜 "
          f"{fmt(r['theta1_max_deg'])}° (λ{r['lam_eff_max_nm']:.0f})")
        if r["spec_len_mm"] is not None:
            A(f"像位置: {r['x1_min_mm']:+.2f} 〜 {r['x1_max_mm']:+.2f} mm")
            A(f"スペクトル長: {r['spec_len_mm']:.2f} mm = {r['spec_len_px']:.0f} px")
        A("")
        A("=== 画角内の占有割合 ===")
        if r["frac_spec_fov"] is not None:
            A(f"1次スペクトル角度スパン: {r['span_spec_deg']:.2f}° "
              f"→ 水平視野の {100*r['frac_spec_fov']:.1f} %")
            A(f"0次〜1次(λmax)全体:     {r['span_full_deg']:.2f}° "
              f"→ 水平視野の {100*r['frac_full_fov']:.1f} %")
            A(f"センサー右端で捉えられる最大波長: {fmt(r['lam_at_edge_nm'], 0)} nm")
            A(f"評価帯域 ({p['lam_min_nm']:.0f}–{p['lam_max_nm']:.0f} nm) の"
              f"捕捉率: {100*r['band_captured_frac']:.1f} %")
            A("収まり判定: " + ("○ 0次+1次ともセンサー内"
                               if r["fits_on_sensor"] else
                               "× 1次の一部がセンサー外"))
            if r.get("recommend_x0_frac") is not None:
                A(f"推奨0次位置: 半幅の {r['recommend_x0_frac']:+.2f} "
                  f"(スライダーで設定可)")
        else:
            A("1次光が伝搬できません (溝本数×波長が大きすぎます)")
        A("")
        A("=== 波長分散 (1次) ===")
        for lam, dl in r["dispersion_nm_per_px"].items():
            A(f"  {lam:.0f} nm: " + (f"{dl:.3f} nm/px" if dl else "伝搬不可"))
        if r["R_2px_550"]:
            A(f"2px サンプリング分解能 R(550nm) ≈ {r['R_2px_550']:.0f}")
        A("")
        A("=== ブレーズ効率 (sinc² 近似) ===")
        A(f"設計波長 {p['blaze_nm']:.0f} nm で 1次: "
          f"{100*r['eff_1st_at_blaze']:.0f} %, 0次: {100*r['eff_0th_at_blaze']:.0f} %")
        lam_c = 0.5 * (p['lam_min_nm'] + p['lam_max_nm'])
        A(f"帯域中心 {lam_c:.0f} nm で 1次: "
          f"{100*r['eff_1st_at_center']:.0f} %, 0次: {100*r['eff_0th_at_center']:.0f} %")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    def draw(p, r):
        w, h = r["sensor_w_mm"], r["sensor_h_mm"]
        f = p["f_mm"]
        alpha = math.radians(r["alpha_deg"])
        g = p["g_per_mm"]

        # --- センサー面レイアウト ---
        ax1.clear()
        ax1.set_title(L("センサー面レイアウト (0次像と回折スペクトル)",
                        "Sensor plane layout (0th order & spectra)"))
        ax1.add_patch(
            __import__("matplotlib.patches", fromlist=["Rectangle"]).Rectangle(
                (-w / 2, -h / 2), w, h, fill=False, ec="black", lw=1.5))

        band_h = 0.10 * h

        xlim_lo = -w / 2 * (1 + 0.12) - 1
        xlim_hi = w / 2 * (1 + 0.12) + 1

        def draw_order(m, y_c, faint=False, label=None, label_side="right"):
            lam_g = np.linspace(p["lam_min_nm"], p["lam_max_nm"], 400)
            xs, cols = [], []
            for lam in lam_g:
                th = grating_angle(m, g, lam, alpha)
                if th is None:
                    continue
                x = f * math.tan(th)
                if abs(math.degrees(th)) > 80:
                    continue
                xs.append(x)
                c = wavelength_to_rgb(lam)
                cols.append(tuple(0.35 + 0.65 * ci for ci in c) if faint else c)
            if len(xs) < 2:
                return
            img = np.array(cols).reshape(1, -1, 3)
            ax1.imshow(img, extent=(xs[0], xs[-1], y_c - band_h / 2,
                                    y_c + band_h / 2),
                       aspect="auto", zorder=2,
                       alpha=0.45 if faint else 1.0)
            if label:
                xlo, xhi = min(xs), max(xs)
                if label_side == "right":
                    xl, ha = min(xhi, xlim_hi - 0.02 * w), "right"
                else:
                    xl, ha = max(xlo, xlim_lo + 0.02 * w), "left"
                ax1.annotate(label, (xl, y_c + band_h * 0.62),
                             ha=ha, va="bottom", fontsize=8.5,
                             color="#333333", zorder=5,
                             bbox=dict(fc="white", ec="none", alpha=0.65,
                                       pad=0.8))

        # 1次 (メイン)
        draw_order(1, 0.0, label=L("1次光", "1st order"), label_side="right")
        # −1次, 2次 (参考: 薄く)
        draw_order(-1, 0.0, faint=True,
                   label=L("−1次光", "-1st order"), label_side="left")
        draw_order(2, -0.36 * h, faint=True,
                   label=L("2次光", "2nd order"), label_side="left")

        # 0次像
        ax1.plot([r["x0_mm"]], [0.0], marker="*", ms=16, color="white",
                 mec="black", zorder=5)
        ax1.annotate(L("0次(流星像)", "0th (meteor)"),
                     (r["x0_mm"], 0.0), textcoords="offset points",
                     xytext=(0, 14), ha="center", fontsize=9)

        # 選択された主要輝線マーカー (種別ごとに色分け)
        # ラベルは x 位置順に数段へ振り分けて重なりを緩和
        vis = []
        for i, (name, lam, grp, _rank, _def) in enumerate(METEOR_LINES):
            if not line_vars[i].get():
                continue
            if not (p["lam_min_nm"] <= lam <= p["lam_max_nm"]):
                continue
            th = grating_angle(1, g, lam, alpha)
            if th is None:
                continue
            x = f * math.tan(th)
            if abs(x) > w / 2 * 1.35:
                continue
            vis.append((x, name, lam, grp))
        vis.sort(key=lambda t: t[0])
        for k, (x, name, lam, grp) in enumerate(vis):
            lift = 0.55 * (k % 3)          # 0, 0.55, 1.10 の 3 段
            col = GROUP_COLORS.get(grp, "#111")
            ax1.plot([x, x], [-band_h * 0.9, band_h * (0.9 + lift)],
                     color=col, lw=0.7, zorder=4)
            ax1.annotate(f"{name}\n{lam:.0f}", (x, band_h * (0.95 + lift)),
                         ha="center", va="bottom", fontsize=7.0,
                         color=col, zorder=4)

        # 紫外〜近紫外の分子バンド (OH, N2+) を紫のブラケットで表示
        # ラベルは重なり防止のため 2 段に振り分ける
        for i, (name, lam_a, lam_b, row, lvl) in enumerate(MOLECULAR_BANDS):
            y_band = -band_h * (1.15 + 1.1 * lvl)
            if not band_vars[i].get():
                continue
            la = max(lam_a, p["lam_min_nm"])
            lb = min(lam_b, p["lam_max_nm"])
            if la >= lb:
                continue
            tha = grating_angle(1, g, la, alpha)
            thb = grating_angle(1, g, lb, alpha)
            if tha is None or thb is None:
                continue
            xa, xb = f * math.tan(tha), f * math.tan(thb)
            if xa > w / 2 * 1.35 or xb < -w / 2 * 1.35:
                continue
            col = "#7B2FBE"
            ax1.plot([xa, xb], [y_band, y_band], color=col, lw=2.0, zorder=4,
                     solid_capstyle="butt")
            for xe in (xa, xb):
                ax1.plot([xe, xe], [y_band - band_h * 0.18,
                                    y_band + band_h * 0.18],
                         color=col, lw=1.2, zorder=4)
            y_txt = y_band - band_h * (0.30 + (0.45 if lvl else 0.65) * row)
            # ⁺ は日本語フォントに字形がないことがあるので数式表記で描く
            label = (name.split()[0].replace("₂⁺", "$_2^+$")
                     .replace("₂", "$_2$"))
            ax1.annotate(label,
                         ((xa + xb) / 2, y_txt),
                         ha="center", va="top", fontsize=7.5,
                         color=col, zorder=4)

        margin = 0.12
        ax1.set_xlim(-w / 2 * (1 + margin) - 1, w / 2 * (1 + margin) + 1)
        ax1.set_ylim(-h / 2 * (1 + margin), h / 2 * (1 + margin))
        ax1.set_xlabel(L("センサー水平位置 [mm]", "sensor x [mm]"))
        ax1.set_ylabel(L("垂直位置 [mm]", "sensor y [mm]"))
        ax1.set_aspect("equal")
        ax1.grid(alpha=0.25, lw=0.5)

        # 視野占有率の注記 (センサー枠内の上部中央)
        if r["frac_spec_fov"] is not None:
            ax1.text(0.0, h / 2 * 0.90,
                     L(f"1次ｽﾍﾟｸﾄﾙ: 水平視野の {100*r['frac_spec_fov']:.0f}%  /  "
                       f"0次〜1次全体: {100*r['frac_full_fov']:.0f}%",
                       f"1st-order: {100*r['frac_spec_fov']:.0f}% of HFOV / "
                       f"0th–1st total: {100*r['frac_full_fov']:.0f}%"),
                     ha="center", va="top", fontsize=9,
                     bbox=dict(fc="lightyellow", ec="gray", alpha=0.9))

        # --- ブレーズ効率 ---
        ax2.clear()
        lam_g = np.linspace(p["lam_min_nm"], p["lam_max_nm"], 500)
        for m, style in ((0, "-"), (1, "-"), (2, "--")):
            eff = blaze_efficiency(m, lam_g, p["blaze_nm"])
            ax2.plot(lam_g, 100 * eff, style, lw=1.8 if m == 1 else 1.2,
                     label=f"m={m}")
        ax2.axvline(p["blaze_nm"], color="gray", lw=0.8, ls=":")
        ax2.annotate(L(f"ブレーズ波長 {p['blaze_nm']:.0f}nm",
                       f"blaze λ {p['blaze_nm']:.0f}nm"),
                     (p["blaze_nm"], 96), fontsize=8, ha="left")
        for i, (name, lam, grp, _rank, _def) in enumerate(METEOR_LINES):
            if not line_vars[i].get():
                continue
            if p["lam_min_nm"] <= lam <= p["lam_max_nm"]:
                ax2.axvline(lam, color=GROUP_COLORS.get(grp, "black"),
                            lw=0.6, alpha=0.6)
        for i, (name, lam_a, lam_b, _row, _lvl) in enumerate(MOLECULAR_BANDS):
            if not band_vars[i].get():
                continue
            if lam_b >= p["lam_min_nm"] and lam_a <= p["lam_max_nm"]:
                ax2.axvspan(max(lam_a, p["lam_min_nm"]),
                            min(lam_b, p["lam_max_nm"]),
                            color="#7B2FBE", alpha=0.12, lw=0)
        ax2.set_xlabel(L("波長 [nm]", "wavelength [nm]"))
        ax2.set_ylabel(L("相対効率 [%] (sinc²近似)", "relative eff. [%]"))
        ax2.set_title(L("ブレーズ効率の近似曲線 (縦線: 選択輝線, 紫帯: OH/AlO/TiOバンド)",
                        "Approx. blaze efficiency (lines: selected, violet: OH/AlO/TiO)"))
        ax2.legend(loc="center right", fontsize=9)
        ax2.set_ylim(0, 105)
        ax2.grid(alpha=0.3, lw=0.5)

        canvas.draw_idle()

    # ------------------------------------------------------------------
    def update(_evt=None):
        p = read_params()
        if p is None:
            txt.delete("1.0", tk.END)
            txt.insert(tk.END, "入力値が不正です。数値を確認してください。")
            return
        r = compute_system(p)
        last_result["p"], last_result["r"] = p, r
        x0_lbl.config(text=f"0次位置: 半幅の {x0_var.get():+.2f}")
        line_count_lbl.config(
            text=f"表示中: 輝線・バンド 計 {enabled_line_count()} 件 "
                 f"(全 {len(METEOR_LINES) + len(MOLECULAR_BANDS)} 件)")
        sensor_size_lbl.config(
            text=f"→ センサー {r['sensor_w_mm']:.1f} × {r['sensor_h_mm']:.1f} mm")
        txt.delete("1.0", tk.END)
        txt.insert(tk.END, build_report(p, r))
        draw(p, r)

    def save_report():
        if "r" not in last_result:
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".txt", initialfile="meteor_spec_report.txt",
            filetypes=[("Text", "*.txt")])
        if not path:
            return
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("流星撮像・分光観測システム設計レポート\n")
            fh.write("=" * 50 + "\n")
            fh.write(build_report(last_result["p"], last_result["r"]))
        messagebox.showinfo("保存", f"保存しました:\n{path}")

    def save_figure():
        path = filedialog.asksaveasfilename(
            defaultextension=".png", initialfile="meteor_spec_layout.png",
            filetypes=[("PNG", "*.png"), ("PDF", "*.pdf")])
        if not path:
            return
        fig.savefig(path, dpi=200, bbox_inches="tight")
        messagebox.showinfo("保存", f"保存しました:\n{path}")

    # 左パネルの全ウィジェットにホイールスクロールをバインド
    _bind_wheel_tree(left, _wheel_handler(left_canvas))

    # Enter キーでも更新
    root.bind("<Return>", update)
    update()
    root.mainloop()


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="分光観測プランナー (Spectroscopic Observation Planner)")
    ap.add_argument("--selftest", action="store_true",
                    help="計算ロジックの自己検証を実行して終了")
    args = ap.parse_args()
    if args.selftest:
        sys.exit(0 if selftest() else 1)
    run_gui()
