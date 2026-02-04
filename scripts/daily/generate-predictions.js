// AI予想生成スクリプト
// data/races.json を読み込んで、data/predictions/YYYY-MM-DD.json を生成
// Supabaseにも同時書き込み（デュアルライト）

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseEnabled, VENUE_CODES } from '../lib/supabaseClient.js';
import { getTodayDateJST } from '../lib/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 風向の度数（16方位）をテキストに変換
function convertWindDirection(direction) {
    const directions16 = [
        null, '北', '北北東', '北東', '東北東', '東', '東南東', '南東',
        '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'
    ];
    if (direction == null || direction === 0 || direction < 0 || direction > 16) {
        return null;
    }
    return directions16[direction];
}

// 標準偏差を計算
function calculateStdDev(values) {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

// 荒れ度スコアを計算（0-100、高いほど荒れやすい）
// reasonsを含むオブジェクトを返す
function calculateVolatilityScore(racers, placeCd) {
    if (!racers || racers.length < 6) {
        return {
            score: 50,
            reasons: ['選手データが不足しています']
        };
    }

    let volatility = 0;
    const reasons = [];

    // 1. 実力差の小ささ（最重要）- 拮抗しているほど荒れる
    const winRates = racers.map(r => r.globalWinRate);
    const winRateStdDev = calculateStdDev(winRates);
    const avgWinRate = winRates.reduce((sum, rate) => sum + rate, 0) / winRates.length;
    const powerBalanceScore = Math.max(0, (1.5 - winRateStdDev) * 20);

    if (powerBalanceScore > 10) {
        volatility += powerBalanceScore;
        reasons.push(`選手間の実力差が小さい（勝率の標準偏差: ${winRateStdDev.toFixed(2)}%、平均: ${avgWinRate.toFixed(1)}%）`);
    }

    // 2. 1号艇の強さ（逆相関）- 1号艇が弱いほど荒れる
    const lane1 = racers[0];
    let lane1Weakness = 0;
    const lane1Factors = [];

    if (lane1.grade !== 'A1') {
        lane1Weakness += 20;
        lane1Factors.push(`グレード: ${lane1.grade}`);
    }
    if (lane1.globalWinRate < 6.0) {
        lane1Weakness += 15;
        lane1Factors.push(`勝率: ${lane1.globalWinRate.toFixed(1)}%`);
    }
    if (lane1.globalWinRate < 5.5) {
        lane1Weakness += 10;
    }

    if (lane1Weakness > 0) {
        volatility += lane1Weakness;
        const avgWinRate = winRates.reduce((sum, r) => sum + r, 0) / winRates.length;
        const diff = ((avgWinRate - lane1.globalWinRate) / avgWinRate * 100).toFixed(0);
        reasons.push(`1号艇が平均より${diff}%弱い（${lane1Factors.join('、')}）`);
    }

    // 3. モーター性能の均等さ - 均等なほど荒れる
    const motorRates = racers.map(r => r.motor2Rate);
    const motorStdDev = calculateStdDev(motorRates);
    const motorBalanceScore = Math.max(0, (15 - motorStdDev) * 1.5);

    if (motorBalanceScore > 5 && motorStdDev < 12) {
        volatility += motorBalanceScore;
        reasons.push(`モーター性能が均等（2連率の標準偏差: ${motorStdDev.toFixed(1)}%）`);
    }

    // 4. 外枠の好機材 - 外枠に良いモーターがあると荒れる
    const outsideGoodMotors = racers.slice(3).filter(r => r.motor2Rate > 40).length;
    if (outsideGoodMotors > 0) {
        volatility += outsideGoodMotors * 8;
        const motorNumbers = racers.slice(3)
            .map((r, index) => ({ ...r, boatNumber: index + 4 }))
            .filter(r => r.motor2Rate > 40)
            .map(r => `${r.boatNumber}号艇(${r.motor2Rate.toFixed(1)}%)`)
            .join('、');
        reasons.push(`外枠に好機材が${outsideGoodMotors}艇（${motorNumbers}）`);
    }

    // 5. ボートレース場特性（荒れやすい場）
    // 戸田(02)、江戸川(03)、平和島(04)は荒れやすい
    const roughVenues = {
        '02': '戸田',
        '03': '江戸川',
        '04': '平和島'
    };
    const venueCode = String(placeCd).padStart(2, '0');
    if (roughVenues[venueCode]) {
        volatility += 12;
        reasons.push(`${roughVenues[venueCode]}は荒れやすいボートレース場`);
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(volatility)));

    // スコアに応じた総評を追加
    if (reasons.length === 0) {
        if (finalScore < 35) {
            reasons.push('1号艇が安定して有利な展開');
        } else {
            reasons.push('標準的なレース展開');
        }
    }

    return {
        score: finalScore,
        reasons: reasons
    };
}

