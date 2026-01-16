/**
 * 会場別ルールマッチングサービス
 *
 * RULE_SPECIFICATION.mdに基づいたルール判定を行う
 */

import { supabase } from './supabaseClient'

// 会場コードから会場名への変換
const VENUE_NAMES = {
  '01': '桐生', '02': '戸田', '03': '江戸川', '04': '平和島', '05': '多摩川', '06': '浜名湖',
  '07': '蒲郡', '08': '常滑', '09': '津', '10': '三国', '11': 'びわこ', '12': '住之江',
  '13': '尼崎', '14': '鳴門', '15': '丸亀', '16': '児島', '17': '宮島', '18': '徳山',
  '19': '下関', '20': '若松', '21': '芦屋', '22': '福岡', '23': '唐津', '24': '大村'
}

// 蒲郡（07）のルール定義
// 発掘データ: スタンダードモデル 655レース分析に基づく（2025年12月〜2026年1月）
const GAMAGORI_RULES = [
  // === 単勝ルール ===
  {
    id: 'G07-W001',
    patternName: 'GAMAGORI-WIN-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'win',
    stats: { samples: 55, hits: 12, recovery: 136 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'G07-W002',
    patternName: 'GAMAGORI-WIN-TOP3-INC4',
    description: '3号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 29, hits: 7, recovery: 199 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(4)
  },
  {
    id: 'G07-W003',
    patternName: 'GAMAGORI-WIN-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 25, hits: 7, recovery: 190 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },

  // === 複勝ルール ===
  {
    id: 'G07-P001',
    patternName: 'GAMAGORI-PLACE-TOP4-HC',
    description: '4号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 41, hits: 19, recovery: 135 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && conf >= 75
  },
  {
    id: 'G07-P002',
    patternName: 'GAMAGORI-PLACE-TOP2-INC1',
    description: '2号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 70, hits: 39, recovery: 113 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && has1
  },
  {
    id: 'G07-P003',
    patternName: 'GAMAGORI-PLACE-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 17, recovery: 134 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  }
]

// 福岡（22）のルール定義
// 発掘データ: スタンダードモデル 444レース詳細分析に基づく（2025年12月〜2026年1月）
const FUKUOKA_RULES = [
  // === 単勝ルール ===
  {
    id: 'F22-W001',
    patternName: 'FUKUOKA-WIN-TOP4-INC2',
    description: '4号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 13, hits: 5, recovery: 324 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(2)
  },
  {
    id: 'F22-W002',
    patternName: 'FUKUOKA-WIN-TOP4',
    description: '4号艇1着',
    betType: 'win',
    stats: { samples: 27, hits: 11, recovery: 227 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4
  },
  {
    id: 'F22-W003',
    patternName: 'FUKUOKA-WIN-TOP2-INC1',
    description: '2号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 29, hits: 14, recovery: 156 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && has1
  },

  // === 3連複ルール ===
  {
    id: 'F22-T001',
    patternName: 'FUKUOKA-TRIO-45X',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 44, hits: 4, recovery: 222 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'F22-T002',
    patternName: 'FUKUOKA-TRIO-NO1-HC',
    description: '1号艇含まない×conf80+',
    betType: 'trio',
    stats: { samples: 56, hits: 4, recovery: 193 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1 && conf >= 80
  },
  {
    id: 'F22-T003',
    patternName: 'FUKUOKA-TRIO-24X',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 70, hits: 6, recovery: 178 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },

  // === 複勝ルール ===
  {
    id: 'F22-P001',
    patternName: 'FUKUOKA-PLACE-TOP5-INC4',
    description: '5号艇1着+4号艇含む',
    betType: 'place',
    stats: { samples: 20, hits: 11, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(4)
  },
  {
    id: 'F22-P002',
    patternName: 'FUKUOKA-PLACE-TOP6-INC1',
    description: '6号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 19, hits: 8, recovery: 124 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && has1
  },
  {
    id: 'F22-P003',
    patternName: 'FUKUOKA-PLACE-TOP4-INC1',
    description: '4号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 17, hits: 11, recovery: 120 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && has1
  }
]

// 丸亀（15）のルール定義
// 発掘データ: スタンダードモデル 649レース詳細分析に基づく（2025年12月〜2026年1月）
// 注: 3連複は回収率100%超のルールがサンプル10以上で見つからなかった
const MARUGAME_RULES = [
  // === 単勝ルール ===
  {
    id: 'R15-W001',
    patternName: 'MARUGAME-WIN-TOP6-INC3',
    description: '6号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 3, recovery: 236 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && pred.top3.includes(3)
  },
  {
    id: 'R15-W002',
    patternName: 'MARUGAME-WIN-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 30, hits: 9, recovery: 205 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },
  {
    id: 'R15-W003',
    patternName: 'MARUGAME-WIN-TOP6-INC1',
    description: '6号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 35, hits: 4, recovery: 153 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && has1
  },

  // === 複勝ルール ===
  {
    id: 'R15-P001',
    patternName: 'MARUGAME-PLACE-TOP5-INC2',
    description: '5号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 12, recovery: 222 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(2)
  },
  {
    id: 'R15-P002',
    patternName: 'MARUGAME-PLACE-TOP5-INC1',
    description: '5号艇1着+1号艇含む',
    betType: 'place',
    stats: { samples: 30, hits: 15, recovery: 193 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && has1
  },
  {
    id: 'R15-P003',
    patternName: 'MARUGAME-PLACE-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 33, hits: 25, recovery: 165 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'R15-P004',
    patternName: 'MARUGAME-PLACE-TOP5',
    description: '5号艇1着',
    betType: 'place',
    stats: { samples: 56, hits: 24, recovery: 147 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5
  }
]

// びわこ（11）のルール定義
// 発掘データ: スタンダードモデル 534レース詳細分析に基づく（2025年12月〜2026年1月）
const BIWAKO_RULES = [
  // === 3連複ルール ===
  {
    id: 'B11-T001',
    patternName: 'BIWAKO-TRIO-56X',
    description: '5,6号艇含む',
    betType: 'trio',
    stats: { samples: 59, hits: 4, recovery: 185 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(5) && pred.top3.includes(6)
  },
  {
    id: 'B11-T002',
    patternName: 'BIWAKO-TRIO-46X',
    description: '4,6号艇含む',
    betType: 'trio',
    stats: { samples: 67, hits: 5, recovery: 174 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(6)
  },
  {
    id: 'B11-T003',
    patternName: 'BIWAKO-TRIO-16X',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 127, hits: 8, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },

  // === 単勝ルール ===
  {
    id: 'B11-W001',
    patternName: 'BIWAKO-WIN-TOP6-INC2',
    description: '6号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 5, recovery: 162 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 6 && pred.top3.includes(2)
  },
  {
    id: 'B11-W002',
    patternName: 'BIWAKO-WIN-TOP2-INC4',
    description: '2号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 25, hits: 12, recovery: 160 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(4)
  },
  {
    id: 'B11-W003',
    patternName: 'BIWAKO-WIN-TOP1-MC',
    description: '1号艇1着×conf60-74',
    betType: 'win',
    stats: { samples: 13, hits: 6, recovery: 132 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 60 && conf < 75
  },

  // === 複勝ルール ===
  {
    id: 'B11-P001',
    patternName: 'BIWAKO-PLACE-TOP2-INC4',
    description: '2号艇1着+4号艇含む',
    betType: 'place',
    stats: { samples: 25, hits: 17, recovery: 127 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(4)
  },
  {
    id: 'B11-P002',
    patternName: 'BIWAKO-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 17, hits: 11, recovery: 122 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'B11-P003',
    patternName: 'BIWAKO-PLACE-TOP1-INC2',
    description: '1号艇1着+2号艇含む',
    betType: 'place',
    stats: { samples: 124, hits: 105, recovery: 116 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(2)
  }
]

// 浜名湖（06）のルール定義
// 発掘データ: スタンダードモデル 624レース詳細分析に基づく（2025年12月〜2026年1月）
const HAMANAKO_RULES = [
  // === 3連複ルール ===
  {
    id: 'H06-T001',
    patternName: 'HAMANAKO-TRIO-26X',
    description: '2,6号艇含む',
    betType: 'trio',
    stats: { samples: 94, hits: 6, recovery: 485 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(6)
  },
  {
    id: 'H06-T002',
    patternName: 'HAMANAKO-TRIO-36X',
    description: '3,6号艇含む',
    betType: 'trio',
    stats: { samples: 87, hits: 2, recovery: 475 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(6)
  },
  {
    id: 'H06-T003',
    patternName: 'HAMANAKO-TRIO-23X',
    description: '2,3号艇含む',
    betType: 'trio',
    stats: { samples: 140, hits: 14, recovery: 396 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(3)
  },

  // === 単勝ルール ===
  {
    id: 'H06-W001',
    patternName: 'HAMANAKO-WIN-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 33, hits: 10, recovery: 231 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'H06-W002',
    patternName: 'HAMANAKO-WIN-TOP3-INC1',
    description: '3号艇1着+1号艇含む',
    betType: 'win',
    stats: { samples: 46, hits: 12, recovery: 181 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'H06-W003',
    patternName: 'HAMANAKO-WIN-TOP3',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 78, hits: 20, recovery: 139 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },

  // === 複勝ルール ===
  {
    id: 'H06-P001',
    patternName: 'HAMANAKO-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 15, hits: 8, recovery: 215 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'H06-P002',
    patternName: 'HAMANAKO-PLACE-TOP3-INC6',
    description: '3号艇1着+6号艇含む',
    betType: 'place',
    stats: { samples: 27, hits: 18, recovery: 186 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(6)
  },
  {
    id: 'H06-P003',
    patternName: 'HAMANAKO-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 64, hits: 40, recovery: 141 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  }
]

// 三国（10）のルール定義
// 発掘データ: スタンダードモデル 511レース詳細分析に基づく（2025年12月〜2026年1月）
const MIKUNI_RULES = [
  // === 3連複ルール ===
  {
    id: 'M10-T001',
    patternName: 'MIKUNI-TRIO-24X',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 96, hits: 3, recovery: 1865 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'M10-T002',
    patternName: 'MIKUNI-TRIO-15X',
    description: '1,5号艇含む',
    betType: 'trio',
    stats: { samples: 129, hits: 6, recovery: 144 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(5)
  },

  // === 複勝ルール ===
  {
    id: 'M10-P001',
    patternName: 'MIKUNI-PLACE-TOP3-INC5',
    description: '3号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 18, hits: 11, recovery: 391 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(5)
  },
  {
    id: 'M10-P002',
    patternName: 'MIKUNI-PLACE-TOP3-HC',
    description: '3号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 46, hits: 30, recovery: 214 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 75
  },
  {
    id: 'M10-P003',
    patternName: 'MIKUNI-PLACE-TOP2-HC',
    description: '2号艇1着×conf75+',
    betType: 'place',
    stats: { samples: 64, hits: 43, recovery: 134 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 75
  },

  // === 単勝ルール ===
  {
    id: 'M10-W001',
    patternName: 'MIKUNI-WIN-TOP5-INC4',
    description: '5号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 4, recovery: 181 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(4)
  },
  {
    id: 'M10-W002',
    patternName: 'MIKUNI-WIN-TOP5-HC',
    description: '5号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 43, hits: 7, recovery: 140 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && conf >= 80
  }
]

// 江戸川（03）のルール定義
// 発掘データ: スタンダードモデル 492レース分析に基づく（2025年12月〜2026年1月）
const EDOGAWA_RULES = [
  // === 単勝ルール ===
  {
    id: 'E03-W003',
    patternName: 'EDOGAWA-WIN-TOP3-SUB1-MC',
    description: '3号艇1着+1号艇2着予測×conf70+',
    betType: 'win',
    stats: { samples: 21, hits: 10, recovery: 182 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3?.[1] === 1 && conf >= 70
  },
  {
    id: 'E03-W002',
    patternName: 'EDOGAWA-WIN-TOP2-EARLY',
    description: '2号艇1着予測×4R以前',
    betType: 'win',
    stats: { samples: 22, hits: 10, recovery: 148 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && raceNo <= 4
  },
  {
    id: 'E03-W004',
    patternName: 'EDOGAWA-WIN-TOP3-MC',
    description: '3号艇1着予測×conf70+',
    betType: 'win',
    stats: { samples: 50, hits: 16, recovery: 111 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 70
  },
  {
    id: 'E03-W005',
    patternName: 'EDOGAWA-WIN-TOP2-MC',
    description: '2号艇1着予測×conf75+',
    betType: 'win',
    stats: { samples: 60, hits: 22, recovery: 100 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 75
  },

  // === 3連複ルール ===
  {
    id: 'E03-T002',
    patternName: 'EDOGAWA-TRIO-123-LATE-HC',
    description: '予測123×9R以降×conf80+',
    betType: 'trio',
    stats: { samples: 30, hits: 5, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-3' && raceNo >= 9 && conf >= 80
  },
  {
    id: 'E03-T001-M',
    patternName: 'EDOGAWA-TRIO-12X-LATE-HC',
    description: '予測123or124×9R以降×conf80+',
    betType: 'trio',
    stats: { samples: 50, hits: 6, recovery: 113 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      ['1-2-4', '1-2-3'].includes(predSorted) && raceNo >= 9 && conf >= 80
  },
  {
    id: 'E03-T004-S',
    patternName: 'EDOGAWA-TRIO-INC1-MID-HC',
    description: '1号艇含む×5R以降×conf85+',
    betType: 'trio',
    stats: { samples: 228, hits: 20, recovery: 104 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 5 && conf >= 85
  },
  {
    id: 'E03-T004-L',
    patternName: 'EDOGAWA-TRIO-INC1-LATE-HC',
    description: '1号艇含む×9R以降×conf85+',
    betType: 'trio',
    stats: { samples: 134, hits: 11, recovery: 104 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 9 && conf >= 85
  },

  // === 複勝ルール ===
  {
    id: 'E03-P002',
    patternName: 'EDOGAWA-PLACE-TOP1-LATE',
    description: '1号艇1着予測×9R以降',
    betType: 'place',
    stats: { samples: 122, hits: 100, recovery: 113 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && raceNo >= 9
  },
  {
    id: 'E03-P003',
    patternName: 'EDOGAWA-PLACE-TOP1-HC',
    description: '1号艇1着予測×conf85+',
    betType: 'place',
    stats: { samples: 239, hits: 185, recovery: 111 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 85
  }
]

// 下関（19）のルール定義
// 発掘データ: スタンダードモデル 480レース詳細分析に基づく（2025年12月〜2026年1月）
const SHIMONOSEKI_RULES = [
  // === 単勝ルール ===
  {
    id: 'S19-W001',
    patternName: 'SHIMONOSEKI-WIN-TOP3-INC2',
    description: '3号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 20, hits: 5, recovery: 217 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && pred.top3.includes(2)
  },
  {
    id: 'S19-W002',
    patternName: 'SHIMONOSEKI-WIN-TOP5-INC3',
    description: '5号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 15, hits: 3, recovery: 207 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(3)
  },
  {
    id: 'S19-W003',
    patternName: 'SHIMONOSEKI-WIN-TOP5-INC2',
    description: '5号艇1着+2号艇含む',
    betType: 'win',
    stats: { samples: 18, hits: 3, recovery: 178 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 5 && pred.top3.includes(2)
  },
  {
    id: 'S19-W004',
    patternName: 'SHIMONOSEKI-WIN-TOP2-INC3',
    description: '2号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 22, hits: 9, recovery: 166 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(3)
  },

  // === 複勝ルール ===
  {
    id: 'S19-P001',
    patternName: 'SHIMONOSEKI-PLACE-TOP4-INC5',
    description: '4号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 11, hits: 6, recovery: 215 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(5)
  },
  {
    id: 'S19-P002',
    patternName: 'SHIMONOSEKI-PLACE-TOP2-INC5',
    description: '2号艇1着+5号艇含む',
    betType: 'place',
    stats: { samples: 16, hits: 5, recovery: 168 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && pred.top3.includes(5)
  },
  {
    id: 'S19-P003',
    patternName: 'SHIMONOSEKI-PLACE-TOP4-INC6',
    description: '4号艇1着+6号艇含む',
    betType: 'place',
    stats: { samples: 14, hits: 6, recovery: 151 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && pred.top3.includes(6)
  },
  {
    id: 'S19-P004',
    patternName: 'SHIMONOSEKI-PLACE-TOP2-HC',
    description: '2号艇1着×conf80+',
    betType: 'place',
    stats: { samples: 47, hits: 24, recovery: 126 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  },

  // === 3連複ルール ===
  {
    id: 'S19-T001',
    patternName: 'SHIMONOSEKI-TRIO-35X',
    description: '3,5号艇含む',
    betType: 'trio',
    stats: { samples: 57, hits: 4, recovery: 122 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(5)
  },
  {
    id: 'S19-T002',
    patternName: 'SHIMONOSEKI-TRIO-23X',
    description: '2,3号艇含む',
    betType: 'trio',
    stats: { samples: 117, hits: 15, recovery: 107 },
    reliability: 'medium',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(3)
  }
]

// 会場コードごとのルール
const VENUE_RULES = {
  '03': EDOGAWA_RULES,
  '06': HAMANAKO_RULES,
  '07': GAMAGORI_RULES,
  '10': MIKUNI_RULES,
  '11': BIWAKO_RULES,
  '15': MARUGAME_RULES,
  '19': SHIMONOSEKI_RULES,
  '22': FUKUOKA_RULES
  // 他の会場は分析完了後に追加
}

/**
 * 予測に対してマッチするルールを取得
 * @param {Object} prediction - 予測データ
 * @param {string} venueCode - 会場コード（2桁の文字列）
 * @param {number} raceNo - レース番号（1-12）
 * @returns {Array} マッチしたルールの配列
 */
export function getMatchingRules(prediction, venueCode, raceNo) {
  const rules = VENUE_RULES[venueCode]
  if (!rules) return []

  const conf = prediction.confidence || 0
  const top3 = prediction.top3 || [prediction.topPick, prediction.top2nd, prediction.top3rd]
  const predSorted = [...top3].sort((a, b) => a - b).join('-')
  const has1 = top3.includes(1)

  const matchedRules = []

  for (const rule of rules) {
    try {
      if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
        matchedRules.push({
          id: rule.id,
          patternName: rule.patternName,
          description: rule.description,
          betType: rule.betType,
          stats: rule.stats,
          reliability: rule.reliability
        })
      }
    } catch (e) {
      // ルールチェック中のエラーは無視
    }
  }

  // 回収率順にソート（高い順）
  matchedRules.sort((a, b) => b.stats.recovery - a.stats.recovery)

  return matchedRules
}

/**
 * 賭け方の日本語名を取得
 */
export function getBetTypeName(betType) {
  const names = {
    'trio': '3連複',
    'trifecta': '3連単',
    'win': '単勝',
    'place': '複勝'
  }
  return names[betType] || betType
}

/**
 * 信頼性レベルの日本語名を取得
 */
export function getReliabilityName(reliability) {
  const names = {
    'highest': '最高',
    'high': '高',
    'medium': '中',
    'low': '低'
  }
  return names[reliability] || reliability
}

/**
 * ルールが登録されている会場かどうか
 */
export function hasRulesForVenue(venueCode) {
  return !!VENUE_RULES[venueCode]
}

/**
 * 会場のルール一覧を取得
 */
export function getRulesForVenue(venueCode) {
  return VENUE_RULES[venueCode] || []
}

/**
 * 会場名を取得
 */
export function getVenueName(venueCode) {
  return VENUE_NAMES[venueCode] || `会場${venueCode}`
}

/**
 * 今日のルールマッチレースを取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {Promise<Array>} マッチしたレースの配列
 */
export async function getTodaysMatchingRaces(date) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return []
  }

  // 予測データを取得（standardモデルのみ）
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .like('race_id', `${date}-%`)
    .eq('model_id', 'standard')

  if (predError) {
    console.error('予測取得エラー:', predError.message)
    return []
  }

  if (!predictions || predictions.length === 0) {
    return []
  }

  // 結果データを取得
  const raceIds = predictions.map(p => p.race_id)
  const { data: results, error: resError } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds)

  const resultsMap = {}
  if (!resError && results) {
    results.forEach(r => { resultsMap[r.race_id] = r })
  }

  // レース情報を取得（締切時刻）
  const { data: races, error: raceError } = await supabase
    .from('races')
    .select('race_id, start_time')
    .in('race_id', raceIds)

  const racesMap = {}
  if (!raceError && races) {
    races.forEach(r => { racesMap[r.race_id] = r })
  }

  // ルールマッチング
  const matchedRaces = []

  for (const pred of predictions) {
    // race_id形式: YYYY-MM-DD-XX-RR (XX=会場コード, RR=レース番号)
    const parts = pred.race_id.split('-')
    const venueCode = parts[3]
    const raceNo = parseInt(parts[4])

    // 予測データをフロントエンド形式に変換
    const prediction = {
      confidence: pred.confidence,
      topPick: pred.top_pick,
      top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
    }

    const rules = getMatchingRules(prediction, venueCode, raceNo)

    if (rules.length > 0) {
      const result = resultsMap[pred.race_id]
      const raceInfo = racesMap[pred.race_id]

      // 的中判定
      let hitInfo = null
      if (result) {
        const predSorted = [...prediction.top3].sort((a, b) => a - b).join('-')
        const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')

        for (const rule of rules) {
          if (rule.betType === 'trio') {
            const isHit = predSorted === resultSorted
            if (isHit) {
              hitInfo = { hit: true, payout: result.payout_trio || 0 }
              break
            }
          } else if (rule.betType === 'win') {
            const isHit = prediction.topPick === result.rank1
            if (isHit) {
              hitInfo = { hit: true, payout: result.payout_win || 0 }
              break
            }
          } else if (rule.betType === 'place') {
            const isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
            if (isHit) {
              const payout = prediction.topPick === result.rank1
                ? (result.payout_place_1 || 0)
                : (result.payout_place_2 || 0)
              hitInfo = { hit: true, payout }
              break
            }
          }
        }

        if (!hitInfo) {
          hitInfo = { hit: false, payout: 0 }
        }
      }

      matchedRaces.push({
        raceId: pred.race_id,
        venueCode,
        venueName: getVenueName(venueCode),
        raceNo,
        startTime: raceInfo?.start_time || null,
        prediction,
        rules,
        result: result ? {
          finished: true,
          rank1: result.rank1,
          rank2: result.rank2,
          rank3: result.rank3,
          payout_trio: result.payout_trio,
          payout_win: result.payout_win,
          payout_place_1: result.payout_place_1,
          payout_place_2: result.payout_place_2
        } : null,
        hitInfo
      })
    }
  }

  // レース番号順にソート
  matchedRaces.sort((a, b) => {
    if (a.venueCode !== b.venueCode) {
      return a.venueCode.localeCompare(b.venueCode)
    }
    return a.raceNo - b.raceNo
  })

  return matchedRaces
}

/**
 * ルールが登録されている会場のリストを取得
 */
export function getAvailableVenues() {
  return Object.keys(VENUE_RULES).map(code => ({
    code,
    name: VENUE_NAMES[code]
  }))
}

/**
 * 会場別ルール運用成績を取得
 * @param {string} venueCode - 会場コード
 * @param {string} startDate - 運用開始日（YYYY-MM-DD形式）
 * @returns {Promise<Object>} ルール別成績と全体成績
 */
export async function getRulePerformanceByVenue(venueCode, startDate) {
  if (!supabase) {
    console.warn('Supabaseが設定されていません')
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  const rules = VENUE_RULES[venueCode]
  if (!rules) {
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  // startDate以降の予測データを取得（指定会場のみ）
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('*')
    .gte('predicted_at', startDate)
    .like('race_id', `%-${venueCode}-%`)
    .eq('model_id', 'standard')

  if (predError || !predictions) {
    console.error('予測取得エラー:', predError?.message)
    return { byRule: [], total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 }, startDate }
  }

  // 結果データを取得
  const raceIds = predictions.map(p => p.race_id)
  if (raceIds.length === 0) {
    // ルール一覧は返すが、サンプル0
    return {
      byRule: rules.map(r => ({
        ruleId: r.id,
        description: r.description,
        betType: r.betType,
        samples: 0,
        hits: 0,
        hitRate: 0,
        recovery: 0
      })),
      total: { samples: 0, hits: 0, hitRate: 0, recovery: 0 },
      startDate
    }
  }

  const { data: results } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds)

  const resultsMap = {}
  if (results) {
    results.forEach(r => { resultsMap[r.race_id] = r })
  }

  // ルール別に集計
  const ruleStats = {}
  rules.forEach(r => {
    ruleStats[r.id] = {
      ruleId: r.id,
      description: r.description,
      betType: r.betType,
      samples: 0,
      hits: 0,
      totalPayout: 0
    }
  })

  for (const pred of predictions) {
    const parts = pred.race_id.split('-')
    const raceNo = parseInt(parts[4])

    const prediction = {
      confidence: pred.confidence,
      topPick: pred.top_pick,
      top3: [pred.top_pick, pred.top_2nd, pred.top_3rd]
    }

    const conf = prediction.confidence || 0
    const top3 = prediction.top3
    const predSorted = [...top3].sort((a, b) => a - b).join('-')
    const has1 = top3.includes(1)

    const result = resultsMap[pred.race_id]

    for (const rule of rules) {
      try {
        if (rule.check(prediction, raceNo, conf, predSorted, has1)) {
          // 結果確定分のみカウント
          if (result) {
            ruleStats[rule.id].samples++

            // 的中判定
            let isHit = false
            let payout = 0

            if (rule.betType === 'trio') {
              const resultSorted = [result.rank1, result.rank2, result.rank3].sort((a, b) => a - b).join('-')
              isHit = predSorted === resultSorted
              payout = result.payout_trio || 0
            } else if (rule.betType === 'win') {
              isHit = prediction.topPick === result.rank1
              payout = result.payout_win || 0
            } else if (rule.betType === 'place') {
              isHit = prediction.topPick === result.rank1 || prediction.topPick === result.rank2
              payout = prediction.topPick === result.rank1
                ? (result.payout_place_1 || 0)
                : (result.payout_place_2 || 0)
            }

            if (isHit) {
              ruleStats[rule.id].hits++
              ruleStats[rule.id].totalPayout += payout
            }
          }
        }
      } catch (e) {
        // ルールチェック中のエラーは無視
      }
    }
  }

  // 集計結果をフォーマット
  const byRule = Object.values(ruleStats).map(stat => ({
    ruleId: stat.ruleId,
    description: stat.description,
    betType: stat.betType,
    samples: stat.samples,
    hits: stat.hits,
    hitRate: stat.samples > 0 ? Math.round((stat.hits / stat.samples) * 100) : 0,
    recovery: stat.samples > 0 ? Math.round((stat.totalPayout / (stat.samples * 100)) * 100) : 0
  }))

  // 全体集計
  const totalSamples = byRule.reduce((sum, r) => sum + r.samples, 0)
  const totalHits = byRule.reduce((sum, r) => sum + r.hits, 0)
  const totalPayout = Object.values(ruleStats).reduce((sum, r) => sum + r.totalPayout, 0)

  return {
    byRule,
    total: {
      samples: totalSamples,
      hits: totalHits,
      hitRate: totalSamples > 0 ? Math.round((totalHits / totalSamples) * 100) : 0,
      recovery: totalSamples > 0 ? Math.round((totalPayout / (totalSamples * 100)) * 100) : 0
    },
    startDate
  }
}

export default {
  getMatchingRules,
  getBetTypeName,
  getReliabilityName,
  hasRulesForVenue,
  getRulesForVenue,
  getVenueName,
  getAvailableVenues,
  getTodaysMatchingRaces,
  getRulePerformanceByVenue
}
