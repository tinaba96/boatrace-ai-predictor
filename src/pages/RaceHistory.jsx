import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Header from '../components/Header'
import Breadcrumb from '../components/Breadcrumb'
import LoadingScreen from '../components/LoadingScreen'
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

  // 利用可能な日付を取得し、月別にグループ化
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        setLoading(true)

        // 利用可能な日付を推測（過去90日分をチェック）
        const dates = []
        const today = new Date()
        const jstOffset = 9 * 60
        const jstToday = new Date(today.getTime() + jstOffset * 60 * 1000)

        for (let i = 1; i < 90; i++) {
          const targetDate = new Date(jstToday.getTime() - i * 24 * 60 * 60 * 1000)
          const dateStr = targetDate.toISOString().split('T')[0]

          // ファイルが存在するかチェック
          try {
            const response = await fetch(
              import.meta.env.BASE_URL + `data/predictions/${dateStr}.json`,
              { method: 'HEAD' }
            )
            if (response.ok) {
              // 実際にデータを取得して統計を計算
              const dataResponse = await fetch(import.meta.env.BASE_URL + `data/predictions/${dateStr}.json`)
              const data = await dataResponse.json()

              const totalRaces = data.races?.length || 0
              const finishedRaces = data.races?.filter(r => r.result?.finished).length || 0

              // モデル間パフォーマンスを計算
              // 12/18以前は prediction (単数形)、12/19以降は predictions (複数形)
              const hasNewFormat = data.races?.some(r => r.predictions)
              const models = hasNewFormat ? ['standard', 'safeBet', 'upsetFocus'] : ['standard']
              const modelNames = {
                standard: 'スタンダード',
                safeBet: '本命狙い',
                upsetFocus: '穴狙い'
              }

              const modelComparison = models.map(modelKey => {
                const races = data.races?.filter(r => r.result?.finished) || []
                let winHits = 0, placeHits = 0, trifecta3Hits = 0, trio3Hits = 0
                let winPayouts = 0, placePayouts = 0, trifecta3Payouts = 0, trio3Payouts = 0

                races.forEach(race => {
                  // 新形式: predictions[modelKey]、旧形式: prediction (standardとして扱う)
                  const prediction = race.predictions?.[modelKey] || (modelKey === 'standard' ? race.prediction : null)
                  if (!prediction) return

                  const topPick = prediction.topPick
                  const top3 = prediction.top3
                  const result = race.result

                  // 的中判定
                  if (topPick === result.rank1) {
                    winHits++
                    const payout = result.payouts?.win?.[String(topPick)]
                    if (payout) winPayouts += payout
                  }
                  if (topPick === result.rank1 || topPick === result.rank2) {
                    placeHits++
                    const payout = result.payouts?.place?.[String(topPick)]
                    if (payout) placePayouts += payout
                  }
                  if (top3.includes(result.rank1) && top3.includes(result.rank2) && top3.includes(result.rank3)) {
                    trifecta3Hits++
                    // 3連複の配当を取得
                    const sorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b)
                    const key = sorted.join('-')
                    const payout = result.payouts?.trifecta?.[key]
                    if (payout) trifecta3Payouts += payout
                  }
                  if (top3[0] === result.rank1 && top3[1] === result.rank2 && top3[2] === result.rank3) {
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
            }
          } catch (error) {
            // ファイルが存在しない場合はスキップ
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

  // パーセント表示
  const formatPercent = (rate) => (rate * 100).toFixed(1) + '%'

  // 回収率の色を取得
  const getRecoveryColor = (rate) => {
    if (rate >= 1.0) return '#10b981'
    if (rate >= 0.9) return '#f59e0b'
    return '#ef4444'
  }

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
                            {dateInfo.modelComparison && dateInfo.modelComparison.length > 0 && (
                              <div style={{
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                margin: '0 -1rem',
                                padding: '0 1rem'
                              }}>
                                <table style={{
                                  minWidth: '580px',
                                  width: '100%',
                                  borderCollapse: 'collapse',
                                  marginBottom: '0.5rem',
                                  fontSize: '0.8rem'
                                }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                      <th style={{ padding: '0.5rem 0.3rem', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>モデル</th>
                                      <th colSpan="2" style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>単勝</th>
                                      <th colSpan="2" style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>複勝</th>
                                      <th colSpan="2" style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>3連複</th>
                                      <th colSpan="2" style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>3連単</th>
                                    </tr>
                                    <tr style={{ background: '#f8fafc' }}>
                                      <th></th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>的中</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>回収</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>的中</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>回収</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>的中</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>回収</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>的中</th>
                                      <th style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#64748b' }}>回収</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dateInfo.modelComparison.map(model => (
                                      <tr key={model.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '0.5rem 0.3rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{model.name}</td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>{model.races > 0 ? formatPercent(model.winHitRate) : '-'}</td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 600, color: model.races > 0 ? getRecoveryColor(model.winRecoveryRate) : '#64748b' }}>
                                          {model.races > 0 ? formatPercent(model.winRecoveryRate) : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>{model.races > 0 ? formatPercent(model.placeHitRate) : '-'}</td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 600, color: model.races > 0 ? getRecoveryColor(model.placeRecoveryRate) : '#64748b' }}>
                                          {model.races > 0 ? formatPercent(model.placeRecoveryRate) : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>{model.races > 0 ? formatPercent(model.trifectaHitRate) : '-'}</td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 600, color: model.races > 0 ? getRecoveryColor(model.trifectaRecoveryRate) : '#64748b' }}>
                                          {model.races > 0 ? formatPercent(model.trifectaRecoveryRate) : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>{model.races > 0 ? formatPercent(model.trioHitRate) : '-'}</td>
                                        <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center', fontWeight: 600, color: model.races > 0 ? getRecoveryColor(model.trioRecoveryRate) : '#64748b' }}>
                                          {model.races > 0 ? formatPercent(model.trioRecoveryRate) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

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
