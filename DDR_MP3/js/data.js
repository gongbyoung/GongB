/**
 * [파일 역할] 케미컬 제노택틱 2.0 핵심 데이터베이스 (data.js)
 * - 엄선된 핵심 원소 포탑 10종 (O, N, Na, Cl, Ca, S, C, Fe, Cs, F)
 * - 원소별 · 적 분자별 실제 화학 반응 매트릭스 (reactiveMolecules: 반응이 일어나지 않는 분자는 절대 공격하지 않음)
 * - 튜토리얼 스테이지별(TUT-01 ~ TUT-10) 필수 타워만 개방 & 신규 타워 개방 시 화학 반응 상세 팝업 데이터 제공
 * - 튜토리얼 전체 클리어 시 10종 전 타워 영구 개방 및 42종 실제 역사적 화학 사고(DT_CompoundRecipe.csv) 서바이벌 연동
 */

export const GRID_CONFIG = {
  cols: 20,
  rows: 14,
  tileSize: 38
};

// ./sound 폴더의 실제 사운드 파일 매핑
export const SOUND_PATHS = {
  uiClick: "./sound/ui_click.mp3",
  towerBuild: "./sound/tower_build.mp3",
  towerUpgrade: "./sound/tower_upgrade.mp3",
  waveStart: "./sound/wave_start.mp3",
  waveClear: "./sound/wave_clear.mp3",
  bossAlarm: "./sound/boss_alarm.mp3",
  baseDamage: "./sound/base_damage.mp3",
  gameOver: "./sound/game_over.mp3",
  hitNeutralize: "./sound/hit_neutralize.mp3",
  enemyDissolve: "./sound/enemy_dissolve.mp3",
  enemyLeak: "./sound/enemy_leak.mp3",
  enemySlime: "./sound/enemy_slime.mp3",
  ambientLoop: "./sound/ambient_loop.mp3",
  tower_C: "./sound/tower_C.mp3",
  tower_H: "./sound/tower_H.mp3",
  tower_O: "./sound/tower_O.mp3",
  tower_Na: "./sound/tower_Na.mp3",
  tower_K: "./sound/tower_K.mp3",
  tower_Cl: "./sound/tower_Cl.mp3",
  tower_Cs: "./sound/tower_Cs.mp3",
  tower_F: "./sound/tower_F.mp3"
};

// ./icon 폴더의 UI 및 장애물 아이콘 매핑
export const UI_ICONS = {
  gold: "./icon/ui_gold.png",
  lives: "./icon/ui_lives.png",
  wave: "./icon/ui_wave.png",
  score: "./icon/ui_score.png",
  start: "./icon/ui_start.png",
  speed: "./icon/ui_speed.png",
  pause: "./icon/ui_pause.png",
  upgrade: "./icon/ui_upgrade.png",
  obstacle: "./icon/obstacle.png"
};

/**
 * 핵심 원소 포탑 10종 정의 (TUT-01 ~ TUT-10 단계별 개방)
 * - reactiveMolecules에 포함된 화학 분자만 공격 가능하며, 포함되지 않은 분자는 화학적 무반응으로 공격하지 않습니다.
 */
