/**
 * PredictionLoadingOverlay - AI予想ローディング演出
 * 3ステップのプログレス表示
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./PredictionLoadingOverlay.css";

const STEPS = [
  { icon: "📊", labelKey: "loading.step1" },
  { icon: "🏁", labelKey: "loading.step2" },
  { icon: "✅", labelKey: "loading.step3" },
];

function PredictionLoadingOverlay() {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStep(1), 300);
    const timer2 = setTimeout(() => setActiveStep(2), 700);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="prediction-loading">
      <div className="prediction-loading__steps">
        {STEPS.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep;
          const className = [
            "prediction-loading__step",
            isActive && "prediction-loading__step--active",
            isDone && "prediction-loading__step--done",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={index} className={className}>
              <span
                className={`prediction-loading__icon ${isActive ? "prediction-loading__icon--pulse" : ""}`}
              >
                {isDone ? "✓" : step.icon}
              </span>
              <span className="prediction-loading__label">{t(step.labelKey)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PredictionLoadingOverlay;
