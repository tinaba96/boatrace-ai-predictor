const fs = require('fs');
const path = require('path');

// 全ての予測ファイルを読み込む
function loadAllPredictions() {
  const predictionsDir = path.join(__dirname, '../../data/predictions');
  const files = fs.readdirSync(predictionsDir)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
    .sort(); // 日付順にソート

  const allRaces = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(predictionsDir, file), 'utf8'));
      if (data.races) {
        allRaces.push(...data.races.map(r => ({ ...r, date: data.date || file.replace('.json', '') })));
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  }

  return allRaces;
}

// 穴狙いモデルがあるレースのみをフィルタ（12/19以降）
function filterUpsetFocusRaces(races) {
  return races.filter(race =>
    race.predictions &&
    race.predictions.upsetFocus &&
    race.result &&
    race.result.finished
  );
}

// 配列が完全に一致するかチェック（順序も含む）
function arraysEqual(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
}

// 配列が完全に一致するかチェック（順序は問わない）
function arraysEqualUnordered(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, index) => val === sorted2[index]);
}

// 単勝配当を取得
function getWinPayout(result, boatNumber) {
  if (!result || !result.payouts || !result.payouts.win) return 0;
  return result.payouts.win[boatNumber] || 0;
}

// 複勝配当を取得
function getPlacePayout(result, boatNumber) {
  if (!result || !result.payouts || !result.payouts.place) return 0;
  return result.payouts.place[boatNumber] || 0;
}

// 3連単配当を取得
function getTrifectaPayout(result) {
  if (!result || !result.payouts || !result.payouts.trifecta) return 0;
  const payouts = Object.values(result.payouts.trifecta);
  return payouts.length > 0 ? payouts[0] : 0;
}

// 3連複配当を取得
function getTrioPayout(result) {
  if (!result || !result.payouts || !result.payouts.trio) return 0;
  const payouts = Object.values(result.payouts.trio);
  return payouts.length > 0 ? payouts[0] : 0;
}

// 本命一致時の分析
function analyzeTopPickAgreement(races) {
  const agreed = [];
  const disagreed = [];

  for (const race of races) {
    const standardTop = race.predictions.standard.topPick;
    const upsetTop = race.predictions.upsetFocus.topPick;

    if (standardTop === upsetTop) {
      agreed.push(race);
    } else {
      disagreed.push(race);
    }
  }

  // 一致時の統計
  const agreedStats = {
    total: agreed.length,
    win: {
      hits: 0,
      totalInvestment: agreed.length * 100,
      totalPayout: 0
    },
    place: {
      hits: 0,
      totalInvestment: agreed.length * 100,
      totalPayout: 0
    }
  };

  for (const race of agreed) {
    const topPick = race.predictions.standard.topPick;

    // 単勝
    if (race.result.rank1 === topPick) {
      agreedStats.win.hits++;
      agreedStats.win.totalPayout += getWinPayout(race.result, topPick);
    }

    // 複勝（3着以内）
    if (race.result.rank1 === topPick ||
        race.result.rank2 === topPick ||
        race.result.rank3 === topPick) {
      agreedStats.place.hits++;
      agreedStats.place.totalPayout += getPlacePayout(race.result, topPick);
    }
  }

  // 不一致時の統計（参考：スタンダードモデル基準）
  const disagreedStats = {
    total: disagreed.length,
    win: {
      hits: 0,
      totalInvestment: disagreed.length * 100,
      totalPayout: 0
    },
    place: {
      hits: 0,
      totalInvestment: disagreed.length * 100,
      totalPayout: 0
    }
  };

  for (const race of disagreed) {
    const standardTop = race.predictions.standard.topPick;

    // 単勝
    if (race.result.rank1 === standardTop) {
      disagreedStats.win.hits++;
      disagreedStats.win.totalPayout += getWinPayout(race.result, standardTop);
    }

    // 複勝
    if (race.result.rank1 === standardTop ||
        race.result.rank2 === standardTop ||
        race.result.rank3 === standardTop) {
      disagreedStats.place.hits++;
      disagreedStats.place.totalPayout += getPlacePayout(race.result, standardTop);
    }
  }

  return { agreed: agreedStats, disagreed: disagreedStats };
}

