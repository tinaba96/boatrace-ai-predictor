/**
 * VolatilityDisplay - イン崩れ指数表示コンポーネント
 */

const NATIONAL_AVG_WIN_RATE = 53;
const WIN_RATE_BAR_MIN = 40;
const WIN_RATE_BAR_MAX = 65;

function WinRateGauge({ rate }) {
  const pct = rate * 100;
  const diff = pct - NATIONAL_AVG_WIN_RATE;
  const color =
    pct < 47 ? "#ef5350" : pct < NATIONAL_AVG_WIN_RATE ? "#ff9800" : "#4caf50";
  const barFill = Math.min(
    100,
    Math.max(
      0,
      ((pct - WIN_RATE_BAR_MIN) / (WIN_RATE_BAR_MAX - WIN_RATE_BAR_MIN)) * 100,
    ),
  );
  const avgMarkerPos =
    ((NATIONAL_AVG_WIN_RATE - WIN_RATE_BAR_MIN) /
      (WIN_RATE_BAR_MAX - WIN_RATE_BAR_MIN)) *
    100;

  return (
    <div
      style={{
        marginTop: "0.75rem",
        marginBottom: "0.25rem",
        padding: "0.6rem 0.75rem",
        background: "rgba(255,255,255,0.55)",
        borderRadius: "6px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.4rem",
        }}
      >
        <span style={{ fontSize: "0.82rem", color: "#555" }}>
          1コース勝率（直近90日）
        </span>
        <div
          style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}
        >
          <span
            style={{
              fontSize: "1.25rem",
              fontWeight: "700",
              color,
              lineHeight: 1,
            }}
          >
            {pct.toFixed(1)}%
          </span>
          <span style={{ fontSize: "0.72rem", color, fontWeight: "600" }}>
            ({diff >= 0 ? "+" : ""}
            {diff.toFixed(1)}pt)
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height: "6px",
          background: "#e0e0e0",
          borderRadius: "3px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${barFill}%`,
            height: "100%",
            background: color,
            borderRadius: "3px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${avgMarkerPos}%`,
            top: "-3px",
            bottom: "-3px",
            width: "2px",
            background: "#616161",
            borderRadius: "1px",
            transform: "translateX(-50%)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.68rem",
          color: "#999",
          marginTop: "0.25rem",
        }}
      >
        <span>{WIN_RATE_BAR_MIN}%</span>
        <span>全国平均 {NATIONAL_AVG_WIN_RATE}%</span>
        <span>{WIN_RATE_BAR_MAX}%</span>
      </div>
    </div>
  );
}

function VolatilityDisplay({ volatility }) {
  if (!volatility) {
    return null;
  }

  return (
    <div
      style={{
        padding: "1rem 1.5rem",
        background:
          volatility.level === "high"
            ? "#fff3e0"
            : volatility.level === "low"
              ? "#e8f5e9"
              : "#e3f2fd",
        borderRadius: "8px",
        marginBottom: "1.5rem",
        borderLeft: `4px solid ${
          volatility.level === "high"
            ? "#ff9800"
            : volatility.level === "low"
              ? "#4caf50"
              : "#2196f3"
        }`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>
          {volatility.level === "high"
            ? "🌪️"
            : volatility.level === "low"
              ? "🎯"
              : "⚖️"}
        </span>
        <span style={{ fontWeight: "600", color: "#333" }}>
          イン崩れ指数: {volatility.score}
        </span>
        <span
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: "500",
            background:
              volatility.level === "high"
                ? "#ff9800"
                : volatility.level === "low"
                  ? "#4caf50"
                  : "#2196f3",
            color: "white",
          }}
        >
          {volatility.level === "high"
            ? "イン崩れ確率高"
            : volatility.level === "low"
              ? "本命有利"
              : "標準"}
        </span>
      </div>

      {/* 指数の説明 */}
      <div
        style={{
          fontSize: "0.8rem",
          color: "#777",
          paddingLeft: "1.7rem",
          marginBottom: "0.25rem",
        }}
      >
        1コースが崩れる可能性の目安（高いほど波乱になりやすい）
      </div>

      {/* 1コース勝率ゲージ（会場ベースライン） */}
      {volatility.venueWinRate != null && (
        <WinRateGauge rate={volatility.venueWinRate} />
      )}

      {/* イン崩れ指数の根拠 */}
      {volatility.reasons && volatility.reasons.length > 0 && (
        <div
          style={{
            fontSize: "0.9rem",
            color: "#555",
            paddingLeft: "1.7rem",
            marginTop: "0.5rem",
          }}
        >
          <ul
            style={{
              margin: "0",
              paddingLeft: "1.2rem",
              listStyleType: "disc",
            }}
          >
            {volatility.reasons.map((reason, index) => (
              <li key={index} style={{ marginBottom: "0.25rem" }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* おすすめモデル */}
      {volatility.recommendedModel && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "rgba(255, 255, 255, 0.5)",
            borderRadius: "6px",
            fontSize: "0.9rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>💡</span>
            <span style={{ fontWeight: "600", color: "#333" }}>
              おすすめモデル:
            </span>
            <span
              style={{
                color:
                  volatility.recommendedModel === "upset-focus"
                    ? "#ff6b00"
                    : volatility.recommendedModel === "safe-bet"
                      ? "#2e7d32"
                      : "#0ea5e9",
                fontWeight: "600",
              }}
            >
              {volatility.recommendedModel === "standard" && "スタンダード"}
              {volatility.recommendedModel === "safe-bet" && "本命狙い"}
              {volatility.recommendedModel === "upset-focus" && "穴狙い"}
            </span>
          </div>
          <div
            style={{
              marginTop: "0.35rem",
              paddingLeft: "1.6rem",
              fontSize: "0.85rem",
              color: "#475569",
            }}
          >
            {volatility.level === "high" &&
              "イン崩れ指数が高く1コースが崩れやすいため、高配当を狙える穴狙い型がおすすめです"}
            {volatility.level === "low" &&
              "1コースが安定しているため、的中率重視の本命狙い型がおすすめです"}
            {volatility.level === "medium" &&
              "標準的なレースのため、バランス型のスタンダードがおすすめです"}
          </div>
        </div>
      )}
    </div>
  );
}

export default VolatilityDisplay;
