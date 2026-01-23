/**
 * SNSシェア関数
 */

import { MODEL_NAMES } from '../constants';

/**
 * AI予想をXでシェア
 * @param {Object} race - レースデータ
 * @param {string} model - 使用したモデル (standard/safeBet/upsetFocus)
 */
export const shareRacePredictionToX = (race, model = 'standard') => {
    const venue = race.venue || '不明';
    const raceNo = race.raceNo || '?';
    const topPick = race.prediction?.topPick || '?';
    const top3 = race.prediction?.top3?.join('-') || '?-?-?';
    const aiScore = race.prediction?.aiScores?.[0]?.toFixed(1) || '?';

    const modelName = MODEL_NAMES[model] || 'スタンダード';

    // 日付をフォーマット (YYYY-MM-DD -> MM/DD)
    let dateStr = '';
    if (race.date) {
        const parts = race.date.split('-');
        if (parts.length === 3) {
            dateStr = `${parts[1]}/${parts[2]} `;
        }
    }

    // 5種類のメッセージバリエーション（人間味のある表現）
    const messages = [
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
本命: ${topPick}号艇
推奨: ${top3}
AIスコア: ${aiScore}

今回のレース、データ的にこの並びが来そう！
AIスコアも高めで期待できるかも👀

#ボートレース #ボートレース #AI予想 #BoatAI`,

        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
本命: ${topPick}号艇
推奨: ${top3}
AIスコア: ${aiScore}

選手のコンディションとモーター性能を分析した結果、
この組み合わせに注目してます📊

#ボートレース #ボートレース #AI予想 #BoatAI`,

        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
本命: ${topPick}号艇
推奨: ${top3}
AIスコア: ${aiScore}

無料でここまで精度の高い予想が見られるのは嬉しい✨
今日も当たりますように！

#ボートレース #ボートレース #AI予想 #BoatAI`,

        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
本命: ${topPick}号艇
推奨: ${top3}
AIスコア: ${aiScore}

勝率と2連対率から見て、この予想は信頼できそう！
皆さんはどう思いますか？🤔

#ボートレース #ボートレース #AI予想 #BoatAI`,

        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
本命: ${topPick}号艇
推奨: ${top3}
AIスコア: ${aiScore}

最近的中率が上がってきてて嬉しい😊
AIの予想、参考にしてみてください！

#ボートレース #ボートレース #AI予想 #BoatAI`
    ];

    // ランダムにメッセージを選択
    const randomIndex = Math.floor(Math.random() * messages.length);
    const text = messages[randomIndex];

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://www.boat-ai.jp/')}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
};

/**
 * 的中結果をXでシェア
 * @param {Object} race - レースデータ（結果含む）
 * @param {string} model - 使用したモデル (standard/safeBet/upsetFocus)
 */
export const shareHitRaceToX = (race, model = 'standard') => {
    const venue = race.venue || '不明';
    const raceNo = race.raceNo || '?';
    const prediction = race.prediction?.top3?.join('-') || '?-?-?';
    const result = race.result?.join('-') || '?-?-?';
    const payout = race.totalPayout || 0;
    const hitTypes = race.hitTypes || [];

    const modelName = MODEL_NAMES[model] || 'スタンダード';

    // 的中券種を文字列化
    let hitTypesStr = '';
    if (hitTypes.length > 0) {
        const hitTypeNames = hitTypes.map(h => h.type);
        hitTypesStr = hitTypeNames.join('・');
    }

    // 日付をフォーマット (YYYY-MM-DD -> MM/DD)
    let dateStr = '';
    if (race.date) {
        const parts = race.date.split('-');
        if (parts.length === 3) {
            dateStr = `${parts[1]}/${parts[2]} `;
        }
    }

    // 5種類のメッセージバリエーション
    const messages = [
        `🎯 的中！【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
予想: ${prediction}
結果: ${result}
的中: ${hitTypesStr} ✅
配当: ${payout.toLocaleString()}円

BoatAIで予想的中🎉
AIの精度に驚いてます！

#ボートレース #ボートレース #的中 #BoatAI`,

        `🎯 的中！【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
予想: ${prediction}
結果: ${result}
的中: ${hitTypesStr} ✅
配当: ${payout.toLocaleString()}円

BoatAIで予想的中🎉
無料でこの精度はすごい！

#ボートレース #ボートレース #的中 #BoatAI`,

        `🎯 的中！【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
予想: ${prediction}
結果: ${result}
的中: ${hitTypesStr} ✅
配当: ${payout.toLocaleString()}円

BoatAIで予想的中🎉
データ分析の力を実感！

#ボートレース #ボートレース #的中 #BoatAI`,

        `🎯 的中！【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
予想: ${prediction}
結果: ${result}
的中: ${hitTypesStr} ✅
配当: ${payout.toLocaleString()}円

BoatAIで予想的中🎉
今日もAI予想が当たった！

#ボートレース #ボートレース #的中 #BoatAI`,

        `🎯 的中！【${dateStr}${venue}${raceNo}R】

モデル: ${modelName}
予想: ${prediction}
結果: ${result}
的中: ${hitTypesStr} ✅
配当: ${payout.toLocaleString()}円

BoatAIで予想的中🎉
的中率の高さに満足してます！

#ボートレース #ボートレース #的中 #BoatAI`
    ];

    // ランダムにメッセージを選択
    const randomIndex = Math.floor(Math.random() * messages.length);
    const text = messages[randomIndex];

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://www.boat-ai.jp/')}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
};

