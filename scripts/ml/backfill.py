"""公式ダウンロードデータによる学習データのバックフィル（BOA-104）

boatrace.jp 公式のデイリーアーカイブ（B=番組表 / K=競走成績）を取得・解析し、
dataset.csv / start_timings.csv と同スキーマの CSV を生成する。
Supabase 蓄積開始（2025-12-03）以前の履歴を学習データに加えるのが目的。

データ仕様:
  URL: https://www1.mbrace.or.jp/od2/{B|K}/YYYYMM/{b|k}YYMMDD.lzh
  中身: Shift_JIS(cp932) の固定幅テキスト（1日1ファイルに全会場分）
  K/Bファイルに無い項目（3連率・展示ST・気温・水温・グレード）は欠損とする。

依存: lha コマンド（macOS: brew install lhasa）

使い方:
  .venv/bin/python backfill.py download --from=2024-01-01 --to=2025-12-02
  .venv/bin/python backfill.py parse
出力:
  data/ml/raw/{bYYMMDD.txt, kYYMMDD.txt}      展開済みテキスト（キャッシュ）
  data/ml/backfill_dataset.csv                dataset.csv 互換
  data/ml/backfill_start_timings.csv          start_timings.csv 互換
"""

from __future__ import annotations

import csv
import re
import subprocess
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "ml"
RAW_DIR = DATA_DIR / "raw"

BASE = "https://www1.mbrace.or.jp/od2"
UA = "BoatraceAIBot/1.0 (+https://github.com/rhapsody0919/boatrace-ai-predictor)"

VENUE_CODES = {
    "桐生": 1, "戸田": 2, "江戸川": 3, "平和島": 4, "多摩川": 5, "浜名湖": 6,
    "蒲郡": 7, "常滑": 8, "津": 9, "三国": 10, "びわこ": 11, "住之江": 12,
    "尼崎": 13, "鳴門": 14, "丸亀": 15, "児島": 16, "宮島": 17, "徳山": 18,
    "下関": 19, "若松": 20, "芦屋": 21, "福岡": 22, "唐津": 23, "大村": 24,
}

# dataset.csv と同一のカラム（features.build_features が要求する入力スキーマ）
DATASET_COLUMNS = [
    "race_id", "race_date", "venue_code", "race_number", "race_grade",
    "boat_number", "racer_id",
    "grade", "age", "win_rate", "local_win_rate",
    "global_2rate", "global_3rate", "local_2rate", "local_3rate",
    "motor_2rate", "motor_3rate", "boat_2rate", "boat_3rate",
    "exhibition_time", "exhibition_st",
    "weather", "wind_direction", "wind_speed", "wave_height",
    "temperature", "water_temperature", "series_day", "is_final_day",
    "finish_pos", "actual_course", "winning_technique",
    "payout_win", "payout_place_1", "payout_place_2",
    "payout_trifecta", "payout_trio", "rank1", "rank2", "rank3",
]

ST_COLUMNS = ["race_id", "race_date", "boat_number", "racer_id",
              "start_timing", "is_flying", "is_late_start"]


# ---------------------------------------------------------------------------
# ダウンロード
# ---------------------------------------------------------------------------

def daterange(d0: date, d1: date):
    d = d0
    while d <= d1:
        yield d
        d += timedelta(days=1)


def _download_one(d: date, kind: str, sleep_s: float) -> str:
    """1ファイル取得。'ok' | 'skip' | 'miss' を返す。"""
    ymd = d.strftime("%y%m%d")
    txt = RAW_DIR / f"{kind}{ymd}.txt"
    if txt.exists():
        return "skip"
    url = f"{BASE}/{kind.upper()}/{d.strftime('%Y%m')}/{kind}{ymd}.lzh"
    lzh = RAW_DIR / f"{kind}{ymd}.lzh"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            lzh.write_bytes(r.read())
        subprocess.run(
            ["lha", f"xqw={RAW_DIR}", str(lzh)],
            check=True, capture_output=True,
        )
        lzh.unlink()
        return "ok"
    except Exception as e:  # 404=開催なし日も含む
        lzh.unlink(missing_ok=True)
        if "404" not in str(e):
            print(f"  ⚠️ {url}: {e}", file=sys.stderr)
        return "miss"
    finally:
        time.sleep(sleep_s)