// トップ3完全一致時の分析
function analyzeTop3Agreement(races) {
  const fullMatch = []; // 順序も完全一致
  const unorderedMatch = []; // 順序は違うが艇番号は一致
  const noMatch = [];

  for (const race of races) {
    const standardTop3 = race.predictions.standard.top3;
    const upsetTop3 = race.predictions.upsetFocus.top3;

    if (arraysEqual(standardTop3, upsetTop3)) {
      fullMatch.push(race);
    } else if (arraysEqualUnordered(standardTop3, upsetTop3)) {
      unorderedMatch.push(race);
    } else {
      noMatch.push(race);
    }
  }

  // 完全一致時の統計
  const fullMatchStats = {
    total: fullMatch.length,
    trifecta: {
      hits: 0,
      totalInvestment: fullMatch.length * 100,
      totalPayout: 0
    },
    trio: {
      hits: 0,
      totalInvestment: fullMatch.length * 100,
      totalPayout: 0
    }
  };

  for (const race of fullMatch) {
    const top3 = race.predictions.standard.top3;

    // 3連単（順序も一致）
    if (race.result.rank1 === top3[0] &&
        race.result.rank2 === top3[1] &&
        race.result.rank3 === top3[2]) {
      fullMatchStats.trifecta.hits++;
      fullMatchStats.trifecta.totalPayout += getTrifectaPayout(race.result);
    }

    // 3連複（順序は問わない）
    const resultSet = [race.result.rank1, race.result.rank2, race.result.rank3].sort();
    const predictionSet = [...top3].sort();
    if (arraysEqual(resultSet, predictionSet)) {
      fullMatchStats.trio.hits++;
      fullMatchStats.trio.totalPayout += getTrioPayout(race.result);
    }
  }

  // 順序違い一致時の統計
  const unorderedMatchStats = {
    total: unorderedMatch.length,
    trifecta: {
      hits: 0,
      totalInvestment: unorderedMatch.length * 100,
      totalPayout: 0
    },
    trio: {
      hits: 0,
      totalInvestment: unorderedMatch.length * 100,
      totalPayout: 0
    }
  };

  for (const race of unorderedMatch) {
    const standardTop3 = race.predictions.standard.top3;

    // 3連単
    if (race.result.rank1 === standardTop3[0] &&
        race.result.rank2 === standardTop3[1] &&
        race.result.rank3 === standardTop3[2]) {
      unorderedMatchStats.trifecta.hits++;
      unorderedMatchStats.trifecta.totalPayout += getTrifectaPayout(race.result);
    }

    // 3連複
    const resultSet = [race.result.rank1, race.result.rank2, race.result.rank3].sort();
    const predictionSet = [...standardTop3].sort();
    if (arraysEqual(resultSet, predictionSet)) {
      unorderedMatchStats.trio.hits++;
      unorderedMatchStats.trio.totalPayout += getTrioPayout(race.result);
    }
  }

  // 不一致時の統計（参考）
  const noMatchStats = {
    total: noMatch.length,
    trifecta: {
      hits: 0,
      totalInvestment: noMatch.length * 100,
      totalPayout: 0
    },
    trio: {
      hits: 0,
      totalInvestment: noMatch.length * 100,
      totalPayout: 0
    }
  };

  for (const race of noMatch) {
    const standardTop3 = race.predictions.standard.top3;

    // 3連単
    if (race.result.rank1 === standardTop3[0] &&
        race.result.rank2 === standardTop3[1] &&
        race.result.rank3 === standardTop3[2]) {
      noMatchStats.trifecta.hits++;
      noMatchStats.trifecta.totalPayout += getTrifectaPayout(race.result);
    }

    // 3連複
    const resultSet = [race.result.rank1, race.result.rank2, race.result.rank3].sort();
    const predictionSet = [...standardTop3].sort();
    if (arraysEqual(resultSet, predictionSet)) {
      noMatchStats.trio.hits++;
      noMatchStats.trio.totalPayout += getTrioPayout(race.result);
    }
  }

  return {
    fullMatch: fullMatchStats,
    unorderedMatch: unorderedMatchStats,
    noMatch: noMatchStats
  };
}

