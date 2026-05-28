import "./ExplanationSection.css";

function MycroftExplanation() {
  return (
    <section className="holmes-section explanation-section">
      <h3>仕組みを知る</h3>

      <p className="explanation-summary">
        各選手の過去30〜100戦を時系列としてTransformerに入力し、
        Self-attentionでフォームの変化・節間の調子・対戦傾向を捕捉します。
      </p>

      <div className="explanation-diagram">
        <svg
          viewBox="0 0 640 160"
          width="100%"
          height="auto"
          aria-label="マイクロフト処理フロー図"
        >
          <defs>
            <marker
              id="mycroft-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="#ca8a04" />
            </marker>
          </defs>

          {/* 過去戦系列ボックス */}
          <rect
            x="10"
            y="25"
            width="120"
            height="110"
            rx="6"
            fill="#fef9c3"
            stroke="#ca8a04"
            strokeWidth="1.5"
          />
          <text
            x="70"
            y="54"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#ca8a04"
            fontWeight="600"
          >
            過去戦系列
          </text>
          <text
            x="70"
            y="72"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            30〜100戦
          </text>
          <text
            x="70"
            y="88"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            着順・タイム
          </text>
          <text
            x="70"
            y="104"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            コース・相手
          </text>
          <text
            x="70"
            y="120"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            節間情報
          </text>

          {/* 矢印1 */}
          <line
            x1="132"
            y1="80"
            x2="158"
            y2="80"
            stroke="#ca8a04"
            strokeWidth="1.5"
            markerEnd="url(#mycroft-arrow)"
          />

          {/* Embeddingボックス */}
          <rect
            x="160"
            y="40"
            width="110"
            height="80"
            rx="6"
            fill="#fef9c3"
            stroke="#ca8a04"
            strokeWidth="1.5"
          />
          <text
            x="215"
            y="72"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#ca8a04"
            fontWeight="600"
          >
            Embedding
          </text>
          <text
            x="215"
            y="90"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            選手ID + 位置
          </text>
          <text
            x="215"
            y="106"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            エンコーディング
          </text>

          {/* 矢印2 */}
          <line
            x1="272"
            y1="80"
            x2="298"
            y2="80"
            stroke="#ca8a04"
            strokeWidth="1.5"
            markerEnd="url(#mycroft-arrow)"
          />

          {/* Self-attentionボックス */}
          <rect
            x="300"
            y="25"
            width="140"
            height="110"
            rx="6"
            fill="#fef9c3"
            stroke="#ca8a04"
            strokeWidth="1.5"
          />
          <text
            x="370"
            y="54"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#ca8a04"
            fontWeight="600"
          >
            Self-attention
          </text>
          <text
            x="370"
            y="72"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            各戦が他の戦を
          </text>
          <text
            x="370"
            y="86"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            参照してコンテキスト
          </text>
          <text
            x="370"
            y="100"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            を捕捉
          </text>
          <text
            x="370"
            y="116"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#92400e"
          >
            フォーム・調子を抽出
          </text>

          {/* 矢印3 */}
          <line
            x1="442"
            y1="80"
            x2="468"
            y2="80"
            stroke="#ca8a04"
            strokeWidth="1.5"
            markerEnd="url(#mycroft-arrow)"
          />

          {/* 出力ボックス */}
          <rect
            x="470"
            y="30"
            width="160"
            height="100"
            rx="6"
            fill="#ca8a04"
            stroke="#ca8a04"
            strokeWidth="1.5"
          />
          <text
            x="550"
            y="62"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fill="#ffffff"
            fontWeight="600"
          >
            選手スコア
          </text>
          <text
            x="550"
            y="80"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#fef9c3"
          >
            現在のフォーム
          </text>
          <text
            x="550"
            y="94"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#fef9c3"
          >
            + 対戦傾向
          </text>
          <text
            x="550"
            y="108"
            textAnchor="middle"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fill="#fef9c3"
          >
            → 順位予想
          </text>
        </svg>
      </div>

      <ul className="explanation-key-points">
        <li>
          <span style={{ color: "#ca8a04" }}>Self-attention</span> により、
          「3節前から調子が落ちている」「特定のコースで強い」という時系列パターンを自動発見
        </li>
        <li>
          集約統計（平均着順など）では失われる「最近の変化」と「流れ」を学習
        </li>
        <li>選手ごとに個別のembeddingを持ち、選手固有のスタイルを記憶</li>
        <li>
          GPU推奨・データ要求量大。他モデルが頭打ちになった段階で投入する切り札
        </li>
      </ul>

      <details className="explanation-details">
        <summary>詳しい仕組みを見る</summary>
        <div className="explanation-detail-body">
          <div className="explanation-detail-block">
            <h4>Transformer とは</h4>
            <p>
              2017年に提案された Self-attention
              機構を中心とするニューラルネットアーキテクチャです。
              元々は自然言語処理のために開発されましたが、
              「系列データの長距離依存関係を捕捉する」能力から時系列データにも広く適用されています。
              LSTMやGRUと異なり、系列全体を並列に処理できるため学習が高速です。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>Self-attention の仕組み</h4>
            <p>
              各レース記録 (Query) が過去の全レース記録 (Key)
              との関連度を計算し、 重み付き和 (Value)
              としてコンテキスト情報を集約します。
            </p>
            <code className="explanation-formula">
              Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V
            </code>
            <p>
              例えば「2週前の節で大崩れした戦」に注目すれば、
              「現在の調子が一時的に落ちているパターン」を学習できます。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>Position Encoding</h4>
            <p>
              Self-attention は本来、順序を考慮しません。
              そこで各レース記録に「何戦前か」を示す位置情報を加算することで、
              時間的な前後関係を保持します。
              サイン・コサイン関数を使う固定エンコーディングや、
              学習可能な埋め込み (Learnable PE) を使用します。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>選手 Embedding</h4>
            <p>
              各選手に固有のベクトル (Embedding) を割り当て、
              「この選手はイン艇でのスタートが得意」「向かい風で成績が落ちやすい」という
              選手固有の傾向をパラメータとして学習します。
              レース記録のエンコードに加算することで、過去戦の文脈と選手特性を統合します。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>具体的なウォークスルー</h4>
            <p>
              選手Aの直近50戦をTransformerに入力すると： 1)
              過去50戦を各々768次元のベクトルに変換。 2)
              Self-attentionが「直近10戦で1着率が急上昇している」パターンを検出。
              3) 「節末（最終日）に調子を上げる傾向」も節 Embedding から学習。
              4) 最終的な選手スコアに「上昇中の選手」ブーストが加わり、
              他モデルより高い評価を付与。
            </p>
          </div>

          <div className="explanation-detail-block">
            <h4>強み・弱み</h4>
            <div className="explanation-pros-cons">
              <div className="explanation-pros">
                <h5>強み</h5>
                <ul>
                  <li>時系列の流れ・フォームを捕捉</li>
                  <li>長距離依存関係を学習可能</li>
                  <li>並列処理で学習高速</li>
                  <li>大規模データで真価を発揮</li>
                </ul>
              </div>
              <div className="explanation-cons">
                <h5>弱み</h5>
                <ul>
                  <li>GPU必須・計算コスト大</li>
                  <li>十分な履歴データが必要</li>
                  <li>解釈性がGBDTより低い</li>
                  <li>過学習リスクが高い</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="explanation-detail-block">
            <h4>なぜ今でなく「切り札」か</h4>
            <p>
              Transformerは大量のデータがあるほど真価を発揮します。
              現段階ではワトソン・アドラーのGBDT/PLモデルが
              少ないデータでも安定した精度を出せるため先行実装しています。
              データが十分蓄積された段階でマイクロフトを投入し、
              特に「調子の変化が重要な選手」の予想精度向上を狙います。
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}

export default MycroftExplanation;
