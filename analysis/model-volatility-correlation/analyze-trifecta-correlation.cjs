const fs = require('fs');
const path = require('path');

// 全ての予測ファイルを読み込む
function loadAllPredictions() {
  const predictionsDir = path.join(__dirname, '../../data/predictions');
  const files = fs.readdirSync(predictionsDir)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));

  const allRaces = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(predictionsDir, file), 'utf8'));
      if (data.races) {
        allRaces.push(...data.races);
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  }

  return allRaces;
}

// 結果が確定しているレースのみをフィルタ
function getFinishedRaces(races) {
  return races.filter(race => race.result && race.result.finished);
}

// 単勝的中判定
function checkWinHit(prediction, result) {
  if (!prediction || !result) return false;
  return prediction.topPick === result.rank1;
}

// 3連単的中判定
function checkTrifectaHit(prediction, result) {
  if (!prediction || !result || !prediction.top3 || prediction.top3.length < 3) {
    return false;
  }
  return prediction.top3[0] === result.rank1 &&
         prediction.top3[1] === result.rank2 &&
         prediction.top3[2] === result.rank3;
}

// 3連単配当取得
function getTrifectaPayout(result) {
  if (!result || !result.payouts || !result.payouts.trifecta) {
    return 0;
  }
  const payouts = Object.values(result.payouts.trifecta);
  return payouts.length > 0 ? payouts[0] : 0;
}

// 荒れ度区間ごとの統計を計算
function analyzeByVolatilityRange(races) {
  const ranges = [
    { min: 0, max: 33, label: '低荒れ度 (0-33)' },
    { min: 34, max: 66, label: '中荒れ度 (34-66)' },
    { min: 67, max: 100, label: '高荒れ度 (67-100)' }
  ];

  const modelNames = ['standard', 'safeBet', 'upsetFocus'];

  const results = [];

  for (const range of ranges) {
    const racesInRange = races.filter(r =>
      r.volatility &&
      r.volatility.score >= range.min &&
      r.volatility.score <= range.max
    );

    const rangeStats = {
      range: range.label,
      volatilityRange: `${range.min}-${range.max}`,
      totalRaces: racesInRange.length,
      avgVolatility: racesInRange.reduce((sum, r) => sum + (r.volatility?.score || 0), 0) / racesInRange.length,
      models: {}
    };

    for (const modelName of modelNames) {
      const racesWithModel = racesInRange.filter(r => r.predictions && r.predictions[modelName]);

      // 単勝統計
      const winHits = racesWithModel.filter(r => checkWinHit(r.predictions[modelName], r.result));

      // 3連単統計
      const trifectaHits = racesWithModel.filter(r => checkTrifectaHit(r.predictions[modelName], r.result));

      // 3連単回収率計算
      let totalInvestment = racesWithModel.length * 100; // 1レース100円
      let totalPayout = 0;

      for (const race of racesWithModel) {
        if (checkTrifectaHit(race.predictions[modelName], race.result)) {
          totalPayout += getTrifectaPayout(race.result);
        }
      }

      const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        win: {
          hits: winHits.length,
          hitRate: racesWithModel.length > 0 ? (winHits.length / racesWithModel.length) : 0
        },
        trifecta: {
          hits: trifectaHits.length,
          hitRate: racesWithModel.length > 0 ? (trifectaHits.length / racesWithModel.length) : 0,
          totalInvestment,
          totalPayout,
          recoveryRate
        }
      };
    }

    results.push(rangeStats);
  }

  return results;
}

// 詳細な10区間分析
function analyzeByDetailedVolatilityRange(races) {
  const ranges = [];
  for (let i = 0; i < 10; i++) {
    ranges.push({
      min: i * 10,
      max: (i + 1) * 10 - 1,
      label: `${i * 10}-${(i + 1) * 10 - 1}`
    });
  }

  const modelNames = ['standard', 'safeBet', 'upsetFocus'];
  const results = [];

  for (const range of ranges) {
    const racesInRange = races.filter(r =>
      r.volatility &&
      r.volatility.score >= range.min &&
      r.volatility.score <= range.max
    );

    if (racesInRange.length === 0) continue;

    const rangeStats = {
      range: range.label,
      totalRaces: racesInRange.length,
      avgVolatility: racesInRange.reduce((sum, r) => sum + (r.volatility?.score || 0), 0) / racesInRange.length,
      models: {}
    };

    for (const modelName of modelNames) {
      const racesWithModel = racesInRange.filter(r => r.predictions && r.predictions[modelName]);
      const trifectaHits = racesWithModel.filter(r => checkTrifectaHit(r.predictions[modelName], r.result));

      let totalInvestment = racesWithModel.length * 100;
      let totalPayout = 0;

      for (const race of racesWithModel) {
        if (checkTrifectaHit(race.predictions[modelName], race.result)) {
          totalPayout += getTrifectaPayout(race.result);
        }
      }

      const recoveryRate = totalInvestment > 0 ? totalPayout / totalInvestment : 0;

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        trifectaHitRate: racesWithModel.length > 0 ? (trifectaHits.length / racesWithModel.length) : 0,
        recoveryRate
      };
    }

    results.push(rangeStats);
  }

  return results;
}

