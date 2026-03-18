/**
 * ModelDescription - 予想モデル説明セクション（アコーディオン）
 */
import { useState } from "react";

function ModelDescription() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        borderRadius: "8px",
        marginBottom: "1.5rem",
        border: "1px solid #e0e0e0",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "0.875rem 1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.95rem",
          fontWeight: "700",
          color: "#333",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>📚</span>
          予想モデルについて
        </span>
        <span
          style={{
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: "0.8rem",
            color: "#888",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: "0 1.25rem 1.25rem" }}>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              fontSize: "0.9rem",
            }}
          >
            {/* 本命狙い */}
            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                borderLeft: "4px solid #4caf50",
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  color: "#4caf50",
                  marginBottom: "0.5rem",
                  fontSize: "0.95rem",
                }}
              >
                🎯 本命狙い（安全型）
              </div>
              <div style={{ color: "#555", lineHeight: "1.6" }}>
                <strong>特徴：</strong>
                最も確率の高い1マーク展開パターンに基づく堅実型
                <br />
                <strong>重視する要素：</strong>
                インコース有利性、A級選手、逃げ・差しの展開確率
                <br />
                <strong>適したレース：</strong>1号艇やA級選手が有力な堅い展開
                <br />
                <strong>こんな人におすすめ：</strong>
                的中率を重視し、コツコツ当てたい方
              </div>
            </div>

            {/* スタンダード */}
            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                borderLeft: "4px solid #0ea5e9",
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  color: "#0ea5e9",
                  marginBottom: "0.5rem",
                  fontSize: "0.95rem",
                }}
              >
                ⚖️ スタンダード（バランス型）
              </div>
              <div style={{ color: "#555", lineHeight: "1.6" }}>
                <strong>特徴：</strong>
                2番目に有力な展開パターンに基づくバランス型
                <br />
                <strong>重視する要素：</strong>
                全国勝率、当地成績、モーター性能を総合的に評価
                <br />
                <strong>適したレース：</strong>標準的な展開が予想されるレース
                <br />
                <strong>こんな人におすすめ：</strong>
                安定した的中を狙いつつ、適度な配当も期待したい方
              </div>
            </div>

            {/* 穴狙い */}
            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                borderLeft: "4px solid #ff9800",
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  color: "#ff9800",
                  marginBottom: "0.5rem",
                  fontSize: "0.95rem",
                }}
              >
                🌪️ 穴狙い（高配当型）
              </div>
              <div style={{ color: "#555", lineHeight: "1.6" }}>
                <strong>特徴：</strong>3番目の展開パターンに基づく高配当狙い型
                <br />
                <strong>重視する要素：</strong>
                まくり・まくり差しの展開確率、好調なモーター、外枠の可能性
                <br />
                <strong>適したレース：</strong>
                混戦模様や荒れる展開が予想されるレース
                <br />
                <strong>こんな人におすすめ：</strong>
                大きな配当を狙いたい、一発逆転を狙う方
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "rgba(255, 255, 255, 0.7)",
              borderRadius: "6px",
              fontSize: "0.85rem",
              color: "#555",
              lineHeight: "1.6",
            }}
          >
            <span>💡</span> <strong>ヒント：</strong>
            各モデルは1マーク展開予測の異なるパターンに対応しています。モデルを切り替えると、アニメーションの展開パターンも連動して変わります。
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelDescription;