export const TOWER_TYPES = {
  // 1. [TUT-01 개방] 산소 (O)
  O: {
    id: "O",
    symbol: "O",
    atomicNumber: 8,
    unlockStageId: "TUT-01",
    name: "산소 연소 촉진기 (Oxygen)",
    rankLabel: "TUT-01 개방 · 연소 산화 & 마비 해독",
    category: "element",
    cost: 45,
    damage: 24,
    range: 135,
    fireRate: 1.45,
    color: "#0ea5e9",
    projectileColor: "#38bdf8",
    imagePath: "./icon/tower_O.png",
    upgradeImagePath: "./icon/tower_O_up.png",
    soundKey: "tower_O",
    auraRange: 130,
    auraDamageBoost: 0.35,
    auraSpeedBoost: 0.25,
    curesParalysis: true,
    whyReactive:
      "가연성 수소(H₂)·일산화탄소(CO)·황화수소(H₂S) 및 유기화합물과 결합해 안전한 산화물(H₂O, CO₂)로 연소시키며, 주변 포탑의 H₂S 마비를 즉시 해독합니다.",
    concept: "가연성 가스·유기물 연소 산화 + 주변 포탑 화력(+35%) 가속 및 마비 해독 오라",
    Produces: "H₂O / CO₂ / SO₂",
    reactiveMolecules: [
      "H2",
      "H2S",
      "CO",
      "H2SO4",
      "COCl2",
      "NH3",
      "C6H6",
      "CS2",
      "CH2O",
      "CH3OH",
      "CH3NCO",
      "HCN",
      "C2H2",
      "PH3",
      "C3H6O",
      "C2H5OH"
    ],
    nonReactiveSummary:
      "Cl₂(염소), HCl(염산), HF(불산), HNO₃(질산), 중금속(Hg, PbO) 등 이미 산화되었거나 불소/염소계 강산과는 직접 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "H₂ (수소 가스)",
        equation: "2H₂ + O₂ → 2H₂O",
        mechanism: "폭발성 수소 가스를 연소시켜 무해한 물(H₂O)로 완전 중화합니다."
      },
      {
        targetFormula: "H₂S (황화수소)",
        equation: "2H₂S + 3O₂ → 2SO₂ + 2H₂O",
        mechanism: "포탑을 기절시키는 황화수소를 산화 무력화하고 주변 포탑의 마비를 즉시 해독합니다."
      },
      {
        targetFormula: "CO (일산화탄소) & VOCs",
        equation: "2CO + O₂ → 2CO₂",
        mechanism: "무색무취 일산화탄소와 휘발성 유기용매(벤젠·메탄올)를 완전 연소시킵니다."
      }
    ],
    reactionBadges: {
      H2: "💧 2H₂+O₂ → 2H₂O 물 생성!",
      H2S: "✨ 2H₂S+3O₂ → 산화 & 마비해독!",
      CO: "🔥 2CO+O₂ → 2CO₂ 완전연소!",
      H2SO4: "⚗️ O₂ 다단계 산화 보조!",
      COCl2: "💨 포스겐 산화 분해!"
    }
  },

  // 2. [TUT-02 개방] 질소 (N)
  N: {
    id: "N",
    symbol: "N",
    atomicNumber: 7,
    unlockStageId: "TUT-02",
    name: "질소 불활성 퍼지 타워 (Nitrogen)",
    rankLabel: "TUT-02 개방 · 폭발 가스 농도 희석 & 고압 응축",
    category: "element",
    cost: 45,
    damage: 26,
    range: 135,
    fireRate: 1.55,
    color: "#60a5fa",
    projectileColor: "#93c5fd",
    imagePath: "./icon/tower_H.png",
    upgradeImagePath: "./icon/tower_H_up.png",
    soundKey: "tower_H",
    splashRadius: 65,
    pullStrength: true,
    slowFactor: 0.42,
    slowDuration: 2.8,
    lowersConcentration: true,
    whyReactive:
      "삼중결합(N≡N)을 가진 불활성 기체 및 극저온 액화질소 퍼지(Purge)로 폭발성 가스(H₂, C₂H₂)와 불안정 산화제(O₃, NO₂)의 농도를 폭발 하한계(LEL) 이하로 낮춥니다.",
    concept: "기체상 폭발물·산화제 농도 희석(Concentration 감소) + 고압 응축 및 냉각 감속(42%)",
    Produces: "N₂ 불활성 희석기류",
    reactiveMolecules: [
      "H2",
      "NH3",
      "C2H2",
      "CO",
      "O3",
      "NO2",
      "C2H4O",
      "PH3",
      "CH3NCO",
      "C3H6O"
    ],
    nonReactiveSummary:
      "HCl(염산), HF(불산), H₂SO₄(황산) 등 액체 수용액 산·염기 및 중금속 슬러지(Hg, PbO)는 기체 질소 퍼지로 중화할 수 없어 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "H₂ / C₂H₂ (가연성 폭발 가스)",
        equation: "H₂ (고농도) + N₂ (고압 퍼지) → LEL 이하 안전 희석",
        mechanism: "산소 접촉을 차단하고 가스 농도 게이지를 급격히 낮추어 폭발을 원천 방지합니다."
      },
      {
        targetFormula: "O₃ / NO₂ / C₂H₄O (공중 산화제)",
        equation: "N₂ 극저온 블랭킷 → 에어로졸 응축 감속",
        mechanism: "바리케이드 위를 날아다니는 불안정 과산화물·산화제를 냉각 응축하여 격추합니다."
      }
    ],
    reactionBadges: {
      H2: "❄️ N₂ 퍼지 → 수소 농도 희석!",
      O3: "❄️ 극저온 질소 응축!",
      NO2: "❄️ 질소 블랭킷 희석!"
    }
  },

  // 3. [TUT-03 개방] 소듐 (Na)
  Na: {
    id: "Na",
    symbol: "Na",
    atomicNumber: 11,
    unlockStageId: "TUT-03",
    name: "소듐 알칼리 중화 포탑 (Sodium)",
    rankLabel: "TUT-03 개방 · Cl₂ 소금 침전 & 강산 pH 중화",
    category: "element",
    cost: 60,
    damage: 52,
    range: 130,
    fireRate: 1.2,
    color: "#facc15",
    projectileColor: "#fde047",
    imagePath: "./icon/tower_Na.png",
    upgradeImagePath: "./icon/tower_Na_up.png",
    soundKey: "tower_Na",
    splashRadius: 60,
    neutralizesAcid: true,
    whyReactive:
      "반응성이 큰 알칼리 금속으로, 독성 염소 가스(Cl₂)와 만나 무해한 소금(NaCl)으로 즉시 침전시키고 강산 수용액(HCl, H₂SO₄, HNO₃)의 산성도(pH)를 7.0으로 회복시킵니다.",
    concept: "노란 불꽃 중급 스플래시 — 염소(Cl₂) 소금 침전 & 강산(HCl/H₂SO₄) pH 중화 특화",
    Produces: "2NaCl↓ (소금) / 중성 물",
    reactiveMolecules: [
      "Cl2",
      "HCl",
      "H2SO4",
      "HNO3",
      "SO2",
      "CO2",
      "CCl4",
      "HCN"
    ],
    nonReactiveSummary:
      "H₂(수소), CO(일산화탄소), 벤젠(C₆H₆), 수은(Hg) 등 중성 기체·유기용매 및 HF(불산 — 칼슘 해독 필수)는 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "Cl₂ (염소 독가스)",
        equation: "2Na + Cl₂ → 2NaCl↓ (소금 결정 침전)",
        mechanism: "맹독성 황록색 염소 가스와 격렬히 반응해 무해한 염화나트륨(소금) 고체로 침전시킵니다."
      },
      {
        targetFormula: "HCl (염산) & H₂SO₄ (황산)",
        equation: "HCl (aq) + NaOH → NaCl + H₂O (pH 7.0 회복)",
        mechanism: "강산성 수용액을 알칼리 중화 열반응으로 타격하여 산성도(pH)를 중성(7.0)으로 되돌립니다."
      }
    ],
    reactionBadges: {
      Cl2: "🧂 2Na+Cl₂ → 2NaCl 소금 침전!",
      HCl: "🧪 HCl+NaOH → pH 중화!",
      H2SO4: "⚗️ Na₂SO₄ 알칼리 산 중화!"
    }
  },

  // 4. [TUT-04 개방] 염소 (Cl)
  Cl: {
    id: "Cl",
    symbol: "Cl",
    atomicNumber: 17,
    unlockStageId: "TUT-04",
    name: "염소 살균 방출기 (Chlorine)",
    rankLabel: "TUT-04 개방 · 범위 산화 살균 & 은신 가스 검출",
    category: "element",
    cost: 85,
    damage: 32,
    range: 135,
    fireRate: 1.6,
    color: "#84cc16",
    projectileColor: "#bef264",
    imagePath: "./icon/tower_Cl.png",
    upgradeImagePath: "./icon/tower_Cl_up.png",
    soundKey: "tower_Cl",
    isAuraCloud: true,
    revealsStealth: true,
    dotDamage: 28,
    dotDuration: 3.0,
    whyReactive:
      "강력한 산화 살균 가스를 사거리 전체에 방출하여 시안화물(HCN, KCN), 황화수소(H₂S), 포스겐(COCl₂), 암모니아(NH₃) 및 강염기(NaOH)를 산화 분해하고 은신 가스를 노출시킵니다.",
    concept: "사거리 내 다중 동시 살균(Aura Cloud) + 지속 산화 피해(DoT) + 무색무취 은신 감지",
    Produces: "CNO⁻ (무독성 시안산염) / 중화염",
    reactiveMolecules: [
      "COCl2",
      "H2S",
      "NH3",
      "HCN",
      "KCN",
      "NaOH",
      "CH2O",
      "CS2",
      "CH3OH",
      "C2H5OH",
      "PH3"
    ],
    nonReactiveSummary:
      "Cl₂(염소), HCl(염산), CCl₄(사염화탄소) 등 이미 염소로 포화된 동족 분자나 HF(불산), H₂SO₄(황산)과는 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "HCN (청산가스) & KCN (시안화칼륨)",
        equation: "CN⁻ + Cl₂ + 2OH⁻ → CNO⁻ + 2Cl⁻ + H₂O",
        mechanism: "무색무취 은신 청산가스의 정체를 폭로하고 알칼리 염소 파괴법으로 독성을 분해합니다."
      },
      {
        targetFormula: "COCl₂ (포스겐) & H₂S (황화수소)",
        equation: "H₂S + Cl₂ → S↓ + 2HCl",
        mechanism: "사거리 안의 모든 포스겐·황화수소·유기독성 가스에 지속 살균 피해를 입힙니다."
      }
    ],
    reactionBadges: {
      COCl2: "☣️ Cl₂ 살균 클라우드 분해!",
      HCN: "👁️ 청산가스 은신 폭로 & 파괴!",
      H2S: "🧪 H₂S+Cl₂ → 황 산화 침전!"
    }
  },

  // 5. [TUT-05 개방] 칼슘 (Ca)
  Ca: {
    id: "Ca",
    symbol: "Ca",
    atomicNumber: 20,
    unlockStageId: "TUT-05",
    name: "칼슘 불산 해독 방벽 (Calcium)",
    rankLabel: "TUT-05 개방 · 불산(HF) 형석 침전 & 부식 면역 보호막",
    category: "element",
    cost: 70,
    damage: 56,
    range: 130,
    fireRate: 1.25,
    color: "#f472b6",
    projectileColor: "#fbcfe8",
    imagePath: "./icon/tower_K.png",
    upgradeImagePath: "./icon/tower_K_up.png",
    soundKey: "tower_K",
    splashRadius: 60,
    corrosionImmune: true,
    antiCorrosionAura: 130,
    neutralizesAcid: true,
    highDurability: true,
    whyReactive:
      "유리와 금속 포탑을 녹이는 맹독성 불산(HF)의 플루오린 이온(F⁻)과 즉시 결합해 무해한 불용성 형석(CaF₂)으로 침전시키며, 주변 포탑에 산 부식 면역 보호막을 제공합니다.",
    concept: "불산(HF)·황산(H₂SO₄) 침전 해독 + 본체 및 반경 130px 내 아군 포탑 부식 완벽 차단",
    Produces: "CaF₂↓ (형석) / CaSO₄↓ (석고)",
    reactiveMolecules: [
      "HF",
      "H2SO4",
      "HCl",
      "HNO3",
      "SO2",
      "CO2",
      "CdCl2",
      "As2O3"
    ],
    nonReactiveSummary:
      "H₂(수소), CO(일산화탄소), 벤젠(C₆H₆), 포스겐(COCl₂) 등 중성 기체 및 비산성 유기화합물과는 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "HF (불화수소산 / 불산)",
        equation: "2HF + Ca(OH)₂ → CaF₂↓ (형석 고체 침전) + 2H₂O",
        mechanism: "일반 포탑을 녹여 파괴하는 불산을 무해한 형석(CaF₂)으로 즉시 해독하고 주변 포탑의 부식을 막습니다."
      },
      {
        targetFormula: "H₂SO₄ (황산) & SO₂ (이산화황)",
        equation: "H₂SO₄ + Ca²⁺ → CaSO₄↓ (석고 침전)",
        mechanism: "고농도 황산과 산성 가스를 불용성 석고(CaSO₄)로 침전시켜 도로와 설비 부식을 저지합니다."
      }
    ],
    reactionBadges: {
      HF: "🛡️ 2HF+Ca → CaF₂ 형석 해독!",
      H2SO4: "🧱 CaSO₄ 석고 침전 중화!",
      SO2: "🧱 탈황 석고 침전!"
    }
  },

  // 6. [TUT-06 개방] 황 (S)
  S: {
    id: "S",
    symbol: "S",
    atomicNumber: 16,
    unlockStageId: "TUT-06",
    name: "황 아말감 포집기 (Sulfur)",
    rankLabel: "TUT-06 개방 · 황화수소 클라우스 탈황 & 중금속 고정",
    category: "element",
    cost: 75,
    damage: 64,
    range: 135,
    fireRate: 1.15,
    color: "#eab308",
    projectileColor: "#fef08a",
    imagePath: "./icon/tower_Na.png",
    upgradeImagePath: "./icon/tower_Na_up.png",
    soundKey: "tower_Na",
    splashRadius: 55,
    slowFactor: 0.38,
    slowDuration: 3.0,
    dotDamage: 32,
    dotDuration: 3.5,
    whyReactive:
      "클라우스(Claus) 촉매 반응으로 황화수소(H₂S)를 무해한 고체 황(S)으로 침전시키고, 수은(Hg)·납(PbO)·카드뮴(CdCl₂) 등 중금속을 불용성 황화물(HgS 진사)로 바닥에 고정합니다.",
    concept: "황화수소(H₂S) 탈황 침전 + 중금속(Hg, Pb, Cd) 이동속도 38% 감속 및 지속 고정 피해",
    Produces: "3S↓ (고체 황) / HgS↓ (진사)",
    reactiveMolecules: [
      "H2S",
      "Hg",
      "PbO",
      "CdCl2",
      "As2O3",
      "Ni(CO)4",
      "KCN",
      "NaOH"
    ],
    nonReactiveSummary:
      "H₂(수소), Cl₂(염소), HCl(염산), HF(불산), CO(일산화탄소) 등 일반 기체 및 산성 수용액과는 상온에서 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "H₂S (황화수소 마비 가스)",
        equation: "2H₂S + SO₂ --[S 클라우스 촉매]--> 3S↓ + 2H₂O",
        mechanism: "산소(O) 포탑과 협동하여 맹독성 황화수소를 무해한 노란 고체 황(S)으로 회수·침전시킵니다."
      },
      {
        targetFormula: "Hg (수은) & PbO / CdCl₂ (중금속 보스)",
        equation: "Hg + S → HgS↓ (불용성 황화수은 고정)",
        mechanism: "미나마타병의 원인인 유출 수은과 중금속 보스를 황화물로 굳혀 이동을 묶고 강력한 피해를 입힙니다."
      }
    ],
    reactionBadges: {
      H2S: "💛 클라우스 탈황 → 3S↓ 침전!",
      Hg: "⚓ Hg+S → HgS 진사 고정!",
      PbO: "⚓ PbS 황화납 침전!"
    }
  },

  // 7. [TUT-07 개방] 탄소 (C)
  C: {
    id: "C",
    symbol: "C",
    atomicNumber: 6,
    unlockStageId: "TUT-07",
    name: "탄소 활성탄 흡착 탑 (Carbon)",
    rankLabel: "TUT-07 개방 · 다공성 가스/유기물 흡착 & 역풍 저지",
    category: "element",
    cost: 35,
    damage: 28,
    range: 120,
    fireRate: 1.4,
    color: "#94a3b8",
    projectileColor: "#cbd5e1",
    imagePath: "./icon/tower_C.png",
    upgradeImagePath: "./icon/tower_C_up.png",
    soundKey: "tower_C",
    pushbackStrength: 15,
    slowFactor: 0.35,
    slowDuration: 2.4,
    revealsStealth: true,
    whyReactive:
      "넓은 비표적을 가진 다공성 활성탄(Activated Carbon) 구조로 일산화탄소(CO), 포스겐(COCl₂), 벤젠(C₆H₆) 등 유독 가스와 유기화합물을 흡착해 뒤로 밀어내고 이동을 늦춥니다.",
    concept: "저비용 미로 코어 + 유기화합물(VOCs)·포스겐·CO 흡착 감속(35%) 및 역풍 밀치기",
    Produces: "활성탄 포집 완료 / CO₂",
    reactiveMolecules: [
      "CO",
      "COCl2",
      "Cl2",
      "C6H6",
      "CS2",
      "CCl4",
      "CH2O",
      "CH3OH",
      "CH3NCO",
      "HCN",
      "O3",
      "NO2",
      "PH3",
      "C3H6O",
      "C2H5OH"
    ],
    nonReactiveSummary:
      "분자 크기가 너무 작은 H₂(수소) 및 HCl(염산), HF(불산), H₂SO₄(황산), 중금속 수용액은 활성탄 세공에 흡착되지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "CO (일산화탄소) & COCl₂ (포스겐)",
        equation: "CO / COCl₂ + C(활성탄 필터) → 표면 흡착 포집 & 산소 연소 증폭",
        mechanism: "빠르게 침투하는 일산화탄소와 1급 화학무기 포스겐을 활성탄 기공에 가두어 역풍으로 밀어냅니다."
      },
      {
        targetFormula: "C₆H₆ (벤젠) 등 휘발성 유기화합물(VOCs) & O₃ (오존)",
        equation: "2O₃ + C → 2O₂ + CO₂ / VOCs 물리·화학 흡착",
        mechanism: "방독면 정화통 원리로 모든 유기용매와 오존을 흡착 분해합니다."
      }
    ],
    reactionBadges: {
      CO: "🧱 활성탄 CO 포집 & 감속!",
      COCl2: "🌪️ 포스겐 활성탄 밀폐 포집!",
      C6H6: "🧱 벤젠 VOCs 완벽 흡착!"
    }
  },

  // 8. [TUT-08 개방] 철 (Fe)
  Fe: {
    id: "Fe",
    symbol: "Fe",
    atomicNumber: 26,
    unlockStageId: "TUT-08",
    name: "철 펜톤 산화 포탑 (Iron)",
    rankLabel: "TUT-08 개방 · 황산 다단계 중화 & 시안화물 착염 침전",
    category: "element",
    cost: 90,
    damage: 78,
    range: 145,
    fireRate: 1.1,
    color: "#fb923c",
    projectileColor: "#fed7aa",
    imagePath: "./icon/tower_Cs.png",
    upgradeImagePath: "./icon/tower_Cs_up.png",
    soundKey: "tower_Cs",
    splashRadius: 55,
    highDurability: true,
    neutralizesAcid: true,
    whyReactive:
      "펜톤 산화(Fenton's reagent) 촉매 작용으로 고농도 황산(H₂SO₄)과 난분해성 유기물(벤젠, 보팔 MIC)을 분해하고, 청산가스(HCN, KCN)를 무독성 프러시안 블루 착염으로 침전시킵니다.",
    concept: "고내구도 중장갑 포탑 + 황산(H₂SO₄)·비소(As₂O₃)·시안화물(CN⁻)·유기물 강력 타격",
    Produces: "FeSO₄ / 프러시안 블루 착염",
    reactiveMolecules: [
      "H2SO4",
      "HCl",
      "HNO3",
      "H2S",
      "HCN",
      "KCN",
      "As2O3",
      "PbO",
      "CdCl2",
      "C6H6",
      "CS2",
      "CCl4",
      "CH2O",
      "CH3NCO"
    ],
    nonReactiveSummary:
      "H₂(수소), CO(일산화탄소), NH₃(암모니아), HF(불산), Hg(수은 — 철은 수은과 아말감을 만들지 않음)에는 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "H₂SO₄ (고농도 황산 탱크)",
        equation: "Fe + H₂SO₄ → FeSO₄ (황산철 응집제) + H₂O (O₂ 공존 시)",
        mechanism: "칼슘(Ca)·소듐(Na)·산소(O)와 함께 다단계 산 중화 체인을 형성하여 고농도 황산을 빠르게 분해합니다."
      },
      {
        targetFormula: "HCN / KCN (청산) & As₂O₃ (삼산화비소)",
        equation: "Fe²⁺ + 6CN⁻ → [Fe(CN)₆]⁴⁻ (프러시안 블루 침전)",
        mechanism: "맹독성 시안화물과 비소를 철 착화합물로 공침시켜 독성을 영구 제거합니다."
      }
    ],
    reactionBadges: {
      H2SO4: "⚙️ FeSO₄ 펜톤 다단계 중화!",
      HCN: "🔷 프러시안 블루 착염 침전!",
      As2O3: "⚙️ 철-비소 공침 제거!"
    }
  },

  // 9. [TUT-09 개방] 세슘 (Cs)
  Cs: {
    id: "Cs",
    symbol: "Cs",
    atomicNumber: 55,
    unlockStageId: "TUT-09",
    name: "세슘 초중력 레일건 (Cesium)",
    rankLabel: "TUT-09 개방 · 수용액·포스겐·중금속 보스 초고화력 폭발",
    category: "element",
    cost: 155,
    damage: 195,
    range: 180,
    fireRate: 0.72,
    color: "#f97316",
    projectileColor: "#fdba74",
    imagePath: "./icon/tower_Cs.png",
    upgradeImagePath: "./icon/tower_Cs_up.png",
    soundKey: "tower_Cs",
    splashRadius: 78,
    neutralizesAcid: true,
    whyReactive:
      "이온화 에너지가 최저 수준인 알칼리 금속으로, 수분·산성 수용액(HCl, H₂SO₄, HF) 및 포스겐(COCl₂), 중금속 보스(Ni(CO)₄, Hg)에 닿는 순간 초강력 알칼리 폭발을 일으킵니다.",
    concept: "초장거리 대구경 폭발 레일건 — 포스겐·산성 수용액·중금속 보스 킬러",
    Produces: "CsCl / Cs₂SO₄ / CsOH 폭발 중화",
    reactiveMolecules: [
      "COCl2",
      "Cl2",
      "HCl",
      "HF",
      "H2SO4",
      "HNO3",
      "KCN",
      "SO2",
      "CO2",
      "O3",
      "NO2",
      "Hg",
      "Ni(CO)4",
      "PbO",
      "As2O3",
      "CdCl2"
    ],
    nonReactiveSummary:
      "건조한 환원성 기체인 H₂(수소), CO(일산화탄소), NH₃(암모니아) 및 비극성 탄화수소 벤젠(C₆H₆), 강염기(NaOH)와는 반응하지 않아 공격하지 않습니다.",
    reactionDetails: [
      {
        targetFormula: "COCl₂ (포스겐) & Cl₂ (염소)",
        equation: "COCl₂ + 4CsOH → Cs₂CO₃ + 2CsCl + 2H₂O",
        mechanism: "활성탄(C)과 염소(Cl)가 포집한 고독성 포스겐 무리를 대구경 알칼리 폭발탄으로 일망타진합니다."
      },
      {
        targetFormula: "H₂SO₄ / HCl / HF (수용액) & Ni(CO)₄ / Hg (보스)",
        equation: "2Cs + 2H₂O/H⁺ → 2Cs⁺ + OH⁻ + 초고열 충격파",
        mechanism: "수용액 슬라임과 중금속 보스에게 최대 2.8배의 치명적인 폭발 피해를 입힙니다."
      }
    ],
    reactionBadges: {
      COCl2: "💥 CsOH 포스겐 초고속 분해!",
      H2SO4: "💥 세슘 알칼리 대구경 폭발!",
      "Ni(CO)4": "💥 보스 카보닐 분해 타격!"
    }
  },

  // 10. [TUT-10 개방] 플루오린 (F)
  F: {
    id: "F",
    symbol: "F",
    atomicNumber: 9,
    unlockStageId: "TUT-10",
    name: "플루오린 만능 산화기 (Fluorine)",
    rankLabel: "TUT-10 최종 개방 · 전기음성도 1위 초강력 불화 분해",
    category: "element",
    cost: 210,
    damage: 98,
    range: 165,
    fireRate: 2.3,
    color: "#10b981",
    projectileColor: "#6ee7b7",
    imagePath: "./icon/tower_F.png",
    upgradeImagePath: "./icon/tower_F_up.png",
    soundKey: "tower_F",
    dotDamage: 65,
    dotDuration: 4.0,
    armorShred: 0.4,
    revealsStealth: true,
    whyReactive:
      "전기음성도 1위(3.98)의 최강 산화 원소로, 이미 불화된 불산(HF)을 제외한 모든 난분해성 독성 물질(포스겐, 보팔 MIC, 니켈카보닐 등)의 화학 결합을 강제로 끊어 분해합니다.",
    concept: "최종 병기 원소 포탑 — 불산(HF)을 제외한 전 위험물 초고속 연사 + 지속 산화(DoT)",
    Produces: "불화물 완전 분해",
    reactiveMolecules: [
      "H2",
      "Cl2",
      "HCl",
      "H2S",
      "CO",
      "H2SO4",
      "COCl2",
      "NH3",
      "C6H6",
      "CS2",
      "Hg",
      "CCl4",
      "CH2O",
      "Ni(CO)4",
      "PbO",
      "SO2",
      "HNO3",
      "CH3OH",
      "CH3NCO",
      "HCN",
      "As2O3",
      "KCN",
      "CdCl2",
      "C2H2",
      "O3",
      "NaOH",
      "NO2",
      "PH3",
      "C3H6O",
      "C2H4O",
      "CO2",
      "C2H5OH"
    ],
    nonReactiveSummary:
      "⚠️ 유일한 천적 예외: HF(불화수소산/불산)는 이미 플루오린(F⁻)으로 완전히 포화된 분자이므로 플루오린 포탑이 절대 공격할 수 없습니다! (HF는 반드시 칼슘 Ca으로 해독)",
    reactionDetails: [
      {
        targetFormula: "복합 화학 재난 물질 (HF 제외 전 분자)",
        equation: "R-X + F₂ → 완전 불화 산화 분해 (ΔG ≪ 0)",
        mechanism: "전기음성도 1위의 산화력으로 유기물·중금속·독가스의 분자 결합을 강제로 파괴합니다."
      },
      {
        targetFormula: "⚠️ 무반응 주의: HF (불화수소산)",
        equation: "HF + F₂ → 무반응 (공격 불가)",
        mechanism: "불산(HF)은 플루오린 산화수가 이미 -1로 포화되어 있으므로 칼슘(Ca) 포탑과 반드시 조합해야 합니다."
      }
    ],
    reactionBadges: {
      COCl2: "☢️ F₂ 초강력 불화 완전분해!",
      CH3NCO: "☢️ 보팔 독가스 강제 산화!",
      H2: "☢️ H₂+F₂ → 초고속 반응!"
    }
  }
};

