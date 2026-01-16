/**
 * 回収率100%超を目指す新モデル設計スクリプト（改良版）
 * 
 * より詳細な条件分析と、複合条件の組み合わせを試します。
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
 * 選手データを取得
 */
function getPlayers(race) {
  return race.prediction?.players || 
         race.predictions?.standard?.players ||
         race.predictions?.safeBet?.players ||
         race.predictions?.upsetFocus?.players ||
         [];
}

/**
 * 回収率を計算（改良版：中央値ベース）
 */
function calculateRecoveryMedianBased(races, getPredictionFn, betType, conditionFn = null) {
  let totalInvestment = 0;
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
        if (payout) hit = true;
      }
    } else if (betType === 'place') {
      const topPick = prediction.topPick;
      if (topPick === result.rank1 || topPick === result.rank2) {
        payout = payoutsData.place[String(topPick)];
        if (payout) hit = true;
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
        if (payout) hit = true;
      }
    }

    if (hit && payout) {
      hitCount++;
      payouts.push(payout / 100);
    }
  }

  if (payouts.length === 0) {
    return {
      sampleSize: totalInvestment / 100,
      hitRate: 0,
      medianPayout: 0,
      expectedRecovery: 0
    };
  }

  payouts.sort((a, b) => a - b);
  const hitRate = hitCount / (totalInvestment / 100);
  const medianPayout = payouts[Math.floor(payouts.length / 2)];
  
  // 中央値ベースの期待回収率
  const expectedRecovery = hitRate * medianPayout;

  return {
    sampleSize: totalInvestment / 100,
    hitRate,
    medianPayout,
    expectedRecovery,
    payouts
  };
}

/**
 * 信頼区間の計算
 */
function calculateConfidenceInterval(hitRate, sampleSize, confidence = 0.95) {
  const z = confidence === 0.95 ? 1.96 : 2.576;
  const se = Math.sqrt(hitRate * (1 - hitRate) / sampleSize);
  const margin = z * se;
  return {
    lower: Math.max(0, hitRate - margin),
    upper: Math.min(1, hitRate + margin)
  };
}

/**
 * 詳細な条件分析
 */
