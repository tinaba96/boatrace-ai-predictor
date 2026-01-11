/**
 * 配当・回収率ユーティリティ
 * 配当計算と回収率計算を一元管理
 */

/**
 * 回収率を計算
 * @param {number} totalPredictions - 総予想数
 * @param {number} totalPayout - 総配当金額
 * @param {number} betAmount - 1レースあたりの賭け金（デフォルト100円）
 * @returns {number} 回収率（1.0 = 100%）
 */
export function calculateRecoveryRate(totalPredictions, totalPayout, betAmount = 100) {
  const totalInvestment = totalPredictions * betAmount;
  return totalInvestment > 0 ? totalPayout / totalInvestment : 0;
}

/**
 * 3連複用のキーを生成（ソート済み、順不同）
 * @param {number} rank1 - 1着
 * @param {number} rank2 - 2着
 * @param {number} rank3 - 3着
 * @returns {string} "1-2-3" 形式
 */
export function getTrifectaKey(rank1, rank2, rank3) {
  return [rank1, rank2, rank3].sort((a, b) => a - b).join('-');
}

/**
 * 3連単用のキーを生成（順序維持）
 * @param {number} rank1 - 1着
 * @param {number} rank2 - 2着
 * @param {number} rank3 - 3着
 * @returns {string} "1-2-3" 形式
 */
export function getTrioKey(rank1, rank2, rank3) {
  return `${rank1}-${rank2}-${rank3}`;
}

/**
 * 的中率を計算
 * @param {number} hits - 的中数
 * @param {number} total - 総数
 * @returns {number} 的中率（0.0-1.0）
 */
export function calculateHitRate(hits, total) {
  return total > 0 ? hits / total : 0;
}

/**
 * 配当を円単位からパーセント回収率に変換
 * @param {number} payout - 配当金額
 * @param {number} races - レース数
 * @param {number} betAmount - 1レースあたりの賭け金（デフォルト100円）
 * @returns {number} 回収率（1.0 = 100%）
 */
export function payoutToRecoveryRate(payout, races, betAmount = 100) {
  const totalInvestment = races * betAmount;
  return totalInvestment > 0 ? payout / totalInvestment : 0;
}

/**
 * 統計を計算する汎用関数
 * @param {Array} predictions - 予測データの配列
 * @returns {Object} 統計オブジェクト
 */
export function calculateStats(predictions) {
  if (!predictions || predictions.length === 0) {
    return {
      totalRaces: 0,
      winHits: 0,
      placeHits: 0,
      trifectaHits: 0,
      trioHits: 0,
      winHitRate: 0,
      placeHitRate: 0,
      trifectaHitRate: 0,
      trioHitRate: 0,
      winRecoveryRate: 0,
      placeRecoveryRate: 0,
      trifectaRecoveryRate: 0,
      trioRecoveryRate: 0
    };
  }

  const total = predictions.length;
  const winHits = predictions.filter(p => p.is_hit_win).length;
  const placeHits = predictions.filter(p => p.is_hit_place).length;
  const trifectaHits = predictions.filter(p => p.is_hit_trifecta).length;
  const trioHits = predictions.filter(p => p.is_hit_trio).length;

  const winPayout = predictions.reduce((sum, p) => sum + (p.payout_win || 0), 0);
  const placePayout = predictions.reduce((sum, p) => sum + (p.payout_place || 0), 0);
  const trifectaPayout = predictions.reduce((sum, p) => sum + (p.payout_trifecta || 0), 0);
  const trioPayout = predictions.reduce((sum, p) => sum + (p.payout_trio || 0), 0);

  return {
    totalRaces: total,
    winHits,
    placeHits,
    trifectaHits,
    trioHits,
    winHitRate: calculateHitRate(winHits, total),
    placeHitRate: calculateHitRate(placeHits, total),
    trifectaHitRate: calculateHitRate(trifectaHits, total),
    trioHitRate: calculateHitRate(trioHits, total),
    winRecoveryRate: payoutToRecoveryRate(winPayout, total),
    placeRecoveryRate: payoutToRecoveryRate(placePayout, total),
    trifectaRecoveryRate: payoutToRecoveryRate(trifectaPayout, total),
    trioRecoveryRate: payoutToRecoveryRate(trioPayout, total)
  };
}
