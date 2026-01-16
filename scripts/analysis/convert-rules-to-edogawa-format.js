// 既存のrules.jsonを江戸川形式に変換するスクリプト
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 会場プレフィックスマッピング
const VENUE_PREFIX = {
  '01': 'K01',   // 桐生
  '02': 'T02',   // 戸田
  '03': 'E03',   // 江戸川
  '04': 'H04',   // 平和島
  '05': 'TM05',  // 多摩川
  '06': 'HN06',  // 浜名湖
  '07': 'G07',   // 蒲郡
  '08': 'TK08',  // 常滑
  '09': 'TS09',  // 津
  '10': 'M10',   // 三国
  '11': 'B11',   // びわこ
  '12': 'S12',   // 住之江
  '13': 'A13',   // 尼崎
  '14': 'N14',   // 鳴門
  '15': 'R15',   // 丸亀
  '16': 'KJ16',  // 児島
  '17': 'MY17',  // 宮島
  '18': 'TY18',  // 徳山
  '19': 'SK19',  // 下関
  '20': 'W20',   // 若松
  '21': 'AS21',  // 芦屋
  '22': 'F22',   // 福岡
  '23': 'KR23',  // 唐津
  '24': 'O24'    // 大村
};

// 信頼性判定
function determineReliability(samples, recovery) {
  if (samples >= 50 && recovery >= 100) return 'very_high';
  if (samples >= 30 && recovery >= 100) return 'high';
  if (samples >= 15 && recovery >= 100) return 'medium';
  return 'low';
}

// ルール名からconditionsを解析
function parseConditions(name, betType) {
  const conditions = {};

  // X号艇1着パターン
  const firstBoatMatch = name.match(/(\d)号艇1着/);
  if (firstBoatMatch) {
    conditions.top_pick = parseInt(firstBoatMatch[1]);
  }

  // +Y号艇含むパターン
  const includesMatch = name.match(/\+(\d)号艇含む/);
  if (includesMatch) {
    conditions.includes_boat = parseInt(includesMatch[1]);
  }

  // X,Y号艇含むパターン
  const pairIncludesMatch = name.match(/(\d),(\d)号艇含む/);
  if (pairIncludesMatch) {
    conditions.includes_boats = [parseInt(pairIncludesMatch[1]), parseInt(pairIncludesMatch[2])];
  }

  // X,Y,Z号艇パターン（完全一致）
  const trioMatch = name.match(/^(\d),(\d),(\d)号艇$/);
  if (trioMatch) {
    conditions.prediction_sorted = `${trioMatch[1]}-${trioMatch[2]}-${trioMatch[3]}`;
  }

  // conf80+パターン
  if (name.includes('conf80+')) {
    conditions.confidence = { min: 80 };
  }

  // 後半Rパターン
  if (name.includes('後半R') || name.includes('10R〜')) {
    conditions.race_number = { min: 10, max: 12 };
  }

  // 1号艇含まないパターン
  if (name.includes('1号艇含まない')) {
    conditions.excludes_boat_1 = true;
  }

  // 1号艇含む (1号艇含まないではない場合)
  if (name.includes('1号艇含む') && !name.includes('1号艇含まない')) {
    if (!conditions.includes_boat) {
      conditions.includes_boat_1 = true;
    }
  }

  return conditions;
}

// 備考生成
function generateNotes(samples, recovery, hitRate) {
  const notes = [];

  if (recovery >= 200) {
    notes.push('高回収率');
  } else if (recovery >= 150) {
    notes.push('好回収率');
  }

  if (samples >= 50) {
    notes.push('大サンプル');
  } else if (samples >= 30) {
    notes.push('サンプル十分');
  } else if (samples >= 20) {
    notes.push('サンプルやや少なめ');
  } else {
    notes.push('要検証');
  }

  if (parseFloat(hitRate) >= 50) {
    notes.push('高的中率');
  }

  return notes.join('、');
}

// ルールを変換
function convertRule(rule, betType, prefix, index) {
  const typeCode = betType === 'win' ? 'W' : betType === 'place' ? 'P' : 'T';
  const id = `${prefix}-${typeCode}${String(index + 1).padStart(3, '0')}`;

  const samples = rule.samples;
  const recovery = rule.recovery;
  const hitRate = rule.hitRate;

  return {
    id,
    name: rule.name,
    bet_type: betType,
    conditions: parseConditions(rule.name, betType),
    stats: {
      sample_size: samples,
      hit_rate: `${hitRate}%`,
      recovery_rate: `${recovery}%`,
      profit: Math.round((recovery - 100) * samples)
    },
    reliability: determineReliability(samples, recovery),
    notes: generateNotes(samples, recovery, hitRate)
  };
}

// 会場データを変換
function convertVenueRules(venueCode) {
  const analysisDir = path.join(__dirname, '..', '..', 'data', 'analysis', `venue-${venueCode}`);
  const rulesPath = path.join(analysisDir, 'rules.json');

  if (!fs.existsSync(rulesPath)) {
    console.log(`⚠️  ${venueCode}: rules.json not found`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

  // 既に江戸川形式かチェック
  if (data.win_rules?.[0]?.id) {
    console.log(`✅ ${venueCode} (${data.venue_name}): 既に江戸川形式`);
    return null;
  }

  const prefix = VENUE_PREFIX[venueCode];
  if (!prefix) {
    console.log(`⚠️  ${venueCode}: プレフィックス未定義`);
    return null;
  }

  const converted = {
    venue_code: venueCode,
    venue_name: data.venue_name,
    analysis_date: data.analysis_date,
    status: 'draft',
    sample_size: data.sample_size,
    period: data.period,
    win_rules: (data.win_rules || []).map((r, i) => convertRule(r, 'win', prefix, i)),
    place_rules: (data.place_rules || []).map((r, i) => convertRule(r, 'place', prefix, i)),
    trio_rules: (data.trio_rules || []).map((r, i) => convertRule(r, 'trio', prefix, i))
  };

  // 保存
  fs.writeFileSync(rulesPath, JSON.stringify(converted, null, 2));
  console.log(`✅ ${venueCode} (${data.venue_name}): 変換完了 (W:${converted.win_rules.length}, P:${converted.place_rules.length}, T:${converted.trio_rules.length})`);

  return converted;
}

// メイン処理
function main() {
  console.log('=== rules.json を江戸川形式に変換 ===\n');

  const analysisDir = path.join(__dirname, '..', '..', 'data', 'analysis');
  const venueDirs = fs.readdirSync(analysisDir)
    .filter(d => d.startsWith('venue-') && d !== 'venue-03') // 江戸川は除く
    .map(d => d.replace('venue-', ''))
    .sort();

  console.log(`対象会場: ${venueDirs.length}件\n`);

  let converted = 0;
  let skipped = 0;

  for (const venueCode of venueDirs) {
    const result = convertVenueRules(venueCode);
    if (result) {
      converted++;
    } else {
      skipped++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`変換: ${converted}件`);
  console.log(`スキップ: ${skipped}件`);
}

main();
