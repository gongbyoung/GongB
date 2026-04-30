/* 
   SPECTRUM STUDIO FX LIBRARY v21.1.2
   32 Unique Visual Engines (No Omissions)
  
*/

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

window.FX_ENGINES = {
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
    bars: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 4) + 4;
        let barW = 1920 / count;
        pg.noStroke();
        for (let i = 0; i < count; i++) {
            let band = i % 12;
            let bHeight = b[band] * p2 * fI;
            let hueShift = (h + band * 15) % 360;
            pg.fill(hueShift, 80, 100, (p3 / 255) * 100);
            pg.rect(-960 + i * barW, -bHeight / 2, barW - 2, bHeight);
        }
    },
    radialEQ: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let spikes = floor(p1 / 2) + 12;
        let baseR = 150 * p2;
        applyColorStyle(pg, s, h, 0, fI, p3);
        pg.noFill();
        pg.beginShape();
        for (let i = 0; i <= spikes; i++) {
            let angle = (TWO_PI / spikes) * i + t * 0.3;
            let r = baseR + b[i % 12] * p2 * fI * 0.8;
            pg.curveVertex(cos(angle) * r, sin(angle) * r);
        }
        pg.endShape(CLOSE);
        for (let i = 0; i < spikes; i++) {
            let band = i % 12;
            if (b[band] < 30) continue;
            applyColorStyle(pg, s, (h + i * 8) % 360, i, fI, p3);
            let angle = (TWO_PI / spikes) * i + t * 0.3;
            pg.line(cos(angle) * baseR * 0.6, sin(angle) * baseR * 0.6, cos(angle) * (baseR + b[band] * p2 * fI), sin(angle) * (baseR + b[band] * p2 * fI));
        }
    },
    terrain: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let cols = floor(p1 / 5) + 6;
        let cellW = 1920 / cols;
        pg.push(); pg.translate(0, 100); pg.rotateX(PI / 4);
        for (let row = 0; row < 7; row++) {
            applyColorStyle(pg, s, (h + row * 20) % 360, row, fI, p3);
            pg.beginShape(TRIANGLE_STRIP);
            for (let col = 0; col <= cols; col++) {
                pg.vertex(-960 + col * cellW, row * 40 - 150, -noise(col * 0.15, row * 0.15, t * 0.4) * b[row % 12] * p2 * fI);
                pg.vertex(-960 + col * cellW, (row + 1) * 40 - 150, -noise(col * 0.15, (row + 1) * 0.15, t * 0.4) * b[(row + 1) % 12] * p2 * fI);
            }
            pg.endShape();
        }
        pg.pop();
    },
    ribbons: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let count = floor(p1 / 10) + 2;
        for (let r = 0; r < count; r++) {
            pg.push(); pg.rotateY(r * (PI / count) + t * 0.1 * p2);
            applyColorStyle(pg, s, (h + r * 40) % 360, r, fI, p3);
            pg.noFill(); pg.beginShape(TRIANGLE_STRIP);
            for (let i = 0; i <= 60; i++) {
                let x = map(i, 0, 60, -900, 900);
                let phase = i * 0.08 + t * p2 + r * 1.2;
                let amp = b[r % 12] * fI * 0.8;
                let thick = 10 + b[(r + 2) % 12] * 0.1 * fI;
                pg.vertex(x, sin(phase) * amp - thick);
                pg.vertex(x, sin(phase + 0.3) * amp + thick);
            }
            pg.endShape(); pg.pop();
        }
    },
    glitch: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let slices = floor(p1 / 3) + 5;
        let sliceH = 1080 / slices;
        let hiEnergy = (b[8] + b[9] + b[10] + b[11]) / 4;
        pg.textSize(80 + b[0] * 0.3 * fI); pg.textAlign(CENTER, CENTER);
        let chars = ['MUSIC','SOUND','WAVE','BEAT','FLUX','DATA','SYNC','GLITCH'];
        for (let i = 0; i < slices; i++) {
            let offsetX = (hiEnergy > 100) ? random(-p2 * 80, p2 * 80) : 0;
            let y = -540 + i * sliceH + sliceH / 2;
            applyColorStyle(pg, s, (h + i * 20) % 360, i, fI, p3);
            pg.fill(pg.drawingContext.strokeStyle);
            pg.text(chars[floor(noise(i + 5, t * 0.5) * chars.length)], offsetX, y);
        }
    },
    fluid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        for (let i = 0; i < floor(p1 * 1.5); i++) {
            let seed = i * 0.07;
            let px = noise(seed, t * 0.2 * p2) * 1920 - 960;
            let py = noise(seed + 30, t * 0.2 * p2) * 1080 - 540;
            let angle = noise(seed + 60, t * 0.1) * TWO_PI * 2 + b[0] * 0.005 * p2;
            let nx = px + cos(angle) * (20 + b[i % 12] * 0.5) * fI * p2;
            let ny = py + sin(angle) * (20 + b[i % 12] * 0.5) * fI * p2;
            applyColorStyle(pg, s, (h + i * 3) % 360, i, fI, p3);
            pg.line(px, py, nx, ny);
        }
    },
    smoke: (pg, t, b, fI, h, s, p1, p2, p3) => {
        pg.noStroke();
        for (let i = 0; i < floor(p1 * 1.2); i++) {
            let phase = (t * p2 * 0.5 + i * 0.13) % 1;
            pg.fill((h + i * 5) % 360, 30, 90, map(phase, 0, 1, p3 / 255 * 60, 0));
            pg.circle(noise(i * 0.3, t * 0.15) * 600 - 300 + b[i % 12] * 0.5 * p2, map(phase, 0, 1, 400, -700), map(phase, 0, 1, 20, 250 + b[0] * 0.5 * p2) * fI);
        }
    },
    kaleid: (pg, t, b, fI, h, s, p1, p2, p3) => {
        let folds = floor(p1 / 10) + 3;
        let slice = TWO_PI / folds;
        for (let f = 0; f < folds; f++) {
            pg.push(); pg.rotate(slice * f); if (f % 2 === 0) pg.scale(1, -1);
            for (let k = 0; k < 6; k++) {
                applyColorStyle(pg, s, (h + k * 30 + t * 20) % 360, k, fI, p3);
                pg.noFill(); pg.circle((50 + k * 60) * p2, 0, 20 + b[k % 12] * 0.4 * fI);
            }
            pg.pop();
        }
    }
};

console.log("FX_LIBRARY v21.1.2 Fully Loaded.");