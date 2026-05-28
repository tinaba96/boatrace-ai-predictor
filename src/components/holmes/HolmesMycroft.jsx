/**
 * HolmesMycroft - Transformer による予想 [α版・準備中]
 */
import HolmesPlaceholder from "./HolmesPlaceholder";
import { MycroftExplanation } from "./explanations";

function HolmesMycroft() {
  return (
    <>
      <HolmesPlaceholder
        characterIcon="🏛️"
        characterName="マイクロフト予想"
        characterTitle="ホームズの兄 - 全てを記憶する巨大な頭脳"
        modelTechnicalName="Transformer (Sequence Model)"
        themeColor="#ca8a04"
        status="α版・準備中"
        conceptLines={[
          "各選手の過去 30〜100 戦を系列としてエンコード",
          "Self-attention で「フォーム」「節間の調子」「相手選手との対戦履歴」を抽出",
          "集約統計では失われる時系列情報を学習し、ヒューリスティックの上限を突破",
          "GPU 推奨・データ要求量が大きいため、他モデルが頭打ちになった時の切り札",
        ]}
        mockPrediction={{
          race: "(実装後にリアルタイム表示)",
          pick: "1-3-2",
          probability: "—",
          judgement: "—",
        }}
      />
      <MycroftExplanation />
    </>
  );
}

export default HolmesMycroft;
