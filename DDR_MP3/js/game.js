/**
 * [파일 역할] 제노택틱 2.0: 케미컬 디펜스 메인 게임 엔진
 * - 8종 원소 타워와 6종 화학위험물 적군의 실시간 화학 중화 반응, 미로 건설, 웨이브 진행을 담당합니다.
 */

import {
  GRID_CONFIG,
  MISSIONS,
  ELEMENT_TOWERS,
  HAZARD_TYPES,
  CHEMICAL_REACTIONS
} from "./data.js";
import {
  computeFlowField,
  canPlaceTowerWithoutBlocking,
  tracePreviewPaths
} from "./pathfinding.js";

class XenoChemicalGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = GRID_CONFIG.width;
    this.canvas.height = GRID_CONFIG.height;

    // 현재 선택된 미션 및 게임 상태
    this.currentMissionIndex = 0;
    this.gameSpeed = 1;
    this.isPaused = false;
    this.gameOver = false;
    this.victory = false;

    // 마우스 및 UI 상태
    this.hoverTile = null;
    this.selectedBuildElement = "C"; // 기본 선택: 탄소(C)
    this.selectedTower = null;       // 맵에 지어진 타워 클릭 시 선택 객체

    // 화학 반응 실시간 로그 (최근 8개)
    this.reactionLogs = [];

    this.initMission(0);
    this.bindEvents();
    this.renderTowerButtons();
    this.updateUI();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * 선택한 미션(스테이지)으로 보드와 상태를 초기화합니다.
   */
  initMission(missionIdx) {
    this.currentMissionIndex = missionIdx;
    const mission = MISSIONS[missionIdx];
    this.mission = mission;

    this.gold = mission.startGold;
    this.lives = mission.startLives;
    this.score = 0;
    this.wave = 0;
    this.totalWaves = mission.totalWaves;
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.autoNextWaveTimer = 0;

    this.gameOver = false;
    this.victory = false;
    this.selectedTower = null;

    // 격자 초기화 (0: 빈 땅, 1: 고정 장애물, 2: 원소 타워)
    this.grid = Array.from({ length: GRID_CONFIG.rows }, () =>
      Array(GRID_CONFIG.cols).fill(0)
    );
    for (const obs of mission.obstacles) {
      this.grid[obs.r][obs.c] = 1;
    }

    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.gasClouds = [];
    this.particles = [];
    this.floatingTexts = [];

    this.recalculatePaths();
    this.addReactionLog(`🧪 [${mission.name}] 가동 준비 완료. 원소 타워로 미로를 설계하세요!`);
    this.updateUI();
  }

  /**
   * 타워 건설/판매 시 길찾기 Flow-Field와 예상 이동 경로를 재계산합니다.
   */
  recalculatePaths() {
    const { dist, next } = computeFlowField(this.grid, this.mission.exits);
    this.flowDist = dist;
    this.flowNext = next;
    this.previewPaths = tracePreviewPaths(this.mission.spawns, this.flowNext);
    this.recalculateOxygenBuffs();
  }

  /**
   * 산소(O) 타워 주변에 있는 원소 타워들에게 연소 촉진 버프(공격력·연사속도 증가)를 부여합니다.
   */
  recalculateOxygenBuffs() {
    for (const t of this.towers) {
      t.damageMultiplier = 1.0;
      t.rateMultiplier = 1.0;
      t.isOxygenBuffed = false;
    }

    const oxygenTowers = this.towers.filter((t) => t.id === "O");
    for (const oxy of oxygenTowers) {
      const dmgBuff = oxy.def.buffDamagePct + (oxy.level - 1) * 0.12;
      const rateBuff = oxy.def.buffRatePct + (oxy.level - 1) * 0.08;

      for (const target of this.towers) {
        if (target === oxy || target.id === "O") continue;
        const dx = target.x - oxy.x;
        const dy = target.y - oxy.y;
        if (Math.hypot(dx, dy) <= oxy.range) {
          target.damageMultiplier = Math.max(target.damageMultiplier, 1 + dmgBuff);
          target.rateMultiplier = Math.max(target.rateMultiplier, 1 + rateBuff);
          target.isOxygenBuffed = true;
        }
      }
    }
  }

  /**
   * 8종 원소 타워 선택 버튼 UI 생성
   */
  renderTowerButtons() {
    const container = document.getElementById("towerPalette");
    container.innerHTML = "";

    Object.values(ELEMENT_TOWERS).forEach((el) => {
      const btn = document.createElement("button");
      btn.className = `element-card ${this.selectedBuildElement === el.id ? "active" : ""}`;
      btn.dataset.id = el.id;
      btn.style.setProperty("--el-color", el.color);

      const targetBadge =
        el.id === "O"
          ? "버프·검출"
          : el.targetAir && el.targetGround
          ? "지상+가스"
          : "지상전용";

      btn.innerHTML = `
        <div class="el-header">
          <span class="el-atomic">${el.atomicNum}</span>
          <span class="el-rank">${el.rank}</span>
        </div>
        <div class="el-symbol">${el.symbol}</div>
        <div class="el-name">${el.name.split(" ")[0]}</div>
        <div class="el-meta">
          <span class="el-cost">💰${el.cost}</span>
          <span class="el-target">${targetBadge}</span>
        </div>
      `;

      btn.addEventListener("click", () => {
        this.selectedBuildElement = el.id;
        this.selectedTower = null;
        document.querySelectorAll(".element-card").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.updateInspector();
      });

      container.appendChild(btn);
    });

    this.updateInspector();
  }

  /**
   * 하단/우측 상세 정보창(선택한 원소 설명 또는 설치된 타워 업그레이드/기폭/판매 창) 갱신
   */
  updateInspector() {
    const box = document.getElementById("inspectorContent");
    if (!box) return;

    // 1) 이미 설치된 타워를 클릭한 경우 -> 업그레이드 / 수소 기폭 / 판매 UI 표시
    if (this.selectedTower) {
      const t = this.selectedTower;
      const def = t.def;
      const upgCost = this.getUpgradeCost(t);
      const sellValue = Math.floor(t.totalInvested * 0.75);
      const effDmg = Math.round(t.damage * t.damageMultiplier);
      const effRate = (t.fireRate * t.rateMultiplier).toFixed(2);

      let extraActionHtml = "";
      if (t.id === "H") {
        const chargePct = Math.min(100, Math.floor((t.charge / t.chargeTime) * 100));
        extraActionHtml = `
          <button id="btnDetonateH" class="action-btn detonate-btn" ${chargePct < 100 ? "disabled" : ""}>
            💥 수소 즉시 기폭 (${chargePct}% 충전됨)
          </button>
        `;
      }

      box.innerHTML = `
        <div class="inspector-title" style="color:${def.glowColor}">
          [${def.symbol}] ${def.name} <span class="badge-lvl">Lv.${t.level}</span>
          ${t.isOxygenBuffed ? '<span class="badge-oxy">🔥 O₂ 연소버프 중</span>' : ""}
        </div>
        <p class="inspector-desc">${def.whyReactive}</p>
        <div class="stat-grid">
          <div>공격력: <strong>${effDmg}</strong></div>
          <div>사거리: <strong>${Math.round(t.range)}px</strong></div>
          <div>반응속도: <strong>${effRate}/s</strong></div>
          <div>누적중화: <strong>${Math.round(t.totalDamageDealt)}</strong></div>
        </div>
        <div class="inspector-actions">
          <button id="btnUpgradeTower" class="action-btn upg-btn" ${this.gold < upgCost || t.level >= 5 ? "disabled" : ""}>
            ${t.level >= 5 ? "최대 레벨 (MAX)" : `⬆️ 농도 강화 Lv.${t.level + 1} (💰${upgCost})`}
          </button>
          ${extraActionHtml}
          <button id="btnSellTower" class="action-btn sell-btn">
            ♻️ 회수/판매 (+💰${sellValue})
          </button>
        </div>
      `;

      const upgBtn = document.getElementById("btnUpgradeTower");
      if (upgBtn) upgBtn.onclick = () => this.upgradeSelectedTower();

      const sellBtn = document.getElementById("btnSellTower");
      if (sellBtn) sellBtn.onclick = () => this.sellSelectedTower();

      const detBtn = document.getElementById("btnDetonateH");
      if (detBtn) detBtn.onclick = () => this.triggerHydrogenExplosion(t, true);
      return;
    }

    // 2) 건설할 원소 카드를 보고 있는 경우 -> 원소 반응성 이유와 상성 설명 표시
    const def = ELEMENT_TOWERS[this.selectedBuildElement];
    box.innerHTML = `
      <div class="inspector-title" style="color:${def.glowColor}">
        원자번호 ${def.atomicNum} [${def.symbol}] ${def.name} (반응성 ${def.rank})
      </div>
      <p class="inspector-desc"><strong>왜 반응성이 큰가?</strong> ${def.whyReactive}</p>
      <p class="inspector-concept"><strong>타워 컨셉:</strong> ${def.concept}</p>
      <div class="stat-grid">
        <div>건설비용: <strong>💰${def.cost}</strong></div>
        <div>기본위력: <strong>${def.damage}</strong></div>
        <div>반응반경: <strong>${def.range}px</strong></div>
        <div>타겟속성: <strong>${def.id === "O" ? "주변 타워 버프" : def.targetAir ? "지상 + 가스(공중)" : "지상 위험물"}</strong></div>
      </div>
    `;
  }

  getUpgradeCost(tower) {
    return Math.floor(tower.def.cost * 0.85 * tower.level);
  }

  upgradeSelectedTower() {
    const t = this.selectedTower;
    if (!t || t.level >= 5) return;
    const cost = this.getUpgradeCost(t);
    if (this.gold < cost) return;

    this.gold -= cost;
    t.totalInvested += cost;
    t.level += 1;
    t.damage = Math.round(t.def.damage * Math.pow(1.38, t.level - 1));
    t.range = Math.round(t.def.range * (1 + (t.level - 1) * 0.08));

    if (t.id === "O") {
      this.recalculateOxygenBuffs();
    }

    this.spawnFloatingText(t.x, t.y - 12, `${t.def.symbol} Lv.${t.level}!`, t.def.glowColor);
    this.updateUI();
  }

  sellSelectedTower() {
    const t = this.selectedTower;
    if (!t) return;
    const refund = Math.floor(t.totalInvested * 0.75);
    this.gold += refund;
    this.grid[t.r][t.c] = 0;
    this.towers = this.towers.filter((item) => item !== t);
    this.selectedTower = null;

    this.recalculatePaths();
    this.spawnFloatingText(t.x, t.y, `+💰${refund}`, "#fde047");
    this.updateUI();
  }

  /**
   * 캔버스 클릭 및 버튼 이벤트 바인딩
   */
  bindEvents() {
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(mx / GRID_CONFIG.tileSize);
      const r = Math.floor(my / GRID_CONFIG.tileSize);

      if (c >= 0 && c < GRID_CONFIG.cols && r >= 0 && r < GRID_CONFIG.rows) {
        this.hoverTile = { c, r };
      } else {
        this.hoverTile = null;
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.hoverTile = null;
    });

    this.canvas.addEventListener("click", () => {
      if (!this.hoverTile || this.gameOver || this.victory) return;
      const { c, r } = this.hoverTile;

      // 이미 설치된 타워 클릭 시 -> 해당 타워 선택
      const existing = this.towers.find((t) => t.c === c && t.r === r);
      if (existing) {
        this.selectedTower = existing;
        this.updateInspector();
        return;
      }

      // 빈 타일 클릭 시 -> 현재 선택된 원소 타워 건설 시도
      this.tryBuildTower(c, r);
    });

    // 우클릭 시 타워 선택 해제 (빠른 건설 복귀)
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.selectedTower = null;
      this.updateInspector();
    });

    // 다음 웨이브 시작 버튼
    document.getElementById("btnStartWave")?.addEventListener("click", () => {
      this.startNextWave();
    });

    // 배속 토글 버튼
    document.getElementById("btnSpeed")?.addEventListener("click", (e) => {
      this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
      e.currentTarget.textContent = `⏩ 배속: ${this.gameSpeed}x`;
    });

    // 일시정지 버튼
    document.getElementById("btnPause")?.addEventListener("click", (e) => {
      this.isPaused = !this.isPaused;
      e.currentTarget.textContent = this.isPaused ? "▶️ 재개" : "⏸️ 일시정지";
    });

    // 미션 선택 드롭다운
    document.getElementById("missionSelect")?.addEventListener("change", (e) => {
      this.initMission(Number(e.target.value));
    });

    // 다시 시작 버튼
    document.getElementById("btnRestart")?.addEventListener("click", () => {
      this.initMission(this.currentMissionIndex);
    });

    // 키보드 단축키 (1~8로 원소 바로 선택, Space로 다음 웨이브)
    window.addEventListener("keydown", (e) => {
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8"];
      const elKeys = Object.keys(ELEMENT_TOWERS);
      const idx = keys.indexOf(e.key);
      if (idx !== -1 && elKeys[idx]) {
        this.selectedBuildElement = elKeys[idx];
        this.selectedTower = null;
        this.renderTowerButtons();
      } else if (e.code === "Space") {
        e.preventDefault();
        this.startNextWave();
      }
    });
  }

  /**
   * 원소 타워 건설 시도 (제노택틱 미로 봉쇄 검사 포함)
   */
  tryBuildTower(c, r) {
    const def = ELEMENT_TOWERS[this.selectedBuildElement];
    if (!def) return;

    if (this.gold < def.cost) {
      this.spawnFloatingText(
        c * GRID_CONFIG.tileSize + 18,
        r * GRID_CONFIG.tileSize + 18,
        "골드 부족!",
        "#f87171"
      );
      return;
    }

    // 미로 입구~출구를 완전히 막는지 검사
    const canPlace = canPlaceTowerWithoutBlocking(
      this.grid,
      this.mission.spawns,
      this.mission.exits,
      this.enemies,
      c,
      r
    );

    if (!canPlace) {
      this.spawnFloatingText(
        c * GRID_CONFIG.tileSize + 18,
        r * GRID_CONFIG.tileSize + 18,
        "🚫 경로 완전 봉쇄 불가!",
        "#ef4444"
      );
      this.addReactionLog("⚠️ [경고] 위험물 배출 경로를 완전히 막을 수 없습니다! 우회 미로를 만드세요.");
      return;
    }

    this.gold -= def.cost;
    this.grid[r][c] = 2;

    const x = c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
    const y = r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;

    const newTower = {
      id: def.id,
      def,
      c,
      r,
      x,
      y,
      level: 1,
      damage: def.damage,
      range: def.range,
      fireRate: def.fireRate,
      cooldown: 0,
      charge: def.id === "H" ? 4.5 : 0, // 수소(H)는 건설 직후 1회 완충 상태로 시작!
      chargeTime: 4.5,
      damageMultiplier: 1.0,
      rateMultiplier: 1.0,
      isOxygenBuffed: false,
      totalInvested: def.cost,
      totalDamageDealt: 0,
      angle: 0
    };

    this.towers.push(newTower);
    this.selectedTower = newTower;
    this.recalculatePaths();
    this.updateUI();
  }

  /**
   * 다음 웨이브의 화학위험물 스폰 큐를 생성하고 시작합니다.
   */
  startNextWave() {
    if (this.gameOver || this.victory) return;
    if (this.wave >= this.totalWaves) return;

    this.wave += 1;
    this.waveActive = true;

    // 웨이브 번호에 따라 등장할 화학위험물 구성 결정
    const w = this.wave;
    const hpScale = Math.pow(1.22, w - 1);
    const count = 8 + Math.floor(w * 1.5);

    // 웨이브별 주요 위험물 타입 선정
    let hazardKey = "aqueous";
    if (w % 5 === 0) {
      hazardKey = "heavy"; // 5웨이브마다 중금속·규산염 보스 웨이브!
    } else if (w % 4 === 0) {
      hazardKey = "gas"; // 4웨이브마다 공중 유독가스 웨이브!
    } else if (w >= 6 && w % 3 === 0) {
      hazardKey = "stealth"; // 은신 무색 가스 웨이브
    } else if (w % 2 === 0) {
      hazardKey = w >= 4 ? "oxidizer" : "organic";
    } else {
      hazardKey = w >= 3 && Math.random() < 0.45 ? "organic" : "aqueous";
    }

    const baseDef = HAZARD_TYPES[hazardKey];
    const finalCount = baseDef.isBoss ? Math.max(2, Math.floor(w / 4)) : count;

    for (let i = 0; i < finalCount; i++) {
      const spawnPt = this.mission.spawns[i % this.mission.spawns.length];
      const exitPt = this.mission.exits[i % this.mission.exits.length];
      this.spawnQueue.push({
        def: baseDef,
        hp: Math.round(baseDef.hp * hpScale),
        spawnPt,
        exitPt
      });
    }

    this.addReactionLog(
      `🚨 [Wave ${this.wave}/${this.totalWaves}] ${baseDef.name} (${baseDef.formula}) 유입 시작!`
    );
    this.updateUI();
  }

  /**
   * 메인 프레임 루프
   */
  loop(timestamp) {
    const rawDt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (!this.isPaused && !this.gameOver && !this.victory) {
      const dt = rawDt * this.gameSpeed;
      this.update(dt);
    }

    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 1. 스폰 큐에서 적군 생성
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const item = this.spawnQueue.shift();
        this.spawnEnemy(item);
        this.spawnTimer = item.def.isBoss ? 1.3 : 0.65;
      }
    } else if (this.waveActive && this.enemies.length === 0) {
      this.waveActive = false;
      // 웨이브 클리어 보너스 골드
      const clearBonus = 15 + this.wave * 3;
      this.gold += clearBonus;
      this.spawnFloatingText(
        GRID_CONFIG.width / 2,
        40,
        `Wave ${this.wave} 정화 완료! (+💰${clearBonus})`,
        "#34d399"
      );

      if (this.wave >= this.totalWaves) {
        this.victory = true;
        this.addReactionLog("🏆 [미션 성공] 모든 화학위험물을 성공적으로 중화했습니다!");
      }
      this.updateUI();
    }

    // 2. 탄소(C) 및 산소(O) 타워의 은신(Stealth) 가스 검출 처리
    this.updateStealthDetection(dt);

    // 3. 타워 공격 및 특수 반응 업데이트
    this.updateTowers(dt);

    // 4. 투사체 및 염소(Cl) 독가스 구름 업데이트
    this.updateProjectiles(dt);
    this.updateGasClouds(dt);

    // 5. 적군 이동 및 상태이상(부식 DoT, 감속) 업데이트
    this.updateEnemies(dt);

    // 6. 파티클 및 플로팅 화학식 업데이트
    this.updateEffects(dt);
  }

  spawnEnemy(item) {
    const { def, hp, spawnPt, exitPt } = item;
    const x = spawnPt.c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
    const y = spawnPt.r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;

    this.enemies.push({
      def,
      id: def.id,
      name: def.name,
      formula: def.formula,
      x,
      y,
      hp,
      maxHp: hp,
      speed: def.speed,
      armor: def.armor,
      reward: def.reward,
      isFlying: def.isFlying,
      isStealth: def.isStealth,
      revealedTimer: 0,
      slowTimer: 0,
      slowFactor: 0,
      dotTimer: 0,
      dotDps: 0,
      exitPt,
      dead: false
    });
  }

  /**
   * 탄소(C) 활성탄 타워와 산소(O) 타워 주변의 은신(무색 가스) 적 검출 및 탄소 흡착 감속
   */
  updateStealthDetection(dt) {
    for (const t of this.towers) {
      if (!t.def.detectsStealth) continue;

      for (const e of this.enemies) {
        const dist = Math.hypot(e.x - t.x, e.y - t.y);
        if (dist <= t.range) {
          if (e.isStealth) {
            e.revealedTimer = 0.5;
          }
          // 탄소(C) 타워는 범위 내 모든 적을 다공성 흡착으로 감속시킴
          if (t.id === "C") {
            const slowAmt = Math.min(0.65, t.def.slowFactor + (t.level - 1) * 0.06);
            e.slowFactor = Math.max(e.slowFactor, slowAmt);
            e.slowTimer = Math.max(e.slowTimer, 0.5);
          }
        }
      }
    }
  }

  /**
   * 8종 원소 타워별 고유 공격 메커니즘 실행
   */
  updateTowers(dt) {
    for (const t of this.towers) {
      if (t.id === "O") continue; // 산소(O)는 패시브 버프 오라 타워

      // 수소(H) 타워: 충전 후 범위 내 다수 적 접근 시 자동 기폭 (미로 벽은 유지!)
      if (t.id === "H") {
        const chargeSpeed = t.rateMultiplier * (1 + (t.level - 1) * 0.12);
        if (t.charge < t.chargeTime) {
          t.charge = Math.min(t.chargeTime, t.charge + dt * chargeSpeed);
          if (this.selectedTower === t) this.updateInspector();
        } else {
          // 완충 상태일 때 범위 내 적이 있으면 자동 환원 기폭!
          const inRangeEnemies = this.getValidTargets(t);
          if (inRangeEnemies.length > 0) {
            this.triggerHydrogenExplosion(t, false);
          }
        }
        continue;
      }

      t.cooldown -= dt * t.rateMultiplier;
      if (t.cooldown > 0) continue;

      const targets = this.getValidTargets(t);
      if (targets.length === 0) continue;

      // 출구에 가장 가까운 적 우선 타겟팅
      const primary = targets[0];
      t.angle = Math.atan2(primary.y - t.y, primary.x - t.x);
      t.cooldown = 1 / t.fireRate;

      if (t.id === "C") {
        // 탄소(C): 범위 내 적들에게 흡착 마찰 펄스
        for (const target of targets.slice(0, 3)) {
          this.applyElementHit(t, target, t.damage * t.damageMultiplier);
        }
        this.spawnRingEffect(t.x, t.y, t.range * 0.6, t.def.color);
      } else if (t.id === "K") {
        // 포타슘(K): 보라색 불꽃 빠른 연쇄 스파크!
        this.firePotassiumChain(t, primary);
      } else if (t.id === "F") {
        // 플루오린(F): 즉시 타격하는 초강력 불소 부식 레이저 + 방어력 파괴 + 지속 부식 DoT
        this.fireFluorineBeam(t, primary);
      } else {
        // 소듐(Na), 염소(Cl), 세슘(Cs): 투사체 발사
        this.projectiles.push({
          tower: t,
          target: primary,
          x: t.x,
          y: t.y,
          speed: t.id === "Cs" ? 320 : 380,
          color: t.def.glowColor
        });
      }
    }
  }

  /**
   * 수소(H) 타워 초광역 환원 기폭!
   * - 중요: 기폭 후에도 수소 압력용기 베이스(타워)는 파괴되지 않고 남아서 미로 벽을 유지합니다!
   */
  triggerHydrogenExplosion(t, isManual) {
    if (t.charge < t.chargeTime) return;
    const targets = this.getValidTargets(t);
    if (targets.length === 0 && !isManual) return;

    t.charge = 0;
    const baseDmg = t.damage * t.damageMultiplier;

    this.spawnRingEffect(t.x, t.y, t.range, "#38bdf8");
    for (let i = 0; i < 26; i++) {
      const ang = (Math.PI * 2 * i) / 26;
      const spd = 60 + Math.random() * 140;
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.55,
        maxLife: 0.55,
        color: i % 2 === 0 ? "#38bdf8" : "#fde047",
        size: 4
      });
    }

    for (const enemy of targets) {
      this.applyElementHit(t, enemy, baseDmg);
    }

    this.spawnFloatingText(t.x, t.y - 16, "💥 2H₂ + O₂ → 2H₂O 광역폭발!", "#7dd3fc");
    if (this.selectedTower === t) this.updateInspector();
  }

  /**
   * 포타슘(K) 보라색 불꽃 연쇄 폭발 (Chain Lightning/Flame)
   */
  firePotassiumChain(t, firstTarget) {
    const maxJumps = t.def.chainCount + Math.floor(t.level / 2);
    const visited = new Set([firstTarget]);
    let curr = firstTarget;
    let prevPos = { x: t.x, y: t.y };
    let dmg = t.damage * t.damageMultiplier;

    for (let i = 0; i < maxJumps; i++) {
      this.applyElementHit(t, curr, dmg);
      this.spawnBeamEffect(prevPos.x, prevPos.y, curr.x, curr.y, "#d8b4fe");

      prevPos = { x: curr.x, y: curr.y };
      dmg *= 0.82;

      // 주변 다른 적 탐색
      let nextTarget = null;
      let bestDist = t.def.chainRange;
      for (const cand of this.enemies) {
        if (cand.dead || visited.has(cand)) continue;
        if (cand.isStealth && cand.revealedTimer <= 0) continue;
        const d = Math.hypot(cand.x - curr.x, cand.y - curr.y);
        if (d <= bestDist) {
          bestDist = d;
          nextTarget = cand;
        }
      }
      if (!nextTarget) break;
      visited.add(nextTarget);
      curr = nextTarget;
    }
  }

  /**
   * 플루오린(F) 만능 산화 레이저 + 방어력 영구 부식 + 지속 부식 데미지
   */
  fireFluorineBeam(t, target) {
    const baseDmg = t.damage * t.damageMultiplier;
    // 유리질/중금속 보호막 부식 (방어력 깎기)
    if (target.armor > 0) {
      target.armor = Math.max(0, target.armor - 0.18);
    }
    // 강력한 불산(HF) 부식 지속 피해 부여
    const dotDps = (t.def.dotDps + (t.level - 1) * 22) * t.damageMultiplier;
    target.dotDps = Math.max(target.dotDps, dotDps);
    target.dotTimer = Math.max(target.dotTimer, t.def.dotDuration);

    this.applyElementHit(t, target, baseDmg);
    this.spawnBeamEffect(t.x, t.y, target.x, target.y, "#6ee7b7");
  }

  /**
   * 타워가 조준 가능한 사거리 내 적군 목록 반환
   */
  getValidTargets(tower) {
    const list = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.isFlying && !tower.def.targetAir) continue;
      if (!e.isFlying && !tower.def.targetGround) continue;
      if (e.isStealth && e.revealedTimer <= 0) continue;

      const d = Math.hypot(e.x - tower.x, e.y - tower.y);
      if (d <= tower.range) {
        list.push(e);
      }
    }

    // 출구에 더 가까운 적을 먼저 조준
    list.sort((a, b) => {
      const da = Math.hypot(a.x - a.exitPt.c * 36, a.y - a.exitPt.r * 36);
      const db = Math.hypot(b.x - b.exitPt.c * 36, b.y - b.exitPt.r * 36);
      return da - db;
    });
    return list;
  }

  /**
   * 투사체(소듐 Na, 염소 Cl, 세슘 Cs) 이동 및 명중 처리
   */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const target = p.target;

      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= p.speed * dt || target.dead) {
        this.onProjectileHit(p.tower, target.x, target.y, target);
        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
      }
    }
  }

  onProjectileHit(tower, x, y, directTarget) {
    const baseDmg = tower.damage * tower.damageMultiplier;

    if (tower.id === "Cl") {
      // 염소(Cl): 직격 피해 + 해당 위치에 살균 독가스 구름 장판 생성!
      if (!directTarget.dead) {
        this.applyElementHit(tower, directTarget, baseDmg);
      }
      this.gasClouds.push({
        tower,
        x,
        y,
        radius: tower.def.cloudRadius + (tower.level - 1) * 6,
        dps: (tower.def.cloudDps + (tower.level - 1) * 10) * tower.damageMultiplier,
        duration: tower.def.cloudDuration,
        maxDuration: tower.def.cloudDuration
      });
      return;
    }

    // 소듐(Na) 및 세슘(Cs): 스플래시 폭발
    const splashRadius = tower.def.splashRadius || 50;
    this.spawnRingEffect(x, y, splashRadius, tower.def.glowColor);

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.isFlying && !tower.def.targetAir) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= splashRadius) {
        const falloff = d < 18 ? 1.0 : 0.75;
        this.applyElementHit(tower, e, baseDmg * falloff);
      }
    }
  }

  /**
   * 염소(Cl) 살균 독가스 구름 장판 지속 중화 처리
   */
  updateGasClouds(dt) {
    for (let i = this.gasClouds.length - 1; i >= 0; i--) {
      const cloud = this.gasClouds[i];
      cloud.duration -= dt;
      if (cloud.duration <= 0) {
        this.gasClouds.splice(i, 1);
        continue;
      }

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.isStealth && e.revealedTimer <= 0) continue;
        const d = Math.hypot(e.x - cloud.x, e.y - cloud.y);
        if (d <= cloud.radius) {
          this.applyElementHit(cloud.tower, e, cloud.dps * dt, true);
        }
      }
    }
  }

  /**
   * [핵심 비즈니스 로직] 원소 타워가 화학위험물 적군을 타격할 때 화학 상성 및 반응식 적용
   */
  applyElementHit(tower, enemy, rawDamage, isContinuous = false) {
    if (enemy.dead) return;

    const reactionKey = `${tower.id}:${enemy.id}`;
    const reaction = CHEMICAL_REACTIONS[reactionKey];
    let finalDmg = rawDamage;

    if (reaction) {
      finalDmg *= reaction.mult;
      // 상성 반응 발생 시 확률적으로 화학 반응식 팝업 및 로그 출력
      if (!isContinuous && Math.random() < 0.38) {
        this.spawnFloatingText(enemy.x, enemy.y - 14, `⚗️ ×${reaction.mult}`, tower.def.glowColor);
        this.addReactionLog(`⚗️ [${tower.def.symbol} + ${enemy.formula}] ${reaction.equation}`);
      }
    }

    // 적의 방어력(유리질/중금속 피막) 적용
    finalDmg *= 1 - enemy.armor;

    enemy.hp -= finalDmg;
    tower.totalDamageDealt += finalDmg;

    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      this.gold += enemy.reward;
      this.score += enemy.reward * 10;

      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 25 + Math.random() * 55;
        this.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.4,
          maxLife: 0.4,
          color: tower.def.glowColor,
          size: 3
        });
      }

      this.spawnFloatingText(enemy.x, enemy.y, `중화 완료! +💰${enemy.reward}`, "#fde047");
      this.updateUI();
    }
  }

  /**
   * 적군 이동 (지상군은 미로 Flow-Field 추종, 가스형 공중군은 출구로 직선 비행)
   */
  updateEnemies(dt) {
    const ts = GRID_CONFIG.tileSize;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }

      // 은신 타이머 및 감속 타이머 차감
      if (e.revealedTimer > 0) e.revealedTimer -= dt;
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
      } else {
        e.slowFactor = 0;
      }

      // 플루오린(F) 부식 지속 데미지(DoT)
      if (e.dotTimer > 0) {
        e.dotTimer -= dt;
        e.hp -= e.dotDps * dt;
        if (e.hp <= 0) {
          e.dead = true;
          this.gold += e.reward;
          this.score += e.reward * 10;
          this.enemies.splice(i, 1);
          this.updateUI();
          continue;
        }
      }

      const effSpeed = e.speed * (1 - e.slowFactor);
      const currC = Math.max(0, Math.min(GRID_CONFIG.cols - 1, Math.floor(e.x / ts)));
      const currR = Math.max(0, Math.min(GRID_CONFIG.rows - 1, Math.floor(e.y / ts)));

      // 출구 도달 여부 확인
      const reachedExit = this.mission.exits.some(
        (ex) => ex.c === currC && ex.r === currR && Math.hypot(e.x - (ex.c * ts + ts / 2), e.y - (ex.r * ts + ts / 2)) < 12
      );

      if (reachedExit) {
        this.lives = Math.max(0, this.lives - (e.def.isBoss ? 3 : 1));
        this.spawnFloatingText(e.x, e.y, "☣️ 오염 유출! -1", "#ef4444");
        this.enemies.splice(i, 1);
        if (this.lives <= 0) {
          this.gameOver = true;
          this.addReactionLog("💥 [오염 한계 초과] 방어선이 뚫렸습니다! 미션을 재시작하세요.");
        }
        this.updateUI();
        continue;
      }

      // 이동 목표 좌표 계산
      let targetX, targetY;
      if (e.isFlying) {
        // 공중(가스형) 위험물: 타워 미로를 무시하고 출구로 직선 이동
        targetX = e.exitPt.c * ts + ts / 2;
        targetY = e.exitPt.r * ts + ts / 2;
      } else {
        // 지상 위험물: FlowField의 다음 타일 중심점으로 이동
        const nextTile = this.flowNext[currR]?.[currC];
        if (nextTile) {
          targetX = nextTile.c * ts + ts / 2;
          targetY = nextTile.r * ts + ts / 2;
        } else {
          targetX = e.exitPt.c * ts + ts / 2;
          targetY = e.exitPt.r * ts + ts / 2;
        }
      }

      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        e.x += (dx / dist) * effSpeed * dt;
        e.y += (dy / dist) * effSpeed * dt;
      }
    }
  }

  /**
   * 시각 이펙트 생성 및 업데이트
   */
  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  spawnRingEffect(x, y, maxRadius, color) {
    this.particles.push({
      type: "ring",
      x,
      y,
      radius: 6,
      maxRadius,
      life: 0.32,
      maxLife: 0.32,
      color
    });
  }

  spawnBeamEffect(x1, y1, x2, y2, color) {
    this.particles.push({
      type: "beam",
      x1,
      y1,
      x2,
      y2,
      life: 0.16,
      maxLife: 0.16,
      color
    });
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.type === "ring") {
        p.radius = p.maxRadius * (1 - p.life / p.maxLife);
      } else if (!p.type) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 22 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  addReactionLog(msg) {
    this.reactionLogs.unshift(msg);
    if (this.reactionLogs.length > 7) this.reactionLogs.pop();
    const logEl = document.getElementById("reactionLogList");
    if (logEl) {
      logEl.innerHTML = this.reactionLogs.map((l) => `<li>${l}</li>`).join("");
    }
  }

  updateUI() {
    document.getElementById("statGold").textContent = this.gold;
    document.getElementById("statLives").textContent = this.lives;
    document.getElementById("statWave").textContent = `${this.wave} / ${this.totalWaves}`;
    document.getElementById("statScore").textContent = this.score.toLocaleString();
    this.updateInspector();
  }

  /**
   * 캔버스 전체 렌더링 (격자, 예상 미로 경로, 타워, 염소 구름, 위험물 적군, 화학 이펙트)
   */
  draw() {
    const ctx = this.ctx;
    const ts = GRID_CONFIG.tileSize;

    // 1. 배경 및 실험실 격자선
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_CONFIG.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * ts, 0);
      ctx.lineTo(c * ts, this.canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_CONFIG.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ts);
      ctx.lineTo(this.canvas.width, r * ts);
      ctx.stroke();
    }

    // 2. 입구(IN) / 출구(OUT) / 고정 격리벽 표시
    for (const obs of this.mission.obstacles) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(obs.c * ts + 2, obs.r * ts + 2, ts - 4, ts - 4);
      ctx.strokeStyle = "#475569";
      ctx.strokeRect(obs.c * ts + 2, obs.r * ts + 2, ts - 4, ts - 4);
    }

    for (const sp of this.mission.spawns) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(sp.c * ts, sp.r * ts, ts, ts);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("유입구", sp.c * ts + ts / 2, sp.r * ts + ts / 2 + 4);
    }

    for (const ex of this.mission.exits) {
      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.fillRect(ex.c * ts, ex.r * ts, ts, ts);
      ctx.fillStyle = "#6ee7b7";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("배출구", ex.c * ts + ts / 2, ex.r * ts + ts / 2 + 4);
    }

    // 3. 실시간 미로 최단 경로 가이드라인 (점선)
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    for (const path of this.previewPaths) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].c * ts + ts / 2, path[0].r * ts + ts / 2);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].c * ts + ts / 2, path[i].r * ts + ts / 2);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 4. 마우스 호버 시 건설 미리보기 및 사거리 원 표시
    if (this.hoverTile && !this.selectedTower) {
      const { c, r } = this.hoverTile;
      const def = ELEMENT_TOWERS[this.selectedBuildElement];
      const cx = c * ts + ts / 2;
      const cy = r * ts + ts / 2;

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(c * ts, r * ts, ts, ts);

      ctx.beginPath();
      ctx.arc(cx, cy, def.range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.07)";
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // 5. 선택된 타워 사거리 표시
    if (this.selectedTower) {
      const t = this.selectedTower;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.09)";
      ctx.fill();
      ctx.strokeStyle = t.def.glowColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 6. 염소(Cl) 살균 독가스 구름 장판 렌더링
    for (const cloud of this.gasClouds) {
      const alpha = Math.max(0.1, (cloud.duration / cloud.maxDuration) * 0.35);
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(132, 204, 22, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(190, 242, 100, ${alpha + 0.15})`;
      ctx.stroke();
    }

    // 7. 원소 타워 렌더링 (주기율표 타일 디자인)
    for (const t of this.towers) {
      const x = t.c * ts;
      const y = t.r * ts;

      // 산소(O) 버프 받는 타워는 외곽 푸른 불꽃 테두리 표시
      if (t.isOxygenBuffed) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      }

      // 타워 본체 배경
      ctx.fillStyle = "#111827";
      ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);

      // 수소(H) 타워 충전 게이지 바 표시
      if (t.id === "H") {
        const pct = Math.min(1, t.charge / t.chargeTime);
        ctx.fillStyle = "rgba(56, 189, 248, 0.28)";
        ctx.fillRect(x + 4, y + ts - 8, (ts - 8) * pct, 4);
      }

      // 원소 기호 텍스트
      ctx.fillStyle = t.def.glowColor;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.def.symbol, t.x, t.y + 4);

      // 레벨 점 표시
      ctx.fillStyle = "#fde047";
      ctx.font = "9px sans-serif";
      ctx.fillText("★".repeat(t.level), t.x, y + 11);
    }

    // 8. 화학위험물 적군 렌더링
    for (const e of this.enemies) {
      ctx.save();
      if (e.isStealth && e.revealedTimer <= 0) {
        ctx.globalAlpha = 0.25; // 은신 상태일 때는 반투명
      }

      const radius = e.def.isBoss ? 14 : 10;
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = e.def.color;
      ctx.fill();
      ctx.lineWidth = e.isFlying ? 2.5 : 1.5;
      ctx.strokeStyle = e.dotTimer > 0 ? "#6ee7b7" : "#ffffff";
      ctx.stroke();

      // 화학식 라벨
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.def.id === "heavy" ? "Pb·SiO₂" : e.def.symbol || e.id.slice(0, 3).toUpperCase(), e.x, e.y + 3);

      // 체력 바
      const bw = 26;
      const bh = 4;
      const hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(e.x - bw / 2, e.y - radius - 7, bw, bh);
      ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
      ctx.fillRect(e.x - bw / 2, e.y - radius - 7, bw * hpRatio, bh);

      ctx.restore();
    }

    // 9. 투사체 렌더링
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // 10. 파티클 및 레이저/충격파 이펙트
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.type === "ring") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (p.type === "beam") {
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // 11. 플로팅 화학 반응 텍스트
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 12. 게임오버 / 승리 오버레이
    if (this.gameOver || this.victory) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = this.victory ? "#34d399" : "#f87171";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        this.victory ? "🧪 모든 화학위험물 정화 완료! (VICTORY)" : "☣️ 방어선 오염 초과 (GAME OVER)",
        this.canvas.width / 2,
        this.canvas.height / 2 - 10
      );
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "상단 [🔄 미션 재시작] 또는 다른 미션을 선택해 다시 도전하세요.",
        this.canvas.width / 2,
        this.canvas.height / 2 + 28
      );
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new XenoChemicalGame();
});