/**
 * 특정 원소 타워가 특정 적 분자(enemy)와 화학 반응을 일으켜 공격할 수 있는지 판정하는 핵심 함수
 * - 반응이 전혀 일어나지 않는 원소-분자 조합은 false를 반환하여 타워가 해당 적을 공격하지 않습니다.
 */
export function canTowerReactWithEnemy(towerIdOrSpec, enemyOrId) {
  const spec =
    typeof towerIdOrSpec === "string" ? TOWER_TYPES[towerIdOrSpec] : towerIdOrSpec;
  if (!spec || !Array.isArray(spec.reactiveMolecules)) return false;

  const enemyId =
    typeof enemyOrId === "string"
      ? enemyOrId
      : enemyOrId?.id || enemyOrId?.formula || "";

  return spec.reactiveMolecules.includes(enemyId);
}

/**
 * 적군 기본 아키타입 7종 (시각적 아이콘 및 물리 특성)
 */
export const ENEMY_TYPES = {
  GAS: {
    id: "GAS",
    name: "독성 가스 (Toxic Gas)",
    formula: "Cl₂ / H₂",
    categoryLabel: "기체형 위험물",
    color: "#a3e635",
    strokeColor: "#4d7c0f",
    imagePath: "./icon/enemy_gas.png",
    soundKey: "enemyLeak",
    baseHp: 65,
    speed: 60,
    reward: 9,
    radius: 11,
    isFlying: false,
    isStealth: false,
    description: "빠르게 확산되는 기체 위험물입니다. 분자 종류에 따라 산소(O), 질소(N), 소듐(Na)으로 중화하세요."
  },
  AQUEOUS: {
    id: "AQUEOUS",
    name: "산성 수용액 (Acid Solution)",
    formula: "HCl / H₂SO₄",
    categoryLabel: "수용액 위험물",
    color: "#38bdf8",
    strokeColor: "#0369a1",
    imagePath: "./icon/enemy_aqueous.png",
    soundKey: "enemySlime",
    baseHp: 120,
    speed: 45,
    reward: 12,
    radius: 13,
    isFlying: false,
    isStealth: false,
    description: "강산성 액체 슬라임입니다. 소듐(Na), 칼슘(Ca), 철(Fe), 세슘(Cs)과 만나면 격렬히 중화됩니다."
  },
  ORGANIC: {
    id: "ORGANIC",
    name: "휘발성 유기화합물 (VOCs)",
    formula: "C₆H₆ / COCl₂",
    categoryLabel: "유기화합물",
    color: "#f43f5e",
    strokeColor: "#9f1239",
    imagePath: "./icon/enemy_organic.png",
    soundKey: "enemySlime",
    baseHp: 165,
    speed: 48,
    reward: 15,
    radius: 13,
    isFlying: false,
    isStealth: false,
    description: "독성 유기용매 및 포스겐입니다. 활성탄 탄소(C)로 흡착하고 산소(O)·염소(Cl)·세슘(Cs)으로 분해하세요."
  },
  OXIDIZER: {
    id: "OXIDIZER",
    name: "불안정 과산화물 (Peroxide)",
    formula: "O₃ / NO₂",
    categoryLabel: "산화제 (공중 부유)",
    color: "#e879f9",
    strokeColor: "#86198f",
    imagePath: "./icon/enemy_oxidizer.png",
    soundKey: "enemyLeak",
    baseHp: 110,
    speed: 44,
    reward: 16,
    radius: 12,
    isFlying: true,
    isStealth: false,
    description: "바리케이드 위를 날아다니는 불안정 산화 에어로졸입니다! 질소(N), 탄소(C), 세슘(Cs), 플루오린(F)에 반응합니다."
  },
  STEALTH: {
    id: "STEALTH",
    name: "일산화탄소 / 청산가스",
    formula: "CO / HCN",
    categoryLabel: "무색무취 독가스",
    color: "#94a3b8",
    strokeColor: "#334155",
    imagePath: "./icon/enemy_stealth.png",
    soundKey: "enemyLeak",
    baseHp: 130,
    speed: 52,
    reward: 17,
    radius: 11,
    isFlying: false,
    isStealth: true,
    description: "무색무취 가스입니다. 탄소(C)·염소(Cl)·플루오린(F)으로 감지하고 산소(O)로 완전 연소시키세요."
  },
  HEAVY: {
    id: "HEAVY",
    name: "중금속 슬러지 (Heavy Metal)",
    formula: "Hg / PbO / Cd",
    categoryLabel: "중금속 보스",
    color: "#fb923c",
    strokeColor: "#9a3412",
    imagePath: "./icon/enemy_heavy.png",
    soundKey: "bossAlarm",
    baseHp: 440,
    speed: 30,
    reward: 38,
    radius: 16,
    isFlying: false,
    isStealth: false,
    description: "체력이 매우 높은 중금속 폐기물입니다. 황(S), 철(Fe), 세슘(Cs), 플루오린(F)과만 반응합니다!"
  },
  H2S_BOSS: {
    id: "H2S_BOSS",
    name: "고농도 황화수소 (Sour Gas)",
    formula: "H₂S (마비성 독가스)",
    categoryLabel: "신경 마비성 특급 위험물",
    color: "#eab308",
    strokeColor: "#713f12",
    imagePath: "./icon/enemy_h2s.png",
    soundKey: "bossAlarm",
    baseHp: 280,
    speed: 36,
    reward: 32,
    radius: 16,
    isFlying: false,
    isStealth: false,
    paralyzesTowers: true,
    description: "주변 포탑을 마비시키는 황화수소입니다! 산소(O) 오라로 마비를 해독하고 황(S) 클라우스 반응으로 침전시키세요."
  }
};

