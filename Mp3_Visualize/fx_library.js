/**
 * SPECTRUM STUDIO FX LIBRARY v22.9.6
 * 32종 기존 엔진 + 5종 프리미엄 꽃 엔진 (모란, 해바라기, 데이지, 나팔꽃, 무궁화)
 * 모든 수정 사항 반영 및 문법 오류 교정 완결본
 */

// ─────────────────────────────────────────────
// 공통 헬퍼: 꽃잎 날리기 파티클 (내부 호출용)
// ─────────────────────────────────────────────
const _flyPetal = (pg, t, b, hue, sat, bri, petalW, petalH, seed, count) => {
    let flyCount = Math.floor(p5.prototype.map(b[0], 0, 255, 0, count));
    p5.prototype.randomSeed(seed + Math.floor(t * 2));
    for (let i = 0; i < flyCount; i++) {
        pg.push();
        let ang = p5.prototype.random(TWO_PI);
        let dist = p5.prototype.random(200, 700);
        let life = (t * 0.4 + p5.prototype.random()) % 1;
        let curD = dist * life;
        let alpha = p5.prototype.map(life, 0.6, 1.0, 80, 0);
        pg.translate(Math.cos(ang) * curD, Math.sin(ang) * curD, life * 200);
        pg.rotate(ang + life * PI * 3);
        pg.noStroke();
        pg.fill(hue, sat, bri, alpha);
        pg.beginShape();
        pg.vertex(0, 0);
        pg.bezierVertex(-petalW, -petalH * 0.5, petalW, -petalH * 0.5, 0, 0);
        pg.bezierVertex(-petalW * 0.3, petalH * 0.5, petalW * 0.3, petalH * 0.5, 0, 0);
        pg.endShape(CLOSE);
        pg.pop();
    }
};

