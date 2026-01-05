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

// 的中判定関数（calculate-accuracy.jsと同じロジック）
function checkWinHit(prediction, result) {
  if (!prediction || !result) return false;
  return prediction.topPick === result.rank1;
}

function checkPlaceHit(prediction, result) {
  if (!prediction || !result) return false;
  const topPick = prediction.topPick;
  // ボートレースの複勝は1着と2着のみ
  return result.rank1 === topPick || result.rank2 === topPick;
}

// Trifecta = 3連複 (any order)
function checkTrifectaHit(prediction, result) {
  if (!prediction || !result || !prediction.top3 || prediction.top3.length < 3) {
    return false;
  }
  const sortedTop3 = [...prediction.top3].sort((a, b) => a - b);
  const sortedResult = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b);
  return JSON.stringify(sortedTop3) === JSON.stringify(sortedResult);
}

// Trio = 3連単 (exact order)
function checkTrioHit(prediction, result) {
  if (!prediction || !result || !prediction.top3 || prediction.top3.length < 3) {
    return false;
  }
  return prediction.top3[0] === result.rank1 &&
         prediction.top3[1] === result.rank2 &&
         prediction.top3[2] === result.rank3;
}

// 配当取得関数
function getWinPayout(result, boatNumber) {
  if (!result || !result.payouts || !result.payouts.win) return 0;
  return result.payouts.win[boatNumber] || 0;
}

function getPlacePayout(result, boatNumber) {
  if (!result || !result.payouts || !result.payouts.place) return 0;
  return result.payouts.place[boatNumber] || 0;
}

// Trifecta = 3連複 (any order) - 実際の組み合わせに一致する配当を検索
function getTrifectaPayout(result) {
  if (!result || !result.payouts || !result.payouts.trifecta) return 0;

  const sortedResult = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b);
  const payoutKeys = Object.keys(result.payouts.trifecta);

  for (const key of payoutKeys) {
    const numbers = key.split(/[-=]/).map(Number).sort((a, b) => a - b);
    if (JSON.stringify(numbers) === JSON.stringify(sortedResult)) {
      return result.payouts.trifecta[key];
    }
  }
  return 0;
}