/**
 * 튜토리얼 스테이지별 화학 위험물 상세 정의
 */
export const TUTORIAL_ENEMIES = {
  H2: {
    ...ENEMY_TYPES.GAS,
    id: "H2",
    name: "수소 누출 가스 (Hydrogen)",
    formula: "H₂",
    categoryLabel: "가연성 폭발 가스 (반응 원소: O, N, F)",
    baseHp: 55,
    speed: 58,
    reward: 10,
    description: "수소 분자(H₂)입니다. 산소(O)와 반응해 물(H₂O)이 되거나 질소(N) 퍼지로 희석됩니다. (소듐·칼슘·탄소 등과 무반응)"
  },
  Cl2: {
    ...ENEMY_TYPES.GAS,
    id: "Cl2",
    name: "염소 독가스 (Chlorine Gas)",
    formula: "Cl₂",
    categoryLabel: "할로겐 독가스 (반응 원소: Na, C, Cs, F)",
    baseHp: 85,
    speed: 50,
    reward: 12,
    description: "염소 분자(Cl₂)입니다. 소듐(Na)과 반응시키면 소금(2NaCl↓)으로 침전됩니다. (산소 O·질소 N·염소 Cl과는 무반응)"
  },
  HCl: {
    ...ENEMY_TYPES.AQUEOUS,
    id: "HCl",
    name: "염산 이온화 용액 (Hydrochloric Acid)",
    formula: "HCl",
    categoryLabel: "강산 수용액 pH 1.5 (반응 원소: Na, Ca, Fe, Cs, F)",
    baseHp: 110,
    speed: 45,
    reward: 13,
    acidicStrength: 1.5,
    description: "강산으로 이온화된 염산(HCl)입니다. 소듐(Na)으로 중화해 pH 7.0으로 회복시키세요. (산소 O·염소 Cl과는 무반응)"
  },
  HF: {
    ...ENEMY_TYPES.AQUEOUS,
    id: "HF",
    name: "불화수소산 (Hydrofluoric Acid)",
    formula: "HF",
    categoryLabel: "포탑 부식 맹독산 (반응 원소: Ca, Cs 전용!)",
    color: "#2dd4bf",
    baseHp: 125,
    speed: 44,
    reward: 15,
    corrodesTowers: true,
    description: "포탑을 녹이는 불산(HF)입니다! 오직 칼슘(Ca → CaF₂ 형석 침전)과 세슘(Cs)만 공격할 수 있으며, 플루오린(F)조차 무반응입니다!"
  },
  H2S: {
    ...ENEMY_TYPES.H2S_BOSS,
    id: "H2S",
    name: "황화수소 (Hydrogen Sulfide)",
    formula: "H₂S",
    categoryLabel: "포탑 마비 독가스 (반응 원소: O, S, Cl, Fe, F)",
    baseHp: 145,
    speed: 43,
    reward: 16,
    paralyzesTowers: true,
    description: "주변 포탑을 마비시키는 황화수소(H₂S)입니다. 산소(O)로 마비를 해독·산화시키고 황(S)으로 클라우스 탈황 침전시키세요!"
  },
  CO: {
    ...ENEMY_TYPES.STEALTH,
    id: "CO",
    name: "일산화탄소 (Carbon Monoxide)",
    formula: "CO",
    categoryLabel: "불완전 연소 질식가스 (반응 원소: O, C, N, F)",
    baseHp: 125,
    speed: 52,
    reward: 15,
    isStealth: false,
    description: "무색무취 일산화탄소(CO)입니다. 활성탄 탄소(C)로 흡착해 속도를 늦추고 산소(O)를 가해 이산화탄소(CO₂)로 완전 연소시키세요!"
  },
  H2SO4: {
    ...ENEMY_TYPES.HEAVY,
    id: "H2SO4",
    name: "고농도 황산 유출물 (Sulfuric Acid)",
    formula: "H₂SO₄",
    categoryLabel: "도로 부식 강산 탱크 (반응 원소: Ca, Na, O, Fe, Cs, F)",
    imagePath: "./icon/enemy_aqueous.png",
    baseHp: 230,
    speed: 35,
    reward: 22,
    corrodesTowers: true,
    acidicStrength: 2.5,
    description: "탱크 전복으로 쏟아진 황산(H₂SO₄)입니다! 칼슘(Ca)·소듐(Na)·산소(O)·철(Fe) 다단계 반응으로 중화하세요."
  },
  COCl2: {
    ...ENEMY_TYPES.ORGANIC,
    id: "COCl2",
    name: "포스겐 독가스 (Phosgene)",
    formula: "COCl₂",
    categoryLabel: "1급 질식 화학무기 (반응 원소: C, O, Cl, Cs, F)",
    baseHp: 200,
    speed: 46,
    reward: 20,
    description: "고독성 포스겐(COCl₂)입니다. 탄소(C)로 가두어 흡착하고 산소(O)·염소(Cl)·세슘(Cs) 복합 반응으로 분해하세요."
  }
};

