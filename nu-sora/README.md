# 日本大学 全学屋上観測網「ソラ」（NU-SORA）観測ポータル — デモ版

**NU-SORA** — Nihon University Sky Observation and Resilience Array

令和9年度 日本大学特別研究の申請に向けた、観測ポータルのデモ版。全国 14 局の屋上観測局から集まるデータを
一つの画面で見せる Web ツールとして、火球・スペースデブリ再突入・インフラサウンド・気象／熱中症・
夜空の明るさ（光害）・通報ワークフロー・公開 API を通しで確認できる。

> **表示されている観測値・イベントはすべて模擬データであり、実際の観測結果ではない。**
> 観測局の配置・機材構成・解析手法・サブテーマの対応は申請内容に基づく。

## 起動

ビルド不要・依存パッケージなし。`index.html` をブラウザで開くだけで動く。

```bash
open index.html                 # macOS。ダブルクリックでも可
# もしくはローカルサーバー経由（推奨・どのブラウザでも確実）
python3 -m http.server 8777     # → http://127.0.0.1:8777/
```

外部への通信は Google Fonts（Shippori Mincho / Zen Kaku Gothic New）の読み込みのみ。
オフラインでもフォントが代替されるだけで、すべての機能が動作する。

## 画面

| タブ | サブテーマ | 内容 |
|---|---|---|
| ダッシュボード | — | 警戒レベル、14 局の稼働状況、今夜の検出見込み、直近イベント、通報ログ、全国地図 |
| 観測局マップ | — | 14 局の配置。レイヤ（稼働状態／夜空輝度／WBGT／雲量／イベント）と視野円（仰角 5–45°）の切替、拡大・移動 |
| 火球・隕石 | G-1 / DT-1 | 検出カタログ、局別光度曲線、高度・速度、地上軌跡と落下域確率地図、光学とインフラサウンドのエネルギー二重推定、突入前軌道、発光スペクトル、通報の経過 |
| デブリ再突入 | G-2 / DT-1 | 再突入予報、観測事例、破片化シーケンス、SWIR による熱放射、大気への金属注入量、**発光スペクトル（局面の切替と分子バンドの ON/OFF）**、自然天体との識別表 |
| インフラサウンド | G-4 / DT-4 | 火山・ロケット（較正事象）・雷・地震後の校舎応答。波形、到達時刻、方位交会による音源定位 |
| 気象・熱中症 | G-6 / DT-3・DT-6 | 全国 WBGT 分布、校庭内のダウンスケーリング、24 時間推移、**線状降水帯の統合検知** |
| **地震・津波** | G-5 / DT-5 | **全センサーの統合とデジタルツイン**。鉛直方向の結合（海底→地殻→大気→電離圏）とセンサーの対応、震央と検知局、TEC 時系列、津波規模の推定と検証、**サロゲートモデルによる即時推定と通報（Web／スマホ／SNS／自治体 API）**、校舎の使用可否判定、NIED との突き合わせ |
| 夜空の明るさ | G-3 / DT-2 | 全国輝度マップ、Bortle スケール、一晩の推移、人工光・月・雲・衛星の寄与分離、経年トレンド |
| 通報・社会実装 | G-7 / PF-3 | **通報ワークフロー 4 系統（火球・線状降水帯・津波・火山噴火。各段階をクリックすると解析経過が開く）**、警戒レベルの定義、通報ログ、法的論点、連携先 |
| 観測局・機材 | PF-1 | 全局共通のフル構成、14 局一覧、**全 14 局ぶんの実況表示（全天カメラ／インフラサウンド／複合気象センサー／夜空輝度計／電波流星 FFT／2 周波 GNSS）** |
| データ・API | PF-2 | 3 階層アクセス、公開 API の設計案とレスポンス例、DT-1〜DT-7 |
| このデモについて | — | 実データと模擬データの区別、参考資料、操作方法 |

ダッシュボード・観測局マップ・観測局一覧のどこからでも、**観測局をクリックするとその局の全データ一覧**へ移動する。
1 画面にその局の全センサーが縦に並び、上部のボタンで各節へ飛べる。

