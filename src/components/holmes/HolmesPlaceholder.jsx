/**
 * HolmesPlaceholder - ホームズ予想の各タブ共通プレースホルダ
 * α版・モデル準備中の状態を統一的に表示
 */

function HolmesPlaceholder({
  characterIcon,
  characterName,
  characterTitle,
  modelTechnicalName,
  themeColor,
  conceptLines,
  mockPrediction,
  status,
}) {
  return (
    <div
      className="holmes-detective-card"
      style={{ borderTop: `4px solid ${themeColor}` }}
    >
      <div className="holmes-detective-header">
        <div
          className="holmes-detective-icon"
          style={{ background: themeColor }}
        >
          {characterIcon}
        </div>
        <div className="holmes-detective-meta">
          <div className="holmes-detective-name">{characterName}</div>
          <div className="holmes-detective-title">{characterTitle}</div>
          <div className="holmes-detective-tech">
            技術: <code>{modelTechnicalName}</code>
          </div>
        </div>
        <div className="holmes-status-badge">{status}</div>
      </div>

      <section className="holmes-section">
        <h3>🎯 推理スタイル</h3>
        <ul className="holmes-concept-list">
          {conceptLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="holmes-section">
        <h3>🔮 予想プレビュー（ダミー）</h3>
        <div className="holmes-mock-prediction">
          <div className="holmes-mock-row">
            <span className="holmes-mock-label">レース</span>
            <span className="holmes-mock-value">{mockPrediction.race}</span>
          </div>
          <div className="holmes-mock-row">
            <span className="holmes-mock-label">推奨買い目</span>
            <span className="holmes-mock-value holmes-mock-pick">
              {mockPrediction.pick}
            </span>
          </div>
          <div className="holmes-mock-row">
            <span className="holmes-mock-label">想定確率</span>
            <span className="holmes-mock-value">
              {mockPrediction.probability}
            </span>
          </div>
          <div className="holmes-mock-row">
            <span className="holmes-mock-label">推奨判断</span>
            <span className="holmes-mock-value">
              {mockPrediction.judgement}
            </span>
          </div>
        </div>
        <p className="holmes-mock-note">
          ※ 実モデル未接続のため、これは静的なサンプル表示です
        </p>
      </section>
    </div>
  );
}

export default HolmesPlaceholder;