// 相関係数を計算
function calculateCorrelation(x, y) {
  const n = x.length;
  if (n === 0 || n !== y.length) return null;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;

  return numerator / denominator;
}

// 3連単的中率と回収率の相関を計算
function calculateTrifectaCorrelations(detailedStats) {
  const modelNames = ['standard', 'safeBet', 'upsetFocus'];
  const correlations = {};

  for (const modelName of modelNames) {
    const volatilities = [];
    const hitRates = [];
    const recoveryRates = [];

    for (const stat of detailedStats) {
      if (stat.models[modelName] && stat.models[modelName].totalRaces >= 10) {
        volatilities.push(stat.avgVolatility);
        hitRates.push(stat.models[modelName].trifectaHitRate);
        recoveryRates.push(stat.models[modelName].recoveryRate);
      }
    }

    const hitRateCorrelation = calculateCorrelation(volatilities, hitRates);
    const recoveryRateCorrelation = calculateCorrelation(volatilities, recoveryRates);

    correlations[modelName] = {
      hitRate: {
        correlation: hitRateCorrelation,
        dataPoints: volatilities.length
      },
      recoveryRate: {
        correlation: recoveryRateCorrelation,
        dataPoints: volatilities.length
      }
    };
  }

  return correlations;
}

// 相関係数の解釈
function interpretCorrelation(r) {
  if (r === null) return '計算不可';
  const abs = Math.abs(r);

  let strength;
  if (abs >= 0.7) strength = '強い';
  else if (abs >= 0.4) strength = '中程度の';
  else if (abs >= 0.2) strength = '弱い';
  else strength = 'ほとんど無い';

  const direction = r > 0 ? '正の' : '負の';

  return `${strength}${direction}相関`;
}

