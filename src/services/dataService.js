/**
 * データ取得サービス
 *
 * Supabaseからデータを取得します。
 */

import { supabaseDataService } from './supabaseDataService';

// 起動時にログ出力
console.log('📊 データソース: Supabase');

/**
 * データサービス
 */
export const dataService = {
  /**
   * レースデータを取得
   */
  async getRaces() {
    return supabaseDataService.getRaces();
  },

  /**
   * 予想データを取得
   * @param {string} date - 日付文字列（YYYY-MM-DD形式）
   */
  async getPredictions(date) {
    return supabaseDataService.getPredictions(date);
  },

  /**
   * 精度統計データを取得
   */
  async getAccuracy() {
    return supabaseDataService.getAccuracy();
  }
};
