const fs = require('fs');
const path = require('path');

// 全ての予測ファイルを読み込む
function loadAllPredictions() {
  const predictionsDir = path.join(__dirname, 'data/predictions');
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

// 各モデルの的中を判定
function checkModelHit(prediction, result) {
  if (!prediction || !result) return false;
  return prediction.topPick === result.rank1;
}

// 荒れ度区間ごとの統計を計算
function analyzeByVolatilityRange(races) {
  // 荒れ度スコアを3つの区間に分ける
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
      const hits = racesWithModel.filter(r => checkModelHit(r.predictions[modelName], r.result));

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        hits: hits.length,
        hitRate: racesWithModel.length > 0 ? (hits.length / racesWithModel.length) : 0
      };
    }

    results.push(rangeStats);
  }

  return results;
}

// より細かい区間での分析（10区間）
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
      const hits = racesWithModel.filter(r => checkModelHit(r.predictions[modelName], r.result));

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        hits: hits.length,
        hitRate: racesWithModel.length > 0 ? (hits.length / racesWithModel.length) : 0
      };
    }

    results.push(rangeStats);
  }

  return results;
}

// 相関係数を計算（ピアソンの積率相関係数）
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

// 各モデルと荒れ度の相関を計算
function calculateModelVolatilityCorrelations(detailedStats) {
  const modelNames = ['standard', 'safeBet', 'upsetFocus'];
  const correlations = {};

  for (const modelName of modelNames) {
    const volatilities = [];
    const hitRates = [];

    for (const stat of detailedStats) {
      if (stat.models[modelName] && stat.models[modelName].totalRaces >= 10) { // 最低10レース以上
        volatilities.push(stat.avgVolatility);
        hitRates.push(stat.models[modelName].hitRate);
      }
    }

    const correlation = calculateCorrelation(volatilities, hitRates);
    correlations[modelName] = {
      correlation,
      dataPoints: volatilities.length,
      interpretation: interpretCorrelation(correlation)
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

  report += '=' .repeat(80) + '\n';
  report += '荒れ度と各モデルの予測精度の相関分析レポート\n';
  report += '=' .repeat(80) + '\n\n';

  report += `分析対象レース数: ${allRaces.length}\n`;
  report += `データ収集期間: 2025年12月\n\n`;

  report += '-'.repeat(80) + '\n';
  report += '1. 基本統計（3区間分析）\n';
  report += '-'.repeat(80) + '\n\n';

  for (const stat of basicStats) {
    report += `【${stat.range}】\n`;
    report += `  対象レース数: ${stat.totalRaces}\n`;
    report += `  平均荒れ度: ${stat.avgVolatility.toFixed(2)}\n\n`;

    report += '  モデル別的中率:\n';
    for (const [modelName, modelStat] of Object.entries(stat.models)) {
      const displayName = modelName === 'standard' ? 'スタンダード' :
                          modelName === 'safeBet' ? '本命' :
                          modelName === 'upsetFocus' ? '穴狙い' : modelName;
      report += `    ${displayName}: ${(modelStat.hitRate * 100).toFixed(2)}% (${modelStat.hits}/${modelStat.totalRaces})\n`;
    }
    report += '\n';
  }

  report += '-'.repeat(80) + '\n';
  report += '2. 相関分析結果\n';
  report += '-'.repeat(80) + '\n\n';

  for (const [modelName, corr] of Object.entries(correlations)) {
    const displayName = modelName === 'standard' ? 'スタンダードモデル' :
                        modelName === 'safeBet' ? '本命モデル' :
                        modelName === 'upsetFocus' ? '穴狙いモデル' : modelName;

    report += `【${displayName}】\n`;
    report += `  相関係数: ${corr.correlation !== null ? corr.correlation.toFixed(4) : 'N/A'}\n`;
    report += `  解釈: ${corr.interpretation}\n`;
    report += `  データポイント数: ${corr.dataPoints}\n\n`;
  }

  report += '-'.repeat(80) + '\n';
  report += '3. 詳細統計（10区間分析）\n';
  report += '-'.repeat(80) + '\n\n';

  report += '荒れ度区間 | レース数 | スタンダード | 本命     | 穴狙い\n';
  report += '-'.repeat(80) + '\n';

  for (const stat of detailedStats) {
    const standard = stat.models.standard ? `${(stat.models.standard.hitRate * 100).toFixed(1)}%` : 'N/A';
    const safeBet = stat.models.safeBet ? `${(stat.models.safeBet.hitRate * 100).toFixed(1)}%` : 'N/A';
    const upset = stat.models.upsetFocus ? `${(stat.models.upsetFocus.hitRate * 100).toFixed(1)}%` : 'N/A';

    report += `${stat.range.padEnd(12)} | ${String(stat.totalRaces).padEnd(9)} | ${standard.padEnd(13)} | ${safeBet.padEnd(9)} | ${upset}\n`;
  }

  report += '\n';
  report += '-'.repeat(80) + '\n';
  report += '4. 考察\n';
  report += '-'.repeat(80) + '\n\n';

  // 自動生成される考察
  const standardCorr = correlations.standard.correlation;
  const safeBetCorr = correlations.safeBet.correlation;
  const upsetCorr = correlations.upsetFocus.correlation;

  report += '荒れ度と各モデルの関係性:\n\n';

  if (standardCorr !== null && safeBetCorr !== null) {
    if (standardCorr < 0) {
      report += `- スタンダードモデル: 荒れ度が高いほど的中率が${Math.abs(standardCorr) > 0.2 ? '低下する傾向' : 'やや低下する傾向'}が見られます\n`;
    } else {
      report += `- スタンダードモデル: 荒れ度との明確な負の相関は見られませんでした\n`;
    }

    if (safeBetCorr < 0) {
      report += `- 本命モデル: 荒れ度が高いほど的中率が${Math.abs(safeBetCorr) > 0.2 ? '低下する傾向' : 'やや低下する傾向'}が見られます\n`;
    } else {
      report += `- 本命モデル: 荒れ度との明確な負の相関は見られませんでした\n`;
    }
  }

  if (upsetCorr !== null) {
    if (upsetCorr > 0) {
      report += `- 穴狙いモデル: 荒れ度が高いほど的中率が${upsetCorr > 0.2 ? '向上する傾向' : 'やや向上する傾向'}が見られます\n`;
    } else {
      report += `- 穴狙いモデル: 荒れ度との明確な正の相関は見られませんでした\n`;
    }
  }

  report += '\n';

  // 推奨モデルの精度検証
  report += '推奨モデルの妥当性:\n\n';
  const lowVolatility = basicStats[0];
  const highVolatility = basicStats[2];

  if (lowVolatility && highVolatility) {
    const lowBestModel = Object.entries(lowVolatility.models)
      .sort((a, b) => b[1].hitRate - a[1].hitRate)[0];
    const highBestModel = Object.entries(highVolatility.models)
      .sort((a, b) => b[1].hitRate - a[1].hitRate)[0];

    const modelDisplayName = (name) =>
      name === 'standard' ? 'スタンダード' :
      name === 'safeBet' ? '本命' :
      name === 'upsetFocus' ? '穴狙い' : name;

    report += `- 低荒れ度レースで最も高い的中率: ${modelDisplayName(lowBestModel[0])} (${(lowBestModel[1].hitRate * 100).toFixed(2)}%)\n`;
    report += `- 高荒れ度レースで最も高い的中率: ${modelDisplayName(highBestModel[0])} (${(highBestModel[1].hitRate * 100).toFixed(2)}%)\n`;
  }

  report += '\n';
  report += '=' .repeat(80) + '\n';
  report += `レポート生成日時: ${new Date().toLocaleString('ja-JP')}\n`;
  report += '=' .repeat(80) + '\n';

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
  const correlations = calculateModelVolatilityCorrelations(detailedStats);

  console.log('レポートを生成中...\n');
  const report = generateReport(basicStats, detailedStats, correlations, finishedRaces);

  console.log(report);

  // レポートをファイルに保存
  const reportPath = path.join(__dirname, 'model-volatility-correlation-report.txt');
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

  const jsonPath = path.join(__dirname, 'model-volatility-correlation-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`データを ${jsonPath} に保存しました。`);
}

// 実行
main();
