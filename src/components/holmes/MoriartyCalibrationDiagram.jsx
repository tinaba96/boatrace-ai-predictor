import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

function MoriartyCalibrationDiagram({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="moriarty-chart-empty">
        <p>
          キャリブレーションデータはまだありません。結果が蓄積されると表示されます。
        </p>
      </div>
    );
  }

  const scatterData = data.map((d) => ({
    x: d.predicted_bucket * 100,
    y: d.actual_rate,
    size: d.sample_size,
  }));

  return (
    <div className="moriarty-chart-wrapper">
      <p className="moriarty-chart-notice">
        対角線に近いほど予測確率が実勝率と一致しています（理想的なキャリブレーション）
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--color-gray-500)" }}
            label={{
              value: "予測確率",
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
              fill: "var(--color-gray-500)",
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--color-gray-500)" }}
            label={{
              value: "実勝率",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "var(--color-gray-500)",
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "x") return [`${value}%`, "予測確率"];
              if (name === "y") return [`${value}%`, "実勝率"];
              return [value, name];
            }}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ]}
            stroke="var(--color-gray-400)"
            strokeDasharray="4 4"
          />
          <Scatter
            data={scatterData}
            fill="var(--color-primary-500)"
            opacity={0.8}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MoriartyCalibrationDiagram;
