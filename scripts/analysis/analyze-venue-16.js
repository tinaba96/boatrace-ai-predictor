import { supabase } from '../lib/supabaseClient.js';

async function analyzeKojima() {
  const venueCode = '16';
  const venueName = '児島';

  // 1. 予測データ取得
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('race_id, model_id, top_pick, top_2nd, top_3rd, confidence')
    .like('race_id', `%-${venueCode}-%`);

  if (error) throw error;

  // 2. 結果データ取得
  const raceIds = [...new Set(predictions.map(p => p.race_id))];
  const { data: raceResults, error: resultsError } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  if (resultsError) throw resultsError;

  // マップ化
  const resultsMap = {};
  raceResults?.forEach(r => { resultsMap[r.race_id] = r; });

  // standardモデルのみで分析
  const standardPreds = predictions
    .filter(p => p.model_id === 'standard')
    .map(p => {
      const r = resultsMap[p.race_id];
      return {
        ...p,
        race_date: r?.race_date,
        race_number: r?.race_number,
        result_1st: r?.result_1st,
        result_2nd: r?.result_2nd,
        result_3rd: r?.result_3rd,
        win_odds: r?.win_odds,
        place_odds_1: r?.place_odds_1,
        place_odds_2: r?.place_odds_2,
        place_odds_3: r?.place_odds_3,
        trio_odds: r?.trio_odds
      };
    })
    .filter(p => p.race_date && p.race_date >= '2025-12-04')
    .sort((a, b) => a.race_date.localeCompare(b.race_date));

  console.log(`\n=== ${venueName}(${venueCode}) 詳細分析 ===`);
  console.log(`サンプル数: ${standardPreds.length}レース`);
  console.log(`期間: ${standardPreds[0]?.race_date} 〜 ${standardPreds[standardPreds.length-1]?.race_date}`);

  const conditions = [];

  for (const pred of standardPreds) {
    const top3 = [pred.top_pick, pred.top_2nd, pred.top_3rd];
    const conf = pred.confidence || 0;
    const raceNo = pred.race_number;
    const has1 = top3.includes(1);
    const has2 = top3.includes(2);
    const has3 = top3.includes(3);
    const has4 = top3.includes(4);
    const has5 = top3.includes(5);
    const has6 = top3.includes(6);

    conditions.push({
      ...pred,
      top3,
      conf,
      raceNo,
      has1, has2, has3, has4, has5, has6,
      isLate: raceNo >= 10,
    });
  }

  const patterns = [
    // 単勝パターン
    { name: '1号艇1着', betType: 'win', filter: p => p.top_pick === 1 },
    { name: '2号艇1着', betType: 'win', filter: p => p.top_pick === 2 },
    { name: '3号艇1着', betType: 'win', filter: p => p.top_pick === 3 },
    { name: '4号艇1着', betType: 'win', filter: p => p.top_pick === 4 },
    { name: '5号艇1着', betType: 'win', filter: p => p.top_pick === 5 },
    { name: '6号艇1着', betType: 'win', filter: p => p.top_pick === 6 },
    { name: '1号艇1着+2号艇含む', betType: 'win', filter: p => p.top_pick === 1 && p.has2 },
    { name: '1号艇1着+3号艇含む', betType: 'win', filter: p => p.top_pick === 1 && p.has3 },
    { name: '1号艇1着+4号艇含む', betType: 'win', filter: p => p.top_pick === 1 && p.has4 },
    { name: '2号艇1着+1号艇含む', betType: 'win', filter: p => p.top_pick === 2 && p.has1 },
    { name: '2号艇1着+3号艇含む', betType: 'win', filter: p => p.top_pick === 2 && p.has3 },
    { name: '2号艇1着+4号艇含む', betType: 'win', filter: p => p.top_pick === 2 && p.has4 },
    { name: '2号艇1着+5号艇含む', betType: 'win', filter: p => p.top_pick === 2 && p.has5 },
    { name: '3号艇1着+1号艇含む', betType: 'win', filter: p => p.top_pick === 3 && p.has1 },
    { name: '3号艇1着+2号艇含む', betType: 'win', filter: p => p.top_pick === 3 && p.has2 },
    { name: '3号艇1着+4号艇含む', betType: 'win', filter: p => p.top_pick === 3 && p.has4 },
    { name: '4号艇1着+1号艇含む', betType: 'win', filter: p => p.top_pick === 4 && p.has1 },
    { name: '4号艇1着+2号艇含む', betType: 'win', filter: p => p.top_pick === 4 && p.has2 },
    { name: '4号艇1着+3号艇含む', betType: 'win', filter: p => p.top_pick === 4 && p.has3 },
    { name: '5号艇1着+1号艇含む', betType: 'win', filter: p => p.top_pick === 5 && p.has1 },
    { name: '5号艇1着+2号艇含む', betType: 'win', filter: p => p.top_pick === 5 && p.has2 },
    { name: '5号艇1着+3号艇含む', betType: 'win', filter: p => p.top_pick === 5 && p.has3 },
    { name: '5号艇1着+4号艇含む', betType: 'win', filter: p => p.top_pick === 5 && p.has4 },
    { name: '6号艇1着+1号艇含む', betType: 'win', filter: p => p.top_pick === 6 && p.has1 },
    { name: '6号艇1着+2号艇含む', betType: 'win', filter: p => p.top_pick === 6 && p.has2 },
    { name: '1号艇1着×conf80+', betType: 'win', filter: p => p.top_pick === 1 && p.conf >= 80 },
    { name: '2号艇1着×conf80+', betType: 'win', filter: p => p.top_pick === 2 && p.conf >= 80 },
    { name: '3号艇1着×conf80+', betType: 'win', filter: p => p.top_pick === 3 && p.conf >= 80 },
    // 複勝パターン
    { name: '2号艇1着(複勝)', betType: 'place', filter: p => p.top_pick === 2 },
    { name: '3号艇1着(複勝)', betType: 'place', filter: p => p.top_pick === 3 },
    { name: '4号艇1着(複勝)', betType: 'place', filter: p => p.top_pick === 4 },
    { name: '5号艇1着(複勝)', betType: 'place', filter: p => p.top_pick === 5 },
    { name: '6号艇1着(複勝)', betType: 'place', filter: p => p.top_pick === 6 },
    { name: '4号艇1着+1号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 4 && p.has1 },
    { name: '4号艇1着+2号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 4 && p.has2 },
    { name: '4号艇1着+5号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 4 && p.has5 },
    { name: '5号艇1着+1号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 5 && p.has1 },
    { name: '5号艇1着+2号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 5 && p.has2 },
    { name: '5号艇1着+3号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 5 && p.has3 },
    { name: '5号艇1着+4号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 5 && p.has4 },
    { name: '6号艇1着+1号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 6 && p.has1 },
    { name: '6号艇1着+2号艇含む(複勝)', betType: 'place', filter: p => p.top_pick === 6 && p.has2 },
    { name: '2号艇1着×conf80+(複勝)', betType: 'place', filter: p => p.top_pick === 2 && p.conf >= 80 },
    { name: '3号艇1着×conf80+(複勝)', betType: 'place', filter: p => p.top_pick === 3 && p.conf >= 80 },
    { name: '4号艇1着×conf80+(複勝)', betType: 'place', filter: p => p.top_pick === 4 && p.conf >= 80 },
    // 3連複パターン
    { name: '1,2号艇含む', betType: 'trio', filter: p => p.has1 && p.has2 },
    { name: '1,3号艇含む', betType: 'trio', filter: p => p.has1 && p.has3 },
    { name: '1,4号艇含む', betType: 'trio', filter: p => p.has1 && p.has4 },
    { name: '1,5号艇含む', betType: 'trio', filter: p => p.has1 && p.has5 },
    { name: '1,6号艇含む', betType: 'trio', filter: p => p.has1 && p.has6 },
    { name: '2,3号艇含む', betType: 'trio', filter: p => p.has2 && p.has3 },
    { name: '2,4号艇含む', betType: 'trio', filter: p => p.has2 && p.has4 },
    { name: '2,5号艇含む', betType: 'trio', filter: p => p.has2 && p.has5 },
    { name: '2,6号艇含む', betType: 'trio', filter: p => p.has2 && p.has6 },
    { name: '3,4号艇含む', betType: 'trio', filter: p => p.has3 && p.has4 },
    { name: '3,5号艇含む', betType: 'trio', filter: p => p.has3 && p.has5 },
    { name: '3,6号艇含む', betType: 'trio', filter: p => p.has3 && p.has6 },
    { name: '4,5号艇含む', betType: 'trio', filter: p => p.has4 && p.has5 },
    { name: '4,6号艇含む', betType: 'trio', filter: p => p.has4 && p.has6 },
    { name: '5,6号艇含む', betType: 'trio', filter: p => p.has5 && p.has6 },
    { name: '1号艇含まない', betType: 'trio', filter: p => !p.has1 },
    { name: '1号艇含まない×conf80+', betType: 'trio', filter: p => !p.has1 && p.conf >= 80 },
    { name: '後半R(10R〜)', betType: 'trio', filter: p => p.isLate },
  ];

  const results = { win: [], place: [], trio: [] };

  for (const pattern of patterns) {
    const filtered = conditions.filter(pattern.filter);
    if (filtered.length < 10) continue;

    let totalBet = 0;
    let totalReturn = 0;
    let hits = 0;

    for (const p of filtered) {
      totalBet += 100;

      if (pattern.betType === 'win') {
        const isHit = p.result_1st === p.top_pick;
        if (isHit) {
          hits++;
          totalReturn += (p.win_odds || 0) * 100;
        }
      } else if (pattern.betType === 'place') {
        const topInTop3 = [p.result_1st, p.result_2nd, p.result_3rd].includes(p.top_pick);
        if (topInTop3) {
          hits++;
          const placeOdds = [p.place_odds_1, p.place_odds_2, p.place_odds_3];
          const idx = [p.result_1st, p.result_2nd, p.result_3rd].indexOf(p.top_pick);
          totalReturn += (placeOdds[idx] || 0) * 100;
        }
      } else if (pattern.betType === 'trio') {
        const predSet = new Set(p.top3);
        const resultSet = new Set([p.result_1st, p.result_2nd, p.result_3rd]);
        const isHit = [...predSet].every(x => resultSet.has(x));
        if (isHit) {
          hits++;
          totalReturn += (p.trio_odds || 0) * 100;
        }
      }
    }

    const recovery = totalBet > 0 ? Math.round(totalReturn / totalBet * 100) : 0;
    const hitRate = (hits / filtered.length * 100).toFixed(1);

    if (recovery >= 100 && filtered.length >= 10) {
      results[pattern.betType].push({
        name: pattern.name,
        samples: filtered.length,
        hits,
        hitRate,
        recovery
      });
    }
  }

  console.log('\n### 単勝ルール（回収率100%↑）');
  results.win.sort((a, b) => b.recovery - a.recovery).slice(0, 10).forEach(r => {
    console.log(`  ${r.name}: ${r.recovery}% (${r.samples}R, 的中${r.hitRate}%)`);
  });

  console.log('\n### 複勝ルール（回収率100%↑）');
  results.place.sort((a, b) => b.recovery - a.recovery).slice(0, 10).forEach(r => {
    console.log(`  ${r.name}: ${r.recovery}% (${r.samples}R, 的中${r.hitRate}%)`);
  });

  console.log('\n### 3連複ルール（回収率100%↑）');
  results.trio.sort((a, b) => b.recovery - a.recovery).slice(0, 10).forEach(r => {
    console.log(`  ${r.name}: ${r.recovery}% (${r.samples}R, 的中${r.hitRate}%)`);
  });
}

analyzeKojima().catch(console.error);
