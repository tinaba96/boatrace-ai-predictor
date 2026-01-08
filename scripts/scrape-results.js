// Race Results Scraper
// Supabaseからレース一覧を取得し、結果をスクレイピングしてSupabaseに書き込む

import * as cheerio from 'cheerio';
import { supabase, isSupabaseEnabled, VENUE_NAMES } from './lib/supabaseClient.js';

// Get today's date in JST (YYYY-MM-DD format)
function getTodayDateJST() {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstDate.toISOString().split('T')[0];
}

// Convert date to YYYYMMDD format
function formatDateForUrl(dateStr) {
  return dateStr.replace(/-/g, '');
}

// Generate race result page URL
function getRaceResultUrl(venueCode, raceNo, dateStr) {
  const ymd = formatDateForUrl(dateStr);
  const jcd = String(venueCode).padStart(2, '0');
  return `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${raceNo}&jcd=${jcd}&hd=${ymd}`;
}

// Scrape payout data
function scrapePayouts($) {
  const payouts = {
    win: {},      // 単勝
    place: {},    // 複勝
    trifecta: {}, // 3連複
    trio: {}      // 3連単
  };

  try {
    // 払戻金テーブルを取得（.is-w495の3番目 = index 2）
    const allTables = $('.is-w495');

    const payoutTable = allTables.eq(2);

    if (payoutTable.length === 0) {
      return payouts;
    }

    let currentType = '';

    payoutTable.find('tbody tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const col0 = cells.eq(0).text().trim();
        const col1 = cells.eq(1).text().trim();
        const col2 = cells.length >= 3 ? cells.eq(2).text().trim() : '';

        // 券種が記載されている場合
        if (col0 && (col0 === '単勝' || col0 === '複勝' || col0 === '3連単' || col0 === '3連複' || col0 === '2連単' || col0 === '2連複' || col0 === '拡連複')) {
          currentType = col0;
        }

        // パターン1: col2に配当がある場合（通常）
        let payout = parseInt(col2.replace(/[^0-9]/g, ''));
        let combo = col1;

        // パターン2: col1に配当がある場合（複勝の2行目以降など）
        if ((isNaN(payout) || payout === 0) && col1.includes('¥')) {
          payout = parseInt(col1.replace(/[^0-9]/g, ''));
          combo = col0;
        }

        if (!isNaN(payout) && payout > 0 && combo) {
          // 組み合わせを正規化
          const normalizedCombo = combo
            .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[→－−ー=]/g, '-')
            .replace(/\s+/g, '');

          if (currentType === '単勝') {
            payouts.win[normalizedCombo] = payout;
          } else if (currentType === '複勝') {
            payouts.place[normalizedCombo] = payout;
          } else if (currentType === '3連複') {
            payouts.trifecta[normalizedCombo] = payout;
          } else if (currentType === '3連単') {
            payouts.trio[normalizedCombo] = payout;
          }
        }
      }
    });

  } catch (error) {
    console.error(`  Payout scraping error: ${error.message}`);
  }

  return payouts;
}

// Scrape race result
async function scrapeRaceResult(venueCode, raceNo, dateStr) {
  const url = getRaceResultUrl(venueCode, raceNo, dateStr);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BoatraceAIBot/1.0 (+https://github.com/rhapsody0919/boatrace-ai-predictor)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      }
    });

    if (!response.ok) {
      console.log(`  [HTTP ${response.status}]`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check if result table exists
    const resultTable = $('.is-w495');
    if (resultTable.length === 0) {
      console.log(`  Not published yet`);
      return null;
    }

    // Get top 3 boat numbers
    const rankings = [];
    $('.is-w495 tbody tr').each((index, row) => {
      if (index < 3) {
        const $row = $(row);
        const boatNumber = parseInt($row.find('td').eq(1).text().trim());
        if (boatNumber && !isNaN(boatNumber)) {
          rankings.push(boatNumber);
        }
      }
    });

    if (rankings.length < 3) {
      console.log(`  Incomplete data (got ${rankings.length} boats)`);
      return null;
    }

    // Get payout data
    const payouts = scrapePayouts($);

    return {
      rank1: rankings[0],
      rank2: rankings[1],
      rank3: rankings[2],
      payouts: payouts,
    };

  } catch (error) {
    console.error(`  Scraping error: ${error.message}`);
    return null;
  }
}