def download(d0: date, d1: date, sleep_s: float = 0.15, workers: int = 3):
    """B/K アーカイブを取得（3並列・キャッシュあり・レジューム可）。"""
    from concurrent.futures import ThreadPoolExecutor

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    jobs = [(d, kind) for d in daterange(d0, d1) for kind in ("b", "k")]
    counts = {"ok": 0, "skip": 0, "miss": 0}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for i, res in enumerate(
            ex.map(lambda j: _download_one(j[0], j[1], sleep_s), jobs), 1
        ):
            counts[res] += 1
            if i % 200 == 0:
                print(f"  … {i}/{len(jobs)} (ok={counts['ok']} "
                      f"skip={counts['skip']} miss={counts['miss']})", flush=True)
    print(f"✅ download: ok={counts['ok']} cached={counts['skip']} miss={counts['miss']}")


# ---------------------------------------------------------------------------
# Bファイル（番組表）解析: 艇別の勝率・機材データ
# ---------------------------------------------------------------------------

B_RACE_RE = re.compile(r"^[　\s]*([０-９0-9]{1,2})[ＲR]")
# 例: "1 3527中嶋誠一53長崎51A2 5.10 30.40 5.91 43.18 55 15.87 78 33.33 ..."
B_ENTRY_RE = re.compile(
    # 名前は全角4文字固定（2〜3文字名は全角スペース詰め）なので . で受ける。
    # モーター/ボート番号は3桁のとき直前の率と密着する（例: 32.91117）ため
    # 率は \d+\.\d{2} で止め、番号側は \s* 区切りで受ける。
    r"^([1-6])\s?(\d{4})(.{4})(\d{2})(\D{2,3}?)(\d{2})(A1|A2|B1|B2)\s*"
    r"(\d+\.\d{2})\s*(\d+\.\d{2})\s*(\d+\.\d{2})\s*(\d+\.\d{2})\s*"
    r"(\d{1,3})\s*(\d+\.\d{2})\s*(\d{1,3})\s*(\d+\.\d{2})"
)

ZEN2HAN = str.maketrans("０１２３４５６７８９", "0123456789")


def parse_b_file(path: Path) -> dict:
    """{(venue_code, race_no, boat): entry_dict}"""
    out = {}
    venue = None
    race_no = None
    for line in path.read_text(encoding="cp932", errors="replace").splitlines():
        m = re.match(r"^(\d{2})BBGN", line)
        if m:
            venue = int(m.group(1))
            continue
        if venue is None:
            continue
        m = B_RACE_RE.match(line)
        if m and ("締切" in line or "Ｒ" in line[:8]):
            race_no = int(m.group(1).translate(ZEN2HAN))
            continue
        m = B_ENTRY_RE.match(line.strip())
        if m and race_no is not None:
            boat = int(m.group(1))
            out[(venue, race_no, boat)] = {
                "racer_id": int(m.group(2)),
                "age": int(m.group(4)),
                "grade": m.group(7),
                "win_rate": float(m.group(8)),
                "global_2rate": float(m.group(9)),
                "local_win_rate": float(m.group(10)),
                "local_2rate": float(m.group(11)),
                "motor_2rate": float(m.group(13)),
                "boat_2rate": float(m.group(15)),
            }
    return out


# ---------------------------------------------------------------------------
# Kファイル（競走成績）解析: 着順・ST・展示・気象・払戻
# ---------------------------------------------------------------------------

# 例: "   1R       朝１戦予選　                 H1800m  曇り  風  北　　 5m  波　  5cm"
K_RACE_HDR_RE = re.compile(
    r"^\s{0,4}(\d{1,2})R\s+(\S+).*?H\d+m\s+(\S+)\s+風\s+(\S+?)\s+(\d+)m\s+波\s+(\d+)cm"
)
# 例: "  01  4 4861 田　中　　宏　樹 54   72  6.80   4    0.05     1.49.6"
#     着(01-06 or F/L/失/転...) 艇 登番 名前 ﾓｰﾀｰ ﾎﾞｰﾄ 展示 進入 ST ﾀｲﾑ
K_RESULT_RE = re.compile(
    r"^\s{2}(\S{1,2})\s+([1-6])\s+(\d{4})\s+(.{8,12}?)\s+\d+\s+\d+\s+"
    r"(\d\.\d{2}|\s*\.?\s*)\s+([1-6])\s+(F?L?\s?\.?-?\d*\.?\d{2}|\S+)"
)
K_DAY_RE = re.compile(r"第\s*(\d+)\s*日")
K_FINAL_RE = re.compile(r"最終日")


