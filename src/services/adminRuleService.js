/**
 * 管理者向けルール分析サービス
 * 履歴取得、週別推移データなど
 */

import { supabase } from './supabaseClient'
import {
  getMatchingRules,
  getBetTypeName,
  getVenueName
} from './ruleMatchService'

// 会場コードから会場名への変換（ローカル定義）
const VENUE_NAMES = {
  '01': '桐生', '02': '戸田', '03': '江戸川', '04': '平和島', '05': '多摩川', '06': '浜名湖',
  '07': '蒲郡', '08': '常滑', '09': '津', '10': '三国', '11': 'びわこ', '12': '住之江',
  '13': '尼崎', '14': '鳴門', '15': '丸亀', '16': '児島', '17': '宮島', '18': '徳山',
  '19': '下関', '20': '若松', '21': '芦屋', '22': '福岡', '23': '唐津', '24': '大村'
}

/**
 * ルール適用履歴を取得（日付範囲指定）
 * @param {string} startDate - 開始日 (YYYY-MM-DD)
 * @param {string} endDate - 終了日 (YYYY-MM-DD)
 * @param {number} limit - 取得件数
 * @param {number} offset - オフセット
 * @returns {Promise<{data: Array, total: number}>}
 */
export async function getRuleApplicationHistory(startDate, endDate, limit = 50, offset = 0) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { data: [], total: 0 }
  }

  try {
    // 終了日の翌日（race_id文字列比較用）
    const endDateNext = new Date(endDate)
    endDateNext.setDate(endDateNext.getDate() + 1)
    const endDateNextStr = `${endDateNext.getFullYear()}-${String(endDateNext.getMonth() + 1).padStart(2, '0')}-${String(endDateNext.getDate()).padStart(2, '0')}`

    // 予測データを取得（race_idで日付範囲フィルタ）
    // race_id形式: YYYY-MM-DD-venueCode-raceNo
    const { data: predictions, error: predError, count } = await supabase
      .from('predictions')
      .select('*', { count: 'exact' })
      .gte('race_id', startDate)
      .lt('race_id', endDateNextStr)
      .eq('model_id', 'standard')
      .order('race_id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (predError) {
      console.error('予測取得エラー:', predError.message)
      return { data: [], total: 0 }
    }

    if (!predictions || predictions.length === 0) {
      return { data: [], total: 0 }
    }

    // 結果データを取得
    const raceIds = predictions.map(p => p.race_id)
    const { data: results } = await supabase
      .from('race_results')
      .select('*')
      .in('race_id', raceIds)

    const resultsMap = {}
    if (results) {
      results.forEach(r => { resultsMap[r.race_id] = r })
    }

    // ルールマッチング & フラット化
    const historyItems = []

    for (const pred of predictions) {
      const parts = pred.race_id.split('-')
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`
      const venueCode = parts[3]
      const raceNo = parseInt(parts[4])

      const prediction = {
        confidence: pred.confidence,
        topPick: pred.top_pick,
        top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
      }

      const rules = getMatchingRules(prediction, venueCode, raceNo)
      if (rules.length === 0) continue

      const result = resultsMap[pred.race_id]
      const predSorted = [...prediction.top3].sort((a, b) => a - b).join('-')

      for (const rule of rules) {
        let isHit = false
        let payout = 0

        if (result) {
          const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')

          if (rule.betType === 'trio') {
            isHit = predSorted === resultSorted
            payout = result.payout_trifecta || 0
          } else if (rule.betType === 'exacta') {
            const predExact = prediction.top3.join('-')
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
        }

        historyItems.push({
          raceId: pred.race_id,
          date,
          venueCode,
          venueName: VENUE_NAMES[venueCode] || `会場${venueCode}`,
          raceNo,
          ruleId: rule.id,
          betType: rule.betType,
          prediction: prediction.top3.join('-'),
          result: result ? `${result.rank1}-${result.rank2}-${result.rank3}` : null,
          isHit,
          payout
        })
      }
    }

    // totalはルール適用数を返す（予測データ数ではない）
    // 注: ページネーションは予測データベースで行われるため、
    // totalは現在のページのルール適用数のみ反映
    return { data: historyItems, total: historyItems.length }
  } catch (err) {
    console.error('履歴取得エラー:', err)
    return { data: [], total: 0 }
  }
}

/**
 * 週別累積パフォーマンスを取得
 * @returns {Promise<Array>} 週別データの配列
 */
export async function getWeeklyPerformance() {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return []
  }

  const DEFAULT_START_DATE = '2026-01-16'

  try {
    // 全予測データを取得
    const allPredictions = await fetchAllPredictionsForWeekly(DEFAULT_START_DATE)

    if (!allPredictions || allPredictions.length === 0) {
      return []
    }

    // 結果データを取得
    const raceIds = allPredictions.map(p => p.race_id)
    const results = await fetchResultsByRaceIdsForWeekly(raceIds)

    const resultsMap = {}
    results.forEach(r => { resultsMap[r.race_id] = r })

    // 日付ごとに集計
    const dailyStats = {}

    for (const pred of allPredictions) {
      const parts = pred.race_id.split('-')
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`
      const venueCode = parts[3]
      const raceNo = parseInt(parts[4])

      const prediction = {
        confidence: pred.confidence,
        topPick: pred.top_pick,
        top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
      }

      const rules = getMatchingRules(prediction, venueCode, raceNo)
      if (rules.length === 0) continue

      const result = resultsMap[pred.race_id]
      if (!result) continue

      if (!dailyStats[date]) {
        dailyStats[date] = { samples: 0, payout: 0 }
      }

      const predSorted = [...prediction.top3].sort((a, b) => a - b).join('-')

      for (const rule of rules) {
        dailyStats[date].samples++

        let isHit = false
        let payout = 0

        if (rule.betType === 'trio') {
          const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
          isHit = predSorted === resultSorted
          payout = result.payout_trifecta || 0
        } else if (rule.betType === 'exacta') {
          const predExact = prediction.top3.join('-')
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
          dailyStats[date].payout += payout
        }
      }
    }

    // 週ごとに集計
    const weeklyData = []
    const sortedDates = Object.keys(dailyStats).sort()

    if (sortedDates.length === 0) return []

    // 週の開始日を計算（月曜始まり）
    const getWeekStart = (dateStr) => {
      const d = new Date(dateStr)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const weekGroups = {}
    for (const date of sortedDates) {
      const weekStart = getWeekStart(date)
      if (!weekGroups[weekStart]) {
        weekGroups[weekStart] = { samples: 0, payout: 0 }
      }
      weekGroups[weekStart].samples += dailyStats[date].samples
      weekGroups[weekStart].payout += dailyStats[date].payout
    }

    // 累積計算
    let cumulativeSamples = 0
    let cumulativePayout = 0
    const sortedWeeks = Object.keys(weekGroups).sort()

    for (const weekStart of sortedWeeks) {
      cumulativeSamples += weekGroups[weekStart].samples
      cumulativePayout += weekGroups[weekStart].payout

      const investment = cumulativeSamples * 100
      const cumulativeRecovery = investment > 0 ? Math.round((cumulativePayout / investment) * 100) : 0

      // 週ラベル（MM/DD形式）
      const d = new Date(weekStart)
      const weekLabel = `${d.getMonth() + 1}/${d.getDate()}`

      weeklyData.push({
        weekStart,
        weekLabel,
        weeklySamples: weekGroups[weekStart].samples,
        weeklyPayout: weekGroups[weekStart].payout,
        weeklyRecovery: weekGroups[weekStart].samples > 0
          ? Math.round((weekGroups[weekStart].payout / (weekGroups[weekStart].samples * 100)) * 100)
          : 0,
        cumulativeSamples,
        cumulativePayout,
        cumulativeRecovery
      })
    }

    return weeklyData
  } catch (err) {
    console.error('週別パフォーマンス取得エラー:', err)
    return []
  }
}

// ヘルパー: 全予測データ取得（ページネーション対応）
async function fetchAllPredictionsForWeekly(startDate) {
  const allData = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data: page, error } = await supabase
      .from('predictions')
      .select('*')
      .gte('predicted_at', startDate)
      .eq('model_id', 'standard')
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

// ヘルパー: 結果データバッチ取得
async function fetchResultsByRaceIdsForWeekly(raceIds) {
  if (!raceIds || raceIds.length === 0) return []

  const allResults = []
  const batchSize = 500

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