| 節 | 内容 |
|---|---|
| 全天カメラ | 疑似ライブ（星座線・星名・目盛・時刻切替・早送り） |
| 現在の観測値 | 夜空輝度・雲量・気温・湿度・気圧・風・日射・降水・WBGT・太陽高度・月・伝送遅延・一次保存 |
| 24 時間推移 | 夜空輝度／気温・WBGT・雲量 |
| インフラサウンド | 6 チャンネル（HF・MF・LF・X・Y・Z）の実況グラフと諸元 |
| 夜空輝度計 | 現在値・Bortle 等級・光害量・月と雲と衛星の寄与 |
| 2 周波 GNSS | TEC（24 時間推移）・受信衛星数・PDOP・PPS 同期 |
| 微動計・そのほか | 校舎固有振動数・最大加速度・電波流星・分光カメラ・SWIR・制御 PC |
| 電波流星 FFT | HROFFT 形式のスペクトログラムとエコー計数 |
| 搭載機材と稼働状態 | 系統ごとの型式・仕様・状態 |
| 観測実績・検出イベント | 累積検出数と、その局が関わった事象 |

### スペースデブリの発光スペクトル（「デブリ再突入」画面）

ロケットデブリ再突入の分光観測（Watanabe, Abe, Arima & Hanayama, ACM 2026 — LM-3B 第 2 段、石垣島天文台、
Sony α7S ＋ Edmund Optics **600 grooves/mm** 透過型回折格子）に基づき、次の 2 つを切り替えられる。

- **再突入の局面**：発光開始 → アブレーション → 爆発 → 分裂 → 終端。局面ごとに化学種が入れ替わる
  （発光開始で Na I、アブレーションで AlO・CN、爆発で Fe I 420 nm・Mn I 403 nm・O I 630 nm、
  分裂で H I 486 nm、終端でも AlO が残る）
- **分子（酸化物）バンドの ON / OFF**：**AlO**（B²Σ⁺–X²Σ⁺, 450–560 nm, 励起温度 約 5,000–9,000 K）、
  **CN**（violet 系, 386–422 nm, 約 12,000 K）、**TiO**（γ・γ′ 系, 515–725 nm）、**FeO**（orange arc, 570–650 nm）

これらの分子バンドは自然天体の流星では通常検出されず、人工天体を識別する決定的な指標になる。
バンドを OFF にすると原子線だけのスペクトルになり、自然天体（火球の画面）との違いを直接比較できる。

### 通報ワークフロー 4 系統（「通報・社会実装」画面）

災害の種類ごとに手順が違うため、系統を切り替えられるようにしてある。各段階をクリックすると、
その時点の解析経過（入力・処理・出力・その時点で何が分かるか）が開く。

| 系統 | 段階 | 使うセンサー |
|---|---|---|
| **火球・隕石落下**（G-1 / DT-1） | 検出 → 多点対応 → 軌跡決定 → 落下域 → 通報 → 確認 → 対応（7 段階・3 分 42 秒） | 全天カメラ、インフラサウンド、気象 |
| **線状降水帯**（G-4・G-6 / DT-4） | 形成 → 検知 → 定位 → 前兆 → 判定 → 通報 → 実測 → 解除（8 段階・58 分） | インフラサウンド（雷）、2 周波 GNSS（可降水量）、気象 |
| **津波**（G-4・G-5 / DT-4・DT-5） | 地震検知 → 電離圏 → 音響 → 電離圏ホール → 規模推定 → 通報 → 検証（7 段階・28 分） | 微動計、2 周波 GNSS（TEC）、インフラサウンド |
| **火山噴火**（G-4 / DT-4） | 噴火 → 直達波 → 定位 → 通報 → 成層圏風（5 段階・12 分） | インフラサウンド |

津波の系統は、TEC の音波共振（+8 分）と津波性電離圏ホール（+19 分）から沿岸波高を独立に
見積もる構成で、Kakinami et al. (2012)・Kamogawa et al. (2016)・Nishikawa et al. (2022) に基づく。
気象庁の津波警報を置き換えるものではなく、警報の後に「どれくらい来そうか」を補う位置づけである。

「落下域」の段階では、暗黒飛行（ダークフライト）の風補正に用いる風のプロファイルを示す。
上空の風は**気象庁の公開データ**を用いる想定である。

| 高度帯 | データ源 |
|---|---|
| 地上 〜 1.5 km | 各観測局の複合気象センサーの実測値 |
| 1.5 〜 30 km | 気象庁 数値予報 GPV（メソモデル MSM、水平 5 km・3 時間ごと） |
| 30 km 以上 | 気象庁 高層気象観測（ラジオゾンデ：館野・八丈島など） |