window.ENGINES = {
    // 1~5. 프리미엄 꽃 엔진 (신규 통합)
    peony: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[4], hi = b[8];
        let layers = Math.floor(p5.prototype.map(p1, 10, 100, 3, 7));
        let baseHue = st === 'random' ? (t * 20) % 360 : 340;
        pg.push(); pg.noStroke();
        for (let layer = layers; layer >= 0; layer--) {
            let petals = 6 + layer * 2;
            let radius = p3 * (0.35 + layer * 0.12) + vol * 0.3;
            for (let i = 0; i < petals; i++) {
                pg.push();
                let ang = (TWO_PI / petals) * i + t * 0.2 + layer * 0.15;
                let tremor = p5.prototype.map(hi, 0, 255, 0, 8) * Math.sin(t * 8 + i + layer);
                pg.rotateZ(ang + tremor * 0.02); pg.translate(radius, 0); pg.rotateZ(HALF_PI);
                pg.fill(st === 'random' ? (baseHue - layer * 8 + i * 5) % 360 : baseHue - layer * 8, 60 + layer * 5, 95 - layer * 3, 82);
                let pLen = p3 * 0.38 + p5.prototype.map(mid, 0, 255, 0, p3 * 0.15) + tremor;
                pg.beginShape(); pg.vertex(0, 0);
                pg.bezierVertex(-p2 * 1.8, -pLen * 0.4, -p2 * 2, -pLen * 0.8, 0, -pLen);
                pg.bezierVertex(p2 * 2, -pLen * 0.8, p2 * 1.8, -pLen * 0.4, 0, 0);
                pg.endShape(CLOSE); pg.pop();
            }
        }
        pg.fill(50, 90, 100); pg.sphere(p2 * 2 + vol * 0.05); pg.pop();
        _flyPetal(pg, t, b, baseHue, 50, 95, 12, 22, 1001, 18);
    },

    sunflower: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[3], hi = b[9];
        let petals = Math.floor(p5.prototype.map(p1, 10, 100, 16, 28));
        let baseH = st === 'random' ? (t * 15) % 360 : 40;
        pg.push(); pg.noStroke();
        for (let i = 0; i < petals; i++) {
            pg.push();
            let ang = (TWO_PI / petals) * i + t * 0.15;
            let flap = p5.prototype.map(hi, 0, 255, 0, 0.12) * Math.sin(t * 6 + i * 1.3);
            pg.rotateZ(ang + flap); pg.translate(p3 * 0.55 + vol * 0.25, 0); pg.rotateZ(HALF_PI);
            pg.fill(st === 'random' ? (baseH + i * 3) % 360 : baseH + (i % 3) * 8, 85, 98, 90);
            let pLen = p3 * 0.42 + p5.prototype.map(mid, 0, 255, 0, p3 * 0.12);
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-p2 * 2.2, -pLen * 0.35, -p2 * 1.5, -pLen * 0.9, 0, -pLen);
            pg.bezierVertex(p2 * 1.5, -pLen * 0.9, p2 * 2.2, -pLen * 0.35, 0, 0);
            pg.endShape(CLOSE); pg.pop();
        }
        pg.fill(25, 60, 20); pg.push(); pg.translate(0, 0, vol * 0.05); pg.cylinder(p3 * 0.28, 15, 32); pg.pop();
        _flyPetal(pg, t, b, baseH, 85, 98, 14, 26, 2002, 14);
    },

    daisy: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[5], hi = b[10];
        let petals = Math.floor(p5.prototype.map(p1, 10, 100, 18, 36));
        pg.push(); pg.noStroke();
        for (let layer = 0; layer < 2; layer++) {
            for (let i = 0; i < petals; i++) {
                pg.push();
                let ang = (TWO_PI / petals) * i + (layer * PI / petals) + t * 0.1;
                pg.rotateZ(ang); pg.translate(p3 * 0.25 + vol * 0.15, 0); pg.rotateZ(HALF_PI);
                pg.fill(st === 'random' ? (i * 10) % 360 : 0, st === 'random' ? 30 : 5, 97, 88);
                let pLen = p3 * 0.48 + p5.prototype.map(mid, 0, 255, 0, p3 * 0.1) + p5.prototype.map(hi, 0, 255, 0, 10);
                pg.beginShape(); pg.vertex(0, 0);
                pg.bezierVertex(-p2 * 0.8, -pLen * 0.3, -p2 * 0.4, -pLen * 0.85, 0, -pLen);
                pg.bezierVertex(p2 * 0.4, -pLen * 0.85, p2 * 0.8, -pLen * 0.3, 0, 0);
                pg.endShape(CLOSE); pg.pop();
            }
        }
        pg.fill(28, 90, 100); pg.sphere(p3 * 0.18 + vol * 0.08); pg.pop();
        _flyPetal(pg, t, b, 0, 5, 97, 6, 20, 3003, 20);
    },

    morning_glory: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], hi = b[8];
        let baseH = st === 'random' ? (t * 25) % 360 : 265;
        pg.push(); pg.noStroke();
        for (let i = 0; i < 5; i++) {
            pg.push();
            let ang = (TWO_PI / 5) * i + t * 0.2;
            let edgeRipple = p5.prototype.map(hi, 0, 255, 0, 15) * Math.sin(t * 7 + i * 1.2);
            pg.rotateZ(ang);
            pg.fill(st === 'random' ? (baseH + i * 12) % 360 : baseH + i * 4, 75, 88, 85);
            let outerR = p3 * 0.62 + vol * 0.25 + edgeRipple;
            pg.beginShape(); pg.vertex(0, 0);
            for (let a = -PI/5; a <= PI/5; a += 0.1) {
                let rr = outerR + Math.sin(a * 8 + t * 3) * edgeRipple * 0.4;
                pg.vertex(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            pg.vertex(0, 0); pg.endShape(CLOSE); pg.pop();
        }
        pg.fill(60, 20, 100); pg.cylinder(p3 * 0.15 + vol * 0.05, 10); pg.pop();
        _flyPetal(pg, t, b, baseH, 70, 88, 18, 28, 4004, 12);
    },

    hibiscus: (pg, t, b, p1, p2, p3, st) => {
        let vol = b[0], mid = b[3], hi = b[9];
        let baseH = st === 'random' ? (t * 18) % 360 : 0;
        pg.push(); pg.noStroke();
        for (let i = 0; i < 5; i++) {
            pg.push();
            let ang = (TWO_PI / 5) * i + t * 0.15;
            let open = p5.prototype.map(vol, 0, 255, 0.75, 1.15);
            pg.rotateZ(ang); pg.translate(p3 * 0.32 * open, 0); pg.rotateZ(HALF_PI);
            pg.fill(st === 'random' ? (baseH + i * 18) % 360 : baseH, 88, 90, 88);
            let pLen = p3 * 0.60 * open, pW = p2 * 3.0 + p5.prototype.map(hi, 0, 255, 0, 15);
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-pW, -pLen * 0.3, -pW, -pLen * 0.8, 0, -pLen);
            pg.bezierVertex(pW, -pLen * 0.8, pW, -pLen * 0.3, 0, 0);
            pg.endShape(CLOSE); pg.pop();
        }
        let tubeH = p5.prototype.map(mid, 0, 255, 60, 130);
        pg.fill(50, 90, 100); pg.push(); pg.translate(0,0, tubeH/2); pg.cylinder(3, tubeH); pg.pop();
        pg.pop();
        _flyPetal(pg, t, b, baseH, 85, 88, 20, 32, 5005, 16);
    },

    // 6~37. 기존 통합 엔진 (수정 사항 반영본)
    flower_storm: (pg, t, b, p1, p2, p3, st) => {
        let petals = Math.floor(p1 / 10) + 6;
        let volume = b[0];
        pg.push(); pg.noStroke();
        for (let i = 0; i < petals; i++) {
            pg.push();
            let ang = TWO_PI / petals * i + t;
            let d = p3 * 0.5 + p5.prototype.map(volume, 0, 255, 0, p3 * 0.4);
            pg.translate(Math.cos(ang) * d, Math.sin(ang) * d);
            pg.rotate(ang + HALF_PI);
            pg.fill(st === 'random' ? p5.prototype.random(360) : 340, 70, 100, 80);
            pg.beginShape(); pg.vertex(0, 0);
            pg.bezierVertex(-p2*5, -p2*10, p2*5, -p2*10, 0, 0);
            pg.endShape(CLOSE);
            if (volume > 180) {
                pg.push(); pg.translate(Math.cos(t*5+i)*100, Math.sin(t*5+i)*100);
                pg.fill(340, 40, 100, 50); pg.ellipse(0, 0, 10, 5); pg.pop();
            }
            pg.pop();
        }
        pg.fill(50, 90, 100); pg.sphere(p2 * 3 + volume * 0.1); pg.pop();
    },

    flower_b: (pg, t, b, p1, p2, p3, st) => {
        pg.push(); pg.noFill(); pg.strokeWeight(2);
        for(let j = 0; j < 5; j++) {
            let r = (p3 * 0.2 * (j+1)) + b[j%12] * 0.2;
            pg.stroke(st === 'random' ? (t*50+j*30)%360 : 20+j*10, 80, 100);
            pg.beginShape();
            for(let a = 0; a < TWO_PI; a += 0.1) {
                let r2 = r + Math.sin(a * (5 + j)) * (b[0]*0.1);
                pg.vertex(Math.cos(a)*r2, Math.sin(a)*r2, Math.sin(t+j)*20);
            }
            pg.endShape(CLOSE);
        }
        pg.pop();
    },

    grid: (pg, t, b, p1, p2, p3, st) => {
        pg.rotateX(PI / 3);
        for(let y = -8; y < 8; y++) {
            pg.beginShape(TRIANGLE_STRIP);
            pg.fill(180, 80, 40 + y * 5 + b[0]*0.1, 80);
            pg.stroke(180, 100, 100, 30);
            for(let x = -8; x <= 8; x++) {
                let z1 = p5.prototype.noise(x*0.2, y*0.2 + t) * p3 + b[0]*0.5;
                let z2 = p5.prototype.noise(x*0.2, (y+1)*0.2 + t) * p3 + b[0]*0.5;
                pg.vertex(x * 100, y * 100, z1);
                pg.vertex(x * 100, (y+1) * 100, z2);
            }
            pg.endShape();
        }
    },

    tree: (pg, t, b, p1, p2, p3, st) => {
        pg.translate(0, 300); pg.stroke(40, 50, 30);
        const _drawTree = (l, d) => {
            if (d > 7) return;
            let curL = l * ((d > 4) ? p5.prototype.map(b[d % 12], 0, 255, 1.0, 2.0) : 1.0);
            pg.line(0, 0, 0, -curL); pg.translate(0, -curL);
            if (d > 5) {
                pg.push(); pg.noStroke();
                pg.fill(st === 'random' ? p5.prototype.random(360) : 120 + d*10, 80, 100, 70);
                pg.sphere(p2 + b[d%12]*0.1); pg.pop();
            }
            pg.push(); pg.rotate(0.3 + b[0]*0.001); _drawTree(l*0.75, d+1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1]*0.001); _drawTree(l*0.75, d+1); pg.pop();
        };
        _drawTree(p3 * 0.7, 0);
    },

    web: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.stroke(180, 100, 100, 60); pg.strokeWeight(2);
        for (let i = 0; i < 20; i++) {
            let r = p3 + b[i % 12];
            pg.line(Math.cos(t + i) * r, Math.sin(t + i) * r, Math.cos(t + i + 1) * r, Math.sin(t + i + 1) * r);
        }
    },

    bloom: (pg, t, b, p1, p2, p3, st) => {
        pg.fill(st === 'random' ? p5.prototype.random(360) : 320, 100, 100, 40); pg.noStroke();
        pg.ellipse(0, 0, 300 + b[0] * 2.5, 300 + b[0] * 2.5);
    },

    cosmos: (pg, t, b, p1, p2, p3, st) => {
        for (let i = 0; i < p5.prototype.map(b[0], 0, 255, 20, 100); i++) {
            pg.push(); let ang = p5.prototype.noise(i) * TWO_PI; let dst = (t * 800 + i * 40) % 1500;
            pg.translate(Math.cos(ang) * dst, Math.sin(ang) * dst, 0);
            pg.fill(i * 15 % 360, 70, 100); pg.noStroke();
            pg.sphere(p5.prototype.map(dst, 0, 1500, 1, 40) + b[i%12]*0.1); pg.pop();
        }
    },

    polygon: (pg, t, b, p1, p2, p3, st) => {
        let s = Math.floor(p5.prototype.map(p2, 1, 50, 3, 12));
        for (let i = 0; i < 20; i++) {
            pg.push(); pg.translate(0, 0, -i * 150 + (t * 500) % 150); pg.rotateZ(i * 0.1);
            pg.noFill(); pg.stroke(i * 18, 80, 100);
            pg.beginShape();
            for (let a = 0; a < TWO_PI; a += TWO_PI / s) { pg.vertex(Math.cos(a) * p3, Math.sin(a) * p3); }
            pg.endShape(CLOSE); pg.pop();
        }
    },

    nebula: (pg, t, b, p1, p2, p3, st) => {
        pg.noStroke();
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.map(i,0,p1,0,360), 70, 100, 50);
            pg.push(); pg.translate(p5.prototype.noise(t,i)*800-400, p5.prototype.noise(i,t)*600-300);
            pg.sphere(p2 * 2 + b[i%12]*0.15); pg.pop();
        }
    },

    lightning: (pg, t, b, p1, p2, p3, st) => {
        if (b[0] > 160) {
            pg.stroke(60, 20, 100); pg.strokeWeight(p2);
            let lx = 0, ly = -400;
            for (let i = 0; i < 12; i++) {
                let nx = lx + p5.prototype.random(-80, 80), ny = ly + 70;
                pg.line(lx, ly, nx, ny); lx = nx; ly = ny;
            }
        }
    },

    orbit: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.stroke(200, 100, 100); pg.strokeWeight(2); pg.sphere(p3); 
        for(let i = 0; i < p1/8; i++) {
            pg.push(); pg.rotateY(t * (i + 1) * 0.15); pg.translate(p3 * 1.6, 0);
            pg.fill((i * 40) % 360, 80, 100, 80); pg.noStroke(); pg.sphere(10 + b[i % 12] * 0.15); pg.pop();
        }
    },

    triangle: (pg, t, b, p1, p2, p3, st) => {
        let count = Math.floor(p1 / 10) + 1;
        pg.noFill(); pg.stroke(40, 80, 100);
        for(let i = 0; i < count; i++) {
            pg.push(); pg.rotateY(t + i * 0.3); pg.rotateX(t * 0.5);
            pg.cone(p3 + b[i%12], (p3 + b[i%12])*1.2, 3); pg.pop();
        }
    },

    spiral: (pg, t, b, p1, p2, p3, st) => {
        let layers = Math.floor(p1 / 25) + 1;
        for(let j = 0; j < layers; j++) {
            let offsetRad = p3 * (1 + j * 0.4);
            for (let i = 0; i < 50; i++) {
                pg.push(); pg.rotateZ(t * (2 + j*0.2) + i * 0.12); pg.fill((i * 4 + j * 40) % 360, 80, 100);
                pg.circle(p5.prototype.map(i, 0, 50, offsetRad, 0), 0, 5 + b[i % 12] * 0.1); pg.pop();
            }
        }
    },

    radialEQ: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.strokeWeight(2);
        pg.stroke(200, 100, 100); pg.circle(0,0,p3 + b[0]*2.5);
        pg.stroke(120, 100, 100); pg.circle(0,0,p3*1.5 + b[5]*2.5);
        pg.stroke(320, 100, 100); pg.circle(0,0,p3*2 + b[11]*2.5);
    },

    floral: (pg, t, b, p1, p2, p3, st) => {
        pg.fill(140, 70, 100, 65); pg.noStroke();
        for(let i=0; i<12; i++){
            let l = p3 + b[i]*2.5; pg.push(); pg.rotate(i*Math.PI/6 + t);
            pg.beginShape(); pg.vertex(0,0); pg.bezierVertex(l/2, -l/2, l, -l/4, l, 0); 
            pg.bezierVertex(l, l/4, l/2, l/2, 0, 0); pg.endShape(); pg.pop();
        }
    },

    kaleid: (pg, t, b, p1, p2, p3, st) => {
        pg.rotateZ(t);
        for(let i=0; i<8; i++){
            pg.push(); pg.rotate(i*Math.PI/4); pg.fill(i*45, 80, 100, 60); 
            pg.box(60, p5.prototype.map(b[i], 0, 255, 100, 600), 60); pg.pop();
        }
    },

    hex: (pg, t, b, p1, p2, p3, st) => {
        for(let i=0; i<6; i++){
            pg.push(); pg.rotateY(i*Math.PI/3); pg.translate(150, 0);
            pg.fill(i*60, 80, 100); pg.box(50, p5.prototype.map(b[i*2], 0, 255, 20, p3), 50); pg.pop();
        }
    },

    chladni: (pg, t, b, p1, p2, p3, st) => {
        [[-350, 0], [0, 0], [350, 0]].forEach((p, i) => {
            pg.push(); pg.translate(p[0], p[1]); pg.noFill(); pg.stroke(i*120, 80, 100);
            pg.circle(0, 0, b[i*4] * p2); pg.pop();
        });
    },

    starfield: (pg, t, b, p1, p2, p3, st) => {
        pg.strokeWeight(p2*0.2);
        for(let i=0; i<p1; i++){
            pg.stroke(255, 150); pg.push(); 
            pg.translate(p5.prototype.noise(i)*1920-960, p5.prototype.noise(i+1)*1080-540, -(t*1000 + i*50)%2000);
            pg.line(0,0,0, 0,0,150); pg.pop();
        }
    },

    radar: (pg, t, b, p1, p2, p3, st) => {
        pg.rotateZ(t); pg.noFill();
        for(let i=0; i<24; i++){
            let s = p5.prototype.map(b[i % 12], 0, 255, 5, p2 * 10);
            pg.push(); pg.translate(Math.cos((Math.PI*2)/24*i) * p3, Math.sin((Math.PI*2)/24*i) * p3);
            pg.stroke(180, 100, 100); pg.drawingContext.shadowBlur = 25; pg.drawingContext.shadowColor = 'cyan';
            pg.circle(0, 0, s); pg.pop();
        }
    },

    smoke: (pg, t, b, p1, p2, p3, st) => {
        for(let i=0; i<30; i++){
            pg.fill(0, 0, 100, p5.prototype.map(i, 0, 30, 100, 0)); pg.noStroke();
            pg.push(); pg.translate(p5.prototype.noise(t,i)*250-125, -i*30);
            pg.circle(0,0,p2*6 + i*8 + b[i%12]*0.3); pg.pop();
        }
    },

    mandala: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.strokeWeight(2);
        for(let i=0; i<12; i++){
            pg.push(); pg.rotate(i*Math.PI/6 + t); pg.stroke(i*30, 80, 100);
            pg.ellipse(p1*2.5, 0, p2*2 + b[i]*2, p2*2 + b[i]*2); pg.pop();
        }
    },

    bars: (pg, t, b, p1, p2, p3, st) => {
        for(let i=0; i<12; i++){ pg.fill(i*30, 80, 100); pg.rect(i*50-300, 0, 40, -b[i]*2); }
    },

    fluid: (pg, t, b, p1, p2, p3, st) => {
        pg.noStroke(); pg.fill(200, 50, 100, 50);
        for(let i=0; i<10; i++){ pg.ellipse(Math.sin(t+i)*p3, Math.cos(t+i)*p3, b[i], b[i]); }
    },

    sakura: (pg, t, b, p1, p2, p3, st) => {
        pg.fill(340, 40, 100, 60); pg.noStroke();
        for(let i=0; i<p1/2; i++){ 
            pg.push(); pg.translate(p5.prototype.noise(i)*1000-500, (t*200+i*50)%1000-500); 
            pg.rotate(t); pg.ellipse(0,0,15,10); pg.pop(); 
        }
    },

    ribbons: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.strokeWeight(3);
        for(let i=0; i<6; i++){ 
            pg.stroke(i*60, 80, 100); pg.beginShape(); 
            for(let x=-600; x<600; x+=50){ pg.vertex(x, Math.sin(t+x*0.01+i)*100+b[i]); } 
            pg.endShape(); 
        }
    },

    bokRip: (pg, t, b, p1, p2, p3, st) => {
        pg.noFill(); pg.stroke(t%360, 80, 100); pg.circle(0,0, p3 + b[0]*2.5);
    },

    particles: (pg, t, b, p1, p2, p3, st) => {
        p5.prototype.randomSeed(99);
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.random(360), 70, 100); pg.push(); 
            pg.translate(p5.prototype.random(-960,960), p5.prototype.random(-540,540));
            pg.circle(0,0,p5.prototype.random(2, p2) + b[i%12]*0.2); pg.pop();
        }
    },

    matrix: (pg, t, b, p1, p2, p3, st) => {
        pg.textSize(p2 * 5 + 10); pg.textAlign(CENTER, CENTER);
        for(let i = 0; i < 40; i++) {
            let x = (i - 20) * 50; let y = (t * p1 * 300 + i * 200) % 1600 - 800;
            pg.fill(120, 100, p5.prototype.map(b[i % 12], 0, 255, 40, 100));
            pg.text(char(p5.prototype.random(44032, 44100)), x, y);
        }
    },

    final_void: (pg, t, b, p1, p2, p3, st) => {
        pg.background(0, 0, p5.prototype.map(b[0], 0, 255, 0, 15));
    },

    ripples: (pg, t, b, p1, p2, p3, st) => {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                pg.push(); pg.translate(x * 400 - 600, y * 300 - 300);
                pg.fill((x * 90 + y * 30) % 360, 70, 100, 60); pg.noStroke();
                pg.circle(0, 0, b[(x + y) % 12] * p2); pg.pop();
            }
        }
    }
};