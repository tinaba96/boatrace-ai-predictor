/**
 * 回収率100%超を目指す新モデル設計スクリプト
 * 
 * 大穴依存ではなく、数学的根拠に基づいた安定した回収率100%超のモデルを設計します。
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
        if (race.result?.finished && race.result?.payouts) {
          allRaces.push({
            ...race,
            date: data.date
          });
        }
      }
    } catch (e) {
      // スキップ
    }
  }

  return allRaces;
}

/**
 * 回収率を計算（外れ値除外版）
 */
function calculateRecoveryRobust(races, getPredictionFn, betType, conditionFn = null) {
  let totalInvestment = 0;
  let totalPayout = 0;
  let hitCount = 0;
  const payouts = [];

  for (const race of races) {
    if (conditionFn && !conditionFn(race)) continue;

    const prediction = getPredictionFn(race);
    if (!prediction) continue;

    totalInvestment += 100;
    const result = race.result;
    const payoutsData = result.payouts;

    let hit = false;
    let payout = 0;

    if (betType === 'win') {
      if (prediction.topPick === result.rank1) {
        payout = payoutsData.win[String(result.rank1)];
        if (payout) {
          hit = true;
        }
      }
    } else if (betType === 'place') {
      const topPick = prediction.topPick;
      if (topPick === result.rank1 || topPick === result.rank2) {
        payout = payoutsData.place[String(topPick)];
        if (payout) {
          hit = true;
        }
      }
    } else if (betType === 'trifecta') {
      const sortedTop3 = [...prediction.top3].sort((a, b) => a - b);
      const sortedResult = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b);

      if (JSON.stringify(sortedTop3) === JSON.stringify(sortedResult)) {
        const payoutKeys = Object.keys(payoutsData.trifecta);
        for (const key of payoutKeys) {
          const numbers = key.split(/[-=]/).map(Number).sort((a, b) => a - b);
          if (JSON.stringify(numbers) === JSON.stringify(sortedResult)) {
            payout = payoutsData.trifecta[key];
            if (payout) {
              hit = true;
              break;
            }
          }
        }
      }
    } else if (betType === 'trio') {
      const predictedOrder = prediction.top3.join('-');
      const resultOrder = `${result.rank1}-${result.rank2}-${result.rank3}`;

      if (predictedOrder === resultOrder) {
        payout = payoutsData.trio[resultOrder];
        if (payout) {
          hit = true;
        }
      }
    }

    if (hit && payout) {
      totalPayout += payout;
      hitCount++;
      payouts.push(payout / 100);
    }
  }

  // 外れ値を除外した統計
  payouts.sort((a, b) => a - b);
  const medianPayout = payouts.length > 0 ? payouts[Math.floor(payouts.length / 2)] : 0;
  const q25Payout = payouts.length > 0 ? payouts[Math.floor(payouts.length * 0.25)] : 0;
  const q75Payout = payouts.length > 0 ? payouts[Math.floor(payouts.length * 0.75)] : 0;
  
  // IQR法で外れ値を除外
  const iqr = q75Payout - q25Payout;
  const lowerBound = q25Payout - 1.5 * iqr;
  const upperBound = q75Payout + 1.5 * iqr;
  
  const payoutsWithoutOutliers = payouts.filter(p => p >= lowerBound && p <= upperBound);
  const totalPayoutWithoutOutliers = payoutsWithoutOutliers.reduce((sum, p) => sum + p * 100, 0);
  const hitCountWithoutOutliers = payoutsWithoutOutliers.length;
  const recoveryRateWithoutOutliers = totalInvestment > 0 
    ? totalPayoutWithoutOutliers / (hitCountWithoutOutliers > 0 ? totalInvestment : totalInvestment)
    : 0;

  const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;
  const hitRate = totalInvestment > 0 ? hitCount / (totalInvestment / 100) : 0;
  const avgPayout = hitCount > 0 ? payouts.reduce((a, b) => a + b, 0) / hitCount : 0;
  const medianPayoutValue = medianPayout;

  return {
    totalInvestment,
    totalPayout,
    hitCount,
    recoveryRate,
    hitRate,
    avgPayout,
    medianPayout: medianPayoutValue,
    recoveryRateWithoutOutliers,
    sampleSize: totalInvestment / 100,
    payouts
  };
}

