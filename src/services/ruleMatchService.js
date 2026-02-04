/**
 * 会場別ルールマッチングサービス
 *
 * RULE_SPECIFICATION.mdに基づいたルール判定を行う
 */

import { supabase } from './supabaseClient'

/**
 * Supabaseのページネーションで全データを取得するヘルパー
 * デフォルトの1000行制限を回避
 */
async function fetchAllPredictions(startDate, modelId = 'standard') {
  const allData = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data: page, error } = await supabase
      .from('predictions')
      .select('*')
      .gte('predicted_at', startDate)
      .eq('model_id', modelId)
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('予測取得エラー:', error.message)
      break
    }
    if (!page || page.length === 0) break

    allData.push(...page)
    offset += pageSize

    if (page.length < pageSize) break
  }

  return allData
}

/**
 * race_idリストから結果データをバッチ取得するヘルパー
 * .in()クエリの1000件制限を回避
 */
async function fetchResultsByRaceIds(raceIds) {
  if (!raceIds || raceIds.length === 0) return []

  const allResults = []
  const batchSize = 500 // .in()は安全に500件ずつ

  for (let i = 0; i < raceIds.length; i += batchSize) {
    const batch = raceIds.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('race_results')
      .select('*')
      .in('race_id', batch)

    if (error) {
      console.error('結果取得エラー:', error.message)
      continue
    }
    if (data) {
      allResults.push(...data)
    }
  }

  return allResults
}

// 会場コードから会場名への変換
const VENUE_NAMES = {
  '01': '桐生', '02': '戸田', '03': '江戸川', '04': '平和島', '05': '多摩川', '06': '浜名湖',
  '07': '蒲郡', '08': '常滑', '09': '津', '10': '三国', '11': 'びわこ', '12': '住之江',
  '13': '尼崎', '14': '鳴門', '15': '丸亀', '16': '児島', '17': '宮島', '18': '徳山',
  '19': '下関', '20': '若松', '21': '芦屋', '22': '福岡', '23': '唐津', '24': '大村'
}

