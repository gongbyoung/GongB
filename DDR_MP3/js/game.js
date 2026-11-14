/**
 * [파일 역할] 제노택틱 2.0: 케미컬 디펜스 메인 엔진 (game.js)
 * - 10개 튜토리얼 스테이지(TUT-01 ~ TUT-10) 미션 로직 및 클리어 조건 완벽 구현
 * - 모든 튜토리얼 스테이지 맵을 그대로 활용한 [무한 서바이벌(무제한 유닛) 모드] 지원
 * - DT_CompoundRecipe.csv의 42개 실제 역사적 화학 사고 데이터를 서바이벌 웨이브/무제한 스트림과 연동
 * - ./icon 24종(업그레이드 _up.png 자동 감지 포함) 및 ./sound 21종 완벽 연동
 */

import {
  GRID_CONFIG,
  SOUND_PATHS,
  UI_ICONS,
  TOWER_TYPES,
  ENEMY_TYPES,
  TUTORIAL_ENEMIES,
  TUTORIAL_STAGES,
  COMPOUND_RECIPES
} from "./data.js";

import {
  computeFlowField,
  canPlaceTowerWithoutBlocking,
  tracePreviewPaths
} from "./pathfinding.js";

class SoundManager {
  constructor() {
    this.enabled = true;
    this.buffers = {};
    this.lastPlayed = {};
    this.ambientAudio = null;

    for (const [key, path] of Object.entries(SOUND_PATHS)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      this.buffers[key] = audio;
    }
  }

  play(key, volume = 0.45, cooldownMs = 75) {
    if (!this.enabled || !this.buffers[key]) return;
    const now = performance.now();
    if (this.lastPlayed[key] && now - this.lastPlayed[key] < cooldownMs) return;
    this.lastPlayed[key] = now;

    try {
      const clone = this.buffers[key].cloneNode();
      clone.volume = Math.min(1, Math.max(0, volume));
      clone.play().catch(() => {});
    } catch (_) {}
  }

  startAmbient() {
    if (!this.enabled || !this.buffers.ambientLoop) return;
    if (!this.ambientAudio) {
      this.ambientAudio = this.buffers.ambientLoop;
      this.ambientAudio.loop = true;
      this.ambientAudio.volume = 0.16;
    }
    this.ambientAudio.play().catch(() => {});
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.ambientAudio) {
      this.ambientAudio.pause();
    } else if (this.enabled) {
      this.startAmbient();
    }
    return this.enabled;
  }
}

class ImageAssets {
  constructor() {
    this.images = {};
  }

  load(path) {
    if (!path) return null;
    if (this.images[path]) return this.images[path];

    const entry = { img: new Image(), loaded: false, error: false };
    entry.img.onload = () => {
      entry.loaded = true;
    };
    entry.img.onerror = () => {
      entry.error = true;
    };
    entry.img.src = path;
    this.images[path] = entry;
    return entry;
  }

  preloadAll() {
    for (const path of Object.values(UI_ICONS)) this.load(path);
    for (const t of Object.values(TOWER_TYPES)) {
      this.load(t.imagePath);
      if (t.upgradeImagePath) this.load(t.upgradeImagePath);
    }
    for (const e of Object.values(ENEMY_TYPES)) this.load(e.imagePath);
  }

  getDrawable(path) {
    const entry = this.images[path];
    if (entry && entry.loaded && !entry.error) return entry.img;
    return null;
  }
}

class ChemicalDefenseGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.sound = new SoundManager();
    this.assets = new ImageAssets();
    this.assets.preloadAll();

    // 게임 모드 ('tutorial' | 'survival') 및 현재 선택된 스테이지 인덱스 (0 ~ 9)
    this.mode = "tutorial";
    this.stageIndex = 0;
    this.paletteFilter = "all";
    this.endlessStream = false;
    this.streamTimer = 0;
    this.streamSpawnCount = 0;

    // 해금 기록 (튜토리얼 보상)
    this.unlockedRewards = new Set(["Unlock_Shop"]);

    // 게임 런타임 상태
    this.gold = 220;
    this.lives = 20;
    this.maxLives = 20;
    this.score = 0;
    this.wave = 0;
    this.speedMultiplier = 1;
    this.paused = false;
    this.isModalOpen = false;
    this.gameOver = false;
    this.stageCleared = false;

    // 튜토리얼 목표 진행도 추적기
    this.objectiveProgress = 0;
    this.objectiveTarget = 20;
    this.currentPh = 1.5; // TUT-04 산성도 추적용
    this.gasConcentration = 100; // TUT-02 농도 추적용
    this.towerDestroyedCount = 0; // TUT-05 무손실 추적용
    this.paralysisCuredCount = 0; // TUT-06 해독 횟수
    this.survivalTimer = 0; // TUT-10 5분 생존 타이머

    // 격자, 타워, 적군, 투사체, 이펙트
    this.grid = [];
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnQueue = [];
    this.spawnCooldown = 0;

    // 선택 및 마우스 호버 상태
    this.selectedBuildType = "O";
    this.selectedTower = null;
    this.hoverTile = null;

    this.initDOM();
    this.loadStage(0);

    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  initDOM() {
    // 스테이지 드롭다운 채우기 (TUT-01 ~ TUT-10)
    const stageSelect = document.getElementById("stageSelect");
    stageSelect.innerHTML = TUTORIAL_STAGES.map(
      (st, idx) =>
        `<option value="${idx}">${st.stageId} (${st.environment}) - ${st.enemyKey}</option>`
    ).join("");

    stageSelect.addEventListener("change", (e) => {
      this.sound.play("uiClick");
      this.loadStage(Number(e.target.value));
    });

    const modeSelect = document.getElementById("modeSelect");
    modeSelect.addEventListener("change", (e) => {
      this.sound.play("uiClick");
      this.mode = e.target.value;
      this.loadStage(this.stageIndex);
    });

    document.getElementById("btnStartWave").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.startNextWave();
    });

    const btnStream = document.getElementById("btnEndlessStream");
    btnStream.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.endlessStream = !this.endlessStream;
      btnStream.classList.toggle("active", this.endlessStream);
      btnStream.querySelector("span").textContent = this.endlessStream
        ? "♾️ 연속 스폰: ON"
        : "♾️ 연속 스폰: OFF";
      if (this.endlessStream && this.wave === 0) {
        this.startNextWave();
      }
      this.addLog(
        this.endlessStream
          ? "⚡ [무제한 연속 스폰 ON] 웨이브 대기 없이 화학 위험물이 연속 투입됩니다!"
          : "⏸️ [무제한 연속 스폰 OFF] 수동/웨이브 단위로 스폰합니다."
      );
    });

    document.getElementById("btnSpeed").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.speedMultiplier = this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 4 : 1;
      document.getElementById("speedLabel").textContent = `배속: ${this.speedMultiplier}x`;
    });

    document.getElementById("btnPause").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.paused = !this.paused;
      document.getElementById("pauseLabel").textContent = this.paused ? "재개" : "일시정지";
    });

    document.getElementById("btnSound").addEventListener("click", (e) => {
      const on = this.sound.toggle();
      e.currentTarget.textContent = on ? "🔊 사운드 ON" : "🔇 사운드 OFF";
    });

    document.getElementById("btnOpenBriefing").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.openBriefingModal();
    });

    document.getElementById("btnRestart").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.loadStage(this.stageIndex);
    });

    // 튜토리얼 & 브리핑 팝업 모달 버튼 이벤트
    document.getElementById("btnCloseBriefingX").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeBriefingModal();
    });

    document.getElementById("btnModalBuildStart").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.closeBriefingModal();
    });

    document.getElementById("btnModalWaveStart").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.closeBriefingModal();
      if (this.wave === 0) {
        this.startNextWave();
      }
    });

    document.getElementById("btnModalSwitchSurvival").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.mode = "survival";
      document.getElementById("modeSelect").value = "survival";
      this.closeBriefingModal();
      this.loadStage(this.stageIndex, false);
      this.addLog(
        `♾️ [${this.currentStage.stageId} 맵 무제한 서바이벌 전환] 이제 이 지형에서 42종 화학 위험물이 끝없이 출현합니다!`
      );
    });

    // 스테이지 클리어 / 결과 팝업 모달 버튼 이벤트
    document.getElementById("btnResultNextStage").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      const nextIdx = (this.stageIndex + 1) % TUTORIAL_STAGES.length;
      this.mode = "tutorial";
      document.getElementById("modeSelect").value = "tutorial";
      this.loadStage(nextIdx, true);
    });

    document.getElementById("btnResultPlaySurvival").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      this.mode = "survival";
      document.getElementById("modeSelect").value = "survival";
      this.loadStage(this.stageIndex, true);
    });

    document.getElementById("btnResultRetry").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      this.loadStage(this.stageIndex, true);
    });

    // 팔레트 필터 탭
    document.querySelectorAll(".filter-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.sound.play("uiClick");
        document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.paletteFilter = btn.dataset.filter;
        this.renderPalette();
      });
    });

    // 캔버스 마우스 이벤트
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
      this.sound.startAmbient();
      if (this.stageCleared || this.gameOver) return;
      if (!this.hoverTile) return;
      this.handleTileClick(this.hoverTile.c, this.hoverTile.r);
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.selectedBuildType = null;
      this.selectedTower = null;
      this.renderPalette();
      this.renderInspector();
    });

    // 키보드 단축키
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.startNextWave();
      }
    });
  }

  get currentStage() {
    return TUTORIAL_STAGES[this.stageIndex];
  }

  /**
   * 선택한 스테이지(TUT-01 ~ TUT-10)의 지형과 모드('tutorial' | 'survival')로 초기화
   */
  loadStage(index, showPopup = true) {
    this.stageIndex = index;
    document.getElementById("stageSelect").value = String(index);
    this.closeResultModal();

    const st = this.currentStage;
    this.gold = this.mode === "survival" ? Math.max(320, st.startingGold + 80) : st.startingGold;
    this.lives = 20;
    this.maxLives = 20;
    this.score = 0;
    this.wave = 0;
    this.gameOver = false;
    this.stageCleared = false;
    this.streamSpawnCount = 0;

    // 튜토리얼 목표 수치 초기화
    this.objectiveProgress = 0;
    this.objectiveTarget = st.clearTarget;
    this.currentPh = 1.5;
    this.gasConcentration = 100;
    this.towerDestroyedCount = 0;
    this.paralysisCuredCount = 0;
    this.survivalTimer = 0;

    // 그리드 초기화 (0: 빈 땅, 1: 장애물, 2: 타워)
    this.grid = Array.from({ length: GRID_CONFIG.rows }, () =>
      Array(GRID_CONFIG.cols).fill(0)
    );

    this.spawns = st.spawns.map((s) => ({ ...s }));
    this.exits = st.exits.map((e) => ({ ...e }));
    this.obstacles = st.obstacles.map((o) => ({ ...o }));

    for (const obs of this.obstacles) {
      if (obs.r >= 0 && obs.r < GRID_CONFIG.rows && obs.c >= 0 && obs.c < GRID_CONFIG.cols) {
        this.grid[obs.r][obs.c] = 1;
      }
    }

    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnQueue = [];
    this.selectedTower = null;

    // 해당 스테이지의 첫번째 추천 타워를 기본 선택
    if (st.requiredTowers && st.requiredTowers.length > 0) {
      this.selectedBuildType = st.requiredTowers[0];
    } else {
      this.selectedBuildType = "O";
    }

    this.recomputePaths();
    this.updateStageBanner();
    this.updateHUD();
    this.renderPalette();
    this.renderInspector();

    const logList = document.getElementById("reactionLogList");
    if (logList) logList.innerHTML = "";

    if (this.mode === "tutorial") {
      this.addLog(
        `🎓 [${st.stageId} 튜토리얼] ${st.description} (추천 타워: ${st.requiredTowers.join(", ") || "자유"}${
          st.shopItems.length ? ` / 설비: ${st.shopItems.join(", ")}` : ""
        })`
      );
    } else {
      this.addLog(
        `♾️ [${st.stageId} 맵 무한 서바이벌] DT_CompoundRecipe.csv의 42대 역사적 화학재난 물질이 무제한 출현합니다!`
      );
    }

    if (showPopup) {
      this.openBriefingModal();
    }
  }

  /**
   * 튜토리얼 및 스테이지 상세 브리핑 팝업 열기
   */
  openBriefingModal() {
    const st = this.currentStage;
    const modal = document.getElementById("briefingModal");
    if (!modal) return;

    this.isModalOpen = true;
    modal.classList.remove("hidden");

    const envBadge = document.getElementById("modalEnvBadge");
    envBadge.className = `env-badge ${st.environment.toLowerCase()}`;
    envBadge.textContent =
      st.environment === "Indoor" ? "🏢 Indoor (실내 밀폐구역)" : "🌳 Outdoor (야외 플랜트)";

    const modeBadge = document.getElementById("modalModeBadge");
    modeBadge.textContent =
      this.mode === "tutorial" ? `🎓 튜토리얼 미션 (${st.stageId})` : `♾️ 무제한 서바이벌 (${st.stageId} 맵)`;

    document.getElementById("modalTitle").textContent =
      this.mode === "tutorial"
        ? st.title
        : `♾️ [${st.stageId} 지형] 역사적 화학재난 무제한 서바이벌`;

    document.getElementById("modalMissionDesc").textContent =
      this.mode === "tutorial"
        ? `"${st.description}"`
        : `"이 스테이지(${st.stageId})의 맵 지형을 활용하여, DT_CompoundRecipe.csv에 기록된 42개 실제 역사적 화학 사고 물질을 끝없이 방어하세요!"`;

    document.getElementById("modalEquation").textContent =
      st.chemicalEquation || "원소 상성에 맞춰 화학 위험물을 중화·산화·침전시키세요!";

    // 1) 출현 위험물 카드 렌더링
    const enemyBox = document.getElementById("modalEnemyBox");
    if (st.enemyKey === "Mixed" || this.mode === "survival") {
      enemyBox.innerHTML = `
        <div class="modal-entity-item">
          <img src="./icon/enemy_h2s.png" alt="복합 위험물" />
          <div class="modal-entity-text">
            <strong>복합 화학 위험물 (전 종 총출동)</strong>
            수소(H₂), 염소(Cl₂), 불산(HF), 황화수소(H₂S), 포스겐(COCl₂) 등 모든 유형의 독성 물질이 동시에 유출됩니다.
          </div>
        </div>
      `;
    } else {
      const en = TUTORIAL_ENEMIES[st.enemyKey] || TUTORIAL_ENEMIES.H2;
      enemyBox.innerHTML = `
        <div class="modal-entity-item">
          <img src="${en.imagePath}" alt="${en.name}" />
          <div class="modal-entity-text">
            <strong>${en.name} [${en.formula}] — ${en.categoryLabel}</strong>
            ${en.description}
          </div>
        </div>
      `;
    }

    // 2) 필수 원소 타워 & 상점 설비 카드 렌더링
    const towersBox = document.getElementById("modalTowersBox");
    const recIds = [...st.requiredTowers, ...st.shopItems].slice(0, 4);
    towersBox.innerHTML = recIds
      .map((id) => {
        const tw = TOWER_TYPES[id];
        if (!tw) return "";
        return `
          <div class="modal-entity-item">
            <img src="${tw.imagePath}" alt="${tw.name}" />
            <div class="modal-entity-text">
              <strong style="color:${tw.color}">[${tw.symbol}] ${tw.name} (💰${tw.cost})</strong>
              ${tw.concept}
            </div>
          </div>
        `;
      })
      .join("");

    // 3) 초보자 3단계 클리어 공략 렌더링
    const stepsList = document.getElementById("modalStepsList");
    const steps = st.tacticalSteps || [
      "1단계: 우측 팔레트에서 ★필수 표시된 타워를 선택해 파란 점선 경로 위에 미로를 건설하세요.",
      "2단계: 상점 설비(환풍기, 압력기, 가열기, 유리벽)를 조합해 반응 효율을 높이세요.",
      "3단계: 상단 [웨이브 시작] 버튼을 눌러 위험물을 목표치까지 중화하세요!"
    ];
    stepsList.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

    // 4) 역사적 배경 및 보상
    document.getElementById("modalHistoricalText").textContent =
      st.historicalCase || st.description;
    document.getElementById("modalClearTarget").textContent =
      this.mode === "tutorial" ? st.clearLabel : "방어선이 뚫릴 때까지 무제한 웨이브 돌파";
    document.getElementById("modalRewardText").textContent = st.rewardLabel;

    // 서바이벌 전환 버튼 표시 조정
    const btnSwitch = document.getElementById("btnModalSwitchSurvival");
    if (btnSwitch) {
      btnSwitch.style.display = this.mode === "survival" ? "none" : "inline-block";
    }
  }

  closeBriefingModal() {
    const modal = document.getElementById("briefingModal");
    if (modal) modal.classList.add("hidden");
    this.isModalOpen = false;
  }

  openResultModal(isVictory) {
    const modal = document.getElementById("resultModal");
    if (!modal) return;
    this.isModalOpen = true;
    modal.classList.remove("hidden");

    const st = this.currentStage;
    const titleEl = document.getElementById("resultModalTitle");
    const descEl = document.getElementById("resultModalDesc");
    const rewardEl = document.getElementById("resultRewardBox");
    const nextBtn = document.getElementById("btnResultNextStage");

    if (isVictory) {
      titleEl.style.color = "#38bdf8";
      titleEl.textContent = `🎉 ${st.stageId} 미션 클리어 성공!`;
      descEl.textContent = `축하합니다! "${st.clearLabel}" 목표를 완벽하게 달성하여 도시와 연구소를 지켜냈습니다.`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `🎁 획득 보상: ${st.rewardLabel} (정화 점수: ${this.score.toLocaleString()}점)`;
      if (nextBtn) {
        const nextSt = TUTORIAL_STAGES[(this.stageIndex + 1) % TUTORIAL_STAGES.length];
        nextBtn.style.display = "inline-block";
        nextBtn.textContent = `➡️ 다음 튜토리얼(${nextSt.stageId}) 설명 보기 & 진행`;
      }
    } else {
      titleEl.style.color = "#ef4444";
      titleEl.textContent = `🚨 ${st.stageId} 방어선 붕괴 (유출 사고 발생)`;
      descEl.textContent = `미로 경로를 더 길게 우회시키거나, 스테이지 필수 추천 타워(${st.requiredTowers.join(", ")})와 설비(${st.shopItems.join(", ") || "없음"})를 조합해 다시 도전해 보세요!`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `💡 팁: 상단 [📖 튜토리얼 설명 팝업]에서 3단계 공략 가이드를 다시 확인할 수 있습니다.`;
      if (nextBtn) nextBtn.style.display = "none";
    }
  }

  closeResultModal() {
    const modal = document.getElementById("resultModal");
    if (modal) modal.classList.add("hidden");
    this.isModalOpen = false;
  }

  recomputePaths() {
    const passableGrid = this.grid.map((row) => row.map((cell) => (cell === 0 ? 0 : 1)));
    const { dist, next } = computeFlowField(passableGrid, this.exits);
    this.flowDist = dist;
    this.flowNext = next;
    this.previewPaths = tracePreviewPaths(this.spawns, this.flowNext);
  }

  isRecommendedForCurrentStage(typeId) {
    const st = this.currentStage;
    return st.requiredTowers.includes(typeId) || st.shopItems.includes(typeId);
  }

  updateStageBanner() {
    const st = this.currentStage;
    const envBadge = document.getElementById("envBadge");
    envBadge.className = `env-badge ${st.environment.toLowerCase()}`;
    envBadge.textContent =
      st.environment === "Indoor" ? "🏢 Indoor (실내 밀폐구역)" : "🌳 Outdoor (야외 플랜트)";

    const titleEl = document.getElementById("stageTitleText");
    const reqEl = document.getElementById("stageReqBadge");
    const rewardEl = document.getElementById("stageRewardBadge");
    const descEl = document.getElementById("stageDescText");

    if (this.mode === "tutorial") {
      titleEl.textContent = st.title;
      const reqStr = st.requiredTowers.join(", ");
      const shopStr = st.shopItems.length > 0 ? st.shopItems.join(", ") : "없음";
      reqEl.textContent = `필수/추천 원소: ${reqStr} | 설비: ${shopStr}`;
      rewardEl.textContent = `클리어 보상: ${st.rewardLabel}`;
      descEl.textContent = `📋 미션 지령: "${st.description}" (타워로 길을 막아 미로를 만드세요!)`;
    } else {
      const recipeIdx = Math.max(0, (this.wave - 1)) % COMPOUND_RECIPES.length;
      const recipe = COMPOUND_RECIPES[recipeIdx];
      titleEl.textContent = `♾️ [${st.stageId} 맵 서바이벌] Wave ${Math.max(1, this.wave)} — ${recipe.displayName}(${recipe.rowName})`;
      reqEl.textContent = `중화 카운터: ${recipe.counter}`;
      rewardEl.textContent = `역사적 화학재난 42종 무한 루프`;
      descEl.textContent = `📜 실제 사고 기록: "${recipe.description}"`;
    }

    this.updateObjectiveUI();
  }

  updateObjectiveUI() {
    const st = this.currentStage;
    const labelEl = document.getElementById("objectiveLabel");
    const valEl = document.getElementById("objectiveValue");
    const barEl = document.getElementById("objectiveBar");

    if (this.mode === "survival") {
      labelEl.textContent = `♾️ 무제한 서바이벌 (현재 필드 유닛: ${this.enemies.length}기 / 누적 정화: ${this.objectiveProgress}기)`;
      valEl.textContent = `Wave ${this.wave} 진행 중`;
      barEl.style.width = "100%";
      return;
    }

    let pct = 0;
    let statusText = "";

    switch (st.clearCondition) {
      case "Eliminate_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `H₂O 전환/제거: ${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
        break;
      case "Lower_Concentration":
        pct = Math.min(100, Math.round(100 - this.gasConcentration));
        statusText = `현재 수소 농도: ${this.gasConcentration.toFixed(0)}% → 목표 0% (${pct}% 희석됨)`;
        break;
      case "Create_NaCl_20":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `소금(NaCl) 침전: ${this.objectiveProgress} / ${st.clearTarget}개 (${pct}%)`;
        break;
      case "Neutralize_pH":
        pct = Math.min(100, Math.round(((this.currentPh - 1.5) / (7.0 - 1.5)) * 100));
        statusText = `현재 용액 산성도: pH ${this.currentPh.toFixed(2)} → 목표 pH 7.00 (${pct}%)`;
        break;
      case "Zero_Damage":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `불산(HF) 무손실 해독: ${this.objectiveProgress} / ${st.clearTarget} (부식 파괴: ${this.towerDestroyedCount}건)`;
        break;
      case "Cure_Paralysis":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `황화수소(H₂S) 산화: ${this.objectiveProgress} / ${st.clearTarget} (산소 해독 발동: ${this.paralysisCuredCount}회)`;
        break;
      case "Create_CO2_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `CO → CO₂ 완전연소: ${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
        break;
      case "Stop_Corrosion":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `황산(H₂SO₄) 다단계 중화: ${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
        break;
      case "Decompose_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `포스겐(COCl₂) 완전 분해: ${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
        break;
      case "Survive_5min":
        pct = Math.min(100, Math.round((this.survivalTimer / st.clearTarget) * 100));
        statusText = `방어 시간: ${Math.floor(this.survivalTimer)}초 / ${st.clearTarget}초 (${pct}%)`;
        break;
      default:
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
    }

    labelEl.textContent = `🎯 [${st.clearCondition}] ${st.clearLabel}`;
    valEl.textContent = statusText;
    barEl.style.width = `${pct}%`;
  }

  updateHUD() {
    document.getElementById("statGold").textContent = Math.floor(this.gold);
    document.getElementById("statLives").textContent = this.lives;
    document.getElementById("statWave").textContent =
      this.mode === "tutorial" ? `스테이지 ${this.stageIndex + 1} (W${this.wave})` : `♾️ W${this.wave}`;
    document.getElementById("statScore").textContent = this.score.toLocaleString();

    const startLabel = document.getElementById("startWaveLabel");
    if (this.mode === "survival") {
      startLabel.textContent = this.wave === 0 ? "서바이벌 시작" : "웨이브 추가 투입!";
    } else {
      startLabel.textContent = this.wave === 0 ? "미션 웨이브 시작" : "지원군 웨이브 호출";
    }
  }

  renderPalette() {
    const container = document.getElementById("towerPalette");
    const entries = Object.values(TOWER_TYPES).filter((t) => {
      if (this.paletteFilter === "recommended") {
        return this.isRecommendedForCurrentStage(t.id) || t.id === "C";
      }
      if (this.paletteFilter === "element") return t.category === "element";
      if (this.paletteFilter === "shop") return t.category === "shop";
      return true;
    });

    container.innerHTML = entries
      .map((t) => {
        const isActive = this.selectedBuildType === t.id;
        const isRec = this.isRecommendedForCurrentStage(t.id);
        return `
          <div class="element-card ${isActive ? "active" : ""} ${isRec ? "recommended" : ""}"
               style="--el-color: ${t.color}"
               data-id="${t.id}">
            ${isRec ? `<span class="rec-star">★필수</span>` : ""}
            <div class="el-header">
              <span>${t.category === "shop" ? "설비" : `No.${t.atomicNumber}`}</span>
              <span class="el-rank">${t.symbol}</span>
            </div>
            <div class="el-thumb-wrap">
              <img src="${t.imagePath}" alt="${t.name}" class="el-thumb" />
              <span class="el-symbol-badge">${t.symbol}</span>
            </div>
            <div class="el-name">${t.name.split(" (")[0]}</div>
            <div class="el-meta">
              <span>DMG ${t.damage}</span>
              <span class="el-cost">💰${t.cost}</span>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".element-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.selectedBuildType = card.dataset.id;
        this.selectedTower = null;
        this.renderPalette();
        this.renderInspector();
      });
    });
  }

  renderInspector() {
    const box = document.getElementById("inspectorContent");

    // 1) 이미 설치된 타워를 클릭한 경우
    if (this.selectedTower) {
      const t = this.selectedTower;
      const spec = TOWER_TYPES[t.typeId];
      const upgCost = Math.floor(spec.cost * 0.85 * t.level);
      const sellRefund = Math.floor(t.totalInvested * 0.75);
      const imgPath =
        t.level >= 2 && this.assets.getDrawable(spec.upgradeImagePath)
          ? spec.upgradeImagePath
          : spec.imagePath;

      box.innerHTML = `
        <div class="inspector-header-box">
          <img src="${imgPath}" alt="${spec.name}" class="inspector-preview-img" />
          <div>
            <div class="inspector-title" style="color:${spec.color}">
              ${spec.name} <span class="badge-lvl">Lv.${t.level}</span>
              ${t.boostedByO ? `<span class="badge-oxy">O₂/열촉매 가속중</span>` : ""}
            </div>
            <div style="font-size:0.73rem; color:#94a3b8;">
              내구도: ${Math.ceil(t.hp)} / ${t.maxHp} ${t.paralyzedTimer > 0 ? "⚡ [H₂S 마비됨!]" : ""}
            </div>
          </div>
        </div>
        <p class="inspector-desc">${spec.whyReactive}</p>
        <div class="stat-grid">
          <div>⚡ 공격력: <strong>${Math.round(t.getEffectiveDamage())}</strong></div>
          <div>🎯 사거리: <strong>${Math.round(t.getEffectiveRange())}px</strong></div>
          <div>⏱️ 연사력: <strong>${t.getEffectiveFireRate().toFixed(2)}/s</strong></div>
          <div>🧪 생성물: <strong>${spec.Produces}</strong></div>
        </div>
        <div class="inspector-actions">
          <button id="btnUpgradeTower" class="action-btn upg-btn" ${
            this.gold < upgCost || t.level >= 5 ? "disabled" : ""
          }>
            <img src="./icon/ui_upgrade.png" alt="" class="btn-icon" />
            <span>${t.level >= 5 ? "최대 레벨 (MAX)" : `반응성 강화 업그레이드 (💰${upgCost})`}</span>
          </button>
          ${
            spec.isKamikaze
              ? `<button id="btnDetonateH" class="action-btn detonate-btn">💥 즉시 수소 초광역 기폭</button>`
              : ""
          }
          <button id="btnSellTower" class="action-btn sell-btn">
            ♻️ 설비 해체 및 자금 회수 (+💰${sellRefund})
          </button>
        </div>
      `;

      const btnUpg = document.getElementById("btnUpgradeTower");
      if (btnUpg) {
        btnUpg.addEventListener("click", () => this.upgradeSelectedTower());
      }
      const btnDet = document.getElementById("btnDetonateH");
      if (btnDet) {
        btnDet.addEventListener("click", () => this.detonateHydrogenTower(t));
      }
      const btnSell = document.getElementById("btnSellTower");
      if (btnSell) {
        btnSell.addEventListener("click", () => this.sellSelectedTower());
      }
      return;
    }

    // 2) 팔레트에서 건설할 타워를 선택 중인 경우
    if (this.selectedBuildType && TOWER_TYPES[this.selectedBuildType]) {
      const spec = TOWER_TYPES[this.selectedBuildType];
      const isRec = this.isRecommendedForCurrentStage(spec.id);
      box.innerHTML = `
        <div class="inspector-header-box">
          <img src="${spec.imagePath}" alt="${spec.name}" class="inspector-preview-img" />
          <div>
            <div class="inspector-title" style="color:${spec.color}">
              [${spec.symbol}] ${spec.name}
            </div>
            <div style="font-size:0.73rem; color:${isRec ? "#fde047" : "#94a3b8"};">
              ${isRec ? "⭐ 현재 스테이지 클리어 핵심 추천 타워!" : spec.rankLabel}
            </div>
          </div>
        </div>
        <p class="inspector-desc"><strong>과학적 원리:</strong> ${spec.whyReactive}</p>
        <p class="inspector-concept"><strong>전술 역할:</strong> ${spec.concept}</p>
        <div class="stat-grid">
          <div>💰 건설 비용: <strong>${spec.cost}</strong></div>
          <div>⚡ 기본 피해: <strong>${spec.damage}</strong></div>
          <div>🎯 사거리: <strong>${spec.range}px</strong></div>
          <div>🧪 반응 결과: <strong>${spec.Produces}</strong></div>
        </div>
      `;
      return;
    }

    box.innerHTML = `<p class="inspector-desc">우측 팔레트에서 원소 타워나 상점 설비를 선택해 전장에 배치하거나, 설치된 타워를 클릭해 업그레이드하세요.</p>`;
  }

  handleTileClick(c, r) {
    // 이미 설치된 타워 클릭 시 선택
    const existing = this.towers.find((t) => t.c === c && t.r === r);
    if (existing) {
      this.sound.play("uiClick");
      this.selectedTower = existing;
      this.selectedBuildType = null;
      this.renderPalette();
      this.renderInspector();
      return;
    }

    if (!this.selectedBuildType) return;
    const spec = TOWER_TYPES[this.selectedBuildType];
    if (!spec) return;

    if (this.gold < spec.cost) {
      this.addFloatingText(
        c * GRID_CONFIG.tileSize + 19,
        r * GRID_CONFIG.tileSize + 19,
        "자금 부족!",
        "#ef4444"
      );
      return;
    }

    // 미로 길막기 검증 (Tower_Blocks_Path)
    const passableGrid = this.grid.map((row) => row.map((cell) => (cell === 0 ? 0 : 1)));
    const ok = canPlaceTowerWithoutBlocking(
      passableGrid,
      this.spawns,
      this.exits,
      this.enemies,
      c,
      r
    );

    if (!ok) {
      this.addFloatingText(
        c * GRID_CONFIG.tileSize + 19,
        r * GRID_CONFIG.tileSize + 19,
        "출구 봉쇄 불가!",
        "#f97316"
      );
      this.addLog("🚫 [경로 차단 경고] 모든 위험물이 출구로 빠져나갈 수 있는 최소 1칸의 통로가 필요합니다!");
      return;
    }

    // 타워 건설
    this.gold -= spec.cost;
    this.grid[r][c] = 2;

    const maxHp = spec.id === "GlassWall" ? 500 : spec.highDurability ? 260 : 120;
    const gameRef = this;
    const newTower = {
      c,
      r,
      x: c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2,
      y: r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2,
      typeId: spec.id,
      level: 1,
      totalInvested: spec.cost,
      cooldown: 0,
      triggerCount: 0,
      hp: maxHp,
      maxHp,
      boostedByO: false,
      boostedByHeater: false,
      protectedFromAcid: spec.corrosionImmune || false,
      paralyzedTimer: 0,
      getEffectiveDamage() {
        let dmg = spec.damage * (1 + (this.level - 1) * 0.38);
        if (this.boostedByO) dmg *= 1.35;
        if (this.boostedByHeater) dmg *= 1.4;
        return dmg;
      },
      getEffectiveRange() {
        return spec.range * (1 + (this.level - 1) * 0.08);
      },
      getEffectiveFireRate() {
        let rate = spec.fireRate * (1 + (this.level - 1) * 0.15);
        if (this.boostedByO) rate *= 1.25;
        if (this.boostedByHeater) rate *= 1.35;
        return rate;
      }
    };

    this.towers.push(newTower);
    this.sound.play("towerBuild");
    this.recomputePaths();
    this.updateHUD();
    this.renderInspector();
  }

  upgradeSelectedTower() {
    if (!this.selectedTower) return;
    const t = this.selectedTower;
    const spec = TOWER_TYPES[t.typeId];
    const cost = Math.floor(spec.cost * 0.85 * t.level);
    if (this.gold < cost || t.level >= 5) return;

    this.gold -= cost;
    t.level += 1;
    t.totalInvested += cost;
    t.maxHp += 40;
    t.hp = t.maxHp;

    this.sound.play("towerUpgrade");
    this.addFloatingText(t.x, t.y - 10, `Lv.${t.level} 강화!`, "#fde047");
    this.updateHUD();
    this.renderInspector();
  }

  sellSelectedTower() {
    if (!this.selectedTower) return;
    const t = this.selectedTower;
    const refund = Math.floor(t.totalInvested * 0.75);
    this.gold += refund;
    this.grid[t.r][t.c] = 0;
    this.towers = this.towers.filter((item) => item !== t);
    this.selectedTower = null;

    this.sound.play("uiClick");
    this.recomputePaths();
    this.updateHUD();
    this.renderInspector();
  }

  detonateHydrogenTower(tower) {
    const spec = TOWER_TYPES.H;
    this.sound.play("tower_H", 0.7);
    this.spawnParticles(tower.x, tower.y, "#38bdf8", 28);
    this.addFloatingText(tower.x, tower.y, "💥 수소 초광역 기폭!", "#38bdf8");

    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (dist <= spec.range * 1.35) {
        this.applyDamageToEnemy(enemy, tower.getEffectiveDamage() * 2.2, tower);
      }
    }

    this.grid[tower.r][tower.c] = 0;
    this.towers = this.towers.filter((item) => item !== tower);
    if (this.selectedTower === tower) this.selectedTower = null;
    this.recomputePaths();
    this.renderInspector();
  }

  /**
   * 웨이브 시작 (튜토리얼 모드: 해당 스테이지 위험물 스폰 / 서바이벌 모드: DT_CompoundRecipe.csv 42종 무한 스폰)
   */
  startNextWave() {
    if (this.gameOver || this.stageCleared) return;

    this.wave += 1;
    this.sound.play("waveStart");
    const st = this.currentStage;

    if (this.mode === "tutorial") {
      // 튜토리얼 스테이지별 웨이브 구성
      const count = st.clearCondition === "Survive_5min" ? 18 + this.wave * 4 : 12 + this.wave * 3;
      const interval = Math.max(0.38, 0.95 - this.wave * 0.05);

      for (let i = 0; i < count; i++) {
        let enemyTemplate = null;
        if (st.enemyKey === "Mixed") {
          const keys = Object.keys(TUTORIAL_ENEMIES);
          const pick = keys[(i + this.wave) % keys.length];
          enemyTemplate = TUTORIAL_ENEMIES[pick];
        } else {
          enemyTemplate = TUTORIAL_ENEMIES[st.enemyKey] || TUTORIAL_ENEMIES.H2;
        }

        const hpScale = 1 + (this.wave - 1) * 0.22;
        this.spawnQueue.push({
          template: enemyTemplate,
          hp: Math.round(enemyTemplate.baseHp * hpScale),
          formulaLabel: enemyTemplate.formula,
          accidentDesc: st.description,
          delay: interval
        });
      }

      this.addLog(
        `🚨 [${st.stageId} Wave ${this.wave}] ${st.enemyKey} 위험물 ${count}기 유출 시작! (${st.clearLabel})`
      );
    } else {
      // 무한 서바이벌 (무제한 유닛) 모드: DT_CompoundRecipe.csv 42종 순환 + 복합 웨이브
      const recipe = COMPOUND_RECIPES[(this.wave - 1) % COMPOUND_RECIPES.length];
      const baseArchetype = ENEMY_TYPES[recipe.archetype] || ENEMY_TYPES.GAS;
      const count = 14 + this.wave * 4;
      const hpScale = Math.pow(1.18, this.wave - 1);
      const interval = Math.max(0.22, 0.78 - this.wave * 0.02);

      for (let i = 0; i < count; i++) {
        // 매 5번째마다 직전/다음 역사적 화합물도 섞여서 출현
        const subRecipe =
          i % 5 === 0
            ? COMPOUND_RECIPES[(this.wave + i) % COMPOUND_RECIPES.length]
            : recipe;
        const arch = ENEMY_TYPES[subRecipe.archetype] || baseArchetype;

        this.spawnQueue.push({
          template: {
            ...arch,
            id: subRecipe.rowName,
            name: `${subRecipe.displayName} (${subRecipe.rowName})`,
            formula: subRecipe.rowName,
            corrodesTowers: Boolean(subRecipe.corrodesTowers),
            paralyzesTowers: subRecipe.rowName === "H2S"
          },
          hp: Math.round(arch.baseHp * hpScale),
          formulaLabel: `${subRecipe.displayName}(${subRecipe.rowName})`,
          accidentDesc: subRecipe.description,
          delay: interval
        });
      }

      this.addLog(`📜 [역사적 화학재난 W${this.wave}] ${recipe.displayName}(${recipe.rowName}): ${recipe.description}`);
    }

    this.updateStageBanner();
    this.updateHUD();
  }

  spawnSingleEnemyFromQueue(item) {
    const sp = this.spawns[Math.floor(Math.random() * this.spawns.length)];
    const x = sp.c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
    const y = sp.r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
    const tpl = item.template;

    this.enemies.push({
      x,
      y,
      hp: item.hp,
      maxHp: item.hp,
      speed: tpl.speed,
      reward: tpl.reward,
      radius: tpl.radius || 12,
      color: tpl.color,
      strokeColor: tpl.strokeColor,
      imagePath: tpl.imagePath,
      id: tpl.id,
      name: tpl.name,
      formula: item.formulaLabel || tpl.formula,
      categoryKey: tpl.id in ENEMY_TYPES ? tpl.id : "GAS",
      isFlying: Boolean(tpl.isFlying),
      isStealth: Boolean(tpl.isStealth),
      revealedTimer: 0,
      slowTimer: 0,
      slowFactor: 0,
      dotTimer: 0,
      dotDps: 0,
      armorShred: 0,
      corrodesTowers: Boolean(tpl.corrodesTowers),
      paralyzesTowers: Boolean(tpl.paralyzesTowers),
      hitByElements: new Set()
    });
  }

  loop(timestamp) {
    const rawDt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (!this.paused && !this.isModalOpen && !this.gameOver && !this.stageCleared) {
      const dt = rawDt * this.speedMultiplier;
      this.update(dt);
    }

    this.draw();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    const st = this.currentStage;

    // TUT-10 5분 생존 타이머 업데이트
    if (this.mode === "tutorial" && st.clearCondition === "Survive_5min" && this.wave > 0) {
      this.survivalTimer += dt;
      if (this.survivalTimer >= st.clearTarget) {
        this.completeTutorialStage();
        return;
      }
      // 5분 버티기 중 스폰 큐가 비면 자동으로 다음 웨이브 투입
      if (this.spawnQueue.length === 0 && this.enemies.length < 6) {
        this.startNextWave();
      }
    }

    // 무제한 연속 스폰(Endless Stream) 처리
    if (this.endlessStream) {
      this.streamTimer -= dt;
      if (this.streamTimer <= 0) {
        this.streamTimer = 0.55;
        this.streamSpawnCount += 1;
        if (this.streamSpawnCount % 18 === 0) {
          this.wave += 1;
          this.updateStageBanner();
          this.updateHUD();
        }
        const recipe =
          COMPOUND_RECIPES[(this.wave + this.streamSpawnCount) % COMPOUND_RECIPES.length];
        const arch = ENEMY_TYPES[recipe.archetype] || ENEMY_TYPES.GAS;
        const hpScale = Math.pow(1.14, Math.max(0, this.wave - 1));
        this.spawnSingleEnemyFromQueue({
          template: {
            ...arch,
            id: recipe.rowName,
            name: `${recipe.displayName}(${recipe.rowName})`,
            formula: recipe.rowName,
            corrodesTowers: Boolean(recipe.corrodesTowers),
            paralyzesTowers: recipe.rowName === "H2S"
          },
          hp: Math.round(arch.baseHp * hpScale),
          formulaLabel: `${recipe.displayName}(${recipe.rowName})`
        });
      }
    }

    // 일반 웨이브 스폰 큐 처리
    if (this.spawnQueue.length > 0) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        const nextItem = this.spawnQueue.shift();
        this.spawnSingleEnemyFromQueue(nextItem);
        this.spawnCooldown = nextItem.delay;
      }
    } else if (
      this.mode === "tutorial" &&
      this.wave > 0 &&
      this.enemies.length === 0 &&
      !this.stageCleared
    ) {
      // 튜토리얼에서 아직 목표 수치를 다 못 채웠다면 자동으로 추가 웨이브 투입
      this.startNextWave();
    }

    // 1. 타워 오라(산소 O, 가열기 Heater, 칼슘 Ca, 유리벽 GlassWall) 계산
    for (const t of this.towers) {
      t.boostedByO = false;
      t.boostedByHeater = false;
      t.protectedFromAcid = TOWER_TYPES[t.typeId].corrosionImmune || false;
    }

    for (const source of this.towers) {
      const spec = TOWER_TYPES[source.typeId];
      if (source.typeId === "O") {
        for (const target of this.towers) {
          const d = Math.hypot(target.x - source.x, target.y - source.y);
          if (d <= (spec.auraRange || 125)) {
            if (target !== source) target.boostedByO = true;
            if (target.paralyzedTimer > 0) {
              target.paralyzedTimer = 0;
              this.paralysisCuredCount += 1;
              this.addFloatingText(target.x, target.y - 12, "O₂ 마비 해독!", "#38bdf8");
            }
          }
        }
      }
      if (source.typeId === "Heater") {
        for (const target of this.towers) {
          if (target === source) continue;
          const d = Math.hypot(target.x - source.x, target.y - source.y);
          if (d <= (spec.auraRange || 130)) {
            target.boostedByHeater = true;
          }
        }
      }
      if (spec.antiCorrosionAura) {
        for (const target of this.towers) {
          const d = Math.hypot(target.x - source.x, target.y - source.y);
          if (d <= spec.antiCorrosionAura) {
            target.protectedFromAcid = true;
          }
        }
      }
    }

    // 2. 적군 이동 및 특수 위험물 기믹(불산 HF 타워 부식, 황화수소 H2S 타워 마비) 처리
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.revealedTimer > 0) e.revealedTimer -= dt;
      if (e.dotTimer > 0) {
        e.dotTimer -= dt;
        e.hp -= e.dotDps * dt;
        if (e.hp <= 0) {
          this.handleEnemyNeutralized(e, null);
          this.enemies.splice(i, 1);
          continue;
        }
      }

      // 불산(HF) 또는 황산(H2SO4)의 인접 타워 부식 효과
      if (e.corrodesTowers) {
        for (let ti = this.towers.length - 1; ti >= 0; ti--) {
          const tw = this.towers[ti];
          const dist = Math.hypot(tw.x - e.x, tw.y - e.y);
          if (dist <= 65 && !tw.protectedFromAcid) {
            tw.hp -= 16 * dt;
            if (Math.random() < 0.08) {
              this.addFloatingText(tw.x, tw.y, "부식 중!", "#2dd4bf");
            }
            if (tw.hp <= 0) {
              this.towerDestroyedCount += 1;
              this.grid[tw.r][tw.c] = 0;
              if (this.selectedTower === tw) this.selectedTower = null;
              this.towers.splice(ti, 1);
              this.recomputePaths();
              this.renderInspector();
              this.addLog("💥 [타워 부식 붕괴] 불산/황산에 의해 보호받지 못한 타워가 녹아내렸습니다! 칼슘(Ca)이나 유리벽(GlassWall)을 배치하세요!");
            }
          }
        }
      }

      // 황화수소(H2S)의 인접 타워 마비 효과
      if (e.paralyzesTowers) {
        for (const tw of this.towers) {
          if (tw.typeId === "O" || tw.boostedByO) continue; // 산소 타워 및 산소 버프 타워는 면역
          const dist = Math.hypot(tw.x - e.x, tw.y - e.y);
          if (dist <= 75) {
            tw.paralyzedTimer = Math.max(tw.paralyzedTimer, 1.5);
          }
        }
      }

      const speedMult = e.slowTimer > 0 ? 1 - e.slowFactor : 1;
      const moveStep = e.speed * speedMult * dt;

      // 목표 출구 방향 이동
      const c = Math.max(0, Math.min(GRID_CONFIG.cols - 1, Math.floor(e.x / GRID_CONFIG.tileSize)));
      const r = Math.max(0, Math.min(GRID_CONFIG.rows - 1, Math.floor(e.y / GRID_CONFIG.tileSize)));

      let targetX = this.exits[0].c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
      let targetY = this.exits[0].r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;

      if (!e.isFlying && this.flowNext[r] && this.flowNext[r][c]) {
        const nxt = this.flowNext[r][c];
        targetX = nxt.c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        targetY = nxt.r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
      }

      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const distToTarget = Math.hypot(dx, dy);

      if (distToTarget > 0.001) {
        e.x += (dx / distToTarget) * moveStep;
        e.y += (dy / distToTarget) * moveStep;
      }

      // 출구 도달 확인
      for (const ex of this.exits) {
        const exX = ex.c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        const exY = ex.r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        if (Math.hypot(e.x - exX, e.y - exY) < 16) {
          this.lives -= 1;
          this.sound.play("baseDamage");
          this.addFloatingText(exX, exY, "-1 방어선 유출!", "#ef4444");
          this.enemies.splice(i, 1);
          this.updateHUD();
          if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver = true;
            this.sound.play("gameOver");
            this.addLog("🚨 [방어선 붕괴] 유독 화학물질이 도시로 유출되었습니다! 🔄 재시작 버튼을 눌러 재도전하세요.");
            this.openResultModal(false);
          }
          break;
        }
      }
    }

    // 3. 타워 공격 처리
    for (let ti = this.towers.length - 1; ti >= 0; ti--) {
      const t = this.towers[ti];
      if (t.paralyzedTimer > 0) {
        t.paralyzedTimer -= dt;
        continue;
      }

      t.cooldown -= dt;
      if (t.cooldown > 0) continue;

      const spec = TOWER_TYPES[t.typeId];
      const range = t.getEffectiveRange();

      // 사거리 내 적 탐색
      const candidates = this.enemies.filter((e) => {
        if (e.isStealth && e.revealedTimer <= 0 && !spec.revealsStealth) return false;
        return Math.hypot(e.x - t.x, e.y - t.y) <= range;
      });

      if (candidates.length === 0) continue;

      t.cooldown = 1 / t.getEffectiveFireRate();
      this.sound.play(spec.soundKey || "hitNeutralize", 0.35, 95);

      // 오라/구름 형태 타워 (염소 Cl, 압력기 Pressurizer)
      if (spec.isAuraCloud) {
        this.spawnParticles(t.x, t.y, spec.color, 8);
        for (const target of candidates) {
          if (spec.revealsStealth) target.revealedTimer = 4.0;
          if (spec.pullStrength) {
            // 압력기(Pressurizer): 적들을 타워 쪽으로 살짝 응축
            const angle = Math.atan2(t.y - target.y, t.x - target.x);
            target.x += Math.cos(angle) * 6;
            target.y += Math.sin(angle) * 6;
          }
          this.applyDamageToEnemy(target, t.getEffectiveDamage(), t);
        }
        continue;
      }

      // 포타슘(K) 연쇄 스파크 공격
      if (spec.chainCount) {
        const hitTargets = candidates.slice(0, spec.chainCount);
        for (const target of hitTargets) {
          this.projectiles.push({
            x: t.x,
            y: t.y,
            target,
            speed: 420,
            color: spec.projectileColor,
            damage: t.getEffectiveDamage(),
            sourceTower: t
          });
        }
        continue;
      }

      // 일반/스플래시/수소기폭 투사체 발사
      const primary = candidates[0];
      this.projectiles.push({
        x: t.x,
        y: t.y,
        target: primary,
        speed: 360,
        color: spec.projectileColor,
        damage: t.getEffectiveDamage(),
        sourceTower: t
      });

      // 수소(H) 자폭 카운트 처리
      if (spec.isKamikaze) {
        t.triggerCount += 1;
        if (t.triggerCount >= spec.maxTriggerCount) {
          this.detonateHydrogenTower(t);
        }
      }
    }

    // 4. 투사체 이동 및 충돌 처리
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.target || p.target.hp <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 12) {
        const tower = p.sourceTower;
        const spec = TOWER_TYPES[tower.typeId];

        if (spec.splashRadius) {
          this.spawnParticles(p.target.x, p.target.y, spec.color, 12);
          for (const e of this.enemies) {
            if (Math.hypot(e.x - p.target.x, e.y - p.target.y) <= spec.splashRadius) {
              this.applyDamageToEnemy(e, p.damage, tower);
            }
          }
        } else {
          this.applyDamageToEnemy(p.target, p.damage, tower);
        }

        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
      }
    }

    // 5. 파티클 및 플로팅 텍스트 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 22 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    this.updateObjectiveUI();
  }

  applyDamageToEnemy(enemy, baseDamage, tower) {
    if (!enemy || enemy.hp <= 0) return;

    const spec = tower ? TOWER_TYPES[tower.typeId] : null;
    let finalDamage = baseDamage;

    if (spec) {
      enemy.hitByElements.add(spec.id);

      // 상성 보너스 적용
      const bonus = spec.targetBonus?.[enemy.categoryKey] || 1.0;
      finalDamage *= bonus;

      // 스테이지별 화학 반응 시너지 보너스
      if (enemy.id === "H2" && spec.id === "O") finalDamage *= 2.2; // 2H2 + O2 -> 2H2O
      if (enemy.id === "Cl2" && spec.id === "Na") {
        finalDamage *= tower.boostedByHeater ? 2.6 : 1.9; // 2Na + Cl2 -> 2NaCl
      }
      if (enemy.id === "HCl" && spec.id === "Na") finalDamage *= 2.1; // HCl + NaOH -> NaCl + H2O
      if (enemy.id === "HF" && spec.id === "Ca") finalDamage *= 2.5; // 2HF + Ca -> CaF2
      if (enemy.id === "H2S" && spec.id === "O") finalDamage *= 2.2; // 2H2S + 3O2 -> 2SO2 + 2H2O
      if (enemy.id === "CO" && (spec.id === "O" || spec.id === "Heater")) {
        finalDamage *= tower.boostedByHeater ? 2.6 : 1.8; // 2CO + O2 -> 2CO2
      }
      if (enemy.id === "H2SO4" && ["Ca", "Na", "O"].includes(spec.id)) {
        finalDamage *= 1.5 + enemy.hitByElements.size * 0.35; // 다단계 반응 보너스
      }
      if (enemy.id === "COCl2" && ["C", "O", "Cl", "Fan"].includes(spec.id)) {
        finalDamage *= 1.45 + enemy.hitByElements.size * 0.3; // 포스겐 복합 분해
      }

      // 감속 효과
      if (spec.slowFactor) {
        enemy.slowFactor = Math.max(enemy.slowFactor, spec.slowFactor);
        enemy.slowTimer = Math.max(enemy.slowTimer, spec.slowDuration || 2.0);
      }

      // 환풍기(Fan) 역풍 밀치기 효과
      if (spec.pushbackStrength && this.spawns.length > 0) {
        const spX = this.spawns[0].c * GRID_CONFIG.tileSize + 19;
        const spY = this.spawns[0].r * GRID_CONFIG.tileSize + 19;
        const ang = Math.atan2(spY - enemy.y, spX - enemy.x);
        enemy.x += Math.cos(ang) * spec.pushbackStrength * 0.45;
        enemy.y += Math.sin(ang) * spec.pushbackStrength * 0.45;
      }

      // 지속 산화(DoT) 효과
      if (spec.dotDamage) {
        enemy.dotDps = Math.max(enemy.dotDps, spec.dotDamage);
        enemy.dotTimer = Math.max(enemy.dotTimer, spec.dotDuration || 3.0);
      }

      // 질소(N) / 압력기(Pressurizer) / 환풍기(Fan) 타격 시 가스 농도 즉시 감소
      if (spec.lowersConcentration && this.gasConcentration > 0) {
        this.gasConcentration = Math.max(0, this.gasConcentration - 0.9);
      }

      // 소듐(Na) / 칼슘(Ca) 타격 시 산성도(pH) 회복
      if (spec.neutralizesAcid && this.currentPh < 7.0) {
        this.currentPh = Math.min(7.0, this.currentPh + 0.08);
      }
    }

    enemy.hp -= finalDamage;
    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) this.enemies.splice(idx, 1);
      this.handleEnemyNeutralized(enemy, tower);
    }
  }

  handleEnemyNeutralized(enemy, killerTower) {
    this.gold += enemy.reward;
    this.score += enemy.reward * 15;
    this.objectiveProgress += 1;

    this.sound.play("enemyDissolve", 0.4, 90);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 14);

    const st = this.currentStage;
    let reactionBadge = `+${enemy.reward}G 중화!`;

    if (enemy.id === "H2") reactionBadge = "💧 2H₂+O₂ → 2H₂O 생성!";
    else if (enemy.id === "Cl2") reactionBadge = "🧂 2Na+Cl₂ → 2NaCl 침전!";
    else if (enemy.id === "HCl") {
      this.currentPh = Math.min(7.0, this.currentPh + 0.25);
      reactionBadge = `🧪 pH ${this.currentPh.toFixed(1)} 중화!`;
    } else if (enemy.id === "HF") reactionBadge = "🛡️ CaF₂ 형석 해독!";
    else if (enemy.id === "H2S") reactionBadge = "✨ H₂S 산화 무력화!";
    else if (enemy.id === "CO") reactionBadge = "🔥 2CO+O₂ → 2CO₂ 연소!";
    else if (enemy.id === "H2SO4") reactionBadge = "⚗️ CaSO₄ 다단계 중화!";
    else if (enemy.id === "COCl2") reactionBadge = "🌪️ 포스겐 완전 분해!";

    this.addFloatingText(enemy.x, enemy.y, reactionBadge, "#fde047");

    if (this.gasConcentration > 0) {
      this.gasConcentration = Math.max(0, this.gasConcentration - 3.5);
    }

    this.updateHUD();
    this.checkTutorialClearCondition();
  }

  checkTutorialClearCondition() {
    if (this.mode !== "tutorial" || this.stageCleared || this.gameOver) return;
    const st = this.currentStage;

    let cleared = false;
    switch (st.clearCondition) {
      case "Eliminate_All":
      case "Create_NaCl_20":
      case "Cure_Paralysis":
      case "Create_CO2_All":
      case "Stop_Corrosion":
      case "Decompose_All":
        cleared = this.objectiveProgress >= st.clearTarget;
        break;
      case "Lower_Concentration":
        cleared = this.gasConcentration <= 0 || this.objectiveProgress >= st.clearTarget;
        break;
      case "Neutralize_pH":
        cleared = this.currentPh >= 7.0 || this.objectiveProgress >= st.clearTarget;
        break;
      case "Zero_Damage":
        cleared =
          this.objectiveProgress >= st.clearTarget &&
          this.lives === this.maxLives &&
          this.towerDestroyedCount === 0;
        break;
      case "Survive_5min":
        cleared = this.survivalTimer >= st.clearTarget;
        break;
    }

    if (cleared) {
      this.completeTutorialStage();
    }
  }

  completeTutorialStage() {
    if (this.stageCleared) return;
    this.stageCleared = true;
    const st = this.currentStage;
    this.unlockedRewards.add(st.rewards);
    this.sound.play("waveClear", 0.65);

    this.addLog(
      `🎉 [${st.stageId} 미션 클리어!] "${st.clearLabel}" 달성 완료! 🎁 보상 획득: ${st.rewardLabel}`
    );
    this.updateObjectiveUI();
    this.openResultModal(true);
  }

  spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 75;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.35 + Math.random() * 0.35
      });
    }
  }

  addFloatingText(x, y, text, color = "#fde047") {
    this.floatingTexts.push({ x, y, text, color, life: 1.1 });
  }

  addLog(msg) {
    const ul = document.getElementById("reactionLogList");
    if (!ul) return;
    const li = document.createElement("li");
    const timeStr = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    li.textContent = `[${timeStr}] ${msg}`;
    ul.prepend(li);
    while (ul.children.length > 25) {
      ul.removeChild(ul.lastChild);
    }
  }

  draw() {
    const ctx = this.ctx;
    const { cols, rows, tileSize } = GRID_CONFIG;
    const st = this.currentStage;
    const isIndoor = st.environment === "Indoor";

    // 1. 배경 타일 렌더링 (Indoor 실내 연구소 vs Outdoor 야외 플랜트 테마 구분)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize;
        const y = r * tileSize;
        const even = (r + c) % 2 === 0;
        if (isIndoor) {
          ctx.fillStyle = even ? "#0b1325" : "#0e172c";
        } else {
          ctx.fillStyle = even ? "#0a1817" : "#0d1f1d";
        }
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = isIndoor ? "rgba(56, 189, 248, 0.08)" : "rgba(52, 211, 153, 0.08)";
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // 2. 예상 이동 경로(FlowField 점선) 표시
    if (this.previewPaths) {
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      for (const path of this.previewPaths) {
        if (path.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0].c * tileSize + tileSize / 2, path[0].r * tileSize + tileSize / 2);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].c * tileSize + tileSize / 2, path[i].r * tileSize + tileSize / 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. 장애물(Obstacle) 렌더링
    const obsImg = this.assets.getDrawable(UI_ICONS.obstacle);
    for (const obs of this.obstacles) {
      const x = obs.c * tileSize;
      const y = obs.r * tileSize;
      if (obsImg) {
        ctx.drawImage(obsImg, x + 2, y + 2, tileSize - 4, tileSize - 4);
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
      }
    }

    // 4. 스폰(IN) 및 출구(OUT) 마커 렌더링
    for (const sp of this.spawns) {
      const x = sp.c * tileSize;
      const y = sp.r * tileSize;
      ctx.fillStyle = "rgba(239, 68, 68, 0.28)";
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = "#ef4444";
      ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LEAK", x + tileSize / 2, y + tileSize / 2 + 3);
    }

    for (const ex of this.exits) {
      const x = ex.c * tileSize;
      const y = ex.r * tileSize;
      ctx.fillStyle = "rgba(16, 185, 129, 0.28)";
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = "#10b981";
      ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = "#6ee7b7";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CITY", x + tileSize / 2, y + tileSize / 2 + 3);
    }

    // 5. 설치된 타워 렌더링
    for (const t of this.towers) {
      const spec = TOWER_TYPES[t.typeId];
      const x = t.c * tileSize;
      const y = t.r * tileSize;

      // 타워 바닥 오라 표시
      if (t.boostedByO || t.boostedByHeater) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, tileSize * 0.46, 0, Math.PI * 2);
        ctx.fillStyle = t.boostedByHeater
          ? "rgba(244, 63, 94, 0.22)"
          : "rgba(56, 189, 248, 0.22)";
        ctx.fill();
      }

      const upgImg = t.level >= 2 ? this.assets.getDrawable(spec.upgradeImagePath) : null;
      const baseImg = upgImg || this.assets.getDrawable(spec.imagePath);

      if (baseImg) {
        ctx.drawImage(baseImg, x + 2, y + 2, tileSize - 4, tileSize - 4);
      } else {
        ctx.fillStyle = spec.color;
        ctx.fillRect(x + 5, y + 5, tileSize - 10, tileSize - 10);
      }

      // 원소 기호 및 레벨 배지
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.fillRect(x + 2, y + tileSize - 13, tileSize - 4, 11);
      ctx.fillStyle = spec.color;
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${spec.symbol} Lv${t.level}`, x + tileSize / 2, y + tileSize - 4);

      // 마비 상태 아이콘 표시
      if (t.paralyzedTimer > 0) {
        ctx.fillStyle = "rgba(234, 179, 8, 0.85)";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("⚡마비", t.x, y + 11);
      }
    }

    // 6. 선택된 타워 또는 마우스 호버 미리보기 사거리 렌더링
    if (this.selectedTower) {
      ctx.beginPath();
      ctx.arc(
        this.selectedTower.x,
        this.selectedTower.y,
        this.selectedTower.getEffectiveRange(),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(56, 189, 248, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.stroke();
    }

    if (this.hoverTile && this.selectedBuildType) {
      const { c, r } = this.hoverTile;
      const spec = TOWER_TYPES[this.selectedBuildType];
      const passableGrid = this.grid.map((row) => row.map((cell) => (cell === 0 ? 0 : 1)));
      const canPlace = canPlaceTowerWithoutBlocking(
        passableGrid,
        this.spawns,
        this.exits,
        this.enemies,
        c,
        r
      );

      const cx = c * tileSize + tileSize / 2;
      const cy = r * tileSize + tileSize / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, spec.range, 0, Math.PI * 2);
      ctx.fillStyle = canPlace ? "rgba(56, 189, 248, 0.12)" : "rgba(239, 68, 68, 0.15)";
      ctx.fill();
      ctx.strokeStyle = canPlace ? "#38bdf8" : "#ef4444";
      ctx.stroke();
    }

    // 7. 적군(화학위험물) 렌더링
    for (const e of this.enemies) {
      ctx.save();
      if (e.isStealth && e.revealedTimer <= 0) {
        ctx.globalAlpha = 0.42;
      }

      const enemyImg = this.assets.getDrawable(e.imagePath);
      const drawSize = e.radius * 2.4;
      if (enemyImg) {
        ctx.drawImage(enemyImg, e.x - drawSize / 2, e.y - drawSize / 2, drawSize, drawSize);
      } else {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
      }

      // 화학식 라벨
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.formula, e.x, e.y - e.radius - 7);

      // 체력바
      const bw = 28;
      const bh = 4;
      const hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 5, bw, bh);
      ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#eab308" : "#ef4444";
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 5, bw * hpRatio, bh);
      ctx.restore();
    }

    // 8. 투사체 렌더링
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // 9. 파티클 및 플로팅 텍스트 렌더링
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }

    for (const ft of this.floatingTexts) {
      ctx.fillStyle = ft.color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    // 10. 스테이지 클리어 또는 게임오버 오버레이
    if (this.stageCleared || this.gameOver) {
      ctx.fillStyle = "rgba(6, 10, 20, 0.82)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.textAlign = "center";
      ctx.fillStyle = this.stageCleared ? "#38bdf8" : "#ef4444";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(
        this.stageCleared
          ? `🎉 ${st.stageId} 미션 클리어 성공!`
          : "🚨 방어선 붕괴 (화학물질 유출)",
        this.canvas.width / 2,
        this.canvas.height / 2 - 35
      );

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "15px sans-serif";
      ctx.fillText(
        this.stageCleared
          ? `달성 목표: ${st.clearLabel} | 획득 보상: ${st.rewardLabel}`
          : "상단 [🔄 재시작] 버튼을 누르거나 타워 조합을 바꾸어 다시 도전해보세요.",
        this.canvas.width / 2,
        this.canvas.height / 2 + 2
      );

      if (this.stageCleared) {
        ctx.fillStyle = "#fde047";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(
          "💡 상단 모드 선택에서 [♾️ 서바이벌 모드(무제한 유닛)]로 전환하면 이 맵에서 끝없이 즐길 수 있습니다!",
          this.canvas.width / 2,
          this.canvas.height / 2 + 36
        );
      }
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.chemGame = new ChemicalDefenseGame();
});