/**
 * 既存モデルの分析
 */
function analyzeExistingModels(races) {
  console.log('=== 既存モデルの分析 ===\n');

  const models = ['standard', 'safeBet', 'upsetFocus'];
  const betTypes = ['win', 'place', 'trifecta', 'trio'];
  const results = {};

  for (const modelKey of models) {
    results[modelKey] = {};
    
    for (const betType of betTypes) {
      const getPredictionFn = (race) => {
        if (race.predictions && race.predictions[modelKey]) {
          return race.predictions[modelKey];
        }
        // 旧形式のデータに対応
        if (modelKey === 'standard' && race.prediction) {
          return race.prediction;
        }
        return null;
      };

      const result = calculateRecoveryRobust(races, getPredictionFn, betType);
      
      if (result.sampleSize >= 50) {
        results[modelKey][betType] = result;
      }
    }
  }

  // 結果を表示
  for (const modelKey of models) {
    console.log(`【${modelKey}モデル】\n`);
    for (const betType of betTypes) {
      if (results[modelKey][betType]) {
        const r = results[modelKey][betType];
        console.log(`${betType}:`);
        console.log(`  回収率: ${(r.recoveryRate * 100).toFixed(2)}%`);
        console.log(`  外れ値除外後: ${(r.recoveryRateWithoutOutliers * 100).toFixed(2)}%`);
        console.log(`  的中率: ${(r.hitRate * 100).toFixed(2)}%`);
        console.log(`  中央値配当: ${r.medianPayout.toFixed(2)}倍`);
        console.log(`  サンプル数: ${r.sampleSize}レース\n`);
      }
    }
  }

  return results;
}

/**
 * 条件別最適モデル選択の分析
 */
function analyzeOptimalModelSelection(races) {
  console.log('\n=== 条件別最適モデル選択の分析 ===\n');

  const conditions = [
    {
      name: '全条件',
      fn: () => true
    },
    {
      name: '1号艇がA1級',
      fn: (race) => {
        const players = race.prediction?.players || 
                       (race.predictions?.standard?.players) ||
                       (race.predictions?.safeBet?.players) ||
                       (race.predictions?.upsetFocus?.players);
        if (!players) return false;
        const lane1Player = players.find(p => p.number === 1);
        return lane1Player && lane1Player.grade === 'A1';
      }
    },
    {
      name: 'A1級2名以上',
      fn: (race) => {
        const players = race.prediction?.players || 
                       (race.predictions?.standard?.players) ||
                       (race.predictions?.safeBet?.players) ||
                       (race.predictions?.upsetFocus?.players);
        if (!players) return false;
        return players.filter(p => p.grade === 'A1').length >= 2;
      }
    },
    {
      name: '1号艇のモーター2連率40%以上',
      fn: (race) => {
        const players = race.prediction?.players || 
                       (race.predictions?.standard?.players) ||
                       (race.predictions?.safeBet?.players) ||
                       (race.predictions?.upsetFocus?.players);
        if (!players) return false;
        const lane1Player = players.find(p => p.number === 1);
        return lane1Player && parseFloat(lane1Player.motor2Rate) >= 40;
      }
    }
  ];

  const models = ['standard', 'safeBet', 'upsetFocus'];
  const betTypes = ['place', 'trifecta'];

  const optimalStrategies = [];

  for (const condition of conditions) {
    console.log(`【条件: ${condition.name}】\n`);
    
    for (const betType of betTypes) {
      let bestModel = null;
      let bestRecovery = 0;
      let bestResult = null;

      for (const modelKey of models) {
        const getPredictionFn = (race) => {
          if (race.predictions && race.predictions[modelKey]) {
            return race.predictions[modelKey];
          }
          if (modelKey === 'standard' && race.prediction) {
            return race.prediction;
          }
          return null;
        };

        const result = calculateRecoveryRobust(races, getPredictionFn, betType, condition.fn);
        
        // 外れ値除外後の回収率で評価
        if (result.sampleSize >= 50 && result.recoveryRateWithoutOutliers > bestRecovery) {
          bestRecovery = result.recoveryRateWithoutOutliers;
          bestModel = modelKey;
          bestResult = result;
        }
      }

      if (bestResult && bestRecovery > 1.0) {
        console.log(`${betType} - 最適モデル: ${bestModel}`);
        console.log(`  回収率（外れ値除外後）: ${(bestRecovery * 100).toFixed(2)}%`);
        console.log(`  的中率: ${(bestResult.hitRate * 100).toFixed(2)}%`);
        console.log(`  中央値配当: ${bestResult.medianPayout.toFixed(2)}倍`);
        console.log(`  サンプル数: ${bestResult.sampleSize}レース\n`);

        optimalStrategies.push({
          condition: condition.name,
          betType,
          model: bestModel,
          recoveryRate: bestResult.recoveryRate,
          recoveryRateWithoutOutliers: bestRecovery,
          hitRate: bestResult.hitRate,
          medianPayout: bestResult.medianPayout,
          sampleSize: bestResult.sampleSize
        });
      }
    }
  }

  return optimalStrategies;
}

