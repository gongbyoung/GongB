/**
 * [파일 역할] 제노택틱 2.0: 케미컬 디펜스 (Chemical Neutralization) 핵심 데이터 설정 파일
 * - 초보자도 숫자나 텍스트만 바꾸면 타워 밸런스, 화학 반응 배율, 적군 체력을 바로 수정할 수 있도록 분리해 두었습니다.
 */

// 1. 격자(Grid) 및 캔버스 기본 설정 (원본 제노택틱 비율 기반 확장: 22x16 타일, 타일당 36px = 792x576)
export const GRID_CONFIG = {
  cols: 22,          // 가로 타일 개수
  rows: 16,          // 세로 타일 개수
  tileSize: 36,      // 타일 1칸의 픽셀 크기 (36x36px)
  width: 22 * 36,    // 캔버스 가로 해상도 (792px)
  height: 16 * 36    // 캔버스 세로 해상도 (576px)
};

// 2. 제노택틱 2.0 스타일 미션(스테이지) 설정
export const MISSIONS = [
  {
    id: 1,
    name: "Mission 1: 제1화학단지 폐수 유출",
    desc: "단일 입구 → 출구 구조입니다. 탄소(C)와 소듐(Na)으로 긴 미로(Maze)를 만들어 폐수를 중화하세요.",
    startGold: 220,
    startLives: 20,
    totalWaves: 15,
    spawns: [{ c: 0, r: 7 }, { c: 0, r: 8 }],
    exits: [{ c: 21, r: 7 }, { c: 21, r: 8 }],
    obstacles: [] // 장애물 없는 자유 미로 맵
  },
  {
    id: 2,
    name: "Mission 2: 교차로 반응로 (Cross Reactor)",
    desc: "좌→우, 상→하 두 방향에서 위험물이 유입됩니다. 중앙 교차점에 산소(O) 버프와 주력 원소를 배치하세요.",
    startGold: 280,
    startLives: 20,
    totalWaves: 20,
    spawns: [{ c: 0, r: 7 }, { c: 0, r: 8 }, { c: 10, r: 0 }, { c: 11, r: 0 }],
    exits: [{ c: 21, r: 7 }, { c: 21, r: 8 }, { c: 10, r: 15 }, { c: 11, r: 15 }],
    obstacles: [
      { c: 5, r: 4 }, { c: 5, r: 11 }, { c: 16, r: 4 }, { c: 16, r: 11 }
    ]
  },
  {
    id: 3,
    name: "Mission 3: 격리 구역 (Containment Core)",
    desc: "중앙 격리벽이 있어 경로가 나뉩니다. 가스형 적(공중)은 벽을 넘어오므로 염소(Cl)와 포타슘(K)을 대비하세요.",
    startGold: 340,
    startLives: 25,
    totalWaves: 25,
    spawns: [{ c: 0, r: 3 }, { c: 0, r: 12 }],
    exits: [{ c: 21, r: 7 }, { c: 21, r: 8 }],
    obstacles: [
      { c: 9, r: 5 }, { c: 9, r: 6 }, { c: 9, r: 9 }, { c: 9, r: 10 },
      { c: 13, r: 3 }, { c: 13, r: 4 }, { c: 13, r: 11 }, { c: 13, r: 12 }
    ]
  }
];

/**
 * 3. 원소 타워 8종 정의 (탄소 C + 반응성 1~7위 원소)
 * - rank: 반응성/역할 순위 표시
 * - symbol: 원소 기호, atomicNum: 원자 번호
 * - targetAir / targetGround: 공중(가스형) 및 지상 위험물 공격 가능 여부
 * - roleType:
 *   'wall_slow' (탄소 C: 미로 벽 + 흡착 감속 + 은신 검출)
 *   'splash'    (소듐 Na: 노란 불꽃 중급 스플래시 폭발)
 *   'chain'     (포타슘 K: 보라색 불꽃 빠른 연사 + 연쇄 폭발)
 *   'aura'      (산소 O: 주변 원소 타워 연소 촉진 공격력/연사속도 버프 + 은신 검출)
 *   'detonate'  (수소 H: 초광역 환원 폭발, 기폭 후에도 바닥 용기가 남아 미로가 붕괴되지 않고 자동 재충전됨!)
 *   'gas_cloud' (염소 Cl: 가스/유기물 특화, 독가스 중화 구름 장판 생성)
 *   'boss_nuke' (세슘 Cs: 물 속성 및 보스 킬러, 초고화력 폭발)
 *   'omni_dot'  (플루오린 F: 반응성 1위, 유리/금까지 부식시키는 만능 산화 + 방어력 파괴 지속 부식 데미지)
 */
