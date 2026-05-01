/**
 * SPECTRUM STUDIO FX LIBRARY v22.9.7
 * BLOOM 롤백, 꽃술 직립 보정, 나팔꽃 입체화 및 꽃잎 비산 시스템 완결본
 */

// ─────────────────────────────────────────────
// 공통 헬퍼: 꽃잎 날리기 파티클 (모양 복사형)
// ─────────────────────────────────────────────
const _flyPetal = (pg, t, b, hue, sat, bri, petalW, petalH, seed, count, type = 'default') => {
    let flyCount = Math.floor(p5.prototype.map(b[0], 0, 255, 0, count));
    p5.prototype.randomSeed(seed);
    for (let i = 0; i < flyCount; i++) {
        pg.push();
        let ang = p5.prototype.random(TWO_PI);
        let dist = p5.prototype.random(100, 800);
        let life = (t * 0.3 + p5.prototype.random()) % 1;
        let curD = dist * life;
        let alpha = p5.prototype.map(life, 0.7, 1.0, 90, 0);
        
        pg.translate(Math.cos(ang) * curD, Math.sin(ang) * curD, life * 300);
        pg.rotate(ang + life * PI * 2 + Math.sin(t + i) * 0.5); // 살랑살랑 움직임
        pg.noStroke();
        pg.fill(hue, sat, bri, alpha);

        if (type === 'morning') {
            pg.beginShape();
            for (let a = 0; a < TWO_PI; a += 0.5) { pg.vertex(Math.cos(a) * petalW, Math.sin(a) * petalW, 0); }
            pg.endShape(CLOSE);
        } else {
            pg.beginShape();
            pg.vertex(0, 0);
            pg.bezierVertex(-petalW, -petalH * 0.5, petalW, -petalH * 0.5, 0, 0);
            pg.bezierVertex(-petalW * 0.3, petalH * 0.5, petalW * 0.3, petalH * 0.5, 0, 0);
            pg.endShape(CLOSE);
        }
        pg.pop();
    }
};

