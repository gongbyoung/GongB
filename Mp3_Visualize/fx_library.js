/**
 * SPECTRUM STUDIO FX LIBRARY v22.9.4
 * MATRIX 제거 및 FLOWER_STORM (꽃잎 흩날리기) 추가 완결본
 */
window.ENGINES = {
    // 1. Flower Storm: 꽃잎 생성, 주파수 반응 회전 및 발산 (MATRIX 대체)
    flower_storm: (pg, t, b, p1, p2, p3) => {
        let petals = Math.floor(p1 / 10) + 5; // 꽃잎 개수
        let volume = b[0]; // 저음 볼륨
        
        pg.push();
        pg.noStroke();
        for (let i = 0; i < petals; i++) {
            pg.push();
            let angle = TWO_PI / petals * i + t;
            // 주파수와 볼륨에 따라 꽃잎이 피어오르고 바깥으로 밀려남
            let pushOut = p5.prototype.map(volume, 0, 255, 0, p3 * 0.5);
            let x = Math.cos(angle) * (p3 * 0.5 + pushOut);
            let y = Math.sin(angle) * (p3 * 0.5 + pushOut);
            
            pg.translate(x, y);
            pg.rotate(angle + Math.PI / 2);
            
            // 꽃잎 색상 (분홍/빨강 계열)
            pg.fill(340 + Math.sin(t + i) * 20, 70, 100, 80);
            
            // 꽃잎 모양 (두 번째 사진의 유선형 꽃잎 구현)
            pg.beginShape();
            pg.vertex(0, 0);
            pg.bezierVertex(-p2 * 5, -p2 * 10, p2 * 5, -p2 * 10, 0, 0);
            pg.endShape(CLOSE);
            
            // 흩날리는 작은 잎들 추가
            if (volume > 180) {
                pg.push();
                pg.translate(Math.cos(t * 5 + i) * 100, Math.sin(t * 5 + i) * 100);
                pg.fill(340, 40, 100, 50);
                pg.ellipse(0, 0, 10, 5);
                pg.pop();
            }
            pg.pop();
        }
        
        // 꽃술 (중앙 부분)
        pg.fill(50, 90, 100);
        pg.sphere(p2 * 3 + volume * 0.1);
        pg.pop();
    },

    dna: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<24; i++){
            pg.push(); pg.translate(Math.cos(t+i*0.4)*p3, p5.prototype.map(i, 0, 24, -350, 350), Math.sin(t+i*0.3)*p3);
            pg.rotateY(t); pg.fill(200, 80, 100); pg.box(p2 * 2 + b[i%12]*0.2); pg.pop();
        }
    },

    ripbok: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(p2*0.5);
        pg.stroke(200, 100, 100); pg.circle(0, 0, b[0] * 3.5);
        pg.stroke(100, 100, 100); pg.circle(0, 0, b[5] * 3.5);
        pg.stroke(340, 100, 100); pg.circle(0, 0, b[11] * 3.5);
    },

    web: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(180, 100, 100, 60); pg.strokeWeight(2);
        for (let i = 0; i < 20; i++) {
            let r = p3 + b[i % 12];
            pg.line(Math.cos(t + i) * r, Math.sin(t + i) * r, Math.cos(t + i + 1) * r, Math.sin(t + i + 1) * r);
        }
    },

    nebula: (pg, t, b, p1, p2, p3) => {
        pg.noStroke();
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.map(i,0,p1,0,360), 70, 100, 50);
            pg.push(); pg.translate(p5.prototype.noise(t,i)*800-400, p5.prototype.noise(i,t)*600-300);
            pg.sphere(p2 * 2 + b[i%12]*0.15); pg.pop();
        }
    },

    tree: (pg, t, b, p1, p2, p3) => {
        pg.translate(0, 350); pg.stroke(120, 50, 40);
        const _dr = (l, d) => {
            if (d > 7) return;
            let curL = l * ((d > 4) ? p5.prototype.map(b[d % 12], 0, 255, 1.0, 2.2) : 1.0);
            pg.line(0, 0, 0, -curL); pg.translate(0, -curL);
            pg.push(); pg.rotate(0.3 + b[0]*0.001); _dr(l*0.75, d+1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1]*0.001); _dr(l*0.75, d+1); pg.pop();
        };
        _dr(p3 * 0.8, 0);
    },

    cosmos: (pg, t, b, p1, p2, p3) => {
        for (let i = 0; i < p5.prototype.map(b[0], 0, 255, 30, 150); i++) {
            pg.push(); let ang = p5.prototype.noise(i) * TWO_PI; let dst = (t * 800 + i * 40) % 1600;
            pg.translate(Math.cos(ang) * dst, Math.sin(ang) * dst, 0);
            pg.fill(i * 10 % 360, 70, 100); pg.noStroke(); pg.sphere(p5.prototype.map(dst, 0, 1600, 1, 50) + b[i % 12] * 0.15); pg.pop();
        }
    },

    spiral: (pg, t, b, p1, p2, p3) => {
        for(let j = 0; j < p1/25+1; j++) {
            let or = p3 * (1 + j * 0.4);
            for (let i = 0; i < 50; i++) {
                pg.push(); pg.rotateZ(t * (2 + j*0.2) + i * 0.12); pg.fill((i * 4 + j * 40) % 360, 80, 100);
                pg.circle(p5.prototype.map(i, 0, 50, or, 0), 0, 5 + b[i % 12] * 0.1); pg.pop();
            }
        }
    },

    ripple: (pg, t, b, p1, p2, p3) => {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 3; y++) {
                pg.push(); pg.translate(x * 400 - 600, y * 300 - 300);
                pg.fill((x * 90 + y * 30) % 360, 70, 100, 60); pg.noStroke();
                pg.circle(0, 0, b[(x + y) % 12] * p2); pg.pop();
            }
        }
    },

    bloom: (pg, t, b, p1, p2, p3) => {
        pg.fill(320, 100, 100, 40); pg.noStroke();
        pg.ellipse(0, 0, 300 + b[0] * 2.5, 300 + b[0] * 2.5);
    },

    wave: (pg, t, b, p1, p2, p3) => {
        for(let j = 0; j < 6; j++) {
            pg.fill(200, 85, 100 - j * 12, 45); pg.noStroke(); pg.beginShape();
            for(let i = 0; i < 24; i++) { pg.vertex(i * 100 - 1100, Math.sin(t + i * 0.4 + j) * 120 + b[j % 12] + j * 60); }
            pg.vertex(1200, 720); pg.vertex(-1100, 720); pg.endShape(CLOSE);
        }
    },

    grid: (pg, t, b, p1, p2, p3) => {
        pg.rotateX(PI / 3); pg.stroke(180, 80, 100, 50); pg.noFill();
        for(let y = -10; y < 10; y++) {
            pg.beginShape();
            for(let x = -10; x < 10; x++) { pg.vertex(x * 100, y * 100, p5.prototype.noise(x * 0.2, y * 0.2 + t) * p3 + b[0] * 0.6); }
            pg.endShape();
        }
    },

    polygon: (pg, t, b, p1, p2, p3) => {
        let sides = Math.floor(p5.prototype.map(p2, 1, 50, 3, 12));
        for (let i = 0; i < 24; i++) {
            pg.push(); pg.translate(0, 0, -i * 120 + (t * 500) % 120); pg.rotateZ(i * 0.2 + b[i % 12] * 0.01);
            pg.noFill(); pg.stroke(i * 15, 80, 100); pg.beginShape();
            for (let a = 0; a < TWO_PI; a += TWO_PI/sides) { pg.vertex(Math.cos(a) * p3, Math.sin(a) * p3); }
            pg.endShape(CLOSE); pg.pop();
        }
    }
};