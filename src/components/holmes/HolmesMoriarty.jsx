import { useMoriartyData } from "./HolmesMoriartyData";
import { getStage } from "./HolmesMoriartyLogic";
import HolmesMoriartyHeader from "./HolmesMoriartyHeader";
import {
  MoriartyStageStarting,
  MoriartyStageGathering,
  MoriartyStageGrowing,
  MoriartyStageMature,
} from "./HolmesMoriartyStages";
import { MoriartyExplanation } from "./explanations";
import "./HolmesMoriarty.css";

/**
 * 推奨の提示を止めている理由（docs/issues/moriarty-post-hoc-generation-and-odds-drift.md）。
 * 2026-09〜10 の実測で、推奨の72%がレース発走後に作られていた（買えない買い目）こと、
 * 取得時オッズが締切時オッズと大きくずれ期待値を過大評価していたことが分かったため、
 * 「本日の推奨レース」を出さない。成績の蓄積（バッチ）は検証用に続けている。
 */
function MoriartyVerificationNotice() {
  return (
    <div
      className="moriarty-notice moriarty-notice--warning moriarty-verification-notice"
      role="status"
    >
      <p className="moriarty-verification-title">
        買い目の提示を止めています（検証中）
      </p>
      <ul className="moriarty-verification-reasons">
        <li>
          推奨が1日1回まとめて作られていて、約7割はレースが終わった後に作られていた（買えない買い目だった）
        </li>
        <li>
          期待値の計算に使う発売中のオッズが、払戻を決める締切時オッズと大きくずれていた（20倍以上の艇は締切までに半分以下になる）
        </li>
      </ul>
      <p className="moriarty-verification-footer">
        発走前に作った推奨だけで回収率が100%を超えることを確かめるまで、買い目は出しません。下の成績は、これまでの推奨（後出し分を含む）の記録です。何も選ばず買った場合の回収率は約75%です。
      </p>
    </div>
  );
}

function HolmesMoriarty() {
  const data = useMoriartyData();
  const { stats, loading, error } = data;

  const totalBets = stats.total_bets ?? 0;
  const stage = getStage(totalBets);

  if (loading) {
    return (
      <div className="holmes-detective-card moriarty-card">
        <div className="moriarty-loading">データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="holmes-detective-card moriarty-card">
        <div className="moriarty-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="holmes-detective-card moriarty-card">
      <HolmesMoriartyHeader />

      <section className="holmes-section">
        <MoriartyVerificationNotice />
      </section>

      {stage === "starting" && (
        <MoriartyStageStarting {...data} totalBets={totalBets} stage={stage} />
      )}
      {stage === "gathering" && (
        <MoriartyStageGathering {...data} totalBets={totalBets} stage={stage} />
      )}
      {stage === "growing" && <MoriartyStageGrowing {...data} />}
      {stage === "mature" && <MoriartyStageMature {...data} />}
      <MoriartyExplanation />
    </div>
  );
}

export default HolmesMoriarty;
