const fs = require('fs');
const path = require('path');

// 予測データを読み込む
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

// 実際のコードと同じ判定ロジック（calculate-accuracy.jsから）
function checkTrioHitCorrect(prediction, result) {
  if (!prediction || !result || !prediction.top3) return false;

  // Top 3 hit (3-tanpuku: top 3 includes all podium finishers)
  return (
    prediction.top3.includes(result.rank1) &&
    prediction.top3.includes(result.rank2) &&
    prediction.top3.includes(result.rank3)
  );
}

// 私の間違ったロジック
function checkTrioHitWrong(prediction, result) {
  if (!prediction || !result || !prediction.top3) return false;

  const resultSet = [result.rank1, result.rank2, result.rank3].sort();
  const predictionSet = [...prediction.top3].sort();
  return resultSet.every((val, index) => val === predictionSet[index]);
}

// 検証
function main() {
  console.log('3連複的中判定ロジックの検証\n');

  const allRaces = loadAllPredictions();
  const finishedRaces = allRaces.filter(r => r.result && r.result.finished);

  console.log(`総レース数: ${finishedRaces.length}\n`);

  // スタンダードモデルで検証
  const racesWithStandard = finishedRaces.filter(r => r.predictions && r.predictions.standard);

  let correctHits = 0;
  let wrongHits = 0;

  const examples = [];

  for (const race of racesWithStandard) {
    const correct = checkTrioHitCorrect(race.predictions.standard, race.result);
    const wrong = checkTrioHitWrong(race.predictions.standard, race.result);

    if (correct) correctHits++;
    if (wrong) wrongHits++;

    // 結果が異なるケースをサンプルとして保存
    if (correct !== wrong && examples.length < 5) {
      examples.push({
        prediction: race.predictions.standard.top3,
        result: [race.result.rank1, race.result.rank2, race.result.rank3],
        correct,
        wrong
      });
    }
  }

  console.log('【正しいロジック（calculate-accuracy.jsと同じ）】');
  console.log(`  的中回数: ${correctHits}`);
  console.log(`  的中率: ${(correctHits / racesWithStandard.length * 100).toFixed(2)}%\n`);

  console.log('【私の間違ったロジック】');
  console.log(`  的中回数: ${wrongHits}`);
  console.log(`  的中率: ${(wrongHits / racesWithStandard.length * 100).toFixed(2)}%\n`);

  console.log('【差異】');
  console.log(`  差: ${Math.abs(correctHits - wrongHits)}回\n`);

  if (examples.length > 0) {
    console.log('【判定が異なるサンプル】');
    for (const ex of examples) {
      console.log(`  予想: [${ex.prediction}]`);
      console.log(`  結果: [${ex.result}]`);
      console.log(`  正しいロジック: ${ex.correct}`);
      console.log(`  間違ったロジック: ${ex.wrong}`);
      console.log('');
    }
  }

  // Summary.jsonと比較
  const summaryPath = path.join(__dirname, '../../data/predictions/summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const actualHits = summary.models.standard.overall.actualRecovery.trio.hitCount;

  console.log('【Summary.jsonとの比較】');
  console.log(`  Summary.jsonの3連複的中: ${actualHits}回`);
  console.log(`  正しいロジックの的中: ${correctHits}回`);
  console.log(`  一致: ${correctHits === actualHits ? 'はい' : 'いいえ'}`);
}

main();
