/**
 * ReliabilityWarning - 統計の信頼性警告コンポーネント
 */

function ReliabilityWarning({ races }) {
  if (races >= 100) return null

  return (
    <div className="reliability-warning">
      <span className="warning-icon">⚠️</span>
      <div className="warning-content">
        <strong>統計の信頼性について</strong>
        <p>
          現在のレース数は{races}レースです。
          統計的に信頼性のある結果を得るには、最低100レース以上のデータが推奨されます。
        </p>
      </div>
    </div>
  )
}

export default ReliabilityWarning
