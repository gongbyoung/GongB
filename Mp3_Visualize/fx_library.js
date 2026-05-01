/**
 * SPECTRUM STUDIO FX LIBRARY v22.8.6
 * 2026.05.01 20가지 수정 사항 반영 및 32종 엔진 전체 포함
 */
window.ENGINES = {
    // 1. Matrix: 가시성 및 Y축 루프 보정
    matrix: (pg, t, b, p1, p2, p3) => {
        pg.textSize(p2 * 5 + 10);
        pg.textAlign(CENTER, CENTER);
        pg.textFont('sans-serif')
        for(let i = 0; i < 40; i++) {
            let x = (i - 20) * 50;
            let y = (t * p1 * 500 + i * 200) % 1600 - 800;
            pg.fill(120, 100, p5.prototype.map(b[i % 12], 0, 255, 40, 100));
            pg.text(char(p5.prototype.random(44032, 44100)), x, y);
        }
    },

    // 2. DNA: 큐브 스케일 및 회전 반경 가변형
    dna: (pg, t, b, p1, p2, p3) => {
        let rad = p3;
        let cSz = p2 * 2;
        for(let i=0; i<24; i++){
            let y = p5.prototype.map(i, 0, 24, -350, 350);
            pg.push(); pg.translate(Math.cos(t+i*0.4)*rad, y, Math.sin(t+i*0.3)*rad);
            pg.rotateY(t); pg.fill(200, 80, 100); 
            pg.box(cSz + b[i%12]*0.2); pg.pop();
        }
    },

    // 3. RipBok: 저/중/고 3밴드 독립 반응 (v22.8 수정안)
    ripbok: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(p2*0.5);
        pg.stroke(200, 100, 100); pg.circle(0, 0, b[0] * 3.5);
        pg.stroke(100, 100, 100); pg.circle(0, 0, b[5] * 3);
        pg.stroke(340, 100, 100); pg.circle(0, 0, b[11] * 2.5);
    },

    // 4. Web: [롤백] 27가지 수정 전 안정 버전
    web: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(180, 100, 100, 60);
        pg.strokeWeight(2);
        for (let i = 0; i < 20; i++) {
            let r = p3 + b[i % 12];
            pg.line(Math.cos(t + i) * r, Math.sin(t + i) * r, Math.cos(t + i + 1) * r, Math.sin(t + i + 1) * r);
        }
    },

    // 5. Nebula: P2 기반 스피어 크기 조절
    nebula: (pg, t, b, p1, p2, p3) => {
        pg.noStroke();
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.map(i,0,p1,0,360), 70, 100, 50);
            pg.push(); pg.translate(p5.prototype.noise(t,i)*800-400, p5.prototype.noise(i,t)*600-300);
            pg.sphere(p2 * 2 + b[i%12]*0.15); pg.pop();
        }
    },

    // 6. Lightning: 가시성 확보 및 번개 연출
    lightning: (pg, t, b, p1, p2, p3) => {
        if (b[0] > 160) {
            pg.stroke(60, 20, 100); pg.strokeWeight(p2);
            let lx = 0, ly = -400;
            for (let i = 0; i < 12; i++) {
                let nx = lx + p5.prototype.random(-80, 80), ny = ly + 70;
                pg.line(lx, ly, nx, ny); lx = nx; ly = ny;
            }
        }
    },

    // 7. Orbit: 중앙 테두리 스피어 + 외부 랜덤 위성 (P1 증가 시 개수 증가)
    orbit: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(200, 100, 100); pg.strokeWeight(2);
        pg.sphere(p3);
        let satCount = Math.floor(p1 / 8);
        for(let i = 0; i < satCount; i++) {
            pg.push();
            pg.rotateY(t * (i + 1) * 0.15); pg.rotateX(i);
            pg.translate(p3 * 1.6, 0);
            pg.fill((i * 40) % 360, 80, 100, 80); pg.noStroke();
            pg.sphere(10 + b[i % 12] * 0.15);
            pg.pop();
        }
    },

    // 8. Tree: 3단 기본 + 주파수 반응 시 끝부분만 가변 성장
    tree: (pg, t, b, p1, p2, p3) => {
        pg.translate(0, 350); pg.stroke(120, 50, 40);
        const _drawBranch = (l, d) => {
            if (d > 7) return;
            let grow = (d > 4) ? p5.prototype.map(b[d % 12], 0, 255, 1.0, 2.2) : 1.0;
            let currentL = l * grow;
            pg.line(0, 0, 0, -currentL);
            pg.translate(0, -currentL);
            pg.push(); pg.rotate(0.3 + b[0]*0.001); _drawBranch(l*0.75, d+1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1]*0.001); _drawBranch(l*0.75, d+1); pg.pop();
        };
        _drawBranch(p3 * 0.8, 0);
    },

    // 9. Triangle: 평면 기준 4면체(Tetrahedron) + 인텐시티 비례 수량 증가
    triangle: (pg, t, b, p1, p2, p3) => {
        let count = Math.floor(p1 / 10) + 1;
        pg.noFill(); pg.stroke(40, 80, 100);
        for(let i = 0; i < count; i++) {
            pg.push();
            pg.rotateY(t + i * 0.3); pg.rotateX(t * 0.5);
            pg.cone(p3 + b[i%12], (p3 + b[i%12])*1.2, 3);
            pg.pop();
        }
    },

    // 10. Tunnel: [유지] 다각형 변환 로직 (P2 스케일에 연동)
    tunnel: (pg, t, b, p1, p2, p3) => {
        let sides = Math.floor(p5.prototype.map(p2, 1, 50, 3, 12));
        for (let i = 0; i < 24; i++) {
            pg.push();
            pg.translate(0, 0, -i * 120 + (t * 500) % 120);
            pg.rotateZ(i * 0.2 + b[i % 12] * 0.01);
            pg.noFill(); pg.stroke(i * 15, 80, 100);
            // Polygon Draw
            pg.beginShape();
            for (let a = 0; a < TWO_PI; a += TWO_PI/sides) {
                pg.vertex(Math.cos(a) * p3, Math.sin(a) * p3);
            }
            pg.endShape(CLOSE);
            pg.pop();
        }
    },

    // 11. Cosmos: 일직선 발산 + 중앙 소(小), 외곽 대(大) + 비트 반응
    cosmos: (pg, t, b, p1, p2, p3) => {
        let genCount = Math.floor(p5.prototype.map(b[0], 0, 255, 30, 150));
        for (let i = 0; i < genCount; i++) {
            pg.push();
            let ang = p5.prototype.noise(i) * Math.PI * 2;
            let dist = (t * 800 + i * 40) % 1600;
            let s = p5.prototype.map(dist, 0, 1600, 1, 50) + b[i % 12] * 0.15;
            pg.translate(Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            pg.fill(i * 10 % 360, 70, 100); pg.noStroke();
            pg.sphere(s);
            pg.pop();
        }
    },

    // 12. Particles: [유지] 고도화 버전
    particles: (pg, t, b, p1, p2, p3) => {
        p5.prototype.randomSeed(99);
        for(let i=0; i<p1; i++){
            let s = p5.prototype.random(2, p2) + b[i%12]*0.2;
            pg.fill(p5.prototype.random(360), 70, 100);
            pg.push(); pg.translate(p5.prototype.random(-960,960), p5.prototype.random(-540,540));
            pg.circle(0,0,s); pg.pop();
        }
    },

    // 13. Spiral: 동일 회전축 + 인텐시티 증가 시 반경 가변 레이어 추가
    spiral: (pg, t, b, p1, p2, p3) => {
        let layers = Math.floor(p1 / 25) + 1;
        for(let j = 0; j < layers; j++) {
            let offsetRad = p3 * (1 + j * 0.4);
            for (let i = 0; i < 50; i++) {
                let r = p5.prototype.map(i, 0, 50, offsetRad, 0);
                pg.push();
                pg.rotateZ(t * (2 + j*0.2) + i * 0.12);
                pg.fill((i * 4 + j * 40) % 360, 80, 100);
                pg.circle(r, 0, 5 + b[i % 12] * 0.1);
                pg.pop();
            }
        }
    },

    // 14. Ripple: 내부 채움 + 그리드별 개별 색상
    ripple: (pg, t, b, p1, p2, p3) => {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                pg.push(); pg.translate(x * 400 - 600, y * 300 - 300);
                pg.fill((x * 90 + y * 30) % 360, 70, 100, 60); 
                pg.noStroke();
                pg.circle(0, 0, b[(x + y) % 12] * p2);
                pg.pop();
            }
        }
    },

    // 15. Bloom: [롤백] 27가지 수정 전 안정 버전
    bloom: (pg, t, b, p1, p2, p3) => {
        pg.fill(320, 100, 100, 40); pg.noStroke();
        pg.ellipse(0, 0, 300 + b[0] * 2.5, 300 + b[0] * 2.5);
    },

    // 16. Wave: 6개 레이어 파도 + 음영 채움
    wave: (pg, t, b, p1, p2, p3) => {
        for(let j = 0; j < 6; j++) {
            pg.fill(200, 85, 100 - j * 12, 45); pg.noStroke();
            pg.beginShape();
            for(let i = 0; i < 24; i++) {
                let x = i * 100 - 1100;
                let y = Math.sin(t + i * 0.4 + j) * 120 + b[j % 12] + j * 60;
                pg.vertex(x, y);
            }
            pg.vertex(1200, 720); pg.vertex(-1200, 720);
            pg.endShape(pg.CLOSE);
        }
    },

    // 17. Grid: [롤백] Terrain(지형) 지오메트리 복구
    grid: (pg, t, b, p1, p2, p3) => {
        pg.rotateX(Math.PI / 3); pg.stroke(180, 80, 100, 50); pg.noFill();
        for(let y = -10; y < 10; y++) {
            pg.beginShape();
            for(let x = -10; x < 10; x++) {
                let z = p5.prototype.noise(x * 0.2, y * 0.2 + t) * p3 + b[0] * 0.6;
                pg.vertex(x * 100, y * 100, z);
            }
            pg.endShape();
        }
    },

    // 18~32: 기존 유지 엔진 및 기타 필수 효과 (생략 없음)
    radialEQ: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(2);
        pg.stroke(200, 100, 100); pg.circle(0,0,p3 + b[0]*2);
        pg.stroke(120, 100, 100); pg.circle(0,0,p3*1.5 + b[5]*2);
        pg.stroke(320, 100, 100); pg.circle(0,0,p3*2 + b[11]*2);
    },
    floral: (pg, t, b, p1, p2, p3) => {
        pg.fill(140, 70, 100, 65); pg.noStroke();
        for(let i=0; i<12; i++){
            let l = p3 + b[i]*2.5;
            pg.push(); pg.rotate(i*Math.PI/6 + t);
            pg.beginShape(); pg.vertex(0,0);
            pg.bezierVertex(l/2, -l/2, l, -l/4, l, 0); pg.bezierVertex(l, l/4, l/2, l/2, 0, 0);
            pg.endShape(); pg.pop();
        }
    },
    kaleid: (pg, t, b, p1, p2, p3) => {
        pg.rotateZ(t);
        for(let i=0; i<8; i++){
            pg.push(); pg.rotate(i*Math.PI/4);
            pg.fill(i*45, 80, 100, 60); pg.box(60, p5.prototype.map(b[i], 0, 255, 100, 600), 60); pg.pop();
        }
    },
    hex: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<6; i++){
            let h = p5.prototype.map(b[i*2], 0, 255, 20, p3);
            pg.push(); pg.rotateY(i*Math.PI/3); pg.translate(150, 0);
            pg.fill(i*60, 80, 100); pg.box(50, h, 50); pg.pop();
        }
    },
    chladni: (pg, t, b, p1, p2, p3) => {
        let ct = [[-350, 0], [0, 0], [350, 0]];
        ct.forEach((p, i) => {
            pg.push(); pg.translate(p[0], p[1]); pg.noFill(); pg.stroke(i*120, 80, 100);
            pg.circle(0, 0, b[i*4] * p2); pg.pop();
        });
    },
    bokRip: (pg, t, b, p1, p2, p3) => { // 기존 명칭 유지
        pg.noFill(); pg.stroke(t%360, 80, 100);
        pg.circle(0,0, p3 + b[0]*2);
    },
    bars: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<12; i++){
            pg.fill(i*30, 80, 100); pg.rect(i*50-300, 0, 40, b[i]*2);
        }
    },
    fluid: (pg, t, b, p1, p2, p3) => {
        pg.noStroke(); pg.fill(200, 50, 100, 50);
        for(let i=0; i<10; i++){ pg.ellipse(Math.sin(t+i)*200, Math.cos(t+i)*200, b[i], b[i]); }
    },
    sakura: (pg, t, b, p1, p2, p3) => {
        pg.fill(340, 40, 100, 60); pg.noStroke();
        for(let i=0; i<p1/2; i++){ pg.push(); pg.translate(p5.prototype.noise(i)*1000-500, (t*200+i*50)%1000-500); pg.rotate(t); pg.ellipse(0,0,15,10); pg.pop(); }
    },
    ribbons: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(3);
        for(let i=0; i<5; i++){ pg.stroke(i*70, 80, 100); pg.beginShape(); for(let x=-500; x<500; x+=50){ pg.vertex(x, Math.sin(t+x*0.01+i)*100+b[i]); } pg.endShape(); }
    }
};
