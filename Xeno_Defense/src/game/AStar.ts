export interface Point {
  x: number;
  y: number;
}

class Node {
  f = 0;
  g = 0;
  h = 0;
  parent: Node | null = null;

  constructor(public x: number, public y: number) {}
}

export function aStar(
  start: Point,
  end: Point,
  grid: boolean[][], // true if blocked
  gridWidth: number,
  gridHeight: number
): Point[] | null {
  const openList: Node[] = [];
  const closedList: boolean[][] = Array.from({ length: gridHeight }, () =>
    Array(gridWidth).fill(false)
  );
  
  // Helper to check bounds
  const isInside = (x: number, y: number) => x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;

  const startNode = new Node(start.x, start.y);
  const endNode = new Node(end.x, end.y);

  openList.push(startNode);

  while (openList.length > 0) {
    let lowIdx = 0;
    for (let i = 0; i < openList.length; i++) {
      if (openList[i].f < openList[lowIdx].f) lowIdx = i;
    }
    const currentNode = openList[lowIdx];

    if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
      let curr = currentNode;
      const path: Point[] = [];
      while (curr.parent) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.reverse();
    }

    openList.splice(lowIdx, 1);
    closedList[currentNode.y][currentNode.x] = true;

    const neighbors = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    for (const neighbor of neighbors) {
      const nx = currentNode.x + neighbor.x;
      const ny = currentNode.y + neighbor.y;

      if (!isInside(nx, ny)) continue;
      if (grid[ny][nx] || closedList[ny][nx]) continue;

      const gScore = currentNode.g + 1;
      let gScoreIsBest = false;

      let neighborNode = openList.find((n) => n.x === nx && n.y === ny);

      if (!neighborNode) {
        gScoreIsBest = true;
        neighborNode = new Node(nx, ny);
        neighborNode.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y);
        openList.push(neighborNode);
      } else if (gScore < neighborNode.g) {
        gScoreIsBest = true;
      }

      if (gScoreIsBest) {
        neighborNode.parent = currentNode;
        neighborNode.g = gScore;
        neighborNode.f = neighborNode.g + neighborNode.h;
      }
    }
  }

  return null;
}
