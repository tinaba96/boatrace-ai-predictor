/**
 * ボートレース最適購入戦略導出スクリプト
 * 
 * このスクリプトは、過去のデータから数学的に最適な購入戦略を導出します。
 * 統計的に有意なパターンを発見し、条件別の最適な購入方法を提示します。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 会場名マッピング
const venueNames = {
  1: '桐生', 2: '戸田', 3: '江戸川', 4: '平和島', 5: '多摩川', 6: '浜名湖',
  7: '蒲郡', 8: '常滑', 9: '津', 10: '三国', 11: 'びわこ', 12: '住之江',
  13: '尼崎', 14: '鳴門', 15: '丸亀', 16: '児島', 17: '宮島', 18: '徳山',
  19: '下関', 20: '若松', 21: '芦屋', 22: '福岡', 23: '唐津', 24: '大村'
};

/**
 * 統計的有意性検証用の関数
 */
function calculateConfidenceInterval(successRate, sampleSize, confidence = 0.95) {
  const z = confidence === 0.95 ? 1.96 : 2.576; // 95% or 99%
  const se = Math.sqrt(successRate * (1 - successRate) / sampleSize);
  const margin = z * se;
  return {
    lower: Math.max(0, successRate - margin),
    upper: Math.min(1, successRate + margin),
    margin
  };
}

/**
 * カイ二乗検定（簡易版）
 */
function chiSquareTest(observed, expected) {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }
  }
  // 自由度は (行数-1) × (列数-1) だが、簡易版としてp値の近似値を返す
  // 実際の検定には統計ライブラリが必要
  return { chiSquare, significant: chiSquare > 3.84 }; // 3.84は自由度1、α=0.05の臨界値
}

/**
 * t検定（簡易版 - 回収率が100%を上回るかの検定）
 */
function tTestForRecovery(recoveryRate, sampleSize, nullHypothesis = 1.0) {
  // 簡易版：回収率の標準誤差を仮定
  const se = Math.sqrt(recoveryRate * (1 - recoveryRate) / sampleSize);
  const t = (recoveryRate - nullHypothesis) / se;
  // 自由度n-1のt分布の臨界値（簡易版として1.96を使用）
  return {
    t,
    significant: t > 1.96,
    pValue: t > 1.96 ? '< 0.05' : '>= 0.05'
  };
}

/**
 * ケリー基準の計算
 */
function calculateKellyCriterion(winRate, avgPayout) {
  // f = (p × b - q) / b
  // p: 的中確率, b: 的中時の配当倍率, q: 外れる確率
  const p = winRate;
  const b = avgPayout - 1; // 純利益倍率
  const q = 1 - p;
  
  if (p * b <= q) {
    return 0; // 期待値がマイナスの場合は投資しない
  }
  
  const f = (p * b - q) / b;
  return Math.max(0, Math.min(1, f)); // 0-1の範囲に制限
}

/**
 * データ読み込み
 */
