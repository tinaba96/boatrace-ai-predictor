/**
 * RecoveryTrendChart - 回収率推移グラフコンポーネント
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function RecoveryTrendChart({ dailyHistory }) {
  if (!dailyHistory || dailyHistory.length === 0) return null

  // 直近7日分のデータを準備
  const chartData = dailyHistory.slice(-7).map(day => ({
    date: day.date.substring(5), // MM-DDのみ表示
    単勝: (day.actualRecovery?.win?.recoveryRate || 0) * 100,
    複勝: (day.actualRecovery?.place?.recoveryRate || 0) * 100,
    '3連複': (day.actualRecovery?.trifecta?.recoveryRate || 0) * 100,
    '3連単': (day.actualRecovery?.trio?.recoveryRate || 0) * 100,
  }))

  return (
    <div className="recovery-trend-section">
      <h3>📈 回収率推移（直近7日）</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: '回収率 (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
          <Legend />
          <Line type="monotone" dataKey="単勝" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="複勝" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="3連複" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="3連単" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="chart-note">
        💡 100%を超えると黒字、下回ると赤字を意味します
      </div>
    </div>
  )
}

export default RecoveryTrendChart