def _parse_st(raw: str):
    """'0.05' / 'F.05' / 'L.02' / '-' → (st, is_flying, is_late)"""
    raw = raw.replace(" ", "")
    is_f = raw.startswith("F")
    is_l = raw.startswith("L")
    m = re.search(r"(\d*\.\d{2})", raw)
    st = float(m.group(1)) if m else None
    if is_f and st is not None:
        st = -st  # フライングは負のSTとして記録（race_start_timings と同義）
    return st, is_f, is_l


def parse_k_file(path: Path, race_date: str) -> tuple[list, list]:
    """(race_rows, st_rows)

    race_rows: race単位のメタ+艇別着順（datasetマージ用の中間形式）
    """
    lines = path.read_text(encoding="cp932", errors="replace").splitlines()
    races = {}   # (venue, race_no) -> race dict
    st_rows = []
    venue = None
    series_day = None
    is_final = False
    in_races = False
    cur = None   # 現在パース中のレース

    for line in lines:
        m = re.match(r"^(\d{2})KBGN", line)
        if m:
            venue = int(m.group(1))
            series_day = None
            is_final = False
            in_races = False  # この会場でレースヘッダを見たか
            continue
        if venue is None:
            continue
        if not in_races:
            if series_day is None:
                md = K_DAY_RE.search(line)
                if md:
                    series_day = int(md.group(1))
            # 最終日は「第 N日」の代わりに「最終日」とだけ書かれることがある
            if K_FINAL_RE.search(line):
                is_final = True

        m = K_RACE_HDR_RE.match(line)
        if m:
            in_races = True
            race_no = int(m.group(1))
            cur = races.setdefault((venue, race_no), {
                "venue": venue, "race_no": race_no,
                "weather": m.group(3).replace("　", ""),
                "wind_direction": m.group(4).replace("　", ""),
                "wind_speed": int(m.group(5)),
                "wave_height": int(m.group(6)),
                "series_day": series_day, "is_final_day": is_final,
                "boats": {}, "payouts": {}, "ranks": {}, "technique": None,
            })
            # 決まり手はヘッダ行の末尾には無い（結果テーブル見出し行の右端にある）
            continue

        if cur is None:
            continue

        # 決まり手: 見出し行 "  着 艇 登番 ... ﾚｰｽﾀｲﾑ 逃げ" の末尾
        if "ﾚｰｽﾀｲﾑ" in line:
            tech = line.split("ﾚｰｽﾀｲﾑ")[-1].strip().replace("　", "")
            cur["technique"] = tech or None
            continue

        m = K_RESULT_RE.match(line)
        if m:
            rank_raw, boat, regno = m.group(1), int(m.group(2)), int(m.group(3))
            exh = m.group(5).strip()
            course = int(m.group(6))
            st, is_f, is_l = _parse_st(m.group(7))
            rank = int(rank_raw) if rank_raw.isdigit() else None
            cur["boats"][boat] = {
                "racer_id": regno,
                "exhibition_time": float(exh) if exh else None,
                "actual_course": course,
                "finish_pos_raw": rank,
            }
            if rank is not None and rank <= 3:
                cur["ranks"][rank] = boat
            if st is not None or is_f or is_l:
                st_rows.append({
                    "race_id": f"{race_date}-{venue:02d}-{cur['race_no']:02d}",
                    "race_date": race_date,
                    "boat_number": boat,
                    "racer_id": regno,
                    "start_timing": st,
                    "is_flying": is_f,
                    "is_late_start": is_l,
                })
            continue

        # 払戻: "        単勝     4          530" / "        ３連単   4-3-1     6080  人気    22"
        pm = re.match(r"^\s+(単勝|複勝|２連単|２連複|３連単|３連複|拡連複)\s+(.+)", line)
        if pm:
            kind, rest = pm.group(1), pm.group(2)
            nums = re.findall(r"([\d\-]+)\s+(\d+)", rest)
            if kind == "単勝" and nums:
                cur["payouts"]["win"] = int(nums[0][1])
            elif kind == "複勝":
                if len(nums) >= 1:
                    cur["payouts"]["place1"] = int(nums[0][1])
                if len(nums) >= 2:
                    cur["payouts"]["place2"] = int(nums[1][1])
            elif kind == "３連単" and nums:
                cur["payouts"]["santan"] = int(nums[0][1])
                cur["payouts"]["santan_combo"] = nums[0][0]
            elif kind == "３連複" and nums:
                cur["payouts"]["sanfuku"] = int(nums[0][1])
    return races, st_rows