// 荒れ度レベルを判定
function getVolatilityLevel(score) {
    if (score < 35) return 'low';    // 堅い
    if (score < 65) return 'medium'; // 標準
    return 'high';                    // 荒れる
}

// 推奨モデルを判定
function getRecommendedModel(score) {
    if (score < 35) return 'safe-bet';      // 本命狙い
    if (score < 65) return 'standard';      // スタンダード
    return 'upset-focus';                   // 穴狙い
}

// スタンダード版AIスコア（従来のロジック）
function calculateStandardScore(racer, index) {
    return Math.floor(
        racer.globalWinRate * 100 +
        racer.local2Rate * 50 +
        racer.motor2Rate * 30 +
        racer.boat2Rate * 20 -
        index * 5
    );
}

// スタンダードv2版AIスコア（統計的に最適化）
// 統計分析（2,172レース）に基づく係数:
// - 枠番の影響: 22倍差（最重要）
// - 全国勝率の影響: 10倍差（非常に重要）
// - 級別の影響: 5倍差（重要）
// - モーター性能: 5.2%差（限定的）
// - 当地成績: 3.7%差（限定的）
function calculateStandardScoreV2(racer, index) {
    let score = 0;

    // 全国勝率（最重要: 10倍の差がある）
    score += racer.globalWinRate * 150;

    // 級別ボーナス（非常に重要: A1はB2の5倍勝ちやすい）
    if (racer.grade === 'A1') score += 400;
    else if (racer.grade === 'A2') score += 250;
    else if (racer.grade === 'B1') score += 100;
    else if (racer.grade === 'B2') score += 0;

    // 枠番補正（圧倒的に重要: 1号艇は6号艇の22倍勝ちやすい）
    if (index === 0) score += 500;      // 1号艇
    else if (index === 1) score += 100; // 2号艇
    else if (index === 2) score += 0;   // 3号艇
    else if (index === 3) score -= 50;  // 4号艇
    else if (index === 4) score -= 100; // 5号艇
    else if (index === 5) score -= 150; // 6号艇

    // モーター性能（限定的: 5.2%の差）
    score += racer.motor2Rate * 20;

    // ボート性能（限定的: データ不足）
    score += racer.boat2Rate * 10;

    // 当地アドバンテージ（限定的: 3.7%の差）
    const localAdvantage = racer.localWinRate - racer.globalWinRate;
    score += localAdvantage * 10;

    return Math.floor(score);
}

// 本命狙い版スコア（堅実型）
function calculateSafeBetScore(racer, index) {
    let score = 0;

    // 1号艇に大きなボーナス
    if (index === 0) score += 150;

    // A1級に大きなボーナス
    if (racer.grade === 'A1') score += 120;
    else if (racer.grade === 'A2') score += 60;

    // 全国勝率を重視
    score += racer.globalWinRate * 130;

    // 当地勝率
    score += racer.localWinRate * 80;

    // モーター性能（やや控えめ）
    score += racer.motor2Rate * 40;

    // レーン位置ペナルティ（強め）
    score -= index * 15;

    return Math.floor(score);
}

