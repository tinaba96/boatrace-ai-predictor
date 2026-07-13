/**
 * PredictionTable - AIデータ予想テーブル + データの見方
 */
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
        <span aria-hidden="true">📊</span> {t("table.title")}
      </h3>

      <div className="enhanced-table">
        <table className="players-table-detailed" aria-label={t("table.ariaLabel")}>
          <thead>
            <tr>
              <th scope="col">{t("table.boatNumber")}</th>
              <th scope="col">{t("table.playerName")}</th>
              <th scope="col">{t("table.class")}</th>
              <th scope="col">{t("table.age")}</th>
              <th scope="col">{t("table.nationalWinRate")}</th>
              <th scope="col">{t("table.nationalTop2Rate")}</th>
              <th scope="col">{t("table.localWinRate")}</th>
              <th scope="col">{t("table.motorTop2Rate")}</th>
              <th scope="col">{t("table.avgST")}</th>
              {showExhibition && <th scope="col">{t("table.exhibitionTime")}</th>}
              {showExhibition && <th scope="col">{t("table.exhibitionST")}</th>}
              <th scope="col">{t("table.totalPower")}</th>
              <th scope="col">{t("table.courseWinRate")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => {
              const stats = racerStats.find((s) => s.boatNumber === player.number);
              const rc = (col) => rankClass(colRanks[col]?.[player.number]);
              const fire = (col) => colRanks[col]?.[player.number] === 1
                ? <span className="fire" aria-label={t("table.firstPlace")}>🔥</span>
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
            <span aria-hidden="true">💡</span> {t("table.guideTitle")}
          </h4>
        </summary>
        <div className="guide-grid">
          <div className="guide-item">
            <strong>{t("table.nationalWinRate")}</strong>
            <p>{t("table.guideNationalWinRate")}</p>
          </div>
          <div className="guide-item">
            <strong>{t("table.nationalTop2Rate")}</strong>
            <p>{t("table.guideNationalTop2Rate")}</p>
          </div>
          <div className="guide-item">
            <strong>{t("table.localWinRate")}</strong>
            <p>{t("table.guideLocalWinRate")}</p>
          </div>
          <div className="guide-item">
            <strong>{t("table.motorTop2Rate")}</strong>
            <p>{t("table.guideMotorTop2Rate")}</p>
          </div>
          <div className="guide-item">
            <strong>{t("table.avgST")}</strong>
            <p>{t("table.guideAvgST")}</p>
          </div>
          <div className="guide-item">
            <strong>🔥</strong>
            <p>{t("table.guideFireMark")}</p>
          </div>
          {showExhibition && (
            <div className="guide-item">
              <strong>{t("table.exhibitionTime")}</strong>
              <p>{t("table.guideExhibitionTime")}</p>
            </div>
          )}
          {showExhibition && (
            <div className="guide-item">
              <strong>{t("table.exhibitionST")}</strong>
              <p>{t("table.guideExhibitionST")}</p>
            </div>
          )}
          <div className="guide-item">
            <strong>{t("table.totalPower")}</strong>
            <p>{t("table.guideTotalPower")}</p>
          </div>
          <div className="guide-item">
            <strong>{t("table.courseWinRate")}</strong>
            <p>{t("table.guideCourseWinRate")}</p>
          </div>
        </div>
      </details>
    </div>
  );
}

export default PredictionTable;
