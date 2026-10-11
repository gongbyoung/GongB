let song = null;
let fft = null;
let inkLayer;
let audioStarted = false;
let subtitles = [];          // SRT 파싱 결과
let currentSub = null;
let statusEl;

// 키워드 → 그림 스타일 매핑
const keywordStyles = {
  "달": "moon",
  "월": "moon",
  "소나무": "pine",
  "솔": "pine",
  "대나무": "bamboo",
  "대": "bamboo",
  "비": "rain",
  "우": "rain",
  "강": "river",
  "물": "river",
  "산": "mountain",
  "봉": "mountain",
  "꽃": "flower",
  "매화": "flower",
  "벚": "flower",
  "구름": "cloud",
  "안개": "cloud",
  "새": "bird",
  "학": "bird",
  "바람": "wind"
};

function setup() {
  createCanvas(1080, 1920);
  inkLayer = createGraphics(width, height);
  inkLayer.background(248, 243, 230);

  statusEl = document.getElementById("status");

  document.getElementById("musicInput").addEventListener("change", handleMusic);
  document.getElementById("srtInput").addEventListener("change", handleSRT);
  document.getElementById("startBtn").addEventListener("click", startExperience);
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function handleMusic(e) {
  const file = e.target.files[0];
  if (!file) return;

  setStatus("음악 로딩 중...");
  if (song) {
    song.stop();
    song = null;
    audioStarted = false;
  }

  const url = URL.createObjectURL(file);
  song = loadSound(url,
    () => {
      fft = new p5.FFT(0.8, 1024);
      setStatus("음악 로드 완료");
    },
    (err) => setStatus("음악 로드 실패")
  );
}

function handleSRT(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    subtitles = parseSRT(event.target.result);
    setStatus(`SRT 로드 완료 (${subtitles.length}개 구절)`);
    console.log(subtitles);
  };
  reader.readAsText(file, "UTF-8");
}

// SRT 파서
function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const result = [];

  for (let block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    const timeLine = lines[1];
    const match = timeLine.match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
    if (!match) continue;

    const start = timeToSeconds(match[1], match[2], match[3], match[4]);
    const end   = timeToSeconds(match[5], match[6], match[7], match[8]);
    const textContent = lines.slice(2).join(" ").trim();

    result.push({ start, end, text: textContent });
  }
  return result;
}

function timeToSeconds(h, m, s, ms) {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function startExperience() {
  if (!song) {
    setStatus("음악을 먼저 선택해주세요");
    return;
  }
  if (subtitles.length === 0) {
    setStatus("SRT 파일을 선택해주세요");
    return;
  }

  if (!song.isPlaying()) {
    song.play();
  }
  audioStarted = true;
  setStatus("재생 중...");
}

function draw() {
  background(248, 243, 230);
  image(inkLayer, 0, 0);

  if (!audioStarted || !song) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(28);
    text("음악과 SRT를 선택한 뒤\n「시작하기」를 눌러주세요", width/2, height/2);
    return;
  }

  // 현재 시간에 맞는 자막 찾기
  const t = song.currentTime();
  currentSub = null;
  for (let sub of subtitles) {
    if (t >= sub.start && t <= sub.end) {
      currentSub = sub;
      break;
    }
  }

  // 주파수 분석
  let bass = 0, mid = 0, treble = 0, overall = 0;
  if (fft) {
    fft.analyze();
    bass = fft.getEnergy("bass");
    mid = fft.getEnergy("mid");
    treble = fft.getEnergy("treble");
    overall = fft.getEnergy(20, 20000);
  }

  // 현재 가사에 맞는 스타일 결정
  let styles = detectStyles(currentSub ? currentSub.text : "");

  // 그림 그리기
  if (frameCount % 3 === 0) {
    drawInkByStyle(styles, bass, mid, treble);
  }

  // 가사 표시
  if (currentSub) {
    displayLyric(currentSub.text, overall);
  }
}

// 가사에서 키워드 추출
function detectStyles(text) {
  const found = new Set();
  for (let key in keywordStyles) {
    if (text.includes(key)) {
      found.add(keywordStyles[key]);
    }
  }
  // 키워드가 없으면 기본 스타일
  if (found.size === 0) found.add("default");
  return Array.from(found);
}

// 스타일별 그림 그리기
function drawInkByStyle(styles, bass, mid, treble) {
  inkLayer.noStroke();

  styles.forEach(style => {
    if (style === "mountain" || style === "default") {
      // 산
      if (bass > 30) {
        let x = random(width * 0.1, width * 0.9);
        let y = random(height * 0.55, height * 0.9);
        let size = map(bass, 30, 255, 50, 130);
        inkLayer.fill(20, 20, 20, map(bass, 30, 255, 10, 30));
        inkLayer.ellipse(x, y, size * random(1, 1.6), size * random(0.5, 0.8));
      }
    }

    if (style === "bamboo" || style === "pine") {
      // 대나무 / 소나무
      if (mid > 40) {
        let x = random(width * 0.15, width * 0.85);
        let y = random(height * 0.15, height * 0.7);
        let h = map(mid, 40, 255, 60, 180);
        let w = style === "bamboo" ? map(mid, 40, 255, 4, 11) : map(mid, 40, 255, 8, 20);
        inkLayer.fill(15, 15, 15, map(mid, 40, 255, 18, 50));
        inkLayer.push();
        inkLayer.translate(x, y);
        inkLayer.rotate(random(-0.15, 0.15));
        inkLayer.ellipse(0, 0, w, h);
        inkLayer.pop();
      }
    }

    if (style === "moon") {
      // 달
      if (frameCount % 20 === 0) {
        inkLayer.fill(30, 30, 30, 25);
        inkLayer.ellipse(width * 0.75, height * 0.18, 90, 90);
        inkLayer.fill(248, 243, 230, 40);
        inkLayer.ellipse(width * 0.75 + 12, height * 0.18 - 8, 70, 70); // 약간 가려진 느낌
      }
    }

    if (style === "rain") {
      // 비
      inkLayer.stroke(40, 40, 40, 30);
      inkLayer.strokeWeight(1.2);
      for (let i = 0; i < 8; i++) {
        let x = random(width);
        let y = random(height * 0.1, height * 0.7);
        inkLayer.line(x, y, x - 4, y + random(20, 45));
      }
      inkLayer.noStroke();
    }

    if (style === "river" || style === "cloud") {
      // 강 / 구름 (부드러운 형태)
      if (treble > 50) {
        let x = random(width);
        let y = style === "cloud" ? random(height * 0.08, height * 0.35) : random(height * 0.7, height * 0.9);
        inkLayer.fill(25, 25, 25, 15);
        inkLayer.ellipse(x, y, random(80, 160), random(20, 40));
      }
    }

    if (style === "flower" || style === "bird") {
      // 꽃 / 새 (작은 점과 짧은 선)
      if (treble > 60) {
        inkLayer.fill(20, 20, 20, 40);
        inkLayer.ellipse(random(width), random(height * 0.2, height * 0.6), random(3, 8));
      }
    }
  });
}

// 가사 세로 표시
function displayLyric(text, overall) {
  let alpha = map(overall, 0, 255, 120, 245);

  push();
  translate(width * 0.87, height * 0.1);
  textAlign(CENTER, TOP);
  textSize(34);
  fill(20, 20, 20, alpha);

  // 긴 문장은 적절히 줄바꿈
  let chars = text.replace(/\s+/g, "");
  for (let i = 0; i < chars.length; i++) {
    text(chars[i], 0, i * 42);
  }
  pop();
}

function mousePressed() {
  if (song && audioStarted && !song.isPlaying()) {
    song.play();
  }
}