### 全 14 局の実況表示（「観測局・機材」画面）

観測局の一覧の下に、搭載する各センサーの実況を全局ぶん並べている。

| 表示 | 機材 | 内容 |
|---|---|---|
| 全天カメラ | IMX664 ×2 | 実測星表による星図。時刻切替あり |
| インフラサウンド実況グラフ | サヤ INF03 ／ ADXII-INF01 系 | HF / MF / LF ＋ X・Y・Z 加速度（下記） |
| 複合気象センサー | Vaisala WXT530 系 | 気温・湿度・気圧・風向風速・雨量・日射・WBGT・雲量と気温の 24 時間推移 |
| 夜空輝度計 | Unihedron SQM-LU-DL | mag/arcsec²、Bortle 等級、光害量、直近の夜の推移 |
| 電波流星受信機（FFT 画面） | HRO 53.755 MHz | HROFFT 形式のスペクトログラム（下記） |
| 2 周波 GNSS 受信機 | 測地級 L1/L2 | TEC、受信衛星数（GPS/QZSS/Galileo/GLONASS）、PDOP、PPS 同期、TEC の 12 時間推移 |

#### 電波流星受信機の FFT 画面

HRO 方式（53.755 MHz の連続波ビーコンの前方散乱）の受信を、HROFFT 形式のスペクトログラム
（横軸 時刻／縦軸 ビーコンからの周波数差／色 強度）で表示する。時間窓は 5 分〜1 時間。

- 0 Hz の横線 … ビーコンの直接波
- 短い輝点 … 過疎エコー（暗い流星）
- 太い横帯 … 過密エコー（明るい流星。継続時間が長い）
- 立ち上がりの周波数降下 … ヘッドエコー

エコーの発生率は明け方に極大となる日周変化を持たせてある。光学が使えない昼間・曇天・満月期でも
流星数を数え続けられるため、全天カメラの検出効率の較正に使う。

### インフラサウンド 実況グラフ（「観測局・機材」画面）

複合型センサー（サヤ INF03 ／ 高知工科大学と共同開発の ADXII-INF01 系）の 6 チャンネルを、
全 14 局ぶん並べて 0.5 秒ごとに更新する。チャンネルと時間窓（1 分〜1 時間）を切り替えられる。

| ch | 帯域 | 捉えるもの |
|---|---|---|
| HF | 1–20 Hz | 雷放電・爆発音・近傍の人工雑音 |
| MF | 0.1–1 Hz | 海洋起源の脈動微気圧振動（マイクロバロム）、火球の衝撃波 |
| LF | 0.005–0.1 Hz | 大気重力波・津波・気圧変動 |
| X / Y / Z | 0.1–10 Hz | 3 成分加速度（常時微動。校舎の固有振動数と地震後の使用可否判定 DT-6） |

時間窓が長く搬送波を解像できない帯域は、実際の実況グラフと同じく ±包絡線の帯として描く。
表示の体裁は日本気象協会「インフラサウンド・モニタリング・ネットワーク」および
高知工科大学 KISONS を参考にした。

### 線状降水帯の統合検知（「気象・熱中症」画面の下部）

千葉県東部に発生した線状降水帯を想定し、**雨量計だけでは捉えられない帯を、インフラサウンドで先に捉える**
構成を示す。観測局は帯の西 26–69 km にあり直接の大雨は受けていないが、

1. **インフラサウンド**（0.6–14 Hz）が帯の中で連続する雷放電を 5 局で検知し、到来方位の交会で
   帯の位置・長さ・向き・移動（78 × 22 km、285° へ 9.2 km/h）を推定する
2. **2 周波 GNSS** の可降水量（PWV）が 43 → 61 mm と上昇し、水蒸気の流入を示す
3. **複合気象センサー**の雨量・気圧が、帯の到達後に判定を確定・検証する

の 3 段構えで、6 条件の自動判定から 4 分で自治体・学校へ発報する流れを示している。

## ファイル構成