export const ELEMENT_TOWERS = {
  C: {
    id: "C",
    rank: "BASE",
    symbol: "C",
    atomicNum: 6,
    name: "탄소 (활성탄 필터)",
    whyReactive: "다공성 탄소 구조로 유해 화학물질과 은신 가스를 흡착·격리",
    concept: "미로 건설 코어 · 흡착 감속 · 은신 검출",
    cost: 15,
    range: 90,          // 흡착/검출 반경 (px)
    damage: 4,          // 미세 마찰 중화 피해
    fireRate: 1.0,      // 초당 1회 흡착 펄스
    color: "#64748b",
    glowColor: "#94a3b8",
    targetGround: true,
    targetAir: true,
    roleType: "wall_slow",
    slowFactor: 0.35,   // 이동속도 35% 감소 (업그레이드 시 증가)
    slowDuration: 2.0,
    detectsStealth: true
  },
  Na: {
    id: "Na",
    rank: "5위",
    symbol: "Na",
    atomicNum: 11,
    name: "소듐 (나트륨)",
    whyReactive: "물과 닿으면 격렬히 폭발하며 노란색 불꽃 방출",
    concept: "저렴한 중급 폭발 타워 (수분 특화)",
    cost: 35,
    range: 125,
    damage: 26,
    fireRate: 0.9,      // 초당 발사 횟수
    splashRadius: 52,   // 폭발 반경 (px)
    color: "#f59e0b",
    glowColor: "#fde047",
    targetGround: true,
    targetAir: false,
    roleType: "splash"
  },
  K: {
    id: "K",
    rank: "4위",
    symbol: "K",
    atomicNum: 19,
    name: "포타슘 (칼륨)",
    whyReactive: "소듐보다 반응성이 더 크며 물과 격렬히 반응해 보라색 불꽃 방출",
    concept: "보라색 불꽃 연쇄 폭발 · 빠른 연사",
    cost: 60,
    range: 145,
    damage: 30,
    fireRate: 2.2,      // 매우 빠른 연사
    chainCount: 3,      // 최대 3기 연쇄 스파크 폭발
    chainRange: 85,
    color: "#a855f7",
    glowColor: "#d8b4fe",
    targetGround: true,
    targetAir: true,
    roleType: "chain"
  },
  O: {
    id: "O",
    rank: "6위",
    symbol: "O",
    atomicNum: 8,
    name: "산소 (산화 촉진기)",
    whyReactive: "거의 모든 원소와 산화물을 만들며 연소 반응의 필수 조건",
    concept: "연소 촉진 오라 (주변 타워 공격력·연사 버프)",
    cost: 50,
    range: 115,         // 버프 오라 반경 (약 3타일 반경)
    damage: 0,
    fireRate: 0,
    buffDamagePct: 0.30, // 주변 타워 공격력 +30% (업그레이드 시 증가)
    buffRatePct: 0.20,   // 주변 타워 공격속도 +20%
    color: "#0ea5e9",
    glowColor: "#7dd3fc",
    targetGround: false,
    targetAir: false,
    roleType: "aura",
    detectsStealth: true
  },
  H: {
    id: "H",
    rank: "7위",
    symbol: "H",
    atomicNum: 1,
    name: "수소 (환원 기폭기)",
    whyReactive: "공기 중 폭발 범위가 엄청나게 넓으며 강력한 환원제로 작용",
    concept: "자폭형 초광역 폭발 (용기 잔존 후 재충전)",
    cost: 45,
    range: 175,         // 초광역 폭발 범위
    damage: 190,        // 기폭 시 강력한 광역 피해
    fireRate: 0.22,     // 4.5초마다 수소 가스 완충 후 자동/수동 기폭
    color: "#38bdf8",
    glowColor: "#e0f2fe",
    targetGround: true,
    targetAir: true,
    roleType: "detonate"
  },
  Cl: {
    id: "Cl",
    rank: "3위",
    symbol: "Cl",
    atomicNum: 17,
    name: "염소 (살균 독가스)",
    whyReactive: "강력한 산화제·살균제로 유기물 및 가스형 오염물질과 격렬히 반응",
    concept: "가스형(공중)·유기물 특화 · 범위 독가스 장판",
    cost: 75,
    range: 155,
    damage: 22,         // 직격 피해 + 독가스 초당 지속 피해
    cloudDps: 28,       // 독가스 구름 초당 피해
    cloudDuration: 3.2, // 구름 지속 시간(초)
    cloudRadius: 65,
    fireRate: 0.85,
    color: "#84cc16",
    glowColor: "#bef264",
    targetGround: true,
    targetAir: true,
    roleType: "gas_cloud"
  },
  Cs: {
    id: "Cs",
    rank: "2위",
    symbol: "Cs",
    atomicNum: 55,
    name: "세슘 (알칼리 극한폭발)",
    whyReactive: "이온화 에너지 최저! 물에 닿으면 즉시 대폭발하고 공기 중 자연 발화",
    concept: "보스킬러 · 수분(물) 속성 특화 초강력 폭발",
    cost: 110,
    range: 170,
    damage: 145,
    fireRate: 0.65,
    splashRadius: 68,
    color: "#f43f5e",
    glowColor: "#fda4af",
    targetGround: true,
    targetAir: false,
    roleType: "boss_nuke"
  },
  F: {
    id: "F",
    rank: "1위",
    symbol: "F",
    atomicNum: 9,
    name: "플루오린 (불소)",
    whyReactive: "전기음성도 1위! 유리와 금, 중금속 보호막까지 부식시키는 최강 산화제",
    concept: "만능 산화 · 방어력 부식 · 강력한 지속 데미지",
    cost: 135,
    range: 165,
    damage: 55,         // 즉시 산화 레이저 피해
    dotDps: 65,         // 초당 부식(HF/불화물 산화) 피해
    dotDuration: 4.0,
    armorShred: 0.5,    // 적의 피해감소 보호막 50% 영구 부식
    fireRate: 1.5,
    color: "#10b981",
    glowColor: "#6ee7b7",
    targetGround: true,
    targetAir: true,
    roleType: "omni_dot"
  }
};

