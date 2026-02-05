/**
 * 会場別ルールマッチングサービス
 *
 * 2026-01-01〜2026-02-04のデータ再分析により、回収率100%以上のルールのみ厳選
 * 有効ルール: 34件（単勝12件 + 複勝10件 + 3連複3件 + 3連単9件）
 * 対象会場: 15会場
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

// ========================================
// 有効ルール定義（回収率100%以上のみ）
// 2026-01-01〜2026-02-04 再分析結果
// ========================================

// 江戸川（03）: 4ルール
const EDOGAWA_RULES = [
  // 単勝 2件
  {
    id: 'E03-W001',
    patternName: 'EDOGAWA-WIN-TOP2-MC',
    description: '2号艇1着×conf70-80',
    betType: 'win',
    stats: { samples: 12, hits: 6, recovery: 203 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 70 && conf < 80
  },
  {
    id: 'E03-W002',
    patternName: 'EDOGAWA-WIN-TOP2-EARLY',
    description: '2号艇1着×4R以前',
    betType: 'win',
    stats: { samples: 17, hits: 8, recovery: 172 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && raceNo >= 1 && raceNo <= 4
  },
  // 複勝 2件
  {
    id: 'E03-P001',
    patternName: 'EDOGAWA-PLACE-TOP2-EARLY',
    description: '2号艇1着×4R以前',
    betType: 'place',
    stats: { samples: 17, hits: 14, recovery: 101 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && raceNo >= 1 && raceNo <= 4
  },
  {
    id: 'E03-P004',
    patternName: 'EDOGAWA-PLACE-TOP1-HC',
    description: '1号艇1着×conf80+',
    betType: 'place',
    stats: { samples: 201, hits: 137, recovery: 103 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 80
  }
]

// 浜名湖（06）: 2ルール
const HAMANAKO_RULES = [
  {
    id: 'H06-W002',
    patternName: 'HAMANAKO-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 27, hits: 7, recovery: 207 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  // 3連単
  {
    id: 'H06-EX001',
    patternName: 'HAMANAKO-EXACTA-R712',
    description: '3連単：後半レース(7-12R)',
    betType: 'exacta',
    stats: { samples: 228, hits: 18, recovery: 281 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 7 && raceNo <= 12
  }
]

// 蒲郡（07）: 2ルール
const GAMAGORI_RULES = [
  {
    id: 'G07-P002',
    patternName: 'GAMAGORI-PLACE-TOP4-LATE',
    description: '4号艇1着×7R以降',
    betType: 'place',
    stats: { samples: 13, hits: 6, recovery: 229 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && raceNo >= 7
  },
  {
    id: 'G07-P003',
    patternName: 'GAMAGORI-PLACE-TOP2-INC1',
    description: '2号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 60, hits: 36, recovery: 102 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && has1
  }
]

// 三国（10）: 4ルール
const MIKUNI_RULES = [
  // 単勝 1件
  {
    id: 'M10-W002',
    patternName: 'MIKUNI-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 16, hits: 6, recovery: 108 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  // 複勝 2件
  {
    id: 'M10-P002',
    patternName: 'MIKUNI-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 25, hits: 17, recovery: 162 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'M10-P003',
    patternName: 'MIKUNI-PLACE-TOP4-INC1',
    description: '4号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 14, hits: 7, recovery: 112 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && has1
  },
  // 3連複 1件
  {
    id: 'M10-T003',
    patternName: 'MIKUNI-TRIO-INC12-HC',
    description: '1号艇含む×2号艇含む×conf75+',
    betType: 'trio',
    stats: { samples: 196, hits: 52, recovery: 101 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2) && conf >= 75
  }
]

// びわこ（11）: 4ルール
const BIWAKO_RULES = [
  // 単勝 2件
  {
    id: 'B11-W002',
    patternName: 'BIWAKO-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 24, hits: 10, recovery: 122 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'B11-W003',
    patternName: 'BIWAKO-WIN-TOP1-HC',
    description: '1号艇1着×conf85+',
    betType: 'win',
    stats: { samples: 216, hits: 142, recovery: 102 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  },
  // 3連複 2件
  {
    id: 'B11-T003',
    patternName: 'BIWAKO-TRIO-INC12',
    description: '1号艇含む×2号艇含む',
    betType: 'trio',
    stats: { samples: 211, hits: 52, recovery: 102 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2)
  },
  {
    id: 'B11-T005',
    patternName: 'BIWAKO-TRIO-INC1-LATE',
    description: '1号艇含む×10R以降',
    betType: 'trio',
    stats: { samples: 95, hits: 20, recovery: 114 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 10
  }
]

// 鳴門（14）: 3ルール
const NARUTO_RULES = [
  {
    id: 'N14-W002',
    patternName: 'NARUTO-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 21, hits: 10, recovery: 121 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'N14-P002',
    patternName: 'NARUTO-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 20, hits: 14, recovery: 109 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  // 3連単
  {
    id: 'N14-EX001',
    patternName: 'NARUTO-EXACTA-TP1-HC',
    description: '3連単：1着予想=1号艇×conf85+',
    betType: 'exacta',
    stats: { samples: 182, hits: 20, recovery: 115 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  }
]

// 丸亀（15）: 1ルール
const MARUGAME_RULES = [
  {
    id: 'R15-P001',
    patternName: 'MARUGAME-PLACE-TOP2-HC',
    description: '2号艇1着×conf80+',
    betType: 'place',
    stats: { samples: 34, hits: 19, recovery: 105 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  }
]

// 児島（16）: 4ルール
const KOJIMA_RULES = [
  // 単勝 2件
  {
    id: 'K16-W001',
    patternName: 'KOJIMA-WIN-TOP2-HC',
    description: '2号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 47, hits: 15, recovery: 114 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  },
  {
    id: 'K16-W002',
    patternName: 'KOJIMA-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 28, hits: 9, recovery: 102 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  // 複勝 2件
  {
    id: 'K16-P002',
    patternName: 'KOJIMA-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 36, hits: 27, recovery: 137 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'K16-P003',
    patternName: 'KOJIMA-PLACE-TOP4-INC1',
    description: '4号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 21, hits: 7, recovery: 134 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && has1
  }
]

// 福岡（22）: 4ルール
const FUKUOKA_RULES = [
  {
    id: 'F22-W003',
    patternName: 'FUKUOKA-WIN-TOP1-HC',
    description: '1号艇1着×conf85+',
    betType: 'win',
    stats: { samples: 196, hits: 140, recovery: 101 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  },
  {
    id: 'F22-W004',
    patternName: 'FUKUOKA-WIN-TOP4-LATE',
    description: '4号艇1着×10R以降',
    betType: 'win',
    stats: { samples: 6, hits: 2, recovery: 252 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && raceNo >= 10
  },
  {
    id: 'F22-W005',
    patternName: 'FUKUOKA-WIN-TOP2-EARLY',
    description: '2号艇1着×4R以前',
    betType: 'win',
    stats: { samples: 15, hits: 8, recovery: 158 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && raceNo >= 1 && raceNo <= 4
  },
  // 3連単
  {
    id: 'F22-EX001',
    patternName: 'FUKUOKA-EXACTA-R16-HC',
    description: '3連単：前半(1-6R)×conf85+',
    betType: 'exacta',
    stats: { samples: 150, hits: 15, recovery: 144 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 1 && raceNo <= 6 && conf >= 85
  }
]

// ========================================
// 3連単専用ルール（新規会場）
// ========================================

// 平和島（04）: 3連単
const HEIWAJIMA_RULES = [
  {
    id: 'HW04-EX001',
    patternName: 'HEIWAJIMA-EXACTA-R712',
    description: '3連単：後半レース(7-12R)',
    betType: 'exacta',
    stats: { samples: 158, hits: 12, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 7 && raceNo <= 12
  }
]

// 津（09）: 3連単
const TSU_RULES = [
  {
    id: 'TS09-EX001',
    patternName: 'TSU-EXACTA-TP1',
    description: '3連単：1着予想=1号艇',
    betType: 'exacta',
    stats: { samples: 200, hits: 23, recovery: 110 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  }
]

// 宮島（17）: 3連単
const MIYAJIMA_RULES = [
  {
    id: 'MY17-EX001',
    patternName: 'MIYAJIMA-EXACTA-TP1-HC',
    description: '3連単：1着予想=1号艇×conf85+',
    betType: 'exacta',
    stats: { samples: 189, hits: 18, recovery: 115 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  }
]

// 徳山（18）: 3連単
const TOKUYAMA_RULES = [
  {
    id: 'TY18-EX001',
    patternName: 'TOKUYAMA-EXACTA-R712',
    description: '3連単：後半レース(7-12R)',
    betType: 'exacta',
    stats: { samples: 233, hits: 22, recovery: 127 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 7 && raceNo <= 12
  }
]

// 芦屋（21）: 3連単
const ASHIYA_RULES = [
  {
    id: 'AS21-EX001',
    patternName: 'ASHIYA-EXACTA-R712',
    description: '3連単：後半レース(7-12R)',
    betType: 'exacta',
    stats: { samples: 174, hits: 10, recovery: 1074 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 7 && raceNo <= 12
  }
]

// 大村（24）: 3連単
const OMURA_RULES = [
  {
    id: 'OM24-EX001',
    patternName: 'OMURA-EXACTA-TP1-HC',
    description: '3連単：1着予想=1号艇×conf85+',
    betType: 'exacta',
    stats: { samples: 216, hits: 24, recovery: 105 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  }
]

// ========================================
// 会場ルールマッピング（15会場）
// ========================================
const VENUE_RULES = {
  '03': EDOGAWA_RULES,
  '04': HEIWAJIMA_RULES,
  '06': HAMANAKO_RULES,
  '07': GAMAGORI_RULES,
  '09': TSU_RULES,
  '10': MIKUNI_RULES,
  '11': BIWAKO_RULES,
  '14': NARUTO_RULES,
  '15': MARUGAME_RULES,
  '16': KOJIMA_RULES,
  '17': MIYAJIMA_RULES,
  '18': TOKUYAMA_RULES,
  '21': ASHIYA_RULES,
  '22': FUKUOKA_RULES,
  '24': OMURA_RULES
}

// ========================================
// 公開関数
// ========================================

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
    'exacta': '3連単',
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
          } else if (rule.betType === 'exacta') {
            // 3連単: 順序通りで3艇を当てる（payout_trio）
            const predExact = prediction.top3.join('-')
            const resultExact = `${result.rank1}-${result.rank2}-${result.rank3}`
            const isHit = predExact === resultExact
            if (isHit) {
              hitInfo = { hit: true, payout: result.payout_trio || 0 }
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
          payout_trifecta: result.payout_trifecta,
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

  // LIKEクエリは日付にもマッチする可能性があるため、JS側で会場コードを再検証
  const filteredPredictions = predictions.filter(pred => {
    const parts = pred.race_id.split('-')
    return parts[3] === venueCode
  })

  for (const pred of filteredPredictions) {
    const parts = pred.race_id.split('-')
    const raceNo = parseInt(parts[4])

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
            } else if (rule.betType === 'exacta') {
              // 3連単: 順序通りで3艇を当てる（payout_trio）
              const predExact = top3.join('-')
              const resultExact = `${result.rank1}-${result.rank2}-${result.rank3}`
              isHit = predExact === resultExact
              payout = result.payout_trio || 0
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

  const DEFAULT_START_DATE = '2026-01-16'

  // 全予測データを取得（ページネーションで1000行制限を回避）
  const allPredictions = await fetchAllPredictions(DEFAULT_START_DATE, 'standard')

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
    for (const rule of rules) {
      ruleStats[rule.id] = {
        ruleId: rule.id,
        venueCode,
        venueName: VENUE_NAMES[venueCode],
        description: rule.description,
        betType: rule.betType,
        samples: 0,
        hits: 0,
        totalPayout: 0
      }
    }
  }

  for (const pred of allPredictions) {
    const parts = pred.race_id.split('-')
    const venueCode = parts[3]
    const raceNo = parseInt(parts[4])

    const rules = VENUE_RULES[venueCode]
    if (!rules) continue

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
        if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
          if (result) {
            ruleStats[rule.id].samples++

            let isHit = false
            let payout = 0

            if (rule.betType === 'trio') {
              const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
              isHit = predSorted === resultSorted
              payout = result.payout_trifecta || 0
            } else if (rule.betType === 'exacta') {
              // 3連単: 順序通りで3艇を当てる（payout_trio）
              const predExact = top3.join('-')
              const resultExact = `${result.rank1}-${result.rank2}-${result.rank3}`
              isHit = predExact === resultExact
              payout = result.payout_trio || 0
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
        // エラー無視
      }
    }
  }

  // 結果をフォーマット
  let ruleList = Object.values(ruleStats)
    .filter(stat => stat.samples >= minSamples)
    .map(stat => ({
      ruleId: stat.ruleId,
      venueCode: stat.venueCode,
      venueName: stat.venueName,
      description: stat.description,
      betType: stat.betType,
      samples: stat.samples,
      hits: stat.hits,
      hitRate: stat.samples > 0 ? Math.round((stat.hits / stat.samples) * 100) : 0,
      recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
    }))

  // 回収率フィルタ
  if (minRecovery !== null) {
    ruleList = ruleList.filter(r => r.recovery >= minRecovery)
  }

  // 回収率順にソート
  ruleList.sort((a, b) => b.recovery - a.recovery)

  // 件数制限
  if (limit !== null) {
    ruleList = ruleList.slice(0, limit)
  }

  return ruleList
}

/**
 * 全会場・全ルールの累積運用成績を取得
 * @returns {Promise<Object>} { startDate, samples, hits, hitRate, totalInvestment, totalPayout, recovery }
 */
