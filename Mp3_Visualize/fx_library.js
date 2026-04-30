/* 
   SPECTRUM STUDIO FX LIBRARY v21.1.0
   Directory: GongB / Mp3_Visualize / fx_library.js
   32 Unique Visual Engines for p5.js WEBGL
   
   [v21.1.0 추가 FX 8종]
   - bars       : 주파수 막대 EQ (주파수 시각화)
   - radialEQ   : 원형 방사형 EQ (주파수 시각화)
   - terrain    : 3D 노이즈 지형 (Z축 / 공간감)
   - ribbons    : 오디오 반응 리본 (3D 공간감)
   - glitch     : 글리치 텍스트 왜곡 (타이포 반응)
   - fluid      : 유체 흐름 시뮬 (물리 시뮬레이션)
   - smoke      : 연기 / 연무 파티클 (물리 시뮬레이션)
   - kaleid     : 만화경 패턴 (기하 고도화)
*/

// --- 유틸리티: 비주얼 컬러 스타일 적용 엔진 ---
function applyColorStyle(pg, style, h, i, fI, alphaVal) {
    pg.drawingContext.shadowBlur = 0;
    let a = (alphaVal / 255) * 100;
    if (style === 'hue') pg.stroke(h, 80, 100, a);
    else if (style === 'random') pg.stroke(random(360), 80, 100, a);
    else if (style === 'pastel') pg.stroke((h + i * 15) % 360, 40, 95, a);
    else if (style === 'bw') pg.stroke(0, 0, map(i % 10, 0, 9, 100, 30), a);
    else if (style === 'shadow') {
        pg.stroke(h, 90, 100, a);
        pg.drawingContext.shadowBlur = 20;
        pg.drawingContext.shadowColor = `hsla(${h}, 100%, 50%, 0.8)`;
    } else if (style === 'imp') {
        pg.stroke(h, 80, 100, a * 0.7);
        pg.strokeWeight(fI * 4);
        pg.translate(random(-2, 2), random(-2, 2));
    } else if (style === 'point') {
        pg.stroke(h, 80, 100, a);
    }
    if (style !== 'imp') pg.strokeWeight(2 * fI);
}