/**
 * 会場別最適戦略の分析
 */
function analyzeVenueOptimalStrategies(races) {
  console.log('\n=== 会場別最適戦略の分析 ===\n');

  const models = ['standard', 'safeBet', 'upsetFocus'];
  const betTypes = ['place', 'trifecta'];
  const venueStrategies = [];

  for (let venueCode = 1; venueCode <= 24; venueCode++) {
    const conditionFn = (race) => race.venueCode === venueCode;
    
    let bestStrategy = null;
    let bestRecovery = 0;

    for (const modelKey of models) {
      for (const betType of betTypes) {
        const getPredictionFn = (race) => {
          if (race.predictions && race.predictions[modelKey]) {
            return race.predictions[modelKey];
          }
          if (modelKey === 'standard' && race.prediction) {
            return race.prediction;
          }
          return null;
        };

        const result = calculateRecoveryRobust(races, getPredictionFn, betType, conditionFn);
        
        if (result.sampleSize >= 50 && result.recoveryRateWithoutOutliers > bestRecovery) {
          bestRecovery = result.recoveryRateWithoutOutliers;
          bestStrategy = {
            venueCode,
            venueName: venueNames[venueCode],
            model: modelKey,
            betType,
            ...result
          };
        }
      }
    }

    if (bestStrategy && bestRecovery > 1.0) {
      venueStrategies.push(bestStrategy);
      console.log(`${venueNames[venueCode]}:`);
      console.log(`  最適モデル: ${bestStrategy.model} - ${bestStrategy.betType}`);
      console.log(`  回収率（外れ値除外後）: ${(bestRecovery * 100).toFixed(2)}%`);
      console.log(`  的中率: ${(bestStrategy.hitRate * 100).toFixed(2)}%`);
      console.log(`  サンプル数: ${bestStrategy.sampleSize}レース\n`);
    }
  }

  return venueStrategies;
}

/**
 * 新モデル設計: 条件別最適モデル選択
 */
