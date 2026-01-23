/**
 * HitRaceCard - 正解レースカードコンポーネント
 */
import { SocialShareButtons } from '../SocialShareButtons'
import { generateHitRaceShareText } from '../../utils/share'

function HitRaceCard({ hitRace, selectedModel, variant = 'today', showDate = false, onClick }) {
  const cardClassName = `race-card ${variant}${onClick ? ' clickable' : ''}`

  const handleClick = () => {
    if (onClick) onClick(hitRace)
  }

  const handleMouseEnter = (e) => {
    if (onClick) e.currentTarget.style.transform = 'translateY(-2px)'
  }

  const handleMouseLeave = (e) => {
    if (onClick) e.currentTarget.style.transform = 'translateY(0)'
  }

  return (
    <div
      className={cardClassName}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="race-card-header">
        <div>
          <div className="race-card-venue">
            {hitRace.venue}
          </div>
          <div className="race-card-number">
            {hitRace.raceNumber}R
          </div>
        </div>
        <div className={`hit-badge ${variant}`}>
          正解
        </div>
      </div>

      {showDate && (
        <div className="race-card-date" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
          {hitRace.date}
        </div>
      )}

      <div className="hit-types-list">
        {hitRace.hitTypes.map((hit, idx) => (
          <div key={idx} className="hit-type-item">
            <span className="hit-type-label">✅ {hit.type}</span>
            <span className="hit-type-payout">{hit.payout.toLocaleString()}円</span>
          </div>
        ))}
      </div>

      <div className="total-payout-section">
        <span className="total-payout-label">合計配当</span>
        <span className="total-payout-value">
          {hitRace.totalPayout.toLocaleString()}円
        </span>
      </div>

      {/* SNSシェアボタン */}
      <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <SocialShareButtons
          shareUrl="https://www.boat-ai.jp/"
          title={generateHitRaceShareText({
            venue: hitRace.venue,
            raceNo: hitRace.raceNumber,
            date: hitRace.date,
            prediction: {
              top3: hitRace.prediction?.top3 || []
            },
            result: [
              hitRace.result?.rank1,
              hitRace.result?.rank2,
              hitRace.result?.rank3
            ].filter(Boolean),
            totalPayout: hitRace.totalPayout,
            hitTypes: hitRace.hitTypes || []
          }, selectedModel)}
          hashtags={['ボートレース', '正解', 'BoatAI']}
          size={36}
        />
      </div>
    </div>
  )
}

export default HitRaceCard
