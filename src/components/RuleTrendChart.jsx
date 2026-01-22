/**
 * RuleTrendChart - 回収率トップルールの週別推移グラフ
 *
 * 複数ルールを同一グラフ上で比較し、どのルールが安定して
 * 高パフォーマンスを維持しているかを可視化
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts'
import './RuleTrendChart.css'

const COLORS = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1'  // indigo-500
]

function RuleTrendChart({ weeklyData, rules, ruleDetails, currentWeek }) {
  if (!weeklyData || weeklyData.length === 0) {
    return (
      <div className="rule-trend-section">
        <h3>📈 回収率トップ10ルール 週別推移</h3>
        <div className="chart-empty">
          データ蓄積中（現在Week {currentWeek}）
        </div>
      </div>
    )
  }

  // ルールIDから会場名を取得するマップを作成
  const ruleVenueMap = {}
  if (ruleDetails) {
    ruleDetails.forEach(rule => {
      ruleVenueMap[rule.ruleId] = rule.venueName
    })
  }

  // ツールチップのカスタムフォーマット
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null

    return (
      <div className="rule-trend-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload
          .filter(entry => entry.value !== null)
          .sort((a, b) => b.value - a.value)
          .map((entry, idx) => (
            <p key={idx} className="tooltip-item" style={{ color: entry.color }}>
              <span className="tooltip-venue">{ruleVenueMap[entry.dataKey] || ''}</span>
              <span className="tooltip-rule">{entry.dataKey}</span>
              <span className="tooltip-value">{entry.value}%</span>
            </p>
          ))}
      </div>
    )
  }

  // 凡例のカスタムフォーマット（会場名を含める）
  const renderLegendText = (value) => {
    const venueName = ruleVenueMap[value] || ''
    return `${venueName} ${value}`
  }

  return (
    <div className="rule-trend-section">
      <h3>📈 回収率トップ10ルール 週別推移</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={weeklyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis
            domain={[0, 'auto']}
            label={{ value: '回収率 (%)', angle: -90, position: 'insideLeft' }}
            tickFormatter={(v) => `${v}%`}
          />
          <ReferenceLine
            y={100}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{ value: '100%', fill: '#f59e0b', fontSize: 11, position: 'right' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={renderLegendText}
          />
          {rules.map((ruleId, idx) => (
            <Line
              key={ruleId}
              type="monotone"
              dataKey={ruleId}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS[idx % COLORS.length] }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="chart-note">
        💡 100%を超えると黒字、下回ると赤字を意味します
      </div>
    </div>
  )
}

export default RuleTrendChart
