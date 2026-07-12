/**
 * boatrace.jp オッズページの共通パーサー
 *
 * odds3t（3連単）/ odds3f（3連複）ページは 6 セクション横並びの
 * rowspan テーブル構造。各セクション = 3列: [2着(rowspan>1), 3着, oddsPoint]。
 * セクションインデックス 0〜5 が 1着艇番 1〜6 に対応。
 *
 * 利用元: scrape-prediction-odds.js（予測買い目オッズ）、
 *         scrape-odds.js（全120通りスナップショット）
 */

/**
 * オッズテーブルをパースして買い目→オッズの Map を返す
 *
 * 3連複(odds3f)では重複組み合わせのセクションに is-disabled セルが入る。
 *
 * @param {import('cheerio').CheerioAPI} $
 * @param {boolean} sortBoats - true なら艇番を昇順ソート（3連複用）
 * @returns {Map<string, number>} "A-B-C" -> odds
 */
export function parseOddsTable($, sortBoats) {
  const map = new Map();
  const mainTable = $("table")
    .filter((_, t) => $(t).find(".oddsPoint").length > 0)
    .first();

  const NUM_SECTIONS = 6;
  // セクションごとに現在の「2着」艇番を保持（rowspan 跨ぎ用）
  const current2nd = new Array(NUM_SECTIONS).fill(null);
  // セクションごとの残り rowspan 行数（0 になったら次行でヘッダセル再登場）
  const rowspanLeft = new Array(NUM_SECTIONS).fill(0);

  mainTable.find("tbody tr").each((_, row) => {
    const tds = $(row).find("td").toArray();
    let tdIdx = 0;

    for (let section = 0; section < NUM_SECTIONS; section++) {
      if (tdIdx >= tds.length) break;

      const firstCell = $(tds[tdIdx]);
      const firstCls = firstCell.attr("class") || "";
      const firstRs = parseInt(firstCell.attr("rowspan") || "1");

      // rowspan が尽きていれば今行がこのセクションのヘッダ行
      const isHeaderRow = rowspanLeft[section] === 0;

      if (isHeaderRow) {
        // ヘッダセル（2着艇番）を読む
        rowspanLeft[section] = firstRs - 1;

        if (firstCls.includes("is-disabled")) {
          tdIdx += 3; // ヘッダ + 3着 + odds の 3 セルをスキップ
          continue;
        }

        current2nd[section] = parseInt(firstCell.text().trim());
        tdIdx++;
      } else {
        // 継続行（rowspan 延長中）
        rowspanLeft[section]--;

        if (firstCls.includes("is-disabled")) {
          tdIdx += 2; // 3着 + odds の 2 セルをスキップ
          continue;
        }
      }

      const thirdCell = $(tds[tdIdx++]);
      const oddsCell = $(tds[tdIdx++]);
      const third = parseInt(thirdCell.text().trim());
      const odds = parseFloat(oddsCell.text().trim());

      const first = section + 1;
      const second = current2nd[section];

      if (second && third && !isNaN(odds) && odds > 0) {
        const key = sortBoats
          ? [first, second, third].sort((a, b) => a - b).join("-")
          : `${first}-${second}-${third}`;
        map.set(key, odds);
      }
    }
  });

  return map;
}

/**
 * odds3t ページから全120通りの3連単オッズをパース
 * @param {import('cheerio').CheerioAPI} $
 * @returns {Map<string, number>} "1-2-3" -> odds
 */
export function parseTrifectaAll($) {
  return parseOddsTable($, false);
}

/**
 * odds3f ページから全3連複オッズをパース
 * @param {import('cheerio').CheerioAPI} $
 * @returns {Map<string, number>} "1-2-3"（昇順ソート済み）-> odds
 */
export function parseTrioAll($) {
  return parseOddsTable($, true);
}