// 穴狙い版スコア（高配当型）
function calculateUpsetFocusScore(racer, index) {
    let score = 0;

    // 外枠の逆転要素を重視
    if (index >= 3) score += 100; // 4-6号艇にボーナス

    // モーター性能を最重視（機材で逆転）
    score += racer.motor2Rate * 180;

    // ボート性能
    score += racer.boat2Rate * 80;

    // 当地適性（地元の利）
    score += racer.localWinRate * 100;
    score += racer.local2Rate * 60;

    // 全国勝率（やや控えめ）
    score += racer.globalWinRate * 50;

    // 1号艇へのペナルティ（逆張り）
    if (index === 0) score -= 100;

    return Math.floor(score);
}

// 選手データを処理（特定のスコア計算関数を使用）
function processRacersWithScoreFn(racers, scoreFn) {
    if (!racers || racers.length === 0) {
        console.warn('⚠️  選手データが空です');
        return [];
    }

    const players = racers.map((racer, idx) => ({
        number: racer.lane,
        name: racer.name,
        grade: racer.grade,
        age: racer.age,
        winRate: racer.globalWinRate.toFixed(3),
        localWinRate: racer.localWinRate.toFixed(3),
        global2Rate: racer.global2Rate?.toFixed(1) || null,
        local2Rate: racer.local2Rate?.toFixed(1) || null,
        motorNumber: racer.motorNumber,
        motor2Rate: racer.motor2Rate.toFixed(1),
        boatNumber: racer.boatNumber,
        boat2Rate: racer.boat2Rate.toFixed(1),
        aiScore: scoreFn(racer, idx),
    }));

    // AIスコア順にソート
    return players.sort((a, b) => b.aiScore - a.aiScore);
}

// 後方互換性のため（従来のprocessRacers）
function processRacers(racers) {
    return processRacersWithScoreFn(racers, calculateStandardScoreV2);
}

// 本命選手の選定理由を生成
function generateTopPickReasoning(topPickPlayer, players, modelType) {
    const reasons = [];
    const number = topPickPlayer.number;
    const winRate = parseFloat(topPickPlayer.winRate);
    const localWinRate = parseFloat(topPickPlayer.localWinRate);
    const motor2Rate = parseFloat(topPickPlayer.motor2Rate);

    if (modelType === 'standard') {
        // スタンダード：バランス重視
        reasons.push(`${number}号艇 ${topPickPlayer.name}選手を本命に選定`);

        const strengths = [];
        if (winRate >= 6.5) {
            strengths.push(`全国勝率${topPickPlayer.winRate}の実力者`);
        }
        if (localWinRate >= 5.5) {
            strengths.push(`当地成績${topPickPlayer.localWinRate}と好相性`);
        }
        if (motor2Rate >= 35) {
            strengths.push(`モーター2連率${topPickPlayer.motor2Rate}%の${motor2Rate >= 40 ? '好' : '安定'}機材`);
        }

        if (strengths.length > 0) {
            reasons.push(strengths.join('、') + 'で総合評価が最高');
        } else {
            reasons.push('総合的なデータ分析により最高評価を獲得');
        }

    } else if (modelType === 'safe-bet') {
        // 本命狙い：安全性重視
        reasons.push(`${number}号艇 ${topPickPlayer.name}選手を本命に選定`);

        const strengths = [];
        if (number === 1) {
            strengths.push('1号艇の有利なコース取り');
        }
        if (topPickPlayer.grade === 'A1') {
            strengths.push('A1級選手として安定した実力');
        } else if (topPickPlayer.grade === 'A2') {
            strengths.push('A2級選手として堅実な実績');
        }
        if (winRate >= 6.0) {
            strengths.push(`全国勝率${topPickPlayer.winRate}の高い実力`);
        }

        if (strengths.length > 0) {
            reasons.push(strengths.join('、') + 'により的中率が期待できる');
        } else {
            reasons.push('安全性を重視した評価で最高スコアを獲得');
        }

    } else if (modelType === 'upset-focus') {
        // 穴狙い：高配当重視
        reasons.push(`${number}号艇 ${topPickPlayer.name}選手を本命に選定`);

        const strengths = [];
        if (number >= 4 && motor2Rate >= 38) {
            strengths.push(`${number}号艇ながらモーター2連率${topPickPlayer.motor2Rate}%の好機材`);
        }
        if (localWinRate >= 5.5) {
            strengths.push(`当地成績${topPickPlayer.localWinRate}で展開に期待`);
        }
        if (motor2Rate >= 40) {
            strengths.push('好モーターを活かした高配当の可能性');
        }

        if (strengths.length > 0) {
            reasons.push(strengths.join('、'));
        } else {
            reasons.push('展開の妙と機材性能を重視した評価で最高スコア');
        }
    }

    return reasons;
}

