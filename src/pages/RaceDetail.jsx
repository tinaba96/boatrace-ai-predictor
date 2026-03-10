import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Header from '../components/Header'
import Breadcrumb from '../components/Breadcrumb'
import ModelComparisonTable from '../components/ModelComparisonTable'
import {
  VenueSelector,
  RaceCard,
  VolatilityDisplay,
  ModelDescription,
  ModelSwitcher,
  RaceResult,
  PlayerTable,
  FirstMarkAnimation,
  AttackDefenseTable
} from '../components/race'
import { dataService } from '../services/dataService'
import { STADIUM_NAMES } from '../constants'
import { formatDate, formatPercent } from '../utils/formatters'
import { getRecoveryColor } from '../utils/colors'
import { getVenueGuidePath } from '../utils/venueUtils'
import './RaceDetail.css'

function RaceDetail() {
  const { date } = useParams()
  const [raceData, setRaceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [venuesData, setVenuesData] = useState([])
  const [selectedVenueId, setSelectedVenueId] = useState(null)
  const [selectedRace, setSelectedRace] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [selectedModel, setSelectedModel] = useState('standard')
  const [volatility, setVolatility] = useState(null)
  const predictionRef = useRef(null)

  // レースデータを取得（Supabaseから）
  useEffect(() => {
    const fetchRaceData = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await dataService.getPredictions(date)

        if (!data.races || data.races.length === 0) {
          throw new Error('データが見つかりません')
        }

        setRaceData(data)

        // 会場ごとにレースをグループ化
        const venueMap = {}
        data.races?.forEach(race => {
          const venueCode = race.venueCode
          if (!venueMap[venueCode]) {
            venueMap[venueCode] = {
              placeCd: venueCode,
              placeName: race.venue,
              races: []
            }
          }
          venueMap[venueCode].races.push({
            id: race.raceId,
            venue: race.venue,
            raceNumber: race.raceNumber,
            venueCode: race.venueCode,
            rawData: race
          })
        })

        Object.values(venueMap).forEach(venue => {
          venue.races.sort((a, b) => a.raceNumber - b.raceNumber)
        })

        const venues = Object.values(venueMap).sort((a, b) => a.placeCd - b.placeCd)
        setVenuesData(venues)

        if (venues.length > 0) {
          setSelectedVenueId(venues[0].placeCd)
        }

      } catch (err) {
        console.error('データ取得エラー:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRaceData()
  }, [date])

  // モデル切り替え
  const switchModel = (model) => {
    if (!prediction || !prediction.predictions) return

    setSelectedModel(model)

    const modelKey = model === 'safe-bet' ? 'safeBet' :
      model === 'upset-focus' ? 'upsetFocus' : 'standard'
    const modelPrediction = prediction.predictions[modelKey]

    if (modelPrediction) {
      const topPickPlayer = modelPrediction.players?.find(
        p => p.number === modelPrediction.topPick
      )
      const top3Players = (modelPrediction.top3 || []).map(num =>
        modelPrediction.players?.find(p => p.number === num)
      )

      setPrediction({
        ...prediction,
        topPick: topPickPlayer,
        recommended: top3Players,
        allPlayers: modelPrediction.players,
        confidence: modelPrediction.confidence,
        reasoning: modelPrediction.reasoning,
        top3: modelPrediction.top3
      })
    }
  }

  // レース分析
  const analyzeRace = (race) => {
    setSelectedRace(race)

    const racePrediction = race.rawData
    const hasNewFormat = !!racePrediction?.predictions
    const hasOldFormat = !!racePrediction?.prediction

    if (!racePrediction || (!hasNewFormat && !hasOldFormat)) {
      setPrediction({ error: true, errorMessage: '予想データがありません' })
      return
    }

    if (racePrediction.volatility) {
      setVolatility(racePrediction.volatility)
    } else {
      setVolatility(null)
    }

    const modelKey = selectedModel === 'safe-bet' ? 'safeBet' :
      selectedModel === 'upset-focus' ? 'upsetFocus' : 'standard'

    let modelPrediction
    if (hasNewFormat) {
      modelPrediction = racePrediction.predictions[modelKey]
    } else {
      if (modelKey !== 'standard') {
        setPrediction({
          error: true,
          errorMessage: 'この日付のデータはスタンダードモデルのみ対応しています'
        })
        return
      }
      modelPrediction = racePrediction.prediction
    }

    if (!modelPrediction) {
      setPrediction({ error: true, errorMessage: 'このモデルの予想データがありません' })
      return
    }

    const topPickPlayer = modelPrediction.players?.find(
      p => p.number === modelPrediction.topPick
    )
    const top3Players = (modelPrediction.top3 || []).map(num =>
      modelPrediction.players?.find(p => p.number === num)
    )

    setPrediction({
      topPick: topPickPlayer,
      recommended: top3Players,
      allPlayers: modelPrediction.players,
      confidence: modelPrediction.confidence,
      reasoning: modelPrediction.reasoning || ['予想根拠データなし'],
      top3: modelPrediction.top3,
      result: racePrediction.result,
      predictions: racePrediction.predictions || { standard: racePrediction.prediction },
      turnPrediction: racePrediction.turnPrediction || null,
      racerStats: racePrediction.racerStats || null,
    })

    setTimeout(() => {
      predictionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const breadcrumbItems = [
    { label: 'ホーム', path: '/' },
    { label: '過去の予想', path: '/races' },
    { label: formatDate(date), path: `/races/${date}` }
  ]

  // 全モデルの統計を計算
  const getModelComparison = () => {
    if (!raceData || !raceData.races) return null

    const hasNewFormat = raceData.races.some(r => r.predictions)
    const models = hasNewFormat ? ['standard', 'safeBet', 'upsetFocus'] : ['standard']
    const modelNames = {
      standard: 'スタンダード',
      safeBet: '本命狙い',
      upsetFocus: '穴狙い'
    }

    return models.map(modelKey => {
      const finishedRaces = raceData.races.filter(r => r.result?.finished)
      let winHits = 0, placeHits = 0, trifecta3Hits = 0, trio3Hits = 0
      let winPayouts = 0, placePayouts = 0, trifecta3Payouts = 0, trio3Payouts = 0

      finishedRaces.forEach(race => {
        const prediction = race.predictions?.[modelKey] || (modelKey === 'standard' ? race.prediction : null)
        if (!prediction) return

        const topPick = prediction.topPick
        const top3 = prediction.top3
        const result = race.result

        if (topPick === result.rank1) {
          winHits++
          winPayouts += result.payouts?.win?.[topPick] || 0
        }
        if (topPick === result.rank1 || topPick === result.rank2) {
          placeHits++
          placePayouts += result.payouts?.place?.[topPick] || 0
        }
        if (top3.includes(result.rank1) && top3.includes(result.rank2) && top3.includes(result.rank3)) {
          trifecta3Hits++
          const sorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b)
          const trifectaKey = sorted.join('-')
          trifecta3Payouts += result.payouts?.trifecta?.[trifectaKey] || 0
        }
        if (top3[0] === result.rank1 && top3[1] === result.rank2 && top3[2] === result.rank3) {
          trio3Hits++
          const trioKey = `${result.rank1}-${result.rank2}-${result.rank3}`
          trio3Payouts += result.payouts?.trio?.[trioKey] || 0
        }
      })

      const totalRaces = finishedRaces.length

      return {
        key: modelKey,
        name: modelNames[modelKey],
        races: totalRaces,
        winHitRate: totalRaces > 0 ? winHits / totalRaces : 0,
        winRecoveryRate: totalRaces > 0 ? (winPayouts / 100) / totalRaces : 0,
        placeHitRate: totalRaces > 0 ? placeHits / totalRaces : 0,
        placeRecoveryRate: totalRaces > 0 ? (placePayouts / 100) / totalRaces : 0,
        trifectaHitRate: totalRaces > 0 ? trifecta3Hits / totalRaces : 0,
        trifectaRecoveryRate: totalRaces > 0 ? (trifecta3Payouts / 100) / totalRaces : 0,
        trioHitRate: totalRaces > 0 ? trio3Hits / totalRaces : 0,
        trioRecoveryRate: totalRaces > 0 ? (trio3Payouts / 100) / totalRaces : 0
      }
    })
  }

  const modelComparison = getModelComparison()
  const selectedVenue = venuesData.find(v => v.placeCd === selectedVenueId)
  const races = selectedVenue?.races || []

  return (
    <>
      <Helmet>
        <title>{formatDate(date)}のAI予想データ - BoatAI</title>
        <meta name="description" content={`${formatDate(date)}のボートレースAI予想データと的中実績。各レース場の予想結果を確認できます。`} />
        <meta property="og:title" content={`${formatDate(date)}のAI予想データ - BoatAI`} />
        <meta property="og:description" content={`${formatDate(date)}のボートレースAI予想データと的中実績`} />
        <link rel="canonical" href={`https://www.boat-ai.jp/races/${date}`} />
      </Helmet>

      <Header />

      <div className="race-detail-page">
        <Breadcrumb items={breadcrumbItems} />

        <div className="race-detail-container">
          <header className="page-header">
            <h1>📅 {formatDate(date)}</h1>
            <Link to="/races" className="back-link">← 日付一覧に戻る</Link>
          </header>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>データを読み込み中...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <h3>エラー</h3>
              <p>{error}</p>
              <Link to="/races" className="btn-primary">日付一覧に戻る</Link>
            </div>
          ) : (
            <>
              <ModelComparisonTable
                data={modelComparison}
                showRaceCount={true}
                title="📊 モデル間パフォーマンス比較"
              />

              <VenueSelector
                venuesData={venuesData}
                selectedVenueId={selectedVenueId}
                onVenueChange={setSelectedVenueId}
              />

              <section className="race-list-section">
                <h2>🏁 レース一覧</h2>
                <p style={{
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.9rem',
                  marginBottom: '1.5rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  maxWidth: '600px',
                  margin: '0 auto 1.5rem'
                }}>
                  ※ 的中バッジは
                  <strong style={{
                    color: 'white',
                    margin: '0 0.3rem',
                    padding: '0.2rem 0.5rem',
                    background: selectedModel === 'standard' ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' :
                               selectedModel === 'safe-bet' ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)' :
                               'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                    borderRadius: '4px'
                  }}>
                    {selectedModel === 'standard' ? 'スタンダード' :
                     selectedModel === 'safe-bet' ? '本命狙い' : '穴狙い'}
                  </strong>
                  モデルの予想結果です
                </p>

                {races.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
                    <p>このレース場のデータはありません</p>
                  </div>
                ) : (
                  <div className="race-grid">
                    {races.map(race => (
                      <RaceCard
                        key={race.id}
                        race={race}
                        selectedModel={selectedModel}
                        onAnalyzeRace={analyzeRace}
                      />
                    ))}
                  </div>
                )}
              </section>

              {selectedRace && (
                <section ref={predictionRef} className="prediction-section">
                  <h2>📊 AI予想結果 - {selectedRace.venue} {selectedRace.raceNumber}R</h2>

                  {prediction && prediction.error ? (
                    <div className="prediction-error">
                      <p>{prediction.errorMessage}</p>
                    </div>
                  ) : prediction && (
                    <>
                      {/* 公式サイトリンク */}
                      {selectedRace.rawData?.venueCode && date && (
                        <div style={{
                          marginTop: '1rem',
                          marginBottom: '1.5rem',
                          padding: '0.75rem 1rem',
                          background: '#e3f2fd',
                          borderRadius: '8px',
                          borderLeft: '4px solid #2196f3'
                        }}>
                          <span style={{ marginRight: '0.5rem' }}>🔗</span>
                          <a
                            href={`https://www.boatrace.jp/owpc/pc/race/racelist?rno=${selectedRace.raceNumber}&jcd=${String(selectedRace.rawData.venueCode).padStart(2, '0')}&hd=${date.replace(/-/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: '500' }}
                          >
                            公式サイトでレース情報を見る
                          </a>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                            （新しいタブで開きます）
                          </span>
                        </div>
                      )}

                      {prediction.predictions && (
                        <>
                          <VolatilityDisplay volatility={volatility} />
                          <ModelDescription />
                        </>
                      )}

                      {prediction.predictions && (
                        <ModelSwitcher
                          selectedModel={selectedModel}
                          onSwitchModel={switchModel}
                        />
                      )}

                      <div className="prediction-result">
                        {/* 1マーク展開予測（目玉機能: 最上部に配置） */}
                        {prediction.turnPrediction && (
                          <FirstMarkAnimation
                            patterns={prediction.turnPrediction.patterns}
                            technique={prediction.turnPrediction.technique}
                            probability={prediction.turnPrediction.probability}
                            winnerCourse={prediction.turnPrediction.winnerCourse}
                            distribution={prediction.turnPrediction.distribution}
                            boatStrengths={prediction.turnPrediction.boatStrengths}
                            players={prediction.allPlayers?.map(p => ({ number: p.number, name: p.name }))}
                          />
                        )}

                        <div className="confidence-bar">
                          <div className="confidence-label">
                            AI信頼度: <strong>{prediction.confidence}%</strong>
                          </div>
                          <div className="bar">
                            <div className="bar-fill" style={{ width: `${prediction.confidence}%` }}></div>
                          </div>
                        </div>

                        <div className="top-pick">
                          <h3>🥇 AI推奨</h3>
                          <div className="player-card featured">
                            <div className="player-number">{prediction.topPick.number}</div>
                            <div className="player-details">
                              <h4>{prediction.topPick.name}</h4>
                              <div className="stats">
                                <span>級別: {prediction.topPick.grade}</span>
                                <span>年齢: {prediction.topPick.age}歳</span>
                                <span>勝率: {prediction.topPick.winRate}</span>
                                <span>モーター: {prediction.topPick.motorNumber} ({prediction.topPick.motor2Rate}%)</span>
                              </div>
                            </div>
                            <div className="ai-score">
                              <div className="score-label">AIスコア</div>
                              <div className="score-value">{prediction.topPick.aiScore}</div>
                            </div>
                          </div>
                        </div>

                        <div className="reasoning">
                          <h4>📌 予想根拠</h4>
                          <ul>
                            {(prediction.reasoning || []).map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>

                        <RaceResult prediction={prediction} />
                        <PlayerTable allPlayers={prediction.allPlayers} top3={prediction.top3} />

                        {/* 超展開データ（上級者向け） */}
                        {prediction.racerStats && (
                          <AttackDefenseTable
                            racerStats={prediction.racerStats}
                            players={prediction.allPlayers}
                          />
                        )}

                        {/* 会場攻略ガイドリンク */}
                        {selectedRace?.rawData?.venueCode && getVenueGuidePath(selectedRace.rawData.venueCode) && (
                          <div className="venue-guide-link">
                            <Link to={getVenueGuidePath(selectedRace.rawData.venueCode)}>
                              <span className="venue-guide-icon">📖</span>
                              <div className="venue-guide-content">
                                <span className="venue-guide-title">{selectedRace.venue}の攻略ガイドを見る</span>
                                <span className="venue-guide-desc">会場の特徴と狙い目を詳しく解説</span>
                              </div>
                              <span className="venue-guide-arrow">→</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default RaceDetail
