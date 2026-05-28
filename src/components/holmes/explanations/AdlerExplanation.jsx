import "./ExplanationSection.css";

function AdlerExplanation() {
  return (
    <section className="holmes-section explanation-section">
      <h3>仕組みを知る</h3>

      <p className="explanation-summary">
        ニューラルネットが各艇の「効用スコア」を出力し、Plackett-Luce分布で
        単勝・連単・連複の確率を一つのモデルから一貫して導出します。
      </p>

      <div className="explanation-diagram">
        <svg
          viewBox="0 0 640 160"
          width="100%"
          height="auto"
          aria-label="アドラー処理フロー図"
        >
          <defs>
            <marker
              id="adler-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#9333ea" />
            </marker>
          </defs>

          {/* 各艇ボックス */}
          <rect
            x="10"
            y="20"
            width="100"
            height="120"
            rx="6"
            fill="#f3e8ff"
            stroke="#9333ea"
            strokeWidth="1.5"
          />
          <text
            x="60"
            y="50"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#9333ea"
            fontWeight="600"
          >
            各艇の
          </text>
          <text
            x="60"
            y="66"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#9333ea"
            fontWeight="600"
          >
            特徴量
          </text>
          <text
            x="60"
            y="86"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            1号艇
          </text>
          <text
            x="60"
            y="100"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            2号艇
          </text>
          <text
            x="60"
            y="114"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            …6号艇
          </text>

          {/* 矢印1 */}
          <line
            x1="112"
            y1="80"
            x2="148"
            y2="80"
            stroke="#9333ea"
            strokeWidth="1.5"
            markerEnd="url(#adler-arrow)"
          />

          {/* NNボックス */}
          <rect
            x="150"
            y="30"
            width="130"
            height="100"
            rx="6"
            fill="#f3e8ff"
            stroke="#9333ea"
            strokeWidth="1.5"
          />
          <text
            x="215"
            y="66"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#9333ea"
            fontWeight="600"
          >
            ニューラルネット
          </text>
          <text
            x="215"
            y="84"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            共有重みで各艇を
          </text>
          <text
            x="215"
            y="98"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            独立にエンコード
          </text>
          <text
            x="215"
            y="116"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            PyTorch実装
          </text>

          {/* 矢印2 */}
          <line
            x1="282"
            y1="80"
            x2="318"
            y2="80"
            stroke="#9333ea"
            strokeWidth="1.5"
            markerEnd="url(#adler-arrow)"
          />

          {/* 効用スコアボックス */}
          <rect
            x="320"
            y="30"
            width="120"
            height="100"
            rx="6"
            fill="#f3e8ff"
            stroke="#9333ea"
            strokeWidth="1.5"
          />
          <text
            x="380"
            y="62"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#9333ea"
            fontWeight="600"
          >
            効用スコア
          </text>
          <text
            x="380"
            y="80"
            textAnchor="middle"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            u₁, u₂, …, u₆
          </text>
          <text
            x="380"
            y="98"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            各艇の勝ちやすさ
          </text>
          <text
            x="380"
            y="114"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#7c3aed"
          >
            を実数で表現
          </text>

          {/* 矢印3 */}
          <line
            x1="442"
            y1="80"
            x2="478"
            y2="80"
            stroke="#9333ea"
            strokeWidth="1.5"
            markerEnd="url(#adler-arrow)"
          />

          {/* PL分布ボックス */}
          <rect
            x="480"
            y="20"
            width="150"
            height="120"
            rx="6"
            fill="#9333ea"
            stroke="#9333ea"
            strokeWidth="1.5"
          />
          <text
            x="555"
            y="52"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#ffffff"
            fontWeight="600"
          >
            PL分布
          </text>
          <text
            x="555"
            y="70"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#f3e8ff"
          >
            単勝確率
          </text>
          <text
            x="555"
            y="84"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#f3e8ff"
          >
            2連単確率
          </text>
          <text
            x="555"
            y="98"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#f3e8ff"
          >
            3連単確率
          </text>
          <text
            x="555"
            y="112"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#f3e8ff"
          >
            3連複確率
          </text>
          <text
            x="555"
            y="128"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#e9d5ff"
          >
            を一括導出
          </text>
        </svg>
      </div>

      <ul className="explanation-key-points">
        <li>
          <span style={{ color: "#9333ea" }}>Plackett-Luce分布</span> により、
          単勝・連単・連複の確率を矛盾なく一貫したモデルで計算
        </li>
        <li>
          ニューラルネットが各艇の効用スコアを学習し、複雑な非線形パターンを捕捉
        </li>
        <li>対数尤度を直接最大化できるため、PyTorchで微分可能に実装可能</li>
        <li>
          IIA (Independence of Irrelevant Alternatives)
          仮定のもとで計算効率が高い
        </li>
      </ul>

      <details className="explanation-details">
        <summary>詳しい仕組みを見る</summary>
        <div className="explanation-detail-body">
          <div className="explanation-detail-block">
            <h4>Plackett-Luce 分布とは</h4>
            <p>
              各選択肢に「効用スコア
              u_i」を割り当て、順列の確率をその指数の比で表す確率モデルです。
              「1位が艇kである確率」は k
              の効用を全体の効用合計で割った値になります。
            </p>
            <code className="explanation-formula">
              P(順列π) = ∏_k exp(u_π(k)) / Σ_{"{"} j≥k {"}"} exp(u_π(j))
            </code>
            <p>
              この式の積を展開すると、「1位が艇A、2位が艇B、…」という任意の順列の確率が
              解析的に計算できます。これにより単勝・連単・連複のすべてを同一モデルから導出できます。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>IIA (無関係な選択肢からの独立) 仮定</h4>
            <p>
              「艇Aが艇Bより先着する確率」は他の艇の存在に依存しないという仮定です。
              これにより計算が大幅に簡略化され、6艇すべての順列 (720通り) を
              明示的に列挙せずに効率的に計算できます。
              実際のレースでは完全に成立しない場面もありますが、
              近似として十分な精度を持ちます。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>ニューラルネットの役割</h4>
            <p>
              各艇の特徴量（選手成績・モーター成績・展示タイム・コース・天候など）を
              入力とし、その艇の効用スコア u_i を出力します。
              全艇で共通の重みを使う「共有アーキテクチャ」を採用することで、
              「艇番に依存しない汎化能力」を学習できます。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>具体的なウォークスルー</h4>
            <p>
              例: 1号艇 u=2.1、2号艇 u=1.3、3号艇 u=0.8、4号艇 u=0.5、5号艇
              u=0.3、6号艇 u=0.1 の場合、1号艇の単勝確率は：
            </p>
            <code className="explanation-formula">
              P(1着=1号艇) = exp(2.1) /
              (exp(2.1)+exp(1.3)+exp(0.8)+exp(0.5)+exp(0.3)+exp(0.1)) ≈ 42%
            </code>
            <p>
              同様に「1-2連単」は exp(2.1)/(全合計) × exp(1.3)/(2.1を除く合計)
              で計算でき、 すべての賭け式の確率を一気に導出できます。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>強み・弱み</h4>
            <div className="explanation-pros-cons">
              <div className="explanation-pros">
                <h5>強み</h5>
                <ul>
                  <li>全賭け式を一貫したモデルで計算</li>
                  <li>確率の合計が必ず1になる</li>
                  <li>非線形パターンを学習</li>
                  <li>微分可能で学習安定</li>
                </ul>
              </div>
              <div className="explanation-cons">
                <h5>弱み</h5>
                <ul>
                  <li>IIA仮定が成立しない場合に精度低下</li>
                  <li>GBDTより学習データが多く必要</li>
                  <li>ハイパーパラメータ調整が複雑</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="explanation-detail-block">
            <h4>既存モデルとの違い</h4>
            <p>
              現行モデルは「1着予想」と「連単予想」を別々のロジックで算出しているため、
              単勝確率と連単確率が矛盾することがあります。
              アドラーは一つの確率モデルからすべての賭け式を導出するため、
              論理的一貫性を保ちながら複数の賭け式を組み合わせた戦略が立てられます。
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}

export default AdlerExplanation;
