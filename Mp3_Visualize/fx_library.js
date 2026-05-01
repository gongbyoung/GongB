/**
 * SPECTRUM STUDIO FX LIBRARY v22.9.3
 * 폰트 에러 해결 및 32종 엔진 전체 포함 완결본
 */
window.ENGINES = {
    // [이미지 파일명 기반 매칭]
    matrix: (pg, t, b, p1, p2, p3) => {
        pg.textSize(p2 * 5 + 10);
        pg.textAlign(CENTER, CENTER);
        for(let i = 0; i < 40; i++) {
            let x = (i - 20) * 50;
            let y = (t * p1 * 300 + i * 200) % 1600 - 800;
            pg.fill(120, 100, p5.prototype.map(b[i % 12], 0, 255, 40, 100));
            pg.text(char(p5.prototype.random(44032, 44100)), x, y);
        }
    },
    dna: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<24; i++){
            let y = p5.prototype.map(i, 0, 24, -350, 350);
            pg.push(); pg.translate(Math.cos(t+i*0.4)*p3, y, Math.sin(t+i*0.3)*p3);
            pg.rotateY(t); pg.fill(200, 80, 100); pg.box(p2 * 2 + b[i%12]*0.2); pg.pop();
        }
    },
    ripbok: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(p2*0.5);
        pg.stroke(200, 100, 100); pg.circle(0, 0, b[0] * 3.5);
        pg.stroke(100, 100, 100); pg.circle(0, 0, b[5] * 3);
        pg.stroke(340, 100, 100); pg.circle(0, 0, b[11] * 2.5);
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
    orbit: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(200, 100, 100); pg.strokeWeight(2); pg.sphere(p3); 
        for(let i = 0; i < p1/8; i++) {
            pg.push(); pg.rotateY(t * (i + 1) * 0.15); pg.translate(p3 * 1.6, 0);
            pg.fill((i * 40) % 360, 80, 100, 80); pg.noStroke(); pg.sphere(10 + b[i % 12] * 0.15); pg.pop();
        }
    },
    tree: (pg, t, b, p1, p2, p3) => {
        pg.translate(0, 350); pg.stroke(120, 50, 40);
        const _drawB = (l, d) => {
            if (d > 7) return;
            let currentL = l * ((d > 4) ? p5.prototype.map(b[d % 12], 0, 255, 1.0, 2.2) : 1.0);
            pg.line(0, 0, 0, -currentL); pg.translate(0, -currentL);
            pg.push(); pg.rotate(0.3 + b[0]*0.001); _drawB(l*0.75, d+1); pg.pop();
            pg.push(); pg.rotate(-0.3 - b[1]*0.001); _drawB(l*0.75, d+1); pg.pop();
        };
        _drawB(p3 * 0.8, 0);
    },
    triangle: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(40, 80, 100);
        for(let i = 0; i < p1/10+1; i++) {
            pg.push(); pg.rotateY(t + i * 0.3); pg.rotateX(t * 0.5);
            pg.cone(p3 + b[i%12], (p3 + b[i%12])*1.2, 3); pg.pop();
        }
    },
    tunnel: (pg, t, b, p1, p2, p3) => {
        let sides = Math.floor(p5.prototype.map(p2, 1, 50, 3, 12));
        for (let i = 0; i < 24; i++) {
            pg.push(); pg.translate(0, 0, -i * 120 + (t * 500) % 120); pg.rotateZ(i * 0.2 + b[i % 12] * 0.01);
            pg.noFill(); pg.stroke(i * 15, 80, 100); pg.beginShape();
            for (let a = 0; a < TWO_PI; a += TWO_PI/sides) { pg.vertex(Math.cos(a) * p3, Math.sin(a) * p3); }
            pg.endShape(CLOSE); pg.pop();
        }
    },
    cosmos: (pg, t, b, p1, p2, p3) => {
        for (let i = 0; i < p5.prototype.map(b[0], 0, 255, 30, 150); i++) {
            pg.push(); let ang = p5.prototype.noise(i) * Math.PI * 2; let dist = (t * 800 + i * 40) % 1600;
            let s = p5.prototype.map(dist, 0, 1600, 1, 50) + b[i % 12] * 0.15;
            pg.translate(Math.cos(ang) * dist, Math.sin(ang) * dist, 0);
            pg.fill(i * 10 % 360, 70, 100); pg.noStroke(); pg.sphere(s); pg.pop();
        }
    },
    particles: (pg, t, b, p1, p2, p3) => {
        p5.prototype.randomSeed(99);
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.random(360), 70, 100); pg.push(); 
            pg.translate(p5.prototype.random(-960,960), p5.prototype.random(-540,540));
            pg.circle(0,0,p5.prototype.random(2, p2) + b[i%12]*0.2); pg.pop();
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
            for(let i = 0; i < 24; i++) {
                pg.vertex(i * 100 - 1100, Math.sin(t + i * 0.4 + j) * 120 + b[j % 12] + j * 60);
            }
            pg.vertex(1200, 720); pg.vertex(-1100, 720); pg.endShape(pg.CLOSE);
        }
    },
    grid: (pg, t, b, p1, p2, p3) => {
        pg.rotateX(Math.PI / 3); pg.stroke(180, 80, 100, 50); pg.noFill();
        for(let y = -10; y < 10; y++) {
            pg.beginShape();
            for(let x = -10; x < 10; x++) {
                pg.vertex(x * 100, y * 100, p5.prototype.noise(x * 0.2, y * 0.2 + t) * p3 + b[0] * 0.6);
            }
            pg.endShape();
        }
    },
    radialEQ: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(2);
        pg.stroke(200, 100, 100); pg.circle(0,0,p3 + b[0]*2.5);
        pg.stroke(120, 100, 100); pg.circle(0,0,p3*1.5 + b[5]*2.5);
        pg.stroke(320, 100, 100); pg.circle(0,0,p3*2 + b[11]*2.5);
    },
    floral: (pg, t, b, p1, p2, p3) => {
        pg.fill(140, 70, 100, 65); pg.noStroke();
        for(let i=0; i<12; i++){
            let l = p3 + b[i]*2.5; pg.push(); pg.rotate(i*Math.PI/6 + t);
            pg.beginShape(); pg.vertex(0,0); pg.bezierVertex(l/2, -l/2, l, -l/4, l, 0); 
            pg.bezierVertex(l, l/4, l/2, l/2, 0, 0); pg.endShape(); pg.pop();
        }
    },
    kaleid: (pg, t, b, p1, p2, p3) => {
        pg.rotateZ(t);
        for(let i=0; i<8; i++){
            pg.push(); pg.rotate(i*Math.PI/4); pg.fill(i*45, 80, 100, 60); 
            pg.box(60, p5.prototype.map(b[i], 0, 255, 100, 600), 60); pg.pop();
        }
    },
    hex: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<6; i++){
            pg.push(); pg.rotateY(i*Math.PI/3); pg.translate(150, 0);
            pg.fill(i*60, 80, 100); pg.box(50, p5.prototype.map(b[i*2], 0, 255, 20, p3), 50); pg.pop();
        }
    },
    chladni: (pg, t, b, p1, p2, p3) => {
        [[-350, 0], [0, 0], [350, 0]].forEach((p, i) => {
            pg.push(); pg.translate(p[0], p[1]); pg.noFill(); pg.stroke(i*120, 80, 100);
            pg.circle(0, 0, b[i*4] * p2); pg.pop();
        });
    },
    starfield: (pg, t, b, p1, p2, p3) => {
        pg.strokeWeight(p2*0.2);
        for(let i=0; i<p1; i++){
            pg.stroke(255, 150); pg.push(); 
            pg.translate(p5.prototype.noise(i)*1920-960, p5.prototype.noise(i+1)*1080-540, -(t*1000 + i*50)%2000);
            pg.line(0,0,0, 0,0,150); pg.pop();
        }
    },
    radar: (pg, t, b, p1, p2, p3) => {
        pg.rotateZ(t); pg.noFill();
        for(let i=0; i<24; i++){
            let s = p5.prototype.map(b[i % 12], 0, 255, 5, p2 * 10);
            pg.push(); pg.translate(Math.cos((Math.PI*2)/24*i) * p3, Math.sin((Math.PI*2)/24*i) * p3);
            pg.stroke(180, 100, 100); pg.drawingContext.shadowBlur = 25; pg.drawingContext.shadowColor = 'cyan';
            pg.circle(0, 0, s); pg.pop();
        }
    },
    smoke: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<30; i++){
            pg.fill(0, 0, 100, p5.prototype.map(i, 0, 30, 100, 0)); pg.noStroke();
            pg.push(); pg.translate(p5.prototype.noise(t,i)*250-125, -i*30);
            pg.circle(0,0,p2*6 + i*8 + b[i%12]*0.3); pg.pop();
        }
    },
    mandala: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(2);
        for(let i=0; i<12; i++){
            pg.push(); pg.rotate(i*Math.PI/6 + t); pg.stroke(i*30, 80, 100);
            pg.ellipse(p1*2.5, 0, p2*2 + b[i]*2, p2*2 + b[i]*2); pg.pop();
        }
    },
    bars: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<12; i++){ pg.fill(i*30, 80, 100); pg.rect(i*50-300, 0, 40, -b[i]*2); }
    },
    fluid: (pg, t, b, p1, p2, p3) => {
        pg.noStroke(); pg.fill(200, 50, 100, 50);
        for(let i=0; i<10; i++){ pg.ellipse(Math.sin(t+i)*p3, Math.cos(t+i)*p3, b[i], b[i]); }
    },
    sakura: (pg, t, b, p1, p2, p3) => {
        pg.fill(340, 40, 100, 60); pg.noStroke();
        for(let i=0; i<p1/2; i++){ 
            pg.push(); pg.translate(p5.prototype.noise(i)*1000-500, (t*200+i*50)%1000-500); 
            pg.rotate(t); pg.ellipse(0,0,15,10); pg.pop(); 
        }
    },
    ribbons: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(3);
        for(let i=0; i<6; i++){ 
            pg.stroke(i*60, 80, 100); pg.beginShape(); 
            for(let x=-600; x<600; x+=50){ pg.vertex(x, Math.sin(t+x*0.01+i)*100+b[i]); } 
            pg.endShape(); 
        }
    },
    bokRip: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(t%360, 80, 100); pg.circle(0,0, p3 + b[0]*2.5);
    },
    final_void: (pg, t, b, p1, p2, p3) => {
        pg.background(0, 0, p5.prototype.map(b[0], 0, 255, 0, 15));
    }
};