/* 
   SPECTRUM STUDIO FX LIBRARY v21.0.36
   Directory: GongB / Mp3_Visualize / fx_library.js
   24 Unique Visual Engines for p5.js WEBGL
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

// --- 24종 독립 FX 함수 객체 ---
const FX_ENGINES = {
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
    }
};