/**
 * 江戸川 深掘り分析スクリプト
 *
 * より細かい組み合わせ条件を探索
 */

import { supabase, isSupabaseEnabled } from '../lib/supabaseClient.js';

const VENUE_CODE = 3;
const VENUE_NAME = '江戸川';

// ===== カテゴリ関数 =====

function catWinRate(wr) {
  if (wr >= 7.0) return '7↑';
  if (wr >= 6.0) return '6台';
  if (wr >= 5.0) return '5台';
  return '5↓';
}

function catMotor(m) {
  if (m >= 45) return 'M45↑';
  if (m >= 40) return 'M40-44';
  if (m >= 35) return 'M35-39';
  return 'M35↓';
}

function catConf(c) {
  if (c >= 80) return '信80↑';
  if (c >= 70) return '信70-79';
  if (c >= 60) return '信60-69';
  return '信60↓';
}

function catLocalWinRate(lwr) {
  if (lwr >= 7.0) return '当地7↑';
  if (lwr >= 5.0) return '当地5-6';
  return '当地5↓';
}

function catRaceNo(rno) {
  if (rno <= 4) return '前半(1-4R)';
  if (rno <= 8) return '中盤(5-8R)';
  return '後半(9-12R)';
}

function catBoat2Rate(b2r) {
  if (b2r >= 40) return 'B40↑';
  if (b2r >= 30) return 'B30-39';
  return 'B30↓';
}

// ===== 統計計算 =====

function calcStats(data) {
  if (data.length === 0) return null;
  const total = data.length;
  const hits = data.filter(d => d.hit).length;
  const hitRate = hits / total;
  const payoutSum = data.reduce((a, d) => a + (d.payout || 0), 0);
  const recoveryRate = (payoutSum / (total * 100)) * 100;
  return {
    total,
    hits,
    hitRate: (hitRate * 100).toFixed(1),
    recoveryRate: recoveryRate.toFixed(1),
    profit: payoutSum - total * 100
  };
}

// ===== メイン =====

