/**
 * [파일 역할] 제노택틱 2.0: 케미컬 디펜스 메인 엔진 (game.js)
 * - Stitch "Chem Lab Tactical Defense" UI 리디자인 완벽 연동
 * - 적 처치음(enemyDissolve) 및 포탑 타격음 볼륨 대폭 하향 + 중첩 방지 쿨다운 강화 + 실시간 BGM/SFX 볼륨 슬라이더 지원
 * - 10개 튜토리얼 스테이지(TUT-01 ~ TUT-10) 미션 로직 및 모든 맵 무한 서바이벌(42종 역사적 화학재난) 모드 지원
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
} from "./data.js?v=4";

import {
  computeFlowField,
  canPlaceTowerWithoutBlocking,
  tracePreviewPaths
} from "./pathfinding.js?v=4";

class SoundManager {
  constructor() {
    this.enabled = true;
    // 사용자 피드백 반영: 기본 효과음(SFX) 마스터 볼륨을 28%(0.28)로 낮추고 localStorage에 저장
    const savedSfx = localStorage.getItem("chemlab_sfx_vol");
    const savedBgm = localStorage.getItem("chemlab_bgm_vol");
    this.sfxVolume = savedSfx !== null ? Number(savedSfx) : 0.28;
    this.bgmVolume = savedBgm !== null ? Number(savedBgm) : 0.14;

    this.buffers = {};
    this.lastPlayed = {};
    this.ambientAudio = null;

    // 사운드별 개별 밸런스 배율 (적 처치음과 타격음이 귀를 자극하지 않도록 대폭 감쇠)
    this.soundScale = {
      enemyDissolve: 0.22, // 적군 중화/사망 효과음 대폭 축소
      hitNeutralize: 0.25,
      tower_F: 0.26,
      tower_Cs: 0.28,
      tower_Cl: 0.24,
      tower_K: 0.25,
      tower_Na: 0.26,
      tower_O: 0.24,
      tower_H: 0.32,
      tower_C: 0.24,
      towerBuild: 0.45,
      towerUpgrade: 0.48,
      uiClick: 0.35,
      waveStart: 0.42,
      waveClear: 0.5,
      baseDamage: 0.45,
      gameOver: 0.5
    };

    for (const [key, path] of Object.entries(SOUND_PATHS)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      this.buffers[key] = audio;
    }
  }

  /**
   * 효과음 재생 (마스터 sfxVolume * 사운드별 감쇠 배율 * 호출 볼륨 적용 + 쿨다운으로 소리 중첩 차단)
   */
  play(key, baseVolume = 0.4, cooldownMs = 130) {
    if (!this.enabled || this.sfxVolume <= 0.001 || !this.buffers[key]) return;
    const now = performance.now();
    // 적 사망음(enemyDissolve)은 동시에 여러 마리가 죽어도 절대 소리가 겹쳐 커지지 않도록 최소 190ms 간격 보장
    const minGap = key === "enemyDissolve" ? Math.max(cooldownMs, 190) : cooldownMs;
    if (this.lastPlayed[key] && now - this.lastPlayed[key] < minGap) return;
    this.lastPlayed[key] = now;

    const perSoundMult = this.soundScale[key] ?? 0.35;
    const finalVolume = Math.min(1, Math.max(0, baseVolume * perSoundMult * (this.sfxVolume * 1.6)));
    if (finalVolume <= 0.002) return;

    try {
      const clone = this.buffers[key].cloneNode();
      clone.volume = finalVolume;
      clone.play().catch(() => {});
    } catch (_) {}
  }

  startAmbient() {
    if (!this.enabled || !this.buffers.ambientLoop) return;
    if (!this.ambientAudio) {
      this.ambientAudio = this.buffers.ambientLoop;
      this.ambientAudio.loop = true;
    }
    this.ambientAudio.volume = Math.min(1, Math.max(0, this.bgmVolume));
    if (this.bgmVolume > 0.002) {
      this.ambientAudio.play().catch(() => {});
    }
  }

  setSfxVolume(ratio) {
    this.sfxVolume = Math.min(1, Math.max(0, ratio));
    localStorage.setItem("chemlab_sfx_vol", String(this.sfxVolume));
  }

  setBgmVolume(ratio) {
    this.bgmVolume = Math.min(1, Math.max(0, ratio));
    localStorage.setItem("chemlab_bgm_vol", String(this.bgmVolume));
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.bgmVolume;
      if (this.bgmVolume <= 0.002) {
        this.ambientAudio.pause();
      } else if (this.enabled) {
        this.ambientAudio.play().catch(() => {});
      }
    }
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

    // 클리어한 스테이지 및 해금 기록
    this.clearedStages = new Set();
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
    this.currentPh = 1.5;
    this.gasConcentration = 100;
    this.towerDestroyedCount = 0;
    this.paralysisCuredCount = 0;
    this.survivalTimer = 0;

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
    this.syncAudioUI();
    this.loadStage(0);

    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  initDOM() {
    // 1. 숨김 select 및 상단 01~10 섹터 도크 초기화
    const stageSelect = document.getElementById("stageSelect");
    if (stageSelect) {
      stageSelect.innerHTML = TUTORIAL_STAGES.map(
        (st, idx) =>
          `<option value="${idx}">${st.stageId} (${st.environment}) - ${st.enemyKey}</option>`
      ).join("");

      stageSelect.addEventListener("change", (e) => {
        this.sound.play("uiClick");
        this.loadStage(Number(e.target.value));
      });
    }

    this.renderSectorDock();

    // 2. 모드 세그먼트 버튼 (튜토리얼 작전 vs 무제한 서바이벌)
    const btnModeTutorial = document.getElementById("btnModeTutorial");
    const btnModeSurvival = document.getElementById("btnModeSurvival");
    const modeSelect = document.getElementById("modeSelect");

    const setMode = (newMode) => {
      if (this.mode === newMode) return;
      this.sound.play("uiClick");
      this.mode = newMode;
      if (modeSelect) modeSelect.value = newMode;
      if (btnModeTutorial) btnModeTutorial.classList.toggle("active", newMode === "tutorial");
      if (btnModeSurvival) btnModeSurvival.classList.toggle("active", newMode === "survival");
      this.loadStage(this.stageIndex);
    };

    if (btnModeTutorial) btnModeTutorial.addEventListener("click", () => setMode("tutorial"));
    if (btnModeSurvival) btnModeSurvival.addEventListener("click", () => setMode("survival"));
    if (modeSelect) {
      modeSelect.addEventListener("change", (e) => setMode(e.target.value));
    }

    // 3. 웨이브 출격 & 연속 스폰 버튼
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
      const labelSpan = btnStream.querySelector("span:last-child");
      if (labelSpan) {
        labelSpan.textContent = this.endlessStream ? "♾️ 연속 스폰: ON" : "♾️ 연속 스폰: OFF";
      }
      if (this.endlessStream && this.wave === 0) {
        this.startNextWave();
      }
      this.addLog(
        this.endlessStream
          ? "⚡ [무제한 연속 스폰 ON] 웨이브 대기 없이 화학 위험물이 연속 투입됩니다!"
          : "⏸️ [무제한 연속 스폰 OFF] 수동/웨이브 단위로 스폰합니다."
      );
    });

    // 4. 배속 & 일시정지 & 재시작 & 브리핑 버튼
    document.getElementById("btnSpeed").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.speedMultiplier =
        this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 4 : 1;
      document.getElementById("speedLabel").textContent = `${this.speedMultiplier}x`;
    });

    document.getElementById("btnPause").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.paused = !this.paused;
      const pauseLabel = document.getElementById("pauseLabel");
      const pauseIcon = document.getElementById("pauseIcon");
      if (pauseLabel) pauseLabel.textContent = this.paused ? "재개" : "일시정지";
      if (pauseIcon) pauseIcon.textContent = this.paused ? "play_arrow" : "pause";
    });

    document.getElementById("btnOpenBriefing").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.openBriefingModal();
    });

    document.getElementById("btnRestart").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.loadStage(this.stageIndex);
    });

    // 5. 사운드 음소거 & 볼륨 슬라이더 (상단 바 + Pause 모달 동기화)
    document.getElementById("btnSound").addEventListener("click", () => {
      this.sound.toggle();
      this.syncAudioUI();
    });

    const quickSfxSlider = document.getElementById("quickSfxSlider");
    if (quickSfxSlider) {
      quickSfxSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value) / 100;
        this.sound.setSfxVolume(val);
        this.syncAudioUI();
      });
    }

    const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
    if (sfxVolumeSlider) {
      sfxVolumeSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value) / 100;
        this.sound.setSfxVolume(val);
        this.syncAudioUI();
      });
    }

    const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
    if (bgmVolumeSlider) {
      bgmVolumeSlider.addEventListener("input", (e) => {
        const val = Number(e.target.value) / 100;
        this.sound.setBgmVolume(val);
        this.syncAudioUI();
      });
    }

    // 6. Stitch Pause & Audio 모달 열기/닫기
    const openPauseBtn = document.getElementById("btnOpenPauseModal");
    if (openPauseBtn) {
      openPauseBtn.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.openPauseModal();
      });
    }

    const closePauseX = document.getElementById("btnClosePauseX");
    if (closePauseX) {
      closePauseX.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.closePauseModal();
      });
    }

    const btnPauseResume = document.getElementById("btnPauseResume");
    if (btnPauseResume) {
      btnPauseResume.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.closePauseModal();
      });
    }

    const btnPauseOpenBriefing = document.getElementById("btnPauseOpenBriefing");
    if (btnPauseOpenBriefing) {
      btnPauseOpenBriefing.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.closePauseModal();
        this.openBriefingModal();
      });
    }

    const btnPauseRestart = document.getElementById("btnPauseRestart");
    if (btnPauseRestart) {
      btnPauseRestart.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.closePauseModal();
        this.loadStage(this.stageIndex);
      });
    }

    // 7. 브리핑 모달 버튼 이벤트
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
      if (modeSelect) modeSelect.value = "survival";
      if (btnModeTutorial) btnModeTutorial.classList.remove("active");
      if (btnModeSurvival) btnModeSurvival.classList.add("active");
      this.closeBriefingModal();
      this.loadStage(this.stageIndex, false);
      this.addLog(
        `♾️ [${this.currentStage.stageId} 맵 무제한 서바이벌 전환] 이제 이 지형에서 42종 화학 위험물이 끝없이 출현합니다!`
      );
    });

    // 8. 결과 모달 버튼 이벤트
    document.getElementById("btnResultNextStage").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      const nextIdx = (this.stageIndex + 1) % TUTORIAL_STAGES.length;
      this.mode = "tutorial";
      if (modeSelect) modeSelect.value = "tutorial";
      if (btnModeTutorial) btnModeTutorial.classList.add("active");
      if (btnModeSurvival) btnModeSurvival.classList.remove("active");
      this.loadStage(nextIdx, true);
    });

    document.getElementById("btnResultPlaySurvival").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      this.mode = "survival";
      if (modeSelect) modeSelect.value = "survival";
      if (btnModeTutorial) btnModeTutorial.classList.remove("active");
      if (btnModeSurvival) btnModeSurvival.classList.add("active");
      this.loadStage(this.stageIndex, true);
    });

    document.getElementById("btnResultRetry").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeResultModal();
      this.loadStage(this.stageIndex, true);
    });

    // 9. 팔레트 필터 탭
    document.querySelectorAll(".filter-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.sound.play("uiClick");
        document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.paletteFilter = btn.dataset.filter;
        this.renderPalette();
      });
    });

    // 10. 캔버스 마우스 이벤트
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

    // 11. 키보드 단축키 (Space: 웨이브 시작, Esc: 사운드/일시정지 모달)
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.startNextWave();
      } else if (e.code === "Escape") {
        const pauseModal = document.getElementById("pauseModal");
        if (pauseModal && !pauseModal.classList.contains("hidden")) {
          this.closePauseModal();
        } else {
          this.openPauseModal();
        }
      }
    });
  }

  syncAudioUI() {
    const sfxPct = Math.round(this.sound.sfxVolume * 100);
    const bgmPct = Math.round(this.sound.bgmVolume * 100);

    const quickSlider = document.getElementById("quickSfxSlider");
    const quickVal = document.getElementById("quickSfxVal");
    const sfxSlider = document.getElementById("sfxVolumeSlider");
    const sfxLabel = document.getElementById("sfxVolLabel");
    const bgmSlider = document.getElementById("bgmVolumeSlider");
    const bgmLabel = document.getElementById("bgmVolLabel");
    const soundBtn = document.getElementById("btnSound");
    const soundIcon = document.getElementById("soundIcon");

    if (quickSlider) quickSlider.value = String(sfxPct);
    if (quickVal) quickVal.textContent = `${sfxPct}%`;
    if (sfxSlider) sfxSlider.value = String(sfxPct);
    if (sfxLabel) sfxLabel.textContent = `${sfxPct}%`;
    if (bgmSlider) bgmSlider.value = String(bgmPct);
    if (bgmLabel) bgmLabel.textContent = `${bgmPct}%`;

    const isMuted = !this.sound.enabled || (sfxPct === 0 && bgmPct === 0);
    if (soundBtn) soundBtn.classList.toggle("muted", isMuted);
    if (soundIcon) {
      soundIcon.textContent = isMuted
        ? "volume_off"
        : sfxPct < 35
        ? "volume_down"
        : "volume_up";
    }
  }

  openPauseModal() {
    const modal = document.getElementById("pauseModal");
    if (!modal) return;
    this.isModalOpen = true;
    modal.classList.remove("hidden");
    this.syncAudioUI();
  }

  closePauseModal() {
    const modal = document.getElementById("pauseModal");
    if (modal) modal.classList.add("hidden");
    const briefing = document.getElementById("briefingModal");
    const result = document.getElementById("resultModal");
    this.isModalOpen =
      (briefing && !briefing.classList.contains("hidden")) ||
      (result && !result.classList.contains("hidden"));
  }

  renderSectorDock() {
    const dock = document.getElementById("sectorQuickDock");
    if (!dock) return;
    dock.innerHTML = TUTORIAL_STAGES.map((st, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const active = idx === this.stageIndex ? "active" : "";
      const cleared = this.clearedStages.has(st.stageId) ? "cleared" : "";
      return `<button type="button" class="sector-chip ${active} ${cleared}" data-idx="${idx}" title="${st.title} (${st.enemyKey})">${num}</button>`;
    }).join("");

    dock.querySelectorAll(".sector-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.loadStage(Number(btn.dataset.idx));
      });
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
    const stageSelect = document.getElementById("stageSelect");
    if (stageSelect) stageSelect.value = String(index);
    this.closeResultModal();
    this.renderSectorDock();

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
        `🎓 [${st.stageId} 작전 개시] ${st.description} (추천 포탑: ${st.requiredTowers.join(", ") || "자유"}${
          st.shopItems.length ? ` / 설비: ${st.shopItems.join(", ")}` : ""
        })`
      );
    } else {
      this.addLog(
        `♾️ [${st.stageId} 맵 무한 서바이벌] DT_CompoundRecipe.csv 42종 역사적 화학재난 물질이 무제한 출현합니다!`
      );
    }

    if (showPopup) {
      this.openBriefingModal();
    }
  }

  /**
   * 튜토리얼 및 스테이지 상세 브리핑 팝업 열기 (Stitch tut_04_2 디자인)
   */
  openBriefingModal() {
    const st = this.currentStage;
    const modal = document.getElementById("briefingModal");
    if (!modal) return;

    this.isModalOpen = true;
    modal.classList.remove("hidden");

    const envBadge = document.getElementById("modalEnvBadge");
    if (envBadge) {
      envBadge.className = `env-badge ${st.environment.toLowerCase()}`;
      envBadge.textContent =
        st.environment === "Indoor" ? "INDOOR // 실내 밀폐구역" : "OUTDOOR // 야외 플랜트";
    }

    const modeBadge = document.getElementById("modalModeBadge");
    if (modeBadge) {
      modeBadge.textContent =
        this.mode === "tutorial"
          ? `PROTOCOL // ${st.stageId}`
          : `SURVIVAL // ${st.stageId} SECTOR`;
    }

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
          <img src="./icon/enemy_h2s.png" alt="복합 위험물" width="30" height="30" />
          <div class="modal-entity-text">
            <strong>복합 화학 위험물 (전 종 총출동)</strong>
            <span>수소(H₂), 염소(Cl₂), 불산(HF), 황화수소(H₂S), 포스겐(COCl₂) 등 모든 독성 물질이 동시 유출됩니다.</span>
          </div>
        </div>
      `;
    } else {
      const en = TUTORIAL_ENEMIES[st.enemyKey] || TUTORIAL_ENEMIES.H2;
      enemyBox.innerHTML = `
        <div class="modal-entity-item">
          <img src="${en.imagePath}" alt="${en.name}" width="30" height="30" />
          <div class="modal-entity-text">
            <strong>${en.name} [${en.formula}] — ${en.categoryLabel}</strong>
            <span>${en.description}</span>
          </div>
        </div>
      `;
    }

    // 2) 필수 원소 타워 & 상점 설비 카드 렌더링
    const towersBox = document.getElementById("modalTowersBox");
    const recIds = [...st.requiredTowers, ...st.shopItems].slice(0, 3);
    towersBox.innerHTML = recIds
      .map((id) => {
        const tw = TOWER_TYPES[id];
        if (!tw) return "";
        return `
          <div class="modal-entity-item">
            <img src="${tw.imagePath}" alt="${tw.name}" width="30" height="30" />
            <div class="modal-entity-text">
              <strong style="color:${tw.color}">[${tw.symbol}] ${tw.name} (${tw.cost}G)</strong>
              <span>${tw.concept}</span>
            </div>
          </div>
        `;
      })
      .join("");

    // 3) 초보자 3단계 클리어 공략 렌더링
    const stepsList = document.getElementById("modalStepsList");
    const steps = st.tacticalSteps || [
      "1단계: 우측 덱에서 ★추천 표시된 포탑을 선택해 파란 점선 경로 위에 미로를 건설하세요.",
      "2단계: 상점 설비(환풍기, 압력기, 가열기, 유리벽)를 조합해 반응 효율을 높이세요.",
      "3단계: 우측 상단 [미션 웨이브 시작] 버튼을 눌러 위험물을 목표치까지 중화하세요!"
    ];
    stepsList.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

    // 4) 역사적 배경 및 보상
    document.getElementById("modalHistoricalText").textContent =
      `📜 화학 안전 배경지식: ${st.historicalCase || st.description}`;
    document.getElementById("modalClearTarget").textContent =
      this.mode === "tutorial" ? st.clearLabel : "방어선이 뚫릴 때까지 무제한 웨이브 돌파";
    document.getElementById("modalRewardText").textContent = st.rewardLabel;

    const btnSwitch = document.getElementById("btnModalSwitchSurvival");
    if (btnSwitch) {
      btnSwitch.style.display = this.mode === "survival" ? "none" : "inline-flex";
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
    const statusBadge = document.getElementById("resultStatusBadge");
    const titleEl = document.getElementById("resultModalTitle");
    const descEl = document.getElementById("resultModalDesc");
    const rewardEl = document.getElementById("resultRewardBox");
    const nextBtn = document.getElementById("btnResultNextStage");

    if (isVictory) {
      if (statusBadge) statusBadge.textContent = `OPERATION SUCCESS // ${st.stageId}`;
      titleEl.style.color = "#ffc665";
      titleEl.textContent = `🎉 ${st.stageId} 작전 완벽 클리어!`;
      descEl.textContent = `"${st.clearLabel}" 목표를 달성하여 도시와 연구소를 성공적으로 방어했습니다.`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `🎁 작전 인가 보상: ${st.rewardLabel}  |  정화 점수: ${this.score.toLocaleString()} PTS`;
      if (nextBtn) {
        const nextSt = TUTORIAL_STAGES[(this.stageIndex + 1) % TUTORIAL_STAGES.length];
        nextBtn.style.display = "flex";
        nextBtn.innerHTML = `<span>다음 작전(${nextSt.stageId}) 브리핑 열기</span><span class="material-symbols-outlined">arrow_forward</span>`;
      }
    } else {
      if (statusBadge) statusBadge.textContent = `THREAT LEVEL CRITICAL // ${st.stageId}`;
      titleEl.style.color = "#ff6b6b";
      titleEl.textContent = `🚨 ${st.stageId} 방어선 붕괴 (유출 사고)`;
      descEl.textContent = `미로 경로를 더 길게 우회시키거나, 스테이지 필수 추천 포탑(${st.requiredTowers.join(", ")})과 설비(${st.shopItems.join(", ") || "없음"})를 조합해 다시 도전해 보세요!`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `💡 전술 가이드: 상단 [작전 브리핑]에서 3단계 침투 방제 가이드를 다시 확인할 수 있습니다.`;
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
    const secCode = document.getElementById("headerSectorCode");
    if (secCode) {
      secCode.textContent = `SEC-${String(this.stageIndex + 1).padStart(2, "0")}`;
    }

    const envBadge = document.getElementById("envBadge");
    if (envBadge) {
      envBadge.className = `env-badge ${st.environment.toLowerCase()}`;
      envBadge.textContent = st.environment === "Indoor" ? "INDOOR" : "OUTDOOR";
    }

    const titleEl = document.getElementById("stageTitleText");
    const reqEl = document.getElementById("stageReqBadge");
    const rewardEl = document.getElementById("stageRewardBadge");
    const descEl = document.getElementById("stageDescText");
    const formulaEl = document.getElementById("hudFormulaText");
    const hazardBadge = document.getElementById("hazardEnemyBadge");

    if (formulaEl) {
      const shortEq = (st.chemicalEquation || "2H₂ + O₂ → 2H₂O").split("(")[0].trim();
      formulaEl.textContent = shortEq;
    }

    if (hazardBadge) {
      hazardBadge.textContent = this.mode === "survival" ? "42 HAZARDS" : st.enemyKey;
    }

    if (this.mode === "tutorial") {
      titleEl.textContent = st.title;
      const reqStr = st.requiredTowers.join(", ");
      const shopStr = st.shopItems.length > 0 ? st.shopItems.join(", ") : "없음";
      reqEl.textContent = `필수 원소: ${reqStr} | 설비: ${shopStr}`;
      rewardEl.textContent = `보상: ${st.rewardLabel}`;
      descEl.textContent = `${st.description} (포탑으로 길을 막아 미로를 만드세요!)`;
    } else {
      const recipeIdx = Math.max(0, this.wave - 1) % COMPOUND_RECIPES.length;
      const recipe = COMPOUND_RECIPES[recipeIdx];
      titleEl.textContent = `♾️ [${st.stageId} 서바이벌] W${Math.max(1, this.wave)} — ${recipe.displayName}(${recipe.rowName})`;
      reqEl.textContent = `중화 카운터: ${recipe.counter}`;
      rewardEl.textContent = `역사적 화학재난 42종 무한 루프`;
      descEl.textContent = `${recipe.description}`;
    }

    this.updateObjectiveUI();
  }

  updateObjectiveUI() {
    const st = this.currentStage;
    const labelEl = document.getElementById("objectiveLabel");
    const valEl = document.getElementById("objectiveValue");
    const barEl = document.getElementById("objectiveBar");

    if (this.mode === "survival") {
      labelEl.textContent = `♾️ 무제한 서바이벌 (필드 위험물: ${this.enemies.length}기 / 누적 정화: ${this.objectiveProgress}기)`;
      valEl.textContent = `WAVE ${String(this.wave).padStart(2, "0")}`;
      barEl.style.width = "100%";
      return;
    }

    let pct = 0;
    let statusText = "";

    switch (st.clearCondition) {
      case "Eliminate_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `H₂O 전환: ${this.objectiveProgress}/${st.clearTarget} (${pct}%)`;
        break;
      case "Lower_Concentration":
        pct = Math.min(100, Math.round(100 - this.gasConcentration));
        statusText = `수소 농도: ${this.gasConcentration.toFixed(0)}% → 0% (${pct}%)`;
        break;
      case "Create_NaCl_20":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `NaCl 침전: ${this.objectiveProgress}/${st.clearTarget} (${pct}%)`;
        break;
      case "Neutralize_pH":
        pct = Math.min(100, Math.round(((this.currentPh - 1.5) / (7.0 - 1.5)) * 100));
        statusText = `산성도 pH ${this.currentPh.toFixed(2)} → 7.00 (${pct}%)`;
        break;
      case "Zero_Damage":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `무손실 해독: ${this.objectiveProgress}/${st.clearTarget} (파괴:${this.towerDestroyedCount})`;
        break;
      case "Cure_Paralysis":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `H₂S 산화: ${this.objectiveProgress}/${st.clearTarget} (해독:${this.paralysisCuredCount})`;
        break;
      case "Create_CO2_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `CO₂ 연소: ${this.objectiveProgress}/${st.clearTarget} (${pct}%)`;
        break;
      case "Stop_Corrosion":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `황산 중화: ${this.objectiveProgress}/${st.clearTarget} (${pct}%)`;
        break;
      case "Decompose_All":
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `포스겐 분해: ${this.objectiveProgress}/${st.clearTarget} (${pct}%)`;
        break;
      case "Survive_5min":
        pct = Math.min(100, Math.round((this.survivalTimer / st.clearTarget) * 100));
        statusText = `방어 시간: ${Math.floor(this.survivalTimer)}s / ${st.clearTarget}s (${pct}%)`;
        break;
      default:
        pct = Math.min(100, Math.round((this.objectiveProgress / st.clearTarget) * 100));
        statusText = `${this.objectiveProgress} / ${st.clearTarget} (${pct}%)`;
    }

    labelEl.textContent = `${st.clearLabel}`;
    valEl.textContent = statusText;
    barEl.style.width = `${pct}%`;
  }

  updateHUD() {
    document.getElementById("statGold").textContent = Math.floor(this.gold);
    document.getElementById("statLives").textContent = this.lives;
    document.getElementById("statWave").textContent =
      this.mode === "tutorial"
        ? `S${this.stageIndex + 1} • W${String(this.wave).padStart(2, "0")}`
        : `♾️ W${String(this.wave).padStart(2, "0")}`;
    document.getElementById("statScore").textContent = this.score.toLocaleString();

    const startLabel = document.getElementById("startWaveLabel");
    if (this.mode === "survival") {
      startLabel.textContent = this.wave === 0 ? "서바이벌 웨이브 개시" : "다음 웨이브 조기 투입";
    } else {
      startLabel.textContent = this.wave === 0 ? "미션 1웨이브 개시" : "지원 웨이브 추가 투입";
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
              <span>${t.category === "shop" ? "GEAR" : `${t.atomicNumber}`}</span>
              <span class="el-rank">${t.symbol}</span>
            </div>
            <div class="el-thumb-wrap">
              <img src="${t.imagePath}" alt="${t.name}" width="22" height="22" class="el-thumb" />
              <span class="el-symbol-badge">${t.symbol}</span>
            </div>
            <div class="el-name">${t.name.split(" (")[0]}</div>
            <div class="el-meta">
              <span>D:${t.damage}</span>
              <span class="el-cost">${t.cost}G</span>
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

  /**
   * 캔버스 하단 Stitch Selected Tower Quick Inspector Bar 렌더링
   */
  renderInspector() {
    const box = document.getElementById("inspectorContent");
    if (!box) return;

    // 1) 이미 설치된 타워를 선택한 경우
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
        <div class="inspector-left">
          <div class="inspector-thumb-box">
            <img src="${imgPath}" alt="${spec.name}" width="34" height="34" class="inspector-preview-img" />
          </div>
          <div class="inspector-info">
            <div class="inspector-title-row">
              <span class="inspector-title" style="color:${spec.color}">[${spec.symbol}] ${spec.name}</span>
              <span class="badge-lvl">Lv.${t.level}</span>
              ${t.boostedByO || t.boostedByHeater ? `<span class="badge-oxy">⚡촉매 가속중</span>` : ""}
              ${t.paralyzedTimer > 0 ? `<span class="badge-oxy" style="color:#ff6b6b">⚡마비됨</span>` : ""}
            </div>
            <div class="inspector-sub">${spec.whyReactive}</div>
          </div>
        </div>

        <div class="inspector-stats-pills">
          <div class="stat-pill"><span>DMG</span><strong>${Math.round(t.getEffectiveDamage())}</strong></div>
          <div class="stat-pill"><span>RNG</span><strong>${Math.round(t.getEffectiveRange())}px</strong></div>
          <div class="stat-pill"><span>SPD</span><strong>${t.getEffectiveFireRate().toFixed(1)}/s</strong></div>
          <div class="stat-pill"><span>HP</span><strong>${Math.ceil(t.hp)}/${t.maxHp}</strong></div>
        </div>

        <div class="inspector-actions">
          <button id="btnUpgradeTower" class="action-btn upg-btn" ${
            this.gold < upgCost || t.level >= 5 ? "disabled" : ""
          }>
            <img src="./icon/ui_upgrade.png" alt="" width="14" height="14" class="btn-icon" />
            <span>${t.level >= 5 ? "MAX" : `↑ 강화 (${upgCost}G)`}</span>
          </button>
          ${
            spec.isKamikaze
              ? `<button id="btnDetonateH" class="action-btn detonate-btn">💥 기폭</button>`
              : ""
          }
          <button id="btnSellTower" class="action-btn sell-btn">
            <span>🗑️ 해체 (+${sellRefund}G)</span>
          </button>
        </div>
      `;

      const btnUpg = document.getElementById("btnUpgradeTower");
      if (btnUpg) btnUpg.addEventListener("click", () => this.upgradeSelectedTower());

      const btnDet = document.getElementById("btnDetonateH");
      if (btnDet) btnDet.addEventListener("click", () => this.detonateHydrogenTower(t));

      const btnSell = document.getElementById("btnSellTower");
      if (btnSell) btnSell.addEventListener("click", () => this.sellSelectedTower());
      return;
    }

    // 2) 팔레트에서 건설할 원소/설비를 선택 중인 경우
    if (this.selectedBuildType && TOWER_TYPES[this.selectedBuildType]) {
      const spec = TOWER_TYPES[this.selectedBuildType];
      const isRec = this.isRecommendedForCurrentStage(spec.id);
      box.innerHTML = `
        <div class="inspector-left">
          <div class="inspector-thumb-box">
            <img src="${spec.imagePath}" alt="${spec.name}" width="34" height="34" class="inspector-preview-img" />
          </div>
          <div class="inspector-info">
            <div class="inspector-title-row">
              <span class="inspector-title" style="color:${spec.color}">[${spec.symbol}] ${spec.name}</span>
              <span class="badge-lvl">${spec.cost}G</span>
              ${isRec ? `<span class="badge-oxy">★현재 스테이지 필수 추천</span>` : `<span class="badge-lvl">${spec.rankLabel}</span>`}
            </div>
            <div class="inspector-sub"><strong>반응 원리:</strong> ${spec.whyReactive} — <em>${spec.concept}</em></div>
          </div>
        </div>

        <div class="inspector-stats-pills">
          <div class="stat-pill"><span>COST</span><strong style="color:#ffc665">${spec.cost}G</strong></div>
          <div class="stat-pill"><span>DMG</span><strong>${spec.damage}</strong></div>
          <div class="stat-pill"><span>RNG</span><strong>${spec.range}px</strong></div>
          <div class="stat-pill"><span>PRODUCT</span><strong style="color:#00e4fe">${spec.Produces}</strong></div>
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="inspector-left">
        <div class="inspector-info">
          <div class="inspector-title-row">
            <span class="inspector-title" style="color:#ffc665">TACTICAL INSPECTOR // 포탑 제어반</span>
          </div>
          <div class="inspector-sub">우측 덱에서 원소 포탑이나 설비를 선택해 전장에 배치하거나, 배치된 포탑을 클릭해 강화·해체하세요.</div>
        </div>
      </div>
    `;
  }

  handleTileClick(c, r) {
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
        "#ff6b6b"
      );
      return;
    }

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
        "#ffc665"
      );
      this.addLog("🚫 [경로 차단 경고] 모든 위험물이 출구로 빠져나갈 수 있는 최소 1칸의 우회 통로가 필요합니다!");
      return;
    }

    this.gold -= spec.cost;
    this.grid[r][c] = 2;

    const maxHp = spec.id === "GlassWall" ? 500 : spec.highDurability ? 260 : 120;
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
    this.addFloatingText(t.x, t.y - 10, `Lv.${t.level} 강화!`, "#ffc665");
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
    this.sound.play("tower_H", 0.35, 160);
    this.spawnParticles(tower.x, tower.y, "#00e4fe", 28);
    this.addFloatingText(tower.x, tower.y, "💥 수소 초광역 기폭!", "#00e4fe");

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

  startNextWave() {
    if (this.gameOver || this.stageCleared) return;

    this.wave += 1;
    this.sound.play("waveStart", 0.35, 200);
    const st = this.currentStage;

    if (this.mode === "tutorial") {
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
      const recipe = COMPOUND_RECIPES[(this.wave - 1) % COMPOUND_RECIPES.length];
      const baseArchetype = ENEMY_TYPES[recipe.archetype] || ENEMY_TYPES.GAS;
      const count = 14 + this.wave * 4;
      const hpScale = Math.pow(1.18, this.wave - 1);
      const interval = Math.max(0.22, 0.78 - this.wave * 0.02);

      for (let i = 0; i < count; i++) {
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

    if (this.mode === "tutorial" && st.clearCondition === "Survive_5min" && this.wave > 0) {
      this.survivalTimer += dt;
      if (this.survivalTimer >= st.clearTarget) {
        this.completeTutorialStage();
        return;
      }
      if (this.spawnQueue.length === 0 && this.enemies.length < 6) {
        this.startNextWave();
      }
    }

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
      this.startNextWave();
    }

    // 1. 타워 오라 계산
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
              this.addFloatingText(target.x, target.y - 12, "O₂ 마비 해독!", "#00e4fe");
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

    // 2. 적군 이동 및 특수 기믹 처리
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
              this.addLog("💥 [포탑 부식 붕괴] 불산/황산에 의해 포탑이 손상되었습니다! 칼슘(Ca)이나 유리벽(GlassWall)을 배치하세요.");
            }
          }
        }
      }

      if (e.paralyzesTowers) {
        for (const tw of this.towers) {
          if (tw.typeId === "O" || tw.boostedByO) continue;
          const dist = Math.hypot(tw.x - e.x, tw.y - e.y);
          if (dist <= 75) {
            tw.paralyzedTimer = Math.max(tw.paralyzedTimer, 1.5);
          }
        }
      }

      const speedMult = e.slowTimer > 0 ? 1 - e.slowFactor : 1;
      const moveStep = e.speed * speedMult * dt;

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

      for (const ex of this.exits) {
        const exX = ex.c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        const exY = ex.r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2;
        if (Math.hypot(e.x - exX, e.y - exY) < 16) {
          this.lives -= 1;
          this.sound.play("baseDamage", 0.35, 160);
          this.addFloatingText(exX, exY, "-1 GATE 유출!", "#ff6b6b");
          this.enemies.splice(i, 1);
          this.updateHUD();
          if (this.lives <= 0) {
            this.lives = 0;
            this.gameOver = true;
            this.sound.play("gameOver", 0.4, 300);
            this.addLog("🚨 [방어선 붕괴] 유독 화학물질이 도시 게이트로 유출되었습니다!");
            this.openResultModal(false);
          }
          break;
        }
      }
    }

    // 3. 타워 공격 처리 (발사 효과음 볼륨도 부드럽게 감쇠)
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

      const candidates = this.enemies.filter((e) => {
        if (e.isStealth && e.revealedTimer <= 0 && !spec.revealsStealth) return false;
        return Math.hypot(e.x - t.x, e.y - t.y) <= range;
      });

      if (candidates.length === 0) continue;

      t.cooldown = 1 / t.getEffectiveFireRate();
      this.sound.play(spec.soundKey || "hitNeutralize", 0.22, 150);

      if (spec.isAuraCloud) {
        this.spawnParticles(t.x, t.y, spec.color, 8);
        for (const target of candidates) {
          if (spec.revealsStealth) target.revealedTimer = 4.0;
          if (spec.pullStrength) {
            const angle = Math.atan2(t.y - target.y, t.x - target.x);
            target.x += Math.cos(angle) * 6;
            target.y += Math.sin(angle) * 6;
          }
          this.applyDamageToEnemy(target, t.getEffectiveDamage(), t);
        }
        continue;
      }

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

      if (spec.isKamikaze) {
        t.triggerCount += 1;
        if (t.triggerCount >= spec.maxTriggerCount) {
          this.detonateHydrogenTower(t);
        }
      }
    }

    // 4. 투사체 충돌 처리
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

      const bonus = spec.targetBonus?.[enemy.categoryKey] || 1.0;
      finalDamage *= bonus;

      if (enemy.id === "H2" && spec.id === "O") finalDamage *= 2.2;
      if (enemy.id === "Cl2" && spec.id === "Na") {
        finalDamage *= tower.boostedByHeater ? 2.6 : 1.9;
      }
      if (enemy.id === "HCl" && spec.id === "Na") finalDamage *= 2.1;
      if (enemy.id === "HF" && spec.id === "Ca") finalDamage *= 2.5;
      if (enemy.id === "H2S" && spec.id === "O") finalDamage *= 2.2;
      if (enemy.id === "CO" && (spec.id === "O" || spec.id === "Heater")) {
        finalDamage *= tower.boostedByHeater ? 2.6 : 1.8;
      }
      if (enemy.id === "H2SO4" && ["Ca", "Na", "O"].includes(spec.id)) {
        finalDamage *= 1.5 + enemy.hitByElements.size * 0.35;
      }
      if (enemy.id === "COCl2" && ["C", "O", "Cl", "Fan"].includes(spec.id)) {
        finalDamage *= 1.45 + enemy.hitByElements.size * 0.3;
      }

      if (spec.slowFactor) {
        enemy.slowFactor = Math.max(enemy.slowFactor, spec.slowFactor);
        enemy.slowTimer = Math.max(enemy.slowTimer, spec.slowDuration || 2.0);
      }

      if (spec.pushbackStrength && this.spawns.length > 0) {
        const spX = this.spawns[0].c * GRID_CONFIG.tileSize + 19;
        const spY = this.spawns[0].r * GRID_CONFIG.tileSize + 19;
        const ang = Math.atan2(spY - enemy.y, spX - enemy.x);
        enemy.x += Math.cos(ang) * spec.pushbackStrength * 0.45;
        enemy.y += Math.sin(ang) * spec.pushbackStrength * 0.45;
      }

      if (spec.dotDamage) {
        enemy.dotDps = Math.max(enemy.dotDps, spec.dotDamage);
        enemy.dotTimer = Math.max(enemy.dotTimer, spec.dotDuration || 3.0);
      }

      if (spec.lowersConcentration && this.gasConcentration > 0) {
        this.gasConcentration = Math.max(0, this.gasConcentration - 0.9);
      }

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

    // 사용자 요청 반영: 적 처치 효과음(enemyDissolve)을 부드럽고 작게(0.18 베이스 * 0.22 감쇠 * 마스터 볼륨, 최소 190ms 간격) 재생
    this.sound.play("enemyDissolve", 0.18, 190);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 14);

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

    this.addFloatingText(enemy.x, enemy.y, reactionBadge, "#ffc665");

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
    this.clearedStages.add(st.stageId);
    this.unlockedRewards.add(st.rewards);
    this.renderSectorDock();
    this.sound.play("waveClear", 0.45, 250);

    this.addLog(
      `🎉 [${st.stageId} 작전 성공!] "${st.clearLabel}" 달성 완료! 🎁 보상: ${st.rewardLabel}`
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

  addFloatingText(x, y, text, color = "#ffc665") {
    this.floatingTexts.push({ x, y, text, color, life: 1.1 });
  }

  addLog(msg) {
    const ticker = document.getElementById("liveTickerText");
    if (ticker) ticker.textContent = msg;

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

    // 1. Stitch 다크 매트 그리드 배경 렌더링
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize;
        const y = r * tileSize;
        const even = (r + c) % 2 === 0;
        if (isIndoor) {
          ctx.fillStyle = even ? "#0d1118" : "#111620";
        } else {
          ctx.fillStyle = even ? "#0b1315" : "#0f191c";
        }
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = isIndoor
          ? "rgba(0, 228, 254, 0.06)"
          : "rgba(255, 198, 101, 0.06)";
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // 2. 예상 이동 경로(FlowField 점선) 표시
    if (this.previewPaths) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 228, 254, 0.28)";
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
        ctx.fillStyle = "#242a38";
        ctx.fillRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
      }
    }

    // 4. 스폰(VENT IN) 및 출구(GATE OUT) 마커 렌더링
    for (const sp of this.spawns) {
      const x = sp.c * tileSize;
      const y = sp.r * tileSize;
      ctx.fillStyle = "rgba(255, 107, 107, 0.24)";
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = "#ff6b6b";
      ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = "#ffb4ab";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("VENT", x + tileSize / 2, y + tileSize / 2 + 3);
    }

    for (const ex of this.exits) {
      const x = ex.c * tileSize;
      const y = ex.r * tileSize;
      ctx.fillStyle = "rgba(52, 211, 153, 0.24)";
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = "#34d399";
      ctx.strokeRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = "#6ee7b7";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GATE", x + tileSize / 2, y + tileSize / 2 + 3);
    }

    // 5. 설치된 타워 렌더링
    for (const t of this.towers) {
      const spec = TOWER_TYPES[t.typeId];
      const x = t.c * tileSize;
      const y = t.r * tileSize;

      if (t.boostedByO || t.boostedByHeater) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, tileSize * 0.46, 0, Math.PI * 2);
        ctx.fillStyle = t.boostedByHeater
          ? "rgba(255, 198, 101, 0.22)"
          : "rgba(0, 228, 254, 0.22)";
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
      ctx.fillStyle = "rgba(11, 14, 19, 0.9)";
      ctx.fillRect(x + 2, y + tileSize - 13, tileSize - 4, 11);
      ctx.fillStyle = spec.color;
      ctx.font = "bold 9px 'JetBrains Mono', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${spec.symbol} L${t.level}`, x + tileSize / 2, y + tileSize - 4);

      if (t.paralyzedTimer > 0) {
        ctx.fillStyle = "#ffc665";
        ctx.font = "bold 10px sans-serif";
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
      ctx.fillStyle = "rgba(255, 198, 101, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "#ffc665";
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
      ctx.fillStyle = canPlace ? "rgba(0, 228, 254, 0.11)" : "rgba(255, 107, 107, 0.15)";
      ctx.fill();
      ctx.strokeStyle = canPlace ? "#00e4fe" : "#ff6b6b";
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

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 9.5px 'JetBrains Mono', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.formula, e.x, e.y - e.radius - 7);

      const bw = 28;
      const bh = 4;
      const hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(11, 14, 19, 0.88)";
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 5, bw, bh);
      ctx.fillStyle = hpRatio > 0.5 ? "#34d399" : hpRatio > 0.25 ? "#ffc665" : "#ff6b6b";
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
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.chemGame = new ChemicalDefenseGame();
});