/**
 * 統計データをXでシェア
 * @param {Object} stats - 統計データ
 */
export const shareDailyStatsToX = (stats) => {
    const date = stats.date || new Date().toISOString().split('T')[0];
    const tanWins = stats.tanWins || 0;
    const fukuWins = stats.fukuWins || 0;
    const total = stats.total || 1;
    const tanRate = ((tanWins / total) * 100).toFixed(1);
    const fukuRate = ((fukuWins / total) * 100).toFixed(1);

    const text = `📊 本日の実績【${date}】

✅ 単勝: ${tanWins}/${total}（${tanRate}%）
✅ 複勝: ${fukuWins}/${total}（${fukuRate}%）

BoatAIのAI予想で的中率UP📈

#ボートレース #ボートレース #AI予想`;

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://www.boat-ai.jp/')}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
};

/**
 * AI予想のシェアテキストを生成（react-share用）
 */
export const generatePredictionShareText = (race, model = 'standard') => {
    const venue = race.venue || '不明';
    const raceNo = race.raceNo || '?';
    const topPick = race.prediction?.topPick || '?';
    const top3 = race.prediction?.top3?.join('-') || '?-?-?';
    const aiScore = race.prediction?.aiScores?.[0]?.toFixed(1) || '?';

    const modelName = MODEL_NAMES[model] || 'スタンダード';

    let dateStr = '';
    if (race.date) {
        const parts = race.date.split('-');
        if (parts.length === 3) {
            dateStr = `${parts[1]}/${parts[2]} `;
        }
    }

    const messages = [
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n本命: ${topPick}号艇\n推奨: ${top3}\nAIスコア: ${aiScore}\n\n今回のレース、データ的にこの並びが来そう！\nAIスコアも高めで期待できるかも👀`,
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n本命: ${topPick}号艇\n推奨: ${top3}\nAIスコア: ${aiScore}\n\n選手のコンディションとモーター性能を分析した結果、\nこの組み合わせに注目してます📊`,
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n本命: ${topPick}号艇\n推奨: ${top3}\nAIスコア: ${aiScore}\n\n無料でここまで精度の高い予想が見られるのは嬉しい✨\n今日も当たりますように！`,
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n本命: ${topPick}号艇\n推奨: ${top3}\nAIスコア: ${aiScore}\n\n勝率と2連対率から見て、この予想は信頼できそう！\n皆さんはどう思いますか？🤔`,
        `🏁 BoatAI予想【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n本命: ${topPick}号艇\n推奨: ${top3}\nAIスコア: ${aiScore}\n\n最近的中率が上がってきてて嬉しい😊\nAIの予想、参考にしてみてください！`
    ];

    return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * 的中結果のシェアテキストを生成（react-share用）
 * @param {Object} race - レースデータ（結果含む）
 * @param {string} model - 使用したモデル (standard/safeBet/upsetFocus)
 */
export const generateHitRaceShareText = (race, model = 'standard') => {
    const venue = race.venue || '不明';
    const raceNo = race.raceNo || '?';
    const prediction = race.prediction?.top3?.join('-') || '?-?-?';
    const result = race.result?.join('-') || '?-?-?';
    const payout = race.totalPayout || 0;
    const hitTypes = race.hitTypes || [];

    const modelName = MODEL_NAMES[model] || 'スタンダード';

    // 的中券種を文字列化
    let hitTypesStr = '';
    if (hitTypes.length > 0) {
        const hitTypeNames = hitTypes.map(h => h.type);
        hitTypesStr = hitTypeNames.join('・');
    }

    let dateStr = '';
    if (race.date) {
        const parts = race.date.split('-');
        if (parts.length === 3) {
            dateStr = `${parts[1]}/${parts[2]} `;
        }
    }

    const messages = [
        `🎯 的中！【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n予想: ${prediction}\n結果: ${result}\n的中: ${hitTypesStr} ✅\n配当: ${payout.toLocaleString()}円\n\nBoatAIで予想的中🎉\nAIの精度に驚いてます！`,
        `🎯 的中！【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n予想: ${prediction}\n結果: ${result}\n的中: ${hitTypesStr} ✅\n配当: ${payout.toLocaleString()}円\n\nBoatAIで予想的中🎉\n無料でこの精度はすごい！`,
        `🎯 的中！【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n予想: ${prediction}\n結果: ${result}\n的中: ${hitTypesStr} ✅\n配当: ${payout.toLocaleString()}円\n\nBoatAIで予想的中🎉\nデータ分析の力を実感！`,
        `🎯 的中！【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n予想: ${prediction}\n結果: ${result}\n的中: ${hitTypesStr} ✅\n配当: ${payout.toLocaleString()}円\n\nBoatAIで予想的中🎉\n今日もAI予想が当たった！`,
        `🎯 的中！【${dateStr}${venue}${raceNo}R】\n\nモデル: ${modelName}\n予想: ${prediction}\n結果: ${result}\n的中: ${hitTypesStr} ✅\n配当: ${payout.toLocaleString()}円\n\nBoatAIで予想的中🎉\n的中率の高さに満足してます！`
    ];

    return messages[Math.floor(Math.random() * messages.length)];
};
