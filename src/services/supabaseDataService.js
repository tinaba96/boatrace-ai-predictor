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
      throw new Error('Supabase client not initialized');
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
      throw new Error(`Supabase error: ${racesError.message}`);
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
      throw new Error('Supabase client not initialized');
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
      throw new Error(`Supabase error: ${racesError.message}`);
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
        raceData.result = {
          finished: true,
          rank1: result.rank1,
          rank2: result.rank2,
          rank3: result.rank3,
          payouts: {
            win: result.payout_win ? { [result.rank1]: result.payout_win } : {},
            place: {},
            trifecta: result.payout_trifecta ? { [`${result.rank1}-${result.rank2}-${result.rank3}`]: result.payout_trifecta } : {},
            trio: result.payout_trio ? { [`${result.rank1}-${result.rank2}-${result.rank3}`]: result.payout_trio } : {}
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
      throw new Error('Supabase client not initialized');
    }

    // モデル情報を取得
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('model_id, display_name, total_predictions, hit_rate_win, recovery_rate_win');

    if (modelsError) {
      throw new Error(`Supabase error: ${modelsError.message}`);
    }

    // v_prediction_performance ビューから統計を取得（もしあれば）
    // 現時点ではmodelsテーブルの情報で代替
    const modelStats = {};

    for (const model of models) {
      modelStats[model.model_id] = {
        overall: {
          totalRaces: model.total_predictions || 0,
          finishedRaces: model.total_predictions || 0,
          topPickHitRate: model.hit_rate_win || 0,
          actualRecovery: {
            win: {
              recoveryRate: model.recovery_rate_win || 0
            }
          }
        }
      };
    }

    return {
      lastUpdated: new Date().toISOString(),
      models: modelStats
    };
  }
};
