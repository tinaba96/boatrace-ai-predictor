/**
 * TodaysPicks - 今日のおすすめレース
 *
 * 会場別ルールにマッチするレースを表示
 * - 全会場をアコーディオン形式で表示
 * - 「全て展開」「全て閉じる」ボタン
 * - 回収率100%超えルール一覧
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  getTodaysMatchingRaces,
  getBetTypeName,
  getTopPerformingRules,
  getRulePerformanceByVenue,
  getTopRulesWeeklyPerformance,
  getVenueTopRulesWeeklyPerformance
} from '../services/ruleMatchService'
import RuleTrendChart from './RuleTrendChart'
import { getTodayJST } from '../utils/dateUtils'
import './TodaysPicks.css'

function TodaysPicks() {
  const navigate = useNavigate()
  const [matchedRaces, setMatchedRaces] = useState([])
  const [expandedVenues, setExpandedVenues] = useState({}) // { '03': true, '10': true, ... }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [topRules, setTopRules] = useState([])
  const [isTopRulesOpen, setIsTopRulesOpen] = useState(false)
  const [venuePerformances, setVenuePerformances] = useState({}) // { '03': { startDate: '...', byRule: [...], total: {...} }, ... }
  const [weeklyPerformance, setWeeklyPerformance] = useState(null) // 週別パフォーマンスデータ
  const [showAllFeatured, setShowAllFeatured] = useState(false)

  // マウント時にデータ読み込み
  useEffect(() => {
    loadData()
    loadTopRules()
  }, [])


  // データ読み込み後、各会場のパフォーマンスを取得
  useEffect(() => {
    if (matchedRaces.length > 0) {
      loadVenuePerformances()
    }
  }, [matchedRaces])

  // 回収率100%超えルール一覧を開いたときに週別データを取得
  useEffect(() => {
    if (isTopRulesOpen && !weeklyPerformance) {
      loadWeeklyPerformance()
    }
  }, [isTopRulesOpen])

  async function loadVenuePerformances() {
    const venueCodes = [...new Set(matchedRaces.map(r => r.venueCode))]
    const performances = {}

    await Promise.all(
      venueCodes.map(async (code) => {
        try {
          // ルール別パフォーマンスと週別データを並列取得
          const [perf, weeklyData] = await Promise.all([
            getRulePerformanceByVenue(code),
            getVenueTopRulesWeeklyPerformance(code, 10)
          ])
          performances[code] = {
            ...perf,
            weeklyData: weeklyData.weeklyData,
            topRules: weeklyData.rules,
            ruleDetails: weeklyData.ruleDetails,
            currentWeek: weeklyData.currentWeek
          }
        } catch (e) {
          console.error(`会場${code}のパフォーマンス取得エラー:`, e)
        }
      })
    )

    setVenuePerformances(performances)
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

  async function loadWeeklyPerformance() {
    try {
      const data = await getTopRulesWeeklyPerformance(10)
      setWeeklyPerformance(data)
    } catch (e) {
      console.error('週別パフォーマンス取得エラー:', e)
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

  // ルールIDクリック時に該当レースカードへスクロール
  function scrollToRuleCard(ruleId) {
    const cards = document.querySelectorAll(`[data-rule-id="${ruleId}"]`)
    if (cards.length > 0) {
      // 最初の1件にスクロール
      cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 全件をハイライト
      cards.forEach(card => {
        card.classList.add('highlighted')
        setTimeout(() => card.classList.remove('highlighted'), 2000)
      })
    }
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

  // 開始日をフォーマット（M/D形式）
  function formatStartDate(dateStr) {
    const [, month, day] = dateStr.split('-')
    return `${parseInt(month)}/${parseInt(day)}`
  }

  // 予測の組み合わせを表示（ソート済み）
  function formatPrediction(prediction, betType) {
    if (!prediction || !prediction.top3) return '-'
    const top3 = prediction.top3
    if (betType === 'trio') {
      return [...top3].sort((a, b) => a - b).join('-')
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
      const isHit = predSorted === resultSorted
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
      <Helmet>
        <title>今日のおすすめ | BoatAI</title>
        <meta name="description" content="本日の高回収率が期待できるおすすめレース。データマイニングで発掘した回収率100%超えパターンにマッチするレースを厳選紹介。" />
        <link rel="canonical" href="https://boat-ai.jp/picks" />
      </Helmet>
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
            <span>対象: {racesByVenue.length}会場 / {matchedRaces.length}レース / {totalRules}ルール</span>
          </div>

          {/* 注目レース（10件以上適用 & 回収率100%超え） */}
          {featuredItems.length > 0 && (
            <div className="featured-races-section">
              <div className="featured-header">
                <h3>⭐ 注目レース</h3>
                <span className="featured-badge">{featuredItems.length}件</span>
              </div>
              <div className="featured-races-list">
                {visibleFeaturedItems.map(({ race, rule }) => {
                  const ruleStats = topRules.find(r => r.ruleId === rule.id)
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

                      <div className="pick-pattern">
                        <span className="pattern-name">{rule.patternName}</span>
                        <span className="rule-tag">{rule.id}</span>
                      </div>

                      <div className="pick-card-body">
                        <span className={`pick-bet-type bet-${rule.betType}`}>
                          {getBetTypeName(rule.betType)}
                        </span>
                        <span className="pick-prediction">
                          {formatPrediction(race.prediction, rule.betType)}
                        </span>
                      </div>

                      <div className="pick-stats">
                        <span className="stats-label">運用実績:</span>
                        <span className="stats-record">
                          {ruleStats?.samples || rule.stats.samples}戦
                        </span>
                        <span className="stats-recovery">
                          回収率 {ruleStats?.recovery || rule.stats.recovery}%
                        </span>
                      </div>

                      {isFinished && hitInfo && (
                        <div className={`pick-result ${hitInfo.hit ? 'hit' : 'miss'}`}>
                          {hitInfo.hit ? (
                            <>
                              <span className="result-icon">&#x2705;</span>
                              <span className="result-text">正解</span>
                              <span className="result-payout">+{hitInfo.payout.toLocaleString()}円</span>
                            </>
                          ) : (
                            <>
                              <span className="result-icon">&#x274C;</span>
                              <span className="result-text">不正解</span>
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
                    {/* 会場別週別推移グラフ（アコーディオン直下） */}
                    {venuePerformances[venue.venueCode]?.weeklyData?.length > 0 && venuePerformances[venue.venueCode]?.topRules?.length > 0 && (
                      <div className="venue-chart-container">
                        <h4 className="venue-chart-title">回収率トップ 週別推移</h4>
                        <RuleTrendChart
                          weeklyData={venuePerformances[venue.venueCode].weeklyData}
                          rules={venuePerformances[venue.venueCode].topRules}
                          ruleDetails={venuePerformances[venue.venueCode].ruleDetails}
                          currentWeek={venuePerformances[venue.venueCode].currentWeek}
                        />
                      </div>
                    )}

                    {venue.races.flatMap(race =>
                      race.rules.map(rule => {
                        const isFinished = race.result?.finished
                        const hitInfo = getHitInfoForRule(race, rule)

                        return (
                          <div
                            key={`${race.raceId}-${rule.id}`}
                            className={`pick-card ${isFinished ? 'finished' : ''} ${hitInfo?.hit ? 'hit' : ''}`}
                            data-bet-type={rule.betType}
                            data-rule-id={rule.id}
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

                            <div className="pick-pattern">
                              <span className="pattern-name">{rule.patternName}</span>
                              <span className="rule-tag">{rule.id}</span>
                            </div>

                            <div className="pick-card-body">
                              <span className={`pick-bet-type bet-${rule.betType}`}>
                                {getBetTypeName(rule.betType)}
                              </span>
                              <span className="pick-prediction">
                                {formatPrediction(race.prediction, rule.betType)}
                              </span>
                            </div>

                            <div className="pick-stats">
                              <span className="stats-label">発掘実績:</span>
                              <span className="stats-record">
                                {rule.stats.samples}戦{rule.stats.hits}勝
                              </span>
                              <span className="stats-recovery">
                                回収率 {rule.stats.recovery}%
                              </span>
                            </div>

                            {isFinished && hitInfo && (
                              <div className={`pick-result ${hitInfo.hit ? 'hit' : 'miss'}`}>
                                {hitInfo.hit ? (
                                  <>
                                    <span className="result-icon">&#x2705;</span>
                                    <span className="result-text">正解</span>
                                    <span className="result-payout">+{hitInfo.payout.toLocaleString()}円</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="result-icon">&#x274C;</span>
                                    <span className="result-text">不正解</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}

                    {/* ルール運用成績表 */}
                    {venuePerformances[venue.venueCode] && venuePerformances[venue.venueCode].byRule.length > 0 && (
                      <div className="venue-performance">
                        <div className="venue-performance-header">
                          ルール運用成績（{formatStartDate(venuePerformances[venue.venueCode].startDate)}〜）
                        </div>
                        <div className="performance-table-wrapper">
                          <table className="performance-table">
                            <thead>
                              <tr>
                                <th>ルールID</th>
                                <th>賭式</th>
                                <th>正解率</th>
                                <th>回収率</th>
                              </tr>
                            </thead>
                            <tbody>
                              {venuePerformances[venue.venueCode].byRule.map(rule => (
                                <tr key={rule.ruleId}>
                                  <td className="rule-id-cell">
                                    <button
                                      className="rule-id-link"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        scrollToRuleCard(rule.ruleId)
                                      }}
                                    >
                                      {rule.ruleId}
                                    </button>
                                  </td>
                                  <td>{getBetTypeName(rule.betType)}</td>
                                  <td>{rule.hitRate}% ({Math.round(rule.hitRate * rule.samples / 100)}/{rule.samples})</td>
                                  <td className={rule.recovery >= 100 ? 'positive' : 'negative'}>
                                    {rule.recovery}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="total-summary">
                          全体: 正解率 {venuePerformances[venue.venueCode].total.hitRate}% |
                          回収率 <span className={venuePerformances[venue.venueCode].total.recovery >= 100 ? 'positive' : 'negative'}>
                            {venuePerformances[venue.venueCode].total.recovery}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 回収率100%超えルール一覧（折りたたみ） */}
      {topRules.length > 0 && (
        <div className="rule-performance-section top-rules-section">
          <button
            className="performance-toggle"
            onClick={() => setIsTopRulesOpen(!isTopRulesOpen)}
          >
            回収率100%超えルール一覧（{topRules.length}件）
            <span className="toggle-icon">{isTopRulesOpen ? '▲' : '▼'}</span>
          </button>

          {isTopRulesOpen && (
            <div className="performance-content">
              {/* 週別推移グラフ */}
              <div className="rule-trend-chart-container">
                <h4 className="chart-title">回収率トップ10 週別推移</h4>
                {weeklyPerformance ? (
                  <RuleTrendChart
                    weeklyData={weeklyPerformance.weeklyData}
                    rules={weeklyPerformance.rules}
                    ruleDetails={weeklyPerformance.ruleDetails}
                    currentWeek={weeklyPerformance.currentWeek}
                  />
                ) : (
                  <div className="chart-loading">読み込み中...</div>
                )}
              </div>

              <div className="performance-table-wrapper">
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>会場</th>
                      <th>ルールID</th>
                      <th>賭式</th>
                      <th>正解率</th>
                      <th>回収率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRules.map((rule, idx) => (
                      <tr key={rule.ruleId}>
                        <td className="rank-cell">{idx + 1}</td>
                        <td>{rule.venueName}</td>
                        <td className="rule-id-cell">{rule.ruleId}</td>
                        <td>{getBetTypeName(rule.betType)}</td>
                        <td>{rule.hitRate}% ({rule.hits}/{rule.samples})</td>
                        <td className={rule.recovery >= 100 ? 'positive' : 'negative'}>
                          {rule.recovery}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  )
}

export default TodaysPicks
