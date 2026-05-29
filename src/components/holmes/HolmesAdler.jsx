/**
 * HolmesAdler - Plackett-Luce NN による予想 [α版・準備中]
 */
import HolmesPlaceholder from "./HolmesPlaceholder";
import { AdlerExplanation } from "./explanations";

function HolmesAdler() {
  return (
    <>
      <HolmesPlaceholder
        characterIcon="💎"
        characterName="アドラー予想"
        characterTitle="ホームズを唯一出し抜いた女 - 順位確率の魔法使い"
        modelTechnicalName="Plackett-Luce Neural Network"
        themeColor="#9333ea"
        status="α版・準備中"
        conceptLines={[
          "ニューラルネットが各艇の効用スコアを出力 → Plackett-Luce 分布で順列確率を厳密計算",
          "単勝・2連単・3連単・3連複の確率を1つのモデルから一貫して導出",
          "既存の出目分布レイヤーと自然に接続できる構造",
          "微分可能な対数尤度で学習可能、PyTorch 実装",
        ]}
        mockPrediction={{
          race: "(実装後にリアルタイム表示)",
          pick: "1-2-4 / 1-2-3 / 1-3-4",
          probability: "—",
          judgement: "—",
        }}
      />
      <AdlerExplanation />
    </>
  );
}

export default HolmesAdler;
