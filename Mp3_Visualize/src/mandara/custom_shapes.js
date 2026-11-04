// ============================================================================
// [고급 복합 중첩 쉐이프 추가 파일 - src/mandara/custom_shapes.js]
// 하나의 쉐이프 안에 여러 레이어가 겹쳐져 만다라 특유의 화려한 문양을 만듭니다.
// ============================================================================

(function() {
  const { TAU, quad, circle, polygon } = window.MandalaUtils;

  // 1. [복합 1] 십자가 보석 로제타 (JEWEL_ROSETTE)
  // - 바깥쪽 날카로운 별 레이어 + 안쪽 부드러운 다이아몬드 + 중앙 동심원 레이어가 겹칩니다.
  registerMandalaShape({
    id: "JEWEL_ROSETTE",
    name: "💎 보석 로제타 (Rosette)",
    defaultWeight: 0.85,
    midBias: (mid) => 0.8 + mid * 0.7,
    generate(n, variant, which, morph) {
      const splines = [];
      const r1 = 1.05 + morph * 0.08;
      const r2 = 0.78 - morph * 0.05;
      const r3 = 0.52;
      const half = (Math.PI / n) * (0.8 + variant * 0.2);

      // 레이어 A: 외곽 크리스탈 스파이크
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        splines.push({
          pts: [
            [Math.cos(a) * r3, Math.sin(a) * r3],
            [Math.cos(a - half) * r2, Math.sin(a - half) * r2],
            [Math.cos(a) * r1, Math.sin(a) * r1],
            [Math.cos(a + half) * r2, Math.sin(a + half) * r2],
            [Math.cos(a) * r3, Math.sin(a) * r3],
          ],
          closed: true
        });
      }

      // 레이어 B: 45도 회전된 안쪽 레이스 톱니바퀴 (중첩 무늬 생성)
      const n2 = n * 2;
      const lacePts = [];
      for (let i = 0; i <= n2; i++) {
        const a = (TAU * i) / n2;
        const rr = i % 2 === 0 ? r2 * 0.88 : r3 * 1.15;
        lacePts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      splines.push({ pts: lacePts, closed: true, ringFill: true });

      // 레이어 C: 중심 코어 환형
      splines.push({ pts: circle(r3 * 0.65, 32), closed: true, ringFill: true });
      return splines;
    }
  });

  // 2. [복합 2] 티베탄 만다라 휠 (DHARMA_WHEEL)
  // - 바깥 테두리 + 기하학적 삼각형 바이트 + 안쪽 연꽃 휠이 삼중으로 겹칩니다.
  registerMandalaShape({
    id: "DHARMA_WHEEL",
    name: "☸️ 다르마 휠 (Wheel)",
    defaultWeight: 0.75,
    midBias: (mid) => 0.7 + mid * 0.9,
    generate(n, variant, which, morph) {
      const splines = [];
      
      // 레이어 1: 이중 외곽 원 테두리
      splines.push({ pts: circle(1.0, 64), closed: true, ringFill: false });
      splines.push({ pts: circle(0.93, 64), closed: true, ringFill: false });

      // 레이어 2: 바깥 테두리와 안쪽을 연결하는 방사형 기하학 스트럿(살)
      const innerR = 0.45 - morph * 0.05;
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const w = (Math.PI / n) * 0.35;
        // 각 살이 삼각형 볼륨을 가짐
        splines.push({
          pts: [
            [Math.cos(a) * innerR, Math.sin(a) * innerR],
            [Math.cos(a - w) * 0.93, Math.sin(a - w) * 0.93],
            [Math.cos(a + w) * 0.93, Math.sin(a + w) * 0.93],
            [Math.cos(a) * innerR, Math.sin(a) * innerR],
          ],
          closed: true
        });
      }

      // 레이어 3: 안쪽 기하 다각형 코어
      const coreSides = (n % 2 === 0) ? n : n * 2;
      const corePts = [];
      for(let i=0; i<=coreSides; i++) {
        const a = (TAU * i) / coreSides;
        corePts.push([Math.cos(a) * innerR, Math.sin(a) * innerR]);
      }
      splines.push({ pts: corePts, closed: true, ringFill: true });

      return splines;
    }
  });

  // 3. [복합 3] 고대 사원 돔 레이스 (TEMPLE_LACE)
  // - 겹쳐진 아치형 기와 구조와 꽃잎 실루엣이 상호 교차하는 복합 문양
  registerMandalaShape({
    id: "TEMPLE_LACE",
    name: "🕌 사원 레이스 (Temple)",
    defaultWeight: 0.80,
    midBias: (mid) => 0.75 + mid * 0.6,
    generate(n, variant, which, morph) {
      const splines = [];
      const rBase = 0.6 + morph * 0.06;
      const rTip = 1.02;
      
      // 레이어 A: 하트/아치형 교차 꽃잎
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const width = (Math.PI / n) * 0.95;
        const tip = [Math.cos(a) * rTip, Math.sin(a) * rTip];
        const p1 = [Math.cos(a - width) * rBase, Math.sin(a - width) * rBase];
        const p2 = [Math.cos(a + width) * rBase, Math.sin(a + width) * rBase];
        const ctrl = [Math.cos(a) * (rBase * 0.5), Math.sin(a) * (rBase * 0.5)];

        // 베지어로 곡선형 아치 구성
        const left = quad(p1, ctrl, tip, 6);
        const right = quad(tip, ctrl, p2, 6);
        const poly = left.concat(right.slice(1));
        poly.push(p1);
        splines.push({ pts: poly, closed: true });
      }

      // 레이어 B: 그 사이에 교차하는 작은 다이아몬드 펜던트 레이어
      const nHalf = Math.floor(n / 2) * 2;
      for (let i = 0; i < nHalf; i++) {
        const a = (TAU * (i + 0.5)) / nHalf;
        const midR = 0.82;
        const smallR = 0.52;
        const w = (Math.PI / nHalf) * 0.4;
        splines.push({
          pts: [
            [Math.cos(a) * smallR, Math.sin(a) * smallR],
            [Math.cos(a - w) * midR, Math.sin(a - w) * midR],
            [Math.cos(a) * rBase, Math.sin(a) * rBase],
            [Math.cos(a + w) * midR, Math.sin(a + midR) * midR], // 수정된 오타 방지
            [Math.cos(a) * smallR, Math.sin(a) * smallR],
          ],
          closed: true
        });
      }

      return splines;
    }
  });

  // 4. [복합 4] 네온 기하 만다라 (NEON_GEOMETRY)
  // - 다중 육각/팔각 격자가 서로 회전하며 겹쳐지는 현대적이고 사이버틱한 만다라
  registerMandalaShape({
    id: "NEON_GEOMETRY",
    name: "💫 네온 메타트론 (Neon)",
    defaultWeight: 0.70,
    midBias: (mid) => 0.6 + mid * 1.1,
    generate(n, variant, which, morph) {
      const splines = [];
      const count = Math.max(3, Math.floor(n / 2));

      // 레이어 1: 외곽 다각 프레임
      const outerPoly = [];
      for (let i = 0; i <= count; i++) {
        const a = (TAU * i) / count;
        outerPoly.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0]);
      }
      splines.push({ pts: outerPoly, closed: true, ringFill: false });

      // 레이어 2: 30도 회전된 중간 다각 프레임 (상호 교차)
      const midPoly = [];
      const offset = Math.PI / count;
      for (let i = 0; i <= count; i++) {
        const a = offset + (TAU * i) / count;
        const r = 0.82 + morph * 0.06;
        midPoly.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      splines.push({ pts: midPoly, closed: true, ringFill: true });

      // 레이어 3: 내부 스타 버스트 웨이브
      const starPts = [];
      const starSides = count * 2;
      for (let i = 0; i <= starSides; i++) {
        const a = (TAU * i) / starSides;
        const r = i % 2 === 0 ? 0.65 : 0.35 - morph * 0.05;
        starPts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      splines.push({ pts: starPts, closed: true, ringFill: true });

      return splines;
    }
  });

  // 5. [복합 5] 연꽃 수국 만다라 (HYDRANGEA_BLOOM)
  // - 겹겹이 층을 이루는 둥근 꽃잎들이 촘촘하게 맞물려 수국처럼 풍성한 입체감 형성
  registerMandalaShape({
    id: "HYDRANGEA_BLOOM",
    name: "🌸 수국 블룸 (Hydrangea)",
    defaultWeight: 0.80,
    midBias: (mid) => 0.85 + mid * 0.5,
    generate(n, variant, which, morph) {
      const splines = [];
      const layers = 2; // 이중 층 구조
      
      for (let l = 0; l < layers; l++) {
        const scaleFactor = l === 0 ? 1.0 : 0.72;
        const rotOffset = l === 0 ? 0 : (Math.PI / n);
        const petalCount = n + (l * 4);

        for (let i = 0; i < petalCount; i++) {
          const a = rotOffset + (TAU * i) / petalCount;
          const rTip = (0.98 - l * 0.22) + morph * 0.07;
          const rBase = 0.35 + l * 0.15;
          const width = (Math.PI / petalCount) * 0.85;

          const tip = [Math.cos(a) * rTip, Math.sin(a) * rTip];
          const b1 = [Math.cos(a - width) * rBase, Math.sin(a - width) * rBase];
          const b2 = [Math.cos(a + width) * rBase, Math.sin(a + width) * rBase];
          const ctrl = [Math.cos(a) * ((rBase + rTip) * 0.5), Math.sin(a) * ((rBase + rTip) * 0.5)];

          const left = quad(b1, ctrl, tip, 5);
          const right = quad(tip, ctrl, b2, 5);
          const poly = left.concat(right.slice(1));
          poly.push(b1);
          splines.push({ pts: poly, closed: true });
        }
      }

      // 안쪽 중앙 구슬
      splines.push({ pts: circle(0.28, 24), closed: true, ringFill: true });
      return splines;
    }
  });

  // 6. [복합 6] 만다라 불꽃 소용돌이 (SPIRAL_FLARE)
  // - 휘몰아치는 나선형 소용돌이 날개와 다이아몬드 코어가 결합된 역동적인 패턴
  registerMandalaShape({
    id: "SPIRAL_FLARE",
    name: "🌪️ 소용돌이 플레어 (Flare)",
    defaultWeight: 0.75,
    midBias: (mid) => 0.65 + mid * 0.95,
    generate(n, variant, which, morph) {
      const splines = [];
      const twist = 0.65 + variant * 0.3 + morph * 0.2;

      // 레이어 A: 나선 회전형 소용돌이 날개 셋트
      for (let i = 0; i < n; i++) {
        const a = (TAU * i) / n;
        const p0 = [Math.cos(a) * 0.4, Math.sin(a) * 0.4];
        const pMid = [Math.cos(a + twist * 0.6) * 0.82, Math.sin(a + twist * 0.6) * 0.82];
        const pTip = [Math.cos(a + twist) * 1.05, Math.sin(a + twist) * 1.05];
        const pBack = [Math.cos(a + twist * 0.4) * 0.72, Math.sin(a + twist * 0.4) * 0.72];

        const side1 = quad(p0, pMid, pTip, 8);
        const side2 = quad(pTip, pBack, p0, 8);
        const poly = side1.concat(side2.slice(1));
        splines.push({ pts: poly, closed: true });
      }

      // 레이어 B: 대칭 보완용 안쪽 역회전 링
      const innerSides = n;
      const innerPts = [];
      for (let i = 0; i <= innerSides; i++) {
        const a = - (TAU * i) / innerSides;
        innerPts.push([Math.cos(a) * 0.45, Math.sin(a) * 0.45]);
      }
      splines.push({ pts: innerPts, closed: true, ringFill: true });

      return splines;
    }
  });

})();
