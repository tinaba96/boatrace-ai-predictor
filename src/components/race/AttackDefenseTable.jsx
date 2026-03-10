import { BOAT_COLORS } from "../../utils/colors";
import "./AttackDefenseTable.css";

// 表示する行の定義
const TECHNIQUE_ROWS = [
  { key: "nige", label1: "逃げ", labelOther: null, course1Only: true },
  { key: "sashi", label1: "差され", labelOther: "差し" },
  { key: "makuri", label1: "まくられ", labelOther: "まくり" },
  { key: "makurizashi", label1: "捲差され", labelOther: "まくり差し" },
  {
    key: "other",
    label1: "その他",
    labelOther: "その他",
    composite: ["nuki", "megumare"],
  },
];

function calcCount(dist, technique, base) {
  if (!dist || !base) return null;
  const rate = dist[technique];
  if (rate == null || rate === 0) return 0;
  return Math.round(rate * base);
}

function calcCompositeCount(dist, keys, base) {
  if (!dist || !base) return null;
  let sum = 0;
  for (const k of keys) {
    const rate = dist[k];
    if (rate != null) sum += rate;
  }
  return Math.round(sum * base);
}

// 全コース合計勝利数を算出（5未満ならデフォルト分布が使われている）
function getTotalWins(stats) {
  const counts = stats.courseRaceCounts;
  if (!counts) return 0;
  let sum = 0;
  for (const c of Object.values(counts)) {
    sum += c.wins || 0;
  }
  return sum;
}

// セルの値: 回数/分母
// 1コース逃げ: attackDist × wins / total
// 1コース防御: defenseDist × losses / total  (losses = total - wins)
// 2-6コース攻撃: attackDist × wins / total
function getCellValue(row, course, stats, courseStr, wins, total) {
  if (row.course1Only && course !== 1) return "-";
  if (!total) return "-";

  // 全コース合計勝利5回未満 → デフォルト分布のため攻撃データは非表示
  const isDefaultDist = getTotalWins(stats) < 5;

  if (course === 1) {
    if (row.key === "nige") {
      if (isDefaultDist) return "-";
      const dist = stats.attackDistribution?.[courseStr];
      const count = calcCount(dist, "nige", wins);
      return count != null ? `${count}/${total}` : "-";
    }
    // 防御: 負けた回数が分母
    const losses = total - wins;
    const dist = stats.defenseDistribution?.[courseStr];
    if (!dist || !losses) return `0/${total}`;
    const count = row.composite
      ? calcCompositeCount(dist, row.composite, losses)
      : calcCount(dist, row.key, losses);
    return count != null ? `${count}/${total}` : "-";
  } else {
    if (isDefaultDist) return "-";
    const dist = stats.attackDistribution?.[courseStr];
    if (!dist || !wins) return `0/${total}`;
    const count = row.composite
      ? calcCompositeCount(dist, row.composite, wins)
      : calcCount(dist, row.key, wins);
    return count != null ? `${count}/${total}` : "-";
  }
}

const TECH_LABELS = {
  sashi: { defense: "差され", attack: "差し" },
  makuri: { defense: "まくられ", attack: "まくり" },
  makurizashi: { defense: "捲差され", attack: "まくり差し" },
};

// 実データから凡例の例文を生成
function buildExamples(sorted) {
  const examples = [];

  // 1コースの防御例（差され/まくられ/捲差されで回数>0のもの）
  const c1 = sorted[0];
  if (c1) {
    const counts = c1.courseRaceCounts?.["1"];
    const total = counts?.total || 0;
    const wins = counts?.wins || 0;
    const losses = total - wins;
    const defDist = c1.defenseDistribution?.["1"];
    if (defDist && losses > 0 && total > 0) {
      for (const tech of ["sashi", "makuri", "makurizashi"]) {
        const rate = defDist[tech];
        if (rate && rate > 0) {
          const count = Math.round(rate * losses);
          if (count > 0) {
            const label = TECH_LABELS[tech].defense;
            examples.push({
              title: `1コースの「${label} ${count}/${total}」`,
              desc: `→ 1コースで${total}回出走し、うち${count}回は他の選手に「${TECH_LABELS[tech].attack}」で1着を取られた`,
            });
            break;
          }
        }
      }
    }
  }

  // 2-6コースの攻撃例（差し/まくり/まくり差しで回数>0のもの）
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const course = s.course || s.boatNumber;
    const courseStr = String(course);
    const counts = s.courseRaceCounts?.[courseStr];
    const wins = counts?.wins || 0;
    const total = counts?.total || 0;
    const atkDist = s.attackDistribution?.[courseStr];
    if (!atkDist || !wins || !total) continue;

    for (const tech of ["sashi", "makuri", "makurizashi"]) {
      const rate = atkDist[tech];
      if (rate && rate > 0) {
        const count = Math.round(rate * wins);
        if (count > 0) {
          const label = TECH_LABELS[tech].attack;
          examples.push({
            title: `${course}コースの「${label} ${count}/${total}」`,
            desc: `→ ${course}コースで${total}回出走し、うち${count}回は「${label}」で1着を取った`,
          });
          break;
        }
      }
    }
    if (examples.length >= 2) break;
  }

  return examples;
}

