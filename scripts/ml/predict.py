"""ポアロ予想 推論スクリプト（BOA-104）

学習済み V1(RF) / V2(LightGBM) の3ヘッドモデルで、inference.csv の
レースを予測し JSON を出力する。ローリング特徴量のために履歴
（dataset.csv / start_timings.csv）を連結して特徴量を構築する。

実行:
  scripts/ml/.venv/bin/python scripts/ml/predict.py
出力:
  data/ml/poirot-predictions.json
    [{ race_id, model_version, win_probs, top_pick, top_2nd, top_3rd,
       trifecta_prob }]
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd

import features as F

MODEL_DIR = Path(__file__).resolve().parent / "models"

MODELS = {
    "rf-v1": {"file": "rf_v1.pkl", "sentinel": True},
    "lgbm-v2": {"file": "lgbm_v2.pkl", "sentinel": False},
}


def predict_heads(bundle, X, sentinel: bool):
    """3ヘッドのキャリブレーション済み確率を返す。"""
    out = {}
    for pos, head in bundle["heads"].items():
        model, iso = head["model"], head["iso"]
        if hasattr(model, "predict_proba"):  # sklearn RF
            raw = model.predict_proba(X)[:, 1]
        else:  # LightGBM Booster
            raw = model.predict(X, num_iteration=model.best_iteration)
        out[int(pos)] = iso.predict(raw)
    return out


def main():
    inf_path = F.DATA_DIR / "inference.csv"
    if not inf_path.exists():
        raise SystemExit("❌ inference.csv がありません（export-inference-data.js を先に実行）")

    hist = pd.read_csv(F.DATA_DIR / "dataset.csv")
    st = pd.read_csv(F.DATA_DIR / "start_timings.csv")
    inf = pd.read_csv(inf_path)
    if len(inf) == 0:
        print(json.dumps([]))
        (F.DATA_DIR / "poirot-predictions.json").write_text("[]")
        print("📭 推論対象なし")
        return

    target_ids = set(inf["race_id"])
    # 履歴に同一レースが混ざっていれば除去してから連結（再実行の冪等性）
    hist = hist[~hist["race_id"].isin(target_ids)]
    combined = pd.concat([hist, inf], ignore_index=True)
    feat = F.build_features(combined, st)
    today = feat[feat["race_id"].isin(target_ids)].copy()
    print(f"📊 推論対象: {today['race_id'].nunique()}レース {len(today)}行")

    results = []
    for version, spec in MODELS.items():
        path = MODEL_DIR / spec["file"]
        if not path.exists():
            print(f"⚠️ {version}: モデル未学習のためスキップ ({path.name})")
            continue
        with open(path, "rb") as f:
            bundle = pickle.load(f)

        X = today[bundle["feature_cols"]].astype(float)
        if spec["sentinel"]:
            X = X.fillna(F.SENTINEL)
        probs = predict_heads(bundle, X, spec["sentinel"])
        today_v = today.copy()
        for pos in (1, 2, 3):
            today_v[f"p{pos}"] = probs[pos]

        for race_id, race in today_v.groupby("race_id"):
            if len(race) != 6:
                continue
            boats = race["boat_number"].to_numpy()
            p1 = race["p1"].to_numpy()
            p2 = race["p2"].to_numpy()
            p3 = race["p3"].to_numpy()
            if p1.sum() <= 0 or np.isnan(p1).any():
                continue
            p1n = p1 / p1.sum()
            combo, combo_p = F.best_trifecta_3head(p1, p2, p3, boats)
            results.append({
                "race_id": race_id,
                "model_version": version,
                "win_probs": {str(int(b)): round(float(p), 4)
                              for b, p in zip(boats, p1n)},
                "top_pick": int(combo[0]),
                "top_2nd": int(combo[1]),
                "top_3rd": int(combo[2]),
                "trifecta_prob": round(float(combo_p), 5),
            })
        print(f"✅ {version}: {sum(1 for r in results if r['model_version'] == version)}レース予測")

    out_path = F.DATA_DIR / "poirot-predictions.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"💾 {out_path} ({len(results)}件)")


if __name__ == "__main__":
    main()
