# i18n 対訳グロッサリー

boatAI 多言語化における日英対訳の基準表。翻訳キー追加時はこの表に従う。

## 方針

- **専門用語はローマ字 + 英語説明の併記**（例: `Nige (Escape)`）。海外ユーザーが日本の用語をそのまま学べるようにする（検索・実況・公式サイトとの互換性のため）
- 会場名はヘボン式ローマ字
- UI 一般文言は自然な英語に意訳

## 決まり手（Winning Techniques）

| 日本語 | キー | 英語表記 | 補足 |
|--------|------|---------|------|
| 逃げ | nige | Nige (Escape) | 1コースが先マイして押し切る |
| 差し | sashi | Sashi (Inside pass) | ターンで内側を差す |
| まくり | makuri | Makuri (Outside sweep) | 外から全速で抜き去る |
| まくり差し | makurizashi | Makuri-zashi (Sweep & pass) | まくりつつ内を差す |
| 抜き | nuki | Nuki (Overtake) | 1マーク以降で抜く |
| 恵まれ | megumare | Megumare (Lucky win) | 先行艇の事故等による勝利 |

## 会場（Venues）

| コード | 日本語 | 英語 |
|--------|--------|------|
| 1 | 桐生 | Kiryu |
| 2 | 戸田 | Toda |
| 3 | 江戸川 | Edogawa |
| 4 | 平和島 | Heiwajima |
| 5 | 多摩川 | Tamagawa |
| 6 | 浜名湖 | Hamanako |
| 7 | 蒲郡 | Gamagori |
| 8 | 常滑 | Tokoname |
| 9 | 津 | Tsu |
| 10 | 三国 | Mikuni |
| 11 | びわこ | Biwako |
| 12 | 住之江 | Suminoe |
| 13 | 尼崎 | Amagasaki |
| 14 | 鳴門 | Naruto |
| 15 | 丸亀 | Marugame |
| 16 | 児島 | Kojima |
| 17 | 宮島 | Miyajima |
| 18 | 徳山 | Tokuyama |
| 19 | 下関 | Shimonoseki |
| 20 | 若松 | Wakamatsu |
| 21 | 芦屋 | Ashiya |
| 22 | 福岡 | Fukuoka |
| 23 | 唐津 | Karatsu |
| 24 | 大村 | Omura |

## 予想モデル（Prediction Models）

| 日本語 | キー | 英語 |
|--------|------|------|
| 本命狙い | safeBet | Safe Bet |
| スタンダード | standard | Standard |
| 穴狙い | upsetFocus | Upset Focus |

## ドメイン用語（General Domain Terms）

| 日本語 | 英語 | 補足 |
|--------|------|------|
| 艇番 | Boat # | |
| 級別 | Class | A1/A2/B1/B2 はそのまま |
| 全国勝率 | National win rate | |
| 全国2連率 | National top-2 rate | 2着以内率 |
| 当地勝率 | Local win rate | その会場での勝率 |
| モーター2率 | Motor top-2 rate | |
| 平均ST | Avg. ST | ST = Start Timing（そのまま使用） |
| 展示タイム | Exhibition time | |
| 展示ST | Exhibition ST | |
| 総合力 | Overall score | |
| コース勝率 | Course win rate | |
| イン崩れ | In-kuzure (Lane-1 upset) | 1コースが負けること |
| イン崩れ指数 | Lane-1 upset index | |
| 単勝 | Win | 券種 |
| 複勝 | Place | 券種 |
| 3連複 | Trio | 券種（公式英語表記） |
| 3連単 | Trifecta | 券種（公式英語表記） |
| 的中 | Hit | |
| 配当 | Payout | |
| 買い目 | Betting picks | |
| 1マーク | First mark (1st turn) | |
| 荒れ度 | Volatility | |
