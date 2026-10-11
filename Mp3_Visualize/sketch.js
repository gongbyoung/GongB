let song;
let fft;
let particles = [];
let currentVerse = 0;
let calligraphyAlpha = 0;
let audioStarted = false;
let fileInput;

// 구절 정보 (실제 가사와 시간으로 수정하세요)
let verses = [
  { start: 0, end: 18, keyword: "달빛 소나무", text: "달빛이 소나무에 스며들고" },
  { start: 18, end: 35, keyword: "비 오는 대나무", text: "빗방울이 대숲을 적시네" }
];

function setup() {
  createCanvas(1080, 1920);
  background(248, 243, 230);

  // 음악 선택 버튼
  fileInput = createFileInput(handleFile);
  fileInput.attribute("accept", "audio/*");
  fileInput.position(20, 20);
}

function handleFile(file) {
  if (file.type === "audio") {
    if (song) {
      song.stop();
      audioStarted = false;
    }

    song = loadSound(file.data, () => {
      fft = new p5.FFT(0.85, 1024);
      console.log("음악 로드 완료:", file.name);
      song.play();
      audioStarted = true;
    });
  } else {
    console.log("오디오 파일이 아닙니다.");
  }
}

function draw() {
  // 한지 느낌 유지
  fill(248, 243, 230, 12);
  noStroke();
  rect(0, 0, width, height);

  // 음악이 아직 선택되지 않았을 때
  if (!song) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("왼쪽 위 버튼을 눌러\n음악을 선택해주세요", width / 2, height / 2);
    return;
  }

  // 음악이 로드됐지만 재생이 안 된 경우
  if (!audioStarted || !song.isPlaying()) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("화면을 클릭하면 음악이 시작됩니다", width / 2, height / 2);

    if (mouseIsPressed) {
      song.play();
      audioStarted = true;
    }
    return;
  }

  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let mid = fft.getEnergy("mid");
  let treble = fft.getEnergy("treble");
  let overall = fft.getEnergy(20, 20000);

  // 현재 구절 자동 전환
  let t = song.currentTime();
  for (let i = 0; i < verses.length; i++) {
    if (t >= verses[i].start && t < verses[i].end) {
      currentVerse = i;
      break;
    }
  }

  // 주파수에 따라 먹 입자 생성
  if (frameCount % 3 === 0) {
    // Bass → 산
    let bassCount = floor(map(bass, 0, 255, 0, 4));
    for (let i = 0; i < bassCount; i++) {
      particles.push(new Ink(
        random(width * 0.15, width * 0.85),
        height * 0.65 + random(-80, 40),
        map(bass, 0, 255, 12, 40),
        0
      ));
    }
    // Mid → 대나무/나무
    let midCount = floor(map(mid, 0, 255, 0, 3));
    for (let i = 0; i < midCount; i++) {
      particles.push(new Ink(
        random(width * 0.2, width * 0.8),
        height * 0.4 + random(-100, 100),
        map(mid, 0, 255, 4, 14),
        1
      ));
    }
    // Treble → 가는 가지/구름
    if (treble > 80) {
      particles.push(new Ink(
        random(width),
        random(height * 0.1, height * 0.5),
        map(treble, 0, 255, 2, 8),
        2
      ));
    }
  }

  // 입자 그리기
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].dead()) particles.splice(i, 1);
  }

  // 캘리그라피
  calligraphyAlpha = lerp(calligraphyAlpha, map(overall, 0, 255, 30, 220), 0.05);
  drawCalligraphy(verses[currentVerse].text, calligraphyAlpha);
}

// 먹 입자 클래스
class Ink {
  constructor(x, y, size, type) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.3, 1.8));
    this.size = size;
    this.life = 255;
    this.type = type;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= random(1.8, 4.5);
    this.size *= 0.985;
  }

  show() {
    noStroke();
    fill(18, 18, 18, this.life * 0.55);
    if (this.type === 1) {
      ellipse(this.pos.x, this.pos.y, this.size * 0.4, this.size * 1.8);
    } else {
      ellipse(this.pos.x, this.pos.y, this.size);
    }
  }

  dead() {
    return this.life < 8;
  }
}

// 세로 캘리그라피
function drawCalligraphy(txt, alpha) {
  push();
  translate(width * 0.88, height * 0.12);
  textAlign(CENTER, TOP);
  textSize(38);
  fill(12, 12, 12, alpha);
  for (let i = 0; i < txt.length; i++) {
    text(txt[i], 0, i * 48);
  }
  pop();
}
