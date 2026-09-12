# 月面の地図（実データ）

リモート望遠鏡の月面描画（`js/moon.js`）に使う、月の表側（東経 ±105°）の地図。
いずれも NASA/GSFC Scientific Visualization Studio「CGI Moon Kit」（SVS ID 4720）から取得し、
表側を切り出して縮小・再符号化したもの。**パブリックドメイン**（NASA の著作物）。

| ファイル | もとのデータ | 内容 |
|---|---|---|
| `lroc-albedo.jpg` | `lroc_color_poles_2k.tif` | LRO / LROC 広角カメラ（WAC）の全球モザイク（実写）。輝度のみを 1194 × 1024 で保持 |
| `lola-slope.jpg`  | `ldem_4.tif` | LRO / LOLA レーザー高度計の地形（4 画素/度）から求めた斜面。R = 東向き、G = 北向きの勾配を ±0.5 で正規化 |

出典表記：NASA's Scientific Visualization Studio / LRO（LROC WAC, LOLA）

取得元
- https://svs.gsfc.nasa.gov/4720/
