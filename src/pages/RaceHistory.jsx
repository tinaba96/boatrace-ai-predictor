import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Header from '../components/Header'
import Breadcrumb from '../components/Breadcrumb'
import LoadingScreen from '../components/LoadingScreen'
import ModelComparisonTable from '../components/ModelComparisonTable'
import { dataService } from '../services/dataService'
import './RaceHistory.css'

function RaceHistory() {
  const [groupedDates, setGroupedDates] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState({})

  // 日付フォーマット関数
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00+09:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdays[date.getDay()]
    return {
      full: `${year}年${month}月${day}日(${weekday})`,
      short: `${month}/${day}(${weekday})`,
      yearMonth: `${year}年${month}月`
    }
  }

  // 月の切り替え
  const toggleMonth = (yearMonth) => {
    setExpandedMonths(prev => ({
      ...prev,
      [yearMonth]: !prev[yearMonth]
    }))
  }

  // 利用可能な日付を取得し、月別にグループ化（Supabaseから）
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        setLoading(true)

        // Supabaseから利用可能な日付リストを取得
        const availableDates = await dataService.getAvailableDates(90)
        const dates = []

        // 各日付のデータを取得して統計を計算
        for (const dateStr of availableDates) {
          try {
            const data = await dataService.getPredictions(dateStr)
            if (!data.races || data.races.length === 0) continue

            const totalRaces = data.races.length
            const finishedRaces = data.races.filter(r => r.result?.finished).length

            // モデル間パフォーマンスを計算
            const hasNewFormat = data.races.some(r => r.predictions)
            const models = hasNewFormat ? ['standard', 'safeBet', 'upsetFocus'] : ['standard']
            const modelNames = {
              standard: 'スタンダード',
              safeBet: '本命狙い',
              upsetFocus: '穴狙い'
            }

            const modelComparison = models.map(modelKey => {
              const races = data.races.filter(r => r.result?.finished)
              let winHits = 0, placeHits = 0, trifecta3Hits = 0, trio3Hits = 0
              let winPayouts = 0, placePayouts = 0, trifecta3Payouts = 0, trio3Payouts = 0

              races.forEach(race => {
                const prediction = race.predictions?.[modelKey] || (modelKey === 'standard' ? race.prediction : null)
                if (!prediction) return

                const topPick = prediction.topPick
                const top3 = prediction.top3
                const result = race.result

                if (topPick === result.rank1) {
                  winHits++
                  const payout = result.payouts?.win?.[String(topPick)]
                  if (payout) winPayouts += payout
                }
                // 複勝: topPickが2着以内なら的中（競艇のルール）
                if (topPick === result.rank1 || topPick === result.rank2) {
                  placeHits++
                  const payout = result.payouts?.place?.[String(topPick)]
                  if (payout) placePayouts += payout
                }
                if (top3?.includes(result.rank1) && top3?.includes(result.rank2) && top3?.includes(result.rank3)) {
                  trifecta3Hits++
                  const sorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b)
                  const key = sorted.join('-')
                  const payout = result.payouts?.trifecta?.[key]
                  if (payout) trifecta3Payouts += payout
                }
                if (top3?.[0] === result.rank1 && top3?.[1] === result.rank2 && top3?.[2] === result.rank3) {
                  trio3Hits++
                  const key = `${result.rank1}-${result.rank2}-${result.rank3}`
                  const payout = result.payouts?.trio?.[key]
                  if (payout) trio3Payouts += payout
                }
              })

              return {
                key: modelKey,
                name: modelNames[modelKey],
                races: finishedRaces,
                winHitRate: finishedRaces > 0 ? winHits / finishedRaces : 0,
                winRecoveryRate: finishedRaces > 0 ? (winPayouts / 100) / finishedRaces : 0,
                placeHitRate: finishedRaces > 0 ? placeHits / finishedRaces : 0,
                placeRecoveryRate: finishedRaces > 0 ? (placePayouts / 100) / finishedRaces : 0,
                trifectaHitRate: finishedRaces > 0 ? trifecta3Hits / finishedRaces : 0,
                trifectaRecoveryRate: finishedRaces > 0 ? (trifecta3Payouts / 100) / finishedRaces : 0,
                trioHitRate: finishedRaces > 0 ? trio3Hits / finishedRaces : 0,
                trioRecoveryRate: finishedRaces > 0 ? (trio3Payouts / 100) / finishedRaces : 0
              }
            })

            dates.push({
              date: dateStr,
              totalRaces,
              finishedRaces,
              modelComparison
            })
          } catch (error) {
            console.warn(`${dateStr}のデータ取得エラー:`, error)
            continue
          }
        }

        // 月別にグループ化
        const grouped = {}
        dates.forEach(dateInfo => {
          const { yearMonth } = formatDate(dateInfo.date)
          if (!grouped[yearMonth]) {
            grouped[yearMonth] = []
          }
          grouped[yearMonth].push(dateInfo)
        })

        // 各月をソート（日付の新しい順）
        Object.keys(grouped).forEach(month => {
          grouped[month].sort((a, b) => b.date.localeCompare(a.date))
        })

        setGroupedDates(grouped)

        // 最新月のみ展開
        const latestMonth = Object.keys(grouped).sort().reverse()[0]
        if (latestMonth) {
          setExpandedMonths({ [latestMonth]: true })
        }

      } catch (error) {
        console.error('日付データの取得エラー:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAvailableDates()
  }, [])

  const breadcrumbItems = [
    { label: 'ホーム', path: '/' },
    { label: '過去の予想', path: '/races' }
  ]

  // 月のサマリーを計算
  const getMonthSummary = (dates) => {
    const totalRaces = dates.reduce((sum, d) => sum + d.finishedRaces, 0)
    // スタンダードモデルの平均的中率を計算
    let totalWinHits = 0
    dates.forEach(d => {
      const standardModel = d.modelComparison?.find(m => m.key === 'standard')
      if (standardModel) {
        totalWinHits += standardModel.winHitRate * standardModel.races
      }
    })
    const avgWinRate = totalRaces > 0 ? ((totalWinHits / totalRaces) * 100).toFixed(1) : '0.0'
    return { totalRaces, avgWinRate, days: dates.length }
  }

  return (
    <>
      <Helmet>
        <title>過去のAI予想データ - BoatAI</title>
        <meta name="description" content="BoatAIの過去のレース予想データと的中実績を確認できます。日別の的中率や回収率をチェックして、AIの精度を検証してください。" />
        <meta property="og:title" content="過去のAI予想データ - BoatAI" />
        <meta property="og:description" content="BoatAIの過去のレース予想データと的中実績を確認できます。" />
        <link rel="canonical" href="https://boat-ai.jp/races" />
      </Helmet>

      <Header />

      <div className="race-history-page">
        <Breadcrumb items={breadcrumbItems} />

      <div className="race-history-container">
        <header className="page-header">
          <h1>📅 過去の予想データ</h1>
          <p className="page-description">
            過去のレース予想と的中実績を日付別に確認できます。
          </p>
        </header>

        {/* 月別日付一覧 */}
        <div className="dates-section">
          {loading ? (
            <LoadingScreen
              title="過去の予想データを読み込み中..."
              description="過去90日分のデータを確認しています"
            />
          ) : Object.keys(groupedDates).length === 0 ? (
            <div className="no-data">
              <p>利用可能なデータがありません</p>
            </div>
          ) : (
            <div className="month-groups">
              {Object.keys(groupedDates).sort().reverse().map(yearMonth => {
                const dates = groupedDates[yearMonth]
                const summary = getMonthSummary(dates)
                const isExpanded = expandedMonths[yearMonth]

                return (
                  <div key={yearMonth} className="month-group">
                    <div
                      className="month-header"
                      onClick={() => toggleMonth(yearMonth)}
                    >
                      <div className="month-title">
                        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        <h2>📅 {yearMonth}</h2>
                      </div>
                      <div className="month-summary">
                        {summary.days}日分 | {summary.totalRaces}レース | 単勝的中率 {summary.avgWinRate}%
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="dates-list">
                        {dates.map(dateInfo => (
                          <Link
                            key={dateInfo.date}
                            to={`/races/${dateInfo.date}`}
                            className="date-card"
                          >
                            <div className="date-card-header">
                              <h3>{formatDate(dateInfo.date).short}</h3>
                              <span className="race-count">
                                {dateInfo.finishedRaces}/{dateInfo.totalRaces} レース完了
                              </span>
                            </div>

                            {/* モデル間パフォーマンス比較表 */}
                            <ModelComparisonTable
                              data={dateInfo.modelComparison}
                              compact={true}
                            />

                            <div className="date-card-footer">
                              <span className="view-detail">詳細を見る →</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  )
}

export default RaceHistory
