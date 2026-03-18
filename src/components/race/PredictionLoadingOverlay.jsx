/**
 * PredictionLoadingOverlay - AI予想ローディング演出
 * 3ステップのプログレス表示
 */
import { useState, useEffect } from "react";
import "./PredictionLoadingOverlay.css";

const STEPS = [
  { icon: "📊", label: "データ読み込み中..." },
  { icon: "🏁", label: "展開パターンを解析中..." },
  { icon: "✅", label: "予想を生成中..." },
];

function PredictionLoadingOverlay() {
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
              <span className="prediction-loading__label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PredictionLoadingOverlay;
