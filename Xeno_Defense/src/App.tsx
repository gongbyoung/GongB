/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  Shield, 
  Zap, 
  Target, 
  Skull, 
  Coins, 
  Play, 
  Pause, 
  RotateCcw,
  Info,
  ChevronRight,
  LayoutGrid,
  Shield as TowerIcon,
  LayoutGrid as WallIcon,
  Crosshair,
  Map as MapIcon,
  Image as ImageIcon,
  Loader2,
  X
} from 'lucide-react';
import { aStar, Point } from './game/AStar';

// --- Types & Constants ---
const APP_VERSION = '1.0.2';
type TowerType = 'BASIC' | 'SNIPER' | 'SPLASH' | 'MACHINE_GUN' | 'LASER' | 'POISON' | 'ELECTRIC' | 'ROCKET' | 'ANTI_AIR';
type MapType = 'CLASSIC' | 'FIELDRUNNER' | 'ELITE';

interface MapConfig {
  id: MapType;
  name: string;
  width: number;
  height: number;
  cellSize: number;
  start: Point;
  end: Point;
}

const MAPS: Record<MapType, MapConfig> = {
  CLASSIC: {
    id: 'CLASSIC',
    name: 'Classic 20x20',
    width: 20,
    height: 20,
    cellSize: 30,
    start: { x: 0, y: 9 },
    end: { x: 19, y: 9 },
  },
  FIELDRUNNER: {
    id: 'FIELDRUNNER',
    name: 'Fieldrunner 24x16',
    width: 24,
    height: 16,
    cellSize: 28,
    start: { x: 0, y: 7 },
    end: { x: 23, y: 7 },
  },
  ELITE: {
    id: 'ELITE',
    name: 'Xenotactic 32x32',
    width: 32,
    height: 32,
    cellSize: 20,
    start: { x: 0, y: 15 },
    end: { x: 31, y: 15 },
  }
};

interface Tower {
  x: number;
  y: number;
  type: TowerType;
  level: number;
  cooldown: number;
  lastShot: number;
  angle: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  pathIndex: number;
  path: Point[];
  reward: number;
  type: string;
  isAir: boolean;
}

interface SaveSlot {
  id: number;
  data: any | null;
  date: string | null;
}

interface Projectile {
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  type: TowerType;
}

const TOWER_DATA: Record<TowerType, { 
  cost: number, 
  range: number, 
  damage: number, 
  fireRate: number, 
  color: string,
  label: string,
  spriteUrl: string | null,
  targets: string[]
}> = {
  BASIC: { cost: 10, range: 3, damage: 10, fireRate: 1000, color: '#4ade80', label: 'Basic', spriteUrl: null, targets: ['GROUND'] },
  SNIPER: { cost: 25, range: 7, damage: 40, fireRate: 2500, color: '#60a5fa', label: 'Sniper', spriteUrl: null, targets: ['GROUND', 'AIR'] },
  SPLASH: { cost: 40, range: 2.5, damage: 15, fireRate: 1500, color: '#f472b6', label: 'Splash', spriteUrl: null, targets: ['GROUND'] },
  MACHINE_GUN: { cost: 20, range: 3.5, damage: 4, fireRate: 150, color: '#fbbf24', label: 'Machine Gun', spriteUrl: null, targets: ['GROUND', 'AIR'] },
  LASER: { cost: 60, range: 4, damage: 2, fireRate: 50, color: '#ef4444', label: 'Laser', spriteUrl: null, targets: ['GROUND', 'AIR'] },
  POISON: { cost: 35, range: 3, damage: 5, fireRate: 1200, color: '#a855f7', label: 'Poison', spriteUrl: null, targets: ['GROUND'] },
  ELECTRIC: { cost: 50, range: 3.5, damage: 12, fireRate: 1000, color: '#06b6d4', label: 'Electric', spriteUrl: null, targets: ['GROUND', 'AIR'] },
  ROCKET: { cost: 75, range: 6, damage: 50, fireRate: 3000, color: '#f97316', label: 'Rocket', spriteUrl: null, targets: ['GROUND', 'AIR'] },
  ANTI_AIR: { cost: 30, range: 5, damage: 25, fireRate: 1200, color: '#818cf8', label: 'Anti-Air', spriteUrl: null, targets: ['AIR'] },
};