// Main function
async function scrapeResults(dateStr = null) {
  if (!isSupabaseEnabled()) {
    console.error('❌ Supabaseが設定されていません');
    process.exit(1);
  }

  const targetDate = dateStr || getTodayDateJST();
  console.log(`Starting race result scraping: ${targetDate}`);

  // Supabaseから対象日のレース一覧を取得（結果がないもの）
  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('race_id, venue_code, race_number')
    .eq('race_date', targetDate)
    .order('race_id');

  if (racesError) {
    console.error('❌ レース取得エラー:', racesError.message);
    process.exit(1);
  }

  if (!races || races.length === 0) {
    console.log('⚠️  対象日のレースがありません');
    process.exit(0);
  }

  // 既に結果があるレースを取得
  const { data: existingResults } = await supabase
    .from('race_results')
    .select('race_id, payout_win')
    .like('race_id', `${targetDate}%`);

  const finishedRaceIds = new Set(
    (existingResults || [])
      .filter(r => r.payout_win !== null)  // 配当データがあるもののみ
      .map(r => r.race_id)
  );

  console.log(`Fetching results for ${races.length} races (${finishedRaceIds.size} already finished)\n`);

  let updatedCount = 0;
  let alreadyFinishedCount = 0;
  let notYetCount = 0;
  const newResults = [];

  // Fetch results for each race
  for (const race of races) {
    const venueName = VENUE_NAMES[race.venue_code] || `会場${race.venue_code}`;
    const raceInfo = `${venueName} R${race.race_number}`;
    process.stdout.write(`${raceInfo.padEnd(20)} `);

    // Skip if already finished with payout data
    if (finishedRaceIds.has(race.race_id)) {
      console.log(`Already finished`);
      alreadyFinishedCount++;
      continue;
    }

    // Scrape result
    const result = await scrapeRaceResult(race.venue_code, race.race_number, targetDate);

    if (result) {
      console.log(`New result: ${result.rank1}-${result.rank2}-${result.rank3}`);

      const payouts = result.payouts || {};
      const winPayout = payouts.win ? Object.values(payouts.win)[0] : null;
      const placePayouts = payouts.place ? Object.entries(payouts.place) : [];
      const place1Payout = placePayouts.find(([k]) => k === String(result.rank1))?.[1] || null;
      const place2Payout = placePayouts.find(([k]) => k === String(result.rank2))?.[1] || null;
      const trioPayout = payouts.trio ? Object.values(payouts.trio)[0] : null;
      const trifectaPayout = payouts.trifecta ? Object.values(payouts.trifecta)[0] : null;

      newResults.push({
        race_id: race.race_id,
        rank1: result.rank1,
        rank2: result.rank2,
        rank3: result.rank3,
        payout_win: winPayout,
        payout_place_1: place1Payout,
        payout_place_2: place2Payout,
        payout_trifecta: trifectaPayout,
        payout_trio: trioPayout,
        result_at: new Date().toISOString()
      });
      updatedCount++;
    } else {
      console.log(`Not yet finished`);
      notYetCount++;
    }

    // Wait to avoid server overload
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nResults summary:`);
  console.log(`  - Newly fetched: ${updatedCount} races`);
  console.log(`  - Already finished: ${alreadyFinishedCount} races`);
  console.log(`  - Not yet finished: ${notYetCount} races`);

  // Supabaseに書き込み
  if (newResults.length > 0) {
    console.log(`\n📤 Supabaseに結果を書き込み中...`);

    const { error } = await supabase
      .from('race_results')
      .upsert(newResults, { onConflict: 'race_id' });

    if (error) {
      console.error('❌ race_results書き込みエラー:', error.message);
    } else {
      console.log(`  ✅ race_results: ${newResults.length}件（トリガーでpredictions.is_hit_win自動更新）`);
    }
  } else {
    console.log('\n📤 Supabase: 新規結果なし');
  }
}

// Get date from command line argument (optional)
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='));
const targetDate = dateArg ? dateArg.split('=')[1] : null;

// Execute script
scrapeResults(targetDate);
