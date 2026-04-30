/* 
   SPECTRUM STUDIO FX LIBRARY v21.1.8
   35 Unique Visual Engines (No Omissions)
   WEBGL Optimized Logic
*/

function applyColorStyle(pg, style, h, i, fI, alphaVal) {
    pg.drawingContext.shadowBlur = 0;
    let a = (alphaVal / 255) * 100;
    if (style === 'hue') { pg.stroke(h, 80, 100, a); pg.fill(h, 80, 100, a * 0.3); }
    else if (style === 'random') { pg.stroke(random(360), 80, 100, a); pg.fill(random(360), 80, 100, a * 0.3); }
    else if (style === 'pastel') { pg.stroke((h + i * 15) % 360, 40, 95, a); pg.fill((h + i * 15) % 360, 40, 95, a * 0.3); }
    else if (style === 'bw') { pg.stroke(0, 0, 100, a); pg.fill(0, 0, 50, a * 0.3); }
    else if (style === 'shadow') {
        pg.stroke(h, 90, 100, a); pg.fill(h, 90, 100, a * 0.1);
        pg.drawingContext.shadowBlur = 20; pg.drawingContext.shadowColor = `hsla(${h}, 100%, 50%, 0.8)`;
    }
    pg.strokeWeight(1.5 * fI);
}