/**
 * 10개 튜토리얼 스테이지 (TUT-01 ~ TUT-10)
 * - 각 스테이지는 필요한 타워(requiredTowers)만 활성화되고 나머지 타워는 잠금(비활성화)됩니다.
 * - 매 스테이지마다 신규 개방 타워(newlyUnlockedTower)의 화학 반응 상세 팝업이 표시됩니다.
 * - TUT-10까지 모두 클리어하면 모든 스테이지에서 10종 타워가 100% 개방됩니다.
 */
export const TUTORIAL_STAGES = [
  {
    stageId: "TUT-01",
    stageNumber: 1,
    title: "TUT-01: 실내 연구소 수소(H₂) 누출",
    environment: "Indoor",
    enemyKey: "H2",
    clearCondition: "Eliminate_All",
    clearTarget: 20,
    clearLabel: "산소(O) 포탑으로 수소(H₂)를 물(H₂O)로 20기 전원 중화",
    requiredTowers: ["O"],
    newlyUnlockedTower: "O",
    shopItems: [],
    description: "수소 누출! 산소(O) 포탑으로 길을 막고 물(H₂O)로 중화하세요.",
    chemicalEquation: "2H₂ (수소 가스) + O₂ (산소 포탑) → 2H₂O (무해한 물)",
    historicalCase:
      "수소(H₂)는 공기 중 폭발 범위(4~75%)가 매우 넓어 밀폐된 연구소에서 누출될 경우 정전기만으로도 폭발합니다. 촉매 산소 결합으로 안전한 물(H₂O)로 전환해야 합니다.",
    tacticalSteps: [
      "1단계: 현재 스테이지에서는 수소(H₂)와 반응하는 [O 산소 연소 촉진기]만 개방되어 있습니다 (나머지 9종 비활성).",
      "2단계: 파란 점선 경로 위에 [O 산소 포탑]을 지그재그로 배치해 수소의 이동 경로를 길게 우회시키세요.",
      "3단계: [미션 1웨이브 개시]를 눌러 수소(H₂) 20기를 모두 물(H₂O)로 중화하면 클리어됩니다!"
    ],
    rewards: "Tower_N",
    rewardLabel: "TUT-02 진출 & 질소(N) 포탑 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 220,
    spawns: [{ c: 0, r: 6 }, { c: 0, r: 7 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 6, r: 3 }, { c: 6, r: 4 }, { c: 6, r: 9 }, { c: 6, r: 10 },
      { c: 13, r: 3 }, { c: 13, r: 4 }, { c: 13, r: 9 }, { c: 13, r: 10 }
    ]
  },
  {
    stageId: "TUT-02",
    stageNumber: 2,
    title: "TUT-02: 야외 플랜트 수소 농도 희석",
    environment: "Outdoor",
    enemyKey: "H2",
    clearCondition: "Lower_Concentration",
    clearTarget: 24,
    clearLabel: "질소(N) 불활성 퍼지 타워로 수소 가스 농도를 0%까지 희석",
    requiredTowers: ["N"],
    newlyUnlockedTower: "N",
    shopItems: [],
    description: "질소(N) 불활성 퍼지 타워로 가스를 응축하고 농도를 0%로 낮추세요.",
    chemicalEquation: "H₂ (고농도 누출) + N₂ (고압 불활성 퍼지) → 폭발하한계(LEL) 이하 안전 희석",
    historicalCase:
      "야외 플랜트 배관 누출 시 불활성 기체인 질소(N₂)를 고압 분사해 산소 접촉을 차단하고 폭발 농도를 낮추는 퍼지(Purge) 공정이 사용됩니다.",
    tacticalSteps: [
      "1단계: 신규 개방된 [N 질소 불활성 퍼지 타워]는 가스를 한곳으로 응축시키고 냉각 감속(42%)시킵니다.",
      "2단계: 두 갈래 입구(VENT)가 만나는 중앙 합류 지점에 [N 질소 타워]를 집중 배치하세요.",
      "3단계: 질소 타워가 수소를 타격할 때마다 농도가 감소하며, 농도가 0%가 되면 즉시 클리어됩니다!"
    ],
    rewards: "Tower_Na",
    rewardLabel: "소듐(Na) 알칼리 중화 포탑 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 240,
    spawns: [{ c: 0, r: 2 }, { c: 0, r: 11 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 5, r: 5 }, { c: 5, r: 6 }, { c: 5, r: 7 }, { c: 5, r: 8 },
      { c: 12, r: 2 }, { c: 12, r: 3 }, { c: 12, r: 10 }, { c: 12, r: 11 }
    ]
  },
  {
    stageId: "TUT-03",
    stageNumber: 3,
    title: "TUT-03: 염소(Cl₂) 독가스 소금(NaCl) 침전",
    environment: "Indoor",
    enemyKey: "Cl2",
    clearCondition: "Create_NaCl_20",
    clearTarget: 20,
    clearLabel: "소듐(Na) 포탑으로 염소(Cl₂)를 반응시켜 소금(NaCl) 20개 침전",
    requiredTowers: ["Na"],
    newlyUnlockedTower: "Na",
    shopItems: [],
    description: "염소(Cl₂)는 산소·질소와 반응하지 않습니다! 나트륨(Na)으로 소금(NaCl)을 만드세요.",
    chemicalEquation: "2Na (소듐) + Cl₂ (염소 독가스) → 2NaCl↓ (무해한 소금 결정 침전)",
    historicalCase:
      "1943년 미국 뉴저지 화학공장 폭발 및 2005년 열차 충돌 사고 당시 맹독성 황록색 염소(Cl₂) 가스가 유출되어 알칼리 중화제가 긴급 투입되었습니다.",
    tacticalSteps: [
      "1단계: 염소(Cl₂) 분자는 산소(O)나 질소(N)와는 전혀 반응하지 않으며, 신규 개방된 [Na 소듐 알칼리 중화 포탑]과 격렬히 반응합니다!",
      "2단계: 위쪽(VENT)에서 아래쪽(GATE)으로 내려오는 통로에 [Na 소듐 포탑]으로 지그재그 미로를 건설하세요.",
      "3단계: 염소 가스 20기를 소금(2NaCl↓)으로 침전시키면 미션 성공입니다!"
    ],
    rewards: "Tower_Cl",
    rewardLabel: "염소(Cl) 살균 방출기 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 260,
    spawns: [{ c: 9, r: 0 }, { c: 10, r: 0 }],
    exits: [{ c: 9, r: 13 }, { c: 10, r: 13 }],
    obstacles: [
      { c: 7, r: 4 }, { c: 8, r: 4 }, { c: 11, r: 4 }, { c: 12, r: 4 },
      { c: 5, r: 8 }, { c: 6, r: 8 }, { c: 13, r: 8 }, { c: 14, r: 8 }
    ]
  },
  {
    stageId: "TUT-04",
    stageNumber: 4,
    title: "TUT-04: 염산(HCl) 이온화 pH 7.0 중화",
    environment: "Indoor",
    enemyKey: "HCl",
    clearCondition: "Neutralize_pH",
    clearTarget: 22,
    clearLabel: "소듐(Na)으로 강산성 염산(pH 1.5)을 중성(pH 7.0)까지 회복",
    requiredTowers: ["Na", "Cl"],
    newlyUnlockedTower: "Cl",
    shopItems: [],
    description: "염산(HCl)은 같은 염소(Cl) 타워로는 공격할 수 없습니다! 소듐(Na)으로 중화하세요.",
    chemicalEquation: "HCl (aq, 강산 pH 1.5) + NaOH → NaCl + H₂O (중성 pH 7.0 회복)",
    historicalCase:
      "염화수소(HCl)가 수분과 만나 강산성 염산 수용액으로 이온화되면 동족 원소인 염소(Cl)와는 반응하지 않으며, 반드시 알칼리(Na)로 산-염기 중화해야 합니다.",
    tacticalSteps: [
      "1단계: 이번 스테이지에서는 [Cl 염소 살균 방출기]가 새로 개방되었지만, 출현 적군인 염산(HCl)은 이미 염소 이온(Cl⁻)을 포함하므로 Cl 포탑이 공격하지 않습니다(🚫무반응 체험)!",
      "2단계: 염산(HCl)과 산-염기 중화 반응을 일으키는 [Na 소듐 포탑]을 주력으로 배치하고 Lv.2~3으로 강화하세요.",
      "3단계: 소듐 포탑이 염산을 타격할 때마다 용액 pH가 상승하며, pH 7.00(중성)에 도달하면 클리어됩니다!"
    ],
    rewards: "Tower_Ca",
    rewardLabel: "칼슘(Ca) 불산 해독 방벽 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 260,
    spawns: [{ c: 0, r: 6 }, { c: 0, r: 7 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 4, r: 2 }, { c: 4, r: 3 }, { c: 4, r: 10 }, { c: 4, r: 11 },
      { c: 9, r: 5 }, { c: 9, r: 8 },
      { c: 14, r: 3 }, { c: 14, r: 4 }, { c: 14, r: 9 }, { c: 14, r: 10 }
    ]
  },
  {
    stageId: "TUT-05",
    stageNumber: 5,
    title: "TUT-05: 맹독성 불산(HF) 무피해 형석 해독",
    environment: "Indoor",
    enemyKey: "HF",
    clearCondition: "Zero_Damage",
    clearTarget: 24,
    clearLabel: "칼슘(Ca) 해독 방벽으로 포탑 부식 0건 & 불산 24기 해독",
    requiredTowers: ["Ca"],
    newlyUnlockedTower: "Ca",
    shopItems: [],
    description: "불산(HF)은 일반 포탑을 녹입니다! 칼슘(Ca)으로 형석(CaF₂) 침전 해독하세요.",
    chemicalEquation: "2HF (맹독성 불산) + Ca(OH)₂ (칼슘 포탑) → CaF₂↓ (불용성 형석 침전) + 2H₂O",
    historicalCase:
      "2012년 구미 불산(HF) 누출사고처럼 불산은 유리와 금속까지 부식시키고 인체에 치명적이어서 칼슘(Ca) 해독제를 투여해 불용성 형석(CaF₂)으로 침전시킵니다.",
    tacticalSteps: [
      "1단계: 불산(HF)은 산소(O)·소듐(Na)·염소(Cl)·플루오린(F)과도 반응하지 않으며, 오직 신규 개방된 [Ca 칼슘 불산 해독 방벽]으로만 해독할 수 있습니다!",
      "2단계: 칼슘(Ca) 포탑은 자체 부식 면역일 뿐 아니라 반경 130px 내 모든 아군 포탑에 '부식 면역 보호막'을 씌워줍니다.",
      "3단계: 칼슘 포탑으로 미로를 구축해 포탑 손실 0건으로 불산 24기를 모두 형석(CaF₂)으로 해독하세요!"
    ],
    rewards: "Tower_S",
    rewardLabel: "황(S) 아말감 포집기 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 280,
    spawns: [{ c: 0, r: 3 }, { c: 0, r: 10 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 6, r: 6 }, { c: 6, r: 7 },
      { c: 11, r: 2 }, { c: 11, r: 3 }, { c: 11, r: 10 }, { c: 11, r: 11 },
      { c: 15, r: 5 }, { c: 15, r: 8 }
    ]
  },
  {
    stageId: "TUT-06",
    stageNumber: 6,
    title: "TUT-06: 황화수소(H₂S) 마비 해독 & 클라우스 탈황",
    environment: "Outdoor",
    enemyKey: "H2S",
    clearCondition: "Cure_Paralysis",
    clearTarget: 22,
    clearLabel: "산소(O) 마비 해독 + 황(S) 클라우스 탈황 반응으로 H₂S 22기 제거",
    requiredTowers: ["O", "S"],
    newlyUnlockedTower: "S",
    shopItems: [],
    description: "황화수소(H₂S)는 포탑을 마비시킵니다! 산소(O)로 해독하고 황(S)으로 침전시키세요.",
    chemicalEquation: "2H₂S + O₂ / S (클라우스 촉매) → 3S↓ (고체 황 침전) + 2H₂O",
    historicalCase:
      "1964년 일본 광산 사고 및 2020년 인도 비자그 사고에서 황화수소(H₂S)는 신경을 마비시켰습니다. 정유·가스 플랜트에서는 산소(O₂)와 황(S) 촉매를 이용한 클라우스(Claus) 공정으로 H₂S를 고체 황으로 회수합니다.",
    tacticalSteps: [
      "1단계: 황화수소(H₂S)가 접근하면 일반 포탑은 '⚡마비' 상태가 되어 공격이 멈춥니다.",
      "2단계: 먼저 [O 산소 연소 촉진기]를 배치해 주변에 파란 마비 해독 오라(반경 130px)를 형성하세요.",
      "3단계: 산소 오라 범위 안에 신규 개방된 [S 황 아말감 포집기]를 함께 배치하면 마비 없이 강력한 클라우스 탈황 피해로 H₂S를 고체 황(3S↓)으로 침전시킵니다!"
    ],
    rewards: "Tower_C",
    rewardLabel: "탄소(C) 활성탄 흡착 탑 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 290,
    spawns: [{ c: 0, r: 6 }, { c: 9, r: 0 }],
    exits: [{ c: 19, r: 6 }, { c: 9, r: 13 }],
    obstacles: [
      { c: 5, r: 4 }, { c: 5, r: 9 },
      { c: 9, r: 5 }, { c: 10, r: 8 },
      { c: 14, r: 4 }, { c: 14, r: 9 }
    ]
  },
  {
    stageId: "TUT-07",
    stageNumber: 7,
    title: "TUT-07: 일산화탄소(CO) 활성탄 포집 & 완전 연소",
    environment: "Indoor",
    enemyKey: "CO",
    clearCondition: "Create_CO2_All",
    clearTarget: 25,
    clearLabel: "탄소(C) 활성탄으로 포집·감속하고 산소(O)로 CO₂ 완전 연소",
    requiredTowers: ["O", "C"],
    newlyUnlockedTower: "C",
    shopItems: [],
    description: "빠른 일산화탄소(CO)를 탄소(C) 활성탄으로 흡착해 늦추고 산소(O)로 CO₂로 바꾸세요.",
    chemicalEquation: "2CO (일산화탄소) --[C 활성탄 포집 + O₂ 연소 촉진]--> 2CO₂ (완전 연소)",
    historicalCase:
      "2018년 광산 사고 등 밀폐 공간 불완전 연소로 발생하는 일산화탄소(CO)는 다공성 활성탄(C) 필터로 흡착 체류 시간을 늘린 뒤 산소(O₂) 촉매 산화기로 완전 연소시킵니다.",
    tacticalSteps: [
      "1단계: 신규 개방된 [C 탄소 활성탄 흡착 탑]은 비용이 저렴(35G)하고 CO 및 유기독성 가스를 흡착해 이동속도를 35% 늦추며 뒤로 밀어냅니다.",
      "2단계: 중앙 통로에 [C 탄소 포탑]으로 촘촘한 미로를 세워 일산화탄소의 발을 묶으세요.",
      "3단계: 탄소 포탑 주변에 [O 산소 연소 촉진기]를 배치하면 흡착된 CO에 2.6배의 완전 연소 시너지 피해가 들어가며 CO₂로 전환됩니다!"
    ],
    rewards: "Tower_Fe",
    rewardLabel: "철(Fe) 펜톤 산화 포탑 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 290,
    spawns: [{ c: 0, r: 5 }, { c: 0, r: 8 }],
    exits: [{ c: 19, r: 5 }, { c: 19, r: 8 }],
    obstacles: [
      { c: 7, r: 2 }, { c: 7, r: 3 }, { c: 7, r: 6 }, { c: 7, r: 7 }, { c: 7, r: 10 }, { c: 7, r: 11 },
      { c: 13, r: 4 }, { c: 13, r: 5 }, { c: 13, r: 8 }, { c: 13, r: 9 }
    ]
  },
  {
    stageId: "TUT-08",
    stageNumber: 8,
    title: "TUT-08: 황산(H₂SO₄) 탱크 전복 4원소 다단계 중화",
    environment: "Outdoor",
    enemyKey: "H2SO4",
    clearCondition: "Stop_Corrosion",
    clearTarget: 20,
    clearLabel: "칼슘(Ca)·소듐(Na)·산소(O)·철(Fe) 다단계 반응으로 황산 20기 중화",
    requiredTowers: ["Ca", "Na", "O", "Fe"],
    newlyUnlockedTower: "Fe",
    shopItems: [],
    description: "황산 탱크 전복! 칼슘·소듐·산소·철 4원소 다단계 반응으로 도로 부식을 막으세요.",
    chemicalEquation: "H₂SO₄ + Ca/Na/O/Fe → CaSO₄↓(석고) + Na₂SO₄ + FeSO₄ (다단계 중화)",
    historicalCase:
      "2016년 인도 황산 저장탱크 누출 사고처럼 고농도 황산(H₂SO₄)은 단일 약품만으로 급격히 중화하면 고열이 발생하므로 석회(Ca)·소듐(Na)·철(Fe) 응집제를 거치는 다단계 중화 방어선이 필수입니다.",
    tacticalSteps: [
      "1단계: 고농도 황산(H₂SO₄)은 포탑을 부식시키므로 먼저 [Ca 칼슘 방벽]을 전방에 배치해 부식 면역 보호막을 펼치세요.",
      "2단계: 그 뒤에 신규 개방된 [Fe 철 펜톤 산화 포탑]과 [Na 소듐 포탑], [O 산소 포탑]을 연달아 배치하세요.",
      "3단계: 황산 적이 서로 다른 원소(Ca → Na → O → Fe)에 누적 타격될수록 다단계 화학 시너지로 피해량이 최대 2.9배까지 증폭됩니다!"
    ],
    rewards: "Tower_Cs",
    rewardLabel: "세슘(Cs) 초중력 레일건 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 340,
    spawns: [{ c: 0, r: 6 }, { c: 0, r: 7 }, { c: 9, r: 0 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 5, r: 3 }, { c: 5, r: 4 }, { c: 5, r: 9 }, { c: 5, r: 10 },
      { c: 10, r: 5 }, { c: 10, r: 6 }, { c: 10, r: 7 },
      { c: 15, r: 2 }, { c: 15, r: 3 }, { c: 15, r: 10 }, { c: 15, r: 11 }
    ]
  },
  {
    stageId: "TUT-09",
    stageNumber: 9,
    title: "TUT-09: 고독성 포스겐(COCl₂) 밀폐 분해 작전",
    environment: "Indoor",
    enemyKey: "COCl2",
    clearCondition: "Decompose_All",
    clearTarget: 26,
    clearLabel: "탄소(C)로 가두고 산소(O)·염소(Cl)·세슘(Cs)으로 포스겐 26기 완전 분해",
    requiredTowers: ["C", "O", "Cl", "Cs"],
    newlyUnlockedTower: "Cs",
    shopItems: [],
    description: "고독성 포스겐(COCl₂) 누출! 활성탄(C)으로 가두고 O·Cl·Cs 복합 반응으로 분해하세요.",
    chemicalEquation: "COCl₂ --[C 활성탄 포집 + O₂/Cl₂ 산화 + CsOH 초고속 가수분해]--> CO₂ + 2CsCl↓",
    historicalCase:
      "포스겐(COCl₂)은 1급 질식성 산업 독가스로, 누출 시 다공성 활성탄(C) 흡착탑으로 가스를 포집한 뒤 강알칼리(CsOH) 및 산화 세정탑을 거쳐 완전 분해해야 합니다.",
    tacticalSteps: [
      "1단계: 3곳의 입구에서 쏟아지는 포스겐을 [C 탄소 활성탄 탑]으로 가두어 역풍으로 밀어내고 속도를 늦추세요.",
      "2단계: 포집 구역 중앙에 [Cl 염소 살균 방출기]와 [O 산소 촉진기]를 배치해 광역 지속 피해를 입히세요.",
      "3단계: 후방에 신규 개방된 보스 킬러 [Cs 세슘 초중력 레일건]을 건설해 포스겐 무리를 대구경 알칼리 폭발로 완전 분해하세요!"
    ],
    rewards: "Tower_F",
    rewardLabel: "최종 병기 플루오린(F) 만능 산화기 개방",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 380,
    spawns: [{ c: 0, r: 2 }, { c: 0, r: 11 }, { c: 9, r: 0 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }],
    obstacles: [
      { c: 6, r: 4 }, { c: 6, r: 5 }, { c: 6, r: 8 }, { c: 6, r: 9 },
      { c: 12, r: 3 }, { c: 12, r: 6 }, { c: 12, r: 7 }, { c: 12, r: 10 }
    ]
  },
  {
    stageId: "TUT-10",
    stageNumber: 10,
    title: "TUT-10: 대형 복합 화학 누출 5분 총력 방어전",
    environment: "Outdoor",
    enemyKey: "Mixed",
    clearCondition: "Survive_5min",
    clearTarget: 300,
    clearLabel: "개방된 10종 모든 원소 포탑의 화학 상성을 조합해 5분(300초)간 도시 방어",
    requiredTowers: ["O", "N", "Na", "Cl", "Ca", "S", "C", "Fe", "Cs", "F"],
    newlyUnlockedTower: "F",
    shopItems: [],
    description: "대형 복합 누출 사고! 10종 원소 포탑이 모두 개방되었습니다. 상성에 맞춰 5분간 방어하세요!",
    chemicalEquation: "전 원소 총동원: Ca(HF 해독) + O/S(H₂S 해독) + Na/Fe(산 중화) + F/Cs(초고화력 분해)",
    historicalCase:
      "1984년 인도 보팔 참사처럼 실제 대형 화학산단 사고에서는 여러 위험물이 동시에 유출되므로 단일 물질이 아닌 전방위 화학 방어 체계가 요구됩니다.",
    tacticalSteps: [
      "1단계: 드디어 전기음성도 1위 [F 플루오린 만능 산화기]를 포함한 10종 모든 원소 포탑이 개방되었습니다!",
      "2단계: ⚠️주의! 최강 포탑인 플루오린(F)도 이미 불화된 불산(HF)은 공격하지 못합니다. 반드시 [Ca 칼슘 방벽](HF 해독 & 부식 방지)과 [O 산소 포탑](H₂S 마비 해독)을 함께 배치하세요!",
      "3단계: 300초(5분, 배속 지원) 동안 복합 재난을 막아내면 전 스테이지 무제한 서바이벌 마스터 인증과 함께 모든 스테이지에서 10종 포탑이 영구 개방됩니다!"
    ],
    rewards: "Unlock_FreeMode",
    rewardLabel: "전 스테이지 10종 포탑 영구 개방 & 무제한 서바이벌 마스터",
    pathLogic: "Tower_Blocks_Path",
    startingGold: 480,
    spawns: [{ c: 0, r: 6 }, { c: 0, r: 7 }, { c: 9, r: 0 }, { c: 10, r: 0 }],
    exits: [{ c: 19, r: 6 }, { c: 19, r: 7 }, { c: 9, r: 13 }, { c: 10, r: 13 }],
    obstacles: [
      { c: 5, r: 4 }, { c: 5, r: 9 },
      { c: 14, r: 4 }, { c: 14, r: 9 },
      { c: 9, r: 6 }, { c: 10, r: 7 }
    ]
  }
];