// 統計的な注目ポイントを生成（参考情報）
function generateStatisticalInsights(players) {
    const insights = [];

    // モーター2率が40%以上の選手
    const goodMotors = players.filter(p => parseFloat(p.motor2Rate) > 40);
    if (goodMotors.length > 0) {
        const motorList = goodMotors.map(p =>
            `${p.number}号艇（${p.motor2Rate}%）`
        ).join('、');
        insights.push(
            `好モーター: ${motorList}`
        );
    }

    // 全国勝率が7.0以上の選手
    const topRacers = players.filter(p => parseFloat(p.winRate) >= 7.0);
    if (topRacers.length > 0) {
        const racerList = topRacers.map(p =>
            `${p.number}号艇（勝率${p.winRate}）`
        ).join('、');
        insights.push(
            `実力者: ${racerList}`
        );
    }

    return insights;
}

// レースIDを生成
function generateRaceId(date, placeCd, raceNo) {
    return `${date}-${String(placeCd).padStart(2, '0')}-${String(raceNo).padStart(2, '0')}`;
}

// 信頼度を計算（トップピックのAIスコアと2位のAIスコアの差から算出）
function calculateConfidence(players) {
    if (players.length < 2) return 70;

    const scoreDiff = players[0].aiScore - players[1].aiScore;
    // スコア差が大きいほど信頼度が高い（70-95%の範囲）
    const confidence = Math.min(95, Math.max(70, 70 + Math.floor(scoreDiff / 10)));
    return confidence;
}

