/**
 * [파일 역할] 제노택틱 2.0: 케미컬 디펜스 메인 엔진 (game.js)
 * - 10종 원소 포탑(O, N, Na, Cl, Ca, S, C, Fe, Cs, F) 단계별 개방 및 비활성 잠금 시스템
 * - 원소별 · 적 분자별 화학 반응 판정(canTowerReactWithEnemy): 반응하지 않는 적 분자는 절대 공격하지 않음
 * - 신규 포탑 개방 시 포탑의 효과/기능 및 화학 반응식 상세 팝업(#towerUnlockModal) 자동 표시
 * - 튜토리얼 전체 클리어 시 10종 전 포탑 영구 개방 & 적 처치음 볼륨 저감/슬라이더 지원
 */

import {
  GRID_CONFIG,
  SOUND_PATHS,
  UI_ICONS,
  TOWER_TYPES,
  ENEMY_TYPES,
  TUTORIAL_ENEMIES,
  TUTORIAL_STAGES,
  COMPOUND_RECIPES,
  canTowerReactWithEnemy
} from "./data.js?v=5";

import {
  computeFlowField,
  canPlaceTowerWithoutBlocking,
  tracePreviewPaths
} from "./pathfinding.js?v=5";

class SoundManager {
  constructor() {
    this.enabled = true;
    const savedSfx = localStorage.getItem("chemlab_sfx_vol");
    const savedBgm = localStorage.getItem("chemlab_bgm_vol");
    this.sfxVolume = savedSfx !== null ? Number(savedSfx) : 0.28;
    this.bgmVolume = savedBgm !== null ? Number(savedBgm) : 0.14;

    this.buffers = {};
    this.lastPlayed = {};
    this.ambientAudio = null;

    // 사운드별 개별 밸런스 배율 (적 처치음과 타격음이 귀를 자극하지 않도록 대폭 감쇠)
    this.soundScale = {
      enemyDissolve: 0.22,
      hitNeutralize: 0.25,
      tower_F: 0.26,
      tower_Cs: 0.28,
      tower_Cl: 0.24,
      tower_K: 0.25,
      tower_Na: 0.26,
      tower_O: 0.24,
      tower_H: 0.3,
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

  play(key, baseVolume = 0.4, cooldownMs = 130) {
    if (!this.enabled || this.sfxVolume <= 0.001 || !this.buffers[key]) return;
    const now = performance.now();
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

    // 클리어한 스테이지 및 전 튜토리얼 완료 여부
    this.clearedStages = new Set();
    this.allTutorialsCleared = false;
    this.shownUnlockPopups = new Set();

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

  /**
   * 현재 스테이지에서 특정 타워가 개방(사용 가능) 상태인지 판정
   * - 튜토리얼 진행 중에는 해당 스테이지의 필수 개방 타워만 활성화되고 나머지는 비활성화(잠금)
   * - 튜토리얼이 모두 끝나면(allTutorialsCleared) 또는 서바이벌 모드에서는 10종 모두 개방
   */
  isTowerUnlocked(typeId) {
    if (this.allTutorialsCleared || this.mode === "survival") return true;
    const st = this.currentStage;
    if (!st) return false;
    return st.requiredTowers.includes(typeId);
  }

  /**
   * 현재 스테이지(또는 현재 웨이브)의 주 출현 적 분자 ID 반환
   */
  getCurrentTargetEnemyId() {
    const st = this.currentStage;
    if (this.mode === "survival") {
      const recipe = COMPOUND_RECIPES[Math.max(0, this.wave - 1) % COMPOUND_RECIPES.length];
      return recipe.rowName;
    }
    return st.enemyKey;
  }

  /**
   * 특정 타워가 현재 스테이지의 적 분자와 화학 반응을 일으켜 공격할 수 있는지 확인
   */
  canReactWithCurrentStageEnemy(typeId) {
    const enemyKey = this.getCurrentTargetEnemyId();
    if (enemyKey === "Mixed") return true;
    return canTowerReactWithEnemy(typeId, enemyKey);
  }

  initDOM() {
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

    // Pause 모달 이벤트
    document.getElementById("btnOpenPauseModal")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.openPauseModal();
    });
    document.getElementById("btnClosePauseX")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closePauseModal();
    });
    document.getElementById("btnPauseResume")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closePauseModal();
    });
    document.getElementById("btnPauseOpenBriefing")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closePauseModal();
      this.openBriefingModal();
    });
    document.getElementById("btnPauseRestart")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closePauseModal();
      this.loadStage(this.stageIndex);
    });

    // 브리핑 모달 이벤트 (닫을 때 해당 스테이지 신규 개방 타워 팝업 자동 연동!)
    document.getElementById("btnCloseBriefingX").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeBriefingAndMaybeShowUnlock();
    });

    document.getElementById("btnModalBuildStart").addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.closeBriefingAndMaybeShowUnlock();
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
        `♾️ [${this.currentStage.stageId} 맵 무제한 서바이벌] 10종 원소 포탑이 모두 개방되어 42종 화학 위험물과 반응합니다!`
      );
    });

    // 타워 개방 & 화학 반응 상세 모달(#towerUnlockModal) 닫기 이벤트
    document.getElementById("btnCloseUnlockX")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.closeTowerUnlockModal();
    });
    document.getElementById("btnConfirmUnlock")?.addEventListener("click", () => {
      this.sound.play("uiClick");
      this.sound.startAmbient();
      this.closeTowerUnlockModal();
    });

    // 결과 모달 이벤트
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

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.startNextWave();
      } else if (e.code === "Escape") {
        const unlockModal = document.getElementById("towerUnlockModal");
        if (unlockModal && !unlockModal.classList.contains("hidden")) {
          this.closeTowerUnlockModal();
          return;
        }
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

  checkAnyModalOpen() {
    const ids = ["briefingModal", "towerUnlockModal", "pauseModal", "resultModal"];
    this.isModalOpen = ids.some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
  }

  openPauseModal() {
    const modal = document.getElementById("pauseModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    this.syncAudioUI();
    this.checkAnyModalOpen();
  }

  closePauseModal() {
    const modal = document.getElementById("pauseModal");
    if (modal) modal.classList.add("hidden");
    this.checkAnyModalOpen();
  }

  /**
   * 브리핑 모달을 닫을 때, 현재 스테이지에서 새로 개방된 원소 포탑의 효과/반응 팝업(#towerUnlockModal)을 자동으로 띄움
   */
  closeBriefingAndMaybeShowUnlock() {
    this.closeBriefingModal();
    const st = this.currentStage;
    if (this.mode === "tutorial" && st && st.newlyUnlockedTower) {
      this.openTowerUnlockModal(st.newlyUnlockedTower, true);
    }
  }

  /**
   * 신규 원소 포탑 개방 & 화학 반응 메커니즘 상세 팝업 열기
   */
  openTowerUnlockModal(towerId, isStageUnlock = false) {
    const spec = TOWER_TYPES[towerId];
    const modal = document.getElementById("towerUnlockModal");
    if (!spec || !modal) return;

    this.shownUnlockPopups.add(towerId);
    modal.classList.remove("hidden");
    this.checkAnyModalOpen();

    const badgeEl = document.getElementById("unlockStageBadge");
    if (badgeEl) {
      badgeEl.textContent = isStageUnlock
        ? `NEW ELEMENT TOWER UNLOCKED // ${spec.unlockStageId} 개방`
        : `ELEMENT REACTION DOSSIER // [${spec.symbol}] 화학 반응 상세`;
    }

    const imgEl = document.getElementById("unlockTowerImg");
    if (imgEl) {
      imgEl.src = spec.imagePath;
      imgEl.alt = spec.name;
    }

    document.getElementById("unlockAtomicBadge").textContent = `No.${spec.atomicNumber} [${spec.symbol}]`;
    document.getElementById("unlockRankText").textContent = spec.rankLabel;
    document.getElementById("unlockTowerName").textContent = spec.name;
    document.getElementById("unlockTowerName").style.color = spec.color;
    document.getElementById("unlockConceptText").textContent = spec.concept;

    document.getElementById("unlockStatCost").textContent = `${spec.cost}G`;
    document.getElementById("unlockStatDmg").textContent = `${spec.damage} / ${spec.fireRate}s`;
    document.getElementById("unlockStatRange").textContent = `${spec.range}px`;
    document.getElementById("unlockStatProduct").textContent = spec.Produces;

    document.getElementById("unlockWhyReactive").textContent = spec.whyReactive;

    // 어떤 화학 반응으로 적을 없애는지 상세 카드 렌더링
    const reactionList = document.getElementById("unlockReactionList");
    if (reactionList) {
      reactionList.innerHTML = (spec.reactionDetails || [])
        .map(
          (rd) => `
          <div class="reaction-detail-card">
            <div class="rd-target">🎯 표적 분자: ${rd.targetFormula}</div>
            <div class="rd-eq">${rd.equation}</div>
            <div class="rd-mech">${rd.mechanism}</div>
          </div>
        `
        )
        .join("");
    }

    // 공격 가능 적 분자 칩 리스트 (현재 스테이지 적 분자는 하이라이트)
    const curEnemyId = this.getCurrentTargetEnemyId();
    const chipsWrap = document.getElementById("unlockReactiveChips");
    if (chipsWrap) {
      chipsWrap.innerHTML = (spec.reactiveMolecules || [])
        .map((mol) => {
          const isCur = mol === curEnemyId;
          return `<span class="mol-chip ${isCur ? "highlight" : ""}">${mol}${isCur ? " ★현재표적" : ""}</span>`;
        })
        .join("");
    }

    // 무반응(공격하지 않는) 적 분자 설명
    const nonReactEl = document.getElementById("unlockNonReactiveText");
    if (nonReactEl) {
      nonReactEl.textContent = spec.nonReactiveSummary;
    }
  }

  closeTowerUnlockModal() {
    const modal = document.getElementById("towerUnlockModal");
    if (modal) modal.classList.add("hidden");
    this.checkAnyModalOpen();
  }

  renderSectorDock() {
    const dock = document.getElementById("sectorQuickDock");
    if (!dock) return;
    dock.innerHTML = TUTORIAL_STAGES.map((st, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const active = idx === this.stageIndex ? "active" : "";
      const cleared = this.clearedStages.has(st.stageId) ? "cleared" : "";
      return `<button type="button" class="sector-chip ${active} ${cleared}" data-idx="${idx}" title="${st.title} (개방: ${st.requiredTowers.join(",")})">${num}</button>`;
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

  loadStage(index, showPopup = true) {
    this.stageIndex = index;
    const stageSelect = document.getElementById("stageSelect");
    if (stageSelect) stageSelect.value = String(index);
    this.closeResultModal();
    this.closeTowerUnlockModal();
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

    this.objectiveProgress = 0;
    this.objectiveTarget = st.clearTarget;
    this.currentPh = 1.5;
    this.gasConcentration = 100;
    this.towerDestroyedCount = 0;
    this.paralysisCuredCount = 0;
    this.survivalTimer = 0;

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

    // 현재 스테이지에서 개방된 첫 번째 타워를 기본 선택
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
        `🎓 [${st.stageId}] 개방 포탑: [${st.requiredTowers.join(", ")}] (나머지 포탑 비활성) — ${st.description}`
      );
    } else {
      this.addLog(
        `♾️ [${st.stageId} 맵 무한 서바이벌] 10종 모든 원소 포탑이 개방되었습니다! 분자별 상성에 맞춰 방어하세요.`
      );
    }

    if (showPopup) {
      this.openBriefingModal();
    }
  }

  openBriefingModal() {
    const st = this.currentStage;
    const modal = document.getElementById("briefingModal");
    if (!modal) return;

    modal.classList.remove("hidden");
    this.checkAnyModalOpen();

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
          <img src="./icon/enemy_h2s.png" alt="복합 위험물" width="28" height="28" />
          <div class="modal-entity-text">
            <strong>복합 화학 위험물 (전 분자 총출동)</strong>
            <span>수소(H₂), 염소(Cl₂), 불산(HF), 황화수소(H₂S), 포스겐(COCl₂) 등 모든 독성 분자가 출현합니다. 무반응 원소는 공격하지 않으므로 다종 원소를 조합하세요!</span>
          </div>
        </div>
      `;
    } else {
      const en = TUTORIAL_ENEMIES[st.enemyKey] || TUTORIAL_ENEMIES.H2;
      enemyBox.innerHTML = `
        <div class="modal-entity-item">
          <img src="${en.imagePath}" alt="${en.name}" width="28" height="28" />
          <div class="modal-entity-text">
            <strong>${en.name} [${en.formula}] — ${en.categoryLabel}</strong>
            <span>${en.description}</span>
          </div>
        </div>
      `;
    }

    // 2) 이번 스테이지 개방 포탑 렌더링
    const towersBox = document.getElementById("modalTowersBox");
    const unlockedIds = st.requiredTowers;
    towersBox.innerHTML = unlockedIds
      .slice(0, 4)
      .map((id) => {
        const tw = TOWER_TYPES[id];
        if (!tw) return "";
        const canReact = this.canReactWithCurrentStageEnemy(id);
        return `
          <div class="modal-entity-item">
            <img src="${tw.imagePath}" alt="${tw.name}" width="28" height="28" />
            <div class="modal-entity-text">
              <strong style="color:${tw.color}">
                🔓 [${tw.symbol}] ${tw.name} (${tw.cost}G)
                — ${canReact ? "⚡표적 반응 가능" : "🚫현재 표적 무반응(체험용)"}
              </strong>
              <span>${tw.concept}</span>
            </div>
          </div>
        `;
      })
      .join("");

    // 3) 3단계 공략
    const stepsList = document.getElementById("modalStepsList");
    stepsList.innerHTML = (st.tacticalSteps || []).map((s) => `<li>${s}</li>`).join("");

    document.getElementById("modalHistoricalText").textContent =
      `📜 화학 안전 배경지식: ${st.historicalCase || st.description}`;
    document.getElementById("modalClearTarget").textContent =
      this.mode === "tutorial" ? st.clearLabel : "방어선이 뚫릴 때까지 무제한 웨이브 돌파";
    document.getElementById("modalRewardText").textContent = st.rewardLabel;

    const newTw = TOWER_TYPES[st.newlyUnlockedTower];
    const startBtnLabel = document.getElementById("btnModalBuildStartLabel");
    if (startBtnLabel && newTw && this.mode === "tutorial") {
      startBtnLabel.textContent = `🔓 신규 개방 [${newTw.symbol} ${newTw.name.split(" (")[0]}] 화학 반응 확인 & 작전 투입`;
    } else if (startBtnLabel) {
      startBtnLabel.textContent = `작전 구역 투입 (포탑 배치 시작)`;
    }

    const btnSwitch = document.getElementById("btnModalSwitchSurvival");
    if (btnSwitch) {
      btnSwitch.style.display = this.mode === "survival" ? "none" : "inline-flex";
    }
  }

  closeBriefingModal() {
    const modal = document.getElementById("briefingModal");
    if (modal) modal.classList.add("hidden");
    this.checkAnyModalOpen();
  }

  openResultModal(isVictory) {
    const modal = document.getElementById("resultModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    this.checkAnyModalOpen();

    const st = this.currentStage;
    const statusBadge = document.getElementById("resultStatusBadge");
    const titleEl = document.getElementById("resultModalTitle");
    const descEl = document.getElementById("resultModalDesc");
    const rewardEl = document.getElementById("resultRewardBox");
    const nextBtn = document.getElementById("btnResultNextStage");

    if (isVictory) {
      if (statusBadge) statusBadge.textContent = `OPERATION SUCCESS // ${st.stageId}`;
      titleEl.style.color = "#ffc665";
      titleEl.textContent =
        st.stageId === "TUT-10"
          ? `🏆 전 튜토리얼 완벽 클리어! 10종 전 포탑 영구 개방!`
          : `🎉 ${st.stageId} 작전 완벽 클리어!`;
      descEl.textContent = `"${st.clearLabel}" 목표를 달성하여 도시와 연구소를 성공적으로 방어했습니다.`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `🎁 획득 보상: ${st.rewardLabel}  |  정화 점수: ${this.score.toLocaleString()} PTS`;
      if (nextBtn) {
        const nextSt = TUTORIAL_STAGES[(this.stageIndex + 1) % TUTORIAL_STAGES.length];
        nextBtn.style.display = "flex";
        nextBtn.innerHTML = `<span>다음 작전(${nextSt.stageId}) 진행 & 신규 포탑 개방</span><span class="material-symbols-outlined">arrow_forward</span>`;
      }
    } else {
      if (statusBadge) statusBadge.textContent = `THREAT LEVEL CRITICAL // ${st.stageId}`;
      titleEl.style.color = "#ff6b6b";
      titleEl.textContent = `🚨 ${st.stageId} 방어선 붕괴 (유출 사고)`;
      descEl.textContent = `적 분자와 화학 반응을 일으키는 개방 포탑(${st.requiredTowers.join(", ")})으로 미로 경로를 더 길게 우회시켜 다시 도전해 보세요!`;
      rewardEl.style.display = "block";
      rewardEl.textContent = `💡 팁: 무반응(🚫) 원소는 적을 공격하지 않습니다. 반드시 표적 분자와 반응(⚡)하는 원소를 배치하세요!`;
      if (nextBtn) nextBtn.style.display = "none";
    }
  }

  closeResultModal() {
    const modal = document.getElementById("resultModal");
    if (modal) modal.classList.add("hidden");
    this.checkAnyModalOpen();
  }

  recomputePaths() {
    const passableGrid = this.grid.map((row) => row.map((cell) => (cell === 0 ? 0 : 1)));
    const { dist, next } = computeFlowField(passableGrid, this.exits);
    this.flowDist = dist;
    this.flowNext = next;
    this.previewPaths = tracePreviewPaths(this.spawns, this.flowNext);
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
      hazardBadge.textContent = this.getCurrentTargetEnemyId();
    }

    if (this.mode === "tutorial") {
      titleEl.textContent = st.title;
      reqEl.textContent = this.allTutorialsCleared
        ? `🔓 마스터 해금: 10종 전 포탑 개방됨 (추천: ${st.requiredTowers.join(", ")})`
        : `🔓 현재 스테이지 개방 포탑: ${st.requiredTowers.join(", ")} (나머지 비활성)`;
      rewardEl.textContent = `보상: ${st.rewardLabel}`;
      descEl.textContent = `${st.description}`;
    } else {
      const recipeIdx = Math.max(0, this.wave - 1) % COMPOUND_RECIPES.length;
      const recipe = COMPOUND_RECIPES[recipeIdx];
      titleEl.textContent = `♾️ [${st.stageId} 서바이벌] W${Math.max(1, this.wave)} — ${recipe.displayName}(${recipe.rowName})`;
      reqEl.textContent = `반응 가능 카운터 원소: ${recipe.counter}`;
      rewardEl.textContent = `10종 전 포탑 개방 • 42종 화학재난 루프`;
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
        statusText = `H₂S 제거: ${this.objectiveProgress}/${st.clearTarget} (해독:${this.paralysisCuredCount})`;
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

  /**
   * 10종 원소 포탑 덱 렌더링 (개방/잠금 상태 + 현재 표적 분자와의 반응 가능 여부 표시)
   */
  renderPalette() {
    const container = document.getElementById("towerPalette");
    const allTowers = Object.values(TOWER_TYPES);
    const unlockedCount = allTowers.filter((t) => this.isTowerUnlocked(t.id)).length;

    const countEl = document.getElementById("deckUnlockCount");
    if (countEl) {
      countEl.textContent = `개방: ${unlockedCount} / ${allTowers.length}`;
    }

    const entries = allTowers.filter((t) => {
      if (this.paletteFilter === "unlocked") return this.isTowerUnlocked(t.id);
      if (this.paletteFilter === "reactive") return this.canReactWithCurrentStageEnemy(t.id);
      return true;
    });

    const curEnemyId = this.getCurrentTargetEnemyId();

    container.innerHTML = entries
      .map((t) => {
        const isUnlocked = this.isTowerUnlocked(t.id);
        const isActive = isUnlocked && this.selectedBuildType === t.id;
        const canReact = this.canReactWithCurrentStageEnemy(t.id);
        const shortName = t.name.split(" (")[0];

        let statusPill = "";
        if (!isUnlocked) {
          statusPill = `<span class="react-pill locked-pill">🔒 ${t.unlockStageId} 개방</span>`;
        } else if (canReact) {
          statusPill = `<span class="react-pill can-react">⚡ ${curEnemyId} 반응</span>`;
        } else {
          statusPill = `<span class="react-pill no-react">🚫 ${curEnemyId} 무반응</span>`;
        }

        return `
          <div class="element-card ${isActive ? "active" : ""} ${!isUnlocked ? "locked" : ""}"
               style="--el-color: ${t.color}"
               data-id="${t.id}">
            <div class="el-left">
              <div class="el-icon-box">
                <img src="${t.imagePath}" alt="${t.name}" width="24" height="24" class="el-thumb" />
                <span class="el-atomic-tag">${t.atomicNumber}</span>
              </div>
              <div class="el-text-col">
                <div class="el-title-line">
                  <span class="el-symbol-badge">[${t.symbol}]</span>
                  <span class="el-name">${shortName}</span>
                </div>
                <div class="el-react-line">
                  ${statusPill}
                </div>
              </div>
            </div>
            <div class="el-right">
              <span class="el-cost">${t.cost}G</span>
              ${
                isUnlocked
                  ? `<button type="button" class="el-info-btn" data-info-id="${t.id}" title="원소 화학 반응식 및 표적 분자 보기">🔬</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    // 🔬 반응식 상세 팝업 버튼 이벤트
    container.querySelectorAll(".el-info-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.sound.play("uiClick");
        this.openTowerUnlockModal(btn.dataset.infoId, false);
      });
    });

    // 카드 클릭(선택) 이벤트
    container.querySelectorAll(".element-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const spec = TOWER_TYPES[id];
        if (!this.isTowerUnlocked(id)) {
          this.sound.play("uiClick");
          this.addLog(
            `🔒 [${spec.symbol} ${spec.name}] 포탑은 현재 비활성화 상태입니다. (${spec.unlockStageId}에서 개방되며, 전 튜토리얼 완료 시 10종 모두 개방됩니다!)`
          );
          return;
        }
        this.sound.play("uiClick");
        this.selectedBuildType = id;
        this.selectedTower = null;
        this.renderPalette();
        this.renderInspector();
      });
    });
  }

  /**
   * 캔버스 하단 포탑 인스펙터 바 렌더링
   */
  renderInspector() {
    const box = document.getElementById("inspectorContent");
    if (!box) return;

    const curEnemyId = this.getCurrentTargetEnemyId();

    // 1) 이미 설치된 타워를 선택한 경우
    if (this.selectedTower) {
      const t = this.selectedTower;
      const spec = TOWER_TYPES[t.typeId];
      const upgCost = Math.floor(spec.cost * 0.85 * t.level);
      const sellRefund = Math.floor(t.totalInvested * 0.75);
      const canReact = this.canReactWithCurrentStageEnemy(spec.id);
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
              <span class="badge-oxy" style="color:${canReact ? "#34d399" : "#ff6b6b"}">
                ${canReact ? `⚡${curEnemyId} 반응 공격 가능` : `🚫${curEnemyId} 무반응(공격 안 함)`}
              </span>
              ${t.boostedByO ? `<span class="badge-oxy">O₂ 가속중</span>` : ""}
              ${t.paralyzedTimer > 0 ? `<span class="badge-oxy" style="color:#ff6b6b">⚡마비됨</span>` : ""}
            </div>
            <div class="inspector-sub"><strong>반응 분자:</strong> ${spec.reactiveMolecules.slice(0, 8).join(", ")} 등</div>
          </div>
        </div>

        <div class="inspector-stats-pills">
          <div class="stat-pill"><span>DMG</span><strong>${Math.round(t.getEffectiveDamage())}</strong></div>
          <div class="stat-pill"><span>RNG</span><strong>${Math.round(t.getEffectiveRange())}px</strong></div>
          <div class="stat-pill"><span>SPD</span><strong>${t.getEffectiveFireRate().toFixed(1)}/s</strong></div>
          <div class="stat-pill"><span>HP</span><strong>${Math.ceil(t.hp)}/${t.maxHp}</strong></div>
        </div>

        <div class="inspector-actions">
          <button id="btnInspectorReactionInfo" class="action-btn info-btn" type="button">
            <span>🔬 반응식 상세</span>
          </button>
          <button id="btnUpgradeTower" class="action-btn upg-btn" ${
            this.gold < upgCost || t.level >= 5 ? "disabled" : ""
          }>
            <img src="./icon/ui_upgrade.png" alt="" width="14" height="14" class="btn-icon" />
            <span>${t.level >= 5 ? "MAX" : `↑ 강화 (${upgCost}G)`}</span>
          </button>
          <button id="btnSellTower" class="action-btn sell-btn">
            <span>🗑️ 해체 (+${sellRefund}G)</span>
          </button>
        </div>
      `;

      document.getElementById("btnInspectorReactionInfo")?.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.openTowerUnlockModal(spec.id, false);
      });
      document.getElementById("btnUpgradeTower")?.addEventListener("click", () =>
        this.upgradeSelectedTower()
      );
      document.getElementById("btnSellTower")?.addEventListener("click", () =>
        this.sellSelectedTower()
      );
      return;
    }

    // 2) 팔레트에서 건설할 원소를 선택 중인 경우
    if (this.selectedBuildType && TOWER_TYPES[this.selectedBuildType]) {
      const spec = TOWER_TYPES[this.selectedBuildType];
      const canReact = this.canReactWithCurrentStageEnemy(spec.id);
      box.innerHTML = `
        <div class="inspector-left">
          <div class="inspector-thumb-box">
            <img src="${spec.imagePath}" alt="${spec.name}" width="34" height="34" class="inspector-preview-img" />
          </div>
          <div class="inspector-info">
            <div class="inspector-title-row">
              <span class="inspector-title" style="color:${spec.color}">[${spec.symbol}] ${spec.name}</span>
              <span class="badge-lvl">${spec.cost}G</span>
              <span class="badge-oxy" style="color:${canReact ? "#34d399" : "#ff6b6b"}">
                ${canReact ? `⚡현재 표적(${curEnemyId}) 반응 가능` : `🚫현재 표적(${curEnemyId}) 무반응 (공격하지 않음!)`}
              </span>
            </div>
            <div class="inspector-sub"><strong>반응 가능 분자:</strong> ${spec.reactiveMolecules.slice(0, 9).join(", ")}</div>
          </div>
        </div>

        <div class="inspector-stats-pills">
          <div class="stat-pill"><span>COST</span><strong style="color:#ffc665">${spec.cost}G</strong></div>
          <div class="stat-pill"><span>DMG</span><strong>${spec.damage}</strong></div>
          <div class="stat-pill"><span>RNG</span><strong>${spec.range}px</strong></div>
          <div class="stat-pill"><span>PRODUCT</span><strong style="color:#00e4fe">${spec.Produces}</strong></div>
        </div>

        <div class="inspector-actions">
          <button id="btnBuildReactionInfo" class="action-btn info-btn" type="button">
            <span>🔬 화학 반응 & 표적 보기</span>
          </button>
        </div>
      `;

      document.getElementById("btnBuildReactionInfo")?.addEventListener("click", () => {
        this.sound.play("uiClick");
        this.openTowerUnlockModal(spec.id, false);
      });
      return;
    }

    box.innerHTML = `
      <div class="inspector-left">
        <div class="inspector-info">
          <div class="inspector-title-row">
            <span class="inspector-title" style="color:#ffc665">TACTICAL INSPECTOR // 10원소 포탑 제어반</span>
          </div>
          <div class="inspector-sub">우측 덱에서 개방된 원소 포탑을 선택해 배치하세요. (전혀 반응이 일어나지 않는 원소는 적 분자를 공격하지 않습니다!)</div>
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
    if (!this.isTowerUnlocked(this.selectedBuildType)) {
      this.addFloatingText(
        c * GRID_CONFIG.tileSize + 19,
        r * GRID_CONFIG.tileSize + 19,
        "🔒 미개방 포탑!",
        "#ff6b6b"
      );
      return;
    }

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

    const maxHp = spec.highDurability ? 280 : 130;
    const newTower = {
      c,
      r,
      x: c * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2,
      y: r * GRID_CONFIG.tileSize + GRID_CONFIG.tileSize / 2,
      typeId: spec.id,
      level: 1,
      totalInvested: spec.cost,
      cooldown: 0,
      noReactNoticeCooldown: 0,
      hp: maxHp,
      maxHp,
      boostedByO: false,
      protectedFromAcid: spec.corrosionImmune || false,
      paralyzedTimer: 0,
      getEffectiveDamage() {
        let dmg = spec.damage * (1 + (this.level - 1) * 0.38);
        if (this.boostedByO) dmg *= 1.35;
        return dmg;
      },
      getEffectiveRange() {
        return spec.range * (1 + (this.level - 1) * 0.08);
      },
      getEffectiveFireRate() {
        let rate = spec.fireRate * (1 + (this.level - 1) * 0.15);
        if (this.boostedByO) rate *= 1.25;
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
    t.maxHp += 45;
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

      this.addLog(
        `📜 [역사적 화학재난 W${this.wave}] ${recipe.displayName}(${recipe.rowName}) 출현! 반응 카운터: [${recipe.counter}]`
      );
    }

    this.updateStageBanner();
    this.updateHUD();
    this.renderPalette();
    this.renderInspector();
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
          this.renderPalette();
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

    // 1. 타워 오라(산소 O 마비 해독 & 가속, 칼슘 Ca 부식 면역 보호막) 계산
    for (const t of this.towers) {
      t.boostedByO = false;
      t.protectedFromAcid = TOWER_TYPES[t.typeId].corrosionImmune || false;
      if (t.noReactNoticeCooldown > 0) t.noReactNoticeCooldown -= dt;
    }

    for (const source of this.towers) {
      const spec = TOWER_TYPES[source.typeId];
      if (source.typeId === "O") {
        for (const target of this.towers) {
          const d = Math.hypot(target.x - source.x, target.y - source.y);
          if (d <= (spec.auraRange || 130)) {
            if (target !== source) target.boostedByO = true;
            if (target.paralyzedTimer > 0) {
              target.paralyzedTimer = 0;
              this.paralysisCuredCount += 1;
              this.addFloatingText(target.x, target.y - 12, "O₂ 마비 해독!", "#00e4fe");
            }
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
              this.addLog("💥 [포탑 부식 붕괴] 불산/황산에 의해 포탑이 손상되었습니다! 칼슘(Ca) 방벽을 배치해 보호하세요.");
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

    // 3. 타워 공격 처리 (핵심: 화학 반응이 일어나지 않는 적 분자는 절대 공격하지 않음!)
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

      // 사거리 내 모든 적 확인
      const inRangeEnemies = this.enemies.filter((e) => {
        if (e.isStealth && e.revealedTimer <= 0 && !spec.revealsStealth) return false;
        return Math.hypot(e.x - t.x, e.y - t.y) <= range;
      });

      if (inRangeEnemies.length === 0) continue;

      // 화학 반응이 가능한 적 분자만 필터링!
      const reactiveCandidates = inRangeEnemies.filter((e) => canTowerReactWithEnemy(spec, e));

      if (reactiveCandidates.length === 0) {
        // 사거리 안에 적이 있지만 화학적으로 전혀 반응하지 않는 분자일 경우: 공격하지 않고 무반응 알림 표시
        if (t.noReactNoticeCooldown <= 0) {
          t.noReactNoticeCooldown = 3.2;
          const nonReactEnemy = inRangeEnemies[0];
          this.addFloatingText(
            t.x,
            t.y - 14,
            `🚫 ${spec.symbol}+${nonReactEnemy.id} 무반응`,
            "#94a3b8"
          );
        }
        continue;
      }

      t.cooldown = 1 / t.getEffectiveFireRate();
      this.sound.play(spec.soundKey || "hitNeutralize", 0.22, 150);

      // 오라/클라우드 형태 타워 (염소 Cl)
      if (spec.isAuraCloud) {
        this.spawnParticles(t.x, t.y, spec.color, 8);
        for (const target of reactiveCandidates) {
          if (spec.revealsStealth) target.revealedTimer = 4.0;
          this.applyDamageToEnemy(target, t.getEffectiveDamage(), t);
        }
        continue;
      }

      // 일반/스플래시 투사체 발사 (반응 가능한 첫 번째 표적 조준)
      const primary = reactiveCandidates[0];
      this.projectiles.push({
        x: t.x,
        y: t.y,
        target: primary,
        speed: 370,
        color: spec.projectileColor,
        damage: t.getEffectiveDamage(),
        sourceTower: t
      });
    }

    // 4. 투사체 충돌 처리 (스플래시 범위 내에서도 반응 가능한 분자만 피해 적용!)
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
            if (
              Math.hypot(e.x - p.target.x, e.y - p.target.y) <= spec.splashRadius &&
              canTowerReactWithEnemy(spec, e)
            ) {
              this.applyDamageToEnemy(e, p.damage, tower);
            }
          }
        } else if (canTowerReactWithEnemy(spec, p.target)) {
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
    if (spec && !canTowerReactWithEnemy(spec, enemy)) return; // 무반응 안전장치

    let finalDamage = baseDamage;

    if (spec) {
      enemy.hitByElements.add(spec.id);

      // 분자별 특화 화학 반응 시너지 배율
      if (enemy.id === "H2" && spec.id === "O") finalDamage *= 2.2;
      if (enemy.id === "H2" && spec.id === "N") finalDamage *= 2.0;
      if (enemy.id === "Cl2" && spec.id === "Na") finalDamage *= 2.4;
      if (enemy.id === "HCl" && spec.id === "Na") finalDamage *= 2.2;
      if (enemy.id === "HF" && spec.id === "Ca") finalDamage *= 2.6;
      if (enemy.id === "H2S" && (spec.id === "O" || spec.id === "S")) finalDamage *= 2.3;
      if (enemy.id === "CO" && (spec.id === "O" || spec.id === "C")) {
        finalDamage *= enemy.hitByElements.has("C") && spec.id === "O" ? 2.6 : 1.9;
      }
      if (enemy.id === "H2SO4" && ["Ca", "Na", "O", "Fe"].includes(spec.id)) {
        finalDamage *= 1.45 + enemy.hitByElements.size * 0.35;
      }
      if (enemy.id === "COCl2" && ["C", "O", "Cl", "Cs"].includes(spec.id)) {
        finalDamage *= 1.45 + enemy.hitByElements.size * 0.32;
      }

      if (spec.slowFactor) {
        enemy.slowFactor = Math.max(enemy.slowFactor, spec.slowFactor);
        enemy.slowTimer = Math.max(enemy.slowTimer, spec.slowDuration || 2.0);
      }

      if (spec.pullStrength) {
        const angle = Math.atan2(tower.y - enemy.y, tower.x - enemy.x);
        enemy.x += Math.cos(angle) * 5;
        enemy.y += Math.sin(angle) * 5;
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
        this.gasConcentration = Math.max(0, this.gasConcentration - 1.2);
      }

      if (spec.neutralizesAcid && this.currentPh < 7.0) {
        this.currentPh = Math.min(7.0, this.currentPh + 0.09);
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

    this.sound.play("enemyDissolve", 0.18, 190);
    this.spawnParticles(enemy.x, enemy.y, enemy.color, 14);

    const spec = killerTower ? TOWER_TYPES[killerTower.typeId] : null;
    let reactionBadge =
      spec?.reactionBadges?.[enemy.id] ||
      (spec ? `⚗️ [${spec.symbol}] → ${spec.Produces} 중화!` : `+${enemy.reward}G 중화!`);

    if (enemy.id === "HCl") {
      this.currentPh = Math.min(7.0, this.currentPh + 0.25);
      reactionBadge = `🧪 NaCl 중화 (pH ${this.currentPh.toFixed(1)})`;
    }

    this.addFloatingText(enemy.x, enemy.y, reactionBadge, "#ffc665");

    if (this.gasConcentration > 0) {
      this.gasConcentration = Math.max(0, this.gasConcentration - 4.0);
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

    // TUT-10을 클리어하면 모든 튜토리얼이 완료되어 전 스테이지 10종 타워가 영구 개방됨!
    if (st.stageId === "TUT-10" || this.clearedStages.size >= TUTORIAL_STAGES.length) {
      this.allTutorialsCleared = true;
    }

    this.renderSectorDock();
    this.renderPalette();
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

    for (const t of this.towers) {
      const spec = TOWER_TYPES[t.typeId];
      const x = t.c * tileSize;
      const y = t.r * tileSize;

      if (t.boostedByO || t.protectedFromAcid) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, tileSize * 0.46, 0, Math.PI * 2);
        ctx.fillStyle = t.boostedByO
          ? "rgba(0, 228, 254, 0.2)"
          : "rgba(244, 114, 182, 0.16)";
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

    if (this.hoverTile && this.selectedBuildType && this.isTowerUnlocked(this.selectedBuildType)) {
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

    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

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
