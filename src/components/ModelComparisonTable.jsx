import './ModelComparisonTable.css'

// 回収率の色を取得
const getRecoveryColor = (rate) => {
  if (rate >= 1.0) return '#10b981'
  if (rate >= 0.9) return '#f59e0b'
  return '#ef4444'
}

// パーセント表示
const formatPercent = (rate) => (rate * 100).toFixed(1) + '%'

/**
 * モデル比較表コンポーネント
 * @param {Array} data - モデル比較データの配列
 * @param {boolean} showRaceCount - レース数列を表示するか
 * @param {string} title - タイトル（nullで非表示）
 * @param {boolean} compact - コンパクト表示（RaceHistory用）
 */
export default function ModelComparisonTable({
  data,
  showRaceCount = false,
  title = null,
  compact = false
}) {
  if (!data || data.length === 0) return null

  const wrapperClass = compact ? 'mct-wrapper mct-compact' : 'mct-wrapper'
  const tableClass = compact ? 'mct-table mct-table-compact' : 'mct-table'

  return (
    <div className={wrapperClass}>
      {title && <h3 className="mct-title">{title}</h3>}
      <div className="mct-scroll-container">
        <table className={tableClass}>
          <thead>
            <tr>
              <th>モデル</th>
              {showRaceCount && <th>レース数</th>}
              <th colSpan="2">単勝</th>
              <th colSpan="2">複勝</th>
              <th colSpan="2">3連複</th>
              <th colSpan="2">3連単</th>
            </tr>
            <tr className="mct-sub-header">
              <th></th>
              {showRaceCount && <th></th>}
              <th>的中</th>
              <th>回収</th>
              <th>的中</th>
              <th>回収</th>
              <th>的中</th>
              <th>回収</th>
              <th>的中</th>
              <th>回収</th>
            </tr>
          </thead>
          <tbody>
            {data.map(model => (
              <tr key={model.key}>
                <td className="mct-model-name">{model.name}</td>
                {showRaceCount && (
                  <td className="mct-races">{model.races > 0 ? `${model.races}` : '-'}</td>
                )}
                <td className="mct-hit">{model.races > 0 ? formatPercent(model.winHitRate) : '-'}</td>
                <td className="mct-recovery" style={{ color: model.races > 0 ? getRecoveryColor(model.winRecoveryRate) : '#64748b' }}>
                  {model.races > 0 ? formatPercent(model.winRecoveryRate) : '-'}
                </td>
                <td className="mct-hit">{model.races > 0 ? formatPercent(model.placeHitRate) : '-'}</td>
                <td className="mct-recovery" style={{ color: model.races > 0 ? getRecoveryColor(model.placeRecoveryRate) : '#64748b' }}>
                  {model.races > 0 ? formatPercent(model.placeRecoveryRate) : '-'}
                </td>
                <td className="mct-hit">{model.races > 0 ? formatPercent(model.trifectaHitRate) : '-'}</td>
                <td className="mct-recovery" style={{ color: model.races > 0 ? getRecoveryColor(model.trifectaRecoveryRate) : '#64748b' }}>
                  {model.races > 0 ? formatPercent(model.trifectaRecoveryRate) : '-'}
                </td>
                <td className="mct-hit">{model.races > 0 ? formatPercent(model.trioHitRate) : '-'}</td>
                <td className="mct-recovery" style={{ color: model.races > 0 ? getRecoveryColor(model.trioRecoveryRate) : '#64748b' }}>
                  {model.races > 0 ? formatPercent(model.trioRecoveryRate) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
