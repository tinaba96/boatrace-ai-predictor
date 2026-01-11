/**
 * StatsTable - 統計テーブルコンポーネント
 */
import { formatPercent } from '../../utils/formatters'
import { getRecoveryColor } from '../../utils/colors'

function StatsTable({ data, title }) {
  if (!data || !data.totalRaces) return null

  // 的中したレース数を計算するヘルパー関数
  const getHitCount = (hitRate) => Math.round(hitRate * data.totalRaces)

  // 的中率と的中数を表示する関数
  const formatHitRateWithCount = (hitRate) => {
    const hitCount = getHitCount(hitRate)
    return `${formatPercent(hitRate)} (${hitCount}/${data.totalRaces})`
  }

  return (
    <div className="stats-table-container">
      <h3>{title}</h3>
      <p className="stats-meta">レース数: {data.totalRaces}レース</p>
      <div className="table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th>券種</th>
              <th>的中率</th>
              <th>回収率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="bet-type">単勝</td>
              <td className="hit-rate">{formatHitRateWithCount(data.topPickHitRate)}</td>
              <td className="recovery-rate" style={{ color: getRecoveryColor(data.actualRecovery?.win?.recoveryRate || 0) }}>
                {data.actualRecovery?.win ? formatPercent(data.actualRecovery.win.recoveryRate) : '-'}
              </td>
            </tr>
            <tr>
              <td className="bet-type">複勝</td>
              <td className="hit-rate">{formatHitRateWithCount(data.topPickPlaceRate)}</td>
              <td className="recovery-rate" style={{ color: getRecoveryColor(data.actualRecovery?.place?.recoveryRate || 0) }}>
                {data.actualRecovery?.place ? formatPercent(data.actualRecovery.place.recoveryRate) : '-'}
              </td>
            </tr>
            <tr>
              <td className="bet-type">3連複</td>
              <td className="hit-rate">{formatHitRateWithCount(data.top3HitRate)}</td>
              <td className="recovery-rate" style={{ color: getRecoveryColor(data.actualRecovery?.trifecta?.recoveryRate || 0) }}>
                {data.actualRecovery?.trifecta ? formatPercent(data.actualRecovery.trifecta.recoveryRate) : '-'}
              </td>
            </tr>
            <tr>
              <td className="bet-type">3連単</td>
              <td className="hit-rate">{formatHitRateWithCount(data.top3IncludedRate)}</td>
              <td className="recovery-rate" style={{ color: getRecoveryColor(data.actualRecovery?.trio?.recoveryRate || 0) }}>
                {data.actualRecovery?.trio ? formatPercent(data.actualRecovery.trio.recoveryRate) : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StatsTable