// 1レース分の予想を生成（3モデル対応）
function generateRacePrediction(race, date) {
    if (!race.racers || race.racers.length === 0) {
        console.warn(`⚠️  レース ${race.placeCd}-${race.raceNo} の選手データが不足しています`);
        return null;
    }

    // 荒れ度スコアを計算
    const volatilityData = calculateVolatilityScore(race.racers, race.placeCd);
    const volatilityLevel = getVolatilityLevel(volatilityData.score);
    const recommendedModel = getRecommendedModel(volatilityData.score);

    // 3つのモデルで予想を生成
    const standardPlayers = processRacersWithScoreFn(race.racers, calculateStandardScoreV2);
    const safeBetPlayers = processRacersWithScoreFn(race.racers, calculateSafeBetScore);
    const upsetFocusPlayers = processRacersWithScoreFn(race.racers, calculateUpsetFocusScore);

    if (standardPlayers.length === 0) {
        console.warn(`⚠️  レース ${race.placeCd}-${race.raceNo} の選手データが不足しています`);
        return null;
    }

    // スタンダード版の予想
    const standardTop3 = standardPlayers.slice(0, 3).map(p => p.number);
    const standardConfidence = calculateConfidence(standardPlayers);
    const standardReasoning = generateTopPickReasoning(standardPlayers[0], standardPlayers, 'standard');

    // 本命狙い版の予想
    const safeBetTop3 = safeBetPlayers.slice(0, 3).map(p => p.number);
    const safeBetConfidence = calculateConfidence(safeBetPlayers);
    const safeBetReasoning = generateTopPickReasoning(safeBetPlayers[0], safeBetPlayers, 'safe-bet');

    // 穴狙い版の予想
    const upsetFocusTop3 = upsetFocusPlayers.slice(0, 3).map(p => p.number);
    const upsetFocusConfidence = calculateConfidence(upsetFocusPlayers);
    const upsetFocusReasoning = generateTopPickReasoning(upsetFocusPlayers[0], upsetFocusPlayers, 'upset-focus');

    return {
        raceId: generateRaceId(date, race.placeCd, race.raceNo),
        venue: race.placeName,
        venueCode: race.placeCd,
        raceNumber: race.raceNo,
        startTime: race.startTime || '未定',

        // 天候情報（race_conditionsテーブル用）
        conditions: {
            weather: race.weather || null,
            airTemp: race.airTemp ?? null,
            windDirection: race.windDirection ?? null,
            windVelocity: race.windVelocity ?? null,
            waterTemp: race.waterTemp ?? null,
            waveHeight: race.waveHeight ?? null,
            raceGrade: race.raceGrade || null,
            raceTitle: race.raceTitle || null,
        },

        // 荒れ度情報
        volatility: {
            score: volatilityData.score,
            level: volatilityLevel,
            recommendedModel: recommendedModel,
            reasons: volatilityData.reasons,
        },

        // 3モデルの予想
        predictions: {
            standard: {
                topPick: standardPlayers[0].number,
                top3: standardTop3,
                confidence: standardConfidence,
                players: standardPlayers,
                reasoning: standardReasoning,
            },
            safeBet: {
                topPick: safeBetPlayers[0].number,
                top3: safeBetTop3,
                confidence: safeBetConfidence,
                players: safeBetPlayers,
                reasoning: safeBetReasoning,
            },
            upsetFocus: {
                topPick: upsetFocusPlayers[0].number,
                top3: upsetFocusTop3,
                confidence: upsetFocusConfidence,
                players: upsetFocusPlayers,
                reasoning: upsetFocusReasoning,
            },
        },

        // 後方互換性のため（既存のpredictionフィールドを維持）
        prediction: {
            topPick: standardPlayers[0].number,
            top3: standardTop3,
            confidence: standardConfidence,
            players: standardPlayers,
            reasoning: standardReasoning,
        },

        result: {
            finished: false,
            rank1: null,
            rank2: null,
            rank3: null,
            updatedAt: null,
        },
        accuracy: {
            topPickHit: null,
            top3Hit: null,
            top3Included: null,
        },
    };
}