// --- 32종 독립 FX 함수 객체 ---
const FX_ENGINES = {

    // ─────────────────────────────────────────
    // 기존 24종
    // ─────────────────────────────────────────

    waves: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let j = 0; j < floor(p1 / 5) + 1; j++) {
            applyColorStyle(pg, s, h, j, fI, p3);
            pg.beginShape();
            for (let i = -960; i <= 960; i += 60) {
                let y = sin(i * 0.005 + t * (p2 + j * 0.1)) * b[j % 12] * fI;
                pg.vertex(i, 200 + j * 80 + y);
            }
            pg.endShape();
        }
    },
    matrix: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.textSize(p2 * 10 + 10);
        let chars = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.fill(pg.drawingContext.strokeStyle);
            let idx = floor(noise(i, floor(t * p2)) * chars.length);
            pg.text(chars[idx], -960 + (i * (1920 / p1)), (t * 500 + i * 200) % 1080 - 540 + b[i % 12]);
        }
    },
    ripBok: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 2); i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.circle(0, 0, (t * 100 * p2 + i * 150) % 1500 + b[i % 12]);
            pg.fill(pg.drawingContext.strokeStyle);
            pg.circle(cos(t + i) * 400 * p2, sin(t + i) * 400 * p2, 50 + b[i % 12]);
        }
    },
    bokRip: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.fill(pg.drawingContext.strokeStyle);
            pg.circle(cos(i + t) * b[i % 12] * p2, sin(i + t) * b[i % 12] * p2, 50 + b[i % 12]);
        }
    },
    dna: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.circle(cos(i * p2 + t) * 400, sin(i * p2 + t) * 100, 10 + b[i % 12] / 4);
            applyColorStyle(pg, s, (h + 180) % 360, i, fI, p3);
            pg.circle(cos(i * p2 + t + PI) * 400, sin(i * p2 + t + PI) * 100, 10 + b[i % 12] / 4);
        }
    },
    nebula: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.noStroke();
        for (let i = 0; i < floor(p1 / 2); i++) {
            pg.fill(h, 80, 100, p3 / 255 * 20);
            pg.circle(noise(i, t) * 1920 - 960, noise(i + 7, t) * 1080 - 540, 300 * p2 + b[0]);
        }
    },
    mandala: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 2); i++) {
            pg.rotate(TWO_PI / (p1 / 2));
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.ellipse(100 * p2 + b[0], 0, 50 + b[1], 200 + b[2]);
        }
    },
    lightning: (pg, t, b, fI, h, s, p1, p2, p3) => {
        if (b[10] > 180) {
            applyColorStyle(pg, s, h, 0, fI, p3);
            for (let i = 0; i < floor(p1 / 10); i++) pg.line(random(-960, 960), -540, random(-960, 960), 540);
        }
    },
    web: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let pts = [];
        for (let i = 0; i < floor(p1 / 2); i++) pts.push({ x: noise(i, t) * 1920 - 960, y: noise(i + 9, t) * 1080 - 540 });
        applyColorStyle(pg, s, h, 0, fI, p3);
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                if (dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y) < 200 * p2) pg.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
            }
        }
    },
    vortex: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            pg.rotate(t * 0.01 * p2);
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.rect(-i * 10, -i * 10, i * 20 + b[0], i * 20);
        }
    },
    chladni: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 5; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            let x = sin(i * t * 0.01 * p2) * 500;
            let y = cos(i * t * 0.01 * p2) * 500;
            pg.point(x, y);
        }
    },
    starfield: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 2; i++) {
            applyColorStyle(pg, s, 255, i, fI, p3);
            let r = noise(i, t * 0.1) * 2000 - 1000;
            pg.line(r, -540, r + b[0] * p2, 540);
        }
    },
    cyber: (pg, t, b, fI, h, s, p1, p2, p3) => {
        applyColorStyle(pg, s, h, 0, fI, p3);
        let step = 1080 / (p1 / 2);
        for (let i = 0; i < p1 / 2; i++) {
            pg.line(-960, -540 + i * step + (t * 100 % step), 960, -540 + i * step + (t * 100 % step));
            pg.line(-960 + i * step * 2, -540, -960 + i * step * 2 + b[0], 540);
        }
    },
    radar: (pg, t, b, fI, h, s, p1, p2, p3) => {
        applyColorStyle(pg, s, h, 0, fI, p3);
        pg.circle(0, 0, 400 * p2);
        pg.fill(h, 80, 100, p3 / 255 * 50);
        pg.arc(0, 0, 800 * p2, 800 * p2, t * p2 % TWO_PI, (t * p2 % TWO_PI) + PI / 4);
    },
    hex: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let j = 1; j < floor(p1 / 8) + 1; j++) {
            applyColorStyle(pg, s, h, j, fI, p3);
            pg.beginShape();
            for (let i = 0; i < 6; i++) pg.vertex(cos(i * PI / 3) * j * 100 * p2, sin(i * PI / 3) * j * 100 * p2);
            pg.endShape(CLOSE);
        }
    },
    flow: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.line(-960, noise(i, t * 0.5) * 1080 - 540, 960, noise(i + 1, t * 0.5) * 1080 - 540 + b[i % 12]);
        }
    },
    orbit: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.ellipse(0, 0, 400 + i * 50, 200 + b[0] * p2);
            pg.circle(cos(t + i) * 300, sin(t + i) * 100, 20);
        }
    },
    tree: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.push(); pg.translate(0, 400); applyColorStyle(pg, s, h, 0, fI, p3);
        const _branch = (l, g) => {
            if (g <= 0) return;
            pg.line(0, 0, 0, -l); pg.translate(0, -l);
            pg.push(); pg.rotate(0.4 + sin(t) * 0.1); _branch(l * 0.7, g - 1); pg.pop();
            pg.push(); pg.rotate(-0.4 - sin(t) * 0.1); _branch(l * 0.7, g - 1); pg.pop();
        };
        _branch(p2 * 100 + b[0], floor(map(p1, 1, 100, 2, 8))); pg.pop();
    },
    triangles: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            pg.rotate(t * 0.1);
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.triangle(-50, -50, 50, -50, 0, 50 + b[0] * p2);
        }
    },
    spiral: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 10; i++) {
            let r = i * 2 * p2 + b[0] * 0.1;
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.point(cos(i * 0.1 + t) * r, sin(i * 0.1 + t) * r);
        }
    },
    particles: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.circle(noise(i, t) * 1920 - 960, noise(i + 5, t) * 1080 - 540, 5 + b[0] * 0.1 * p2);
        }
    },
    tunnel: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            let r = (t * 200 * p2 + i * 300) % 2000;
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.rect(-r / 2, -r / 2, r, r);
        }
    },
    warp: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.line(0, 0, cos(i + t * p2) * 1500, sin(i + t * p2) * 1500);
        }
    },
    ripples: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            let r = (t * 300 * p2 + i * 400) % 2000;
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.circle(0, 0, r + b[0]);
        }
    },

    // ─────────────────────────────────────────
    // v21.1.0 신규 8종
    // ─────────────────────────────────────────

    /*
     * bars — 주파수 막대 EQ
     * ─────────────────────────────────────────
     * 카테고리 : 주파수 시각화
     * 원리     : b[] 배열의 12개 주파수 대역을
     *            개별 막대로 직접 매핑.
     *            p1 = 막대 밀도(열 수),
     *            p2 = 높이 스케일,
     *            p3 = 알파.
     * 특징     : 좌우 대칭 구성 + 하이밴드일수록
     *            색상 hue가 보색으로 이동.
     */
    bars: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 4) + 4;            // 막대 개수 (최소 4)
        let barW = 1920 / count;                   // 막대 폭
        pg.noStroke();
        for (let i = 0; i < count; i++) {
            // 12개 주파수 대역을 count 개 막대로 순환 매핑
            let band = i % 12;
            let bHeight = b[band] * p2 * fI;      // 음량 → 높이
            let hueShift = (h + band * 15) % 360; // 대역별 색조 이동
            let a = (p3 / 255) * 100;
            pg.fill(hueShift, 80, 100, a);

            let x = -960 + i * barW;
            // 위아래 대칭 막대 (미러 EQ)
            pg.rect(x, -bHeight / 2, barW - 2, bHeight);
        }
    },

    /*
     * radialEQ — 원형 방사형 EQ
     * ─────────────────────────────────────────
     * 카테고리 : 주파수 시각화
     * 원리     : 360도를 주파수 대역 수로 분할,
     *            각 대역의 음량을 반경 방향으로 표현.
     *            p1 = 스파이크 밀도,
     *            p2 = 반경 스케일,
     *            p3 = 알파.
     * 특징     : 중심 원 + 방사형 스파이크.
     *            고음역 대역이 강하면 외곽이 파열됨.
     */
    radialEQ: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let spikes = floor(p1 / 2) + 12;          // 스파이크 수 (최소 12)
        let baseR = 150 * p2;                      // 기본 원 반경
        applyColorStyle(pg, s, h, 0, fI, p3);
        pg.noFill();
        // 외곽 파형 베지어
        pg.beginShape();
        for (let i = 0; i <= spikes; i++) {
            let band = i % 12;
            let angle = (TWO_PI / spikes) * i + t * 0.3;
            let r = baseR + b[band] * p2 * fI * 0.8;
            pg.curveVertex(cos(angle) * r, sin(angle) * r);
        }
        pg.endShape(CLOSE);
        // 중심 고정 원
        pg.circle(0, 0, baseR * 1.2);
        // 스파이크 라인
        for (let i = 0; i < spikes; i++) {
            let band = i % 12;
            if (b[band] < 30) continue;            // 조용한 대역 생략
            applyColorStyle(pg, s, (h + i * 8) % 360, i, fI, p3);
            let angle = (TWO_PI / spikes) * i + t * 0.3;
            let r = baseR + b[band] * p2 * fI;
            pg.line(cos(angle) * baseR * 0.6, sin(angle) * baseR * 0.6,
                    cos(angle) * r, sin(angle) * r);
        }
    },

    /*
     * terrain — 3D 노이즈 지형
     * ─────────────────────────────────────────
     * 카테고리 : 3D / 공간감 (Z축 활용)
     * 원리     : WEBGL translate/rotateX를 사용해
     *            그리드를 45도 기울이고 노이즈로
     *            Z 높이를 오디오에 연동.
     *            p1 = 그리드 해상도,
     *            p2 = 기복 스케일,
     *            p3 = 알파.
     * 특징     : 저음이 강할수록 지형이 격렬하게 솟음.
     *            3D 원근감으로 깊이감 표현.
     */
    terrain: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let cols = floor(p1 / 5) + 6;             // 그리드 열 수
        let rows = 8;
        let cellW = 1920 / cols;
        let cellH = 300 / rows;
        pg.push();
        pg.translate(0, 100);
        pg.rotateX(PI / 4);                        // X축 45도 기울임 (WEBGL)
        for (let row = 0; row < rows - 1; row++) {
            applyColorStyle(pg, s, (h + row * 20) % 360, row, fI, p3);
            pg.beginShape(TRIANGLE_STRIP);
            for (let col = 0; col <= cols; col++) {
                let x = -960 + col * cellW;
                let nz0 = noise(col * 0.15, row * 0.15, t * 0.4) * b[row % 12] * p2 * fI;
                let nz1 = noise(col * 0.15, (row + 1) * 0.15, t * 0.4) * b[(row + 1) % 12] * p2 * fI;
                // WEBGL에서 Z축으로 높이 표현
                pg.vertex(x, row * cellH - 150, -nz0);
                pg.vertex(x, (row + 1) * cellH - 150, -nz1);
            }
            pg.endShape();
        }
        pg.pop();
    },

    /*
     * ribbons — 오디오 반응 리본
     * ─────────────────────────────────────────
     * 카테고리 : 3D / 공간감 (Z축 활용)
     * 원리     : 사인파 경로를 따라 두께 있는
     *            리본(TRIANGLE_STRIP)을 그림.
     *            p1 = 리본 수,
     *            p2 = 진폭 스케일,
     *            p3 = 알파.
     * 특징     : 음량 연동 두께 + WEBGL rotateY로
     *            공간감 있는 3D 리본 생성.
     */
    ribbons: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 10) + 2;           // 리본 수
        for (let r = 0; r < count; r++) {
            pg.push();
            pg.rotateY(r * (PI / count) + t * 0.1 * p2); // WEBGL Y축 회전
            applyColorStyle(pg, s, (h + r * 40) % 360, r, fI, p3);
            pg.noFill();
            pg.beginShape(TRIANGLE_STRIP);
            let steps = 60;
            for (let i = 0; i <= steps; i++) {
                let x = map(i, 0, steps, -900, 900);
                let phase = i * 0.08 + t * p2 + r * 1.2;
                let amp = b[r % 12] * fI * 0.8;
                let y1 = sin(phase) * amp;
                let y2 = sin(phase + 0.3) * amp;
                let thick = 10 + b[(r + 2) % 12] * 0.1 * fI;
                pg.vertex(x, y1 - thick);
                pg.vertex(x, y2 + thick);
            }
            pg.endShape();
            pg.pop();
        }
    },

    /*
     * glitch — 글리치 텍스트 왜곡
     * ─────────────────────────────────────────
     * 카테고리 : 텍스트 / 타이포 반응
     * 원리     : 화면을 수평 슬라이스로 나눠
     *            고음역(b[8]~b[11])이 강할 때
     *            무작위 X 오프셋으로 글리치 효과.
     *            p1 = 슬라이스 수,
     *            p2 = 글리치 강도,
     *            p3 = 알파.
     * 특징     : 킥/스네어가 아닌 하이햇·심벌
     *            구간에서 격렬하게 반응.
     */
    glitch: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let slices = floor(p1 / 3) + 5;           // 수평 슬라이스 수
        let sliceH = 1080 / slices;
        // 고음역 에너지 합산 (b[8]~b[11])
        let hiEnergy = (b[8] + b[9] + b[10] + b[11]) / 4;
        pg.textSize(80 + b[0] * 0.3 * fI);
        pg.textAlign(CENTER, CENTER);
        let chars = ['MUSIC','SOUND','WAVE','BEAT','FLUX','DATA','SYNC','GLITCH'];
        for (let i = 0; i < slices; i++) {
            // 고음역이 임계값 초과 시 글리치 오프셋 발생
            let offsetX = (hiEnergy > 100) ? random(-p2 * 80, p2 * 80) : 0;
            let offsetX2 = (hiEnergy > 150) ? random(-p2 * 40, p2 * 40) : 0;
            let y = -540 + i * sliceH + sliceH / 2;
            // RGB 분리 레이어 (글리치 색수차)
            if (hiEnergy > 80) {
                pg.fill(0, 100, 100, (p3 / 255) * 60);  // 빨강 레이어
                pg.noStroke();
                let idx = floor(noise(i, t) * chars.length);
                pg.text(chars[idx], offsetX2 + 6, y);
                pg.fill(180, 100, 100, (p3 / 255) * 60); // 청록 레이어
                pg.text(chars[idx], -offsetX2 - 6, y);
            }
            // 메인 텍스트
            applyColorStyle(pg, s, (h + i * 20) % 360, i, fI, p3);
            pg.fill(pg.drawingContext.strokeStyle);
            let mainIdx = floor(noise(i + 5, floor(t * 0.5)) * chars.length);
            pg.text(chars[mainIdx], offsetX, y);
        }
        pg.textAlign(LEFT, BASELINE);
    },

    /*
     * fluid — 유체 흐름 시뮬
     * ─────────────────────────────────────────
     * 카테고리 : 물리 시뮬레이션
     * 원리     : 펄린 노이즈 기반 벡터 필드를
     *            만들어 파티클을 흘려보냄.
     *            오디오가 강해지면 유체가 소용돌이침.
     *            p1 = 파티클 수,
     *            p2 = 흐름 속도,
     *            p3 = 알파.
     * 특징     : 각 파티클이 노이즈 벡터 필드를
     *            따라 이동 → 자연스러운 유체 패턴.
     */
    fluid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 * 1.5);
        pg.noFill();
        for (let i = 0; i < count; i++) {
            // 노이즈 기반 위치 (파티클마다 위상 다름)
            let seed = i * 0.07;
            let px = noise(seed, t * 0.2 * p2) * 1920 - 960;
            let py = noise(seed + 30, t * 0.2 * p2) * 1080 - 540;
            // 벡터 필드 각도: 저음에 따라 소용돌이 강도 변화
            let angle = noise(seed + 60, t * 0.1) * TWO_PI * 2 + b[0] * 0.005 * p2;
            let spd = (20 + b[i % 12] * 0.5) * fI * p2;
            let nx = px + cos(angle) * spd;
            let ny = py + sin(angle) * spd;
            applyColorStyle(pg, s, (h + i * 3 + b[0] * 0.5) % 360, i, fI, p3);
            pg.line(px, py, nx, ny);
            // 저음이 강하면 원형 소용돌이 추가
            if (b[0] > 120 && i % 4 === 0) {
                let eddyR = b[0] * 0.2 * p2 * fI;
                pg.circle(px, py, eddyR);
            }
        }
    },

    /*
     * smoke — 연기 / 연무 파티클
     * ─────────────────────────────────────────
     * 카테고리 : 물리 시뮬레이션
     * 원리     : 중앙 하단에서 파티클이 위로 상승,
     *            노이즈로 좌우 흔들림 추가.
     *            음량에 따라 분출 속도와 크기 변화.
     *            p1 = 파티클 밀도,
     *            p2 = 상승 속도,
     *            p3 = 알파.
     * 특징     : pg.noStroke() + fill 전용으로
     *            부드러운 연기 질감 표현.
     *            bass가 강하면 폭발적으로 뿜어져 나옴.
     */
    smoke: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.noStroke();
        let count = floor(p1 * 1.2);
        for (let i = 0; i < count; i++) {
            // 각 파티클의 '생애 위상' (0=바닥, 1=소멸)
            let phase = (t * p2 * 0.5 + i * 0.13) % 1;
            // Y: 하단에서 상단으로 상승
            let py = map(phase, 0, 1, 400, -700);
            // X: 노이즈로 좌우 흔들림
            let px = noise(i * 0.3, t * 0.15) * 600 - 300 + b[i % 12] * 0.5 * p2;
            // 크기: 상승할수록 퍼짐, 저음 연동
            let sz = map(phase, 0, 1, 20, 250 + b[0] * 0.5 * p2) * fI;
            // 투명도: 상승할수록 점점 희미해짐
            let fadeAlpha = map(phase, 0, 1, p3 / 255 * 60, 0);
            let hueD = (h + i * 5 + b[1] * 0.3) % 360;
            pg.fill(hueD, 30, 90, fadeAlpha);
            pg.circle(px, py, sz);
        }
    },

    /*
     * kaleid — 만화경 패턴
     * ─────────────────────────────────────────
     * 카테고리 : 기하 / 구조 (만다라 고도화)
     * 원리     : 기본 셀을 N-fold 대칭으로 회전 복사.
     *            셀 안에서는 주파수 대역별 도형을
     *            배치해 오디오 반응 만화경 생성.
     *            p1 = 대칭 수(접힘),
     *            p2 = 크기 스케일,
     *            p3 = 알파.
     * 특징     : rotateY 미러링으로 진짜 만화경처럼
     *            좌우 반전 복사까지 수행.
     */
    kaleid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let folds = floor(p1 / 10) + 3;           // 대칭 접힘 수 (최소 3)
        let sliceAngle = TWO_PI / folds;
        for (let f = 0; f < folds; f++) {
            pg.push();
            pg.rotate(sliceAngle * f);
            // 짝수 슬라이스는 Y미러 (만화경 반전)
            if (f % 2 === 0) pg.scale(1, -1);
            // 셀 내부: 주파수 대역별 원 + 선 배치
            for (let k = 0; k < 6; k++) {
                let band = k % 12;
                let r = (50 + k * 60) * p2;
                let sz = 20 + b[band] * 0.4 * fI;
                applyColorStyle(pg, s, (h + k * 30 + t * 20) % 360, k, fI, p3);
                pg.noFill();
                pg.circle(r, 0, sz);
                // 저음 대역은 라인 추가
                if (band < 4) {
                    pg.line(0, 0, r + sz * 0.5, b[band] * 0.3 * fI);
                }
            }
            // 외곽 호 (슬라이스 경계)
            applyColorStyle(pg, s, h, f, fI, p3 * 0.5);
            pg.arc(0, 0, 500 * p2 + b[0] * fI * 0.3,
                   500 * p2 + b[0] * fI * 0.3,
                   0, sliceAngle);
            pg.pop();
        }
    }

};