async function analyzeDeep() {
  if (!isSupabaseEnabled()) {
    console.error('❌ Supabase環境変数が未設定です');
    process.exit(1);
  }

  console.log('=' .repeat(70));
  console.log(`🔬 ${VENUE_NAME} 深掘り分析`);
  console.log('=' .repeat(70));

  const venueCodeStr = String(VENUE_CODE).padStart(2, '0');

  // データ取得
  const { data: predictions } = await supabase
    .from('predictions')
    .select('race_id, model_id, top_pick, top_2nd, top_3rd, confidence')
    .like('race_id', `%-${venueCodeStr}-%`)
    .eq('model_id', 'standard');

  const raceIds = [...new Set(predictions.map(p => p.race_id))];

  const { data: results } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  const { data: entries } = await supabase
    .from('race_entries')
    .select('race_id, boat_number, grade, win_rate, local_win_rate, motor_2rate, boat_2rate')
    .in('race_id', raceIds);

  // マップ化
  const resultsMap = {};
  results?.forEach(r => { resultsMap[r.race_id] = r; });

  const entriesMap = {};
  entries?.forEach(e => {
    if (!entriesMap[e.race_id]) entriesMap[e.race_id] = {};
    entriesMap[e.race_id][e.boat_number] = e;
  });

  console.log(`\n📊 データ: ${raceIds.length} レース\n`);

  // ===== 分析用データ構造 =====

  // 3号艇の詳細分析
  const boat3Analysis = {
    byConf: {},
    byMotor: {},
    byConfMotor: {},
    byOpponent1stGrade: {},
    byRaceNo: {},
    byLocalWinRate: {},
    byBoat2Rate: {},
    byConfOpponent: {}
  };

  // 2号艇の詳細分析
  const boat2Analysis = {
    byConf: {},
    byMotor: {},
    byConfMotor: {},
    byWinRate: {},
    byRaceNo: {}
  };

  // 1号艇の詳細分析（複勝用）
  const boat1PlaceAnalysis = {
    byConf: {},
    byMotor: {},
    by2ndBoatGrade: {},
    byRaceNo: {}
  };

  // 3-1予測の詳細分析
  const pred31Analysis = {
    byConf: {},
    by1stBoatGrade: {},
    by3rdBoatWinRate: {},
    byRaceNo: {}
  };

  // 1-3予測の詳細分析
  const pred13Analysis = {
    byConf: {},
    by3rdBoatGrade: {},
    byRaceNo: {}
  };

  // レース番号別（全体）
  const byRaceNoAll = {};

  // 敵の強さ分析
  const byOpponentStrength = {};

  // 複合条件
  const complexConditions = {};

  // ===== データ収集 =====

  for (const pred of predictions) {
    const result = resultsMap[pred.race_id];
    if (!result) continue;

    const raceEntries = entriesMap[pred.race_id] || {};
    const pickBoat = raceEntries[pred.top_pick];
    const boat1 = raceEntries[1];
    const boat2 = raceEntries[2];
    const boat3 = raceEntries[3];

    const conf = pred.confidence || 50;
    const raceNo = parseInt(pred.race_id.split('-')[4]);

    // 単勝判定
    const winHit = pred.top_pick === result.rank1;
    const winPayout = winHit ? result.payout_win : 0;

    // 複勝判定
    const placeHit = pred.top_pick === result.rank1 || pred.top_pick === result.rank2;
    let placePayout = 0;
    if (placeHit) {
      placePayout = pred.top_pick === result.rank1 ? result.payout_place_1 : result.payout_place_2;
    }

    // ===== 3号艇予測の詳細分析 =====
    if (pred.top_pick === 3) {
      const motor = pickBoat?.motor_2rate || 0;
      const localWr = pickBoat?.local_win_rate || 0;
      const boat2r = pickBoat?.boat_2rate || 0;
      const opp1stGrade = boat1?.grade || 'Unknown';

      // 信頼度別
      const keyConf = catConf(conf);
      if (!boat3Analysis.byConf[keyConf]) boat3Analysis.byConf[keyConf] = [];
      boat3Analysis.byConf[keyConf].push({ hit: winHit, payout: winPayout });

      // モーター別
      const keyMotor = catMotor(motor);
      if (!boat3Analysis.byMotor[keyMotor]) boat3Analysis.byMotor[keyMotor] = [];
      boat3Analysis.byMotor[keyMotor].push({ hit: winHit, payout: winPayout });

      // 信頼度×モーター
      const keyConfMotor = `${catConf(conf)}_${catMotor(motor)}`;
      if (!boat3Analysis.byConfMotor[keyConfMotor]) boat3Analysis.byConfMotor[keyConfMotor] = [];
      boat3Analysis.byConfMotor[keyConfMotor].push({ hit: winHit, payout: winPayout });

      // 1号艇の級別（敵の強さ）
      const keyOpp = `1号艇=${opp1stGrade}`;
      if (!boat3Analysis.byOpponent1stGrade[keyOpp]) boat3Analysis.byOpponent1stGrade[keyOpp] = [];
      boat3Analysis.byOpponent1stGrade[keyOpp].push({ hit: winHit, payout: winPayout });

      // レース番号別
      const keyRace = catRaceNo(raceNo);
      if (!boat3Analysis.byRaceNo[keyRace]) boat3Analysis.byRaceNo[keyRace] = [];
      boat3Analysis.byRaceNo[keyRace].push({ hit: winHit, payout: winPayout });

      // 当地勝率別
      const keyLocal = catLocalWinRate(localWr);
      if (!boat3Analysis.byLocalWinRate[keyLocal]) boat3Analysis.byLocalWinRate[keyLocal] = [];
      boat3Analysis.byLocalWinRate[keyLocal].push({ hit: winHit, payout: winPayout });

      // ボート2連率別
      const keyBoat = catBoat2Rate(boat2r);
      if (!boat3Analysis.byBoat2Rate[keyBoat]) boat3Analysis.byBoat2Rate[keyBoat] = [];
      boat3Analysis.byBoat2Rate[keyBoat].push({ hit: winHit, payout: winPayout });

      // 信頼度×敵の強さ
      const keyConfOpp = `${catConf(conf)}_1号艇=${opp1stGrade}`;
      if (!boat3Analysis.byConfOpponent[keyConfOpp]) boat3Analysis.byConfOpponent[keyConfOpp] = [];
      boat3Analysis.byConfOpponent[keyConfOpp].push({ hit: winHit, payout: winPayout });
    }

    // ===== 2号艇予測の詳細分析 =====
    if (pred.top_pick === 2) {
      const motor = pickBoat?.motor_2rate || 0;
      const winRate = pickBoat?.win_rate || 0;

      // 信頼度別
      const keyConf = catConf(conf);
      if (!boat2Analysis.byConf[keyConf]) boat2Analysis.byConf[keyConf] = [];
      boat2Analysis.byConf[keyConf].push({ hit: winHit, payout: winPayout });

      // モーター別
      const keyMotor = catMotor(motor);
      if (!boat2Analysis.byMotor[keyMotor]) boat2Analysis.byMotor[keyMotor] = [];
      boat2Analysis.byMotor[keyMotor].push({ hit: winHit, payout: winPayout });

      // 信頼度×モーター
      const keyConfMotor = `${catConf(conf)}_${catMotor(motor)}`;
      if (!boat2Analysis.byConfMotor[keyConfMotor]) boat2Analysis.byConfMotor[keyConfMotor] = [];
      boat2Analysis.byConfMotor[keyConfMotor].push({ hit: winHit, payout: winPayout });

      // 勝率別
      const keyWr = catWinRate(winRate);
      if (!boat2Analysis.byWinRate[keyWr]) boat2Analysis.byWinRate[keyWr] = [];
      boat2Analysis.byWinRate[keyWr].push({ hit: winHit, payout: winPayout });

      // レース番号別
      const keyRace = catRaceNo(raceNo);
      if (!boat2Analysis.byRaceNo[keyRace]) boat2Analysis.byRaceNo[keyRace] = [];
      boat2Analysis.byRaceNo[keyRace].push({ hit: winHit, payout: winPayout });
    }

    // ===== 1号艇予測（複勝）の詳細分析 =====
    if (pred.top_pick === 1) {
      const motor = pickBoat?.motor_2rate || 0;
      const opp2ndGrade = boat2?.grade || 'Unknown';

      // 信頼度別
      const keyConf = catConf(conf);
      if (!boat1PlaceAnalysis.byConf[keyConf]) boat1PlaceAnalysis.byConf[keyConf] = [];
      boat1PlaceAnalysis.byConf[keyConf].push({ hit: placeHit, payout: placePayout });

      // モーター別
      const keyMotor = catMotor(motor);
      if (!boat1PlaceAnalysis.byMotor[keyMotor]) boat1PlaceAnalysis.byMotor[keyMotor] = [];
      boat1PlaceAnalysis.byMotor[keyMotor].push({ hit: placeHit, payout: placePayout });

      // 2号艇の級別
      const key2nd = `2号艇=${opp2ndGrade}`;
      if (!boat1PlaceAnalysis.by2ndBoatGrade[key2nd]) boat1PlaceAnalysis.by2ndBoatGrade[key2nd] = [];
      boat1PlaceAnalysis.by2ndBoatGrade[key2nd].push({ hit: placeHit, payout: placePayout });

      // レース番号別
      const keyRace = catRaceNo(raceNo);
      if (!boat1PlaceAnalysis.byRaceNo[keyRace]) boat1PlaceAnalysis.byRaceNo[keyRace] = [];
      boat1PlaceAnalysis.byRaceNo[keyRace].push({ hit: placeHit, payout: placePayout });
    }

    // ===== 3-1予測の詳細分析 =====
    if (pred.top_pick === 3 && pred.top_2nd === 1) {
      const boat3Motor = boat3?.motor_2rate || 0;
      const opp1stGrade = boat1?.grade || 'Unknown';

      // 信頼度別
      const keyConf = catConf(conf);
      if (!pred31Analysis.byConf[keyConf]) pred31Analysis.byConf[keyConf] = [];
      pred31Analysis.byConf[keyConf].push({ hit: winHit, payout: winPayout });

      // 1号艇の級別
      const key1st = `1号艇=${opp1stGrade}`;
      if (!pred31Analysis.by1stBoatGrade[key1st]) pred31Analysis.by1stBoatGrade[key1st] = [];
      pred31Analysis.by1stBoatGrade[key1st].push({ hit: winHit, payout: winPayout });

      // レース番号別
      const keyRace = catRaceNo(raceNo);
      if (!pred31Analysis.byRaceNo[keyRace]) pred31Analysis.byRaceNo[keyRace] = [];
      pred31Analysis.byRaceNo[keyRace].push({ hit: winHit, payout: winPayout });
    }

    // ===== 1-3予測の詳細分析 =====
    if (pred.top_pick === 1 && pred.top_2nd === 3) {
      const opp3rdGrade = boat3?.grade || 'Unknown';

      // 信頼度別
      const keyConf = catConf(conf);
      if (!pred13Analysis.byConf[keyConf]) pred13Analysis.byConf[keyConf] = [];
      pred13Analysis.byConf[keyConf].push({ hit: winHit, payout: winPayout });

      // 3号艇の級別
      const key3rd = `3号艇=${opp3rdGrade}`;
      if (!pred13Analysis.by3rdBoatGrade[key3rd]) pred13Analysis.by3rdBoatGrade[key3rd] = [];
      pred13Analysis.by3rdBoatGrade[key3rd].push({ hit: winHit, payout: winPayout });

      // レース番号別
      const keyRace = catRaceNo(raceNo);
      if (!pred13Analysis.byRaceNo[keyRace]) pred13Analysis.byRaceNo[keyRace] = [];
      pred13Analysis.byRaceNo[keyRace].push({ hit: winHit, payout: winPayout });
    }

    // ===== レース番号別（全体） =====
    const keyRaceAll = catRaceNo(raceNo);
    if (!byRaceNoAll[keyRaceAll]) byRaceNoAll[keyRaceAll] = [];
    byRaceNoAll[keyRaceAll].push({ hit: winHit, payout: winPayout });

    // ===== 敵の強さ分析 =====
    // 1号艇がA1以外の時
    const opp1stGrade = boat1?.grade || 'Unknown';
    if (opp1stGrade !== 'A1') {
      const keyOppWeak = `1号艇≠A1_予測${pred.top_pick}号艇`;
      if (!byOpponentStrength[keyOppWeak]) byOpponentStrength[keyOppWeak] = [];
      byOpponentStrength[keyOppWeak].push({ hit: winHit, payout: winPayout });
    }

    // 1号艇がB級の時
    if (opp1stGrade === 'B1' || opp1stGrade === 'B2') {
      const keyOppB = `1号艇=B級_予測${pred.top_pick}号艇`;
      if (!byOpponentStrength[keyOppB]) byOpponentStrength[keyOppB] = [];
      byOpponentStrength[keyOppB].push({ hit: winHit, payout: winPayout });
    }

    // ===== 複合条件 =====
    // 3号艇 × 信頼度70-79 × 後半レース
    if (pred.top_pick === 3 && conf >= 70 && conf < 80 && raceNo >= 9) {
      const keyComplex = '3号艇_信頼度70-79_後半R';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }

    // 2号艇 × 信頼度70-79 × モーター35↓
    if (pred.top_pick === 2 && conf >= 70 && conf < 80 && (pickBoat?.motor_2rate || 0) < 35) {
      const keyComplex = '2号艇_信頼度70-79_M35↓';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }

    // 1号艇=B級 × 3号艇予測
    if (pred.top_pick === 3 && (opp1stGrade === 'B1' || opp1stGrade === 'B2')) {
      const keyComplex = '3号艇予測_1号艇B級';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }

    // 信頼度70-79 × 後半レース
    if (conf >= 70 && conf < 80 && raceNo >= 9) {
      const keyComplex = '信頼度70-79_後半R';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }

    // 3-1予測 × 信頼度70以上
    if (pred.top_pick === 3 && pred.top_2nd === 1 && conf >= 70) {
      const keyComplex = '3-1予測_信頼度70↑';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }

    // 1号艇≠A1 × 信頼度70-79
    if (opp1stGrade !== 'A1' && conf >= 70 && conf < 80) {
      const keyComplex = '1号艇≠A1_信頼度70-79';
      if (!complexConditions[keyComplex]) complexConditions[keyComplex] = [];
      complexConditions[keyComplex].push({ hit: winHit, payout: winPayout });
    }
  }

  // ===== 結果出力 =====

  function printAnalysis(title, dataMap, minSample = 5) {
    console.log(`\n【${title}】`);
    const results = [];
    for (const [key, data] of Object.entries(dataMap)) {
      if (data.length >= minSample) {
        const stats = calcStats(data);
        if (stats) results.push({ key, ...stats });
      }
    }
    results.sort((a, b) => parseFloat(b.recoveryRate) - parseFloat(a.recoveryRate));

    if (results.length === 0) {
      console.log('  データなし');
      return [];
    }

    for (const r of results) {
      const marker = parseFloat(r.recoveryRate) >= 100 ? '🔥' : '  ';
      console.log(`${marker} ${r.key.padEnd(30)} | ${r.total.toString().padStart(3)}R | 的中${r.hitRate.padStart(5)}% | 回収${r.recoveryRate.padStart(6)}% | ${r.profit >= 0 ? '+' : ''}${r.profit}円`);
    }

    return results.filter(r => parseFloat(r.recoveryRate) >= 100);
  }

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 3号艇予測の詳細分析（単勝）');
  console.log('─'.repeat(70));

  const p1 = printAnalysis('信頼度別', boat3Analysis.byConf);
  const p2 = printAnalysis('モーター別', boat3Analysis.byMotor);
  const p3 = printAnalysis('信頼度×モーター', boat3Analysis.byConfMotor);
  const p4 = printAnalysis('1号艇の級別（敵の強さ）', boat3Analysis.byOpponent1stGrade);
  const p5 = printAnalysis('レース番号別', boat3Analysis.byRaceNo);
  const p6 = printAnalysis('当地勝率別', boat3Analysis.byLocalWinRate);
  const p7 = printAnalysis('ボート2連率別', boat3Analysis.byBoat2Rate);
  const p8 = printAnalysis('信頼度×敵の強さ', boat3Analysis.byConfOpponent);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 2号艇予測の詳細分析（単勝）');
  console.log('─'.repeat(70));

  const p9 = printAnalysis('信頼度別', boat2Analysis.byConf);
  const p10 = printAnalysis('モーター別', boat2Analysis.byMotor);
  const p11 = printAnalysis('信頼度×モーター', boat2Analysis.byConfMotor);
  const p12 = printAnalysis('勝率別', boat2Analysis.byWinRate);
  const p13 = printAnalysis('レース番号別', boat2Analysis.byRaceNo);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 1号艇予測の詳細分析（複勝）');
  console.log('─'.repeat(70));

  const p14 = printAnalysis('信頼度別', boat1PlaceAnalysis.byConf);
  const p15 = printAnalysis('モーター別', boat1PlaceAnalysis.byMotor);
  const p16 = printAnalysis('2号艇の級別', boat1PlaceAnalysis.by2ndBoatGrade);
  const p17 = printAnalysis('レース番号別', boat1PlaceAnalysis.byRaceNo);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 3-1予測の詳細分析（単勝）');
  console.log('─'.repeat(70));

  const p18 = printAnalysis('信頼度別', pred31Analysis.byConf);
  const p19 = printAnalysis('1号艇の級別', pred31Analysis.by1stBoatGrade);
  const p20 = printAnalysis('レース番号別', pred31Analysis.byRaceNo);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 1-3予測の詳細分析（単勝）');
  console.log('─'.repeat(70));

  const p21 = printAnalysis('信頼度別', pred13Analysis.byConf);
  const p22 = printAnalysis('3号艇の級別', pred13Analysis.by3rdBoatGrade);
  const p23 = printAnalysis('レース番号別', pred13Analysis.byRaceNo);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 レース番号別（全体・単勝）');
  console.log('─'.repeat(70));

  const p24 = printAnalysis('全予測', byRaceNoAll);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 敵の強さ分析（単勝）');
  console.log('─'.repeat(70));

  const p25 = printAnalysis('1号艇の強さ別', byOpponentStrength);

  console.log('\n' + '─'.repeat(70));
  console.log('🔬 複合条件分析（単勝）');
  console.log('─'.repeat(70));

  const p26 = printAnalysis('複合条件', complexConditions);

  // ===== サマリー =====
  console.log('\n' + '=' .repeat(70));
  console.log('📊 深掘り分析サマリー');
  console.log('=' .repeat(70));

  const allProfitable = [
    ...p1.map(p => ({ ...p, cat: '3号艇/信頼度' })),
    ...p2.map(p => ({ ...p, cat: '3号艇/モーター' })),
    ...p3.map(p => ({ ...p, cat: '3号艇/信頼度×モーター' })),
    ...p4.map(p => ({ ...p, cat: '3号艇/敵の強さ' })),
    ...p5.map(p => ({ ...p, cat: '3号艇/レースNo' })),
    ...p6.map(p => ({ ...p, cat: '3号艇/当地勝率' })),
    ...p7.map(p => ({ ...p, cat: '3号艇/ボート2連率' })),
    ...p8.map(p => ({ ...p, cat: '3号艇/信頼度×敵' })),
    ...p9.map(p => ({ ...p, cat: '2号艇/信頼度' })),
    ...p10.map(p => ({ ...p, cat: '2号艇/モーター' })),
    ...p11.map(p => ({ ...p, cat: '2号艇/信頼度×モーター' })),
    ...p12.map(p => ({ ...p, cat: '2号艇/勝率' })),
    ...p13.map(p => ({ ...p, cat: '2号艇/レースNo' })),
    ...p14.map(p => ({ ...p, cat: '1号艇複勝/信頼度' })),
    ...p15.map(p => ({ ...p, cat: '1号艇複勝/モーター' })),
    ...p16.map(p => ({ ...p, cat: '1号艇複勝/2号艇' })),
    ...p17.map(p => ({ ...p, cat: '1号艇複勝/レースNo' })),
    ...p18.map(p => ({ ...p, cat: '3-1予測/信頼度' })),
    ...p19.map(p => ({ ...p, cat: '3-1予測/1号艇' })),
    ...p20.map(p => ({ ...p, cat: '3-1予測/レースNo' })),
    ...p21.map(p => ({ ...p, cat: '1-3予測/信頼度' })),
    ...p22.map(p => ({ ...p, cat: '1-3予測/3号艇' })),
    ...p23.map(p => ({ ...p, cat: '1-3予測/レースNo' })),
    ...p24.map(p => ({ ...p, cat: '全体/レースNo' })),
    ...p25.map(p => ({ ...p, cat: '敵の強さ' })),
    ...p26.map(p => ({ ...p, cat: '複合条件' })),
  ];

  allProfitable.sort((a, b) => parseFloat(b.recoveryRate) - parseFloat(a.recoveryRate));

  console.log('\n【回収率100%超え条件（サンプル数順）】');
  const sorted = [...allProfitable].sort((a, b) => b.total - a.total);
  for (const p of sorted.slice(0, 30)) {
    console.log(`  ${p.cat.padEnd(18)} | ${p.key.padEnd(25)} | ${p.total.toString().padStart(3)}R | 回収${p.recoveryRate}%`);
  }

  console.log('\n【高回収率条件（回収率順）】');
  for (const p of allProfitable.slice(0, 20)) {
    console.log(`  ${p.cat.padEnd(18)} | ${p.key.padEnd(25)} | ${p.total.toString().padStart(3)}R | 回収${p.recoveryRate}%`);
  }

  console.log('\n' + '=' .repeat(70));
  console.log('分析完了');
  console.log('=' .repeat(70));
}

analyzeDeep().catch(console.error);