window.FX_ENGINES = {
    waves: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let j = 0; j < floor(p1 / 5) + 1; j++) {
            applyColorStyle(pg, s, h, j, fI, p3);
            pg.beginShape();
            for (let i = -960; i <= 960; i += 60) {
                let y = sin(i * 0.005 + t * (p2 + j * 0.1)) * b[j % 12] * fI;
                pg.vertex(i, j * 80 + y);
            }
            pg.endShape();
        }
    },
    matrix: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.textSize(p2 * 10 + 10);
        let chars = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.fill(h, 80, 100, p3 / 255 * 100);
            pg.text(chars[floor(noise(i, floor(t * p2)) * chars.length)], -960 + (i * (1920 / p1)), (t * 500 + i * 200) % 1080 - 540 + b[i % 12]);
        }
    },
    ripBok: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 2); i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.circle(0, 0, (t * 100 * p2 + i * 150) % 1500 + b[i % 12]);
        }
    },
    bokRip: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.push(); pg.translate(cos(i + t) * b[i % 12] * p2, sin(i + t) * b[i % 12] * p2); pg.sphere(10 + b[i % 12] * 0.1); pg.pop();
        }
    },
    dna: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.push(); pg.translate(cos(i * p2 + t) * 400, sin(i * p2 + t) * 100, 0); pg.box(10 + b[i % 12] / 5); pg.pop();
            applyColorStyle(pg, s, (h + 180) % 360, i, fI, p3);
            pg.push(); pg.translate(cos(i * p2 + t + PI) * 400, sin(i * p2 + t + PI) * 100, 0); pg.box(10 + b[i % 12] / 5); pg.pop();
        }
    },
    nebula: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.noStroke();
        for (let i = 0; i < floor(p1 / 2); i++) {
            pg.fill(h, 80, 100, p3 / 255 * 10);
            pg.push(); pg.translate(noise(i, t) * 1920 - 960, noise(i + 7, t) * 1080 - 540, -500); pg.sphere(200 * p2 + b[0]); pg.pop();
        }
    },
    mandala: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 2); i++) {
            pg.rotateZ(TWO_PI / (p1 / 2));
            applyColorStyle(pg, s, h, i, fI, p3); pg.ellipse(150 * p2 + b[0], 0, 50 + b[1], 150 + b[2]);
        }
    },
    lightning: (pg, t, b, fI, h, s, p1, p2, p3) => {
        if (b[10] > 70 || b[0] > 180) {
            applyColorStyle(pg, s, h, 0, fI * 2, p3);
            for (let i = 0; i < floor(p1 / 5) + 1; i++) pg.line(random(-960, 960), -540, random(-960, 960), 540);
        }
    },
    web: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let pts = [];
        for (let i = 0; i < floor(p1 / 2); i++) pts.push({ x: noise(i, t) * 1600 - 800, y: noise(i + 9, t) * 1000 - 500 });
        applyColorStyle(pg, s, h, 0, fI, p3);
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                if (dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y) < 250 * p2) pg.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
            }
        }
    },
    vortex: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            pg.rotateZ(t * 0.01 * p2); applyColorStyle(pg, s, h, i, fI, p3); pg.box(i * 10 + b[0], i * 10, 20);
        }
    },
    chladni: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 5; i++) {
            applyColorStyle(pg, s, h, i, fI, p3); pg.point(sin(i * t * 0.01 * p2) * 500, cos(i * t * 0.01 * p2) * 500, 0);
        }
    },
    starfield: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 2; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            let r = noise(i, t * 0.1) * 2000 - 1000; pg.line(r, -540, 0, r + b[0] * p2, 540, 0);
        }
    },
    cyber: (pg, t, b, fI, h, s, p1, p2, p3) => {
        applyColorStyle(pg, s, h, 0, fI, p3);
        let step = 1080 / (p1 / 2);
        for (let i = 0; i < p1 / 2; i++) {
            let y = -540 + i * step + (t * 100 % step); pg.line(-960, y, 0, 960, y, 0);
        }
    },
    radar: (pg, t, b, fI, h, s, p1, p2, p3) => {
        applyColorStyle(pg, s, h, 0, fI, p3);
        pg.rotateZ(t * p2); pg.line(0, 0, 0, 0, -400 * p2, 0); pg.noFill(); pg.circle(0, 0, 800 * p2);
    },
    hex: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let j = 1; j < floor(p1 / 8) + 2; j++) {
            applyColorStyle(pg, s, h, j, fI, p3);
            pg.beginShape(); for (let i = 0; i < 6; i++) pg.vertex(cos(i * PI / 3) * j * 120 * p2, sin(i * PI / 3) * j * 120 * p2); pg.endShape(CLOSE);
        }
    },
    flow: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3); pg.line(-960, noise(i, t * 0.5) * 1080 - 540, 960, noise(i + 1, t * 0.5) * 1080 - 540 + b[i % 12]);
        }
    },
    orbit: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            applyColorStyle(pg, s, h, i, fI, p3); pg.rotateY(t * 0.1); pg.ellipse(0, 0, 400 + i * 50, 200 + b[0] * p2);
        }
    },
    tree: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.push(); pg.translate(0, 400); applyColorStyle(pg, s, h, 0, fI, p3);
        const _branch = (l, g) => {
            if (g <= 0) return;
            pg.line(0, 0, 0, -l); pg.translate(0, -l);
            pg.push(); pg.rotateZ(0.4 + sin(t) * 0.1); _branch(l * 0.7, g - 1); pg.pop();
            pg.push(); pg.rotateZ(-0.4 - sin(t) * 0.1); _branch(l * 0.7, g - 1); pg.pop();
        };
        _branch(p2 * 100 + b[0], floor(map(p1, 1, 100, 2, 8))); pg.pop();
    },
    triangles: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            pg.rotateZ(t * 0.1); applyColorStyle(pg, s, h, i, fI, p3); pg.triangle(-50, -50, 50, -50, 0, 50 + b[0] * p2);
        }
    },
    spiral: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1 * 5; i++) {
            let r = i * 4 * p2 + b[0] * 0.1; applyColorStyle(pg, s, h, i, fI, p3); pg.point(cos(i * 0.1 + t) * r, sin(i * 0.1 + t) * r, 0);
        }
    },
    particles: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3);
            pg.push(); pg.translate(noise(i, t) * 1920 - 960, noise(i + 5, t) * 1080 - 540, 0); pg.sphere(3 + b[0] * 0.05 * p2); pg.pop();
        }
    },
    tunnel: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            let r = (t * 200 * p2 + i * 300) % 2000;
            applyColorStyle(pg, s, h, i, fI, p3); pg.push(); pg.translate(0, 0, -r); pg.rect(-500, -500, 1000, 1000); pg.pop();
        }
    },
    warp: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, h, i, fI, p3); pg.line(0, 0, 0, cos(i + t * p2) * 1500, sin(i + t * p2) * 1500, -500);
        }
    },
    ripples: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 / 5); i++) {
            let r = (t * 300 * p2 + i * 400) % 2000;
            applyColorStyle(pg, s, h, i, fI, p3); pg.noFill(); pg.circle(0, 0, r + b[0]);
        }
    },
    bars: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 4) + 4; let barW = 1920 / count; pg.noStroke();
        for (let i = 0; i < count; i++) {
            let band = i % 12; let bHeight = b[band] * p2 * fI;
            pg.fill((h + band * 15) % 360, 80, 100, p3 / 255 * 100); pg.rect(-960 + i * barW, -bHeight / 2, barW - 2, bHeight);
        }
    },
    radialEQ: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let spikes = floor(p1 / 2) + 12; let baseR = 150 * p2; applyColorStyle(pg, s, h, 0, fI, p3); pg.noFill();
        pg.beginShape(); for (let i = 0; i <= spikes; i++) {
            let angle = (TWO_PI / spikes) * i + t * 0.3; let r = baseR + b[i % 12] * p2 * fI * 0.8; pg.curveVertex(cos(angle) * r, sin(angle) * r);
        } pg.endShape(CLOSE);
    },
    terrain: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let cols = floor(p1 / 5) + 6; let cellW = 1920 / cols; pg.push(); pg.rotateX(PI / 3);
        for (let row = 0; row < 8; row++) {
            applyColorStyle(pg, s, (h + row * 20) % 360, row, fI, p3);
            pg.beginShape(TRIANGLE_STRIP); for (let col = 0; col <= cols; col++) {
                pg.vertex(-960 + col * cellW, row * 60 - 200, -noise(col * 0.1, t) * b[row % 12] * p2);
                pg.vertex(-960 + col * cellW, (row + 1) * 60 - 200, -noise(col * 0.1, t + 0.1) * b[(row + 1) % 12] * p2);
            } pg.endShape();
        } pg.pop();
    },
    ribbons: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 10) + 2;
        for (let r = 0; r < count; r++) {
            pg.push(); pg.rotateY(r * (PI / count) + t * 0.2 * p2); applyColorStyle(pg, s, (h + r * 40) % 360, r, fI, p3); pg.noFill();
            pg.beginShape(TRIANGLE_STRIP); for (let i = 0; i <= 40; i++) {
                let x = map(i, 0, 40, -800, 800); let phase = i * 0.1 + t * p2;
                pg.vertex(x, sin(phase) * b[r % 12] * fI - 20); pg.vertex(x, sin(phase + 0.2) * b[r % 12] * fI + 20);
            } pg.endShape(); pg.pop();
        }
    },
    cosmos: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 2) + 10;
        for (let i = 0; i < count; i++) {
            let phase = (t * 0.5 * p2 + i / count) % 1; let dist = phase * 2000; let angle = i * (TWO_PI / count) + t * 0.2;
            pg.push(); pg.translate(cos(angle) * dist, sin(angle) * dist, -dist); pg.rotateX(t + i); pg.rotateY(t * 0.5);
            applyColorStyle(pg, s, (h + i * 10) % 360, i, fI, p3 * (1 - phase));
            if (b[0] > 160 && i % 3 === 0) pg.sphere(30 + b[0] * 0.2);
            else if (i % 2 === 0) pg.box(40 + b[5] * 0.2); else pg.torus(30 + b[10] * 0.2, 10); pg.pop();
        }
    },
    fluid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 * 1.5); i++) {
            let px = noise(i * 0.1, t * 0.1) * 1920 - 960; let py = noise(i * 0.1 + 50, t * 0.1) * 1080 - 540;
            applyColorStyle(pg, s, (h + i * 2) % 360, i, fI, p3); pg.line(px, py, px + b[i % 12] * 0.5 * p2, py + b[i % 12] * 0.5 * p2);
        }
    },
    smoke: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.noStroke(); for (let i = 0; i < floor(p1 * 1.2); i++) {
            let phase = (t * p2 * 0.4 + i * 0.1) % 1; pg.fill((h + i * 5) % 360, 30, 90, map(phase, 0, 1, p3 / 255 * 80, 0));
            pg.push(); pg.translate(noise(i, t) * 600 - 300, 400 - phase * 1000, -200); pg.sphere(30 + b[0] * 0.5 * p2 * (1 + phase)); pg.pop();
        }
    },
    kaleid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let folds = floor(p1 / 10) + 3; let slice = TWO_PI / folds;
        for (let f = 0; f < folds; f++) {
            pg.push(); pg.rotateZ(slice * f); if (f % 2 === 0) pg.scale(1, -1);
            applyColorStyle(pg, s, h, f, fI, p3); pg.noFill(); pg.circle(200 * p2, 0, 50 + b[f % 12] * 0.5); pg.pop();
        }
    },
    bloom: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 5) + 3;
        for (let i = 0; i < count; i++) {
            pg.push(); pg.translate(noise(i, 10) * 1600 - 800, noise(i, 20) * 1000 - 500, 0); pg.rotateZ(t * 0.2 + i);
            applyColorStyle(pg, s, (h + i * 30) % 360, i, fI, p3);
            let petals = 6; let size = (20 + b[i % 12] * 0.5) * p2;
            for (let j = 0; j < petals; j++) { pg.rotateZ(TWO_PI / petals); pg.ellipse(size / 2, 0, size, size * 0.6); }
            pg.circle(0, 0, size * 0.3); pg.pop();
        }
    },
    sakura: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < p1; i++) {
            applyColorStyle(pg, s, (h + i) % 360, i, fI, p3); pg.push();
            let fallSpeed = t * 150 * p2; let x = (noise(i) * 2000 - 1000) + sin(t + i) * 50; let y = (-540 + (i * 100 + fallSpeed) % 1100) - 50;
            pg.translate(x, y, 0); pg.rotateX(t + i); pg.rotateY(t * 0.5);
            let sz = (10 + b[0] * 0.1) * fI; pg.beginShape(); pg.vertex(0, 0); pg.bezierVertex(-sz, -sz, -sz * 1.5, sz, 0, sz); pg.bezierVertex(sz * 1.5, sz, sz, -sz, 0, 0); pg.endShape(); pg.pop();
        }
    },
    floral: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 3) + 5;
        for (let i = 0; i < count; i++) {
            let angle = i * (TWO_PI / count) + t * 0.1; let dist = (t * 300 * p2 + i * 200) % 1200;
            pg.push(); pg.translate(cos(angle) * dist, sin(angle) * dist, -dist * 0.5); pg.rotateZ(angle + t);
            applyColorStyle(pg, s, (h + i * 15) % 360, i, fI, p3 * (1 - dist/1200));
            let petalCount = 5; let petalLen = (30 + b[5] * 0.3) * p2;
            for (let k = 0; k < petalCount; k++) { pg.rotateZ(TWO_PI / petalCount); pg.line(0, 0, petalLen, 0); pg.ellipse(petalLen, 0, 10 + b[10] * 0.2); }
            pg.pop();
        }
    }
};

console.log("FX_LIBRARY v21.1.8: 35 Engines Optimized with Global Orientation.");