export default function HolmesMoriartyHeader() {
  return (
    <div className="holmes-detective-header">
      <div className="holmes-detective-icon" style={{ background: "#1f2937" }}>
        🎩
      </div>
      <div className="holmes-detective-meta">
        <div className="holmes-detective-name">モリアーティ予想</div>
        <div className="holmes-detective-title">
          犯罪界のナポレオン - 数学的最適化の教授
        </div>
        <div className="holmes-detective-tech">
          技術: <code>Probability Calibration + Kelly Criterion</code>
        </div>
      </div>
      {/* 推奨停止中は .moriarty-status-badge（緑）を付けず、共通の .holmes-status-badge（アンバー）で出す */}
      <div className="holmes-status-badge">検証中（推奨停止）</div>
    </div>
  );
}