function RowLabel({ row }) {
  if (row.course1Only) {
    return <span className="ad-tech-nige">{row.label1}</span>;
  }
  return (
    <>
      <span className="ad-tech-defense">{row.label1}</span>
      <span className="ad-tech-sep">/</span>
      <span className="ad-tech-attack">{row.labelOther}</span>
    </>
  );
}

export default function AttackDefenseTable({ racerStats, players }) {
  if (!racerStats || racerStats.length < 6) return null;

  const sorted = [...racerStats].sort(
    (a, b) => (a.course || a.boatNumber) - (b.course || b.boatNumber),
  );

  const getPlayerName = (boatNumber) => {
    const p = players?.find(
      (pl) => pl.number === boatNumber || pl.boatNumber === boatNumber,
    );
    return p?.name || `${boatNumber}号艇`;
  };

  return (
    <div className="all-players ad-section">
      <h4>超展開データ</h4>

      {/* Desktop table */}
      <div className="table-wrapper ad-table-desktop">
        <table className="players-table">
          <thead>
            <tr>
              <th></th>
              {sorted.map((s) => {
                const course = s.course || s.boatNumber;
                const color = BOAT_COLORS[course] || {};
                return (
                  <th
                    key={course}
                    className={course === 1 ? "ad-course1-th" : ""}
                    style={{
                      background: course === 1 ? "#f1f5f9" : color.bg,
                      color: course === 1 ? "#1e293b" : color.text,
                    }}
                  >
                    <div>{course}コース</div>
                    <div className="ad-role-sub">
                      {course === 1 ? "守備" : "攻撃"}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="ad-label-cell">選手</td>
              {sorted.map((s) => (
                <td key={s.boatNumber}>{getPlayerName(s.boatNumber)}</td>
              ))}
            </tr>

            <tr>
              <td className="ad-label-cell">1着/出走</td>
              {sorted.map((s) => {
                const course = String(s.course || s.boatNumber);
                const counts = s.courseRaceCounts?.[course];
                return (
                  <td key={s.boatNumber}>
                    {counts ? `${counts.wins || 0}/${counts.total || 0}` : "-"}
                  </td>
                );
              })}
            </tr>

            {TECHNIQUE_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="ad-label-cell">
                  <RowLabel row={row} />
                </td>
                {sorted.map((s) => {
                  const course = s.course || s.boatNumber;
                  const courseStr = String(course);
                  const counts = s.courseRaceCounts?.[courseStr];
                  const wins = counts?.wins || 0;
                  const total = counts?.total || 0;

                  return (
                    <td key={s.boatNumber}>
                      {getCellValue(row, course, s, courseStr, wins, total)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: scrollable table (same as desktop) */}
      <div className="table-wrapper ad-table-mobile">
        <table className="players-table">
          <thead>
            <tr>
              <th className="ad-sticky-col"></th>
              {sorted.map((s) => {
                const course = s.course || s.boatNumber;
                const color = BOAT_COLORS[course] || {};
                return (
                  <th
                    key={course}
                    className={course === 1 ? "ad-course1-th" : ""}
                    style={{
                      background: course === 1 ? "#f1f5f9" : color.bg,
                      color: course === 1 ? "#1e293b" : color.text,
                    }}
                  >
                    {course}コース
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="ad-label-cell ad-sticky-col">選手</td>
              {sorted.map((s) => (
                <td key={s.boatNumber}>{getPlayerName(s.boatNumber)}</td>
              ))}
            </tr>
            <tr>
              <td className="ad-label-cell ad-sticky-col">1着/出走</td>
              {sorted.map((s) => {
                const course = String(s.course || s.boatNumber);
                const counts = s.courseRaceCounts?.[course];
                return (
                  <td key={s.boatNumber}>
                    {counts ? `${counts.wins || 0}/${counts.total || 0}` : "-"}
                  </td>
                );
              })}
            </tr>
            {TECHNIQUE_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="ad-label-cell ad-sticky-col">
                  <RowLabel row={row} />
                </td>
                {sorted.map((s) => {
                  const course = s.course || s.boatNumber;
                  const courseStr = String(course);
                  const counts = s.courseRaceCounts?.[courseStr];
                  const wins = counts?.wins || 0;
                  const total = counts?.total || 0;

                  return (
                    <td key={s.boatNumber}>
                      {getCellValue(row, course, s, courseStr, wins, total)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Legend sorted={sorted} />
    </div>
  );
}

function Legend({ sorted }) {
  const examples = buildExamples(sorted);

  return (
    <div className="ad-legend">
      <p><strong>1着/出走</strong>: そのコースでの1着回数 / 出走回数</p>
      <p><span className="ad-tech-defense">赤字</span>: 1コースが受けた攻撃（差され等）の回数</p>
      <p><span className="ad-tech-attack">青字</span>: 2-6コースが仕掛けた攻撃（差し等）の回数</p>
      <p><span className="ad-tech-nige">緑字</span>: 1コースの逃げ成功回数</p>
      {examples.length > 0 && (
        <div className="ad-legend-example">
          {examples.map((ex, i) => (
            <div key={i}>
              <p className="ad-legend-example-title">{ex.title}</p>
              <p>{ex.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