# ---------------------------------------------------------------------------
# 結合して dataset 互換 CSV を生成
# ---------------------------------------------------------------------------

def parse_all():
    k_files = sorted(RAW_DIR.glob("k*.txt"))
    print(f"📦 解析対象: {len(k_files)}日分")
    ds_rows = []
    st_all = []
    n_races = 0

    for kf in k_files:
        ymd = kf.stem[1:]
        race_date = f"20{ymd[:2]}-{ymd[2:4]}-{ymd[4:6]}"
        bf = RAW_DIR / f"b{ymd}.txt"
        entries = parse_b_file(bf) if bf.exists() else {}
        races, st_rows = parse_k_file(kf, race_date)
        st_all.extend(st_rows)

        for (venue, race_no), race in races.items():
            ranks = race["ranks"]
            # 完走3着まで確定していないレース（中止等）はスキップ
            if len(ranks) < 3 or not race["payouts"].get("santan"):
                continue
            n_races += 1
            race_id = f"{race_date}-{venue:02d}-{race_no:02d}"
            for boat, kdata in race["boats"].items():
                b = entries.get((venue, race_no, boat), {})
                fp = kdata["finish_pos_raw"]
                ds_rows.append({
                    "race_id": race_id,
                    "race_date": race_date,
                    "venue_code": venue,
                    "race_number": race_no,
                    "race_grade": None,
                    "boat_number": boat,
                    "racer_id": kdata["racer_id"],
                    "grade": b.get("grade"),
                    "age": b.get("age"),
                    "win_rate": b.get("win_rate"),
                    "local_win_rate": b.get("local_win_rate"),
                    "global_2rate": b.get("global_2rate"),
                    "global_3rate": None,
                    "local_2rate": b.get("local_2rate"),
                    "local_3rate": None,
                    "motor_2rate": b.get("motor_2rate"),
                    "motor_3rate": None,
                    "boat_2rate": b.get("boat_2rate"),
                    "boat_3rate": None,
                    "exhibition_time": kdata["exhibition_time"],
                    "exhibition_st": None,
                    "weather": race["weather"],
                    "wind_direction": race["wind_direction"],
                    "wind_speed": race["wind_speed"],
                    "wave_height": race["wave_height"],
                    "temperature": None,
                    "water_temperature": None,
                    "series_day": race["series_day"],
                    "is_final_day": race["is_final_day"],
                    "finish_pos": fp if fp is not None and fp <= 3 else 0,
                    "actual_course": kdata["actual_course"],
                    "winning_technique": race["technique"],
                    "payout_win": race["payouts"].get("win"),
                    "payout_place_1": race["payouts"].get("place1"),
                    "payout_place_2": race["payouts"].get("place2"),
                    # ⚠️ DB命名の逆転に合わせる: trifecta=3連複 / trio=3連単
                    "payout_trifecta": race["payouts"].get("sanfuku"),
                    "payout_trio": race["payouts"].get("santan"),
                    "rank1": ranks.get(1),
                    "rank2": ranks.get(2),
                    "rank3": ranks.get(3),
                })

    def write(path, rows, cols):
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            for r in rows:
                w.writerow({k: ("" if r.get(k) is None else r[k]) for k in cols})

    write(DATA_DIR / "backfill_dataset.csv", ds_rows, DATASET_COLUMNS)
    write(DATA_DIR / "backfill_start_timings.csv", st_all, ST_COLUMNS)
    print(f"✅ backfill_dataset.csv: {len(ds_rows):,}行 / {n_races:,}レース")
    print(f"✅ backfill_start_timings.csv: {len(st_all):,}行")


def main():
    args = sys.argv[1:]
    if not args or args[0] not in ("download", "parse"):
        print(__doc__)
        sys.exit(1)
    if args[0] == "download":
        get = lambda k, d: next((a.split("=")[1] for a in args if a.startswith(f"--{k}=")), d)
        d0 = date.fromisoformat(get("from", "2024-01-01"))
        d1 = date.fromisoformat(get("to", "2025-12-02"))
        print(f"⬇️ 公式アーカイブ取得: {d0} 〜 {d1}")
        download(d0, d1)
    else:
        parse_all()


if __name__ == "__main__":
    main()