window.ENGINES = {
    // 1. BLOOM: [롤백] 캡처 화면의 Stroke 기반 화려한 스타일
    bloom: (pg, t, b, p1, p2, p3, st) => {
        pg.push(); pg.noFill();
        let count = Math.floor(p5.prototype.map(b[0], 0, 255, 5, 20));
        for (let i = 0; i < count; i++) {
            let hue = st === 'random' ? (t * 50 + i * 20) % 360 : (320 + i * 5) % 360;
            pg.stroke(hue, 80, 100, 60);
            pg.strokeWeight(2);
            pg.push();
            pg.rotate(t * 0.2 + i);
            pg.ellipse(0, 0, p3 + b[i % 12] * p2 * 0.2, (p3 * 0.5) + b[i % 12] * 0.1);
            pg.pop();
        }
        pg.pop();
    },

    // 2. PEONY (모란): 꽃술 직립 및 꽃잎 비산
    peony: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[4], hi = b[8];
        let layers = Math.floor(p5.prototype.map(p1, 10, 100, 3, 6));
        let baseHue = st === 'random' ? (t * 20) % 360 : 340;
        pg.push(); pg.noStroke();
        for (let layer = layers; layer >= 0; layer--) {
            let petals = 6 + layer * 2;
            let radius = p3 * (0.3 + layer * 0.1) + vol * 0.2;
            for (let i = 0; i < petals; i++) {
                pg.push();
                let ang = (TWO_PI / petals) * i + t * 0.2 + layer * 0.2;
                pg.rotateZ(ang); pg.translate(radius, 0); pg.rotateZ(HALF_PI);
                pg.fill(st === 'random' ? (baseHue - layer * 10 + i * 5) % 360 : baseHue - layer * 10, 60, 95, 80);
                let pLen = p3 * 0.4 + mid * 0.1;
                pg.beginShape(); pg.vertex(0, 0);
                pg.bezierVertex(-p2 * 2, -pLen * 0.4, -p2 * 2.5, -pLen * 0.8, 0, -pLen);
                pg.bezierVertex(p2 * 2.5, -pLen * 0.8, p2 * 2, -pLen * 0.4, 0, 0);
                pg.endShape(CLOSE); pg.pop();
            }
        }
        // 꽃술 직립 보정
        pg.fill(50, 90, 100);
        for (let j = 0; j < 12; j++) {
            pg.push(); pg.rotateZ(TWO_PI / 12 * j + t);
            pg.translate(15, 0, 0);
            pg.cylinder(2, 20 + mid * 0.2); // Z축 위로 직립
            pg.translate(0, 0, 15); pg.sphere(4);
            pg.pop();
        }
        pg.pop();
        _flyPetal(pg, t, b, baseHue, 50, 95, 15, 25, 1001, 20);
    },

    // 3. SUNFLOWER (해바라기)
    sunflower: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], hi = b[9];
        let petals = Math.floor(p5.prototype.map(p1, 10, 100, 16, 24));
        pg.push(); pg.noStroke();
        for (let i = 0; i < petals; i++) {
            pg.push();
            let ang = (TWO_PI / petals) * i + t * 0.1;
            pg.rotateZ(ang); pg.translate(p3 * 0.5 + vol * 0.2, 0); pg.rotateZ(HALF_PI);
            pg.fill(st === 'random' ? (40 + i * 5) % 360 : 45, 90, 100, 90);
            let pLen = p3 * 0.45;
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-p2 * 2, -pLen * 0.3, -p2 * 1, -pLen * 0.9, 0, -pLen);
            pg.bezierVertex(p2 * 1, -pLen * 0.9, p2 * 2, -pLen * 0.3, 0, 0);
            pg.endShape(CLOSE); pg.pop();
        }
        // 씨앗판
        pg.fill(20, 60, 20); pg.cylinder(p3 * 0.25, 10);
        pg.pop();
        _flyPetal(pg, t, b, 45, 90, 100, 12, 28, 2002, 15);
    },

    // 4. MORNING_GLORY (나팔꽃): 입체 나팔관 성장 로직
    morning_glory: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], hi = b[8];
        let baseH = st === 'random' ? (t * 30) % 360 : 270;
        pg.push(); pg.noStroke();
        let pushUp = p5.prototype.map(vol, 0, 255, 20, 150); // 위로 솟구치는 정도
        for (let i = 0; i < 5; i++) {
            pg.push();
            let ang = (TWO_PI / 5) * i + t * 0.2;
            pg.rotateZ(ang);
            pg.fill(st === 'random' ? (baseH + i * 15) % 360 : baseH + i * 5, 70, 90, 85);
            pg.beginShape();
            pg.vertex(0, 0, 0);
            for (let a = -PI / 5; a <= PI / 5; a += 0.1) {
                let r = p3 * 0.6 + Math.sin(t * 5 + i) * 10;
                // 나팔꽃처럼 바깥쪽(r)으로 갈수록 위(Z축)로 올라감
                pg.vertex(Math.cos(a) * r, Math.sin(a) * r, pushUp);
            }
            pg.vertex(0, 0, 0);
            pg.endShape(CLOSE);
            pg.pop();
        }
        // 중앙 노란 속
        pg.fill(60, 30, 100); pg.cylinder(p3 * 0.12, 20 + vol * 0.1);
        pg.pop();
        _flyPetal(pg, t, b, baseH, 70, 90, 20, 20, 4004, 12, 'morning');
    },

    // 5. HIBISCUS (무궁화): 꽃술 직립
    hibiscus: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[3];
        pg.push(); pg.noStroke();
        for (let i = 0; i < 5; i++) {
            pg.push();
            let ang = (TWO_PI / 5) * i + t * 0.15;
            pg.rotateZ(ang); pg.translate(p3 * 0.3, 0); pg.rotateZ(HALF_PI);
            pg.fill(st === 'random' ? (i * 20) % 360 : 0, 90, 90, 90);
            let pLen = p3 * 0.6;
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-p2 * 3, -pLen * 0.3, -p2 * 3, -pLen * 0.8, 0, -pLen);
            pg.bezierVertex(p2 * 3, -pLen * 0.8, p2 * 3, -pLen * 0.3, 0, 0);
            pg.endShape(CLOSE); pg.pop();
        }
        // 수술대 직립
        let tubeH = 80 + mid * 0.3;
        pg.fill(50, 80, 100);
        pg.push(); pg.translate(0, 0, tubeH / 2); pg.cylinder(4, tubeH); 
        pg.translate(0, 0, tubeH / 2); pg.sphere(12); pg.pop();
        pg.pop();
        _flyPetal(pg, t, b, 0, 90, 90, 22, 30, 5005, 18);
    },

    // 6. GRID: 하단부 명암 채우기 통합
    grid: (pg, t, b, p1, p2, p3, st) => {
        pg.rotateX(PI / 3);
        for (let y = -8; y < 8; y++) {
            pg.beginShape(TRIANGLE_STRIP);
            pg.fill(180, 80, 40 + y * 5 + b[0] * 0.1, 80);
            pg.stroke(180, 100, 100, 30);
            for (let x = -8; x <= 8; x++) {
                let z1 = p5.prototype.noise(x * 0.2, y * 0.2 + t) * p3 + b[0] * 0.5;
                let z2 = p5.prototype.noise(x * 0.2, (y + 1) * 0.2 + t) * p3 + b[0] * 0.5;
                pg.vertex(x * 100, y * 100, z1); pg.vertex(x * 100, (y + 1) * 100, z2);
            }
            pg.endShape();
        }
    },

    // 7. TREE: 잎사귀/열매 복구
    tree: (pg, t, b, p1, p2, p3, st) => {
        pg.translate(0, 300); pg.stroke(40, 50, 30);
        const _dr = (l, d) => {
            if (d > 7) return;
            let curL = l * ((d > 4) ? p5.prototype.map(b[d % 12], 0, 255, 1.0, 2.0) : 1.0);
            pg.line(0, 0, 0, -curL); pg.translate(0, -curL);
            if (d > 5) {
                pg.push(); pg.noStroke();
                pg.fill(st === 'random' ? p5.prototype.random(360) : 120 + d * 10, 80, 100, 70);
                pg.sphere(p2 + b[d % 12] * 0.1); pg.pop();
            }
            pg.push(); pg.rotate(0.3 + b[0] * 0.001); _dr(l * 0.75, d + 1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1] * 0.001); _dr(l * 0.75, d + 1); pg.pop();
        };
        _dr(p3 * 0.7, 0);
    },

    // 8. WEB: [롤백] 초기 안정 버전
    web: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.stroke(180, 100, 100, 60); pg.strokeWeight(2);
        for (let i = 0; i < 20; i++) {
            let r = p3 + b[i % 12];
            pg.line(Math.cos(t + i) * r, Math.sin(t + i) * r, Math.cos(t + i + 1) * r, Math.sin(t + i + 1) * r);
        }
    },

    // 9. COSMOS: 일직선 발산
    cosmos: (pg, t, b, p1, p2, p3, st) => {
        for (let i = 0; i < p5.prototype.map(b[0], 0, 255, 20, 100); i++) {
            pg.push(); let ang = p5.prototype.noise(i) * TWO_PI; let dst = (t * 800 + i * 40) % 1500;
            pg.translate(Math.cos(ang) * dst, Math.sin(ang) * dst, 0);
            pg.fill(i * 15 % 360, 70, 100); pg.noStroke();
            pg.sphere(p5.prototype.map(dst, 0, 1500, 1, 40) + b[i % 12] * 0.1); pg.pop();
        }
    },

    // 10. DAISY (데이지)
    daisy: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[5], hi = b[10];
        let petals = Math.floor(p5.prototype.map(p1, 10, 100, 18, 30));
        pg.push(); pg.noStroke();
        for (let i = 0; i < petals; i++) {
            pg.push();
            let ang = (TWO_PI / petals) * i + t * 0.1;
            pg.rotateZ(ang); pg.translate(p3 * 0.3 + vol * 0.1, 0); pg.rotateZ(HALF_PI);
            pg.fill(0, 0, 100, 90);
            let pLen = p3 * 0.45;
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-p2, -pLen * 0.3, -p2 * 0.5, -pLen * 0.8, 0, -pLen);
            pg.bezierVertex(p2 * 0.5, -pLen * 0.8, p2, -pLen * 0.3, 0, 0);
            pg.endShape(CLOSE); pg.pop();
        }
        pg.fill(30, 90, 100); pg.sphere(p3 * 0.15 + vol * 0.05);
        pg.pop();
        _flyPetal(pg, t, b, 0, 0, 100, 8, 20, 3003, 20);
    },

    // 나머지 엔진들 (DNA, Polygon, Nebula, Lightning, Orbit, Triangle, Spiral, RadialEQ, Floral, Kaleid, Hex, Chladni, Starfield, Radar, Smoke, Mandala, Bars, Fluid, Sakura, Ribbons, BokRip, FinalVoid, Ripples)
    dna: (pg, t, b, p1, p2, p3, st) => { for(let i=0; i<24; i++){ pg.push(); pg.translate(Math.cos(t+i*0.4)*p3, p5.prototype.map(i, 0, 24, -300, 300), Math.sin(t+i*0.3)*p3); pg.fill(200, 80, 100); pg.box(p2 * 2 + b[i%12]*0.2); pg.pop(); } },
    polygon: (pg, t, b, p1, p2, p3, st) => { let s = Math.floor(p5.prototype.map(p2, 1, 50, 3, 12)); for (let i = 0; i < 20; i++) { pg.push(); pg.translate(0, 0, -i * 150 + (t * 500) % 150); pg.rotateZ(i * 0.1); pg.noFill(); pg.stroke(i * 18, 80, 100); pg.beginShape(); for (let a = 0; a < TWO_PI; a += TWO_PI / s) { pg.vertex(Math.cos(a) * p3, Math.sin(a) * p3); } pg.endShape(CLOSE); pg.pop(); } },
    nebula: (pg, t, b, p1, p2, p3, st) => { pg.noStroke(); for(let i=0; i<p1; i++){ pg.fill(p5.prototype.map(i,0,p1,0,360), 70, 100, 50); pg.push(); pg.translate(p5.prototype.noise(t,i)*800-400, p5.prototype.noise(i,t)*600-300); pg.sphere(p2 * 2 + b[i%12]*0.15); pg.pop(); } },
    lightning: (pg, t, b, p1, p2, p3, st) => { if (b[0] > 160) { pg.stroke(60, 20, 100); pg.strokeWeight(p2); let lx = 0, ly = -400; for (let i = 0; i < 12; i++) { let nx = lx + p5.prototype.random(-80, 80), ny = ly + 70; pg.line(lx, ly, nx, ny); lx = nx; ly = ny; } } },
    orbit: (pg, t, b, p1, p2, p3, st) => { pg.noFill(); pg.stroke(200, 100, 100); pg.strokeWeight(2); pg.sphere(p3); for(let i = 0; i < p1/8; i++) { pg.push(); pg.rotateY(t * (i + 1) * 0.15); pg.translate(p3 * 1.6, 0); pg.fill((i * 40) % 360, 80, 100, 80); pg.noStroke(); pg.sphere(10 + b[i % 12] * 0.15); pg.pop(); } },
    triangle: (pg, t, b, p1, p2, p3, st) => { let count = Math.floor(p1 / 10) + 1; pg.noFill(); pg.stroke(40, 80, 100); for(let i = 0; i < count; i++) { pg.push(); pg.rotateY(t + i * 0.3); pg.rotateX(t * 0.5); pg.cone(p3 + b[i%12], (p3 + b[i%12])*1.2, 3); pg.pop(); } },
    spiral: (pg, t, b, p1, p2, p3, st) => { let layers = Math.floor(p1 / 25) + 1; for(let j = 0; j < layers; j++) { let offsetRad = p3 * (1 + j * 0.4); for (let i = 0; i < 50; i++) { pg.push(); pg.rotateZ(t * (2 + j*0.2) + i * 0.12); pg.fill((i * 4 + j * 40) % 360, 80, 100); pg.circle(p5.prototype.map(i, 0, 50, offsetRad, 0), 0, 5 + b[i % 12] * 0.1); pg.pop(); } } },
    radialEQ: (pg, t, b, p1, p2, p3, st) => { pg.noFill(); pg.strokeWeight(2); pg.stroke(200, 100, 100); pg.circle(0,0,p3 + b[0]*2.5); pg.stroke(120, 100, 100); pg.circle(0,0,p3*1.5 + b[5]*2.5); pg.stroke(320, 100, 100); pg.circle(0,0,p3*2 + b[11]*2.5); },
    floral: (pg, t, b, p1, p2, p3, st) => { pg.fill(140, 70, 100, 65); pg.noStroke(); for(let i=0; i<12; i++){ let l = p3 + b[i]*2.5; pg.push(); pg.rotate(i*Math.PI/6 + t); pg.beginShape(); pg.vertex(0,0); pg.bezierVertex(l/2, -l/2, l, -l/4, l, 0); pg.bezierVertex(l, l/4, l/2, l/2, 0, 0); pg.endShape(); pg.pop(); } },
    kaleid: (pg, t, b, p1, p2, p3, st) => { pg.rotateZ(t); for(let i=0; i<8; i++){ pg.push(); pg.rotate(i*Math.PI/4); pg.fill(i*45, 80, 100, 60); pg.box(60, p5.prototype.map(b[i], 0, 255, 100, 600), 60); pg.pop(); } },
    hex: (pg, t, b, p1, p2, p3, st) => { for(let i=0; i<6; i++){ pg.push(); pg.rotateY(i*Math.PI/3); pg.translate(150, 0); pg.fill(i*60, 80, 100); pg.box(50, p5.prototype.map(b[i*2], 0, 255, 20, p3), 50); pg.pop(); } },
    chladni: (pg, t, b, p1, p2, p3, st) => { [[-350, 0], [0, 0], [350, 0]].forEach((p, i) => { pg.push(); pg.translate(p[0], p[1]); pg.noFill(); pg.stroke(i*120, 80, 100); pg.circle(0, 0, b[i*4] * p2); pg.pop(); }); },
    starfield: (pg, t, b, p1, p2, p3, st) => { pg.strokeWeight(p2*0.2); for(let i=0; i<p1; i++){ pg.stroke(255, 150); pg.push(); pg.translate(p5.prototype.noise(i)*1920-960, p5.prototype.noise(i+1)*1080-540, -(t*1000 + i*50)%2000); pg.line(0,0,0, 0,0,150); pg.pop(); } },
    radar: (pg, t, b, p1, p2, p3, st) => { pg.rotateZ(t); pg.noFill(); for(let i=0; i<24; i++){ let s = p5.prototype.map(b[i % 12], 0, 255, 5, p2 * 10); pg.push(); pg.translate(Math.cos((Math.PI*2)/24*i) * p3, Math.sin((Math.PI*2)/24*i) * p3); pg.stroke(180, 100, 100); pg.drawingContext.shadowBlur = 25; pg.drawingContext.shadowColor = 'cyan'; pg.circle(0, 0, s); pg.pop(); } },
    smoke: (pg, t, b, p1, p2, p3, st) => { for(let i=0; i<30; i++){ pg.fill(0, 0, 100, p5.prototype.map(i, 0, 30, 100, 0)); pg.noStroke(); pg.push(); pg.translate(p5.prototype.noise(t,i)*250-125, -i*30); pg.circle(0,0,p2*6 + i*8 + b[i%12]*0.3); pg.pop(); } },
    mandala: (pg, t, b, p1, p2, p3, st) => { pg.noFill(); pg.strokeWeight(2); for(let i=0; i<12; i++){ pg.push(); pg.rotate(i*Math.PI/6 + t); pg.stroke(i*30, 80, 100); pg.ellipse(p1*2.5, 0, p2*2 + b[i]*2, p2*2 + b[i]*2); pg.pop(); } },
    bars: (pg, t, b, p1, p2, p3, st) => { for(let i=0; i<12; i++){ pg.fill(i*30, 80, 100); pg.rect(i*50-300, 0, 40, -b[i]*2); } },
    fluid: (pg, t, b, p1, p2, p3, st) => { pg.noStroke(); pg.fill(200, 50, 100, 50); for(let i=0; i<10; i++){ pg.ellipse(Math.sin(t+i)*p3, Math.cos(t+i)*p3, b[i], b[i]); } },
    sakura: (pg, t, b, p1, p2, p3, st) => { pg.fill(340, 40, 100, 60); pg.noStroke(); for(let i=0; i<p1/2; i++){ pg.push(); pg.translate(p5.prototype.noise(i)*1000-500, (t*200+i*50)%1000-500); pg.rotate(t); pg.ellipse(0,0,15,10); pg.pop(); } },
    ribbons: (pg, t, b, p1, p2, p3, st) => { pg.noFill(); pg.strokeWeight(3); for(let i=0; i<6; i++){ pg.stroke(i*60, 80, 100); pg.beginShape(); for(let x=-600; x<600; x+=50){ pg.vertex(x, Math.sin(t+x*0.01+i)*100+b[i]); } pg.endShape(); } },
    bokRip: (pg, t, b, p1, p2, p3, st) => { pg.noFill(); pg.stroke(t%360, 80, 100); pg.circle(0,0, p3 + b[0]*2.5); },
    final_void: (pg, t, b, p1, p2, p3, st) => { pg.background(0, 0, p5.prototype.map(b[0], 0, 255, 0, 15)); },
    ripples: (pg, t, b, p1, p2, p3, st) => { for (let x = 0; x < 4; x++) { for (let y = 0; y < 3; y++) { pg.push(); pg.translate(x * 400 - 600, y * 300 - 300); pg.fill((x * 90 + y * 30) % 360, 70, 100, 60); pg.noStroke(); pg.circle(0, 0, b[(x + y) % 12] * p2); pg.pop(); } } }
};