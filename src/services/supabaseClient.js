/**
 * Supabase クライアント（フロントエンド用）
 *
 * 環境変数:
 *   VITE_SUPABASE_URL - Supabase プロジェクトURL
 *   VITE_SUPABASE_ANON_KEY - Supabase anon key（公開キー）
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase環境変数が設定されていません。JSON モードで動作します。');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
