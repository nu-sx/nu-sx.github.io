# assets — 参照図の置き場

分光パネル（火球・デブリ再突入）に「参照：実際に取得された流星スペクトル」を並べて表示できます。
以下のファイル名で画像を置くと、自動的に表示されます（無ければ何も表示されません）。

| ファイル名 | 内容 |
|---|---|
| `spectrum_ref1.png` | 流星スペクトルの線同定例（350–900 nm、Fe I / Ca II / Mg I / Na I / Si II / O I / N I などのラベル付き） |
| `spectrum_ref2.png` | しし座流星群のスペクトル（S. Abe et al. 2000） |
| `spectrum_ref3.png` | ロケットデブリ再突入の分光（Watanabe et al., ACM 2026。AlO・CN バンドの時間変化など） |

PNG / JPG いずれでも動きますが、拡張子は `.png` にしてください（`.jpg` を使う場合は `js/views2.js` の
`specPanel()` 内のファイル名を書き換えてください）。
