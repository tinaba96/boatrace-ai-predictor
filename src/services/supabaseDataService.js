/**
 * Supabase データサービス
 *
 * Supabaseからデータを取得し、既存のJSON形式に変換して返す
 */

import { supabase } from './supabaseClient';

/**
 * 会場コード→会場名のマッピング
 */
const VENUE_NAMES = {
  1: '桐生', 2: '戸田', 3: '江戸川', 4: '平和島', 5: '多摩川', 6: '浜名湖',
  7: '蒲郡', 8: '常滑', 9: '津', 10: '三国', 11: 'びわこ', 12: '住之江',
  13: '尼崎', 14: '鳴門', 15: '丸亀', 16: '児島', 17: '宮島', 18: '徳山',
  19: '下関', 20: '若松', 21: '芦屋', 22: '福岡', 23: '唐津', 24: '大村'
};

/**
 * Supabase データサービス
 */
export const supabaseDataService = {
  /**
   * レースデータを取得（races.json形式で返す）
   */
  async getRaces() {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { success: false, data: [], scrapedAt: null };
    }

    // 今日の日付
    const today = new Date().toISOString().split('T')[0];

    // 今日のレースを取得
    const { data: races, error: racesError } = await supabase
      .from('races')
      .select(`
        race_id,
        race_date,
        venue_code,
        race_number,
        start_time,
        race_entries (
          boat_number,
          player_name,
          grade,
          age,
          win_rate,
          local_win_rate,
          motor_number,
          motor_2rate,
          boat_number_id,
          boat_2rate
        )
      `)
      .eq('race_date', today)
      .order('venue_code')
      .order('race_number');

    if (racesError) {
      console.error('Supabase getRaces error:', racesError.message);
      return { success: false, data: [], scrapedAt: null };
    }

    // 会場ごとにグループ化
    const venueMap = new Map();

    for (const race of races) {
      const venueCode = race.venue_code;

      if (!venueMap.has(venueCode)) {
        venueMap.set(venueCode, {
          placeCd: venueCode,
          placeName: VENUE_NAMES[venueCode] || `会場${venueCode}`,
          races: []
        });
      }

      // レースデータを変換
      const raceData = {
        raceNo: race.race_number,
        startTime: race.start_time?.substring(0, 5) || '',
        date: race.race_date,
        placeCd: race.venue_code,
        racers: (race.race_entries || []).map(entry => ({
          waku: entry.boat_number,
          name: entry.player_name,
          rank: entry.grade,
          age: entry.age,
          winRate: entry.win_rate,
          localWinRate: entry.local_win_rate,
          motorNo: entry.motor_number,
          motor2Rate: entry.motor_2rate,
          boatNo: entry.boat_number_id,
          boat2Rate: entry.boat_2rate
        }))
      };

      venueMap.get(venueCode).races.push(raceData);
    }

    return {
      success: true,
      data: Array.from(venueMap.values()),
      scrapedAt: new Date().toISOString()
    };
  },

  /**
   * 予測データを取得（predictions/YYYY-MM-DD.json形式で返す）
   */
  async getPredictions(date) {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { date, generatedAt: null, updatedAt: null, races: [] };
    }

    // レースと予測と結果を取得
    const { data: races, error: racesError } = await supabase
      .from('races')
      .select(`
        race_id,
        race_date,
        venue_code,
        race_number,
        start_time,
        volatility_score,
        volatility_level,
        recommended_model,
        volatility_reasons,
        race_entries (
          boat_number,
          player_name,
          grade,
          age,
          win_rate,
          local_win_rate,
          motor_number,
          motor_2rate,
          boat_number_id,
          boat_2rate,
          ai_score_standard,
          ai_score_safe_bet,
          ai_score_upset_focus
        ),
        predictions (
          model_id,
          top_pick,
          top_2nd,
          top_3rd,
          confidence,
          is_hit_win,
          is_hit_place
        ),
        race_results (
          rank1,
          rank2,
          rank3,
          payout_win,
          payout_place_1,
          payout_place_2,
          payout_trifecta,
          payout_trio
        )
      `)
      .eq('race_date', date)
      .order('venue_code')
      .order('race_number');

    if (racesError) {
      console.error('Supabase getPredictions error:', racesError.message);
      return { date, generatedAt: null, updatedAt: null, races: [] };
    }

    // JSON形式に変換
    const transformedRaces = races.map(race => {
      const entries = race.race_entries || [];
      const predictions = race.predictions || [];
      const result = race.race_results?.[0] || race.race_results;

      // 予測データをモデル別に整理
      const standardPred = predictions.find(p => p.model_id === 'standard');
      const safeBetPred = predictions.find(p => p.model_id === 'safeBet');
      const upsetPred = predictions.find(p => p.model_id === 'upsetFocus');

      // players配列を作成
      const createPlayers = (pred, scoreField) => entries.map(e => ({
        number: e.boat_number,
        name: e.player_name,
        grade: e.grade,
        age: e.age,
        winRate: String(e.win_rate || ''),
        localWinRate: String(e.local_win_rate || ''),
        motorNumber: e.motor_number,
        motor2Rate: String(e.motor_2rate || ''),
        boatNumber: e.boat_number_id,
        boat2Rate: String(e.boat_2rate || ''),
        aiScore: e[scoreField] || 0
      }));

      const raceData = {
        raceId: race.race_id,
        venue: VENUE_NAMES[race.venue_code] || `会場${race.venue_code}`,
        venueCode: race.venue_code,
        raceNumber: race.race_number,
        startTime: race.start_time?.substring(0, 5) || '',
        volatility: race.volatility_score ? {
          score: race.volatility_score,
          level: race.volatility_level,
          recommendedModel: race.recommended_model,
          reasons: race.volatility_reasons || []
        } : null
      };

      // 予測データ（新形式: predictions）
      if (standardPred || safeBetPred || upsetPred) {
        raceData.predictions = {};

        if (standardPred) {
          raceData.predictions.standard = {
            topPick: standardPred.top_pick,
            top3: [standardPred.top_pick, standardPred.top_2nd, standardPred.top_3rd].filter(Boolean),
            confidence: Number(standardPred.confidence) || 0,
            players: createPlayers(standardPred, 'ai_score_standard')
          };
        }

        if (safeBetPred) {
          raceData.predictions.safeBet = {
            topPick: safeBetPred.top_pick,
            top3: [safeBetPred.top_pick, safeBetPred.top_2nd, safeBetPred.top_3rd].filter(Boolean),
            confidence: Number(safeBetPred.confidence) || 0,
            players: createPlayers(safeBetPred, 'ai_score_safe_bet')
          };
        }

        if (upsetPred) {
          raceData.predictions.upsetFocus = {
            topPick: upsetPred.top_pick,
            top3: [upsetPred.top_pick, upsetPred.top_2nd, upsetPred.top_3rd].filter(Boolean),
            confidence: Number(upsetPred.confidence) || 0,
            players: createPlayers(upsetPred, 'ai_score_upset_focus')
          };
        }
      }

      // 結果データ
      if (result && result.rank1) {
        // 3連複用のソート済みキー（順不同なのでソートが必要）
        const trifectaKey = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-');
        // 3連単用のキー（順序が重要なのでソートしない）
        const trioKey = `${result.rank1}-${result.rank2}-${result.rank3}`;

        raceData.result = {
          finished: true,
          rank1: result.rank1,
          rank2: result.rank2,
          rank3: result.rank3,
          payouts: {
            win: result.payout_win ? { [result.rank1]: result.payout_win } : {},
            place: {},
            trifecta: result.payout_trifecta ? { [trifectaKey]: result.payout_trifecta } : {},
            trio: result.payout_trio ? { [trioKey]: result.payout_trio } : {}
          }
        };

        if (result.payout_place_1) {
          raceData.result.payouts.place[result.rank1] = result.payout_place_1;
        }
        if (result.payout_place_2) {
          raceData.result.payouts.place[result.rank2] = result.payout_place_2;
        }

        // 的中情報
        if (standardPred) {
          raceData.accuracy = {
            standard: {
              isHitWin: standardPred.is_hit_win,
              isHitPlace: standardPred.is_hit_place
            }
          };
        }
      }

      return raceData;
    });

    return {
      date: date,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      races: transformedRaces
    };
  },

  /**
   * 精度統計データを取得（summary.json形式で返す）
   */
  async getAccuracy() {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { lastUpdated: null, models: {} };
    }

    // 今月の日付範囲を計算
    const now = new Date();
    const jstOffset = 9 * 60;
    const jstNow = new Date(now.getTime() + jstOffset * 60 * 1000);
    const thisYear = jstNow.getUTCFullYear();
    const thisMonth = jstNow.getUTCMonth() + 1;
    const thisMonthStart = `${thisYear}-${String(thisMonth).padStart(2, '0')}-01`;
    const thisMonthEnd = `${thisYear}-${String(thisMonth).padStart(2, '0')}-31`;

    // 過去30日の開始日を計算
    const thirtyDaysAgo = new Date(jstNow.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // モデル情報を取得
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('model_id, display_name, total_predictions, hit_rate_win, recovery_rate_win');

    if (modelsError) {
      console.error('Supabase getAccuracy error:', modelsError.message);
      return { lastUpdated: null, models: {} };
    }

    // ページネーション付きでデータを取得するヘルパー関数
    const fetchAllPredictions = async (startDate, endDate) => {
      let allData = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase
          .from('predictions')
          .select('race_id, model_id, is_hit_win, is_hit_place, is_hit_trifecta, is_hit_trio, payout_win, payout_place, payout_trifecta, payout_trio')
          .gte('race_id', startDate)
          .not('is_hit_win', 'is', null)
          .range(from, from + pageSize - 1);

        if (endDate) {
          query = query.lte('race_id', endDate);
        }

        const { data: page, error } = await query;

        if (error || !page || page.length === 0) break;
        allData = allData.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      return allData;
    };

    // 今月の予測データを取得（is_hit_winがセットされているもの = 結果が出ているもの）
    const thisMonthPredictions = await fetchAllPredictions(thisMonthStart, thisMonthEnd);

    // 過去7日分の日別データ取得
    const sevenDaysAgo = new Date(jstNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const recentPredictions = await fetchAllPredictions(sevenDaysAgoStr, null);

    // 全期間のデータを取得（会場別統計用）- 過去90日分
    const ninetyDaysAgo = new Date(jstNow.getTime() - 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
    const allPredictions = await fetchAllPredictions(ninetyDaysAgoStr, null);

    // race_idから日付を抽出するヘルパー関数
    const extractDate = (raceId) => raceId.substring(0, 10);

    // race_idから会場コードを抽出するヘルパー関数 (YYYY-MM-DD-VV-RR形式)
    const extractVenueCode = (raceId) => parseInt(raceId.substring(11, 13), 10);

    // 統計を計算する関数
    const calculateStats = (predictions) => {
      if (!predictions || predictions.length === 0) {
        return {
          totalRaces: 0,
          topPickHitRate: 0,
          topPickPlaceRate: 0,
          top3HitRate: 0,
          top3IncludedRate: 0,
          actualRecovery: {
            win: { recoveryRate: 0 },
            place: { recoveryRate: 0 },
            trifecta: { recoveryRate: 0 },
            trio: { recoveryRate: 0 }
          }
        };
      }

      const total = predictions.length;
      const winHits = predictions.filter(p => p.is_hit_win).length;
      const placeHits = predictions.filter(p => p.is_hit_place).length;
      const trifectaHits = predictions.filter(p => p.is_hit_trifecta).length;
      const trioHits = predictions.filter(p => p.is_hit_trio).length;

      const winPayout = predictions.reduce((sum, p) => sum + (p.payout_win || 0), 0);
      const placePayout = predictions.reduce((sum, p) => sum + (p.payout_place || 0), 0);
      const trifectaPayout = predictions.reduce((sum, p) => sum + (p.payout_trifecta || 0), 0);
      const trioPayout = predictions.reduce((sum, p) => sum + (p.payout_trio || 0), 0);

      return {
        totalRaces: total,
        topPickHitRate: winHits / total,
        topPickPlaceRate: placeHits / total,
        top3HitRate: trifectaHits / total,
        top3IncludedRate: trioHits / total,
        actualRecovery: {
          win: { recoveryRate: winPayout / (total * 100) },
          place: { recoveryRate: placePayout / (total * 100) },
          trifecta: { recoveryRate: trifectaPayout / (total * 100) },
          trio: { recoveryRate: trioPayout / (total * 100) }
        }
      };
    };

    // 日別履歴を計算する関数
    const calculateDailyHistory = (predictions, modelId) => {
      const modelPreds = predictions?.filter(p => p.model_id === modelId) || [];
      const dateMap = new Map();

      for (const pred of modelPreds) {
        const date = extractDate(pred.race_id);
        if (!dateMap.has(date)) {
          dateMap.set(date, []);
        }
        dateMap.get(date).push(pred);
      }

      return Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, preds]) => ({
          date,
          ...calculateStats(preds)
        }));
    };

    // 会場別統計を計算する関数
    const calculateByVenue = (predictions, modelId) => {
      const modelPreds = predictions?.filter(p => p.model_id === modelId) || [];
      const venueMap = new Map();

      for (const pred of modelPreds) {
        const venueCode = extractVenueCode(pred.race_id);
        if (!venueMap.has(venueCode)) {
          venueMap.set(venueCode, []);
        }
        venueMap.get(venueCode).push(pred);
      }

      const byVenue = {};
      for (const [venueCode, preds] of venueMap) {
        byVenue[venueCode] = {
          overall: calculateStats(preds)
        };
      }

      return byVenue;
    };

    // 各モデルの統計を構築
    const modelStats = {};
    const modelIds = ['standard', 'safeBet', 'upsetFocus'];

    for (const modelId of modelIds) {
      const modelInfo = models?.find(m => m.model_id === modelId);
      const thisMonthPreds = thisMonthPredictions?.filter(p => p.model_id === modelId) || [];
      const thisMonthStats = calculateStats(thisMonthPreds);
      const dailyHistory = calculateDailyHistory(recentPredictions, modelId);
      const byVenue = calculateByVenue(allPredictions, modelId);

      modelStats[modelId] = {
        overall: {
          totalRaces: modelInfo?.total_predictions || 0,
          finishedRaces: modelInfo?.total_predictions || 0,
          topPickHitRate: modelInfo?.hit_rate_win || 0,
          actualRecovery: {
            win: {
              recoveryRate: modelInfo?.recovery_rate_win || 0
            }
          }
        },
        thisMonth: {
          year: thisYear,
          month: thisMonth,
          ...thisMonthStats
        },
        dailyHistory,
        byVenue
      };
    }

    return {
      lastUpdated: new Date().toISOString(),
      models: modelStats
    };
  },

  /**
   * 予想データが存在する日付リストを取得
   * @param {number} days - 過去何日分を取得するか
   */
  async getAvailableDates(days = 90) {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    // 日付範囲を計算
    const today = new Date();
    const jstOffset = 9 * 60;
    const jstToday = new Date(today.getTime() + jstOffset * 60 * 1000);
    const startDate = new Date(jstToday.getTime() - days * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 日付ごとのレース数を取得
    const { data, error } = await supabase
      .from('races')
      .select('race_date')
      .gte('race_date', startDateStr)
      .order('race_date', { ascending: false });

    if (error) {
      console.error('Supabase getAvailableDates error:', error.message);
      return [];
    }

    // ユニークな日付を抽出
    const uniqueDates = [...new Set(data.map(r => r.race_date))];
    return uniqueDates;
  }
};