// レポート生成
function generateReport(totalRaces, topPickAnalysis, top3Analysis, dateRange) {
  let report = '';

  report += '='.repeat(100) + '\n';
  report += 'スタンダードモデルと穴狙いモデルの予想一致度分析レポート\n';
  report += '='.repeat(100) + '\n\n';

  report += `分析対象レース数: ${totalRaces}\n`;
  report += `データ期間: ${dateRange.start} ～ ${dateRange.end}\n`;
  report += `（穴狙いモデルは12/19以降のみ存在）\n\n`;

  report += '-'.repeat(100) + '\n';
  report += '1. 本命（トップピック）の一致度分析\n';
  report += '-'.repeat(100) + '\n\n';

  const agreed = topPickAnalysis.agreed;
  const disagreed = topPickAnalysis.disagreed;

  report += `【一致度】\n`;
  report += `  一致: ${agreed.total}レース (${(agreed.total/totalRaces*100).toFixed(2)}%)\n`;
  report += `  不一致: ${disagreed.total}レース (${(disagreed.total/totalRaces*100).toFixed(2)}%)\n\n`;

  report += `【本命一致時の成績】\n`;
  report += `  単勝:\n`;
  report += `    的中率: ${(agreed.win.hits/agreed.total*100).toFixed(2)}% (${agreed.win.hits}/${agreed.total})\n`;
  report += `    回収率: ${(agreed.win.totalPayout/agreed.win.totalInvestment*100).toFixed(2)}%\n`;
  report += `    投資額: ${agreed.win.totalInvestment}円\n`;
  report += `    払戻額: ${agreed.win.totalPayout}円\n\n`;

  report += `  複勝:\n`;
  report += `    的中率: ${(agreed.place.hits/agreed.total*100).toFixed(2)}% (${agreed.place.hits}/${agreed.total})\n`;
  report += `    回収率: ${(agreed.place.totalPayout/agreed.place.totalInvestment*100).toFixed(2)}%\n`;
  report += `    投資額: ${agreed.place.totalInvestment}円\n`;
  report += `    払戻額: ${agreed.place.totalPayout}円\n\n`;

  report += `【本命不一致時の成績（参考：スタンダードモデル基準）】\n`;
  report += `  単勝:\n`;
  report += `    的中率: ${(disagreed.win.hits/disagreed.total*100).toFixed(2)}% (${disagreed.win.hits}/${disagreed.total})\n`;
  report += `    回収率: ${(disagreed.win.totalPayout/disagreed.win.totalInvestment*100).toFixed(2)}%\n\n`;

  report += `  複勝:\n`;
  report += `    的中率: ${(disagreed.place.hits/disagreed.total*100).toFixed(2)}% (${disagreed.place.hits}/${disagreed.total})\n`;
  report += `    回収率: ${(disagreed.place.totalPayout/disagreed.place.totalInvestment*100).toFixed(2)}%\n\n`;

  report += '-'.repeat(100) + '\n';
  report += '2. トップ3（1-2-3位予想）の一致度分析\n';
  report += '-'.repeat(100) + '\n\n';

  const fullMatch = top3Analysis.fullMatch;
  const unorderedMatch = top3Analysis.unorderedMatch;
  const noMatch = top3Analysis.noMatch;

  report += `【一致度】\n`;
  report += `  完全一致（順序も同じ）: ${fullMatch.total}レース (${(fullMatch.total/totalRaces*100).toFixed(2)}%)\n`;
  report += `  艇番号一致（順序違い）: ${unorderedMatch.total}レース (${(unorderedMatch.total/totalRaces*100).toFixed(2)}%)\n`;
  report += `  不一致: ${noMatch.total}レース (${(noMatch.total/totalRaces*100).toFixed(2)}%)\n\n`;

  if (fullMatch.total > 0) {
    report += `【トップ3完全一致時の成績】\n`;
    report += `  3連単:\n`;
    report += `    的中率: ${(fullMatch.trifecta.hits/fullMatch.total*100).toFixed(2)}% (${fullMatch.trifecta.hits}/${fullMatch.total})\n`;
    report += `    回収率: ${(fullMatch.trifecta.totalPayout/fullMatch.trifecta.totalInvestment*100).toFixed(2)}%\n`;
    report += `    投資額: ${fullMatch.trifecta.totalInvestment}円\n`;
    report += `    払戻額: ${fullMatch.trifecta.totalPayout}円\n\n`;

    report += `  3連複:\n`;
    report += `    的中率: ${(fullMatch.trio.hits/fullMatch.total*100).toFixed(2)}% (${fullMatch.trio.hits}/${fullMatch.total})\n`;
    report += `    回収率: ${(fullMatch.trio.totalPayout/fullMatch.trio.totalInvestment*100).toFixed(2)}%\n`;
    report += `    投資額: ${fullMatch.trio.totalInvestment}円\n`;
    report += `    払戻額: ${fullMatch.trio.totalPayout}円\n\n`;
  } else {
    report += `【トップ3完全一致時の成績】\n`;
    report += `  ※完全一致するレースが0件のため、統計なし\n\n`;
  }

  if (unorderedMatch.total > 0) {
    report += `【トップ3艇番号一致（順序違い）時の成績（参考：スタンダード基準）】\n`;
    report += `  3連単:\n`;
    report += `    的中率: ${(unorderedMatch.trifecta.hits/unorderedMatch.total*100).toFixed(2)}% (${unorderedMatch.trifecta.hits}/${unorderedMatch.total})\n`;
    report += `    回収率: ${(unorderedMatch.trifecta.totalPayout/unorderedMatch.trifecta.totalInvestment*100).toFixed(2)}%\n\n`;

    report += `  3連複:\n`;
    report += `    的中率: ${(unorderedMatch.trio.hits/unorderedMatch.total*100).toFixed(2)}% (${unorderedMatch.trio.hits}/${unorderedMatch.total})\n`;
    report += `    回収率: ${(unorderedMatch.trio.totalPayout/unorderedMatch.trio.totalInvestment*100).toFixed(2)}%\n\n`;
  }

  report += `【トップ3不一致時の成績（参考：スタンダード基準）】\n`;
  report += `  3連単:\n`;
  report += `    的中率: ${(noMatch.trifecta.hits/noMatch.total*100).toFixed(2)}% (${noMatch.trifecta.hits}/${noMatch.total})\n`;
  report += `    回収率: ${(noMatch.trifecta.totalPayout/noMatch.trifecta.totalInvestment*100).toFixed(2)}%\n\n`;

  report += `  3連複:\n`;
  report += `    的中率: ${(noMatch.trio.hits/noMatch.total*100).toFixed(2)}% (${noMatch.trio.hits}/${noMatch.total})\n`;
  report += `    回収率: ${(noMatch.trio.totalPayout/noMatch.trio.totalInvestment*100).toFixed(2)}%\n\n`;

  report += '-'.repeat(100) + '\n';
  report += '3. 重要な発見と考察\n';
  report += '-'.repeat(100) + '\n\n';

  // 本命一致時の効果
  const agreedWinRate = agreed.win.hits/agreed.total*100;
  const disagreedWinRate = disagreed.win.hits/disagreed.total*100;
  const winRateDiff = agreedWinRate - disagreedWinRate;

  report += `【本命一致の効果】\n\n`;
  report += `- 一致時の単勝的中率: ${agreedWinRate.toFixed(2)}%\n`;
  report += `- 不一致時の単勝的中率: ${disagreedWinRate.toFixed(2)}%\n`;
  report += `- 差: ${winRateDiff > 0 ? '+' : ''}${winRateDiff.toFixed(2)}%ポイント\n\n`;

  if (winRateDiff > 10) {
    report += `★ 本命一致時は的中率が大幅に向上（+${winRateDiff.toFixed(2)}%）\n`;
    report += `  → 両モデルが一致する本命は信頼性が高い\n\n`;
  } else if (winRateDiff > 5) {
    report += `○ 本命一致時は的中率が向上（+${winRateDiff.toFixed(2)}%）\n`;
    report += `  → 一致時の信頼性はやや高い\n\n`;
  } else if (winRateDiff > 0) {
    report += `△ 本命一致時は的中率が若干向上（+${winRateDiff.toFixed(2)}%）\n\n`;
  } else {
    report += `✗ 本命一致による的中率向上は見られない\n\n`;
  }

  // トップ3一致の効果
  if (fullMatch.total > 0) {
    const fullMatchTrifectaRate = fullMatch.trifecta.hits/fullMatch.total*100;
    const noMatchTrifectaRate = noMatch.trifecta.hits/noMatch.total*100;
    const trifectaDiff = fullMatchTrifectaRate - noMatchTrifectaRate;

    report += `【トップ3完全一致の効果】\n\n`;
    report += `- 一致時の3連単的中率: ${fullMatchTrifectaRate.toFixed(2)}%\n`;
    report += `- 不一致時の3連単的中率: ${noMatchTrifectaRate.toFixed(2)}%\n`;
    report += `- 差: ${trifectaDiff > 0 ? '+' : ''}${trifectaDiff.toFixed(2)}%ポイント\n\n`;

    if (trifectaDiff > 5) {
      report += `★ トップ3一致時は3連単的中率が大幅に向上\n`;
      report += `  → 両モデルが完全一致する予想は信頼性が高い\n\n`;
    } else if (trifectaDiff > 0) {
      report += `○ トップ3一致時は3連単的中率が向上\n\n`;
    } else {
      report += `△ トップ3一致による明確な効果は見られない\n\n`;
    }
  } else {
    report += `【トップ3完全一致の効果】\n\n`;
    report += `※完全一致するレースが${fullMatch.total}件のため、効果の検証ができません\n\n`;
  }

  report += `【推奨される活用方法】\n\n`;

  if (agreedWinRate > 40 && winRateDiff > 5) {
    report += `1. 本命一致時は信頼度が高いため、単勝・複勝での勝負を推奨\n`;
  }

  if (fullMatch.total > 0 && fullMatch.trifecta.hits/fullMatch.total > 0.05) {
    report += `2. トップ3完全一致時は3連単での勝負を検討\n`;
  }

  report += `3. 両モデルの一致度を予想の信頼性指標として活用可能\n`;

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

  console.log('穴狙いモデルがあるレースをフィルタ中...');
  const upsetRaces = filterUpsetFocusRaces(allRaces);
  console.log(`穴狙いモデル存在レース数: ${upsetRaces.length}\n`);

  if (upsetRaces.length === 0) {
    console.log('穴狙いモデルのデータがありません。');
    return;
  }

  // 日付範囲を取得
  const dates = upsetRaces.map(r => r.date).filter(d => d);
  const dateRange = {
    start: dates.length > 0 ? dates[0] : 'N/A',
    end: dates.length > 0 ? dates[dates.length - 1] : 'N/A'
  };

  console.log('本命一致度を分析中...');
  const topPickAnalysis = analyzeTopPickAgreement(upsetRaces);

  console.log('トップ3一致度を分析中...');
  const top3Analysis = analyzeTop3Agreement(upsetRaces);

  console.log('レポートを生成中...\n');
  const report = generateReport(upsetRaces.length, topPickAnalysis, top3Analysis, dateRange);

  console.log(report);

  // レポートをファイルに保存
  const reportPath = path.join(__dirname, 'model-agreement-analysis-report.txt');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\nレポートを ${reportPath} に保存しました。`);

  // JSON形式でも保存
  const jsonData = {
    generatedAt: new Date().toISOString(),
    totalRaces: upsetRaces.length,
    dateRange,
    topPickAnalysis,
    top3Analysis
  };

  const jsonPath = path.join(__dirname, 'model-agreement-analysis-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`データを ${jsonPath} に保存しました。`);
}

main();
