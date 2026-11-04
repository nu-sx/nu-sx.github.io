# メシエ天体の天体写真（実データ）

リモート望遠鏡のリアルタイム画面で、目標天体として描く写真。
NASA/GSFC **SkyView** から **Digitized Sky Survey 2（DSS2）** の 3 バンド
（IR / Red / Blue）を取得し、背景を平坦化したうえで合成したもの。

| ファイル | 天体 | 視野中心（J2000） | 画角 |
|---|---|---|---|
| `m42.jpg` | M42 オリオン大星雲 | α 83.822° δ −5.391° | 1.40° × 1.40° |
| `m31.jpg` | M31 アンドロメダ銀河 | α 10.684° δ +41.035° | 3.60° × 3.13°（板の欠陥を避けて上を切り落とした） |
| `m45.jpg` | M45 プレアデス星団 | α 56.750° δ +24.117° | 2.60° × 2.60° |

向きは北が上・東が左で、観測画面の向きと同じ。

## 出典と謝辞

取得：NASA/GSFC SkyView（https://skyview.gsfc.nasa.gov/）

> The Digitized Sky Surveys were produced at the Space Telescope Science Institute
> under U.S. Government grant NAG W-2166. The images of these surveys are based on
> photographic data obtained using the Oschin Schmidt Telescope on Palomar Mountain
> and the UK Schmidt Telescope.

DSS の画像は非営利・教育目的で上記の謝辞を添えて利用する。

---

# 全天の星図（天の川）

`milkyway_nasa.jpg`（2048 × 1024, 正距円筒図法）は、全天カメラの天の川に使う実データの星図。

NASA/GSFC **Scientific Visualization Studio「Deep Star Maps 2020」**（SVS 4851, Ernie Wright）の
**赤道座標版** `starmap_2020_4k.exr`（4096 × 2048, OpenEXR リニア）を取得し、
面積平均で 2048 × 1024 に縮小、ガンマ 2.2 で符号化して JPEG 化したもの。

* 出典：https://svs.gsfc.nasa.gov/4851/
* 元データ：Hipparcos-2・Tycho-2・Gaia DR2 の 17 億個の星の位置・明るさ・色（星座境界は IAU 1930）
* 座標系：ICRF/J2000 の赤経・赤緯。**RA 0h が画像の中央**で、左へ行くほど赤経が大きい。
  上端が赤緯 +90°、下端が −90°。
* 権利：NASA の画像はパブリックドメイン（出典表示を添える）

`js/sky.js` の `NS.starMap()` がこの画像をキャンバスに展開して画素を読み、
各局の緯度と地方恒星時から魚眼（等距離射影）へ貼りつける。
**画素を読むため、`file://` で直接開くとキャンバスが汚染されて使えない。**
その場合は Tycho-2 の星数密度グリッド（`js/starcatalog.js`）へ自動で切り替わるので、
星図を見るにはローカルサーバー経由で開くこと。

```
python3 -m http.server 8000 --bind 127.0.0.1
# → http://127.0.0.1:8000/index.html
```
