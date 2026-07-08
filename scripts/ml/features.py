"""ポアロ予想 共通基盤（BOA-104）

データ読み込み・特徴量エンジニアリング・時系列分割・
Plackett-Luce展開・バックテストを V1(RF) / V2(LightGBM) で共有する。

設計原則:
  - リーク禁止: ローリング特徴量は必ず shift(1)、分割は時系列順
  - 確率主義: 的中率ではなく log loss / キャリブレーション / 回収率で評価
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "ml"

GRADE_ORD = {"B2": 1, "B1": 2, "A2": 3, "A1": 4}

# 学習に使う特徴量カラム（ラベル・payout系は含めない）
FEATURE_COLS = [
    # 艇・会場（コースバイアスの主役）
    "boat_number", "venue_code", "race_number",
    # 選手
    "grade_ord", "age", "win_rate", "local_win_rate",
    "global_2rate", "global_3rate", "local_2rate", "local_3rate",
    # 機材
    "motor_2rate", "motor_3rate", "boat_2rate", "boat_3rate",
    # 直前情報
    "exhibition_time", "exhibition_st",
    # 気象
    "wind_direction_code", "weather_code", "wind_speed", "wave_height",
    "temperature", "water_temperature",
    # 節・グレード
    "series_day", "is_final_day_num", "race_grade_code",
    # ローリング（過去のみ参照）
    "st_hist_mean", "st_hist_n", "recent_win_rate", "recent_races",
    # レース内相対値
    "win_rate_rank", "win_rate_diff", "exh_time_rank", "exh_st_rank",
    "motor_2rate_rank", "st_hist_rank",
]

CATEGORICAL_COLS = [
    "boat_number", "venue_code", "wind_direction_code", "weather_code",
    "race_grade_code",
]

# 16方位 → 0-15 のコード（北=0 から時計回り）
WIND_DIRS = [
    "北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東",
    "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西",
]
WIND_DIR_CODE = {d: i for i, d in enumerate(WIND_DIRS)}

# 固定語彙マッピング（cat.codes はデータ依存でコードがズレるため使用しない）
WEATHER_CODE = {"晴": 0, "曇り": 1, "雨": 2, "雪": 3}
RACE_GRADE_CODE = {"ippan": 0, "G3": 1, "G2": 2, "G1": 3, "SG": 4}

SENTINEL = -999.0


def load_dataset() -> pd.DataFrame:
    """dataset.csv + start_timings.csv を読み、特徴量を構築して返す。"""
    df = pd.read_csv(DATA_DIR / "dataset.csv")
    st = pd.read_csv(DATA_DIR / "start_timings.csv")
    return build_features(df, st)


def build_features(df: pd.DataFrame, st: pd.DataFrame) -> pd.DataFrame:
    """生の艇別レコード（学習 or 推論）から特徴量を構築する。

    推論時は df にラベル列（finish_pos 等）が NaN の当日行を含めてよい。
    ローリング特徴量は shift(1) 済みのため、当日行には過去情報のみが乗る。
    """
    df = df.copy()
    df["race_date"] = pd.to_datetime(df["race_date"])
    st = st.copy()
    st["race_date"] = pd.to_datetime(st["race_date"])

    # ---- 基本変換 ----
    df["grade_ord"] = df["grade"].map(GRADE_ORD)
    df["is_final_day_num"] = pd.to_numeric(
        df["is_final_day"].replace({True: 1, False: 0, "true": 1, "false": 0}),
        errors="coerce",
    )
    df["race_grade_code"] = df["race_grade"].map(RACE_GRADE_CODE)
    df["weather_code"] = df["weather"].map(WEATHER_CODE)
    # 風向テキスト（例: '南南西'）→ 0-15 コード
    df["wind_direction_code"] = df["wind_direction"].map(WIND_DIR_CODE)

    # ---- ローリング特徴量（本番ST履歴: 過去レースのみ） ----
    st = st.dropna(subset=["racer_id", "start_timing"]).sort_values(
        ["racer_id", "race_date", "race_id"]
    )
    g = st.groupby("racer_id")["start_timing"]
    st["st_hist_mean"] = g.transform(
        lambda s: s.shift(1).rolling(30, min_periods=3).mean()
    )
    st["st_hist_n"] = g.transform(lambda s: s.shift(1).expanding().count())
    st_feat = st[["race_id", "boat_number", "st_hist_mean", "st_hist_n"]]
    df = df.merge(st_feat, on=["race_id", "boat_number"], how="left")

    # ---- ローリング特徴量（直近勝率: 過去レースのみ） ----
    df = df.sort_values(["racer_id", "race_date", "race_id"]).reset_index(drop=True)
    df["is_win"] = (df["finish_pos"] == 1).astype(int)
    gw = df.groupby("racer_id")["is_win"]
    df["recent_win_rate"] = gw.transform(
        lambda s: s.shift(1).rolling(60, min_periods=10).mean()
    )
    df["recent_races"] = gw.transform(lambda s: s.shift(1).expanding().count())

    # ---- レース内相対値 ----
    grp = df.groupby("race_id")
    df["win_rate_rank"] = grp["win_rate"].rank(ascending=False, method="min")
    df["win_rate_diff"] = df["win_rate"] - grp["win_rate"].transform("mean")
    df["exh_time_rank"] = grp["exhibition_time"].rank(ascending=True, method="min")
    df["exh_st_rank"] = grp["exhibition_st"].rank(ascending=True, method="min")
    df["motor_2rate_rank"] = grp["motor_2rate"].rank(ascending=False, method="min")
    df["st_hist_rank"] = grp["st_hist_mean"].rank(ascending=True, method="min")

    return df.sort_values(["race_date", "race_id", "boat_number"]).reset_index(
        drop=True
    )


def time_split(df: pd.DataFrame, train_frac=0.70, cal_frac=0.15):
    """レース単位・時系列順に train / calibration / test へ分割。"""
    race_order = df.drop_duplicates("race_id")[["race_id", "race_date"]].sort_values(
        ["race_date", "race_id"]
    )["race_id"].tolist()
    n = len(race_order)
    train_ids = set(race_order[: int(n * train_frac)])
    cal_ids = set(race_order[int(n * train_frac): int(n * (train_frac + cal_frac))])
    test_ids = set(race_order[int(n * (train_frac + cal_frac)):])
    return (
        df[df["race_id"].isin(train_ids)],
        df[df["race_id"].isin(cal_ids)],
        df[df["race_id"].isin(test_ids)],
    )


def make_xy(df: pd.DataFrame, fill_sentinel: bool, position: int = 1):
    """position: 1=1着, 2=2着, 3=3着 をラベルにする（ポジション別ヘッド用）。"""
    X = df[FEATURE_COLS].astype(float)
    if fill_sentinel:
        X = X.fillna(SENTINEL)
    y = (df["finish_pos"] == position).astype(int)
    return X, y


def normalize_within_race(df: pd.DataFrame, prob_col: str) -> pd.DataFrame:
    """レース内で確率を正規化（合計=1）。"""
    s = df.groupby("race_id")[prob_col].transform("sum")
    df[prob_col + "_norm"] = df[prob_col] / s.replace(0, np.nan)
    return df


# ---------------------------------------------------------------------------
# Plackett-Luce（Harville + 指数減衰補正）
# ---------------------------------------------------------------------------

def trifecta_probs_3head(p1, p2, p3, boats):
    """ポジション別強度による一般化 Plackett-Luce。

    P(i,j,k) = p1_i/Σp1 × p2_j/(Σp2 - p2_i) × p3_k/(Σp3 - p3_i - p3_j)
    2着・3着の強度を専用モデルで学習するため、指数減衰補正は不要になる。
    """
    p1 = np.clip(p1, 1e-6, None)
    p2 = np.clip(p2, 1e-6, None)
    p3 = np.clip(p3, 1e-6, None)
    p1 = p1 / p1.sum()
    out = {}
    s2, s3 = p2.sum(), p3.sum()
    n = len(boats)
    for a in range(n):
        pa = p1[a]
        d2 = s2 - p2[a]
        for b in range(n):
            if b == a:
                continue
            pb = p2[b] / d2
            d3 = s3 - p3[a] - p3[b]
            for c in range(n):
                if c == a or c == b:
                    continue
                out[(boats[a], boats[b], boats[c])] = pa * pb * (p3[c] / d3)
    return out


def best_trifecta_3head(p1, p2, p3, boats):
    probs = trifecta_probs_3head(p1, p2, p3, boats)
    combo = max(probs, key=probs.get)
    return combo, probs[combo]



def backtest_3head(test_df: pd.DataFrame, c1: str, c2: str, c3: str,
                   conf_thresholds=(0.0, 0.05, 0.10, 0.15, 0.20)) -> tuple:
    """ポジション別3ヘッド確率で 単勝 / 3連単 / 3連複 の1点買いをバックテスト。

    ⚠️ DB列名の英語は逆転している（scrape-results.js のコメント参照）:
       payout_trifecta = 3連複の払戻 / payout_trio = 3連単の払戻
    """
    rows = []
    for race_id, race in test_df.groupby("race_id"):
        if len(race) != 6:
            continue
        boats = race["boat_number"].to_numpy()
        p1 = race[c1].to_numpy()
        p2 = race[c2].to_numpy()
        p3 = race[c3].to_numpy()
        if np.isnan(p1).any() or np.isnan(p2).any() or np.isnan(p3).any():
            continue
        if p1.sum() <= 0:
            continue
        p1n = p1 / p1.sum()
        top = int(boats[np.argmax(p1n)])
        combo, combo_p = best_trifecta_3head(p1, p2, p3, boats)
        first = race.iloc[0]
        actual = (first["rank1"], first["rank2"], first["rank3"])
        exact_hit = combo == actual                      # 3連単（順序一致）
        set_hit = set(combo) == set(actual)              # 3連複（順不同）
        rows.append({
            "race_id": race_id,
            "win_pick": top,
            "win_p": float(p1n.max()),
            "win_hit": top == first["rank1"],
            "payout_win": first["payout_win"] if top == first["rank1"] else 0,
            "tri_pick": combo,
            "tri_p": combo_p,
            "exact_hit": exact_hit,
            "payout_exact": first["payout_trio"] if exact_hit else 0,      # 3連単払戻
            "set_hit": set_hit,
            "payout_set": first["payout_trifecta"] if set_hit else 0,      # 3連複払戻
        })
    bt = pd.DataFrame(rows)
    result = {"n_races": len(bt)}
    result["win_hit_rate"] = bt["win_hit"].mean()
    result["win_recovery"] = bt["payout_win"].sum() / (len(bt) * 100)
    result["santan_hit_rate"] = bt["exact_hit"].mean()
    result["santan_recovery"] = bt["payout_exact"].sum() / (len(bt) * 100)
    result["sanfuku_hit_rate"] = bt["set_hit"].mean()
    result["sanfuku_recovery"] = bt["payout_set"].sum() / (len(bt) * 100)
    filt = []
    for th in conf_thresholds:
        sel = bt[bt["tri_p"] >= th]
        if len(sel) == 0:
            continue
        filt.append({
            "threshold": th,
            "n_bets": len(sel),
            "santan_hit_rate": sel["exact_hit"].mean(),
            "santan_recovery": sel["payout_exact"].sum() / (len(sel) * 100),
            "sanfuku_hit_rate": sel["set_hit"].mean(),
            "sanfuku_recovery": sel["payout_set"].sum() / (len(sel) * 100),
        })
    result["confidence_filter"] = filt
    return result, bt


def calibration_table(df: pd.DataFrame, prob_col: str, n_bins=10) -> pd.DataFrame:
    """予測確率 vs 実勝率のキャリブレーション表。"""
    d = df.dropna(subset=[prob_col]).copy()
    d["bin"] = pd.qcut(d[prob_col], n_bins, duplicates="drop")
    return d.groupby("bin", observed=True).agg(
        n=("is_win", "size"),
        pred_mean=(prob_col, "mean"),
        actual_win=("is_win", "mean"),
    ).reset_index()
