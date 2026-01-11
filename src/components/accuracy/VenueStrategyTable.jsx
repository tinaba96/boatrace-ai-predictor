/**
 * VenueStrategyTable - ボートレース場別投資戦略テーブル
 */
import { STADIUM_NAMES, MODEL_NAMES } from '../../constants'
import { formatPercent } from '../../utils/formatters'
import { getRecoveryColor } from '../../utils/colors'

function VenueStrategyTable({ models, selectedModel }) {
  if (!models) return null

  // 選択されたモデルの24ボートレース場データを取得（全期間データ）
  const venueData = Object.keys(STADIUM_NAMES).map(venueCode => {
    const venueStats = models[selectedModel]?.byVenue?.[venueCode]
    const overallStats = venueStats?.overall

    return {
      venueCode: parseInt(venueCode),
      venueName: STADIUM_NAMES[venueCode],
      win: overallStats?.actualRecovery?.win?.recoveryRate,
      place: overallStats?.actualRecovery?.place?.recoveryRate,
      trifecta: overallStats?.actualRecovery?.trifecta?.recoveryRate,
      trio: overallStats?.actualRecovery?.trio?.recoveryRate,
      totalRaces: overallStats?.totalRaces || 0
    }
  })

  return (
    <div className="venue-strategy-section">
      <h3>🎯 ボートレース場別投資戦略</h3>
      <p className="section-description">
        {MODEL_NAMES[selectedModel]}モデルの各ボートレース場・各買い方の回収率を表示しています
      </p>

      <div className="table-wrapper">
        <table className="venue-strategy-table">
          <thead>
            <tr>
              <th>ボートレース場</th>
              <th>レース数</th>
              <th>単勝</th>
              <th>複勝</th>
              <th>3連複</th>
              <th>3連単</th>
            </tr>
          </thead>
          <tbody>
            {venueData.map(venue => (
              <tr key={venue.venueCode}>
                <td className="venue-name">{venue.venueName}</td>
                <td className="races-cell">{venue.totalRaces > 0 ? `${venue.totalRaces}` : '-'}</td>
                <td className="recovery-rate" style={{ color: venue.win ? getRecoveryColor(venue.win) : '#64748b' }}>
                  {venue.win !== undefined ? formatPercent(venue.win) : '-'}
                </td>
                <td className="recovery-rate" style={{ color: venue.place ? getRecoveryColor(venue.place) : '#64748b' }}>
                  {venue.place !== undefined ? formatPercent(venue.place) : '-'}
                </td>
                <td className="recovery-rate" style={{ color: venue.trifecta ? getRecoveryColor(venue.trifecta) : '#64748b' }}>
                  {venue.trifecta !== undefined ? formatPercent(venue.trifecta) : '-'}
                </td>
                <td className="recovery-rate" style={{ color: venue.trio ? getRecoveryColor(venue.trio) : '#64748b' }}>
                  {venue.trio !== undefined ? formatPercent(venue.trio) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        💡 回収率100%以上（緑色）なら黒字、100%未満なら赤字を意味します
      </p>
    </div>
  )
}

export default VenueStrategyTable
