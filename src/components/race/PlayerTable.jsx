/**
 * PlayerTable - AI予想順位テーブル
 */

function PlayerTable({ allPlayers, top3 }) {
  if (!allPlayers || allPlayers.length === 0) {
    return null
  }

  // AIスコアで降順ソート
  const sortedPlayers = [...allPlayers].sort((a, b) => b.aiScore - a.aiScore)

  return (
    <div className="all-players">
      <h4>🏆 AI予想順位</h4>
      <div className="table-wrapper">
        <table className="players-table">
          <thead>
            <tr>
              <th>艇番</th>
              <th>選手名</th>
              <th>級別</th>
              <th>年齢</th>
              <th>勝率</th>
              <th>モーター</th>
              <th>AIスコア</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(player => (
              <tr key={player.number} className={(top3 || []).includes(player.number) ? 'recommended' : ''}>
                <td><strong>{player.number}</strong></td>
                <td>{player.name}</td>
                <td>{player.grade}</td>
                <td>{player.age}歳</td>
                <td>{player.winRate}</td>
                <td>{player.motorNumber} ({player.motor2Rate}%)</td>
                <td><span className="score-badge">{player.aiScore}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlayerTable
