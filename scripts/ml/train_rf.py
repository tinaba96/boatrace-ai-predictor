"""ポアロ予想 V1: ランダムフォレスト（BOA-104）

ポジション別3ヘッド構成:
  head1 = P(1着), head2 = P(2着), head3 = P(3着) をそれぞれ RandomForest で学習し、
  一般化 Plackett-Luce（3ヘッド逐次選択）で3連単確率を構成する。
比較用に「勝率のみ + 指数減衰PL」も同時にバックテストする。

実行:
  scripts/ml/.venv/bin/python scripts/ml/train_rf.py
出力:
  scripts/ml/models/rf_v1.pkl        学習済みモデル一式（3ヘッド）
  data/ml/report_rf_v1.json          評価レポート
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import log_loss, roc_auc_score

import features as F

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

RF_PARAMS = dict(
    n_estimators=100,        # 600→100（モデルサイズと学習時間の削減）
    max_depth=14,            # 無制限→14（3.3GB→~90MB。木の葉の爆発を抑える）
    min_samples_leaf=200,    # 20→200（過学習抑制＋ノード数削減）
    max_features="sqrt",
    n_jobs=-1,
    random_state=42,
)


def train_head(train, cal, position: int):
    """1ポジション分の RF + isotonic キャリブレータを学習して返す。"""
    X_tr, y_tr = F.make_xy(train, fill_sentinel=True, position=position)
    X_ca, y_ca = F.make_xy(cal, fill_sentinel=True, position=position)
    rf = RandomForestClassifier(**RF_PARAMS)
    rf.fit(X_tr, y_tr)
    p_ca = rf.predict_proba(X_ca)[:, 1]
    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(p_ca, y_ca)
    return rf, iso, p_ca


def main():
    print("📥 データ読み込み・特徴量構築...")
    df = F.load_dataset()
    train, cal, test = F.time_split(df)
    print(f"  train={train['race_id'].nunique()}R  cal={cal['race_id'].nunique()}R  "
          f"test={test['race_id'].nunique()}R")

    heads = {}
    cal_raw = {}
    for pos in (1, 2, 3):
        print(f"🌲 RandomForest 学習中... (head{pos}: P({pos}着))")
        rf, iso, p_ca = train_head(train, cal, pos)
        heads[pos] = (rf, iso)
        cal_raw[pos] = p_ca

    # ---- テスト評価 ----
    X_te, y_te = F.make_xy(test, fill_sentinel=True, position=1)
    test = test.copy()
    for pos in (1, 2, 3):
        rf, iso = heads[pos]
        test[f"p{pos}"] = iso.predict(rf.predict_proba(X_te)[:, 1])
    test = F.normalize_within_race(test, "p1")

    p1_raw = heads[1][0].predict_proba(X_te)[:, 1]
    metrics = {
        "log_loss_raw": float(log_loss(y_te, np.clip(p1_raw, 1e-6, 1 - 1e-6))),
        "log_loss_calibrated": float(
            log_loss(y_te, np.clip(test["p1"], 1e-6, 1 - 1e-6))),
        "auc": float(roc_auc_score(y_te, p1_raw)),
    }
    print(f"  head1 log loss (raw→cal): {metrics['log_loss_raw']:.4f} → "
          f"{metrics['log_loss_calibrated']:.4f} | AUC: {metrics['auc']:.4f}")

    print("💰 バックテスト...")
    res_new, bt = F.backtest_3head(test, "p1", "p2", "p3")
    print(f"  単勝  : 的中 {res_new['win_hit_rate']*100:.1f}% 回収 {res_new['win_recovery']*100:.1f}%")
    print(f"  3連単 : 的中 {res_new['santan_hit_rate']*100:.1f}% 回収 {res_new['santan_recovery']*100:.1f}%")
    print(f"  3連複 : 的中 {res_new['sanfuku_hit_rate']*100:.1f}% 回収 {res_new['sanfuku_recovery']*100:.1f}%")
    for f in res_new["confidence_filter"]:
        print(f"    p≥{f['threshold']:.2f}: {f['n_bets']}件 | "
              f"3連単 {f['santan_hit_rate']*100:.1f}%/{f['santan_recovery']*100:.1f}% | "
              f"3連複 {f['sanfuku_hit_rate']*100:.1f}%/{f['sanfuku_recovery']*100:.1f}%")

    calib = F.calibration_table(test.assign(is_win=(test["finish_pos"] == 1).astype(int)),
                                "p1_norm")
    imp = sorted(zip(F.FEATURE_COLS, heads[1][0].feature_importances_),
                 key=lambda x: -x[1])[:12]
    print("\n  head1 特徴量重要度 TOP12:")
    for name, v in imp:
        print(f"    {name:20s} {v:.4f}")

    # ---- 保存 ----
    with open(MODEL_DIR / "rf_v1.pkl", "wb") as f:
        pickle.dump({
            "heads": {p: {"model": heads[p][0], "iso": heads[p][1]} for p in heads},
            "feature_cols": F.FEATURE_COLS, "sentinel": F.SENTINEL,
        }, f)
    report = {
        "model": "rf_v1",
        "architecture": "3-head RandomForest + generalized Plackett-Luce",
        "params": {k: str(v) for k, v in RF_PARAMS.items()},
        "n_train_races": int(train["race_id"].nunique()),
        "n_test_races": int(test["race_id"].nunique()),
        "test_period": [str(test["race_date"].min().date()),
                        str(test["race_date"].max().date())],
        "metrics": metrics,
        "backtest_3head": {k: v for k, v in res_new.items()},
        "feature_importance": [{"feature": n, "importance": round(float(v), 5)}
                               for n, v in imp],
        "calibration": calib.assign(bin=calib["bin"].astype(str)).to_dict("records"),
    }
    with open(F.DATA_DIR / "report_rf_v1.json", "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n✅ 保存: {MODEL_DIR/'rf_v1.pkl'} / {F.DATA_DIR/'report_rf_v1.json'}")


if __name__ == "__main__":
    main()