// Supabaseにデータを書き込む関数
async function writeToSupabase(allPredictions, date) {
    if (!isSupabaseEnabled()) {
        console.log('⚠️  Supabase未設定のため、DB書き込みをスキップします');
        return;
    }

    console.log('\n📤 Supabaseにデータを書き込み中...');

    try {
        // 1. racesテーブルにupsert
        const racesData = allPredictions.map(race => {
            // 選手データから統計を計算
            const players = race.predictions.standard.players;
            const winRates = players.map(p => parseFloat(p.winRate));
            const motorRates = players.map(p => parseFloat(p.motor2Rate));
            const firstPlayer = players.find(p => p.number === 1);

            return {
                race_id: race.raceId,
                race_date: date,
                venue_code: race.venueCode,
                race_number: race.raceNumber,
                start_time: race.startTime !== '未定' ? race.startTime + ':00' : null,
                volatility_score: race.volatility.score,
                volatility_level: race.volatility.level,
                recommended_model: race.volatility.recommendedModel,
                volatility_reasons: race.volatility.reasons,
                first_boat_grade: firstPlayer?.grade || null,
                first_boat_win_rate: firstPlayer ? parseFloat(firstPlayer.winRate) : null,
                first_boat_motor_2rate: firstPlayer ? parseFloat(firstPlayer.motor2Rate) : null,
                win_rate_stddev: calculateStdDev(winRates),
                win_rate_avg: winRates.reduce((a, b) => a + b, 0) / winRates.length,
                motor_2rate_stddev: calculateStdDev(motorRates),
                updated_at: new Date().toISOString()
            };
        });

        const { error: racesError } = await supabase
            .from('races')
            .upsert(racesData, { onConflict: 'race_id' });

        if (racesError) {
            console.error('❌ races書き込みエラー:', racesError.message);
        } else {
            console.log(`  ✅ races: ${racesData.length}件`);
        }

        // 2. race_entriesテーブルにupsert
        const entriesData = [];
        for (const race of allPredictions) {
            const standardPlayers = race.predictions.standard.players;
            const safeBetPlayers = race.predictions.safeBet.players;
            const upsetPlayers = race.predictions.upsetFocus.players;

            for (const player of standardPlayers) {
                const safeBetPlayer = safeBetPlayers.find(p => p.number === player.number);
                const upsetPlayer = upsetPlayers.find(p => p.number === player.number);

                entriesData.push({
                    race_id: race.raceId,
                    boat_number: player.number,
                    player_name: player.name,
                    grade: player.grade,
                    age: player.age,
                    win_rate: parseFloat(player.winRate),
                    local_win_rate: parseFloat(player.localWinRate),
                    global_2rate: player.global2Rate ? parseFloat(player.global2Rate) : null,
                    local_2rate: player.local2Rate ? parseFloat(player.local2Rate) : null,
                    motor_number: player.motorNumber,
                    motor_2rate: parseFloat(player.motor2Rate),
                    boat_number_id: player.boatNumber,
                    boat_2rate: parseFloat(player.boat2Rate),
                    ai_score_standard: player.aiScore,
                    ai_score_safe_bet: safeBetPlayer?.aiScore || 0,
                    ai_score_upset_focus: upsetPlayer?.aiScore || 0
                });
            }
        }

        // バッチでupsert（1000件ずつ）
        for (let i = 0; i < entriesData.length; i += 1000) {
            const batch = entriesData.slice(i, i + 1000);
            const { error: entriesError } = await supabase
                .from('race_entries')
                .upsert(batch, { onConflict: 'race_id,boat_number' });

            if (entriesError) {
                console.error('❌ race_entries書き込みエラー:', entriesError.message);
            }
        }
        console.log(`  ✅ race_entries: ${entriesData.length}件`);

        // 3. predictionsテーブルにupsert
        const predictionsData = [];
        for (const race of allPredictions) {
            // Standard model
            const std = race.predictions.standard;
            predictionsData.push({
                race_id: race.raceId,
                model_id: 'standard',
                top_pick: std.topPick,
                top_2nd: std.top3[1] || null,
                top_3rd: std.top3[2] || null,
                confidence: std.confidence,
                is_shadow: false
            });

            // SafeBet model
            const safe = race.predictions.safeBet;
            predictionsData.push({
                race_id: race.raceId,
                model_id: 'safeBet',
                top_pick: safe.topPick,
                top_2nd: safe.top3[1] || null,
                top_3rd: safe.top3[2] || null,
                confidence: safe.confidence,
                is_shadow: false
            });

            // UpsetFocus model
            const upset = race.predictions.upsetFocus;
            predictionsData.push({
                race_id: race.raceId,
                model_id: 'upsetFocus',
                top_pick: upset.topPick,
                top_2nd: upset.top3[1] || null,
                top_3rd: upset.top3[2] || null,
                confidence: upset.confidence,
                is_shadow: false
            });
        }

        // 既存の予測を削除してから挿入（upsertだと複合キーが必要なため）
        const raceIds = allPredictions.map(r => r.raceId);
        await supabase
            .from('predictions')
            .delete()
            .in('race_id', raceIds)
            .eq('is_shadow', false);

        // バッチで挿入
        for (let i = 0; i < predictionsData.length; i += 1000) {
            const batch = predictionsData.slice(i, i + 1000);
            const { error: predsError } = await supabase
                .from('predictions')
                .insert(batch);

            if (predsError) {
                console.error('❌ predictions書き込みエラー:', predsError.message);
            }
        }
        console.log(`  ✅ predictions: ${predictionsData.length}件`);

        // 4. race_conditionsテーブルにupsert
        const conditionsData = allPredictions
            .filter(race => race.conditions?.weather || race.conditions?.airTemp != null || race.conditions?.raceGrade)
            .map(race => ({
                race_id: race.raceId,
                weather: race.conditions.weather,
                wind_direction: convertWindDirection(race.conditions.windDirection),
                wind_speed: race.conditions.windVelocity,
                wave_height: race.conditions.waveHeight != null ? Math.round(race.conditions.waveHeight) : null,
                temperature: race.conditions.airTemp,
                water_temperature: race.conditions.waterTemp,
                race_grade: race.conditions.raceGrade,
                race_title: race.conditions.raceTitle,
                series_day: null,
                is_final_day: null
            }));

        if (conditionsData.length > 0) {
            const { error: conditionsError } = await supabase
                .from('race_conditions')
                .upsert(conditionsData, { onConflict: 'race_id' });
            if (conditionsError) {
                console.error('❌ race_conditions書き込みエラー:', conditionsError.message);
            } else {
                console.log(`  ✅ race_conditions: ${conditionsData.length}件`);
            }
        }

        console.log('✅ Supabase書き込み完了');

    } catch (error) {
        console.error('❌ Supabase書き込みエラー:', error.message);
    }
}

