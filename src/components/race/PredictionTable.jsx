/**
 * PredictionTable - AIデータ予想テーブル + 統計的な注目ポイント + データの見方
 */

function generateInsights(players) {
  const insights = [];

  const topLocalWinRate = [...players].sort(
    (a, b) => parseFloat(b.localWinRate) - parseFloat(a.localWinRate),
  )[0];

  if (topLocalWinRate) {
    insights.push(
      `${topLocalWinRate.number}号艇の${topLocalWinRate.name}選手は` +
        `当レース場での勝率が${topLocalWinRate.localWinRate}と最も高い`,
    );
  }

  const goodMotors = players.filter((p) => parseFloat(p.motor2Rate) > 40);
  if (goodMotors.length > 0) {
    const motorList = goodMotors
      .map((p) => `${p.number}号艇（${p.motor2Rate}%）`)
      .join("、");
    insights.push(`${motorList}のモーターは2連率が高く好調`);
  }

  const topRacers = players.filter((p) => parseFloat(p.winRate) >= 7.0);
  if (topRacers.length > 0) {
    const racerList = topRacers
      .map((p) => `${p.number}号艇（勝率${p.winRate}）`)
      .join("、");
    insights.push(`${racerList}は全国勝率が高い実力者`);
  }

  return insights;
}

function PredictionTable({ prediction, showExhibition = false }) {
  if (!prediction?.allPlayers || prediction.allPlayers.length === 0)
    return null;

  const top3 = prediction.top3 || [];
  const strengths = prediction.turnPrediction?.boatStrengths || [];
  const sorted = [...prediction.allPlayers].sort((a, b) => {
    const aIdx = top3.indexOf(a.number);
    const bIdx = top3.indexOf(b.number);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (strengths[b.number - 1] || 0) - (strengths[a.number - 1] || 0);
  });

  const insights = generateInsights(prediction.allPlayers);

  return (
    <div className="detailed-analysis">
      <h3>
        <span aria-hidden="true">📊</span> AIデータ予想
      </h3>

      <div className="enhanced-table">
        <table className="players-table-detailed" aria-label="選手詳細データ">
          <thead>
            <tr>
              <th scope="col">艇番</th>
              <th scope="col">選手名</th>
              <th scope="col">級別</th>
              <th scope="col">年齢</th>
              <th scope="col">全国勝率</th>
              <th scope="col">全国2連率</th>
              <th scope="col">当地勝率</th>
              <th scope="col">モーター2率</th>
              <th scope="col">平均ST</th>
              {showExhibition && <th scope="col">展示タイム</th>}
              {showExhibition && <th scope="col">展示ST</th>}
              <th scope="col">総合力</th>
              <th scope="col">コース勝率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => (
              <tr
                key={player.number}
                className={top3.includes(player.number) ? "recommended" : ""}
              >
                <th scope="row">
                  <strong>{player.number}</strong>
                </th>
                <td>{player.name}</td>
                <td>{player.grade}</td>
                <td>{player.age || "-"}</td>
                <td>{player.winRate}</td>
                <td>
                  {player.global2Rate ? `${player.global2Rate}%` : "-"}
                </td>
                <td>
                  {player.localWinRate}
                  {parseFloat(player.localWinRate) > 7.0 && (
                    <span className="fire" aria-label="優秀">
                      🔥
                    </span>
                  )}
                </td>
                <td>
                  {player.motor2Rate}%
                  {parseFloat(player.motor2Rate) > 40 && (
                    <span className="fire" aria-label="優秀">
                      🔥
                    </span>
                  )}
                </td>
                <td>
                  {(() => {
                    const stats = prediction.racerStats?.find(
                      (s) => s.boatNumber === player.number,
                    );
                    return stats?.avgST != null
                      ? stats.avgST.toFixed(2)
                      : "-";
                  })()}
                </td>
                {showExhibition && (
                  <td>
                    {(() => {
                      const ex = prediction.exhibitionData?.find(
                        (e) => e.boat_number === player.number,
                      );
                      return ex?.exhibition_time != null
                        ? ex.exhibition_time.toFixed(2)
                        : "-";
                    })()}
                  </td>
                )}
                {showExhibition && (
                  <td>
                    {(() => {
                      const ex = prediction.exhibitionData?.find(
                        (e) => e.boat_number === player.number,
                      );
                      return ex?.start_timing != null
                        ? ex.start_timing.toFixed(2)
                        : "-";
                    })()}
                  </td>
                )}
                <td>
                  {prediction.turnPrediction?.boatStrengths?.[
                    player.number - 1
                  ] != null
                    ? `${Math.round(prediction.turnPrediction.boatStrengths[player.number - 1] * 100)}%`
                    : "-"}
                </td>
                <td>
                  {(() => {
                    const stats = prediction.racerStats?.find(
                      (s) => s.boatNumber === player.number,
                    );
                    const courseCounts =
                      stats?.courseRaceCounts?.[String(player.number)];
                    if (!courseCounts) return "-";
                    return `${courseCounts.wins || 0}/${courseCounts.total || 0}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {insights.length > 0 && (
        <div className="statistical-insights">
          <h4>
            <span aria-hidden="true">📌</span> 統計的な注目ポイント
          </h4>
          <ul>
            {insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="data-guide">
        <h4>
          <span aria-hidden="true">💡</span> データの見方
        </h4>
        <div className="guide-grid">
          <div className="guide-item">
            <strong>全国勝率</strong>
            <p>選手の全国での勝率。6.0以上でA級レベル。</p>
          </div>
          <div className="guide-item">
            <strong>全国2連率</strong>
            <p>2着以内に入る確率。舟券に絡む力を示す。</p>
          </div>
          <div className="guide-item">
            <strong>当地勝率</strong>
            <p>このレース場での勝率。得意度を示す。</p>
          </div>
          <div className="guide-item">
            <strong>モーター2率</strong>
            <p>モーターの2連率。40%以上なら好機。</p>
          </div>
          <div className="guide-item">
            <strong>平均ST</strong>
            <p>平均スタートタイミング。小さいほどスタートが速い。</p>
          </div>
          <div className="guide-item">
            <strong>🔥マーク</strong>
            <p>特に優れた数値（平均より大きく上回る）。</p>
          </div>
          {showExhibition && (
            <div className="guide-item">
              <strong>展示タイム</strong>
              <p>直線の走行タイム。数字が小さいほど機力が良い。</p>
            </div>
          )}
          {showExhibition && (
            <div className="guide-item">
              <strong>展示ST</strong>
              <p>スタートタイミング。小さいほどスタート力が高い。</p>
            </div>
          )}
          <div className="guide-item">
            <strong>総合力</strong>
            <p>ST優位性とモーター性能から算出した総合的な強さ指標。</p>
          </div>
          <div className="guide-item">
            <strong>コース勝率</strong>
            <p>そのコースでの過去の勝利数と出走数。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PredictionTable;