// 蒲郡（07）のルール定義
// 発掘データ: スタンダードモデル 655レース分析に基づく（2025年12月〜2026年1月）
const GAMAGORI_RULES = [
  // === 単勝ルール ===
  {
    id: 'G07-W001',
    patternName: 'GAMAGORI-WIN-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'win',
    stats: { samples: 55, hits: 12, recovery: 136 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'G07-W002',
    patternName: 'GAMAGORI-WIN-TOP3-INC4',
    description: '3号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 29, hits: 7, recovery: 199 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(4)
  },
  {
    id: 'G07-W003',
    patternName: 'GAMAGORI-WIN-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 25, hits: 7, recovery: 190 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },

  // === 複勝ルール ===
  {
    id: 'G07-P001',
    patternName: 'GAMAGORI-PLACE-TOP4-HC',
    description: '4号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 41, hits: 19, recovery: 135 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && conf >= 75
  },
  {
    id: 'G07-P002',
    patternName: 'GAMAGORI-PLACE-TOP2-INC1',
    description: '2号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 70, hits: 39, recovery: 113 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && has1
  },
  {
    id: 'G07-P003',
    patternName: 'GAMAGORI-PLACE-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 17, recovery: 134 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  }
]

// 福岡（22）のルール定義
// 発掘データ: スタンダードモデル 444レース詳細分析に基づく（2025年12月〜2026年1月）
const FUKUOKA_RULES = [
  // === 単勝ルール ===
  {
    id: 'F22-W001',
    patternName: 'FUKUOKA-WIN-TOP4-INC2',
    description: '4号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 13, hits: 5, recovery: 324 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(2)
  },
  {
    id: 'F22-W002',
    patternName: 'FUKUOKA-WIN-TOP4',
    description: '4号艇1着',
    betType: 'win',
    stats: { samples: 27, hits: 11, recovery: 227 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4
  },
  {
    id: 'F22-W003',
    patternName: 'FUKUOKA-WIN-TOP2-INC1',
    description: '2号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 29, hits: 14, recovery: 156 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && has1
  },

  // === 3連複ルール ===
  {
    id: 'F22-T001',
    patternName: 'FUKUOKA-TRIO-45X',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 44, hits: 4, recovery: 222 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'F22-T002',
    patternName: 'FUKUOKA-TRIO-NO1-HC',
    description: '1号艇含まない×conf80+',
    betType: 'trio',
    stats: { samples: 56, hits: 4, recovery: 193 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1 && conf >= 80
  },
  {
    id: 'F22-T003',
    patternName: 'FUKUOKA-TRIO-24X',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 70, hits: 6, recovery: 178 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },

  // === 複勝ルール ===
  {
    id: 'F22-P001',
    patternName: 'FUKUOKA-PLACE-TOP5-INC4',
    description: '5号艇1着+4号艇含む',
    betType: 'place',
    stats: { samples: 20, hits: 11, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(4)
  },
  {
    id: 'F22-P002',
    patternName: 'FUKUOKA-PLACE-TOP6-INC1',
    description: '6号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 19, hits: 8, recovery: 124 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && has1
  },
  {
    id: 'F22-P003',
    patternName: 'FUKUOKA-PLACE-TOP4-INC1',
    description: '4号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 17, hits: 11, recovery: 120 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && has1
  }
]

// 丸亀（15）のルール定義
// 発掘データ: スタンダードモデル 649レース詳細分析に基づく（2025年12月〜2026年1月）
// 注: 3連複は回収率100%超のルールがサンプル10以上で見つからなかった
const MARUGAME_RULES = [
  // === 単勝ルール ===
  {
    id: 'R15-W001',
    patternName: 'MARUGAME-WIN-TOP6-INC3',
    description: '6号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 3, recovery: 236 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && pred.top3.includes(3)
  },
  {
    id: 'R15-W002',
    patternName: 'MARUGAME-WIN-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 30, hits: 9, recovery: 205 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },
  {
    id: 'R15-W003',
    patternName: 'MARUGAME-WIN-TOP6-INC1',
    description: '6号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 35, hits: 4, recovery: 153 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && has1
  },

  // === 複勝ルール ===
  {
    id: 'R15-P001',
    patternName: 'MARUGAME-PLACE-TOP5-INC2',
    description: '5号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 12, recovery: 222 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(2)
  },
  {
    id: 'R15-P002',
    patternName: 'MARUGAME-PLACE-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 30, hits: 15, recovery: 193 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },
  {
    id: 'R15-P003',
    patternName: 'MARUGAME-PLACE-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 33, hits: 25, recovery: 165 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'R15-P004',
    patternName: 'MARUGAME-PLACE-TOP5',
    description: '5号艇1着',
    betType: 'place',
    stats: { samples: 56, hits: 24, recovery: 147 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5
  }
]

// びわこ（11）のルール定義
// 発掘データ: スタンダードモデル 534レース詳細分析に基づく（2025年12月〜2026年1月）
const BIWAKO_RULES = [
  // === 3連複ルール ===
  {
    id: 'B11-T001',
    patternName: 'BIWAKO-TRIO-56X',
    description: '5,6号艇含む',
    betType: 'trio',
    stats: { samples: 59, hits: 4, recovery: 185 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(5) && pred.top3.includes(6)
  },
  {
    id: 'B11-T002',
    patternName: 'BIWAKO-TRIO-46X',
    description: '4,6号艇含む',
    betType: 'trio',
    stats: { samples: 67, hits: 5, recovery: 174 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(6)
  },
  {
    id: 'B11-T003',
    patternName: 'BIWAKO-TRIO-16X',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 127, hits: 8, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },

  // === 単勝ルール ===
  {
    id: 'B11-W001',
    patternName: 'BIWAKO-WIN-TOP6-INC2',
    description: '6号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 5, recovery: 162 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && pred.top3.includes(2)
  },
  {
    id: 'B11-W002',
    patternName: 'BIWAKO-WIN-TOP2-INC4',
    description: '2号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 25, hits: 12, recovery: 160 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(4)
  },
  {
    id: 'B11-W003',
    patternName: 'BIWAKO-WIN-TOP1-MC',
    description: '1号艇1着×conf60-74',
    betType: 'win',
    stats: { samples: 13, hits: 6, recovery: 132 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 60 && conf < 75
  },

  // === 複勝ルール ===
  {
    id: 'B11-P001',
    patternName: 'BIWAKO-PLACE-TOP2-INC4',
    description: '2号艇1着+4号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 17, recovery: 127 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(4)
  },
  {
    id: 'B11-P002',
    patternName: 'BIWAKO-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 17, hits: 11, recovery: 122 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'B11-P003',
    patternName: 'BIWAKO-PLACE-TOP1-INC2',
    description: '1号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 124, hits: 105, recovery: 116 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(2)
  }
]

// 浜名湖（06）のルール定義
// 発掘データ: スタンダードモデル 624レース詳細分析に基づく（2025年12月〜2026年1月）
const HAMANAKO_RULES = [
  // === 3連複ルール ===
  {
    id: 'H06-T001',
    patternName: 'HAMANAKO-TRIO-26X',
    description: '2,6号艇含む',
    betType: 'trio',
    stats: { samples: 94, hits: 6, recovery: 485 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(6)
  },
  {
    id: 'H06-T002',
    patternName: 'HAMANAKO-TRIO-36X',
    description: '3,6号艇含む',
    betType: 'trio',
    stats: { samples: 87, hits: 2, recovery: 475 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(6)
  },
  {
    id: 'H06-T003',
    patternName: 'HAMANAKO-TRIO-23X',
    description: '2,3号艇含む',
    betType: 'trio',
    stats: { samples: 140, hits: 14, recovery: 396 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(3)
  },

  // === 単勝ルール ===
  {
    id: 'H06-W001',
    patternName: 'HAMANAKO-WIN-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 33, hits: 10, recovery: 231 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'H06-W002',
    patternName: 'HAMANAKO-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 46, hits: 12, recovery: 181 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'H06-W003',
    patternName: 'HAMANAKO-WIN-TOP3',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 78, hits: 20, recovery: 139 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },

  // === 複勝ルール ===
  {
    id: 'H06-P001',
    patternName: 'HAMANAKO-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 15, hits: 8, recovery: 215 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'H06-P002',
    patternName: 'HAMANAKO-PLACE-TOP3-INC6',
    description: '3号艇1着+6号艇含む',
    betType: 'place',
    stats: { samples: 27, hits: 18, recovery: 186 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(6)
  },
  {
    id: 'H06-P003',
    patternName: 'HAMANAKO-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 64, hits: 40, recovery: 141 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  }
]

// 三国（10）のルール定義
// 発掘データ: スタンダードモデル 511レース詳細分析に基づく（2025年12月〜2026年1月）
const MIKUNI_RULES = [
  // === 3連複ルール ===
  {
    id: 'M10-T001',
    patternName: 'MIKUNI-TRIO-24X',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 96, hits: 3, recovery: 1865 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'M10-T002',
    patternName: 'MIKUNI-TRIO-15X',
    description: '1,5号艇含む',
    betType: 'trio',
    stats: { samples: 129, hits: 6, recovery: 144 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(5)
  },

  // === 複勝ルール ===
  {
    id: 'M10-P001',
    patternName: 'MIKUNI-PLACE-TOP3-INC5',
    description: '3号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 18, hits: 11, recovery: 391 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(5)
  },
  {
    id: 'M10-P002',
    patternName: 'MIKUNI-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 46, hits: 30, recovery: 214 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'M10-P003',
    patternName: 'MIKUNI-PLACE-TOP2-HC',
    description: '2号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 64, hits: 43, recovery: 134 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 75
  },

  // === 単勝ルール ===
  {
    id: 'M10-W001',
    patternName: 'MIKUNI-WIN-TOP5-INC4',
    description: '5号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 4, recovery: 181 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(4)
  },
  {
    id: 'M10-W002',
    patternName: 'MIKUNI-WIN-TOP5-HC',
    description: '5号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 43, hits: 7, recovery: 140 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && conf >= 80
  }
]

// 江戸川（03）のルール定義
// 発掘データ: スタンダードモデル 492レース分析に基づく（2025年12月〜2026年1月）
const EDOGAWA_RULES = [
  // === 単勝ルール ===
  {
    id: 'E03-W003',
    patternName: 'EDOGAWA-WIN-TOP3-SUB1-MC',
    description: '3号艇1着+1号艇2着予測×conf70+',
    betType: 'win',
    stats: { samples: 21, hits: 10, recovery: 182 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3?.[1] === 1 && conf >= 70
  },
  {
    id: 'E03-W002',
    patternName: 'EDOGAWA-WIN-TOP2-EARLY',
    description: '2号艇1着予測×4R以前',
    betType: 'win',
    stats: { samples: 22, hits: 10, recovery: 148 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && raceNo <= 4
  },
  {
    id: 'E03-W004',
    patternName: 'EDOGAWA-WIN-TOP3-MC',
    description: '3号艇1着予測×conf70+',
    betType: 'win',
    stats: { samples: 50, hits: 16, recovery: 111 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 70
  },
  {
    id: 'E03-W005',
    patternName: 'EDOGAWA-WIN-TOP2-MC',
    description: '2号艇1着予測×conf75+',
    betType: 'win',
    stats: { samples: 60, hits: 22, recovery: 100 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 75
  },

  // === 3連複ルール ===
  {
    id: 'E03-T002',
    patternName: 'EDOGAWA-TRIO-123-LATE-HC',
    description: '予測123×9R以降×conf80+',
    betType: 'trio',
    stats: { samples: 30, hits: 5, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-3' && raceNo >= 9 && conf >= 80
  },
  {
    id: 'E03-T001-M',
    patternName: 'EDOGAWA-TRIO-12X-LATE-HC',
    description: '予測123or124×9R以降×conf80+',
    betType: 'trio',
    stats: { samples: 50, hits: 6, recovery: 113 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      ['1-2-4', '1-2-3'].includes(predSorted) && raceNo >= 9 && conf >= 80
  },
  {
    id: 'E03-T004-S',
    patternName: 'EDOGAWA-TRIO-INC1-MID-HC',
    description: '1号艇含む×5R以降×conf85+',
    betType: 'trio',
    stats: { samples: 228, hits: 20, recovery: 104 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 5 && conf >= 85
  },
  {
    id: 'E03-T004-L',
    patternName: 'EDOGAWA-TRIO-INC1-LATE-HC',
    description: '1号艇含む×9R以降×conf85+',
    betType: 'trio',
    stats: { samples: 134, hits: 11, recovery: 104 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 9 && conf >= 85
  },

  // === 複勝ルール ===
  {
    id: 'E03-P002',
    patternName: 'EDOGAWA-PLACE-TOP1-LATE',
    description: '1号艇1着予測×9R以降',
    betType: 'place',
    stats: { samples: 122, hits: 100, recovery: 113 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && raceNo >= 9
  },
  {
    id: 'E03-P003',
    patternName: 'EDOGAWA-PLACE-TOP1-HC',
    description: '1号艇1着予測×conf85+',
    betType: 'place',
    stats: { samples: 239, hits: 185, recovery: 111 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  }
]

// 下関（19）のルール定義
// 発掘データ: スタンダードモデル 480レース詳細分析に基づく（2025年12月〜2026年1月）
const SHIMONOSEKI_RULES = [
  // === 単勝ルール ===
  {
    id: 'S19-W001',
    patternName: 'SHIMONOSEKI-WIN-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 20, hits: 5, recovery: 217 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'S19-W002',
    patternName: 'SHIMONOSEKI-WIN-TOP5-INC3',
    description: '5号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 15, hits: 3, recovery: 207 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(3)
  },
  {
    id: 'S19-W003',
    patternName: 'SHIMONOSEKI-WIN-TOP5-INC2',
    description: '5号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 18, hits: 3, recovery: 178 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(2)
  },
  {
    id: 'S19-W004',
    patternName: 'SHIMONOSEKI-WIN-TOP2-INC3',
    description: '2号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 9, recovery: 166 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(3)
  },

  // === 複勝ルール ===
  {
    id: 'S19-P001',
    patternName: 'SHIMONOSEKI-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 11, hits: 6, recovery: 215 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'S19-P002',
    patternName: 'SHIMONOSEKI-PLACE-TOP2-INC5',
    description: '2号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 16, hits: 5, recovery: 168 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(5)
  },
  {
    id: 'S19-P003',
    patternName: 'SHIMONOSEKI-PLACE-TOP4-INC6',
    description: '4号艇1着+6号艇含む',
    betType: 'place',
    stats: { samples: 14, hits: 6, recovery: 151 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(6)
  },
  {
    id: 'S19-P004',
    patternName: 'SHIMONOSEKI-PLACE-TOP2-HC',
    description: '2号艇1着×conf80+',
    betType: 'place',
    stats: { samples: 47, hits: 24, recovery: 126 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  },

  // === 3連複ルール ===
  {
    id: 'S19-T001',
    patternName: 'SHIMONOSEKI-TRIO-35X',
    description: '3,5号艇含む',
    betType: 'trio',
    stats: { samples: 57, hits: 4, recovery: 122 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(5)
  },
  {
    id: 'S19-T002',
    patternName: 'SHIMONOSEKI-TRIO-23X',
    description: '2,3号艇含む',
    betType: 'trio',
    stats: { samples: 117, hits: 15, recovery: 107 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(3)
  }
]

// 桐生（01）のルール定義
const KIRYU_RULES = [
  {
    id: 'K01-W002',
    patternName: 'KIRYU-WIN-W002',
    description: '1号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 67, hits: 43, recovery: 105 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(4)
  },
  {
    id: 'K01-P006',
    patternName: 'KIRYU-PLACE-P006',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 186, hits: 162, recovery: 105 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'K01-T005',
    patternName: 'KIRYU-TRIO-T005',
    description: '1号艇含まない×conf80+',
    betType: 'trio',
    stats: { samples: 35, hits: 1, recovery: 951 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      conf >= 80 && !has1
  },
  {
    id: 'K01-T010',
    patternName: 'KIRYU-TRIO-T010',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 131, hits: 25, recovery: 392 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  }
]

// 戸田（02）のルール定義
const TODA_RULES = [
  {
    id: 'T02-W004',
    patternName: 'TODA-WIN-W004',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 39, hits: 11, recovery: 121 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'T02-P004',
    patternName: 'TODA-PLACE-P004',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 191, hits: 166, recovery: 132 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'T02-P002',
    patternName: 'TODA-PLACE-P002',
    description: '後半R(10R〜)複勝',
    betType: 'place',
    stats: { samples: 91, hits: 71, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'T02-T008',
    patternName: 'TODA-TRIO-T008',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 123, hits: 39, recovery: 689 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
  {
    id: 'T02-T005',
    patternName: 'TODA-TRIO-T005',
    description: '3,4号艇含む',
    betType: 'trio',
    stats: { samples: 47, hits: 13, recovery: 821 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(4)
  }
]

// 平和島（04）のルール定義
const HEIWAJIMA_RULES = [
  {
    id: 'H04-P005',
    patternName: 'HEIWAJIMA-PLACE-P005',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 233, hits: 194, recovery: 128 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'H04-P003',
    patternName: 'HEIWAJIMA-PLACE-P003',
    description: '後半R(10R〜)複勝',
    betType: 'place',
    stats: { samples: 105, hits: 75, recovery: 144 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'H04-T001',
    patternName: 'HEIWAJIMA-TRIO-T001',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 37, hits: 7, recovery: 1165 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'H04-T003',
    patternName: 'HEIWAJIMA-TRIO-T003',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 81, hits: 18, recovery: 768 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'H04-T007',
    patternName: 'HEIWAJIMA-TRIO-T007',
    description: '1号艇含まない',
    betType: 'trio',
    stats: { samples: 63, hits: 8, recovery: 601 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1
  }
]

// 多摩川（05）のルール定義
const TAMAGAWA_RULES = [
  {
    id: 'TM05-P008',
    patternName: 'TAMAGAWA-PLACE-P008',
    description: '2号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 76, hits: 54, recovery: 138 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2
  },
  {
    id: 'TM05-P005',
    patternName: 'TAMAGAWA-PLACE-P005',
    description: '2号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 61, hits: 44, recovery: 145 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  },
  {
    id: 'TM05-T002',
    patternName: 'TAMAGAWA-TRIO-T002',
    description: '5,6号艇含む',
    betType: 'trio',
    stats: { samples: 57, hits: 8, recovery: 944 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(5) && pred.top3.includes(6)
  },
  {
    id: 'TM05-T005',
    patternName: 'TAMAGAWA-TRIO-T005',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 96, hits: 15, recovery: 687 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },
  {
    id: 'TM05-T011',
    patternName: 'TAMAGAWA-TRIO-T011',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 296, hits: 62, recovery: 459 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  }
]

// 常滑（08）のルール定義
const TOKONAME_RULES = [
  {
    id: 'TK08-W005',
    patternName: 'TOKONAME-WIN-W005',
    description: '1号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 92, hits: 60, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(4)
  },
  {
    id: 'TK08-P011',
    patternName: 'TOKONAME-PLACE-P011',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 219, hits: 193, recovery: 106 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TK08-P003',
    patternName: 'TOKONAME-PLACE-P003',
    description: '3号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 53, hits: 34, recovery: 140 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 80
  },
  {
    id: 'TK08-T002',
    patternName: 'TOKONAME-TRIO-T002',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 47, hits: 13, recovery: 858 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'TK08-T005',
    patternName: 'TOKONAME-TRIO-T005',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 150, hits: 35, recovery: 524 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  }
]

// 津（09）のルール定義
const TSU_RULES = [
  {
    id: 'TS09-W003',
    patternName: 'TSU-WIN-W003',
    description: '1号艇1着+5号艇含む',
    betType: 'win',
    stats: { samples: 55, hits: 36, recovery: 118 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(5)
  },
  {
    id: 'TS09-P004',
    patternName: 'TSU-PLACE-P004',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 172, hits: 149, recovery: 106 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TS09-T001',
    patternName: 'TSU-TRIO-T001',
    description: '1,3,4号艇',
    betType: 'trio',
    stats: { samples: 32, hits: 8, recovery: 764 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-3-4'
  },
  {
    id: 'TS09-T002',
    patternName: 'TSU-TRIO-T002',
    description: '3,4号艇含む',
    betType: 'trio',
    stats: { samples: 51, hits: 9, recovery: 588 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(4)
  },
  {
    id: 'TS09-T005',
    patternName: 'TSU-TRIO-T005',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 127, hits: 28, recovery: 397 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  }
]

// 尼崎（13）のルール定義
const AMAGASAKI_RULES = [
  {
    id: 'A13-W008',
    patternName: 'AMAGASAKI-WIN-W008',
    description: '1号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 187, hits: 127, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 80
  },
  {
    id: 'A13-T004',
    patternName: 'AMAGASAKI-TRIO-T004',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 51, hits: 7, recovery: 671 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'A13-T005',
    patternName: 'AMAGASAKI-TRIO-T005',
    description: '3,6号艇含む',
    betType: 'trio',
    stats: { samples: 42, hits: 5, recovery: 541 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(6)
  },
  {
    id: 'A13-T008',
    patternName: 'AMAGASAKI-TRIO-T008',
    description: '1,5号艇含む',
    betType: 'trio',
    stats: { samples: 120, hits: 21, recovery: 419 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(5)
  }
]

// 鳴門（14）のルール定義
const NARUTO_RULES = [
  {
    id: 'N14-P006',
    patternName: 'NARUTO-PLACE-P006',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 205, hits: 170, recovery: 104 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'N14-T005',
    patternName: 'NARUTO-TRIO-T005',
    description: '後半R×1号艇含む',
    betType: 'trio',
    stats: { samples: 92, hits: 18, recovery: 678 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'N14-T009',
    patternName: 'NARUTO-TRIO-T009',
    description: '1,2号艇含む',
    betType: 'trio',
    stats: { samples: 199, hits: 46, recovery: 577 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2)
  },
  {
    id: 'N14-T015',
    patternName: 'NARUTO-TRIO-T015',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 296, hits: 63, recovery: 522 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  }
]

// 児島（16）のルール定義
const KOJIMA_RULES = [
  {
    id: 'KJ16-W006',
    patternName: 'KOJIMA-WIN-W006',
    description: '4号艇1着',
    betType: 'win',
    stats: { samples: 44, hits: 10, recovery: 123 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4
  },
  {
    id: 'KJ16-P002',
    patternName: 'KOJIMA-PLACE-P002',
    description: '4号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 36, hits: 26, recovery: 170 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && conf >= 80
  },
  {
    id: 'KJ16-P010',
    patternName: 'KOJIMA-PLACE-P010',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 156, hits: 142, recovery: 119 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'KJ16-T001',
    patternName: 'KOJIMA-TRIO-T001',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 43, hits: 11, recovery: 798 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'KJ16-T003',
    patternName: 'KOJIMA-TRIO-T003',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 120, hits: 23, recovery: 471 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  }
]

// 宮島（17）のルール定義
const MIYAJIMA_RULES = [
  {
    id: 'MY17-W001',
    patternName: 'MIYAJIMA-WIN-W001',
    description: '1号艇1着×後半R',
    betType: 'win',
    stats: { samples: 56, hits: 43, recovery: 121 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'MY17-P003',
    patternName: 'MIYAJIMA-PLACE-P003',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 190, hits: 163, recovery: 114 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'MY17-P002',
    patternName: 'MIYAJIMA-PLACE-P002',
    description: '3号艇1着+1号艇含む(複勝)',
    betType: 'place',
    stats: { samples: 44, hits: 37, recovery: 125 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'MY17-T002',
    patternName: 'MIYAJIMA-TRIO-T002',
    description: '1,2,6号艇',
    betType: 'trio',
    stats: { samples: 30, hits: 8, recovery: 1129 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-6'
  },
  {
    id: 'MY17-T003',
    patternName: 'MIYAJIMA-TRIO-T003',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 101, hits: 20, recovery: 780 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  }
]

// 徳山（18）のルール定義
const TOKUYAMA_RULES = [
  {
    id: 'TY18-W005',
    patternName: 'TOKUYAMA-WIN-W005',
    description: '3号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 43, hits: 11, recovery: 175 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 80
  },
  {
    id: 'TY18-W006',
    patternName: 'TOKUYAMA-WIN-W006',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 59, hits: 16, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'TY18-P007',
    patternName: 'TOKUYAMA-PLACE-P007',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 206, hits: 184, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TY18-T012',
    patternName: 'TOKUYAMA-TRIO-T012',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 279, hits: 71, recovery: 647 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  },
  {
    id: 'TY18-T007',
    patternName: 'TOKUYAMA-TRIO-T007',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 81, hits: 15, recovery: 779 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  }
]

// 若松（20）のルール定義
const WAKAMATSU_RULES = [
  {
    id: 'W20-T006',
    patternName: 'WAKAMATSU-TRIO-T006',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 111, hits: 20, recovery: 453 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  },
  {
    id: 'W20-T009',
    patternName: 'WAKAMATSU-TRIO-T009',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 117, hits: 30, recovery: 402 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
  {
    id: 'W20-T012',
    patternName: 'WAKAMATSU-TRIO-T012',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 236, hits: 42, recovery: 344 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  }
]

// 芦屋（21）のルール定義
const ASHIYA_RULES = [
  {
    id: 'AS21-W009',
    patternName: 'ASHIYA-WIN-W009',
    description: '後半R(10R〜)単勝',
    betType: 'win',
    stats: { samples: 95, hits: 47, recovery: 112 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'AS21-P001',
    patternName: 'ASHIYA-PLACE-P001',
    description: '3号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 46, hits: 33, recovery: 132 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'AS21-T002',
    patternName: 'ASHIYA-TRIO-T002',
    description: '後半R×1号艇含まない',
    betType: 'trio',
    stats: { samples: 32, hits: 4, recovery: 7417 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12 && !has1
  },
  {
    id: 'AS21-T003',
    patternName: 'ASHIYA-TRIO-T003',
    description: '4,6号艇含む',
    betType: 'trio',
    stats: { samples: 42, hits: 5, recovery: 4800 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(6)
  },
  {
    id: 'AS21-T005',
    patternName: 'ASHIYA-TRIO-T005',
    description: '2,6号艇含む',
    betType: 'trio',
    stats: { samples: 62, hits: 6, recovery: 3734 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(6)
  }
]

// 唐津（23）のルール定義
const KARATSU_RULES = [
  {
    id: 'KR23-W005',
    patternName: 'KARATSU-WIN-W005',
    description: '1号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 195, hits: 132, recovery: 101 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 80
  },
  {
    id: 'KR23-W002',
    patternName: 'KARATSU-WIN-W002',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 31, hits: 5, recovery: 152 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'KR23-P010',
    patternName: 'KARATSU-PLACE-P010',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 228, hits: 198, recovery: 110 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'KR23-P007',
    patternName: 'KARATSU-PLACE-P007',
    description: '3号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 31, hits: 22, recovery: 154 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'KR23-T003',
    patternName: 'KARATSU-TRIO-T003',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 77, hits: 17, recovery: 678 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },
  {
    id: 'KR23-T005',
    patternName: 'KARATSU-TRIO-T005',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 80, hits: 22, recovery: 563 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  }
]

// 大村（24）のルール定義
const OMURA_RULES = [
  {
    id: 'O24-W002',
    patternName: 'OMURA-WIN-W002',
    description: '1号艇1着+5号艇含む',
    betType: 'win',
    stats: { samples: 60, hits: 41, recovery: 109 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(5)
  },
  {
    id: 'O24-P003',
    patternName: 'OMURA-PLACE-P003',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 255, hits: 221, recovery: 113 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'O24-T002',
    patternName: 'OMURA-TRIO-T002',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 63, hits: 15, recovery: 871 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'O24-T001',
    patternName: 'OMURA-TRIO-T001',
    description: '1,3,5号艇',
    betType: 'trio',
    stats: { samples: 30, hits: 7, recovery: 1044 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-3-5'
  },
  {
    id: 'O24-T004',
    patternName: 'OMURA-TRIO-T004',
    description: '後半R×1号艇含む',
    betType: 'trio',
    stats: { samples: 94, hits: 21, recovery: 760 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 10 && raceNo <= 12
  }
]

// 会場コードごとのルール
const VENUE_RULES = {
  '01': KIRYU_RULES,
  '02': TODA_RULES,
  '03': EDOGAWA_RULES,
  '04': HEIWAJIMA_RULES,
  '05': TAMAGAWA_RULES,
  '06': HAMANAKO_RULES,
  '07': GAMAGORI_RULES,
  '08': TOKONAME_RULES,
  '09': TSU_RULES,
  '10': MIKUNI_RULES,
  '11': BIWAKO_RULES,
  '13': AMAGASAKI_RULES,
  '14': NARUTO_RULES,
  '15': MARUGAME_RULES,
  '16': KOJIMA_RULES,
  '17': MIYAJIMA_RULES,
  '18': TOKUYAMA_RULES,
  '19': SHIMONOSEKI_RULES,
  '20': WAKAMATSU_RULES,
  '21': ASHIYA_RULES,
  '22': FUKUOKA_RULES,
  '23': KARATSU_RULES,
  '24': OMURA_RULES
}

/**
 * 予測に対してマッチするルールを取得
 * @param {Object} prediction - 予測データ
 * @param {string} venueCode - 会場コード（2桁の文字列）
 * @param {number} raceNo - レース番号（1-12）
 * @returns {Array} マッチしたルールの配列
 */
export function getMatchingRules(prediction, venueCode, raceNo) {
  const rules = VENUE_RULES[venueCode]
  if (!rules) return []

  const conf = prediction.confidence || 0
  const top3 = prediction.top3 || [prediction.topPick, prediction.top2nd, prediction.top3rd]
  const predSorted = [...top3].sort((a, b) => a - b).join('-')
  const has1 = top3.includes(1)

  const matchedRules = []

  for (const rule of rules) {
    try {
      if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
        matchedRules.push({
          id: rule.id,
          patternName: rule.patternName,
          description: rule.description,
          betType: rule.betType,
          stats: rule.stats,
          reliability: rule.reliability
        })
      }
    } catch (e) {
      // ルールチェック中のエラーは無視
    }
  }

  // 回収率順にソート（高い順）
  matchedRules.sort((a, b) => b.stats.recovery - a.stats.recovery)

  return matchedRules
}

/**
 * 賭け方の日本語名を取得
 */
export function getBetTypeName(betType) {
  const names = {
    'trio': '3連複',
    'trifecta': '3連単',
    'win': '単勝',
    'place': '複勝'
  }
  return names[betType] || betType
}

/**
 * 信頼性レベルの日本語名を取得
 */
export function getReliabilityName(reliability) {
  const names = {
    'highest': '最高',
    'high': '高',
    'medium': '中',
    'low': '低'
  }
  return names[reliability] || reliability
}

/**
 * ルールが登録されている会場かどうか
 */
export function hasRulesForVenue(venueCode) {
  return !!VENUE_RULES[venueCode]
}

/**
 * 会場のルール一覧を取得
 */
export function getRulesForVenue(venueCode) {
  return VENUE_RULES[venueCode] || []
}

/**
 * 会場名を取得
 */
export function getVenueName(venueCode) {
  return VENUE_NAMES[venueCode] || `会場${venueCode}`
}

/**
 * 今日のルールマッチレースを取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {Promise<Array>} マッチしたレースの配列
 */
export async function getTodaysMatchingRaces(date) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return []
  }

  // 予測データを取得（standardモデルのみ）
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .like('race_id', `${date}-%`)
    .eq('model_id', 'standard')

  if (predError) {
    console.error('予測取得エラー:', predError.message)
    return []
  }

  if (!predictions || predictions.length === 0) {
    return []
  }

  // 結果データを取得
  const raceIds = predictions.map(p => p.race_id)
  const { data: results, error: resError } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds)

  const resultsMap = {}
  if (!resError && results) {
    results.forEach(r => { resultsMap[r.race_id] = r })
  }

  // レース情報を取得（締切時刻）
  const { data: races, error: raceError } = await supabase
    .from('races')
    .select('race_id, start_time')
    .in('race_id', raceIds)

  const racesMap = {}
  if (!raceError && races) {
    races.forEach(r => { racesMap[r.race_id] = r })
  }

  // ルールマッチング
  const matchedRaces = []

  for (const pred of predictions) {
    // race_id形式: YYYY-MM-DD-XX-RR (XX=会場コード, RR=レース番号)
    const parts = pred.race_id.split('-')
    const venueCode = parts[3]
    const raceNo = parseInt(parts[4])

    // 予測データをフロントエンド形式に変換
    const prediction = {
      confidence: pred.confidence,
      topPick: pred.top_pick,
      top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
    }

    const rules = getMatchingRules(prediction, venueCode, raceNo)

    if (rules.length > 0) {
      const result = resultsMap[pred.race_id]
      const raceInfo = racesMap[pred.race_id]

      // 的中判定
      let hitInfo = null
      if (result) {
        const predSorted = [...prediction.top3].sort((a, b) => a - b).join('-')
        const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')

        for (const rule of rules) {
          if (rule.betType === 'trio') {
            // 3連複: 順不同で3艇を当てる（payout_trifecta）
            const isHit = predSorted === resultSorted
            if (isHit) {
              hitInfo = { hit: true, payout: result.payout_trifecta || 0 }
              break
            }
          } else if (rule.betType === 'win') {
            const isHit = prediction.topPick === result.rank1
            if (isHit) {
              hitInfo = { hit: true, payout: result.payout_win || 0 }
              break
            }
          } else if (rule.betType === 'place') {
            const isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
            if (isHit) {
              const payout = prediction.topPick === result.rank1
                ? (result.payout_place_1 || 0)
                : (result.payout_place_2 || 0)
              hitInfo = { hit: true, payout }
              break
            }
          }
        }

        if (!hitInfo) {
          hitInfo = { hit: false, payout: 0 }
        }
      }

      matchedRaces.push({
        raceId: pred.race_id,
        venueCode,
        venueName: getVenueName(venueCode),
        raceNo,
        startTime: raceInfo?.start_time || null,
        prediction,
        rules,
        result: result ? {
          finished: true,
          rank1: result.rank1,
          rank2: result.rank2,
          rank3: result.rank3,
          payout_trio: result.payout_trio,
          payout_win: result.payout_win,
          payout_place_1: result.payout_place_1,
          payout_place_2: result.payout_place_2
        } : null,
        hitInfo
      })
    }
  }

  // レース番号順にソート
  matchedRaces.sort((a, b) => {
    if (a.venueCode !== b.venueCode) {
      return a.venueCode.localeCompare(b.venueCode)
    }
    return a.raceNo - b.raceNo
  })

  return matchedRaces
}

/**
 * ルールが登録されている会場のリストを取得
 */
export function getAvailableVenues() {
  return Object.keys(VENUE_RULES).map(code => ({
    code,
    name: VENUE_NAMES[code]
  }))
}

/**
 * 会場別ルール運用成績を取得
 * @param {string} venueCode - 会場コード
 * @param {string} startDate - 運用開始日（YYYY-MM-DD形式）
 * @returns {Promise<Object>} ルール別成績と全体成績
 */
export async function getRulePerformanceByVenue(venueCode, startDate = '2026-01-16') {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  const rules = VENUE_RULES[venueCode]
  if (!rules) {
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  // 予測データを取得（クエリレベルで会場フィルタ）
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .like('race_id', `%-${venueCode}-%`)
    .gte('predicted_at', startDate)
    .eq('model_id', 'standard')

  if (predError || !predictions) {
    console.error('予測取得エラー:', predError?.message)
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  // 結果データを取得
  const raceIds = predictions.map(p => p.race_id)
  if (raceIds.length === 0) {
    // ルール一覧は返すが、サンプル0
    return {
      byRule: rules.map(r => ({
        ruleId: r.id,
        description: r.description,
        betType: r.betType,
        samples: 0,
        hits: 0,
        hitRate: 0,
        recovery: 0
      })),
      total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 },
      startDate
    }
  }

  const { data: results } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds)

  const resultsMap = {}
  if (results) {
    results.forEach(r => { resultsMap[r.race_id] = r })
  }

  // ルール別に集計
  const ruleStats = {}
  rules.forEach(r => {
    ruleStats[r.id] = {
      ruleId: r.id,
      description: r.description,
      betType: r.betType,
      samples: 0,
      hits: 0,
      totalPayout: 0
    }
  })

  // デフォルトの運用開始日（既存ルールはこの日以降から集計）
  const DEFAULT_ADDED_DATE = '2026-01-16'

  // LIKEクエリは日付にもマッチする可能性があるため、JS側で会場コードを再検証
  const filteredPredictions = predictions.filter(pred => {
    const parts = pred.race_id.split('-')
    return parts[3] === venueCode
  })

  for (const pred of filteredPredictions) {
    const parts = pred.race_id.split('-')
    const raceNo = parseInt(parts[4])
    const raceDate = parts.slice(0, 3).join('-') // YYYY-MM-DD

    const prediction = {
      confidence: pred.confidence,
      topPick: pred.top_pick,
      top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
    }

    const conf = prediction.confidence || 0
    const top3 = prediction.top3
    const predSorted = [...top3].sort((a, b) => a - b).join('-')
    const has1 = top3.includes(1)

    const result = resultsMap[pred.race_id]

    for (const rule of rules) {
      try {
        // ルールの運用開始日より前のデータはスキップ
        const ruleAddedDate = rule.addedDate || DEFAULT_ADDED_DATE
        if (raceDate < ruleAddedDate) continue

        if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
          // 結果確定分のみカウント
          if (result) {
            ruleStats[rule.id].samples++

            // 的中判定
            let isHit = false
            let payout = 0

            if (rule.betType === 'trio') {
              // 3連複: 順不同で3艇を当てる（payout_trifecta）
              const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
              isHit = predSorted === resultSorted
              payout = result.payout_trifecta || 0
            } else if (rule.betType === 'win') {
              isHit = prediction.topPick === result.rank1
              payout = result.payout_win || 0
            } else if (rule.betType === 'place') {
              isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
              payout = prediction.topPick === result.rank1
                ? (result.payout_place_1 || 0)
                : (result.payout_place_2 || 0)
            }

            if (isHit) {
              ruleStats[rule.id].hits++
              ruleStats[rule.id].totalPayout += payout
            }
          }
        }
      } catch (e) {
        // ルールチェック中のエラーは無視
      }
    }
  }

  // 集計結果をフォーマット
  const byRule = Object.values(ruleStats).map(stat => ({
    ruleId: stat.ruleId,
    description: stat.description,
    betType: stat.betType,
    samples: stat.samples,
    hits: stat.hits,
    hitRate: stat.samples > 0 ? Math.round((stat.hits / stat.samples) * 100) : 0,
    recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
  }))

  // 全体集計
  const totalSamples = byRule.reduce((sum, r) => sum + r.samples, 0)
  const totalHits = byRule.reduce((sum, r) => sum + r.hits, 0)
  const totalPayout = Object.values(ruleStats).reduce((sum, r) => sum + r.totalPayout, 0)

  return {
    byRule,
    total: {
      samples: totalSamples,
      hits: totalHits,
      hitRate: totalSamples > 0 ? Math.round((totalHits / totalSamples) * 100) : 0,
      recovery: totalSamples > 0 ? Math.round((totalPayout / (totalSamples * 100)) * 100) : 0
    },
    startDate
  }
}

/**
 * 全会場のルールを横断して、運用成績（回収率）トップN件を取得
 * @param {number} limit - 取得件数（デフォルト10）
 * @returns {Promise<Array>} 回収率順のルール一覧
 */
export async function getTopPerformingRules({ limit = null, minRecovery = null, minSamples = 1 } = {}) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return []
  }

  const DEFAULT_ADDED_DATE = '2026-01-16'

  // 全予測データを取得（ページネーションで1000行制限を回避）
  const allPredictions = await fetchAllPredictions(DEFAULT_ADDED_DATE, 'standard')

  if (!allPredictions || allPredictions.length === 0) {
    return []
  }

  // 全結果データを取得（バッチ処理で1000件制限を回避）
  const raceIds = allPredictions.map(p => p.race_id)
  if (raceIds.length === 0) return []

  const results = await fetchResultsByRaceIds(raceIds)

  const resultsMap = {}
  results.forEach(r => { resultsMap[r.race_id] = r })

  // 全会場・全ルールを集計
  const ruleStats = {}

  for (const [venueCode, rules] of Object.entries(VENUE_RULES)) {
    const venueName = VENUE_NAMES[venueCode]

    // 該当会場の予測のみフィルタ
    const venuePredictions = allPredictions.filter(p => {
      const parts = p.race_id.split('-')
      return parts[3] === venueCode
    })

    for (const rule of rules) {
      const ruleAddedDate = rule.addedDate || DEFAULT_ADDED_DATE

      ruleStats[rule.id] = {
        ruleId: rule.id,
        venueName,
        venueCode,
        description: rule.description,
        betType: rule.betType,
        samples: 0,
        hits: 0,
        totalPayout: 0
      }

      for (const pred of venuePredictions) {
        const parts = pred.race_id.split('-')
        const raceNo = parseInt(parts[4])
        const raceDate = parts.slice(0, 3).join('-')

        // ルールの運用開始日より前のデータはスキップ
        if (raceDate < ruleAddedDate) continue

        const prediction = {
          confidence: pred.confidence,
          topPick: pred.top_pick,
          top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
        }

        const conf = prediction.confidence || 0
        const top3 = prediction.top3
        const predSorted = [...top3].sort((a, b) => a - b).join('-')
        const has1 = top3.includes(1)

        const result = resultsMap[pred.race_id]

        try {
          if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
            if (result) {
              ruleStats[rule.id].samples++

              let isHit = false
              let payout = 0

              if (rule.betType === 'trio') {
                // 3連複: 順不同で3艇を当てる（payout_trifecta）
                const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
                isHit = predSorted === resultSorted
                payout = result.payout_trifecta || 0
              } else if (rule.betType === 'win') {
                isHit = prediction.topPick === result.rank1
                payout = result.payout_win || 0
              } else if (rule.betType === 'place') {
                isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
                payout = prediction.topPick === result.rank1
                  ? (result.payout_place_1 || 0)
                  : (result.payout_place_2 || 0)
              }

              if (isHit) {
                ruleStats[rule.id].hits++
                ruleStats[rule.id].totalPayout += payout
              }
            }
          }
        } catch (e) {
          // ルールチェック中のエラーは無視
        }
      }
    }
  }

  // 回収率を計算してソート
  return Object.values(ruleStats)
    .map(stat => ({
      ruleId: stat.ruleId,
      venueName: stat.venueName,
      venueCode: stat.venueCode,
      description: stat.description,
      betType: stat.betType,
      samples: stat.samples,
      hits: stat.hits,
      hitRate: stat.samples > 0 ? Math.round((stat.hits / stat.samples) * 100) : 0,
      recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
    }))
    .filter(r => r.samples >= minSamples) // サンプルminSamples件以上
    .filter(r => minRecovery === null || r.recovery >= minRecovery) // 回収率フィルタ
    .sort((a, b) => {
      // 回収率で降順、同じなら的中数で降順
      if (b.recovery !== a.recovery) return b.recovery - a.recovery
      return b.hits - a.hits
    })
    .slice(0, limit || Infinity) // limitがnullなら全件
}

/**
 * 回収率トップNルールの週別パフォーマンスを取得
 * @param {number} topN - 上位N件のルールに絞る（デフォルト10）
 * @returns {Promise<Object>} { rules: [...], weeklyData: [...], currentWeek: number }
 */
export async function getTopRulesWeeklyPerformance(topN = 10) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { rules: [], weeklyData: [], currentWeek: 1 }
  }

  const DEFAULT_ADDED_DATE = '2026-01-16'

  // 週の開始日（2026-01-16を週1の開始とする）
  const WEEK_START = new Date('2026-01-16')

  // 日付を週番号に変換
  function getWeekNumber(dateStr) {
    const date = new Date(dateStr)
    const diffTime = date - WEEK_START
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
  }

  // 週番号をラベルに変換
  function getWeekLabel(weekNum) {
    return `Week${weekNum}`
  }

  // 全予測データを取得（ページネーションで1000行制限を回避）
  const allPredictions = await fetchAllPredictions(DEFAULT_ADDED_DATE, 'standard')

  if (!allPredictions || allPredictions.length === 0) {
    return { rules: [], weeklyData: [], currentWeek: 1 }
  }

  // 全結果データを取得（バッチ処理で1000件制限を回避）
  const raceIds = allPredictions.map(p => p.race_id)
  if (raceIds.length === 0) return { rules: [], weeklyData: [], currentWeek: 1 }

  const results = await fetchResultsByRaceIds(raceIds)

  const resultsMap = {}
  results.forEach(r => { resultsMap[r.race_id] = r })

  // 現在の週番号を計算
  const today = new Date()
  const currentWeek = getWeekNumber(today.toISOString().slice(0, 10))

  // 週の範囲を決定（Week1から現在週まで）
  const weeks = []
  for (let w = 1; w <= currentWeek; w++) {
    weeks.push(w)
  }

  // ルールごと・週ごとの統計を集計
  // { [ruleId]: { [weekNum]: { samples, hits, totalPayout } } }
  const ruleWeeklyStats = {}
  const ruleTotalStats = {} // 全期間の集計（トップN抽出用）

  for (const [venueCode, rules] of Object.entries(VENUE_RULES)) {
    const venueName = VENUE_NAMES[venueCode]
    const venuePredictions = allPredictions.filter(p => {
      const parts = p.race_id.split('-')
      return parts[3] === venueCode
    })

    for (const rule of rules) {
      const ruleAddedDate = rule.addedDate || DEFAULT_ADDED_DATE

      ruleWeeklyStats[rule.id] = {}
      ruleTotalStats[rule.id] = {
        ruleId: rule.id,
        venueName,
        venueCode,
        betType: rule.betType,
        samples: 0,
        hits: 0,
        totalPayout: 0
      }

      for (const pred of venuePredictions) {
        const parts = pred.race_id.split('-')
        const raceNo = parseInt(parts[4])
        const raceDate = parts.slice(0, 3).join('-')

        if (raceDate < ruleAddedDate) continue

        const prediction = {
          confidence: pred.confidence,
          topPick: pred.top_pick,
          top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
        }

        const conf = prediction.confidence || 0
        const top3 = prediction.top3
        const predSorted = [...top3].sort((a, b) => a - b).join('-')
        const has1 = top3.includes(1)
        const result = resultsMap[pred.race_id]

        try {
          if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
            if (result) {
              const weekNum = getWeekNumber(raceDate)

              // 週別統計を初期化
              if (!ruleWeeklyStats[rule.id][weekNum]) {
                ruleWeeklyStats[rule.id][weekNum] = { samples: 0, hits: 0, totalPayout: 0 }
              }

              let isHit = false
              let payout = 0

              if (rule.betType === 'trio') {
                // 3連複: 順不同で3艇を当てる（payout_trifecta）
                const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
                isHit = predSorted === resultSorted
                payout = result.payout_trifecta || 0
              } else if (rule.betType === 'win') {
                isHit = prediction.topPick === result.rank1
                payout = result.payout_win || 0
              } else if (rule.betType === 'place') {
                isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
                payout = prediction.topPick === result.rank1
                  ? (result.payout_place_1 || 0)
                  : (result.payout_place_2 || 0)
              }

              // 週別統計を更新
              ruleWeeklyStats[rule.id][weekNum].samples++
              if (isHit) {
                ruleWeeklyStats[rule.id][weekNum].hits++
                ruleWeeklyStats[rule.id][weekNum].totalPayout += payout
              }

              // 全期間統計を更新
              ruleTotalStats[rule.id].samples++
              if (isHit) {
                ruleTotalStats[rule.id].hits++
                ruleTotalStats[rule.id].totalPayout += payout
              }
            }
          }
        } catch (e) {
          // ルールチェック中のエラーは無視
        }
      }
    }
  }

  // 回収率でソートしてトップNを抽出
  const topRules = Object.values(ruleTotalStats)
    .map(stat => ({
      ...stat,
      recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
    }))
    .filter(r => r.samples >= 10 && r.recovery >= 100) // 回収率100%以上、10件以上
    .sort((a, b) => b.recovery - a.recovery)
    .slice(0, topN)

  const topRuleIds = topRules.map(r => r.ruleId)

  // 週別データを生成（累積値）
  const cumulativeStats = {} // { [ruleId]: { samples, totalPayout } }
  for (const ruleId of topRuleIds) {
    cumulativeStats[ruleId] = { samples: 0, totalPayout: 0 }
  }

  const weeklyData = weeks.map(weekNum => {
    const weekData = { week: getWeekLabel(weekNum) }
    for (const ruleId of topRuleIds) {
      const weekStats = ruleWeeklyStats[ruleId]?.[weekNum]
      if (weekStats) {
        // 累積値を更新
        cumulativeStats[ruleId].samples += weekStats.samples
        cumulativeStats[ruleId].totalPayout += weekStats.totalPayout
      }
      // 累積回収率を計算
      const cumStats = cumulativeStats[ruleId]
      if (cumStats.samples > 0) {
        weekData[ruleId] = Math.round((cumStats.totalPayout / (cumStats.samples * 100)) * 100)
      } else {
        weekData[ruleId] = null
      }
    }
    return weekData
  })

  return {
    rules: topRuleIds,
    ruleDetails: topRules,
    weeklyData,
    currentWeek
  }
}

/**
 * 特定会場のトップルール週別パフォーマンスを取得
 * @param {string} venueCode - 会場コード
 * @param {number} topN - 上位何件を取得するか
 * @returns {Object} { rules, ruleDetails, weeklyData, currentWeek }
 */
export async function getVenueTopRulesWeeklyPerformance(venueCode, topN = 10) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { rules: [], ruleDetails: [], weeklyData: [], currentWeek: 1 }
  }

  const DEFAULT_ADDED_DATE = '2026-01-16'
  const WEEK_START = new Date('2026-01-16')

  function getWeekNumber(dateStr) {
    const date = new Date(dateStr)
    const diffTime = date - WEEK_START
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.floor(diffDays / 7) + 1
  }

  function getWeekLabel(weekNum) {
    return `Week${weekNum}`
  }

  // 会場のルールを取得
  const venueRules = VENUE_RULES[venueCode]
  if (!venueRules || venueRules.length === 0) {
    return { rules: [], ruleDetails: [], weeklyData: [], currentWeek: 1 }
  }

  const venueName = VENUE_NAMES[venueCode]

  // 対象会場の予測データを取得（クエリレベルで会場フィルタ）
  const { data: venuePredictions, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .like('race_id', `%-${venueCode}-%`)
    .gte('predicted_at', DEFAULT_ADDED_DATE)
    .eq('model_id', 'standard')

  if (predError || !venuePredictions) {
    console.error('予測取得エラー:', predError?.message)
    return { rules: [], ruleDetails: [], weeklyData: [], currentWeek: 1 }
  }

  if (venuePredictions.length === 0) {
    return { rules: [], ruleDetails: [], weeklyData: [], currentWeek: 1 }
  }

  // LIKEクエリは日付にもマッチする可能性があるため、JS側で会場コードを再検証
  const filteredPredictions = venuePredictions.filter(pred => {
    const parts = pred.race_id.split('-')
    return parts[3] === venueCode
  })

  if (filteredPredictions.length === 0) {
    return { rules: [], ruleDetails: [], weeklyData: [], currentWeek: 1 }
  }

  // 結果データを取得
  const raceIds = filteredPredictions.map(p => p.race_id)
  const { data: results } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds)

  const resultsMap = {}
  if (results) {
    results.forEach(r => { resultsMap[r.race_id] = r })
  }

  // 現在の週番号を計算
  const today = new Date()
  const currentWeek = getWeekNumber(today.toISOString().slice(0, 10))

  // 週の範囲を決定
  const weeks = []
  for (let w = 1; w <= currentWeek; w++) {
    weeks.push(w)
  }

  // ルールごと・週ごとの統計を集計
  const ruleWeeklyStats = {}
  const ruleTotalStats = {}

  for (const rule of venueRules) {
    const ruleAddedDate = rule.addedDate || DEFAULT_ADDED_DATE

    ruleWeeklyStats[rule.id] = {}
    ruleTotalStats[rule.id] = {
      ruleId: rule.id,
      venueName,
      venueCode,
      betType: rule.betType,
      samples: 0,
      hits: 0,
      totalPayout: 0
    }

    for (const pred of filteredPredictions) {
      const parts = pred.race_id.split('-')
      const raceNo = parseInt(parts[4])
      const raceDate = parts.slice(0, 3).join('-')

      if (raceDate < ruleAddedDate) continue

      const prediction = {
        confidence: pred.confidence,
        topPick: pred.top_pick,
        top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
      }

      const conf = prediction.confidence || 0
      const top3 = prediction.top3
      const predSorted = [...top3].sort((a, b) => a - b).join('-')
      const has1 = top3.includes(1)
      const result = resultsMap[pred.race_id]

      try {
        if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
          if (result) {
            const weekNum = getWeekNumber(raceDate)

            if (!ruleWeeklyStats[rule.id][weekNum]) {
              ruleWeeklyStats[rule.id][weekNum] = { samples: 0, hits: 0, totalPayout: 0 }
            }

            let isHit = false
            let payout = 0

            if (rule.betType === 'trio') {
              // 3連複: 順不同で3艇を当てる（payout_trifecta）
              const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
              isHit = predSorted === resultSorted
              payout = result.payout_trifecta || 0
            } else if (rule.betType === 'win') {
              isHit = prediction.topPick === result.rank1
              payout = result.payout_win || 0
            } else if (rule.betType === 'place') {
              isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
              payout = prediction.topPick === result.rank1
                ? (result.payout_place_1 || 0)
                : (result.payout_place_2 || 0)
            }

            ruleWeeklyStats[rule.id][weekNum].samples++
            if (isHit) {
              ruleWeeklyStats[rule.id][weekNum].hits++
              ruleWeeklyStats[rule.id][weekNum].totalPayout += payout
            }

            ruleTotalStats[rule.id].samples++
            if (isHit) {
              ruleTotalStats[rule.id].hits++
              ruleTotalStats[rule.id].totalPayout += payout
            }
          }
        }
      } catch (e) {
        // ルールチェック中のエラーは無視
      }
    }
  }

  // 回収率でソートしてトップNを抽出
  const topRules = Object.values(ruleTotalStats)
    .map(stat => ({
      ...stat,
      recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
    }))
    .filter(r => r.samples >= 10) // 10件以上
    .sort((a, b) => b.recovery - a.recovery)
    .slice(0, topN)

  const topRuleIds = topRules.map(r => r.ruleId)

  // 週別データを生成（累積値）
  const cumulativeStats = {} // { [ruleId]: { samples, totalPayout } }
  for (const ruleId of topRuleIds) {
    cumulativeStats[ruleId] = { samples: 0, totalPayout: 0 }
  }

  const weeklyData = weeks.map(weekNum => {
    const weekData = { week: getWeekLabel(weekNum) }
    for (const ruleId of topRuleIds) {
      const weekStats = ruleWeeklyStats[ruleId]?.[weekNum]
      if (weekStats) {
        // 累積値を更新
        cumulativeStats[ruleId].samples += weekStats.samples
        cumulativeStats[ruleId].totalPayout += weekStats.totalPayout
      }
      // 累積回収率を計算
      const cumStats = cumulativeStats[ruleId]
      if (cumStats.samples > 0) {
        weekData[ruleId] = Math.round((cumStats.totalPayout / (cumStats.samples * 100)) * 100)
      } else {
        weekData[ruleId] = null
      }
    }
    return weekData
  })

  return {
    rules: topRuleIds,
    ruleDetails: topRules,
    weeklyData,
    currentWeek
  }
}

export default {
  getMatchingRules,
  getBetTypeName,
  getReliabilityName,
  hasRulesForVenue,
  getRulesForVenue,
  getVenueName,
  getAvailableVenues,
  getTodaysMatchingRaces,
  getRulePerformanceByVenue,
  getTopPerformingRules,
  getTopRulesWeeklyPerformance,
  getVenueTopRulesWeeklyPerformance
}
