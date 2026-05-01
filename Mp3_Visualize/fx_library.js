/**
 * SPECTRUM STUDIO FX LIBRARY v22.8.0
 * 20가지 수정 사항(2026.05.01) 반영 완료
 */
window.ENGINES = {
    // 3. Matrix: 로직 전면 재점검 (보이지 않던 문제 해결)
    matrix: (pg, t, b, p1, p2, p3) => {
        pg.textSize(p2 * 5 + 10);
        pg.textAlign(CENTER, CENTER);
        for(let i = 0; i < 40; i++) {
            let x = (i - 20) * 50;
            // 주파수 반응성 강화 및 y축 루프 계산 수정
            let y = (t * p1 * 500 + i * 200) % 1600 - 800;
            pg.fill(120, 100, p5.prototype.map(b[i % 12], 0, 255, 40, 100));
            pg.text(char(p5.prototype.random(44032, 44100)), x, y);
        }
    },

    // 4. Web: [롤백] 27가지 수정 전 로직으로 복구
    web: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(180, 100, 100, 60);
        pg.strokeWeight(p2);
        for (let i = 0; i < 20; i++) {
            let r = p3 + b[i % 12];
            pg.line(Math.cos(t + i) * r, Math.sin(t + i) * r, Math.cos(t + i + 1) * r, Math.sin(t + i + 1) * r);
        }
    },

    // 6. Lightning: 가시성 확보 및 번개 로직 수정
    lightning: (pg, t, b, p1, p2, p3) => {
        if (b[0] > 160) {
            pg.stroke(60, 20, 100); pg.strokeWeight(p2 * 2);
            let lx = 0, ly = -400;
            for (let i = 0; i < 12; i++) {
                let nx = lx + p5.prototype.random(-80, 80), ny = ly + 70;
                pg.line(lx, ly, nx, ny); lx = nx; ly = ny;
            }
        }
    },

    // 7. Orbit: 중앙 스피어 테두리화 + 외부 랜덤 위성 반응
    orbit: (pg, t, b, p1, p2, p3) => {
        // 중앙 스피어 (테두리만)
        pg.noFill(); pg.stroke(200, 100, 100); pg.strokeWeight(2);
        pg.sphere(p3);
        
        // 외부 랜덤 위성 배치 (인텐시티 비례 숫자 증가)
        let satCount = Math.floor(p1 / 10);
        for(let i = 0; i < satCount; i++) {
            pg.push();
            pg.rotateY(t * (i + 1) * 0.2);
            pg.translate(p3 * 1.5, 0);
            pg.fill(p5.prototype.random(360), 80, 100, 80);
            pg.noStroke();
            pg.sphere(10 + b[i % 12] * 0.1);
            pg.pop();
        }
    },

    // 8. Tree: 절차적 성장 로직 (끝부분만 주파수에 반응)
    tree: (pg, t, b, p1, p2, p3) => {
        pg.translate(0, 350); pg.stroke(120, 50, 40);
        const _drawBranch = (l, d) => {
            if (d > 7) return;
            // 끝부분(d > 5)만 주파수에 따라 성장했다 돌아옴
            let currentL = (d > 5) ? l * p5.prototype.map(b[d % 12], 0, 255, 1.0, 1.8) : l;
            pg.line(0, 0, 0, -currentL);
            pg.translate(0, -currentL);
            
            pg.push(); pg.rotate(0.3 + b[0] * 0.001); _drawBranch(l * 0.75, d + 1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1] * 0.001); _drawBranch(l * 0.75, d + 1); pg.pop();
        };
        _drawBranch(p3 * 0.8, 0);
    },

    // 9. Triangle: 평면 기준 4면체 수정 (인텐시티 비례 개수 증가)
    triangle: (pg, t, b, p1, p2, p3) => {
        let count = Math.floor(p1 / 15) + 1;
        pg.noFill(); pg.stroke(40, 80, 100);
        for(let i = 0; i < count; i++) {
            pg.push();
            pg.rotateY(t + i * 0.5);
            pg.rotateX(t * 0.3);
            // 4면체(Tetrahedron) 표현을 위해 cone의 side를 3으로 설정
            pg.cone(p3 + b[i % 12], (p3 + b[i % 12]) * 1.2, 3);
            pg.pop();
        }
    },

    // 10. Tunnel: 다각형 변환 로직 추가
    tunnel: (pg, t, b, p1, p2, p3) => {
        let sides = Math.floor(p5.prototype.map(p2, 0, 20, 3, 12)); // 스케일에 따라 삼각형~다각형
        for (let i = 0; i < 24; i++) {
            pg.push();
            pg.translate(0, 0, -i * 120 + (t * 500) % 120);
            pg.rotateZ(i * 0.2 + b[i % 12] * 0.01);
            pg.noFill(); pg.stroke(i * 15, 80, 100);
            pg.polygon(0, 0, 200, sides); // 별도 정의된 다각형 함수
            pg.pop();
        }
    },

    // 11. Cosmos: 일직선 발산 + 외곽 확장 로직
    cosmos: (pg, t, b, p1, p2, p3) => {
        let count = Math.floor(p5.prototype.map(b[0], 0, 255, 20, 100));
        for (let i = 0; i < count; i++) {
            pg.push();
            let ang = p5.prototype.noise(i) * Math.PI * 2;
            let dist = (t * 1000 + i * 50) % 1500;
            // 중앙(dist=0)은 작고 외곽으로 갈수록 커짐
            let s = p5.prototype.map(dist, 0, 1500, 2, 30) + b[i % 12] * 0.1;
            pg.translate(Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            pg.fill(i * 5 % 360, 70, 100); pg.noStroke();
            pg.sphere(s);
            pg.pop();
        }
    },

    // 13. Spiral: 회전반경 가변형 레이어 추가
    spiral: (pg, t, b, p1, p2, p3) => {
        let layers = Math.floor(p1 / 30) + 1;
        for(let j = 0; j < layers; j++) {
            let baseRad = p3 * (1 + j * 0.5);
            for (let i = 0; i < 60; i++) {
                let r = p5.prototype.map(i, 0, 60, baseRad, 0);
                pg.push();
                pg.rotateZ(t * (2 + j) + i * 0.1);
                pg.fill((i * 3 + j * 50) % 360, 80, 100);
                pg.circle(r, 0, 5 + b[i % 12] * 0.1);
                pg.pop();
            }
        }
    },

    // 14. Ripple: 내부 채움 및 개별 색상
    ripple: (pg, t, b, p1, p2, p3) => {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                pg.push(); pg.translate(x * 400 - 600, y * 300 - 300);
                pg.fill((x * 90 + y * 30) % 360, 70, 100, 60); 
                pg.noStroke();
                pg.circle(0, 0, b[(x + y) % 12] * 3.5);
                pg.pop();
            }
        }
    },

    // 15. Bloom: [롤백] 27가지 수정 전 로직
    bloom: (pg, t, b, p1, p2, p3) => {
        pg.fill(320, 100, 100, 40);
        pg.noStroke();
        pg.ellipse(0, 0, 300 + b[0] * 2, 300 + b[0] * 2);
    },

    // 16. Wave: 6개 레이어 + 음영 채움 파도
    wave: (pg, t, b, p1, p2, p3) => {
        for(let j = 0; j < 6; j++) {
            pg.fill(200, 80, 100 - j * 15, 50);
            pg.noStroke();
            pg.beginShape();
            for(let i = 0; i < 20; i++) {
                let x = i * 100 - 1000;
                let y = Math.sin(t + i * 0.5 + j) * 150 + b[j] + j * 50;
                pg.vertex(x, y);
            }
            pg.vertex(1000, 540); pg.vertex(-1000, 540);
            pg.endShape(pg.CLOSE);
        }
    },

    // 17. Grid: [롤백] Terrain(지형) 로직으로 변경
    grid: (pg, t, b, p1, p2, p3) => {
        pg.rotateX(Math.PI / 3);
        pg.stroke(180, 80, 100, 50);
        pg.noFill();
        for(let y = -10; y < 10; y++) {
            pg.beginShape();
            for(let x = -10; x < 10; x++) {
                let z = p5.prototype.noise(x * 0.2, y * 0.2 + t) * p3 + b[0] * 0.5;
                pg.vertex(x * 100, y * 100, z);
            }
            pg.endShape();
        }
    },
    
    // 유틸리티: 다각형 그리기
    polygon: (pg, x, y, radius, npoints) => {
        let angle = (Math.PI * 2) / npoints;
        pg.beginShape();
        for (let a = 0; a < (Math.PI * 2); a += angle) {
            let sx = x + Math.cos(a) * radius;
            let sy = y + Math.sin(a) * radius;
            pg.vertex(sx, sy);
        }
        pg.endShape(pg.CLOSE);
    }
};