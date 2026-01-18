/**
 * TodaysPicks - 今日のおすすめレース
 *
 * 会場別ルールにマッチするレースを表示
 * - 会場選択ドロップダウン
 * - レースカード一覧
 * - ルール運用成績表（折りたたみ可能）
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTodaysMatchingRaces,
  getBetTypeName,
  getAvailableVenues,
  getRulePerformanceByVenue,
  getTopPerformingRules
} from '../services/ruleMatchService'
import { getTodayJST } from '../utils/dateUtils'
import './TodaysPicks.css'

function TodaysPicks() {
  const navigate = useNavigate()
  const [selectedVenue, setSelectedVenue] = useState('03') // 江戸川デフォルト
  const [matchedRaces, setMatchedRaces] = useState([])
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false)
  const [highlightedRule, setHighlightedRule] = useState(null)
  const [topRules, setTopRules] = useState([])
  const [isTopRulesOpen, setIsTopRulesOpen] = useState(false)

  const availableVenues = getAvailableVenues()

  useEffect(() => {
    loadData()
  }, [selectedVenue])

  // 全会場トップ30をマウント時に1回だけ読み込み
  useEffect(() => {
    loadTopRules()
  }, [])

  async function loadTopRules() {
    try {
      const rules = await getTopPerformingRules({ minRecovery: 100 })
      setTopRules(rules)
    } catch (e) {
      console.error('トップルール取得エラー:', e)
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    setHighlightedRule(null)

    try {
      const today = getTodayJST()

      // 今日のマッチレースと運用成績を並行取得
      const [races, perf] = await Promise.all([
        getTodaysMatchingRaces(today),
        getRulePerformanceByVenue(selectedVenue)
      ])

      // 選択会場のレースのみフィルタ
      const filteredRaces = races.filter(r => r.venueCode === selectedVenue)
      setMatchedRaces(filteredRaces)
      setPerformance(perf)
    } catch (e) {
      console.error('データ取得エラー:', e)
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
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

  // ルール行クリック時の処理
  function handleRuleClick(ruleId) {
    setHighlightedRule(highlightedRule === ruleId ? null : ruleId)
  }

  // 運用開始日をフォーマット
  function formatStartDate(dateStr) {
    const [, month, day] = dateStr.split('-')
    return `${parseInt(month)}/${parseInt(day)}`
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
          <p className="picks-description">データマイニングで発掘した高回収率パターン</p>
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

  return (
    <div className="todays-picks">
      <div className="picks-header">
        <h2>今日のおすすめ</h2>
        <p className="picks-description">データマイニングで発掘した高回収率パターン</p>
      </div>

      {/* 会場選択 */}
      <div className="venue-selector">
        <label htmlFor="venue-select">会場:</label>
        <select
          id="venue-select"
          value={selectedVenue}
          onChange={(e) => setSelectedVenue(e.target.value)}
        >
          {availableVenues.map(venue => (
            <option key={venue.code} value={venue.code}>
              {venue.name}
            </option>
          ))}
        </select>
      </div>

      {matchedRaces.length === 0 ? (
        <div className="picks-empty">
          <p>本日はおすすめレースがありません</p>
          <p className="picks-empty-sub">条件に合致するレースが見つかりませんでした</p>
        </div>
      ) : (
        <>
          <div className="picks-summary">
            <span>対象: {matchedRaces.length}レース / {matchedRaces.reduce((sum, r) => sum + r.rules.length, 0)}ルール</span>
          </div>

          <div className="picks-list">
            {matchedRaces.flatMap((race) =>
              race.rules.map((rule) => {
                const isFinished = race.result?.finished
                const isHighlighted = highlightedRule === rule.id

                // ルールごとの的中判定
                const hitInfo = getHitInfoForRule(race, rule)

                return (
                  <div
                    key={`${race.raceId}-${rule.id}`}
                    className={`pick-card ${isFinished ? 'finished' : ''} ${hitInfo?.hit ? 'hit' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    data-bet-type={rule.betType}
                    data-rule-id={rule.id}
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
                            <span className="result-text">的中</span>
                            <span className="result-payout">+{hitInfo.payout.toLocaleString()}円</span>
                          </>
                        ) : (
                          <>
                            <span className="result-icon">&#x274C;</span>
                            <span className="result-text">外れ</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ルール運用成績（折りたたみ） */}
      {performance && (
        <div className="rule-performance-section">
          <button
            className="performance-toggle"
            onClick={() => setIsPerformanceOpen(!isPerformanceOpen)}
          >
            ルール運用成績（{formatStartDate(performance.startDate)}〜）
            <span className="toggle-icon">{isPerformanceOpen ? '▲' : '▼'}</span>
          </button>

          {isPerformanceOpen && (
            <div className="performance-content">
              <div className="performance-table-wrapper">
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>ルールID</th>
                      <th>賭式</th>
                      <th>的中率</th>
                      <th>回収率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.byRule.map(rule => (
                      <tr
                        key={rule.ruleId}
                        onClick={() => handleRuleClick(rule.ruleId)}
                        className={highlightedRule === rule.ruleId ? 'selected' : ''}
                      >
                        <td className="rule-id-cell">{rule.ruleId}</td>
                        <td>{getBetTypeName(rule.betType)}</td>
                        <td>{rule.hitRate}% ({Math.round(rule.hitRate * rule.samples / 100)}/{rule.samples})</td>
                        <td className={rule.recovery >= 100 ? 'positive' : rule.recovery > 0 ? 'negative' : ''}>
                          {rule.recovery}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="total-summary">
                全体: 的中率 {performance.total.hitRate}% ({Math.round(performance.total.hitRate * performance.total.samples / 100)}/{performance.total.samples}) |
                回収率 <span className={performance.total.recovery >= 100 ? 'positive' : 'negative'}>
                  {performance.total.recovery}%
                </span>
              </div>
            </div>
          )}
        </div>
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
              <div className="performance-table-wrapper">
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>会場</th>
                      <th>ルールID</th>
                      <th>賭式</th>
                      <th>的中率</th>
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
  )
}

export default TodaysPicks