function designNewModel(races, existingModelResults, optimalStrategies, venueStrategies) {
  console.log('\n=== 新モデル設計: 条件別最適モデル選択 ===\n');

  // 信頼区間の計算
  function calculateConfidenceInterval(hitRate, sampleSize, confidence = 0.95) {
    const z = confidence === 0.95 ? 1.96 : 2.576;
    const se = Math.sqrt(hitRate * (1 - hitRate) / sampleSize);
    const margin = z * se;
    return {
      lower: Math.max(0, hitRate - margin),
      upper: Math.min(1, hitRate + margin),
      margin
    };
  }

  const newModelRules = [];

  // ルール1: 会場別最適戦略
  for (const venueStrategy of venueStrategies) {
    if (venueStrategy.recoveryRateWithoutOutliers > 1.0 && venueStrategy.sampleSize >= 100) {
      const ci = calculateConfidenceInterval(venueStrategy.hitRate, venueStrategy.sampleSize);
      const expectedRecoveryLower = ci.lower * venueStrategy.medianPayout;
      
      if (expectedRecoveryLower > 1.0) {
        newModelRules.push({
          type: 'venue',
          condition: `会場: ${venueStrategy.venueName}`,
          model: venueStrategy.model,
          betType: venueStrategy.betType,
          recoveryRate: venueStrategy.recoveryRateWithoutOutliers,
          hitRate: venueStrategy.hitRate,
          medianPayout: venueStrategy.medianPayout,
          ci,
          expectedRecoveryLower,
          sampleSize: venueStrategy.sampleSize,
          confidence: 'high'
        });
      }
    }
  }

  // ルール2: 条件別最適戦略
  for (const strategy of optimalStrategies) {
    if (strategy.recoveryRateWithoutOutliers > 1.0 && strategy.sampleSize >= 100) {
      const ci = calculateConfidenceInterval(strategy.hitRate, strategy.sampleSize);
      const expectedRecoveryLower = ci.lower * strategy.medianPayout;
      
      if (expectedRecoveryLower > 1.0) {
        newModelRules.push({
          type: 'condition',
          condition: strategy.condition,
          model: strategy.model,
          betType: strategy.betType,
          recoveryRate: strategy.recoveryRateWithoutOutliers,
          hitRate: strategy.hitRate,
          medianPayout: strategy.medianPayout,
          ci,
          expectedRecoveryLower,
          sampleSize: strategy.sampleSize,
          confidence: 'high'
        });
      }
    }
  }

  // ルールを回収率順にソート
  newModelRules.sort((a, b) => b.recoveryRate - a.recoveryRate);

  console.log('【新モデルのルール】\n');
  for (let i = 0; i < newModelRules.length; i++) {
    const rule = newModelRules[i];
    console.log(`ルール${i + 1}: ${rule.condition}`);
    console.log(`  適用モデル: ${rule.model} - ${rule.betType}`);
    console.log(`  回収率（外れ値除外後）: ${(rule.recoveryRate * 100).toFixed(2)}%`);
    console.log(`  的中率: ${(rule.hitRate * 100).toFixed(2)}% (95%信頼区間: ${(rule.ci.lower * 100).toFixed(2)}% - ${(rule.ci.upper * 100).toFixed(2)}%)`);
    console.log(`  中央値配当: ${rule.medianPayout.toFixed(2)}倍`);
    console.log(`  期待回収率（信頼区間下限）: ${(rule.expectedRecoveryLower * 100).toFixed(2)}%`);
    console.log(`  サンプル数: ${rule.sampleSize}レース`);
    console.log(`  信頼度: ${rule.confidence}\n`);
  }

  return newModelRules;
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('=== 回収率100%超を目指す新モデル設計 ===\n');
  console.log('大穴依存ではなく、数学的根拠に基づいた安定した回収率100%超のモデルを設計します...\n');

  const races = await loadData();
  console.log(`データ読み込み完了: ${races.length}レース\n`);

  // 1. 既存モデルの分析
  const existingModelResults = analyzeExistingModels(races);

  // 2. 条件別最適モデル選択の分析
  const optimalStrategies = analyzeOptimalModelSelection(races);

  // 3. 会場別最適戦略の分析
  const venueStrategies = analyzeVenueOptimalStrategies(races);

  // 4. 新モデル設計
  const newModelRules = designNewModel(races, existingModelResults, optimalStrategies, venueStrategies);

  // 5. 結果をJSONファイルに保存
  const output = {
    generatedAt: new Date().toISOString(),
    totalRaces: races.length,
    existingModelResults,
    optimalStrategies,
    venueStrategies,
    newModelRules
  };

  const outputPath = path.join(__dirname, '..', 'data', 'new-model-design.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n結果を保存しました: ${outputPath}\n`);

  // サマリー
  console.log('=== サマリー ===\n');
  console.log(`高信頼度ルール数: ${newModelRules.filter(r => r.confidence === 'high').length}個\n`);
  
  const highConfidenceRules = newModelRules.filter(r => r.confidence === 'high');
  if (highConfidenceRules.length > 0) {
    console.log('【高信頼度ルールトップ5】\n');
    highConfidenceRules.slice(0, 5).forEach((rule, idx) => {
      console.log(`${idx + 1}. ${rule.condition}`);
      console.log(`   モデル: ${rule.model} - ${rule.betType}`);
      console.log(`   回収率: ${(rule.recoveryRate * 100).toFixed(2)}%`);
      console.log(`   期待回収率（信頼区間下限）: ${(rule.expectedRecoveryLower * 100).toFixed(2)}%\n`);
    });
  }
}

// 実行
main().catch(console.error);