const ENEMY_TYPES = [
  { name: 'SCOUT', healthMult: 0.8, speed: 1.2, reward: 4, color: '#ef4444', isAir: false },
  { name: 'TANK', healthMult: 2.5, speed: 0.6, reward: 8, color: '#991b1b', isAir: false },
  { name: 'SWIFT', healthMult: 0.6, speed: 1.8, reward: 5, color: '#f87171', isAir: false },
  { name: 'PLANE', healthMult: 1.0, speed: 1.0, reward: 10, color: '#60a5fa', isAir: true },
];

class Particle {
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;

  constructor(x: number, y: number, color: string, speed: number, angle: number, life: number, size: number) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.vx *= 0.95;
    this.vy *= 0.95;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export default function App() {
  // --- State ---
  const [currentMap, setCurrentMap] = useState<MapConfig>(MAPS.CLASSIC);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [money, setMoney] = useState(100);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [selectedTowerType, setSelectedTowerType] = useState<TowerType>('BASIC');
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isGeneratingSprites, setIsGeneratingSprites] = useState(false);
  const [combatHistory, setCombatHistory] = useState<{wave: number, date: string}[]>([]);
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([
    { id: 1, data: null, date: null },
    { id: 2, data: null, date: null },
    { id: 3, data: null, date: null }
  ]);
  const [autoWaveCountdown, setAutoWaveCountdown] = useState<number | null>(null);
  const [selectedTowerIndex, setSelectedTowerIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const enemyIdCounter = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const towerImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Preload images
  useEffect(() => {
    Object.entries(TOWER_DATA).forEach(([type, data]) => {
      if (data.spriteUrl) {
        const img = new Image();
        img.src = data.spriteUrl;
        towerImagesRef.current[type] = img;
      }
    });
  }, []);

  const createExplosion = useCallback((x: number, y: number, color: string, count = 10, size = 3) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(
        new Particle(x, y, color, Math.random() * 3 + 1, Math.random() * Math.PI * 2, 30 + Math.random() * 20, Math.random() * size + 1)
      );
    }
  }, []);

  const createMuzzleFlash = useCallback((x: number, y: number, color: string) => {
    createExplosion(x, y, '#fff', 5, 2);
    createExplosion(x, y, color, 3, 1);
  }, [createExplosion]);

  const generateSprites = useCallback(async () => {
    if (isGeneratingSprites) return;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found in environment.");
      return;
    }

    setIsGeneratingSprites(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const types: TowerType[] = ['BASIC', 'SNIPER', 'SPLASH', 'MACHINE_GUN', 'LASER', 'POISON', 'ELECTRIC', 'ROCKET', 'ANTI_AIR'];
      const prompts: Record<TowerType, string> = {
        BASIC: "Top-down view of a futuristic military green turret tower for a grid-based defense game, clean vector art, isolated on a solid black background, sci-fi style, high detail, 256x256. Xenotactic style.",
        SNIPER: "Top-down view of a futuristic blue sniper tower with a long thin barrel for a grid-based defense game, clean vector art, isolated on a solid black background, high-tech sci-fi style, 256x256. Xenotactic style.",
        SPLASH: "Top-down view of a futuristic pink missile launcher tower for a grid-based defense game, clean vector art, isolated on a solid black background, heavy artillery sci-fi style, 256x256. Xenotactic style.",
        MACHINE_GUN: "Top-down view of a futuristic yellow quad-barrel machine gun tower for a grid-based defense game, clean vector art, isolated on a solid black background, rapid fire sci-fi style, 256x256. Xenotactic style.",
        LASER: "Top-down view of a futuristic red laser emitter tower with a glowing crystal core for a grid-based defense game, clean vector art, isolated on a solid black background, energy weapon sci-fi style, 256x256. Xenotactic style.",
        POISON: "Top-down view of a futuristic purple toxic gas sprayer tower with green glowing pipes for a grid-based defense game, clean vector art, isolated on a solid black background, chemical weapon sci-fi style, 256x256. Xenotactic style.",
        ELECTRIC: "Top-down view of a futuristic cyan tesla coil tower with electric arcs for a grid-based defense game, clean vector art, isolated on a solid black background, electrical weapon sci-fi style, 256x256. Xenotactic style.",
        ROCKET: "Top-down view of a futuristic orange heavy rocket battery tower for a grid-based defense game, clean vector art, isolated on a solid black background, massive artillery sci-fi style, 256x256. Xenotactic style.",
        ANTI_AIR: "Top-down view of a futuristic indigo anti-aircraft flak cannon tower for a grid-based defense game, clean vector art, isolated on a solid black background, specialized anti-air sci-fi style, 256x256. Xenotactic style."
      };

      for (const type of types) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompts[type] }] },
          config: { imageConfig: { aspectRatio: "1:1" } },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const dataUrl = `data:image/png;base64,${part.inlineData.data}`;
            const img = new Image();
            img.src = dataUrl;
            towerImagesRef.current[type] = img;
            localStorage.setItem(`xenotactic_sprite_${type}`, dataUrl);
          }
        }
      }
    } catch (error) {
      console.error("Error generating sprites:", error);
    } finally {
      setIsGeneratingSprites(false);
    }
  }, [isGeneratingSprites]);

  // Load cached sprites or generate if missing
  useEffect(() => {
    const types: TowerType[] = ['BASIC', 'SNIPER', 'SPLASH', 'MACHINE_GUN', 'LASER', 'POISON', 'ELECTRIC', 'ROCKET'];
    let missing = false;
    types.forEach(type => {
      const cached = localStorage.getItem(`xenotactic_sprite_${type}`);
      if (cached) {
        const img = new Image();
        img.src = cached;
        towerImagesRef.current[type] = img;
      } else {
        missing = true;
      }
    });

    if (missing && process.env.GEMINI_API_KEY) {
      generateSprites();
    }
  }, [generateSprites]);

  // --- Save/Load Logic ---
  const updateSaveSlotsMetadata = useCallback(() => {
    const newSlots = [1, 2, 3].map(id => {
      const saved = localStorage.getItem(`xenotactic_save_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { id, data: parsed, date: parsed.saveDate || 'Unknown' };
      }
      return { id, data: null, date: null };
    });
    setSaveSlots(newSlots);

    const history = localStorage.getItem('xenotactic_history');
    if (history) {
      setCombatHistory(JSON.parse(history));
    }
  }, []);

  const addToHistory = useCallback((finalWave: number) => {
    const history = JSON.parse(localStorage.getItem('xenotactic_history') || '[]');
    history.unshift({ wave: finalWave, date: new Date().toLocaleString() });
    const trimmed = history.slice(0, 10);
    localStorage.setItem('xenotactic_history', JSON.stringify(trimmed));
    setCombatHistory(trimmed);
  }, []);

  useEffect(() => {
    updateSaveSlotsMetadata();
  }, [updateSaveSlotsMetadata]);

  const saveGame = (slotId: number) => {
    const gameState = {
      money,
      lives,
      wave,
      towers,
      grid,
      currentMapId: currentMap.id,
      saveDate: new Date().toLocaleString()
    };
    localStorage.setItem(`xenotactic_save_${slotId}`, JSON.stringify(gameState));
    updateSaveSlotsMetadata();
    // Show a brief notification or effect?
  };

  const loadGame = (slotId: number) => {
    const saved = localStorage.getItem(`xenotactic_save_${slotId}`);
    if (!saved) return;
    const state = JSON.parse(saved);
    
    setMoney(state.money);
    setLives(state.lives);
    setWave(state.wave);
    setTowers(state.towers);
    setGrid(state.grid);
    const map = MAPS[state.currentMapId as MapType] || MAPS.CLASSIC;
    setCurrentMap(map);
    
    const path = aStar(map.start, map.end, state.grid, map.width, map.height);
    if (path) setCurrentPath(path);
    
    setEnemies([]);
    setProjectiles([]);
    setIsPaused(true);
    setGameOver(false);
  };

  // --- Initialization ---
  const initMap = useCallback((map: MapConfig) => {
    const newGrid = Array.from({ length: map.height }, () => Array(map.width).fill(false));
    setGrid(newGrid);
    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    particlesRef.current = [];
    setMoney(100);
    setLives(20);
    setWave(0);
    setIsPaused(true);
    setGameOver(false);
    enemyIdCounter.current = 0;
    
    const path = aStar(map.start, map.end, newGrid, map.width, map.height);
    if (path) setCurrentPath(path);
  }, []);

  useEffect(() => {
    initMap(currentMap);
  }, [currentMap, initMap]);

  // --- Logic ---

  const placeTower = (x: number, y: number) => {
    if (gameOver) return;
    if (x === currentMap.start.x && y === currentMap.start.y) return;
    if (x === currentMap.end.x && y === currentMap.end.y) return;
    if (grid[y][x]) return;

    const cost = TOWER_DATA[selectedTowerType].cost;
    if (money < cost) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[y][x] = true;
    const path = aStar(currentMap.start, currentMap.end, newGrid, currentMap.width, currentMap.height);

    if (!path) return; // Blocked

    setGrid(newGrid);
    setTowers(prev => [...prev, { x, y, type: selectedTowerType, level: 1, cooldown: 0, lastShot: 0, angle: 0 }]);
    setMoney(prev => prev - cost);
    setCurrentPath(path);
    
    // Effect
    createExplosion((x + 0.5) * currentMap.cellSize, (y + 0.5) * currentMap.cellSize, '#fff', 15, 2);
    
    setEnemies(prev => prev.map(enemy => {
      const ex = Math.floor(enemy.x);
      const ey = Math.floor(enemy.y);
      // Ensure enemy is inside grid for A*
      const safeEx = Math.max(0, Math.min(currentMap.width - 1, ex));
      const safeEy = Math.max(0, Math.min(currentMap.height - 1, ey));
      const newEnemyPath = aStar({ x: safeEx, y: safeEy }, currentMap.end, newGrid, currentMap.width, currentMap.height);
      return { ...enemy, path: newEnemyPath || enemy.path, pathIndex: 0 };
    }));

    // Auto-select the newly placed tower
    setSelectedTowerIndex(towers.length);
  };

  const sellTower = (index: number) => {
    const tower = towers[index];
    if (!tower) return;
    const data = TOWER_DATA[tower.type];
    // Refund 70% of base cost + 70% of upgrade costs
    const totalInvestment = data.cost + (tower.level - 1) * (data.cost * 0.8);
    const refund = Math.floor(totalInvestment * 0.7);
    
    setMoney(prev => prev + refund);
    setTowers(prev => prev.filter((_, i) => i !== index));
    
    const newGrid = grid.map(row => [...row]);
    newGrid[tower.y][tower.x] = false;
    setGrid(newGrid);
    
    // Recalculate path
    const path = aStar(currentMap.start, currentMap.end, newGrid, currentMap.width, currentMap.height);
    if (path) setCurrentPath(path);
    
    setSelectedTowerIndex(null);
    createExplosion((tower.x + 0.5) * currentMap.cellSize, (tower.y + 0.5) * currentMap.cellSize, '#facc15', 15, 2);
  };

  const startWave = () => {
    if (gameOver) return;
    setWave(prev => prev + 1);
    setIsPaused(false);
    setAutoWaveCountdown(null);
    
    const enemyCount = 5 + wave * 2;
    const baseHealth = 20 + wave * 15;
    const baseSpeed = 0.02 + Math.min(wave * 0.005, 0.05);

    for (let i = 0; i < enemyCount; i++) {
      setTimeout(() => {
        const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
        const health = baseHealth * type.healthMult;
        setEnemies(prev => [
          ...prev,
          {
            id: enemyIdCounter.current++,
            x: currentMap.start.x - 1, 
            y: currentMap.start.y,
            health,
            maxHealth: health,
            speed: baseSpeed * type.speed,
            pathIndex: 0,
            path: type.isAir ? [] : currentPath,
            reward: Math.floor(type.reward * (1 + wave * 0.1)),
            type: type.name,
            isAir: type.isAir
          }
        ]);
      }, i * 800);
    }
  };

  // Auto-wave effect
  useEffect(() => {
    if (!isPaused && !gameOver && enemies.length === 0 && wave > 0) {
      if (autoWaveCountdown === null) {
        setAutoWaveCountdown(10);
      } else if (autoWaveCountdown > 0) {
        const timer = setTimeout(() => setAutoWaveCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
        return () => clearTimeout(timer);
      } else {
        startWave();
      }
    }
  }, [enemies.length, isPaused, gameOver, autoWaveCountdown, wave, startWave]);

  const gameLoop = (time: number) => {
    if (isPaused || gameOver) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Update Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.update();
      return p.life > 0;
    });

    setEnemies(prev => {
      const next = prev.map(enemy => {
        // If outside (spawning), move towards start point
        if (enemy.x < 0) {
          return { ...enemy, x: enemy.x + enemy.speed };
        }

        if (enemy.pathIndex >= enemy.path.length) {
          // Move towards "outside" exit
          if (enemy.x < currentMap.width) {
             return { ...enemy, x: enemy.x + enemy.speed };
          }
          return enemy;
        }
        
        const target = enemy.path[enemy.pathIndex];
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < enemy.speed) {
          return { ...enemy, x: target.x, y: target.y, pathIndex: enemy.pathIndex + 1 };
        } else {
          const vx = (dx / dist) * enemy.speed;
          const vy = (dy / dist) * enemy.speed;
          return { ...enemy, x: enemy.x + vx, y: enemy.y + vy };
        }
      }).filter(enemy => {
        if (enemy.x >= currentMap.width) {
          setLives(l => {
            if (l <= 1) {
              setGameOver(true);
              addToHistory(wave);
            }
            return Math.max(0, l - 1);
          });
          return false;
        }
        return enemy.health > 0;
      });
      return next;
    });

    setTowers(prev => {
      const updatedTowers = [...prev];
      setEnemies(currentEnemies => {
        updatedTowers.forEach(tower => {
          const data = TOWER_DATA[tower.type];
          const range = data.range * (1 + (tower.level - 1) * 0.1);
          const damage = data.damage * (1 + (tower.level - 1) * 0.4);

          if (time - tower.lastShot > data.fireRate) {
            const target = currentEnemies.find(e => {
              const dist = Math.sqrt(Math.pow(e.x - tower.x, 2) + Math.pow(e.y - tower.y, 2));
              const canTarget = data.targets.includes(e.isAir ? 'AIR' : 'GROUND');
              return dist <= range && canTarget;
            });

            if (target) {
              tower.lastShot = time;
              // Update angle to face target
              tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
              
              if (tower.type === 'LASER') {
                target.health -= damage;
                createExplosion((target.x + 0.5) * currentMap.cellSize, (target.y + 0.5) * currentMap.cellSize, data.color, 2, 1);
              } else if (tower.type === 'ELECTRIC') {
                target.health -= damage;
                createExplosion((target.x + 0.5) * currentMap.cellSize, (target.y + 0.5) * currentMap.cellSize, data.color, 5, 2);
                currentEnemies.forEach(e => {
                  if (e.id !== target.id) {
                    const dist = Math.sqrt(Math.pow(e.x - target.x, 2) + Math.pow(e.y - target.y, 2));
                    if (dist < 2) {
                      e.health -= damage * 0.5;
                      createExplosion((e.x + 0.5) * currentMap.cellSize, (e.y + 0.5) * currentMap.cellSize, data.color, 3, 1);
                    }
                  }
                });
              } else {
                setProjectiles(p => [...p, {
                  x: tower.x + 0.5,
                  y: tower.y + 0.5,
                  targetId: target.id,
                  speed: tower.type === 'SNIPER' ? 0.6 : 0.3,
                  damage: damage,
                  type: tower.type
                }]);
                createMuzzleFlash((tower.x + 0.5) * currentMap.cellSize, (tower.y + 0.5) * currentMap.cellSize, data.color);
              }
            }
          }
        });
        return currentEnemies;
      });
      return updatedTowers;
    });

    setProjectiles(prev => {
      const next: Projectile[] = [];
      prev.forEach(p => {
        setEnemies(currentEnemies => {
          const target = currentEnemies.find(e => e.id === p.targetId);
          if (!target) return currentEnemies;

          const dx = target.x + 0.5 - p.x;
          const dy = target.y + 0.5 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Trail
          particlesRef.current.push(new Particle(p.x * currentMap.cellSize, p.y * currentMap.cellSize, '#fbbf24', 0.5, Math.random() * Math.PI * 2, 10, 2));

          if (dist < p.speed * 2) {
            const hitX = (target.x + 0.5) * currentMap.cellSize;
            const hitY = (target.y + 0.5) * currentMap.cellSize;
            createExplosion(hitX, hitY, TOWER_DATA[p.type].color, 5, 2);

            if (p.type === 'SPLASH' || p.type === 'ROCKET') {
              const splashRange = p.type === 'ROCKET' ? 2.5 : 1.5;
              createExplosion(hitX, hitY, TOWER_DATA[p.type].color, p.type === 'ROCKET' ? 30 : 20, p.type === 'ROCKET' ? 6 : 4);
              currentEnemies.forEach(e => {
                const splashDist = Math.sqrt(Math.pow(e.x - target.x, 2) + Math.pow(e.y - target.y, 2));
                if (splashDist < splashRange) {
                  e.health -= p.damage;
                  if (p.type === 'POISON') {
                    e.speed *= 0.8; // Slow down
                  }
                  if (e.health <= 0 && e.health + p.damage > 0) {
                    setMoney(m => m + e.reward);
                    createExplosion((e.x + 0.5) * currentMap.cellSize, (e.y + 0.5) * currentMap.cellSize, '#ef4444', 15, 3);
                  }
                }
              });
            } else {
              target.health -= p.damage;
              if (p.type === 'POISON') {
                target.speed *= 0.7; // Stronger slow for single target poison
              }
              if (target.health <= 0 && target.health + p.damage > 0) {
                setMoney(m => m + target.reward);
                createExplosion(hitX, hitY, '#ef4444', 15, 3);
              }
            }
            return currentEnemies;
          } else {
            const vx = (dx / dist) * p.speed;
            const vy = (dy / dist) * p.speed;
            next.push({ ...p, x: p.x + vx, y: p.y + vy });
            return currentEnemies;
          }
        });
      });
      return next;
    });

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [isPaused, gameOver]);

  // --- Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = currentMap.width * currentMap.cellSize;
    const h = currentMap.height * currentMap.cellSize;
    const cs = currentMap.cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= currentMap.width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, h);
      ctx.stroke();
    }
    for (let i = 0; i <= currentMap.height; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(w, i * cs);
      ctx.stroke();
    }

    // Draw Path
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(currentMap.start.x * cs + cs / 2, currentMap.start.y * cs + cs / 2);
    currentPath.forEach(p => {
      ctx.lineTo(p.x * cs + cs / 2, p.y * cs + cs / 2);
    });
    ctx.stroke();

    // Draw Start/End
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(currentMap.start.x * cs + 2, currentMap.start.y * cs + 2, cs - 4, cs - 4);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(currentMap.end.x * cs + 2, currentMap.end.y * cs + 2, cs - 4, cs - 4);

    // Draw Towers
    towers.forEach((t, idx) => {
      const data = TOWER_DATA[t.type];
      const img = towerImagesRef.current[t.type];
      const range = data.range * (1 + (t.level - 1) * 0.1);

      // Draw Range for selected tower
      if (selectedTowerIndex === idx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(t.x * cs + cs / 2, t.y * cs + cs / 2, range * cs, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fill();
      }

      // Draw Laser Beam
      if (t.type === 'LASER' && !isPaused) {
        const target = enemies.find(e => {
          const dist = Math.sqrt(Math.pow(e.x - t.x, 2) + Math.pow(e.y - t.y, 2));
          const canTarget = data.targets.includes(e.isAir ? 'AIR' : 'GROUND');
          return dist <= range && canTarget;
        });
        if (target) {
          ctx.strokeStyle = data.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(t.x * cs + cs / 2, t.y * cs + cs / 2);
          ctx.lineTo((target.x + 0.5) * cs, (target.y + 0.5) * cs);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.save();
      ctx.translate(t.x * cs + cs / 2, t.y * cs + cs / 2);
      ctx.rotate(t.angle);

      if (img && img.complete) {
        ctx.drawImage(img, -cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4);
      } else {
        // Base
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 4);
        ctx.fill();
        ctx.strokeStyle = data.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Model (Procedural)
        ctx.fillStyle = data.color;
        ctx.beginPath();
        ctx.arc(0, 0, cs / 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel
        ctx.fillStyle = '#333';
        ctx.fillRect(0, -2, cs / 2, 4);
      }
      ctx.restore();

      // Draw Level
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`L${t.level}`, t.x * cs + cs / 2, t.y * cs + cs - 4);
    });

    // Draw Enemies
    enemies.forEach(e => {
      const x = e.x * cs + cs / 2;
      const y = e.y * cs + cs / 2;
      
      if (e.isAir) {
        // Draw Plane
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(x + cs/3, y);
        ctx.lineTo(x - cs/3, y - cs/4);
        ctx.lineTo(x - cs/6, y);
        ctx.lineTo(x - cs/3, y + cs/4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, cs/4, 0, Math.PI * 2);
        ctx.fill();
      }
      const healthWidth = (e.health / e.maxHealth) * (cs * 0.8);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x - (cs * 0.4), y - (cs * 0.5), cs * 0.8, 3);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x - (cs * 0.4), y - (cs * 0.5), healthWidth, 3);
    });

    // Draw Projectiles
    projectiles.forEach(p => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(p.x * cs, p.y * cs, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Particles
    particlesRef.current.forEach(p => p.draw(ctx));

  }, [towers, enemies, projectiles, currentPath, currentMap]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-green-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <Shield className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase italic">Xenotactic v{APP_VERSION}</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] -mt-1">Grid Defense Protocol</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="font-mono text-xl font-bold tracking-tighter">{money}</span>
            </div>
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-500" />
              <span className="font-mono text-xl font-bold tracking-tighter">{lives}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="font-mono text-xl font-bold tracking-tighter">WAVE {wave}</span>
            </div>
            
            <button 
              onClick={() => saveGame(1)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
              title="Quick Save to Slot 1"
            >
              <Shield className="w-5 h-5" />
            </button>

            <button 
              onClick={generateSprites}
              disabled={isGeneratingSprites}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 group"
              title="AI를 사용하여 타워 이미지를 생성합니다"
            >
              {isGeneratingSprites ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 leading-none">AI Generator</p>
                <p className="text-xs font-medium text-white/90">AI 타워 생성</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => initMap(currentMap)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Game Area */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <canvas
              ref={canvasRef}
              width={currentMap.width * currentMap.cellSize}
              height={currentMap.height * currentMap.cellSize}
              className="bg-[#111] rounded-xl border border-white/10 shadow-2xl cursor-crosshair"
              onClick={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = Math.floor((e.clientX - rect.left) / currentMap.cellSize);
                const y = Math.floor((e.clientY - rect.top) / currentMap.cellSize);
                
                const existingTowerIndex = towers.findIndex(t => t.x === x && t.y === y);
                if (existingTowerIndex !== -1) {
                  setSelectedTowerIndex(existingTowerIndex);
                } else {
                  placeTower(x, y);
                  // Only clear selection if we didn't just place a tower (placeTower auto-selects)
                }
              }}
            />

            <AnimatePresence>
              {gameOver && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-40"
                >
                  <Skull className="w-20 h-20 text-red-500 mb-4 animate-pulse" />
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">System Failure</h2>
                  <p className="text-white/60 mb-8">Wave {wave} reached. Defense breached.</p>
                  <button 
                    onClick={() => initMap(currentMap)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    REBOOT SYSTEM
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upgrade Panel Container (Below Map) */}
          <div className="w-full max-w-[600px] h-32 relative">
            <AnimatePresence>
              {selectedTowerIndex !== null && towers[selectedTowerIndex] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-2xl z-30 flex items-center gap-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: TOWER_DATA[towers[selectedTowerIndex].type].color + '20' }}>
                      <TowerIcon className="w-6 h-6" style={{ color: TOWER_DATA[towers[selectedTowerIndex].type].color }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{TOWER_DATA[towers[selectedTowerIndex].type].label}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Level {towers[selectedTowerIndex].level}</p>
                    </div>
                  </div>

                  <div className="h-10 w-px bg-white/10" />

                  <div className="flex-1 flex gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 mb-1">
                        <span>Upgrade</span>
                        <span className="text-yellow-500 font-bold">${Math.floor(TOWER_DATA[towers[selectedTowerIndex].type].cost * 0.8 * towers[selectedTowerIndex].level)}</span>
                      </div>
                      <button
                        onClick={() => {
                          const tower = towers[selectedTowerIndex];
                          const cost = Math.floor(TOWER_DATA[tower.type].cost * 0.8 * tower.level);
                          if (money >= cost && tower.level < 5) {
                            setMoney(m => m - cost);
                            setTowers(prev => prev.map((t, i) => i === selectedTowerIndex ? { ...t, level: t.level + 1 } : t));
                            createExplosion((tower.x + 0.5) * currentMap.cellSize, (tower.y + 0.5) * currentMap.cellSize, '#fff', 20, 3);
                          }
                        }}
                        disabled={money < Math.floor(TOWER_DATA[towers[selectedTowerIndex].type].cost * 0.8 * towers[selectedTowerIndex].level) || towers[selectedTowerIndex].level >= 5}
                        className="w-full py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 disabled:opacity-20 transition-all text-xs"
                      >
                        {towers[selectedTowerIndex].level >= 5 ? 'MAX' : 'UPGRADE'}
                      </button>
                    </div>

                    <div className="w-24">
                      <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 mb-1">
                        <span>Sell</span>
                        <span className="text-red-400 font-bold">
                          ${Math.floor((TOWER_DATA[towers[selectedTowerIndex].type].cost + (towers[selectedTowerIndex].level - 1) * (TOWER_DATA[towers[selectedTowerIndex].type].cost * 0.8)) * 0.7)}
                        </span>
                      </div>
                      <button
                        onClick={() => sellTower(selectedTowerIndex)}
                        className="w-full py-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 font-bold rounded-lg border border-red-500/30 transition-all text-xs"
                      >
                        SELL
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedTowerIndex(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 w-full flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 gap-4">
            {/* Left: Info */}
            <div className="flex items-center gap-3 min-w-[180px]">
              <div className="p-2 bg-white/10 rounded-lg">
                <Info className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-tight">Mazing Strategy</p>
                <p className="text-[10px] text-white/40 leading-tight">Towers act as walls.</p>
              </div>
            </div>

            {/* Center: Tower Arsenal (Horizontal) */}
            <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide px-4 border-x border-white/5">
              {(Object.entries(TOWER_DATA) as [TowerType, typeof TOWER_DATA['BASIC']][]).map(([type, data]) => {
                const canAfford = money >= data.cost;
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedTowerType(type)}
                    disabled={!canAfford}
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all min-w-[70px] ${
                      selectedTowerType === type 
                        ? 'bg-white/15 border-white/30 shadow-lg scale-105' 
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    } ${!canAfford ? 'opacity-30 grayscale' : ''}`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center mb-1">
                      {type === 'BASIC' && <Crosshair className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'SNIPER' && <Target className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'SPLASH' && <Zap className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'MACHINE_GUN' && <LayoutGrid className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'LASER' && <Target className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'POISON' && <Skull className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'ELECTRIC' && <Zap className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'ROCKET' && <ChevronRight className="w-5 h-5" style={{ color: data.color }} />}
                      {type === 'ANTI_AIR' && <Shield className="w-5 h-5" style={{ color: data.color }} />}
                    </div>
                    <p className="text-[9px] font-bold truncate w-full text-center">{data.label}</p>
                    <p className="text-[9px] text-yellow-500 font-mono">${data.cost}</p>
                  </button>
                );
              })}
            </div>
            
            {/* Right: Controls */}
            <div className="flex items-center gap-3 min-w-[240px] justify-end">
              {autoWaveCountdown !== null && (
                <div className="text-right mr-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Auto</p>
                  <p className="text-sm font-mono font-bold text-yellow-500">{autoWaveCountdown}s</p>
                </div>
              )}
              <button 
                onClick={() => document.getElementById('save-slots-container')?.scrollIntoView({behavior: 'smooth'})}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-all flex items-center gap-2 text-xs"
              >
                <Shield className="w-3 h-3" />
                SAVE/LOAD
              </button>
              <button 
                onClick={startWave}
                disabled={enemies.length > 0 || gameOver}
                className="px-4 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 disabled:opacity-50 transition-all flex items-center gap-2 text-xs shadow-[0_0_15px_rgba(34,197,94,0.2)]"
              >
                NEXT WAVE
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          {/* Save Slots */}
          <div id="save-slots-container" className="bg-white/5 rounded-2xl border border-yellow-500/20 p-6 shadow-[0_0_30px_rgba(234,179,8,0.05)]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-500 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              DATA ARCHIVE
            </h3>
            <div className="space-y-3">
              {saveSlots.map(slot => (
                <div key={slot.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Slot {slot.id}</p>
                    <p className="text-xs font-medium truncate text-white/80">
                      {slot.date ? slot.date : 'Empty Slot'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => saveGame(slot.id)}
                      className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-[10px] font-bold rounded-lg transition-all border border-yellow-500/20"
                    >
                      SAVE
                    </button>
                    <button 
                      onClick={() => loadGame(slot.id)}
                      disabled={!slot.data}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold rounded-lg transition-all border border-white/5 disabled:opacity-20"
                    >
                      LOAD
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combat History */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              COMBAT HISTORY
            </h3>
            <div className="space-y-2">
              {combatHistory.length === 0 ? (
                <p className="text-xs text-white/20 italic">No records yet...</p>
              ) : (
                combatHistory.map((entry, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="font-mono text-green-500 font-bold">WAVE {entry.wave}</span>
                    <span className="text-white/40 text-[10px]">{entry.date.split(',')[0]}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Map Selection */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
              <MapIcon className="w-4 h-4" />
              Select Sector
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {(Object.values(MAPS)).map((map) => (
                <button
                  key={map.id}
                  onClick={() => setCurrentMap(map)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    currentMap.id === map.id 
                      ? 'bg-white/10 border-white/30 text-white' 
                      : 'bg-transparent border-white/5 text-white/40 hover:border-white/20'
                  }`}
                >
                  {map.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
              <WallIcon className="w-4 h-4" />
              Tactical Intel
            </h3>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed">
              <p>
                <strong className="text-white">A* Pathfinding:</strong> Enemies always calculate the shortest path to the red exit.
              </p>
              <p>
                <strong className="text-white">Outside Spawn:</strong> Enemies now spawn outside the grid and move in.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.3em]">
        <p>© 2026 Xenotactic Protocol v{APP_VERSION}</p>
        <p>System Status: Operational</p>
      </footer>
    </div>
  );
}
