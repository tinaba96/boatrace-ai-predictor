/**
 * バッチ処理用 Supabaseクライアント
 *
 * 環境変数:
 *   SUPABASE_URL - Supabase URL
 *   SUPABASE_SERVICE_KEY - Service Role Key (書き込み権限あり)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local を読み込み
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase環境変数が未設定です。Supabaseへの書き込みはスキップされます。');
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export const isSupabaseEnabled = () => !!supabase;

/**
 * 会場コード→会場名のマッピング
 */
export const VENUE_NAMES = {
  1: '桐生', 2: '戸田', 3: '江戸川', 4: '平和島', 5: '多摩川', 6: '浜名湖',
  7: '蒲郡', 8: '常滑', 9: '津', 10: '三国', 11: 'びわこ', 12: '住之江',
  13: '尼崎', 14: '鳴門', 15: '丸亀', 16: '児島', 17: '宮島', 18: '徳山',
  19: '下関', 20: '若松', 21: '芦屋', 22: '福岡', 23: '唐津', 24: '大村'
};

/**
 * 会場名→会場コードの逆引き
 */
export const VENUE_CODES = Object.fromEntries(
  Object.entries(VENUE_NAMES).map(([code, name]) => [name, parseInt(code)])
);