/**
 * DT_CompoundRecipe.csv의 42개 실제 역사적 화학 사고 데이터
 */
export const COMPOUND_RECIPES = [
  { rowName: "NH3", name: "Ammonia", displayName: "암모니아", archetype: "GAS", counter: "O / N / Cl / F", description: "1928년 독일 함부르크 – 냉동창고 암모니아 누출사고로 수십 명 질식" },
  { rowName: "Cl2", name: "Chlorine", displayName: "염소", archetype: "GAS", counter: "Na (소금 침전) / C / Cs / F", description: "1943년 미국 뉴저지 – 화학공장 폭발로 염소가스 누출, 주민 대피" },
  { rowName: "C6H6", name: "Benzene", displayName: "벤젠", archetype: "ORGANIC", counter: "C (활성탄 흡착) / O / Fe / F", description: "1948년 미국 펜실베이니아 – 벤젠 누출로 노동자 집단 중독" },
  { rowName: "CS2", name: "Carbon Disulfide", displayName: "이황화탄소", archetype: "ORGANIC", counter: "C / O / Cl / Fe / F", description: "1950년 인도 섬유공장 – 이황화탄소 증기 누출로 작업자 사망" },
  { rowName: "Hg", name: "Mercury", displayName: "수은", archetype: "HEAVY", counter: "S (황화수은 고정) / Cs / F", description: "1956년 일본 미나마타 – 수은 화합물 누출로 주민 집단 중독, '미나마타병' 발생" },
  { rowName: "H2S", name: "Hydrogen Sulfide", displayName: "황화수소", archetype: "H2S_BOSS", counter: "O (마비 해독) + S (클라우스 탈황)", description: "1964년 일본 – 황화수소 가스 누출로 광부 질식사" },
  { rowName: "CCl4", name: "Carbon Tetrachloride", displayName: "사염화탄소", archetype: "ORGANIC", counter: "C / Na / Fe / F", description: "1969년 영국 – 사염화탄소 누출로 화학공장 노동자 사망" },
  { rowName: "CH2O", name: "Formaldehyde", displayName: "포름알데히드", archetype: "ORGANIC", counter: "C / O / Cl / Fe / F", description: "1972년 미국 – 포름알데히드 누출로 인근 주민 호흡기 피해" },
  { rowName: "Ni(CO)4", name: "Nickel Carbonyl", displayName: "니켈카보닐", archetype: "HEAVY", counter: "S / Cs / F", description: "1973년 독일 화학공장 폭발 – 니켈카보닐 누출로 치명적 중독" },
  { rowName: "PbO", name: "Lead Oxide", displayName: "산화납", archetype: "HEAVY", counter: "S (황화납 고정) / Fe / Cs / F", description: "1975년 미국 배터리 공장 – 산화납 누출로 노동자 건강 피해" },
  { rowName: "SO2", name: "Sulfur Dioxide", displayName: "이산화황", archetype: "GAS", counter: "Ca (석고 침전) / Na / Cs / F", description: "1976년 이탈리아 세베소 – 다이옥신 및 이산화황 누출, 대규모 환경 피해" },
  { rowName: "HNO3", name: "Nitric Acid", displayName: "질산", archetype: "AQUEOUS", counter: "Na / Ca / Fe / Cs / F", description: "1978년 일본 – 질산 저장탱크 폭발, 화학물질 누출" },
  { rowName: "CH3OH", name: "Methanol", displayName: "메탄올", archetype: "ORGANIC", counter: "O / Cl / C / F", description: "1980년 한국 – 메탄올 누출사고로 작업자 시력 손상" },
  { rowName: "HF", name: "Hydrogen Fluoride", displayName: "불화수소", archetype: "AQUEOUS", counter: "Ca (형석 해독) / Cs (⚠️F 무반응)", description: "1982년 미국 – 불화수소 누출로 인근 주민 대피", corrodesTowers: true },
  { rowName: "CH3NCO", name: "Methyl Isocyanate", displayName: "메틸이소시아네이트", archetype: "ORGANIC", counter: "C + O + Fe + F 총력 방어", description: "1984년 인도 보팔 참사 – 살충제 원료 저장탱크 누출, 수천 명 사망" },
  { rowName: "HCN", name: "Hydrogen Cyanide", displayName: "청산가스", archetype: "STEALTH", counter: "Cl (은신 감지) / Fe (착염 침전) / Na / O", description: "1984년 인도 보팔 사고 당시 청산가스 방출, 대규모 인명 피해" },
  { rowName: "As2O3", name: "Arsenic Trioxide", displayName: "삼산화비소", archetype: "HEAVY", counter: "Fe (공침 제거) / Ca / S / Cs / F", description: "1991년 중국 제련소 사고 – 삼산화비소 누출로 대규모 중독" },
  { rowName: "CS2", name: "Carbon Disulfide", displayName: "이황화탄소", archetype: "ORGANIC", counter: "C / O / Cl / Fe / F", description: "1994년 인도 섬유공장 폭발 – 이황화탄소 누출로 대규모 화재" },
  { rowName: "KCN", name: "Potassium Cyanide", displayName: "시안화칼륨", archetype: "AQUEOUS", counter: "Cl / S (티오시안산 전환) / Fe / Cs / F", description: "1998년 가나 금광 사고 – 시안화칼륨 누출로 강 오염" },
  { rowName: "Hg", name: "Mercury", displayName: "수은", archetype: "HEAVY", counter: "S (황화수은 고정) / Cs / F", description: "2000년 페루 수은 누출사고 – 주민 중독 사례 발생" },
  { rowName: "CdCl2", name: "Cadmium Chloride", displayName: "염화카드뮴", archetype: "HEAVY", counter: "Ca / S / Fe / Cs / F", description: "2003년 일본 화학공장 사고 – 카드뮴 누출로 토양 오염" },
  { rowName: "Cl2", name: "Chlorine", displayName: "염소", archetype: "GAS", counter: "Na (소금 침전) / C / Cs / F", description: "2005년 미국 열차 충돌사고 – 염소가스 대량 누출" },
  { rowName: "C2H2", name: "Acetylene", displayName: "아세틸렌", archetype: "GAS", counter: "N (질소 퍼지) / O / F", description: "2007년 미국 용접공장 폭발 – 아세틸렌 누출 후 폭발" },
  { rowName: "SO2", name: "Sulfur Dioxide", displayName: "이산화황", archetype: "GAS", counter: "Ca / Na / Cs / F", description: "2008년 칠레 구리 제련소 사고 – 대기 오염 발생" },
  { rowName: "C6H6", name: "Benzene", displayName: "벤젠", archetype: "ORGANIC", counter: "C 흡착 + O / Fe / F", description: "2010년 중국 진저우 화학공장 폭발 – 벤젠 유출, 하천 오염" },
  { rowName: "O3", name: "Ozone", displayName: "오존", archetype: "OXIDIZER", counter: "N / C (활성탄 환원) / Cs / F", description: "2010년 대만 반도체 공장 사고 – 오존 발생 장치 폭발" },
  { rowName: "CH2O", name: "Formaldehyde", displayName: "포름알데히드", archetype: "ORGANIC", counter: "C / O / Cl / Fe / F", description: "2011년 중국 화학공장 누출 – 주민 건강 피해" },
  { rowName: "HF", name: "Hydrogen Fluoride", displayName: "불화수소", archetype: "AQUEOUS", counter: "Ca (형석 해독) / Cs (⚠️F 무반응)", description: "2012년 한국 구미 불산 누출사고 – 작업자 사망, 주민 피해", corrodesTowers: true },
  { rowName: "NaOH", name: "Sodium Hydroxide", displayName: "수산화나트륨", archetype: "AQUEOUS", counter: "Cl / S / F", description: "2012년 미국 제지공장 사고 – 하천 오염" },
  { rowName: "NH3", name: "Ammonia", displayName: "암모니아", archetype: "GAS", counter: "O / N / Cl / F", description: "2013년 중국 상하이 냉각 시스템 파손 – 암모니아 유출" },
  { rowName: "HNO3", name: "Nitric Acid", displayName: "질산", archetype: "AQUEOUS", counter: "Na / Ca / Fe / Cs / F", description: "2014년 일본 화학공장 누출 – 질산 증기 흡입 피해" },
  { rowName: "NO2", name: "Nitrogen Dioxide", displayName: "이산화질소", archetype: "OXIDIZER", counter: "N / C / Cs / F", description: "2015년 미국 화학공장 폭발 – 질소산화물 배출" },
  { rowName: "CH3OH", name: "Methanol", displayName: "메탄올", archetype: "ORGANIC", counter: "O / Cl / C / F", description: "2015년 한국 메탄올 누출사고 – 작업자 시력 손상" },
  { rowName: "H2SO4", name: "Sulfuric Acid", displayName: "황산", archetype: "AQUEOUS", counter: "Ca + Na + O + Fe 다단계 중화", description: "2016년 인도 황산 저장탱크 누출 – 토양 오염", corrodesTowers: true },
  { rowName: "PH3", name: "Phosphine", displayName: "포스핀", archetype: "STEALTH", counter: "O / N / Cl / C / F", description: "2017년 중국 저장탱크 폭발 – 포스핀 가스 누출" },
  { rowName: "CO", name: "Carbon Monoxide", displayName: "일산화탄소", archetype: "STEALTH", counter: "O + C (활성탄 포집 & CO₂ 연소)", description: "2018년 중국 광산 사고 – 일산화탄소 누출로 광부 질식" },
  { rowName: "C3H6O", name: "Acetone", displayName: "아세톤", archetype: "ORGANIC", counter: "O / N / C / F", description: "2018년 인도 아세톤 저장탱크 폭발 – 공장 전소" },
  { rowName: "C2H4O", name: "Ethylene Oxide", displayName: "에틸렌옥사이드", archetype: "OXIDIZER", counter: "N / F", description: "2019년 미국 일리노이 화학공장 폭발 – 암 발병 위험 증가" },
  { rowName: "CO2", name: "Carbon Dioxide", displayName: "이산화탄소", archetype: "GAS", counter: "Na / Ca (탄산염 침전) / Cs / F", description: "2019년 노르웨이 저장탱크 폭발 – 이산화탄소 누출로 질식 사고" },
  { rowName: "H2S", name: "Hydrogen Sulfide", displayName: "황화수소", archetype: "H2S_BOSS", counter: "O (마비 해독) + S (클라우스 탈황)", description: "2020년 인도 비자그 화학공장 사고 – 작업자 질식 사망" },
  { rowName: "C2H5OH", name: "Ethanol", displayName: "에탄올", archetype: "ORGANIC", counter: "O / Cl / C / F", description: "2021년 브라질 에탄올 저장탱크 폭발 – 대규모 화재" },
  { rowName: "Ni(CO)4", name: "Nickel Carbonyl", displayName: "니켈카보닐", archetype: "HEAVY", counter: "S / Cs / F 초고화력 분해", description: "2022년 미국 화학공장 폭발 – 니켈카보닐 누출로 치명적 중독" }
];
