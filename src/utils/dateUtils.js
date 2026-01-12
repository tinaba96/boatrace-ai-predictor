/**
 * 日付ユーティリティ（フロントエンド用）
 * JST（日本標準時）での日付処理を一元管理
 */

const JST_OFFSET = 9 * 60; // UTC+9 in minutes

/**
 * 現在のJST日時を取得
 * @returns {Date} JST日時のDateオブジェクト
 */
export const getJSTNow = () => {
  const now = new Date();
  return new Date(now.getTime() + JST_OFFSET * 60 * 1000);
};

/**
 * 今日の日付をJSTで取得
 * @returns {string} YYYY-MM-DD形式
 */
export const getTodayJST = () => {
  return getJSTNow().toISOString().split('T')[0];
};

/**
 * 昨日の日付をJSTで取得
 * @returns {string} YYYY-MM-DD形式
 */
export const getYesterdayJST = () => {
  const jstNow = getJSTNow();
  const yesterday = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().split('T')[0];
};

/**
 * N日前の日付をJSTで取得
 * @param {number} days - 何日前か
 * @returns {string} YYYY-MM-DD形式
 */
export const getDaysAgoJST = (days) => {
  const jstNow = getJSTNow();
  const target = new Date(jstNow.getTime() - days * 24 * 60 * 60 * 1000);
  return target.toISOString().split('T')[0];
};

/**
 * JST日付情報を一括取得
 * 注意: Dateオブジェクトは返さない（Reactの依存配列で無限ループの原因になるため）
 * @returns {Object} todayStr, yesterdayStr
 */
export const getJSTDateInfo = () => {
  const todayStr = getTodayJST();
  const yesterdayStr = getYesterdayJST();
  return { todayStr, yesterdayStr };
};

/**
 * 過去N日分の日付リストを取得
 * @param {number} days - 日数
 * @returns {string[]} YYYY-MM-DD形式の日付配列
 */
export const getDateListJST = (days) => {
  return Array.from({ length: days }, (_, i) => getDaysAgoJST(i));
};

/**
 * 日付文字列から年月日情報を抽出
 * @param {string} dateStr - YYYY-MM-DD形式
 * @returns {Object} { year, month, day }
 */
export const parseDateInfo = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
};

/**
 * 今月の日付範囲を取得
 * @returns {Object} { start, end, year, month }
 */
export const getThisMonthRange = () => {
  const jstNow = getJSTNow();
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth() + 1;
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  return { start, end, year, month };
};

/**
 * 先月の日付範囲を取得
 * @returns {Object} { start, end, year, month }
 */
export const getLastMonthRange = () => {
  const jstNow = getJSTNow();
  let year = jstNow.getUTCFullYear();
  let month = jstNow.getUTCMonth(); // 0-indexed, so this is already "last month"

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  return { start, end, year, month };
};

/**
 * 日付が今日かどうかを判定
 * @param {string} dateStr - YYYY-MM-DD形式
 * @returns {boolean}
 */
export const isToday = (dateStr) => {
  return dateStr === getTodayJST();
};

/**
 * 日付が昨日かどうかを判定
 * @param {string} dateStr - YYYY-MM-DD形式
 * @returns {boolean}
 */
export const isYesterday = (dateStr) => {
  return dateStr === getYesterdayJST();
};