// レポートを生成
function generateReport(basicStats, detailedStats, correlations, allRaces) {
  let report = '';

  report += '='.repeat(100) + '\n';
  report += '単勝・3連単的中率と回収率の荒れ度相関分析レポート\n';
  report += '='.repeat(100) + '\n\n';

  report += `分析対象レース数: ${allRaces.length}\n`;
  report += `データ収集期間: 2025年12月\n\n`;

  report += '-'.repeat(100) + '\n';
  report += '1. 基本統計（3区間分析）\n';
  report += '-'.repeat(100) + '\n\n';

  for (const stat of basicStats) {
    report += `【${stat.range}】\n`;
    report += `  対象レース数: ${stat.totalRaces}\n`;
    report += `  平均荒れ度: ${stat.avgVolatility.toFixed(2)}\n\n`;

    for (const [modelName, modelStat] of Object.entries(stat.models)) {
      const displayName = modelName === 'standard' ? 'スタンダード' :
                          modelName === 'safeBet' ? '本命      ' :
                          modelName === 'upsetFocus' ? '穴狙い    ' : modelName;

      report += `  ${displayName}:\n`;
      report += `    単勝的中率  : ${(modelStat.win.hitRate * 100).toFixed(2)}% (${modelStat.win.hits}/${modelStat.totalRaces})\n`;
      report += `    3連単的中率 : ${(modelStat.trifecta.hitRate * 100).toFixed(2)}% (${modelStat.trifecta.hits}/${modelStat.totalRaces})\n`;
      report += `    3連単回収率 : ${(modelStat.trifecta.recoveryRate * 100).toFixed(2)}% (${modelStat.trifecta.totalPayout}円/${modelStat.trifecta.totalInvestment}円)\n\n`;
    }
  }

  report += '-'.repeat(100) + '\n';
  report += '2. 相関分析結果\n';
  report += '-'.repeat(100) + '\n\n';

  for (const [modelName, corr] of Object.entries(correlations)) {
    const displayName = modelName === 'standard' ? 'スタンダードモデル' :
                        modelName === 'safeBet' ? '本命モデル' :
                        modelName === 'upsetFocus' ? '穴狙いモデル' : modelName;

    report += `【${displayName}】\n`;
    report += `  3連単的中率と荒れ度の相関:\n`;
    report += `    相関係数: ${corr.hitRate.correlation !== null ? corr.hitRate.correlation.toFixed(4) : 'N/A'}\n`;
    report += `    解釈: ${interpretCorrelation(corr.hitRate.correlation)}\n\n`;
    report += `  3連単回収率と荒れ度の相関:\n`;
    report += `    相関係数: ${corr.recoveryRate.correlation !== null ? corr.recoveryRate.correlation.toFixed(4) : 'N/A'}\n`;
    report += `    解釈: ${interpretCorrelation(corr.recoveryRate.correlation)}\n\n`;
  }

  report += '-'.repeat(100) + '\n';
  report += '3. 詳細比較表（10区間分析）\n';
  report += '-'.repeat(100) + '\n\n';

  report += '荒れ度 | レース | スタンダード(的中/回収) | 本命(的中/回収)     | 穴狙い(的中/回収)\n';
  report += '-'.repeat(100) + '\n';

  for (const stat of detailedStats) {
    const formatStat = (model) => {
      if (!model) return 'N/A';
      return `${(model.trifectaHitRate * 100).toFixed(1)}%/${(model.recoveryRate * 100).toFixed(0)}%`;
    };

    const standard = formatStat(stat.models.standard);
    const safeBet = formatStat(stat.models.safeBet);
    const upset = formatStat(stat.models.upsetFocus);

    report += `${stat.range.padEnd(6)} | ${String(stat.totalRaces).padEnd(6)} | ${standard.padEnd(24)} | ${safeBet.padEnd(20)} | ${upset}\n`;
  }

  report += '\n';

  report += '-'.repeat(100) + '\n';
  report += '4. 重要な発見と考察\n';
  report += '-'.repeat(100) + '\n\n';

  // 低荒れ度と高荒れ度の比較
  const lowVol = basicStats[0];
  const highVol = basicStats[2];

  report += '【単勝 vs 3連単の的中率比較】\n\n';

  for (const modelName of ['standard', 'safeBet', 'upsetFocus']) {
    const displayName = modelName === 'standard' ? 'スタンダード' :
                        modelName === 'safeBet' ? '本命' :
                        modelName === 'upsetFocus' ? '穴狙い' : modelName;

    const lowWinRate = lowVol.models[modelName].win.hitRate * 100;
    const lowTrifectaRate = lowVol.models[modelName].trifecta.hitRate * 100;
    const highWinRate = highVol.models[modelName].win.hitRate * 100;
    const highTrifectaRate = highVol.models[modelName].trifecta.hitRate * 100;

    report += `${displayName}:\n`;
    report += `  低荒れ度: 単勝 ${lowWinRate.toFixed(2)}% → 3連単 ${lowTrifectaRate.toFixed(2)}% (${(lowTrifectaRate/lowWinRate*100).toFixed(1)}%)\n`;
    report += `  高荒れ度: 単勝 ${highWinRate.toFixed(2)}% → 3連単 ${highTrifectaRate.toFixed(2)}% (${(highTrifectaRate/highWinRate*100).toFixed(1)}%)\n\n`;
  }

  report += '【3連単回収率の傾向】\n\n';

  for (const modelName of ['standard', 'safeBet', 'upsetFocus']) {
    const displayName = modelName === 'standard' ? 'スタンダード' :
                        modelName === 'safeBet' ? '本命' :
                        modelName === 'upsetFocus' ? '穴狙い' : modelName;

    const lowRecovery = lowVol.models[modelName].trifecta.recoveryRate * 100;
    const highRecovery = highVol.models[modelName].trifecta.recoveryRate * 100;

    report += `${displayName}: ${lowRecovery.toFixed(2)}% (低) → ${highRecovery.toFixed(2)}% (高)\n`;
  }

  report += '\n';
  report += '='.repeat(100) + '\n';
  report += `レポート生成日時: ${new Date().toLocaleString('ja-JP')}\n`;
  report += '='.repeat(100) + '\n';

  return report;
}

// メイン処理
function main() {
  console.log('予測データを読み込んでいます...');
  const allRaces = loadAllPredictions();
  console.log(`総レース数: ${allRaces.length}`);

  const finishedRaces = getFinishedRaces(allRaces);
  console.log(`結果確定レース数: ${finishedRaces.length}\n`);

  if (finishedRaces.length === 0) {
    console.log('分析対象のレースがありません。');
    return;
  }

  console.log('基本統計を計算中...');
  const basicStats = analyzeByVolatilityRange(finishedRaces);

  console.log('詳細統計を計算中...');
  const detailedStats = analyzeByDetailedVolatilityRange(finishedRaces);

  console.log('相関係数を計算中...');
  const correlations = calculateTrifectaCorrelations(detailedStats);

  console.log('レポートを生成中...\n');
  const report = generateReport(basicStats, detailedStats, correlations, finishedRaces);

  console.log(report);

  // レポートをファイルに保存
  const reportPath = path.join(__dirname, 'trifecta-correlation-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nレポートを ${reportPath} に保存しました。`);

  // JSON形式でも保存
  const jsonData = {
    generatedAt: new Date().toISOString(),
    totalRaces: finishedRaces.length,
    basicStats,
    detailedStats,
    correlations
  };

  const jsonPath = path.join(__dirname, 'trifecta-correlation-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`データを ${jsonPath} に保存しました。`);
}

main();