async function analyzeDetailedConditions(races) {
  console.log('=== 詳細な条件分析 ===\n');

  const models = ['standard', 'safeBet', 'upsetFocus'];
  const betTypes = ['place', 'trifecta'];
  const strategies = [];

  // 条件の定義
  const conditions = [
    {
      name: '全条件',
      fn: () => true
    },
    {
      name: '1号艇がA1級',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && lane1.grade === 'A1';
      }
    },
    {
      name: '1号艇がA2級以上',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && (lane1.grade === 'A1' || lane1.grade === 'A2');
      }
    },
    {
      name: '1号艇のモーター2連率40%以上',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && parseFloat(lane1.motor2Rate) >= 40;
      }
    },
    {
      name: '1号艇のモーター2連率35%以上',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && parseFloat(lane1.motor2Rate) >= 35;
      }
    },
    {
      name: 'A1級2名以上',
      fn: (race) => {
        const players = getPlayers(race);
        return players.filter(p => p.grade === 'A1').length >= 2;
      }
    },
    {
      name: 'A1級1名以上',
      fn: (race) => {
        const players = getPlayers(race);
        return players.filter(p => p.grade === 'A1').length >= 1;
      }
    },
    {
      name: '1号艇がA1級 かつ モーター2連率40%以上',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && lane1.grade === 'A1' && parseFloat(lane1.motor2Rate) >= 40;
      }
    },
    {
      name: '1号艇がA2級以上 かつ モーター2連率35%以上',
      fn: (race) => {
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && (lane1.grade === 'A1' || lane1.grade === 'A2') && parseFloat(lane1.motor2Rate) >= 35;
      }
    }
  ];

  // 会場別の条件も追加
  for (let venueCode = 1; venueCode <= 24; venueCode++) {
    conditions.push({
      name: `会場: ${venueNames[venueCode]}`,
      fn: (race) => race.venueCode === venueCode
    });
    
    // 会場 × 1号艇がA1級
    conditions.push({
      name: `会場: ${venueNames[venueCode]} かつ 1号艇がA1級`,
      fn: (race) => {
        if (race.venueCode !== venueCode) return false;
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && lane1.grade === 'A1';
      }
    });
    
    // 会場 × 1号艇のモーター2連率40%以上
    conditions.push({
      name: `会場: ${venueNames[venueCode]} かつ 1号艇のモーター2連率40%以上`,
      fn: (race) => {
        if (race.venueCode !== venueCode) return false;
        const players = getPlayers(race);
        const lane1 = players.find(p => p.number === 1);
        return lane1 && parseFloat(lane1.motor2Rate) >= 40;
      }
    });
  }

  for (const condition of conditions) {
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

        const result = calculateRecoveryMedianBased(races, getPredictionFn, betType, condition.fn);

        // サンプル数が十分で、中央値ベースの期待回収率が100%超の場合
        if (result.sampleSize >= 50 && result.expectedRecovery > 1.0) {
          const ci = calculateConfidenceInterval(result.hitRate, result.sampleSize);
          const expectedRecoveryLower = ci.lower * result.medianPayout;
          const expectedRecoveryUpper = ci.upper * result.medianPayout;

          // 信頼区間の下限でも100%超の場合のみ採用
          if (expectedRecoveryLower > 1.0) {
            strategies.push({
              condition: condition.name,
              model: modelKey,
              betType,
              hitRate: result.hitRate,
              medianPayout: result.medianPayout,
              expectedRecovery: result.expectedRecovery,
              expectedRecoveryLower,
              expectedRecoveryUpper,
              ci,
              sampleSize: result.sampleSize
            });
          }
        }
      }
    }
  }

  // 期待回収率（信頼区間下限）でソート
  strategies.sort((a, b) => b.expectedRecoveryLower - a.expectedRecoveryLower);

  return strategies;
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('=== 回収率100%超を目指す新モデル設計（改良版） ===\n');
  console.log('中央値ベースの期待回収率で、大穴依存を排除した戦略を設計します...\n');

  const races = await loadData();
  console.log(`データ読み込み完了: ${races.length}レース\n`);

  const strategies = await analyzeDetailedConditions(races);

  console.log(`\n=== 結果 ===\n`);
  console.log(`回収率100%超の戦略数: ${strategies.length}個\n`);

  if (strategies.length > 0) {
    console.log('【高信頼度戦略（信頼区間下限でも100%超）】\n');
    
    // サンプル数でフィルタリング
    const highConfidenceStrategies = strategies.filter(s => s.sampleSize >= 100);
    
    if (highConfidenceStrategies.length > 0) {
      console.log(`高信頼度戦略（サンプル数100以上）: ${highConfidenceStrategies.length}個\n`);
      
      highConfidenceStrategies.slice(0, 20).forEach((s, idx) => {
        console.log(`${idx + 1}. ${s.condition}`);
        console.log(`   モデル: ${s.model} - ${s.betType}`);
        console.log(`   的中率: ${(s.hitRate * 100).toFixed(2)}% (95%信頼区間: ${(s.ci.lower * 100).toFixed(2)}% - ${(s.ci.upper * 100).toFixed(2)}%)`);
        console.log(`   中央値配当: ${s.medianPayout.toFixed(2)}倍`);
        console.log(`   期待回収率: ${(s.expectedRecovery * 100).toFixed(2)}%`);
        console.log(`   期待回収率（信頼区間下限）: ${(s.expectedRecoveryLower * 100).toFixed(2)}%`);
        console.log(`   期待回収率（信頼区間上限）: ${(s.expectedRecoveryUpper * 100).toFixed(2)}%`);
        console.log(`   サンプル数: ${s.sampleSize}レース\n`);
      });
    } else {
      console.log('高信頼度戦略（サンプル数100以上）は見つかりませんでした。\n');
      console.log('【中程度信頼度戦略（サンプル数50以上）】\n');
      strategies.slice(0, 20).forEach((s, idx) => {
        console.log(`${idx + 1}. ${s.condition}`);
        console.log(`   モデル: ${s.model} - ${s.betType}`);
        console.log(`   期待回収率（信頼区間下限）: ${(s.expectedRecoveryLower * 100).toFixed(2)}%`);
        console.log(`   サンプル数: ${s.sampleSize}レース\n`);
      });
    }
  } else {
    console.log('回収率100%超の戦略は見つかりませんでした。\n');
    console.log('中央値ベースの期待回収率では、大穴依存を排除すると回収率100%超が難しい可能性があります。\n');
  }

  // 結果をJSONファイルに保存
  const output = {
    generatedAt: new Date().toISOString(),
    totalRaces: races.length,
    strategies
  };

  const outputPath = path.join(__dirname, '..', 'data', 'new-model-design-v2.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n結果を保存しました: ${outputPath}\n`);
}

// 実行
main().catch(console.error);



