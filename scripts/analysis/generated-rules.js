// 自動生成されたルール定義（2026-01-16）
// scripts/analysis/generate-rule-code.js で生成

// 尼崎（13）のルール定義
const AMAGASAKI_RULES = [
  {
    id: 'A13-W009',
    patternName: 'AMAGASAKI-WIN-W009',
    description: '1号艇1着',
    betType: 'win',
    stats: { samples: 220, hits: 144, recovery: 100 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'A13-W008',
    patternName: 'AMAGASAKI-WIN-W008',
    description: '1号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 187, hits: 127, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 80
  },
  {
    id: 'A13-T004',
    patternName: 'AMAGASAKI-TRIO-T004',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 51, hits: 7, recovery: 671 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'A13-T005',
    patternName: 'AMAGASAKI-TRIO-T005',
    description: '3,6号艇含む',
    betType: 'trio',
    stats: { samples: 42, hits: 5, recovery: 541 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(6)
  },
  {
    id: 'A13-T008',
    patternName: 'AMAGASAKI-TRIO-T008',
    description: '1,5号艇含む',
    betType: 'trio',
    stats: { samples: 120, hits: 21, recovery: 419 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(5)
  },
]

// 鳴門（14）のルール定義
const NARUTO_RULES = [
  {
    id: 'N14-P006',
    patternName: 'NARUTO-PLACE-P006',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 205, hits: 170, recovery: 104 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'N14-T005',
    patternName: 'NARUTO-TRIO-T005',
    description: '後半R×1号艇含む',
    betType: 'trio',
    stats: { samples: 92, hits: 18, recovery: 678 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'N14-T009',
    patternName: 'NARUTO-TRIO-T009',
    description: '1,2号艇含む',
    betType: 'trio',
    stats: { samples: 199, hits: 46, recovery: 577 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2)
  },
  {
    id: 'N14-T015',
    patternName: 'NARUTO-TRIO-T015',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 296, hits: 63, recovery: 522 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  },
]

// 児島（16）のルール定義
const KOJIMA_RULES = [
  {
    id: 'KJ16-W006',
    patternName: 'KOJIMA-WIN-W006',
    description: '4号艇1着',
    betType: 'win',
    stats: { samples: 44, hits: 10, recovery: 123 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4
  },
  {
    id: 'KJ16-W014',
    patternName: 'KOJIMA-WIN-W014',
    description: '2号艇1着',
    betType: 'win',
    stats: { samples: 63, hits: 21, recovery: 111 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2
  },
  {
    id: 'KJ16-P002',
    patternName: 'KOJIMA-PLACE-P002',
    description: '4号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 36, hits: 26, recovery: 170 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 4 && conf >= 80
  },
  {
    id: 'KJ16-P010',
    patternName: 'KOJIMA-PLACE-P010',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 156, hits: 142, recovery: 119 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'KJ16-T001',
    patternName: 'KOJIMA-TRIO-T001',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 43, hits: 11, recovery: 798 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'KJ16-T003',
    patternName: 'KOJIMA-TRIO-T003',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 120, hits: 23, recovery: 471 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  },
  {
    id: 'KJ16-T006',
    patternName: 'KOJIMA-TRIO-T006',
    description: '1,2号艇含む',
    betType: 'trio',
    stats: { samples: 155, hits: 35, recovery: 438 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2)
  },
]

// 宮島（17）のルール定義
const MIYAJIMA_RULES = [
  {
    id: 'MY17-W001',
    patternName: 'MIYAJIMA-WIN-W001',
    description: '1号艇1着×後半R',
    betType: 'win',
    stats: { samples: 56, hits: 43, recovery: 121 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'MY17-W004',
    patternName: 'MIYAJIMA-WIN-W004',
    description: '1号艇1着+3号艇含む',
    betType: 'win',
    stats: { samples: 95, hits: 62, recovery: 105 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(3)
  },
  {
    id: 'MY17-P003',
    patternName: 'MIYAJIMA-PLACE-P003',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 190, hits: 163, recovery: 114 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'MY17-P002',
    patternName: 'MIYAJIMA-PLACE-P002',
    description: '3号艇1着+1号艇含む(複勝)',
    betType: 'place',
    stats: { samples: 44, hits: 37, recovery: 125 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && has1
  },
  {
    id: 'MY17-T002',
    patternName: 'MIYAJIMA-TRIO-T002',
    description: '1,2,6号艇',
    betType: 'trio',
    stats: { samples: 30, hits: 8, recovery: 1129 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-6'
  },
  {
    id: 'MY17-T003',
    patternName: 'MIYAJIMA-TRIO-T003',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 101, hits: 20, recovery: 780 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },
  {
    id: 'MY17-T004',
    patternName: 'MIYAJIMA-TRIO-T004',
    description: '5,6号艇含む',
    betType: 'trio',
    stats: { samples: 55, hits: 7, recovery: 779 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(5) && pred.top3.includes(6)
  },
]

// 徳山（18）のルール定義
const TOKUYAMA_RULES = [
  {
    id: 'TY18-W005',
    patternName: 'TOKUYAMA-WIN-W005',
    description: '3号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 43, hits: 11, recovery: 175 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 80
  },
  {
    id: 'TY18-W006',
    patternName: 'TOKUYAMA-WIN-W006',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 59, hits: 16, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'TY18-P007',
    patternName: 'TOKUYAMA-PLACE-P007',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 206, hits: 184, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TY18-T012',
    patternName: 'TOKUYAMA-TRIO-T012',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 279, hits: 71, recovery: 647 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  },
  {
    id: 'TY18-T007',
    patternName: 'TOKUYAMA-TRIO-T007',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 81, hits: 15, recovery: 779 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'TY18-T009',
    patternName: 'TOKUYAMA-TRIO-T009',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 127, hits: 31, recovery: 686 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  },
]

// 若松（20）のルール定義
const WAKAMATSU_RULES = [
  {
    id: 'W20-T006',
    patternName: 'WAKAMATSU-TRIO-T006',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 111, hits: 20, recovery: 453 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  },
  {
    id: 'W20-T009',
    patternName: 'WAKAMATSU-TRIO-T009',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 117, hits: 30, recovery: 402 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
  {
    id: 'W20-T012',
    patternName: 'WAKAMATSU-TRIO-T012',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 236, hits: 42, recovery: 344 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  },
]

// 芦屋（21）のルール定義
const ASHIYA_RULES = [
  {
    id: 'AS21-W009',
    patternName: 'ASHIYA-WIN-W009',
    description: '後半R(10R〜)単勝',
    betType: 'win',
    stats: { samples: 95, hits: 47, recovery: 112 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'AS21-W012',
    patternName: 'ASHIYA-WIN-W012',
    description: '1号艇1着×後半R',
    betType: 'win',
    stats: { samples: 50, hits: 40, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'AS21-P001',
    patternName: 'ASHIYA-PLACE-P001',
    description: '3号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 46, hits: 33, recovery: 132 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'AS21-P002',
    patternName: 'ASHIYA-PLACE-P002',
    description: '3号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 39, hits: 29, recovery: 131 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 80
  },
  {
    id: 'AS21-T002',
    patternName: 'ASHIYA-TRIO-T002',
    description: '後半R×1号艇含まない',
    betType: 'trio',
    stats: { samples: 32, hits: 4, recovery: 7417 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12 && !has1
  },
  {
    id: 'AS21-T003',
    patternName: 'ASHIYA-TRIO-T003',
    description: '4,6号艇含む',
    betType: 'trio',
    stats: { samples: 42, hits: 5, recovery: 4800 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(6)
  },
  {
    id: 'AS21-T005',
    patternName: 'ASHIYA-TRIO-T005',
    description: '2,6号艇含む',
    betType: 'trio',
    stats: { samples: 62, hits: 6, recovery: 3734 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(6)
  },
]

// 唐津（23）のルール定義
const KARATSU_RULES = [
  {
    id: 'KR23-W005',
    patternName: 'KARATSU-WIN-W005',
    description: '1号艇1着×conf80+',
    betType: 'win',
    stats: { samples: 195, hits: 132, recovery: 101 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && conf >= 80
  },
  {
    id: 'KR23-W002',
    patternName: 'KARATSU-WIN-W002',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 31, hits: 5, recovery: 152 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'KR23-P010',
    patternName: 'KARATSU-PLACE-P010',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 228, hits: 198, recovery: 110 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'KR23-P007',
    patternName: 'KARATSU-PLACE-P007',
    description: '3号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 31, hits: 22, recovery: 154 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'KR23-T003',
    patternName: 'KARATSU-TRIO-T003',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 77, hits: 17, recovery: 678 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },
  {
    id: 'KR23-T005',
    patternName: 'KARATSU-TRIO-T005',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 80, hits: 22, recovery: 563 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'KR23-T013',
    patternName: 'KARATSU-TRIO-T013',
    description: '1,2号艇含む',
    betType: 'trio',
    stats: { samples: 201, hits: 58, recovery: 430 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(2)
  },
]

// 大村（24）のルール定義
const OMURA_RULES = [
  {
    id: 'O24-W002',
    patternName: 'OMURA-WIN-W002',
    description: '1号艇1着+5号艇含む',
    betType: 'win',
    stats: { samples: 60, hits: 41, recovery: 109 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(5)
  },
  {
    id: 'O24-P003',
    patternName: 'OMURA-PLACE-P003',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 255, hits: 221, recovery: 113 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'O24-T002',
    patternName: 'OMURA-TRIO-T002',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 63, hits: 15, recovery: 871 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'O24-T001',
    patternName: 'OMURA-TRIO-T001',
    description: '1,3,5号艇',
    betType: 'trio',
    stats: { samples: 30, hits: 7, recovery: 1044 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-3-5'
  },
  {
    id: 'O24-T004',
    patternName: 'OMURA-TRIO-T004',
    description: '後半R×1号艇含む',
    betType: 'trio',
    stats: { samples: 94, hits: 21, recovery: 760 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && raceNo >= 10 && raceNo <= 12
  },
]

// 桐生（01）のルール定義
const KIRYU_RULES = [
  {
    id: 'K01-W002',
    patternName: 'KIRYU-WIN-W002',
    description: '1号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 67, hits: 43, recovery: 105 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(4)
  },
  {
    id: 'K01-P006',
    patternName: 'KIRYU-PLACE-P006',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 186, hits: 162, recovery: 105 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'K01-T005',
    patternName: 'KIRYU-TRIO-T005',
    description: '1号艇含まない×conf80+',
    betType: 'trio',
    stats: { samples: 35, hits: 1, recovery: 951 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      conf >= 80 && !has1
  },
  {
    id: 'K01-T006',
    patternName: 'KIRYU-TRIO-T006',
    description: '1号艇含まない',
    betType: 'trio',
    stats: { samples: 41, hits: 1, recovery: 812 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1
  },
  {
    id: 'K01-T010',
    patternName: 'KIRYU-TRIO-T010',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 131, hits: 25, recovery: 392 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
]

// 戸田（02）のルール定義
const TODA_RULES = [
  {
    id: 'T02-W004',
    patternName: 'TODA-WIN-W004',
    description: '3号艇1着',
    betType: 'win',
    stats: { samples: 39, hits: 11, recovery: 121 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3
  },
  {
    id: 'T02-P004',
    patternName: 'TODA-PLACE-P004',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 191, hits: 166, recovery: 132 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'T02-P002',
    patternName: 'TODA-PLACE-P002',
    description: '後半R(10R〜)複勝',
    betType: 'place',
    stats: { samples: 91, hits: 71, recovery: 153 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'T02-T008',
    patternName: 'TODA-TRIO-T008',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 123, hits: 39, recovery: 689 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
  {
    id: 'T02-T005',
    patternName: 'TODA-TRIO-T005',
    description: '3,4号艇含む',
    betType: 'trio',
    stats: { samples: 47, hits: 13, recovery: 821 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(4)
  },
  {
    id: 'T02-T010',
    patternName: 'TODA-TRIO-T010',
    description: '2,3号艇含む',
    betType: 'trio',
    stats: { samples: 80, hits: 24, recovery: 594 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(3)
  },
]

// 平和島（04）のルール定義
const HEIWAJIMA_RULES = [
  {
    id: 'H04-P005',
    patternName: 'HEIWAJIMA-PLACE-P005',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 233, hits: 194, recovery: 128 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'H04-P003',
    patternName: 'HEIWAJIMA-PLACE-P003',
    description: '後半R(10R〜)複勝',
    betType: 'place',
    stats: { samples: 105, hits: 75, recovery: 144 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      raceNo >= 10 && raceNo <= 12
  },
  {
    id: 'H04-T001',
    patternName: 'HEIWAJIMA-TRIO-T001',
    description: '4,5号艇含む',
    betType: 'trio',
    stats: { samples: 37, hits: 7, recovery: 1165 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(4) && pred.top3.includes(5)
  },
  {
    id: 'H04-T003',
    patternName: 'HEIWAJIMA-TRIO-T003',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 81, hits: 18, recovery: 768 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
  {
    id: 'H04-T007',
    patternName: 'HEIWAJIMA-TRIO-T007',
    description: '1号艇含まない',
    betType: 'trio',
    stats: { samples: 63, hits: 8, recovery: 601 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1
  },
]

// 多摩川（05）のルール定義
const TAMAGAWA_RULES = [
  {
    id: 'TM05-P008',
    patternName: 'TAMAGAWA-PLACE-P008',
    description: '2号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 76, hits: 54, recovery: 138 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2
  },
  {
    id: 'TM05-P005',
    patternName: 'TAMAGAWA-PLACE-P005',
    description: '2号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 61, hits: 44, recovery: 145 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 2 && conf >= 80
  },
  {
    id: 'TM05-T002',
    patternName: 'TAMAGAWA-TRIO-T002',
    description: '5,6号艇含む',
    betType: 'trio',
    stats: { samples: 57, hits: 8, recovery: 944 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(5) && pred.top3.includes(6)
  },
  {
    id: 'TM05-T005',
    patternName: 'TAMAGAWA-TRIO-T005',
    description: '1,6号艇含む',
    betType: 'trio',
    stats: { samples: 96, hits: 15, recovery: 687 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(6)
  },
  {
    id: 'TM05-T011',
    patternName: 'TAMAGAWA-TRIO-T011',
    description: '1号艇含む×conf80+',
    betType: 'trio',
    stats: { samples: 296, hits: 62, recovery: 459 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && conf >= 80
  },
]

// 常滑（08）のルール定義
const TOKONAME_RULES = [
  {
    id: 'TK08-W005',
    patternName: 'TOKONAME-WIN-W005',
    description: '1号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 92, hits: 60, recovery: 102 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(4)
  },
  {
    id: 'TK08-P011',
    patternName: 'TOKONAME-PLACE-P011',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 219, hits: 193, recovery: 106 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TK08-P003',
    patternName: 'TOKONAME-PLACE-P003',
    description: '3号艇1着×conf80+(複勝)',
    betType: 'place',
    stats: { samples: 53, hits: 34, recovery: 140 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 3 && conf >= 80
  },
  {
    id: 'TK08-T002',
    patternName: 'TOKONAME-TRIO-T002',
    description: '1,2,4号艇',
    betType: 'trio',
    stats: { samples: 47, hits: 13, recovery: 858 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-2-4'
  },
  {
    id: 'TK08-T005',
    patternName: 'TOKONAME-TRIO-T005',
    description: '1,4号艇含む',
    betType: 'trio',
    stats: { samples: 150, hits: 35, recovery: 524 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(4)
  },
  {
    id: 'TK08-T004',
    patternName: 'TOKONAME-TRIO-T004',
    description: '2,4号艇含む',
    betType: 'trio',
    stats: { samples: 80, hits: 15, recovery: 537 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(2) && pred.top3.includes(4)
  },
]

// 津（09）のルール定義
const TSU_RULES = [
  {
    id: 'TS09-W003',
    patternName: 'TSU-WIN-W003',
    description: '1号艇1着+5号艇含む',
    betType: 'win',
    stats: { samples: 55, hits: 36, recovery: 118 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(5)
  },
  {
    id: 'TS09-W004',
    patternName: 'TSU-WIN-W004',
    description: '1号艇1着+4号艇含む',
    betType: 'win',
    stats: { samples: 64, hits: 43, recovery: 100 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1 && pred.top3.includes(4)
  },
  {
    id: 'TS09-P004',
    patternName: 'TSU-PLACE-P004',
    description: '1号艇1着(複勝)',
    betType: 'place',
    stats: { samples: 172, hits: 149, recovery: 106 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.topPick === 1
  },
  {
    id: 'TS09-T001',
    patternName: 'TSU-TRIO-T001',
    description: '1,3,4号艇',
    betType: 'trio',
    stats: { samples: 32, hits: 8, recovery: 764 },
    reliability: 'high',
    check: (pred, raceNo, conf, predSorted, has1) =>
      predSorted === '1-3-4'
  },
  {
    id: 'TS09-T002',
    patternName: 'TSU-TRIO-T002',
    description: '3,4号艇含む',
    betType: 'trio',
    stats: { samples: 51, hits: 9, recovery: 588 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      pred.top3.includes(3) && pred.top3.includes(4)
  },
  {
    id: 'TS09-T005',
    patternName: 'TSU-TRIO-T005',
    description: '1,3号艇含む',
    betType: 'trio',
    stats: { samples: 127, hits: 28, recovery: 397 },
    reliability: 'highest',
    check: (pred, raceNo, conf, predSorted, has1) =>
      has1 && pred.top3.includes(3)
  },
]


// VENUE_RULESへの追加エントリ
// 以下をVENUE_RULESオブジェクトに追加してください:
/*
  '13': AMAGASAKI_RULES,
  '14': NARUTO_RULES,
  '16': KOJIMA_RULES,
  '17': MIYAJIMA_RULES,
  '18': TOKUYAMA_RULES,
  '20': WAKAMATSU_RULES,
  '21': ASHIYA_RULES,
  '23': KARATSU_RULES,
  '24': OMURA_RULES,
  '01': KIRYU_RULES,
  '02': TODA_RULES,
  '04': HEIWAJIMA_RULES,
  '05': TAMAGAWA_RULES,
  '08': TOKONAME_RULES,
  '09': TSU_RULES,
*/
