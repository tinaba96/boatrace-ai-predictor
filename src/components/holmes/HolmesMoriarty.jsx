/**
 * HolmesMoriarty - Calibration + Kelly criterion による予想 [α版・準備中]
 */
import HolmesPlaceholder from "./HolmesPlaceholder";

function HolmesMoriarty() {
  return (
    <HolmesPlaceholder
      characterIcon="🎩"
      characterName="モリアーティ予想"
      characterTitle="犯罪界のナポレオン - 数学的最適化の教授"
      modelTechnicalName="Probability Calibration + Kelly Criterion"
      themeColor="#1f2937"
      status="α版・準備中"
      conceptLines={[
        "他モデルの出力スコアを Isotonic / Platt Scaling で本物の確率に補正",
        "確率 × オッズ = EV を計算し、EV > 1.0 のレースのみを選別",
        "Kelly 基準で資金に対する最適ベット割合を算出（Half/Quarter Kelly 対応）",
        "「いくら賭けるか」を数学的に決定する、長期資金成長率を最大化するレイヤー",
      ]}
      mockPrediction={{
        race: "(実装後にリアルタイム表示)",
        pick: "1-2 (2連単)",
        probability: "—",
        judgement: "見送り推奨 / 資金 0.0%",
      }}
    />
  );
}

export default HolmesMoriarty;