/**
 * 4. 화학위험물 적군(Chemical Hazards) 6종 정의
 * - category:
 *   'aqueous'  (수분/폐수 계열 -> Na, K, Cs 알칼리 금속과 만나면 격렬한 폭발 중화!)
 *   'organic'  (유기 용제/바이오 독소 -> Cl 염소 살균 및 F 플루오린 산화에 취약)
 *   'gas'      (유독성 에어로졸/가스 -> 공중 이동! 타워 미로를 무시하고 직선 비행, Cl/F/K/H에 취약)
 *   'stealth'  (무색 무취 누출 가스 -> 탄소 C 또는 산소 O 반경 안에서만 검출됨)
 *   'oxidizer' (불안정 과산화물 -> 이동이 빠르며 환원제인 수소 H, 탄소 C와 반응)
 *   'heavy'    (중금속·유리질 슬러지 보스 -> 높은 방어력 보유, 플루오린 F의 부식과 세슘 Cs 폭격에 취약)
 */
export const HAZARD_TYPES = {
  aqueous: {
    id: "aqueous",
    name: "폐수 슬러지 (H₂O·산성수)",
    formula: "H₂O(aq)",
    desc: "수분을 다량 함유한 폐수입니다. 알칼리 금속(Na, K, Cs)과 접촉하면 폭발적으로 중화됩니다.",
    hp: 95,
    speed: 52,          // 초당 이동 픽셀
    reward: 10,
    armor: 0,
    isFlying: false,
    isStealth: false,
    color: "#3b82f6"
  },
  organic: {
    id: "organic",
    name: "유기 독성 용제 (VOCs)",
    formula: "C₆H₆·R-OH",
    desc: "휘발성 유기화합물입니다. 염소(Cl) 살균 가스와 플루오린(F), 활성탄(C) 흡착에 약합니다.",
    hp: 130,
    speed: 64,
    reward: 13,
    armor: 0.1,
    isFlying: false,
    isStealth: false,
    color: "#d97706"
  },
  gas: {
    id: "gas",
    name: "유독 에어로졸 구름 (공중)",
    formula: "NH₃·H₂S(g)",
    desc: "[공중 이동] 타워 미로를 넘어 출구로 직행합니다! 염소(Cl), 포타슘(K), 플루오린(F), 수소(H)로 요격하세요.",
    hp: 105,
    speed: 58,
    reward: 15,
    armor: 0,
    isFlying: true,
    isStealth: false,
    color: "#a3e635"
  },
  stealth: {
    id: "stealth",
    name: "무색 무취 누출가스 (은신)",
    formula: "CO·Ar(g)",
    desc: "[은신] 일반 센서에 잡히지 않습니다. 탄소(C) 활성탄이나 산소(O) 타워 범위 안에서만 정체가 드러납니다!",
    hp: 115,
    speed: 68,
    reward: 16,
    armor: 0,
    isFlying: false,
    isStealth: true,
    color: "#cbd5e1"
  },
  oxidizer: {
    id: "oxidizer",
    name: "불안정 과산화물 (고속)",
    formula: "R-O-O-R",
    desc: "반응성이 불안정해 매우 빠르게 이동합니다. 환원제인 수소(H) 광역 폭발과 포타슘(K)에 취약합니다.",
    hp: 90,
    speed: 88,
    reward: 14,
    armor: 0,
    isFlying: false,
    isStealth: false,
    color: "#f472b6"
  },
  heavy: {
    id: "heavy",
    name: "중금속·규산염 농축액 (BOSS)",
    formula: "Pb·SiO₂(s)",
    desc: "[보스] 유리질 피막으로 일반 공격을 45% 경감합니다. 플루오린(F)으로 피막을 녹이고 세슘(Cs)으로 파괴하세요!",
    hp: 520,
    speed: 36,
    reward: 55,
    armor: 0.45,
    isFlying: false,
    isStealth: false,
    isBoss: true,
    color: "#ef4444"
  }
};

