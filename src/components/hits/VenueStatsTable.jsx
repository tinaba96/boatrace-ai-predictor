/**
 * VenueStatsTable - ボートレース場別統計テーブル
 */

function VenueStatsTable({ venueStats }) {
  if (venueStats.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <p>選択期間に正解レースがありません</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="venue-stats-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>ボートレース場</th>
            <th className="text-right">正解数</th>
            <th className="text-right">総配当</th>
          </tr>
        </thead>
        <tbody>
          {venueStats.map((stat, index) => (
            <tr key={stat.venue} className={index < 3 ? 'top-3' : ''}>
              <td className={`rank-cell ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}`}>
                {index === 0 && '🏆'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && (index + 1)}
              </td>
              <td className="venue-name">
                {stat.venue}
              </td>
              <td className="hit-count text-right">
                {stat.hitCount}レース
              </td>
              <td className="total-payout text-right">
                {stat.totalPayout.toLocaleString()}円
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default VenueStatsTable