async function loadData() {
  const predictionsDir = path.join(__dirname, '..', 'data', 'predictions');
  const files = await fs.readdir(predictionsDir);
  const predictionFiles = files
    .filter(f => f.endsWith('.json') && f !== 'summary.json')
    .sort();

  const allRaces = [];
  
  for (const file of predictionFiles) {
    try {
      const filePath = path.join(predictionsDir, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      
      for (const race of data.races) {
        if (race.result?.finished && race.prediction?.players) {
          allRaces.push({
            ...race,
            date: data.date
          });
        }
      }
    } catch (e) {
      console.warn(`Failed to load ${file}:`, e.message);
    }
  }

  return allRaces;
}

/**
 * 単一因子分析
 */
function analyzeSingleFactors(races) {
  console.log('\n=== 単一因子分析 ===\n');

  const results = {
    lane: {},
    grade: {},
    age: {},
    globalWinRate: {},
    motor2Rate: {},
    boat2Rate: {},
    localAdvantage: {}
  };

  // 各レースの選手データを収集
  const racerData = [];
  for (const race of races) {
    const players = race.prediction.players;
    const result = race.result;
    
    for (const player of players) {
      const lane = player.number;
      const isWinner = result.rank1 === lane;
      const isPlace = result.rank1 === lane || result.rank2 === lane;
      const isTop3 = [result.rank1, result.rank2, result.rank3].includes(lane);

      racerData.push({
        lane,
        grade: player.grade,
        age: parseInt(player.age) || 0,
        globalWinRate: parseFloat(player.winRate) || 0,
        localWinRate: parseFloat(player.localWinRate) || 0,
        motor2Rate: parseFloat(player.motor2Rate) || 0,
        boat2Rate: parseFloat(player.boat2Rate) || 0,
        localAdvantage: (parseFloat(player.localWinRate) || 0) - (parseFloat(player.winRate) || 0),
        isWinner,
        isPlace,
        isTop3
      });
    }
  }

  // 枠番別分析
  console.log('【枠番別の勝率・複勝率・3着内率】\n');
  for (let lane = 1; lane <= 6; lane++) {
    const laneData = racerData.filter(r => r.lane === lane);
    const total = laneData.length;
    const wins = laneData.filter(r => r.isWinner).length;
    const places = laneData.filter(r => r.isPlace).length;
    const top3s = laneData.filter(r => r.isTop3).length;

    const winRate = wins / total;
    const placeRate = places / total;
    const top3Rate = top3s / total;

    const winCI = calculateConfidenceInterval(winRate, total);
    const placeCI = calculateConfidenceInterval(placeRate, total);

    results.lane[lane] = {
      total,
      winRate,
      placeRate,
      top3Rate,
      winCI,
      placeCI
    };

    console.log(`${lane}号艇:`);
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(winCI.lower * 100).toFixed(2)}% - ${(winCI.upper * 100).toFixed(2)}%)`);
    console.log(`  複勝率: ${(placeRate * 100).toFixed(2)}% (95%信頼区間: ${(placeCI.lower * 100).toFixed(2)}% - ${(placeCI.upper * 100).toFixed(2)}%)`);
    console.log(`  3着内率: ${(top3Rate * 100).toFixed(2)}%`);
    console.log(`  サンプル数: ${total}\n`);
  }

  // 級別分析
  console.log('【級別の勝率】\n');
  const grades = ['A1', 'A2', 'B1', 'B2'];
  for (const grade of grades) {
    const gradeData = racerData.filter(r => r.grade === grade);
    if (gradeData.length === 0) continue;

    const total = gradeData.length;
    const wins = gradeData.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results.grade[grade] = { total, winRate, ci };

    console.log(`${grade}級:`);
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  // モーター2連率階層別分析
  console.log('【モーター2連率階層別の勝率】\n');
  const motorBrackets = [
    { min: 0, max: 30, label: '0-30%' },
    { min: 30, max: 35, label: '30-35%' },
    { min: 35, max: 40, label: '35-40%' },
    { min: 40, max: 45, label: '40-45%' },
    { min: 45, max: 100, label: '45%以上' }
  ];

  for (const bracket of motorBrackets) {
    const filtered = racerData.filter(r =>
      r.motor2Rate >= bracket.min && r.motor2Rate < bracket.max
    );
    if (filtered.length === 0) continue;

    const total = filtered.length;
    const wins = filtered.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results.motor2Rate[bracket.label] = { total, winRate, ci };

    console.log(`モーター${bracket.label}:`);
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  return { results, racerData };
}

/**
 * 複合因子分析
 */
function analyzeCompositeFactors(racerData) {
  console.log('\n=== 複合因子分析 ===\n');

  const results = {};

  // A1級 × 1号艇
  const a1Lane1 = racerData.filter(r => r.grade === 'A1' && r.lane === 1);
  if (a1Lane1.length > 0) {
    const total = a1Lane1.length;
    const wins = a1Lane1.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results['A1級×1号艇'] = { total, winRate, ci };

    console.log('A1級 × 1号艇:');
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  // 好モーター × 1号艇
  const goodMotorLane1 = racerData.filter(r => r.motor2Rate >= 40 && r.lane === 1);
  if (goodMotorLane1.length > 0) {
    const total = goodMotorLane1.length;
    const wins = goodMotorLane1.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results['好モーター(40%+)×1号艇'] = { total, winRate, ci };

    console.log('好モーター(40%+) × 1号艇:');
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  // A1級 × 好モーター
  const a1GoodMotor = racerData.filter(r => r.grade === 'A1' && r.motor2Rate >= 40);
  if (a1GoodMotor.length > 0) {
    const total = a1GoodMotor.length;
    const wins = a1GoodMotor.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results['A1級×好モーター'] = { total, winRate, ci };

    console.log('A1級 × 好モーター(40%+):');
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  // 外枠 × 超好モーター
  const outsideGoodMotor = racerData.filter(r => r.lane >= 4 && r.motor2Rate >= 45);
  if (outsideGoodMotor.length > 0) {
    const total = outsideGoodMotor.length;
    const wins = outsideGoodMotor.filter(r => r.isWinner).length;
    const winRate = wins / total;
    const ci = calculateConfidenceInterval(winRate, total);

    results['外枠(4-6)×超好モーター(45%+)'] = { total, winRate, ci };

    console.log('外枠(4-6号艇) × 超好モーター(45%+):');
    console.log(`  勝率: ${(winRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
    console.log(`  サンプル数: ${total}\n`);
  }

  return results;
}

/**
 * 条件別回収率分析
 */
function analyzeRecoveryByConditions(races) {
  console.log('\n=== 条件別回収率分析 ===\n');

  const conditions = {
    byVenue: {},
    byGradeComposition: {},
    byMotorDistribution: {},
    byLocalAdvantage: {}
  };

  // 会場別分析
  console.log('【会場別回収率（3連単）】\n');
  for (let venueCode = 1; venueCode <= 24; venueCode++) {
    const venueRaces = races.filter(r => r.venueCode === venueCode);
    if (venueRaces.length < 10) continue; // サンプル数が少ない会場はスキップ

    let totalInvestment = 0;
    let totalPayout = 0;
    let hitCount = 0;

    for (const race of venueRaces) {
      totalInvestment += 100;
      const prediction = race.prediction;
      const result = race.result;
      const payouts = result.payouts;

      // 3連単の的中判定
      const predictedOrder = prediction.top3.join('-');
      const resultOrder = `${result.rank1}-${result.rank2}-${result.rank3}`;

      if (predictedOrder === resultOrder) {
        const payout = payouts.trio[resultOrder];
        if (payout) {
          totalPayout += payout;
          hitCount++;
        }
      }
    }

    const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;
    const hitRate = venueRaces.length > 0 ? hitCount / venueRaces.length : 0;
    const avgPayout = hitCount > 0 ? totalPayout / hitCount / 100 : 0;

    const ci = calculateConfidenceInterval(hitRate, venueRaces.length);
    const recoveryCI = {
      lower: ci.lower * avgPayout,
      upper: ci.upper * avgPayout
    };

    conditions.byVenue[venueCode] = {
      venueName: venueNames[venueCode],
      totalRaces: venueRaces.length,
      recoveryRate,
      hitRate,
      avgPayout,
      ci,
      recoveryCI
    };

    if (venueRaces.length >= 20) { // 十分なサンプル数の会場のみ表示
      console.log(`${venueNames[venueCode]}:`);
      console.log(`  回収率: ${(recoveryRate * 100).toFixed(2)}%`);
      console.log(`  的中率: ${(hitRate * 100).toFixed(2)}% (95%信頼区間: ${(ci.lower * 100).toFixed(2)}% - ${(ci.upper * 100).toFixed(2)}%)`);
      console.log(`  的中時平均配当: ${avgPayout.toFixed(2)}倍`);
      console.log(`  サンプル数: ${venueRaces.length}レース\n`);
    }
  }

  return conditions;
}

/**
 * 最適購入戦略の導出
 */
function deriveOptimalStrategies(races, singleFactorResults, compositeResults, recoveryConditions) {
  console.log('\n=== 最適購入戦略の導出 ===\n');

  const strategies = [];

  // 戦略1: 1号艇単勝（統計的に最も安定）
  const lane1Data = singleFactorResults.lane[1];
  if (lane1Data && lane1Data.total >= 100) {
    // 1号艇単勝の回収率を計算
    let totalInvestment = 0;
    let totalPayout = 0;
    let hitCount = 0;

    for (const race of races) {
      if (race.prediction.topPick === 1) {
        totalInvestment += 100;
        if (race.result.rank1 === 1) {
          const payout = race.result.payouts.win['1'];
          if (payout) {
            totalPayout += payout;
            hitCount++;
          }
        }
      }
    }

    const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;
    const hitRate = totalInvestment > 0 ? hitCount / (totalInvestment / 100) : 0;
    const avgPayout = hitCount > 0 ? totalPayout / hitCount / 100 : 0;

    if (totalInvestment >= 10000) { // 十分なサンプル数
      const kelly = calculateKellyCriterion(hitRate, avgPayout);
      const ci = calculateConfidenceInterval(hitRate, totalInvestment / 100);

      strategies.push({
        name: '1号艇単勝戦略',
        conditions: {
          lane: 1,
          description: '1号艇を本命予想した場合の単勝購入'
        },
        betType: '単勝',
        recoveryRate,
        hitRate,
        avgPayout,
        kelly,
        ci,
        sampleSize: totalInvestment / 100,
        recommendation: recoveryRate > 1.0 && ci.lower * avgPayout > 1.0 ? '推奨' : '要検討'
      });
    }
  }

  // 戦略2: 好モーター×1号艇の3連単
  const goodMotorLane1Data = compositeResults['好モーター(40%+)×1号艇'];
  if (goodMotorLane1Data && goodMotorLane1Data.total >= 50) {
    // この条件での3連単回収率を計算
    let totalInvestment = 0;
    let totalPayout = 0;
    let hitCount = 0;

    for (const race of races) {
      const players = race.prediction.players;
      const topPick = race.prediction.topPick;
      const topPickPlayer = players.find(p => p.number === topPick);

      if (topPickPlayer && topPick === 1 && parseFloat(topPickPlayer.motor2Rate) >= 40) {
        totalInvestment += 100;
        const predictedOrder = race.prediction.top3.join('-');
        const resultOrder = `${race.result.rank1}-${race.result.rank2}-${race.result.rank3}`;

        if (predictedOrder === resultOrder) {
          const payout = race.result.payouts.trio[resultOrder];
          if (payout) {
            totalPayout += payout;
            hitCount++;
          }
        }
      }
    }

    const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;
    const hitRate = totalInvestment > 0 ? hitCount / (totalInvestment / 100) : 0;
    const avgPayout = hitCount > 0 ? totalPayout / hitCount / 100 : 0;

    if (totalInvestment >= 5000) {
      const kelly = calculateKellyCriterion(hitRate, avgPayout);
      const ci = calculateConfidenceInterval(hitRate, totalInvestment / 100);

      strategies.push({
        name: '好モーター×1号艇3連単戦略',
        conditions: {
          lane: 1,
          motor2Rate: '40%以上',
          description: '1号艇かつモーター2連率40%以上を本命予想した場合の3連単購入'
        },
        betType: '3連単',
        recoveryRate,
        hitRate,
        avgPayout,
        kelly,
        ci,
        sampleSize: totalInvestment / 100,
        recommendation: recoveryRate > 1.0 && ci.lower * avgPayout > 1.0 ? '推奨' : '要検討'
      });
    }
  }

  // 戦略を回収率順にソート
  strategies.sort((a, b) => b.recoveryRate - a.recoveryRate);

  // 結果を表示
  console.log('【導出された最適購入戦略】\n');
  for (let i = 0; i < strategies.length; i++) {
    const s = strategies[i];
    console.log(`戦略${i + 1}: ${s.name}`);
    console.log(`  適用条件: ${s.conditions.description}`);
    console.log(`  購入種別: ${s.betType}`);
    console.log(`  期待回収率: ${(s.recoveryRate * 100).toFixed(2)}%`);
    console.log(`  的中率: ${(s.hitRate * 100).toFixed(2)}% (95%信頼区間: ${(s.ci.lower * 100).toFixed(2)}% - ${(s.ci.upper * 100).toFixed(2)}%)`);
    console.log(`  的中時平均配当: ${s.avgPayout.toFixed(2)}倍`);
    console.log(`  ケリー基準: ${(s.kelly * 100).toFixed(2)}%`);
    console.log(`  サンプル数: ${s.sampleSize}レース`);
    console.log(`  推奨度: ${s.recommendation}`);
    console.log('');
  }

  return strategies;
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('=== ボートレース最適購入戦略導出分析 ===\n');
  console.log('データを読み込んでいます...\n');

  const races = await loadData();
  console.log(`読み込み完了: ${races.length}レース\n`);

  // 1. 単一因子分析
  const { results: singleFactorResults, racerData } = analyzeSingleFactors(races);

  // 2. 複合因子分析
  const compositeResults = analyzeCompositeFactors(racerData);

  // 3. 条件別回収率分析
  const recoveryConditions = analyzeRecoveryByConditions(races);

  // 4. 最適購入戦略の導出
  const strategies = deriveOptimalStrategies(races, singleFactorResults, compositeResults, recoveryConditions);

  // 5. 結果をJSONファイルに保存
  const output = {
    generatedAt: new Date().toISOString(),
    totalRaces: races.length,
    singleFactorAnalysis: singleFactorResults,
    compositeFactorAnalysis: compositeResults,
    recoveryByConditions: recoveryConditions,
    optimalStrategies: strategies
  };

  const outputPath = path.join(__dirname, '..', 'data', 'optimal-betting-strategy.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n分析結果を保存しました: ${outputPath}\n`);

  // エグゼクティブサマリー
  console.log('=== エグゼクティブサマリー ===\n');
  console.log(`分析対象レース数: ${races.length}レース\n`);
  
  if (strategies.length > 0) {
    console.log('【最も効果的な購入戦略トップ3】\n');
    strategies.slice(0, 3).forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.name}`);
      console.log(`   期待回収率: ${(s.recoveryRate * 100).toFixed(2)}%`);
      console.log(`   的中率: ${(s.hitRate * 100).toFixed(2)}%`);
      console.log(`   推奨度: ${s.recommendation}\n`);
    });
  }

  console.log('分析完了！');
}

// 実行
main().catch(console.error);