/**
 * 5. 원소 타워 × 화학위험물 상성 및 화학 반응식 매트릭스
 * - 상성이 맞으면 multiplier 배율만큼 추가 중화 피해가 들어가고, 화면에 실제 화학 반응식이 떠오릅니다!
 */
export const CHEMICAL_REACTIONS = {
  // 알칼리 금속(Na, K, Cs) + 수분(aqueous) 반응
  "Na:aqueous": {
    mult: 1.8,
    equation: "2Na + 2H₂O → 2NaOH + H₂↑ (노란 불꽃 중화!)"
  },
  "K:aqueous": {
    mult: 2.0,
    equation: "2K + 2H₂O → 2KOH + H₂↑ (보라 불꽃 연쇄폭발!)"
  },
  "Cs:aqueous": {
    mult: 2.6,
    equation: "2Cs + 2H₂O → 2CsOH + H₂↑ (세슘 초격렬 수중폭발!)"
  },
  // 세슘(Cs) + 보스(heavy)
  "Cs:heavy": {
    mult: 2.2,
    equation: "Cs 극한 이온화 충격 → 중금속 코어 분쇄!"
  },
  // 염소(Cl) + 가스형(gas) / 유기물(organic) 반응
  "Cl:gas": {
    mult: 2.1,
    equation: "3Cl₂ + 8NH₃ → N₂ + 6NH₄Cl (유독가스 완전 중화!)"
  },
  "Cl:organic": {
    mult: 1.9,
    equation: "Cl₂ + R-H → R-Cl + HCl (유기독소 살균 산화!)"
  },
  // 플루오린(F) + 보스(유리질/중금속) 및 만능 산화 반응
  "F:heavy": {
    mult: 2.4,
    equation: "SiO₂ + 2F₂ → SiF₄ + O₂ (유리·중금속 장갑 부식!)"
  },
  "F:organic": {
    mult: 1.7,
    equation: "C₆H₆ + F₂ → 초강력 불화 산화 분해!"
  },
  "F:gas": {
    mult: 1.7,
    equation: "F₂ 만능 전자 탈취 → 유독가스 강제 산화!"
  },
  // 수소(H) + 불안정 과산화물(oxidizer) / 가스(gas) 환원 반응
  "H:oxidizer": {
    mult: 2.4,
    equation: "2H₂ + O₂ → 2H₂O + ΔE (과산화물 환원 대폭발!)"
  },
  "H:gas": {
    mult: 1.7,
    equation: "H₂ 광역 폭연파 → 대기 에어로졸 일소!"
  },
  // 포타슘(K) + 과산화물/은신
  "K:oxidizer": {
    mult: 1.6,
    equation: "K + O₂ → KO₂ (초과산화칼륨 연쇄 반응!)"
  },
  // 탄소(C) + 유기물/은신 흡착
  "C:organic": {
    mult: 2.0,
    equation: "활성탄(C) 미세기공 → VOC 유기독소 강력 흡착!"
  },
  "C:stealth": {
    mult: 2.0,
    equation: "활성탄(C) 필터 → 무색 은신가스 흡착 검출!"
  }
};