// Trio = 3連単 (exact order) - 実際の組み合わせに一致する配当を取得
function getTrioPayout(result) {
  if (!result || !result.payouts || !result.payouts.trio) return 0;
  const resultOrder = `${result.rank1}-${result.rank2}-${result.rank3}`;
  return result.payouts.trio[resultOrder] || 0;
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

      // 単勝
      const winHits = racesWithModel.filter(r => checkWinHit(r.predictions[modelName], r.result));
      let winPayout = 0;
      for (const race of racesWithModel) {
        if (checkWinHit(race.predictions[modelName], race.result)) {
          winPayout += getWinPayout(race.result, race.predictions[modelName].topPick);
        }
      }

      // 複勝
      const placeHits = racesWithModel.filter(r => checkPlaceHit(r.predictions[modelName], r.result));
      let placePayout = 0;
      for (const race of racesWithModel) {
        if (checkPlaceHit(race.predictions[modelName], race.result)) {
          placePayout += getPlacePayout(race.result, race.predictions[modelName].topPick);
        }
      }

      // 3連単
      const trifectaHits = racesWithModel.filter(r => checkTrifectaHit(r.predictions[modelName], r.result));
      let trifectaPayout = 0;
      for (const race of racesWithModel) {
        if (checkTrifectaHit(race.predictions[modelName], race.result)) {
          trifectaPayout += getTrifectaPayout(race.result);
        }
      }

      // 3連複
      const trioHits = racesWithModel.filter(r => checkTrioHit(r.predictions[modelName], r.result));
      let trioPayout = 0;
      for (const race of racesWithModel) {
        if (checkTrioHit(race.predictions[modelName], race.result)) {
          trioPayout += getTrioPayout(race.result);
        }
      }

      const totalInvestment = racesWithModel.length * 100;

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        win: {
          hits: winHits.length,
          hitRate: racesWithModel.length > 0 ? (winHits.length / racesWithModel.length) : 0,
          totalInvestment,
          totalPayout: winPayout,
          recoveryRate: totalInvestment > 0 ? (winPayout / totalInvestment) : 0
        },
        place: {
          hits: placeHits.length,
          hitRate: racesWithModel.length > 0 ? (placeHits.length / racesWithModel.length) : 0,
          totalInvestment,
          totalPayout: placePayout,
          recoveryRate: totalInvestment > 0 ? (placePayout / totalInvestment) : 0
        },
        trifecta: {
          hits: trifectaHits.length,
          hitRate: racesWithModel.length > 0 ? (trifectaHits.length / racesWithModel.length) : 0,
          totalInvestment,
          totalPayout: trifectaPayout,
          recoveryRate: totalInvestment > 0 ? (trifectaPayout / totalInvestment) : 0
        },
        trio: {
          hits: trioHits.length,
          hitRate: racesWithModel.length > 0 ? (trioHits.length / racesWithModel.length) : 0,
          totalInvestment,
          totalPayout: trioPayout,
          recoveryRate: totalInvestment > 0 ? (trioPayout / totalInvestment) : 0
        }
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

      const winHits = racesWithModel.filter(r => checkWinHit(r.predictions[modelName], r.result));
      const placeHits = racesWithModel.filter(r => checkPlaceHit(r.predictions[modelName], r.result));
      const trifectaHits = racesWithModel.filter(r => checkTrifectaHit(r.predictions[modelName], r.result));
      const trioHits = racesWithModel.filter(r => checkTrioHit(r.predictions[modelName], r.result));

      rangeStats.models[modelName] = {
        totalRaces: racesWithModel.length,
        winHitRate: racesWithModel.length > 0 ? (winHits.length / racesWithModel.length) : 0,
        placeHitRate: racesWithModel.length > 0 ? (placeHits.length / racesWithModel.length) : 0,
        trifectaHitRate: racesWithModel.length > 0 ? (trifectaHits.length / racesWithModel.length) : 0,
        trioHitRate: racesWithModel.length > 0 ? (trioHits.length / racesWithModel.length) : 0
      };
    }

    results.push(rangeStats);
  }

  return results;
}

// 相関係数計算
function calculateAllCorrelations(detailedStats) {
  const modelNames = ['standard', 'safeBet', 'upsetFocus'];
  const correlations = {};

  for (const modelName of modelNames) {
    const volatilities = [];
    const winRates = [];
    const placeRates = [];
    const trifectaRates = [];
    const trioRates = [];

    for (const stat of detailedStats) {
      if (stat.models[modelName] && stat.models[modelName].totalRaces >= 10) {
        volatilities.push(stat.avgVolatility);
        winRates.push(stat.models[modelName].winHitRate);
        placeRates.push(stat.models[modelName].placeHitRate);
        trifectaRates.push(stat.models[modelName].trifectaHitRate);
        trioRates.push(stat.models[modelName].trioHitRate);
      }
    }

    correlations[modelName] = {
      win: calculateCorrelation(volatilities, winRates),
      place: calculateCorrelation(volatilities, placeRates),
      trifecta: calculateCorrelation(volatilities, trifectaRates),
      trio: calculateCorrelation(volatilities, trioRates),
      dataPoints: volatilities.length
    };
  }

  return correlations;
}

