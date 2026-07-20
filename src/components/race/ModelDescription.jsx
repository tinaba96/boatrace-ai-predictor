/**
 * ModelDescription - 予想モデル説明セクション（アコーディオン）
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

// 各モデルの表示設定（文言は i18n キーで管理）
const MODEL_BLOCKS = [
  { color: "#4caf50", prefix: "safeBet" },
  { color: "#0ea5e9", prefix: "standard" },
  { color: "#ff9800", prefix: "upset" },
];

function ModelDescription() {
  const { t } = useTranslation();
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
          {t("modelDesc.sectionTitle")}
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
            {MODEL_BLOCKS.map(({ color, prefix }) => (
              <div
                key={prefix}
                style={{
                  padding: "1rem",
                  background: "white",
                  borderRadius: "6px",
                  borderLeft: `4px solid ${color}`,
                }}
              >
                <div
                  style={{
                    fontWeight: "700",
                    color,
                    marginBottom: "0.5rem",
                    fontSize: "0.95rem",
                  }}
                >
                  {t(`modelDesc.${prefix}Title`)}
                </div>
                <div style={{ color: "#555", lineHeight: "1.6" }}>
                  <strong>{t("modelDesc.featureLabel")}</strong>
                  {t(`modelDesc.${prefix}Feature`)}
                  <br />
                  <strong>{t("modelDesc.factorsLabel")}</strong>
                  {t(`modelDesc.${prefix}Factors`)}
                  <br />
                  <strong>{t("modelDesc.suitedLabel")}</strong>
                  {t(`modelDesc.${prefix}Suited`)}
                  <br />
                  <strong>{t("modelDesc.recommendLabel")}</strong>
                  {t(`modelDesc.${prefix}Recommend`)}
                </div>
              </div>
            ))}
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
            <span>💡</span> <strong>{t("modelDesc.hintLabel")}</strong>
            {t("modelDesc.hint")}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelDescription;