export async function getOverallPerformance() {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { startDate: '2026-01-16', samples: 0, hits: 0, hitRate: 0, totalInvestment: 0, totalPayout: 0, recovery: 0 }
  }

  const DEFAULT_START_DATE = '2026-01-16'

  // 全予測データを取得
  const allPredictions = await fetchAllPredictions(DEFAULT_START_DATE, 'standard')

  if (!allPredictions || allPredictions.length === 0) {
    return { startDate: DEFAULT_START_DATE, samples: 0, hits: 0, hitRate: 0, totalInvestment: 0, totalPayout: 0, recovery: 0 }
  }

  // 全結果データを取得
  const raceIds = allPredictions.map(p => p.race_id)
  const results = await fetchResultsByRaceIds(raceIds)

  const resultsMap = {}
  results.forEach(r => { resultsMap[r.race_id] = r })

  // 全体集計
  let totalSamples = 0
  let totalHits = 0
  let totalPayout = 0

  for (const pred of allPredictions) {
    const parts = pred.race_id.split('-')
    const venueCode = parts[3]
    const raceNo = parseInt(parts[4])

    const rules = VENUE_RULES[venueCode]
    if (!rules) continue

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
        if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
          if (result) {
            totalSamples++

            let isHit = false
            let payout = 0

            if (rule.betType === 'trio') {
              const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
              isHit = predSorted === resultSorted
              payout = result.payout_trifecta || 0
            } else if (rule.betType === 'exacta') {
              const predExact = top3.join('-')
              const resultExact = `${result.rank1}-${result.rank2}-${result.rank3}`
              isHit = predExact === resultExact
              payout = result.payout_trio || 0
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
              totalHits++
              totalPayout += payout
            }
          }
        }
      } catch (e) {
        // エラー無視
      }
    }
  }

  const totalInvestment = totalSamples * 100
  const hitRate = totalSamples > 0 ? Math.round((totalHits / totalSamples) * 100) : 0
  const recovery = totalSamples > 0 ? Math.round((totalPayout / totalInvestment) * 100) : 0

  return {
    startDate: DEFAULT_START_DATE,
    samples: totalSamples,
    hits: totalHits,
    hitRate,
    totalInvestment,
    totalPayout,
    recovery
  }
}
