/**
 * TodaysPicks - 今日のおすすめレース
 *
 * 会場別ルールにマッチするレースを表示
 * - 全会場をアコーディオン形式で表示
 * - 「全て展開」「全て閉じる」ボタン
 * - 全体サマリー（投資・回収・回収率）
 *
 * 注: ルール詳細（ID・パターン名・条件）は非表示
 *     アルファ減衰防止のため
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTodaysMatchingRaces,
  getBetTypeName,
  getTopPerformingRules,
  getOverallPerformance
} from '../services/ruleMatchService'
import { getTodayJST } from '../utils/dateUtils'
import './TodaysPicks.css'

function TodaysPicks() {
  const navigate = useNavigate()
  const [matchedRaces, setMatchedRaces] = useState([])
  const [expandedVenues, setExpandedVenues] = useState({}) // { '03': true, '10': true, ... }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [topRules, setTopRules] = useState([])
  const [showAllFeatured, setShowAllFeatured] = useState(false)
  const [overallPerformance, setOverallPerformance] = useState(null)

  // マウント時にデータ読み込み
  useEffect(() => {
    loadData()
    loadTopRules()
    loadOverallPerformance()
  }, [])

  async function loadOverallPerformance() {
    try {
      const perf = await getOverallPerformance()
      setOverallPerformance(perf)
    } catch (e) {
      console.error('累積成績取得エラー:', e)
    }
  }

  async function loadTopRules() {
    try {
      const rules = await getTopPerformingRules({ minRecovery: 100, minSamples: 10 })
      // 念のためクライアント側でも10件以上フィルタ
      const filteredRules = rules.filter(r => r.samples >= 10)
      setTopRules(filteredRules)
    } catch (e) {
      console.error('トップルール取得エラー:', e)
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const today = getTodayJST()
      const races = await getTodaysMatchingRaces(today)
      // フィルタせず全会場のデータを保存
      setMatchedRaces(races)
    } catch (e) {
      console.error('データ取得エラー:', e)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 会場ごとにグループ化
  const racesByVenue = useMemo(() => {
    const grouped = {}
    matchedRaces.forEach(race => {
      if (!grouped[race.venueCode]) {
        grouped[race.venueCode] = {
          venueCode: race.venueCode,
          venueName: race.venueName,
          races: []
        }
      }
      grouped[race.venueCode].races.push(race)
    })
    return Object.values(grouped)
  }, [matchedRaces])

  // topRulesからruleIdのSetを作成（10件以上適用 & 回収率100%超え）
  const highPerformingRuleIds = useMemo(() => {
    return new Set(topRules.map(r => r.ruleId))
  }, [topRules])

  // 注目レース: 高パフォーマンスルールに該当するレースのみ抽出
  const featuredRaces = useMemo(() => {
    if (highPerformingRuleIds.size === 0) return []

    return matchedRaces
      .map(race => ({
        ...race,
        // 高パフォーマンスルールのみに絞り込み
        rules: race.rules.filter(rule => highPerformingRuleIds.has(rule.id))
      }))
      .filter(race => race.rules.length > 0) // ルールがあるレースのみ
  }, [matchedRaces, highPerformingRuleIds])

  // 注目レースをフラット化（レース×ルールの組み合わせ）
  const featuredItems = useMemo(() => {
    return featuredRaces.flatMap(race =>
      race.rules.map(rule => ({ race, rule }))
    )
  }, [featuredRaces])

  // 表示件数制限
  const FEATURED_LIMIT = 5
  const visibleFeaturedItems = showAllFeatured
    ? featuredItems
    : featuredItems.slice(0, FEATURED_LIMIT)

  // 会場展開切り替え
  function toggleVenue(venueCode) {
    setExpandedVenues(prev => ({
      ...prev,
      [venueCode]: !prev[venueCode]
    }))
  }

  // 全て展開
  function expandAll() {
    const allExpanded = {}
    racesByVenue.forEach(venue => { allExpanded[venue.venueCode] = true })
    setExpandedVenues(allExpanded)
  }

  // 全て閉じる
  function collapseAll() {
    setExpandedVenues({})
  }

  // 締切時刻をフォーマット（HH:MM形式）
  function formatTime(startTime) {
    if (!startTime) return '--:--'
    if (startTime.includes('T')) {
      const date = new Date(startTime)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    return startTime.slice(0, 5)
  }

  // 予測の組み合わせを表示（ソート済み）
  function formatPrediction(prediction, betType) {
    if (!prediction || !prediction.top3) return '-'
    const top3 = prediction.top3
    if (betType === 'trio') {
      return [...top3].sort((a, b) => a - b).join('-')
    }
    if (betType === 'exacta') {
      // 3連単は順序通り
      return top3.join('-')
    }
    if (betType === 'win' || betType === 'place') {
      return `${top3[0]}号艇`
    }
    return top3.join('-')
  }

  // カードクリック時の処理
  function handleCardClick(race) {
    navigate('/', {
      state: {
        autoSelectRace: {
          venueCode: race.venueCode,
          raceNo: race.raceNo,
          venueName: race.venueName
        }
      }
    })
  }

  // ルールごとの的中判定
  function getHitInfoForRule(race, rule) {
    if (!race.result) return null

    const prediction = race.prediction
    const result = race.result
    const predSorted = [...prediction.top3].sort((a, b) => a - b).join('-')
    const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')

    if (rule.betType === 'trio') {
      // 3連複: 順不同で3艇を当てる（payout_trifecta）
      const isHit = predSorted === resultSorted
      return {
        hit: isHit,
        payout: isHit ? (race.result.payout_trifecta || 0) : 0
      }
    } else if (rule.betType === 'exacta') {
      // 3連単: 順序通りで3艇を当てる（payout_trio）
      const predExact = prediction.top3.join('-')
      const resultExact = `${result.rank1}-${result.rank2}-${result.rank3}`
      const isHit = predExact === resultExact
      return {
        hit: isHit,
        payout: isHit ? (race.result.payout_trio || 0) : 0
      }
    } else if (rule.betType === 'win') {
      const isHit = prediction.topPick === result.rank1
      return {
        hit: isHit,
        payout: isHit ? (race.result.payout_win || 0) : 0
      }
    } else if (rule.betType === 'place') {
      const isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
      let payout = 0
      if (isHit) {
        payout = prediction.topPick === result.rank1
          ? (race.result.payout_place_1 || 0)
          : (race.result.payout_place_2 || 0)
      }
      return { hit: isHit, payout }
    }

    return null
  }

  if (loading) {
    return (
      <div className="todays-picks">
        <div className="picks-header">
          <h2>今日のおすすめ</h2>
          <p className="picks-description">データマイニングで発掘した高精度パターン</p>
        </div>
        <div className="picks-loading">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="todays-picks">
        <div className="picks-header">
          <h2>今日のおすすめ</h2>
        </div>
        <div className="picks-error">
          <p>{error}</p>
          <button onClick={loadData}>再読み込み</button>
        </div>
      </div>
    )
  }

  // 総ルール数を計算
  const totalRules = matchedRaces.reduce((sum, r) => sum + r.rules.length, 0)

  return (
    <>
      <>
        <title>今日のおすすめ | BoatAI</title>
        <meta name="description" content="本日の高回収率が期待できるおすすめレース。データマイニングで発掘した回収率100%超えパターンにマッチするレースを厳選紹介。" />
        <link rel="canonical" href="https://www.boat-ai.jp/picks" />
      </>
      <div className="todays-picks">
        <div className="picks-header">
          <h2>今日のおすすめ</h2>
          <p className="picks-description">データマイニングで発掘した高回収率パターン</p>
        </div>

      {matchedRaces.length === 0 ? (
        <div className="picks-empty">
          <p>本日はおすすめレースがありません</p>
          <p className="picks-empty-sub">条件に合致するレースが見つかりませんでした</p>
        </div>
      ) : (
        <>
          <div className="picks-summary">
            <span>対象: {racesByVenue.length}会場 / {matchedRaces.length}レース / {totalRules}件</span>
          </div>

          {/* 累積運用成績 */}
          {overallPerformance && overallPerformance.samples > 0 && (
            <div className="overall-summary">
              <div className="summary-header">
                運用成績（{overallPerformance.startDate.slice(5).replace('-', '/')}〜）
              </div>
              <div className="summary-stats">
                <div className="summary-row">
                  <span className="stat-label">投資</span>
                  <span className="stat-value">{overallPerformance.totalInvestment.toLocaleString()}円</span>
                  <span className="stat-arrow">→</span>
                  <span className="stat-label">回収</span>
                  <span className="stat-value">{overallPerformance.totalPayout.toLocaleString()}円</span>
                </div>
                <div className="summary-row">
                  <span className={`recovery-rate ${overallPerformance.recovery >= 100 ? 'positive' : 'negative'}`}>
                    回収率 {overallPerformance.recovery}%
                    ({overallPerformance.recovery >= 100 ? '+' : ''}{overallPerformance.recovery - 100}%)
                  </span>
                </div>
                <div className="summary-detail">
                  {overallPerformance.samples}レース / 的中 {overallPerformance.hits}件
                </div>
              </div>
            </div>
          )}

          {/* 注目レース（10件以上適用 & 回収率100%超え） */}
          {featuredItems.length > 0 && (
            <div className="featured-races-section">
              <div className="featured-header">
                <h3>注目レース</h3>
                <span className="featured-badge">{featuredItems.length}件</span>
              </div>
              <div className="featured-races-list">
                {visibleFeaturedItems.map(({ race, rule }) => {
                  const isFinished = race.result?.finished
                  const hitInfo = getHitInfoForRule(race, rule)

                  return (
                    <div
                      key={`featured-${race.raceId}-${rule.id}`}
                      className={`pick-card ${isFinished ? 'finished' : ''} ${hitInfo?.hit ? 'hit' : ''}`}
                      data-bet-type={rule.betType}
                      onClick={() => handleCardClick(race)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleCardClick(race)}
                    >
                      <div className="pick-card-header">
                        <div className="pick-venue-info">
                          <span className="pick-venue">{race.venueName}</span>
                          <span className="pick-race-no">{race.raceNo}R</span>
                        </div>
                        <span className="pick-time">{formatTime(race.startTime)}</span>
                      </div>

                      <div className="pick-card-body">
                        <span className={`pick-bet-type bet-${rule.betType}`}>
                          {getBetTypeName(rule.betType)}
                        </span>
                        <span className="pick-prediction">
                          {formatPrediction(race.prediction, rule.betType)}
                        </span>
                      </div>

                      {isFinished && hitInfo && (
                        <div className={`pick-result ${hitInfo.hit ? 'hit' : 'miss'}`}>
                          {hitInfo.hit ? (
                            <>
                              <span className="result-icon">&#x2705;</span>
                              <span className="result-text">的中</span>
                              <span className="result-payout">+{hitInfo.payout.toLocaleString()}円</span>
                            </>
                          ) : (
                            <>
                              <span className="result-icon">&#x274C;</span>
                              <span className="result-text">不的中</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* もっと見るボタン */}
              {featuredItems.length > FEATURED_LIMIT && (
                <button
                  className="featured-more-btn"
                  onClick={() => setShowAllFeatured(!showAllFeatured)}
                >
                  {showAllFeatured
                    ? '閉じる'
                    : `もっと見る（残り${featuredItems.length - FEATURED_LIMIT}件）`}
                </button>
              )}
            </div>
          )}

          {/* 展開/閉じるボタン */}
          <div className="accordion-controls">
            <button onClick={expandAll} className="accordion-btn">全て展開</button>
            <button onClick={collapseAll} className="accordion-btn">全て閉じる</button>
          </div>

          {/* 会場ごとのアコーディオン */}
          <div className="venue-accordion-list">
            {racesByVenue.map(venue => (
              <div className="venue-accordion" key={venue.venueCode}>
                <button
                  className={`venue-header ${expandedVenues[venue.venueCode] ? 'expanded' : ''}`}
                  onClick={() => toggleVenue(venue.venueCode)}
                >
                  <span className="venue-header-name">{venue.venueName}</span>
                  <span className="venue-header-count">{venue.races.reduce((sum, r) => sum + r.rules.length, 0)}件</span>
                  <span className="toggle-icon">{expandedVenues[venue.venueCode] ? '▲' : '▼'}</span>
                </button>

                {expandedVenues[venue.venueCode] && (
                  <div className="venue-races">
                    {venue.races.flatMap(race =>
                      race.rules.map(rule => {
                        const isFinished = race.result?.finished
                        const hitInfo = getHitInfoForRule(race, rule)

                        return (
                          <div
                            key={`${race.raceId}-${rule.id}`}
                            className={`pick-card ${isFinished ? 'finished' : ''} ${hitInfo?.hit ? 'hit' : ''}`}
                            data-bet-type={rule.betType}
                            onClick={() => handleCardClick(race)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && handleCardClick(race)}
                          >
                            <div className="pick-card-header">
                              <div className="pick-venue-info">
                                <span className="pick-race-no">{race.raceNo}R</span>
                              </div>
                              <span className="pick-time">{formatTime(race.startTime)}</span>
                            </div>

                            <div className="pick-card-body">
                              <span className={`pick-bet-type bet-${rule.betType}`}>
                                {getBetTypeName(rule.betType)}
                              </span>
                              <span className="pick-prediction">
                                {formatPrediction(race.prediction, rule.betType)}
                              </span>
                            </div>

                            {isFinished && hitInfo && (
                              <div className={`pick-result ${hitInfo.hit ? 'hit' : 'miss'}`}>
                                {hitInfo.hit ? (
                                  <>
                                    <span className="result-icon">&#x2705;</span>
                                    <span className="result-text">的中</span>
                                    <span className="result-payout">+{hitInfo.payout.toLocaleString()}円</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="result-icon">&#x274C;</span>
                                    <span className="result-text">不的中</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      </div>
    </>
  )
}

export default TodaysPicks
