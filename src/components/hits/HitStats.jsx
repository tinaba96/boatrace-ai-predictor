/**
 * HitStats - 正解統計ボックスコンポーネント
 */

function HitStats({ hitRaces }) {
  const totalPayout = hitRaces.reduce((sum, race) => sum + race.totalPayout, 0)

  return (
    <div className="stats-box">
      <div className="stats-flex">
        <div className="stat-item">
          <div className="stat-label">
            正解数
          </div>
          <div className="stat-value">
            {hitRaces.length}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">
            総配当
          </div>
          <div className="stat-value">
            {totalPayout.toLocaleString()}円
          </div>
        </div>
      </div>
    </div>
  )
}

export default HitStats