```
index.html          画面の骨格とスクリプトの読み込み
css/app.css         配色・レイアウト（申請書の図版と同じ配色・書体系統。暗／明の切替あり）
js/geo-japan.js     日本の都道府県境界（提案書「観測局配置図」から再利用）
js/core.js          乱数・時刻・整形・DOM/SVG・チャート部品（折れ線／棒／積み上げ／ゲージ）
js/data.js          14 局の諸元、全局共通のフル構成、気象・夜空輝度・WBGT・稼働状態の生成
js/events.js        イベントカタログ（火球・再突入・インフラサウンド・線状降水帯）と物理関係式、スペクトル線リスト
js/map.js           日本地図コンポーネント（投影・視野円は「観測局配置図」と同一方式。拡大・移動）
js/sky.js           全天カメラの疑似ライブ（等距離魚眼。恒星位置は実際の天球から計算）
js/views1.js        ダッシュボード／観測局マップ／観測局一覧／観測局詳細
js/views2.js        火球・隕石／デブリ再突入／インフラサウンド／発光スペクトル
js/views3.js        気象・熱中症（線状降水帯を含む）／夜空の明るさ／通報／データ・API／このデモについて
js/app.js           ルーティング・ヘッダ・時計・テーマ
assets/             参照図の置き場（README 参照。画像を置くと分光パネルに並んで表示される）
```

## 実データと模擬データ

**申請内容・実測値に基づくもの**

- 観測局 14 局の名称・所在地・座標・設置機関（大学キャンパス拠点 7・付属校拠点 7）、SWIR 設置 4 局
  - 大学キャンパス拠点：船橋（理工・薬・短大＋習志野高）、**津田沼（生産工学部・津田沼／実籾）**、郡山（工＋東北高）、湘南（生物資源＋藤沢高）、三島（国際関係・短大＋三島高）、桜上水（文理＋櫻丘高）、駿河台（理工・歯）
  - 付属校拠点：札幌・山形・長野・土浦・大垣・長崎・宮崎
  - 船橋局と津田沼局は 5.1 km の**近接基線**で、短基線インフラサウンドアレイによる方位推定の精密化と、全天カメラの相互較正に使う
- 全局共通のフル構成（機材の型式・仕様・用途）
- 視野円の算出（高度 100 km を仰角 30° 以上で見込める地表半径 = 約 167 km）
- 日本の都道府県境界（国土数値情報を簡略化したデータ）
- 恒星 9,096 個の位置・等級・色指数：エール輝星星表 第5版（BSC5, Hoffleit & Warren 1991, CDS/VizieR V/50。パブリックドメイン）
- 星座線 752 本：IAU 公式星座図形（Stellarium「modern_iau」スカイカルチャー, CC BY-SA 4.0）
- 天の川：Tycho-2 の V<11.5 星数密度（Hog et al. 2000, CDS I/259）を 1 度グリッドに集計
- 発光スペクトルの線同定と相対強度（実際に取得された流星スペクトルの代表例に基づく。S. Abe et al. 2000 ほか）
- スペースデブリの分子バンド（AlO・CN・TiO・FeO）の同定・励起温度・局面ごとの推移
  （Watanabe, Abe, Arima & Hanayama, ACM 2026。同観測の値：CN 約 12,000 K、AlO 約 5,000–9,000 K、
  平均表面温度 5,436 K ＝ サンプルリターンカプセルの約 2 倍）
- 物理関係式：Brown et al. (2002) の放射エネルギー–全エネルギー関係、AFTAC の周期–収量関係、
  Ono & Tonouchi (2014) の屋外 WBGT 推定式、Bortle (2001) の空の等級

**模擬データ（デモ用の作り物）**

- すべてのイベントとその解析値、気象・夜空輝度・WBGT・雲量・稼働率、全天カメラの映像、
  再突入予報の対象天体（NORAD 仮 ID 99xxx）、通報ログ、経年トレンド、カタログ統計、
  発光スペクトルの波形そのもの

## 参照図の追加

分光パネルに実際の流星スペクトルの図を並べたい場合は、`assets/spectrum_ref1.png` および
`assets/spectrum_ref2.png`、`assets/spectrum_ref3.png` として画像を置く。ファイルがあれば自動的に表示され、
無ければ何も表示されない（`assets/README.md` を参照）。

全国マップ（ダッシュボード・観測局マップ・気象/WBGT・夜空の明るさ）には**「更新」ボタン**があり、
最終更新時刻とあわせて表示している。観測局マップの更新は表示範囲とレイヤの選択を保ったまま値だけを描き直す。