// レポート生成
function generateReport(basicStats, detailedStats, correlations, totalRaces) {
  let report = '';

  report += '='.repeat(100) + '\n';
  report += '完全版：荒れ度と各モデルの予測精度・回収率の相関分析レポート\n';
  report += '='.repeat(100) + '\n\n';

  report += `分析対象レース数: ${totalRaces}\n`;
  report += `データ収集期間: 2025年12月\n`;
  report += `分析項目: 単勝・複勝・3連単・3連複\n\n`;

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
      report += `    単勝   : 的中率 ${(modelStat.win.hitRate * 100).toFixed(2)}% / 回収率 ${(modelStat.win.recoveryRate * 100).toFixed(2)}%\n`;
      report += `    複勝   : 的中率 ${(modelStat.place.hitRate * 100).toFixed(2)}% / 回収率 ${(modelStat.place.recoveryRate * 100).toFixed(2)}%\n`;
      report += `    3連複  : 的中率 ${(modelStat.trifecta.hitRate * 100).toFixed(2)}% / 回収率 ${(modelStat.trifecta.recoveryRate * 100).toFixed(2)}%\n`;
      report += `    3連単  : 的中率 ${(modelStat.trio.hitRate * 100).toFixed(2)}% / 回収率 ${(modelStat.trio.recoveryRate * 100).toFixed(2)}%\n\n`;
    }
  }

  report += '-'.repeat(100) + '\n';
  report += '2. 相関分析結果（荒れ度と的中率の相関係数）\n';
  report += '-'.repeat(100) + '\n\n';

  for (const [modelName, corr] of Object.entries(correlations)) {
    const displayName = modelName === 'standard' ? 'スタンダードモデル' :
                        modelName === 'safeBet' ? '本命モデル' :
                        modelName === 'upsetFocus' ? '穴狙いモデル' : modelName;

    report += `【${displayName}】\n`;
    report += `  単勝的中率: ${corr.win !== null ? corr.win.toFixed(4) : 'N/A'}\n`;
    report += `  複勝的中率: ${corr.place !== null ? corr.place.toFixed(4) : 'N/A'}\n`;
    report += `  3連複的中率: ${corr.trifecta !== null ? corr.trifecta.toFixed(4) : 'N/A'}\n`;
    report += `  3連単的中率: ${corr.trio !== null ? corr.trio.toFixed(4) : 'N/A'}\n`;
    report += `  データポイント数: ${corr.dataPoints}\n\n`;
  }

  report += '-'.repeat(100) + '\n';
  report += '3. 重要な発見\n';
  report += '-'.repeat(100) + '\n\n';

  const lowVol = basicStats[0];
  const highVol = basicStats[2];

  report += '【荒れ度による的中率・回収率の変化】\n\n';

  for (const modelName of ['standard', 'safeBet', 'upsetFocus']) {
    const displayName = modelName === 'standard' ? 'スタンダード' :
                        modelName === 'safeBet' ? '本命' :
                        modelName === 'upsetFocus' ? '穴狙い' : modelName;

    const low = lowVol.models[modelName];
    const high = highVol.models[modelName];

    report += `${displayName}:\n`;
    report += `  単勝的中率: ${(low.win.hitRate * 100).toFixed(2)}% → ${(high.win.hitRate * 100).toFixed(2)}%\n`;
    report += `  複勝的中率: ${(low.place.hitRate * 100).toFixed(2)}% → ${(high.place.hitRate * 100).toFixed(2)}%\n`;
    report += `  3連複的中率: ${(low.trifecta.hitRate * 100).toFixed(2)}% → ${(high.trifecta.hitRate * 100).toFixed(2)}%\n`;
    report += `  3連複回収率: ${(low.trifecta.recoveryRate * 100).toFixed(2)}% → ${(high.trifecta.recoveryRate * 100).toFixed(2)}%\n\n`;
  }

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

  console.log('基本統計を計算中（単勝・複勝・3連単・3連複）...');
  const basicStats = analyzeByVolatilityRange(finishedRaces);

  console.log('詳細統計を計算中...');
  const detailedStats = analyzeByDetailedVolatilityRange(finishedRaces);

  console.log('相関係数を計算中...');
  const correlations = calculateAllCorrelations(detailedStats);

  console.log('レポートを生成中...\n');
  const report = generateReport(basicStats, detailedStats, correlations, finishedRaces.length);

  console.log(report);

  // レポートを保存
  const reportPath = path.join(__dirname, 'complete-volatility-correlation-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nレポートを ${reportPath} に保存しました。`);

  // JSONデータも保存
  const jsonData = {
    generatedAt: new Date().toISOString(),
    totalRaces: finishedRaces.length,
    basicStats,
    detailedStats,
    correlations
  };

  const jsonPath = path.join(__dirname, 'complete-volatility-correlation-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`データを ${jsonPath} に保存しました。`);
}

main();
