import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

function MoriartyROIChart({ data = [], showSampleWarning = false }) {
  if (!data || data.length === 0) {
    return (
      <div className="moriarty-chart-empty">
        <p>
          チャート表示にはデータが必要です。推奨レース結果が蓄積されると表示されます。
        </p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    return `${parts[1]}/${parts[2]}`;
  };

  const formatTooltipValue = (value, name) => {
    if (name === "cumulative_roi") return [`${value}%`, "累積回収率"];
    if (name === "daily_roi")
      return value !== null ? [`${value}%`, "当日回収率"] : [null, null];
    return [value, name];
  };

  return (
    <div className="moriarty-chart-wrapper">
      {showSampleWarning && (
        <p className="moriarty-chart-notice">
          ※ サンプル数が少ないため、数値は参考程度にご覧ください
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--color-gray-500)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--color-gray-500)" }}
            domain={["auto", "auto"]}
          />
          <Tooltip formatter={formatTooltipValue} labelFormatter={formatDate} />
          <ReferenceLine
            y={100}
            stroke="var(--color-gray-400)"
            strokeDasharray="4 4"
            label={{
              value: "100%",
              fill: "var(--color-gray-500)",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulative_roi"
            stroke="var(--color-primary-500)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MoriartyROIChart;
