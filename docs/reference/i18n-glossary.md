# i18n 対訳グロッサリー

boatAI 多言語化における対訳の基準表。翻訳キー追加時はこの表に従う。

## 方針

- **専門用語はローマ字 + 英語説明の併記**（例: `Nige (Escape)`）。海外ユーザーが日本の用語をそのまま学べるようにする（検索・実況・公式サイトとの互換性のため）
- 会場名はヘボン式ローマ字
- UI 一般文言は自然な英語に意訳

### 繁体字中国語（zh-TW）の方針

- 競技名は公式インバウンド向け表記に従い **「賽艇（BOAT RACE / Kyotei）」** を使用する。中華圏で通用する俗称「競艇」はプロジェクトルール（「競艇」使用禁止）と公式ブランディングの両方に反するため使わない
- 券種名は BOATRACE 公式繁体字ページの表記に従う（單勝・複勝・2連單・2連複・3連複・3連單）
- 決まり手は繁体字の意訳 + ローマ字併記（例: `逃走（Nige）`）。日本語実況・公式サイトとの対照を可能にする
- 会場名は漢字を繁体字化（戸→戶、浜→濱、亀→龜、児→兒、徳→德、関→關、芦→蘆、びわこ→琵琶湖、国→國）
- 台湾の用語習慣に合わせる（データ→資料/數據、ブログ→部落格、モーター→馬達、読み込み→載入）

## 決まり手（Winning Techniques）

| 日本語 | キー | 英語表記 | 繁體中文 | 補足 |
|--------|------|---------|----------|------|
| 逃げ | nige | Nige (Escape) | 逃走（Nige） | 1コースが先マイして押し切る |
| 差し | sashi | Sashi (Inside pass) | 切入（Sashi） | ターンで内側を差す |
| まくり | makuri | Makuri (Outside sweep) | 外攻（Makuri） | 外から全速で抜き去る |
| まくり差し | makurizashi | Makuri-zashi (Sweep & pass) | 外攻切入（Makuri-zashi） | まくりつつ内を差す |
| 抜き | nuki | Nuki (Overtake) | 超越（Nuki） | 1マーク以降で抜く |
| 恵まれ | megumare | Megumare (Lucky win) | 幸運勝出（Megumare） | 先行艇の事故等による勝利 |

## 会場（Venues）

| コード | 日本語 | 英語 | 繁體中文 |
|--------|--------|------|----------|
| 1 | 桐生 | Kiryu | 桐生 |
| 2 | 戸田 | Toda | 戶田 |
| 3 | 江戸川 | Edogawa | 江戶川 |
| 4 | 平和島 | Heiwajima | 平和島 |
| 5 | 多摩川 | Tamagawa | 多摩川 |
| 6 | 浜名湖 | Hamanako | 濱名湖 |
| 7 | 蒲郡 | Gamagori | 蒲郡 |
| 8 | 常滑 | Tokoname | 常滑 |
| 9 | 津 | Tsu | 津 |
| 10 | 三国 | Mikuni | 三國 |
| 11 | びわこ | Biwako | 琵琶湖 |
| 12 | 住之江 | Suminoe | 住之江 |
| 13 | 尼崎 | Amagasaki | 尼崎 |
| 14 | 鳴門 | Naruto | 鳴門 |
| 15 | 丸亀 | Marugame | 丸龜 |
| 16 | 児島 | Kojima | 兒島 |
| 17 | 宮島 | Miyajima | 宮島 |
| 18 | 徳山 | Tokuyama | 德山 |
| 19 | 下関 | Shimonoseki | 下關 |
| 20 | 若松 | Wakamatsu | 若松 |
| 21 | 芦屋 | Ashiya | 蘆屋 |
| 22 | 福岡 | Fukuoka | 福岡 |
| 23 | 唐津 | Karatsu | 唐津 |
| 24 | 大村 | Omura | 大村 |

## 予想モデル（Prediction Models）

| 日本語 | キー | 英語 | 繁體中文 |
|--------|------|------|----------|
| 本命狙い | safeBet | Safe Bet | 穩健型 |
| スタンダード | standard | Standard | 標準型 |
| 穴狙い | upsetFocus | Upset Focus | 冷門型 |

## ドメイン用語（General Domain Terms）

| 日本語 | 英語 | 繁體中文 | 補足 |
|--------|------|----------|------|
| 艇番 | Boat # | 艇號 | |
| 級別 | Class | 級別 | A1/A2/B1/B2 はそのまま |
| 全国勝率 | National win rate | 全國勝率 | |
| 全国2連率 | National top-2 rate | 全國2連率 | 2着以内率 |
| 当地勝率 | Local win rate | 當地勝率 | その会場での勝率 |
| モーター2率 | Motor top-2 rate | 馬達2連率 | |
| 平均ST | Avg. ST | 平均ST | ST = Start Timing（そのまま使用） |
| 展示タイム | Exhibition time | 展示時間 | |
| 展示ST | Exhibition ST | 展示ST | |
| 総合力 | Overall score | 綜合力 | |
| コース勝率 | Course win rate | 航道勝率 | コース → 航道 |
| イン崩れ | In-kuzure (Lane-1 upset) | 1號位失守 | 1コースが負けること |
| イン崩れ指数 | Lane-1 upset index | 1號位失守指數 | |
| 単勝 | Win | 單勝 | 券種（繁体字は公式表記） |
| 複勝 | Place | 複勝 | 券種 |
| 3連複 | Trio | 3連複 | 券種（公式英語表記） |
| 3連単 | Trifecta | 3連單 | 券種（公式英語表記） |
| 的中 | Hit | 命中 | |
| 配当 | Payout | 派彩 | |
| 買い目 | Betting picks | 投注組合 | |
| 1マーク | First mark (1st turn) | 第一轉彎標 | |
| 荒れ度 | Volatility | 爆冷程度 | UI では「1號位失守指數」を使用 |
