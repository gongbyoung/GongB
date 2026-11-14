/**
 * [파일 역할] 제노택틱 핵심 비즈니스 로직: 실시간 미로 길찾기(BFS Flow-Field) 및 입구 봉쇄 방지
 * - 타워를 건설할 때마다 출구(Exit)에서 모든 타일까지의 최단 거리 맵(Flow Field)을 계산합니다.
 * - 플레이어가 출구를 완전히 막는 위치에 타워를 지으려 하면 즉시 감지하여 건설을 차단합니다.
 */

import { GRID_CONFIG } from "./data.js?v=3";

/**
 * 출구(Exits)들로부터 역방향 BFS(너비 우선 탐색)를 수행해
 * 각 타일(c, r)에서 가장 가까운 출구까지의 거리(dist)와 다음 이동 타일(nextTile)을 계산합니다.
 *
 * @param {Array<Array<number>>} grid - 0: 빈 땅, 1: 장애물/타워
 * @param {Array<{c:number, r:number}>} exits - 출구 타일 좌표 목록
 * @returns {{ dist: Array<Array<number>>, next: Array<Array<{c:number, r:number}|null>> }}
 */
export function computeFlowField(grid, exits) {
  const { cols, rows } = GRID_CONFIG;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const next = Array.from({ length: rows }, () => Array(cols).fill(null));
  const queue = [];

  for (const ex of exits) {
    if (ex.r >= 0 && ex.r < rows && ex.c >= 0 && ex.c < cols) {
      dist[ex.r][ex.c] = 0;
      queue.push({ c: ex.c, r: ex.r });
    }
  }

  // 상, 하, 좌, 우 4방향 탐색
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 }
  ];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currDist = dist[curr.r][curr.c];

    for (const d of dirs) {
      const nc = curr.c + d.dc;
      const nr = curr.r + d.dr;

      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      // 장애물(1)이나 타워가 있는 칸은 지상 적이 통과할 수 없음
      if (grid[nr][nc] !== 0) continue;

      if (dist[nr][nc] > currDist + 1) {
        dist[nr][nc] = currDist + 1;
        next[nr][nc] = { c: curr.c, r: curr.r };
        queue.push({ c: nc, r: nr });
      }
    }
  }

  return { dist, next };
}

/**
 * 특정 좌표(testC, testR)에 타워를 건설했을 때:
 * 1) 모든 입구(spawns)에서 출구까지 길이 열려 있는지,
 * 2) 현재 필드에 살아있는 지상 적군들이 갇히지 않는지 검증합니다.
 */
export function canPlaceTowerWithoutBlocking(grid, spawns, exits, groundEnemies, testC, testR) {
  const { cols, rows } = GRID_CONFIG;
  if (testC < 0 || testC >= cols || testR < 0 || testR >= rows) return false;
  if (grid[testR][testC] !== 0) return false;

  // 입구나 출구 칸 위에는 타워 건설 불가
  for (const sp of spawns) {
    if (sp.c === testC && sp.r === testR) return false;
  }
  for (const ex of exits) {
    if (ex.c === testC && ex.r === testR) return false;
  }

  // 지상 적이 현재 밟고 있는 타일 위에는 바로 건설 불가
  for (const enemy of groundEnemies) {
    if (enemy.isFlying) continue;
    const ec = Math.floor(enemy.x / GRID_CONFIG.tileSize);
    const er = Math.floor(enemy.y / GRID_CONFIG.tileSize);
    if (ec === testC && er === testR) return false;
  }

  // 임시로 타워를 놓아보고 FlowField 계산
  grid[testR][testC] = 1;
  const { dist } = computeFlowField(grid, exits);
  grid[testR][testC] = 0;

  // 모든 스폰 지점에서 출구까지 도달 가능한지 확인
  for (const sp of spawns) {
    if (dist[sp.r][sp.c] === Infinity) {
      return false;
    }
  }

  // 현재 살아있는 모든 지상 적의 위치에서도 출구까지 도달 가능한지 확인
  for (const enemy of groundEnemies) {
    if (enemy.isFlying) continue;
    const ec = Math.max(0, Math.min(cols - 1, Math.floor(enemy.x / GRID_CONFIG.tileSize)));
    const er = Math.max(0, Math.min(rows - 1, Math.floor(enemy.y / GRID_CONFIG.tileSize)));
    if (dist[er][ec] === Infinity) {
      return false;
    }
  }

  return true;
}

/**
 * 입구에서 출구까지의 대표 예상 경로(점선 표시용)를 배열로 반환합니다.
 */
export function tracePreviewPaths(spawns, nextField) {
  const paths = [];
  const maxSteps = GRID_CONFIG.cols * GRID_CONFIG.rows;

  for (const sp of spawns) {
    const path = [{ c: sp.c, r: sp.r }];
    let curr = { c: sp.c, r: sp.r };
    let steps = 0;

    while (steps < maxSteps) {
      const nxt = nextField[curr.r]?.[curr.c];
      if (!nxt) break;
      path.push(nxt);
      curr = nxt;
      steps++;
    }
    paths.push(path);
  }
  return paths;
}
