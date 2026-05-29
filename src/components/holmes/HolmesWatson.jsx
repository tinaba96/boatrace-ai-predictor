/**
 * HolmesWatson - LightGBM (LambdaRank) による予想 [α版・準備中]
 */
import HolmesPlaceholder from "./HolmesPlaceholder";
import { WatsonExplanation } from "./explanations";

function HolmesWatson() {
  return (
    <>
      <HolmesPlaceholder
        characterIcon="🩺"
        characterName="ワトソン予想"
        characterTitle="信頼できる相棒 - データドリブンの医師"
        modelTechnicalName="LightGBM (LambdaRank)"
        themeColor="#0284c7"
        status="α版・準備中"
        conceptLines={[
          "過去の全レースデータから「6艇のランキング」を直接学習",
          "100+ の特徴量（選手・モーター・会場・気象）を勾配ブースティングで統合",
          "SHAP 値で「なぜこの艇を推したか」を医師のように説明",
          "現在のヒューリスティック3モデルをベースラインとして超えることを目指す",
        ]}
        mockPrediction={{
          race: "(実装後にリアルタイム表示)",
          pick: "1-2-3",
          probability: "—",
          judgement: "—",
        }}
      />
      <WatsonExplanation />
    </>
  );
}

export default HolmesWatson;