## 外部の公開データ

| 提供元 | データ | 使い方 |
|---|---|---|
| **気象庁** | ひまわり衛星画像（可視 B03／赤外 B13／水蒸気 B08／真彩色） | 観測局マップに **ON/OFF で重ねる**。Web メルカトルのタイルなので地図にそのまま整合する。既定は OFF で、ON にしたときだけ気象庁のサーバーから取得する |
| **気象庁** | 地上天気図（実況・24/48 時間予想・アジア実況） | 図法が地図と異なるため重ねず、参照図として並べる |
| **気象庁** | 数値予報 GPV（MSM）・高層気象観測 | 暗黒飛行（ダークフライト）の風補正（設計上の想定。デモでは模擬プロファイル） |
| **防災科研（NIED）** | K-NET・KiK-net／Hi-net／F-net／S-net・DONET／J-RISQ／J-SHIS／V-net／クライシスレスポンス／地すべり地形分布図 | 各画面に「本観測網のどのデータをどの観測網と突き合わせて検証するか」の対応表を置く（[データ公開一覧](https://www.bosai.go.jp/sp/activity_special/data/)） |
| **IMO** | Meteor Shower Calendar / Working List | 検出カタログの流星群を、実際の活動期間・極大日・ZHR・輻射点高度に従って決める |

## 参考文献

本デモが依拠している主な先行研究と、関連する実装。

### 流星・火球・スペースデブリ再突入

- **Abe, S.** (2026), *A calibrated dust-trail model of the Leonid meteoroid stream and forecasts of the 2031–2035 encounters*, [arXiv:2608.25456](https://arxiv.org/abs/2608.25456)（[データ: Zenodo](https://zenodo.org/records/22084210)）
  — しし座流星群のダストトレイルと地球軌道の交差から流星嵐を予報する。DT-1（上空大気圏ツイン）の予報入力に対応する
- **Abe, S., et al.** (2020), *Sodium variation in Geminid meteoroids from (3200) Phaethon*, Planetary and Space Science, **194**, 105040 — [doi:10.1016/j.pss.2020.105040](https://doi.org/10.1016/j.pss.2020.105040)
  — Na I 589 nm の強度変化から母天体の熱進化を読む。火球スペクトルで Na／Mg 比を組成の指標として扱う根拠（G-1）
- **Abe, S., et al.** (2011), *Near-Ultraviolet and Visible Spectroscopy of HAYABUSA Spacecraft Re-Entry*, Publications of the Astronomical Society of Japan, **63**, 1011–1021 — [doi:10.1093/pasj/63.5.1011](https://doi.org/10.1093/pasj/63.5.1011)
  — 人工物の再突入を地上から分光観測した先行例。デブリ再突入の分光（G-2）が直接引き継ぐ手法
- **Abe, S.** (2009), *Meteoroids and Meteors – Observations and Connection to Parent Bodies*, Lecture Notes in Physics, **758**, 129–166, Springer — [doi:10.1007/978-3-540-76935-4_5](https://doi.org/10.1007/978-3-540-76935-4_5)
  — 流星の観測手法と、軌道・密度・強度・組成から母天体へ遡る枠組みの総説。本デモ全体の観測設計と解析フローの土台
- **Abe, S., et al.** (2000), *First Results of High-Definition TV Spectroscopic Observations of the 1999 Leonid Meteor Shower*, Earth, Moon, and Planets, **82–83**, 369–377 — [doi:10.1023/A:1017055120356](https://doi.org/10.1023/A:1017055120356)
  — 自然天体スペクトルの線同定（Ca II・Mg I・Na I・Si II・O I・N I・N₂）と相対強度の基準
- **Watanabe, K., Abe, S., Arima, N. & Hanayama, H.** (2026), *Spectroscopic Study of Rocket Debris during Atmospheric Re-entry*, ACM 2026（Asteroids, Comets, Meteors 2026 発表）
  — LM-3B 第2段の再突入分光（石垣島天文台・600 grooves/mm）。分子（酸化物）バンド AlO・CN・TiO と再突入局面の推移はこの成果に基づく

### インフラサウンド・音響観測

高知工科大学 山本真行研究室らによる先行研究。本観測網のインフラサウンド系（G-4 / DT-4）の設計根拠。

- **Yamamoto, M.-Y., Ishihara, Y., Hiramatsu, Y., Kitamura, K., Ueda, M., Shiba, Y., Furumoto, M. & Fujita, K.** (2011), *Detection of Acoustic/Infrasonic/Seismic Waves Generated by Hypersonic Re-Entry of the HAYABUSA Capsule and Fragmented Parts of the Spacecraft*, Publications of the Astronomical Society of Japan, **63**, 971–978 — [doi:10.1093/pasj/63.5.971](https://doi.org/10.1093/pasj/63.5.971)
  — 光学とインフラサウンドを同一事象で同時に取ることの直接の根拠（G-1・G-2）
- **Nishikawa, Y., Yamamoto, M.-Y., Sansom, E. K., Devillepoix, H. A. R., Towner, M. C., et al.** (2022), *Modeling of 3D trajectory of Hayabusa2 re-entry based on acoustic observations*, Publications of the Astronomical Society of Japan, **74**, 308–317 — [doi:10.1093/pasj/psab126](https://doi.org/10.1093/pasj/psab126)
  — 音響観測のみから 3 次元軌跡を復元する。到達時刻差・到来方位の交会による音源定位に対応
- **Nishikawa, Y., Yamamoto, M.-Y., Nakajima, K., Hamama, I., Saito, H., Kakinami, Y., Yamada, M. & Ho, T.-C.** (2022), *Observation and simulation of atmospheric gravity waves exciting subsequent tsunami along the coastline of Japan after Tonga explosion event*, Scientific Reports, **12**, 22354 — [doi:10.1038/s41598-022-25854-3](https://doi.org/10.1038/s41598-022-25854-3)
  — フンガ・トンガ噴火のラム波・大気重力波と後続津波。DT-4（音の大気ツイン）の中核
- **Nishikawa, Y., Yamamoto, M.-Y., Yokota, A., Hasumi, Y. & Hamajima, G.** (2024), *Specification of INF01LE, INF03, and INF04LE infrasound sensors for the observation and detection of destructive geophysical events*, Discover Geoscience, **2**, 82 — [doi:10.1007/s44288-024-00083-5](https://doi.org/10.1007/s44288-024-00083-5)
  — 本観測網が全 14 局に 2 台ずつ搭載する **INF03** を含むセンサー群の性能評価。機材構成（PF-1）が依拠する一次情報
- **Fujita, K., Yamamoto, M.-Y., Abe, S., Ishihara, Y., Iiyama, O., Kakinami, Y., et al.** (2011), *An Overview of JAXA's Ground-Observation Activities for HAYABUSA Reentry*, Publications of the Astronomical Society of Japan, **63**, 961–969 — [doi:10.1093/pasj/63.5.961](https://doi.org/10.1093/pasj/63.5.961)
  — 光学・分光・インフラサウンド・地震・電離圏を一事象へ同時投入した地上観測キャンペーンの全体像。これを 14 局の常設網として恒常化するのが本観測網の構想

### 電離圏・GNSS

全 14 局の 2 周波 GNSS が担う電離圏観測（G-5 / DT-5）の設計根拠。

- **Kakinami, Y., Kamogawa, M., Tanioka, Y., Watanabe, S., Gusman, A. R., Liu, J.-Y., Watanabe, Y. & Mogi, T.** (2012), *Tsunamigenic ionospheric hole*, Geophysical Research Letters, **39**, L00G27 — [doi:10.1029/2011GL050159](https://doi.org/10.1029/2011GL050159)
  — 津波が電離圏に「穴」を開けることを発見。DT-5 で津波起源の擾乱を検出する根拠
- **Kakinami, Y., Kamogawa, M., Watanabe, S., Odaka, M., Mogi, T., Liu, J.-Y., Sun, Y.-Y. & Yamada, T.** (2013), *Ionospheric ripples excited by superimposed wave fronts associated with Rayleigh waves in the thermosphere*, Journal of Geophysical Research: Space Physics, **118**, 905–911 — [doi:10.1002/jgra.50099](https://doi.org/10.1002/jgra.50099)
  — 地震のレイリー波が電離圏に立てるさざ波。微動計（DT-6）と GNSS（DT-5）を同一局で持つ意味の裏づけ
- **Kamogawa, M., Orihara, Y., Tsurudome, C., Tomida, Y., Kanaya, T., Ikeda, D., Gusman, A. R., Kakinami, Y., Liu, J.-Y. & Toyoda, A.** (2016), *A possible space-based tsunami early warning system using observations of the tsunami ionospheric hole*, Scientific Reports, **6**, 37989 — [doi:10.1038/srep37989](https://doi.org/10.1038/srep37989)
  — 電離圏ホールを津波の早期警戒に使う構想。通報ワークフロー（G-7）への GNSS 側からの入力
- **Kakinami, Y., Saito, H., Yamamoto, T., Chen, C.-H., Yamamoto, M.-Y., Nakajima, K., Liu, J.-Y. & Watanabe, S.** (2021), *Onset Altitudes of Co-Seismic Ionospheric Disturbances Determined by Multiple Distributions of GNSS TEC After the Foreshock of the 2011 Tohoku Earthquake on March 9, 2011*, Earth and Space Science, **8**, e2020EA001217 — [doi:10.1029/2020EA001217](https://doi.org/10.1029/2020EA001217)
  — GNSS TEC の多点分布から擾乱の発生高度を決める。14 局の GNSS が GEONET を補完する（G-5）技術的裏づけ

### 関連する実装

NU-SX (Shinsuke Abe) が公開している、観測と理論を「動かして確かめる」ためのアプリ（いずれも無料・iPhone / iPad / Mac）。

- **Meteorium（メテオリウム）** — 宇宙科学デジタルツイン アプリ、NU-SX (Shinsuke Abe) 2026（[紹介記事](https://aero.cst.nihon-u.ac.jp/abe-s/2026/08/31/meteorium%ef%bc%88%e3%83%a1%e3%83%86%e3%82%aa%e3%83%aa%e3%82%a6%e3%83%a0%ef%bc%89/) ／ [App Store](https://apps.apple.com/jp/app/id6798546441)）
  — ダストトレイルと地球軌道の交差を俯瞰し、そのまま地上視点で流星雨を再現する。PF-2（デジタルツイン）・DT-7 が目指す形を観測データ側から補完する
- **Astrarium（アストラリウム）** — 星空アプリ、NU-SX (Shinsuke Abe) 2026（[紹介記事](https://aero.cst.nihon-u.ac.jp/abe-s/2026/08/01/%e3%83%97%e3%83%a9%e3%83%8d%e3%82%bf%e3%83%aa%e3%82%a6%e3%83%a0%e3%82%a2%e3%83%97%e3%83%aa%e3%82%92%e3%80%80%e5%85%ac%e9%96%8b/) ／ [App Store](https://apps.apple.com/jp/app/id6795053748)）
  — 本デモの全天カメラが用いる BSC5・IAU 星座図形・Tycho-2 天の川は、このアプリのために整備されたデータをそのまま取り込んだもの。DT-7・G-8 に接続する
- **Cometarium（コメタリウム）** — 彗星ビューア、NU-SX (Shinsuke Abe) 2026（[App Store](https://apps.apple.com/jp/app/id6801072934)）
  — 彗星の位置・光度・尾を実測の軌道と物理モデルで描く。COBS の観測に光度式を当てはめ ±3σ 帯で示す姿勢は、本デモが火球の光度曲線とエネルギー推定の不確かさを併記する考え方と同じ。流星群の母天体の側から DT-1 を補完する

## 参考資料

- [NU-SX 公式サイト](https://aero.cst.nihon-u.ac.jp/nu-sx/) ／ [Abe Space Science Lab](https://aero.cst.nihon-u.ac.jp/abe-s/)
- [SonotaCo Network Japan（UFOCapture）](https://sonotaco.jp/)、[株式会社サヤ INF03](https://www.saya-net.com/products/inf03.html)、[Unihedron SQM-LU-DL](https://unihedron.com/projects/sqm-lu-dl/)、[高知工科大学 インフラサウンド研究室](https://www.kochi-tech.ac.jp/research/research_center/advanced_engineering/infrasound.html)
- 地図データ：dataofjapan/land（国土数値情報を簡略化）

## ブラウザ

Chrome / Safari / Firefox / Edge の最新版。スマートフォン幅にも対応する。
配色は右上のボタンで暗（観測運用向け）と明（印刷・投影向け）を切り替えられる。
