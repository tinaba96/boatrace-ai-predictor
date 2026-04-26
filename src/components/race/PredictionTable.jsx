/**
 * PredictionTable - AIデータ予想テーブル + データの見方
 */

// 各列内でのランク（1=最良）を計算して返す
function computeColumnRanks(players, racerStats) {
  const rank = (items, higherIsBetter = true) => {
    const valid = items.filter(({ val }) => val != null && !isNaN(val));
    const sorted = [...valid].sort((a, b) =>
      higherIsBetter ? b.val - a.val : a.val - b.val
    );
    const map = {};
    sorted.forEach(({ key }, i) => { map[key] = i + 1; });
    return map;
  };

  return {
    winRate:     rank(players.map(p => ({ key: p.number, val: parseFloat(p.winRate) }))),
    global2Rate: rank(players.map(p => ({ key: p.number, val: parseFloat(p.global2Rate) }))),
    localWinRate:rank(players.map(p => ({ key: p.number, val: parseFloat(p.localWinRate) }))),
    motor2Rate:  rank(players.map(p => ({ key: p.number, val: parseFloat(p.motor2Rate) }))),
    avgST:       rank(racerStats.filter(s => s.avgST != null).map(s => ({ key: s.boatNumber, val: s.avgST })), false),
  };
}

function rankClass(rank) {
  if (rank === 1) return "rank-1st";
  if (rank === 2) return "rank-2nd";
  if (rank === 3) return "rank-3rd";
  return "";
}

function PredictionTable({ prediction, showExhibition = false }) {
  if (!prediction?.allPlayers || prediction.allPlayers.length === 0)
    return null;

  const top3 = prediction.top3 || [];
  const strengths = prediction.turnPrediction?.boatStrengths || [];
  const racerStats = prediction.racerStats || [];
  const sorted = [...prediction.allPlayers].sort((a, b) => {
    const aIdx = top3.indexOf(a.number);
    const bIdx = top3.indexOf(b.number);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (strengths[b.number - 1] || 0) - (strengths[a.number - 1] || 0);
  });

  const colRanks = computeColumnRanks(prediction.allPlayers, racerStats);

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
            {sorted.map((player) => {
              const stats = racerStats.find((s) => s.boatNumber === player.number);
              const rc = (col) => rankClass(colRanks[col]?.[player.number]);
              const fire = (col) => colRanks[col]?.[player.number] === 1
                ? <span className="fire" aria-label="1位">🔥</span>
                : null;
              return (
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
                <td><span className={rc("winRate")}>{player.winRate}</span>{fire("winRate")}</td>
                <td>
                  <span className={rc("global2Rate")}>{player.global2Rate ? `${player.global2Rate}%` : "-"}</span>{fire("global2Rate")}
                </td>
                <td>
                  <span className={rc("localWinRate")}>{player.localWinRate}</span>{fire("localWinRate")}
                </td>
                <td>
                  <span className={rc("motor2Rate")}>{player.motor2Rate}%</span>{fire("motor2Rate")}
                </td>
                <td>
                  <span className={rc("avgST")}>{stats?.avgST != null ? stats.avgST.toFixed(2) : "-"}</span>{fire("avgST")}
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
                    const courseCounts = stats?.courseRaceCounts?.[String(player.number)];
                    if (!courseCounts) return "-";
                    return `${courseCounts.wins || 0}/${courseCounts.total || 0}`;
                  })()}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="data-guide">
        <summary>
          <h4>
            <span aria-hidden="true">💡</span> データの見方
          </h4>
        </summary>
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
      </details>
    </div>
  );
}

export default PredictionTable;
