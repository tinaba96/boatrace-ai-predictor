/**
 * データ取得サービス
 *
 * DB移行に備えて、データ取得ロジックを抽象化します。
 *
 * データソース切り替え:
 *   VITE_DATA_SOURCE=json     - JSONファイルから取得（デフォルト）
 *   VITE_DATA_SOURCE=supabase - Supabaseから取得
 *   VITE_DATA_SOURCE=api      - API経由で取得（将来用）
 */

import { supabaseDataService } from './supabaseDataService';

// データ取得モード: 'json', 'supabase', or 'api'
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'json';
const API_MODE = import.meta.env.VITE_API_MODE || DATA_SOURCE; // 後方互換性
const API_URL = import.meta.env.VITE_API_URL || '';
const BASE_URL = import.meta.env.BASE_URL || '';

// 起動時にデータソースをログ出力
console.log(`📊 データソース: ${DATA_SOURCE}`);

/**
 * リトライ機能付きfetch関数
 */
const fetchWithRetry = async (url, maxRetries = 3, retryDelay = 2000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`取得失敗 (${i + 1}/${maxRetries}):`, error.message);

      // 最後の試行でなければ待機してリトライ
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw lastError;
};

/**
 * データサービス
 */
export const dataService = {
  /**
   * レースデータを取得
   */
  async getRaces() {
    if (DATA_SOURCE === 'supabase') {
      // Supabaseから取得
      return supabaseDataService.getRaces();
    } else if (DATA_SOURCE === 'api' || API_MODE === 'api') {
      // API経由で取得
      const response = await fetchWithRetry(`${API_URL}/api/races`);
      return response.json();
    } else {
      // JSONファイルから取得
      const response = await fetchWithRetry(BASE_URL + 'data/races.json');
      return response.json();
    }
  },

  /**
   * 予想データを取得
   * @param {string} date - 日付文字列（YYYY-MM-DD形式）
   */
  async getPredictions(date) {
    if (DATA_SOURCE === 'supabase') {
      // Supabaseから取得
      return supabaseDataService.getPredictions(date);
    } else if (DATA_SOURCE === 'api' || API_MODE === 'api') {
      // API経由で取得
      const response = await fetchWithRetry(`${API_URL}/api/predictions?date=${date}`);
      return response.json();
    } else {
      // JSONファイルから取得
      const response = await fetchWithRetry(BASE_URL + `data/predictions/${date}.json`, 2, 1000);
      return response.json();
    }
  },

  /**
   * 精度統計データを取得
   */
  async getAccuracy() {
    if (DATA_SOURCE === 'supabase') {
      // Supabaseから取得
      return supabaseDataService.getAccuracy();
    } else if (DATA_SOURCE === 'api' || API_MODE === 'api') {
      // API経由で取得
      const response = await fetchWithRetry(`${API_URL}/api/accuracy`);
      return response.json();
    } else {
      // JSONファイルから取得
      const response = await fetchWithRetry(BASE_URL + 'data/predictions/summary.json');
      return response.json();
    }
  },

  /**
   * fetchWithRetry関数を外部に公開（後方互換性のため）
   */
  fetchWithRetry
};
