"""ポアロ予想 V2: LightGBM（BOA-104）

V1(RF) と同じポジション別3ヘッド構成を LightGBM で学習する。
NaN をネイティブ処理できるため sentinel 埋めはしない。

将来拡張（Phase 3）: 締切直前オッズのスナップショットが貯まり次第、
市場暗黙確率との合成（Benter式）と EV = p×odds フィルタをここに足す。

実行:
  scripts/ml/.venv/bin/python scripts/ml/train_v2.py
出力:
  scripts/ml/models/lgbm_v2.pkl      学習済みモデル一式（3ヘッド）
  data/ml/report_lgbm_v2.json        評価レポート
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import log_loss, roc_auc_score

import features as F

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

LGB_PARAMS = dict(
    objective="binary",
    metric="binary_logloss",
    learning_rate=0.03,
    num_leaves=63,
    min_data_in_leaf=50,
    feature_fraction=0.8,
    bagging_fraction=0.8,
    bagging_freq=1,
    lambda_l2=1.0,
    verbosity=-1,
    seed=42,
)
NUM_ROUNDS = 3000
EARLY_STOP = 100


def train_head(train, cal, position: int, cat_idx):
    X_tr, y_tr = F.make_xy(train, fill_sentinel=False, position=position)
    X_ca, y_ca = F.make_xy(cal, fill_sentinel=False, position=position)
    dtrain = lgb.Dataset(X_tr, y_tr, categorical_feature=cat_idx)
    dcal = lgb.Dataset(X_ca, y_ca, reference=dtrain, categorical_feature=cat_idx)
    model = lgb.train(
        LGB_PARAMS, dtrain, NUM_ROUNDS,
        valid_sets=[dcal],
        callbacks=[lgb.early_stopping(EARLY_STOP, verbose=False)],
    )
    p_ca = model.predict(X_ca, num_iteration=model.best_iteration)
    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(p_ca, y_ca)
    return model, iso, p_ca


def main():
    print("📥 データ読み込み・特徴量構築...")
    df = F.load_dataset()
    train, cal, test = F.time_split(df)
    print(f"  train={train['race_id'].nunique()}R  cal={cal['race_id'].nunique()}R  "
          f"test={test['race_id'].nunique()}R")

    cat_idx = [F.FEATURE_COLS.index(c) for c in F.CATEGORICAL_COLS]

    heads = {}
    cal_raw = {}
    for pos in (1, 2, 3):
        print(f"⚡ LightGBM 学習中... (head{pos}: P({pos}着))")
        model, iso, p_ca = train_head(train, cal, pos, cat_idx)
        print(f"    best_iteration = {model.best_iteration}")
        heads[pos] = (model, iso)
        cal_raw[pos] = p_ca

    # ---- テスト評価 ----
    X_te, y_te = F.make_xy(test, fill_sentinel=False, position=1)
    test = test.copy()
    for pos in (1, 2, 3):
        model, iso = heads[pos]
        test[f"p{pos}"] = iso.predict(
            model.predict(X_te, num_iteration=model.best_iteration))
    test = F.normalize_within_race(test, "p1")

    p1_raw = heads[1][0].predict(X_te, num_iteration=heads[1][0].best_iteration)
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

    calib = F.calibration_table(test, "p1_norm")
    imp = sorted(zip(F.FEATURE_COLS, heads[1][0].feature_importance("gain")),
                 key=lambda x: -x[1])[:12]
    print("\n  head1 特徴量重要度 TOP12 (gain):")
    for name, v in imp:
        print(f"    {name:20s} {v:,.0f}")

    # ---- 保存 ----
    with open(MODEL_DIR / "lgbm_v2.pkl", "wb") as f:
        pickle.dump({
            "heads": {p: {"model": heads[p][0], "iso": heads[p][1]} for p in heads},
            "feature_cols": F.FEATURE_COLS,
            "categorical_cols": F.CATEGORICAL_COLS,
        }, f)
    report = {
        "model": "lgbm_v2",
        "architecture": "3-head LightGBM + generalized Plackett-Luce",
        "params": {k: str(v) for k, v in LGB_PARAMS.items()},
        "best_iterations": {p: int(heads[p][0].best_iteration) for p in heads},
        "n_train_races": int(train["race_id"].nunique()),
        "n_test_races": int(test["race_id"].nunique()),
        "test_period": [str(test["race_date"].min().date()),
                        str(test["race_date"].max().date())],
        "metrics": metrics,
        "backtest_3head": {k: v for k, v in res_new.items()},
        "feature_importance": [{"feature": n, "importance": round(float(v), 1)}
                               for n, v in imp],
        "calibration": calib.assign(bin=calib["bin"].astype(str)).to_dict("records"),
    }
    with open(F.DATA_DIR / "report_lgbm_v2.json", "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n✅ 保存: {MODEL_DIR/'lgbm_v2.pkl'} / {F.DATA_DIR/'report_lgbm_v2.json'}")


if __name__ == "__main__":
    main()
