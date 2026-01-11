/**
 * VenueDetailedAnalysis - ボートレース場別詳細分析セクション
 */
import { useState } from 'react'
import { STADIUM_NAMES, MODEL_NAMES } from '../../constants'
import StatsTable from './StatsTable'

function VenueDetailedAnalysis({ models }) {
  const [detailVenue, setDetailVenue] = useState('1') // デフォルトは桐生
  const [detailModel, setDetailModel] = useState('standard')

  if (!models) return null

  const venueData = models[detailModel]?.byVenue?.[detailVenue]
  if (!venueData) return null

  return (
    <div className="venue-detailed-analysis">
      <h3>📊 ボートレース場別詳細分析</h3>
      <p className="section-description">
        特定のボートレース場とモデルを選択して詳細な統計を確認できます
      </p>

      {/* ボートレース場セレクター */}
      <div className="venue-selector">
        <label htmlFor="detail-venue-select">ボートレース場:</label>
        <select
          id="detail-venue-select"
          value={detailVenue}
          onChange={(e) => setDetailVenue(e.target.value)}
        >
          {Object.entries(STADIUM_NAMES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* モデル選択タブ */}
      <div className="strategy-model-selector" role="group" aria-label="詳細分析用モデル選択">
        <button
          className={detailModel === 'standard' ? 'active' : ''}
          onClick={() => setDetailModel('standard')}
        >
          スタンダード
        </button>
        <button
          className={detailModel === 'safeBet' ? 'active' : ''}
          onClick={() => setDetailModel('safeBet')}
        >
          本命狙い
        </button>
        <button
          className={detailModel === 'upsetFocus' ? 'active' : ''}
          onClick={() => setDetailModel('upsetFocus')}
        >
          穴狙い
        </button>
      </div>

      {/* 選択されたボートレース場の統計 */}
      <div className="venue-stats-grid">
        {venueData.thisMonth && venueData.thisMonth.totalRaces > 0 && (
          <StatsTable
            data={venueData.thisMonth}
            title={`今月の成績（${STADIUM_NAMES[detailVenue]}）`}
          />
        )}
        {venueData.overall && venueData.overall.totalRaces > 0 && (
          <StatsTable
            data={venueData.overall}
            title={`全期間の成績（${STADIUM_NAMES[detailVenue]}）`}
          />
        )}
      </div>

      {venueData.thisMonth?.totalRaces === 0 && venueData.overall?.totalRaces === 0 && (
        <p className="no-data-message" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          {STADIUM_NAMES[detailVenue]}のデータはまだありません
        </p>
      )}
    </div>
  )
}

export default VenueDetailedAnalysis
