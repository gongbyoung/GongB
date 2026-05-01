/**
 * SPECTRUM STUDIO FX LIBRARY v22.6.7
 * 32+ High-End Procedural Engines (No Omissions)
 */
window.ENGINES = {
    // 1~27: 팀장님 수정 요청 사항 반영 (24분할, 3밴드 반응, 글로우 등)
    matrix: (pg, t, b, p1, p2, p3) => {
        let speed = p1 * 0.15; pg.textSize(p2 * 5 + 10);
        for(let i=0; i<30; i++){
            pg.fill(120, 100, p5.prototype.map(b[i%12], 0, 255, 30, 100));
            pg.text(char(p5.prototype.random(44032, 44100)), (i-15)*50, (t*speed*1000 + i*150)%1500 - 750);
        }
    },
    dna: (pg, t, b, p1, p2, p3) => {
        let rad = p1 * 3; let cSz = p2 * 8;
        for(let i=0; i<24; i++){
            pg.push(); pg.translate(Math.cos(t+i*0.4)*rad, p5.prototype.map(i, 0, 24, -350, 350), Math.sin(t+i*0.3)*rad);
            pg.rotateY(t); pg.fill(200, 80, 100); pg.box(cSz + b[i%12]*0.2); pg.pop();
        }
    },
    ripbok: (pg, t, b, p1, p2, p3) => { // 3개 써클 저/중/고 반응
        pg.noFill(); pg.strokeWeight(p2);
        pg.stroke(200, 100, 100); pg.circle(0, 0, b[0] * 4);
        pg.stroke(100, 100, 100); pg.circle(0, 0, b[5] * 3.5);
        pg.stroke(340, 100, 100); pg.circle(0, 0, b[11] * 3);
    },
    nebula: (pg, t, b, p1, p2, p3) => {
        pg.noStroke();
        for(let i=0; i<p1; i++){
            pg.fill(p5.prototype.map(i,0,p1,0,360), 70, 100, 50);
            pg.push(); pg.translate(p5.prototype.noise(t,i)*800-400, p5.prototype.noise(i,t)*600-300);
            pg.sphere(p2 * 3 + b[i%12]*0.15); pg.pop();
        }
    },
    mandala: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.strokeWeight(2);
        for(let i=0; i<12; i++){
            pg.push(); pg.rotate(i*Math.PI/6 + t); pg.stroke(i*30, 80, 100);
            pg.ellipse(p1*2, 0, p2*2 + b[i]*2, p2*2 + b[i]*2); pg.pop();
        }
    },
    lightning: (pg, t, b, p1, p2, p3) => { // 잔상 효과 포함
        if(b[0] > 190) {
            pg.stroke(60, 20, 100); pg.strokeWeight(p5.prototype.random(2, 8));
            let lx = 0, ly = -400;
            for(let i=0; i<15; i++) {
                let nx = lx + p5.prototype.random(-70, 70), ny = ly + 65;
                pg.line(lx, ly, nx, ny); lx = nx; ly = ny;
            }
        }
    },
    web: (pg, t, b, p1, p2, p3) => { // 베지어 곡선 흐느적
        pg.noFill(); pg.stroke(180, 100, 100, 50);
        for(let i=0; i<12; i++){
            let x1 = Math.cos(t+i)*p3, y1 = Math.sin(t+i)*p3;
            let x2 = Math.cos(t+i+1)*p3, y2 = Math.sin(t+i+1)*p3;
            pg.bezier(x1, y1, b[i]*2, b[(i+1)%12]*2, -b[i]*2, -b[(i+1)%12]*2, x2, y2);
        }
    },
    vortex: (pg, t, b, p1, p2, p3) => { // Z축 차등 높이
        for(let i=0; i<p1; i++) {
            pg.push(); pg.rotateZ(t + i*0.1); pg.noFill(); pg.stroke(i*12, 80, 100);
            pg.rect(-200, -200, 400, 400); pg.translate(0, 0, Math.sin(t + i*0.5) * p3); pg.pop();
        }
    },
    chladni: (pg, t, b, p1, p2, p3) => { // 3중 써클 저/중/고
        let ct = [[-350, 0], [0, 0], [350, 0]];
        ct.forEach((p, i) => {
            pg.push(); pg.translate(p[0], p[1]); pg.noFill(); pg.stroke(i*120, 80, 100);
            pg.circle(0, 0, b[i*4] * p2); pg.pop();
        });
    },
    starfield: (pg, t, b, p1, p2, p3) => {
        pg.strokeWeight(p2);
        for(let i=0; i<p1; i++){
            pg.stroke(255, 150); let z = (t*1000 + i*50)%2000;
            pg.push(); pg.translate(p5.prototype.noise(i)*1920-960, p5.prototype.noise(i+1)*1080-540, -z);
            pg.line(0,0,0, 0,0,150); pg.pop();
        }
    },
    cyber: (pg, t, b, p1, p2, p3) => { // 그라데이션 채우기
        for(let i=0; i<10; i++){
            let y = p5.prototype.map(i, 0, 10, -400, 400);
            pg.fill(pg.lerpColor(pg.color(180, 100, 100), pg.color(280, 100, 100), i/10)); pg.noStroke();
            pg.rect(-960, y, 1920, 10 + b[i]);
        }
    },
    radar: (pg, t, b, p1, p2, p3) => { // 24개 개체 + 글로우
        pg.rotateZ(t); pg.noFill();
        for(let i=0; i<24; i++){
            let ang = (Math.PI*2)/24*i; let s = p5.prototype.map(b[i%12], 0, 255, 5, p2*10);
            pg.push(); pg.translate(Math.cos(ang)*p3, Math.sin(ang)*p3);
            pg.stroke(180, 100, 100); pg.drawingContext.shadowBlur = 25; pg.drawingContext.shadowColor = 'cyan';
            pg.rect(-s/2, -s/2, s, s); pg.pop();
        }
    },
    hex: (pg, t, b, p1, p2, p3) => { // 안쪽 높이 타워형
        for(let i=0; i<6; i++){
            let h = p5.prototype.map(b[i*2], 0, 255, 20, p3);
            pg.push(); pg.rotateY(i*Math.PI/3); pg.translate(150, 0);
            pg.fill(i*60, 80, 100); pg.box(50, h, 50); pg.pop();
        }
    },
    flow: (pg, t, b, p1, p2, p3) => { // 닫힌 도형 안쪽 채우기
        pg.beginShape(); pg.fill(t*20%360, 80, 100, 50);
        for(let i=0; i<12; i++){ pg.vertex(Math.cos(t+i)*p3 + b[i], Math.sin(t+i)*p3 + b[i]); }
        pg.endShape(pg.CLOSE);
    },
    orbit: (pg, t, b, p1, p2, p3) => { // 보색 위성 5% 추가
        pg.fill(200, 80, 100); pg.sphere(p3 + b[0]*0.2);
        pg.push(); pg.rotateY(t); pg.translate(p3*1.15, 0);
        pg.fill(20, 80, 100); pg.sphere(p3*0.05 + b[5]*0.1); pg.pop();
    },
    tree: (pg, t, b, p1, p2, p3) => { // 24가지 발생 + 끝단 꽃
        pg.translate(0, 400); pg.stroke(120, 50, 40);
        const _tr = (l, d) => {
            if(d > 8) return;
            pg.line(0,0,0,-l); pg.translate(0,-l);
            if(d === 8) { pg.noStroke(); pg.fill(330, 100, 100); pg.drawingContext.shadowBlur = 30; pg.circle(0, 0, b[0]*0.25); }
            pg.push(); pg.rotate(0.35 + b[0]*0.001); _tr(l*0.75, d+1); pg.pop();
            pg.push(); pg.rotate(-0.35 - b[1]*0.001); _tr(l*0.75, d+1); pg.pop();
        };
        _tr(p3, 0);
    },
    triangle: (pg, t, b, p1, p2, p3) => { // 3D Pyramid 입체화
        pg.rotateY(t); pg.fill(40, 80, 100, 60); pg.cone(p3 + b[0], p3*1.5 + b[5], 4);
    },
    spiral: (pg, t, b, p1, p2, p3) => { // 블랙홀 흡입 효과
        for(let i=0; i<p1; i++){
            let r = p5.prototype.map(i, 0, p1, 800, 0);
            pg.push(); pg.rotateZ(t*2 + i*0.1); pg.fill(i*3, 80, 100);
            pg.circle(r, 0, 5 + b[i%12]*0.15); pg.pop();
        }
    },
    particles: (pg, t, b, p1, p2, p3) => { // 랜덤 최소/최대 설정
        p5.prototype.randomSeed(99);
        for(let i=0; i<p1; i++){
            let s = p5.prototype.random(2, p2) + b[i%12]*0.2;
            pg.fill(p5.prototype.random(360), 70, 100);
            pg.push(); pg.translate(p5.prototype.random(-960,960), p5.prototype.random(-540,540));
            pg.circle(0,0,s); pg.pop();
        }
    },
    tunnel: (pg, t, b, p1, p2, p3) => { // 24개 삼각형 일렬 회전
        for(let i=0; i<24; i++){
            pg.push(); pg.translate(0, 0, -i*150 + (t*600)%150);
            pg.rotateZ(i*0.2 + b[i%12]*0.01); pg.noFill(); pg.stroke(i*15, 80, 100);
            pg.triangle(-150, 150, 0, -150, 150, 150); pg.pop();
        }
    },
    ripple: (pg, t, b, p1, p2, p3) => { // 12분할 그리드
        for(let x=0; x<4; x++){
            for(let y=0; y<3; y++){
                pg.push(); pg.translate(x*400-600, y*300-300);
                pg.noFill(); pg.stroke(200, 80, 100); pg.circle(0,0,b[(x+y)%12]*3); pg.pop();
            }
        }
    },
    radialEQ: (pg, t, b, p1, p2, p3) => { // 3중 동심원 저중고
        pg.noFill();
        pg.stroke(200, 100, 100); pg.circle(0,0,400 + b[0]*2);
        pg.stroke(120, 100, 100); pg.circle(0,0,600 + b[5]*2);
        pg.stroke(320, 100, 100); pg.circle(0,0,800 + b[11]*2);
    },
    cosmos: (pg, t, b, p1, p2, p3) => { // 사방 랜덤 각도 발산
        for(let i=0; i<p1; i++){
            pg.push(); pg.rotateX(p5.prototype.noise(i)*Math.PI*2); pg.rotateY(p5.prototype.noise(i+t)*Math.PI*2);
            pg.translate(0, 0, (t*1200+i*30)%2000);
            pg.fill(i*5%360, 70, 100); pg.sphere(10 + b[i%12]*0.2); pg.pop();
        }
    },
    smoke: (pg, t, b, p1, p2, p3) => { // 알파값 감소 + 시작 굵기
        for(let i=0; i<30; i++){
            pg.fill(0, 0, 100, p5.prototype.map(i, 0, 30, 100, 0)); pg.noStroke();
            pg.push(); pg.translate(p5.prototype.noise(t,i)*250-125, -i*30);
            pg.circle(0,0,p2*5 + i*8 + b[i%12]*0.3); pg.pop();
        }
    },
    kaleid: (pg, t, b, p1, p2, p3) => { // 입체 높이 변화
        pg.rotateZ(t);
        for(let i=0; i<8; i++){
            pg.push(); pg.rotate(i*Math.PI/4);
            pg.fill(i*45, 80, 100, 60); pg.box(60, p5.prototype.map(b[i*1], 0, 255, 100, 500), 60); pg.pop();
        }
    },
    floral: (pg, t, b, p1, p2, p3) => { // 베지어 잎 모양
        pg.fill(140, 70, 100, 65); pg.noStroke();
        for(let i=0; i<12; i++){
            let l = 150 + b[i]*2;
            pg.push(); pg.rotate(i*Math.PI/6 + t);
            pg.beginShape(); pg.vertex(0,0);
            pg.bezierVertex(l/2, -l/2, l, -l/4, l, 0); pg.bezierVertex(l, l/4, l/2, l/2, 0, 0);
            pg.endShape(); pg.pop();
        }
    },
    bloom: (pg, t, b, p1, p2, p3) => { // 네온 글로우 스피어
        pg.drawingContext.shadowBlur = 40; pg.drawingContext.shadowColor = 'magenta';
        pg.fill(320, 100, 100, 50); pg.sphere(250 + b[0]);
    },

    // 28~32+: 기존에 잘 작동하던 기타 엔진들 (삭제 없이 유지)
    wave: (pg, t, b, p1, p2, p3) => {
        pg.noFill(); pg.stroke(180, 80, 100);
        pg.beginShape(); for(let i=0; i<20; i++){ pg.vertex(i*50-500, Math.sin(t+i)*100 + b[i%12]); } pg.endShape();
    },
    grid: (pg, t, b, p1, p2, p3) => {
        pg.stroke(255, 30); for(let i=-10; i<=10; i++){ pg.line(i*50, -500, i*50, 500); pg.line(-500, i*50, 500, i*50); }
    },
    rings: (pg, t, b, p1, p2, p3) => {
        for(let i=0; i<5; i++){ pg.noFill(); pg.stroke(i*60, 70, 100); pg.circle(0, 0, 100*i + b[i]*2); }
    },
    glitch: (pg, t, b, p1, p2, p3) => {
        if(b[0]>200) { pg.fill(random(360), 100, 100); pg.rect(random(-500,500), random(-300,300), 200, 20); }
    },
    final_void: (pg, t, b, p1, p2, p3) => {
        pg.background(0, 0, map(b[0], 0, 255, 0, 15));
    }
};