// メイン処理
async function main() {
    try {
        console.log('🚀 AI予想生成を開始します...');

        // data/races.json を読み込み
        const racesPath = path.join(__dirname, '..', '..', 'data', 'races.json');
        console.log(`📖 レースデータを読み込み中: ${racesPath}`);

        const racesData = JSON.parse(await fs.readFile(racesPath, 'utf-8'));

        if (!racesData.success || !racesData.data) {
            throw new Error('races.json に有効なデータがありません');
        }

        console.log(`✅ ${racesData.data.length}会場のデータを取得しました`);

        // 今日の日付を取得
        const today = getTodayDateJST();
        console.log(`📅 予想生成日: ${today}`);

        // 全レースの予想を生成
        const allPredictions = [];
        let totalRaces = 0;

        for (const venue of racesData.data) {
            console.log(`\n📍 ${venue.placeName} (${venue.placeCd})`);

            if (!venue.races || venue.races.length === 0) {
                console.log('  ⚠️  レースデータなし');
                continue;
            }

            for (const race of venue.races) {
                // レースデータに場所情報を追加
                race.placeName = venue.placeName;
                race.placeCd = venue.placeCd;

                const prediction = generateRacePrediction(race, today);

                if (prediction) {
                    allPredictions.push(prediction);
                    totalRaces++;
                    console.log(`  ✅ ${race.raceNo}R - 本命: ${prediction.prediction.topPick}号艇 (信頼度: ${prediction.prediction.confidence}%)`);
                } else {
                    console.log(`  ❌ ${race.raceNo}R - 予想生成失敗`);
                }
            }
        }

        console.log(`\n📊 合計 ${totalRaces}レースの予想を生成しました`);

        // Supabaseに書き込み
        await writeToSupabase(allPredictions, today);

        console.log('✨ 予想生成が完了しました！');

    } catch (error) {
        console.error('❌ エラーが発生しました:', error);
        process.exit(1);
    }
}

// スクリプト実行
main();
