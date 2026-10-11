let song;
let fft;
let inkLayer;          // 그림이 계속 쌓이는 레이어
let audioStarted = false;
let lyrics = [];
let currentLyricIndex = 0;
let lyricAlpha = 0;

function setup() {
  createCanvas(1080, 1920);
  inkLayer = createGraphics(width, height);
  inkLayer.background(248, 243, 230); // 한지 색

  // UI 이벤트
  document.getElementById("startBtn").addEventListener("click", startExperience);
  document.getElementById("musicInput").addEventListener("change", handleMusic);
}

function handleMusic(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (song) {
    song.stop();
    audioStarted = false;
  }

  const url = URL.createObjectURL(file);
  song = loadSound(url, () => {
    fft = new p5.FFT(0.8, 1024);
    console.log("음악 로드 완료");
  });
}

function startExperience() {
  // 가사 가져오기
  const raw = document.getElementById("lyricsInput").value.trim();
  lyrics = raw.split("\n").filter(line => line.trim() !== "");
  currentLyricIndex = 0;

  if (!song) {
    alert("먼저 음악을 선택해주세요.");
    return;
  }

  // 화면 클릭으로 재생 (브라우저 정책)
  if (!audioStarted) {
    song.play();
    audioStarted = true;
  }
}

function draw() {
  // 한지 배경
  background(248, 243, 230);

  // 쌓인 먹 그림 그리기
  image(inkLayer, 0, 0);

  if (!song || !audioStarted) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("음악을 선택하고\n시(가사)를 입력한 뒤\n「시작하기」를 눌러주세요", width/2, height/2);
    return;
  }

  if (!song.isPlaying()) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(28);
    text("화면을 클릭하면 음악이 시작됩니다", width/2, height/2);
    return;
  }

  // 주파수 분석
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let mid = fft.getEnergy("mid");
  let treble = fft.getEnergy("treble");
  let overall = fft.getEnergy(20, 20000);

  // === 그림 그리기 (사라지지 않고 쌓임) ===
  if (frameCount % 4 === 0) {
    drawInkStrokes(bass, mid, treble);
  }

  // === 가사 표시 ===
  displayLyrics(overall);
}

// 실제 붓 자국처럼 그리기
function drawInkStrokes(bass, mid, treble) {
  inkLayer.noStroke();

  // 1. 산 / 큰 형태 (Bass)
  if (bass > 40) {
    let count = floor(map(bass, 40, 255, 1, 3));
    for (let i = 0; i < count; i++) {
      let x = random(width * 0.1, width * 0.9);
      let y = random(height * 0.55, height * 0.85);
      let size = map(bass, 40, 255, 30, 90);
      
      inkLayer.fill(20, 20, 20, map(bass, 40, 255, 15, 40));
      inkLayer.ellipse(x, y, size * random(0.8, 1.4), size * random(0.5, 0.9));
    }
  }

  // 2. 대나무 / 나무 줄기 (Mid)
  if (mid > 50) {
    let count = floor(map(mid, 50, 255, 1, 4));
    for (let i = 0; i < count; i++) {
      let x = random(width * 0.15, width * 0.85);
      let y = random(height * 0.2, height * 0.7);
      let h = map(mid, 50, 255, 40, 140);
      let w = map(mid, 50, 255, 3, 12);

      inkLayer.fill(15, 15, 15, map(mid, 50, 255, 25, 60));
      inkLayer.push();
      inkLayer.translate(x, y);
      inkLayer.rotate(random(-0.15, 0.15));
      inkLayer.ellipse(0, 0, w, h);
      inkLayer.pop();
    }
  }

  // 3. 가는 가지 / 풀 / 구름 (Treble)
  if (treble > 60) {
    let count = floor(map(treble, 60, 255, 2, 6));
    for (let i = 0; i < count; i++) {
      let x = random(width);
      let y = random(height * 0.05, height * 0.6);
      let len = map(treble, 60, 255, 15, 50);

      inkLayer.stroke(25, 25, 25, map(treble, 60, 255, 20, 50));
      inkLayer.strokeWeight(random(0.8, 2.5));
      inkLayer.line(x, y, x + random(-len, len), y + random(-len*0.6, len*0.6));
      inkLayer.noStroke();
    }
  }
}

// 가사 표시 (노래 시간에 맞춰)
function displayLyrics(overall) {
  if (lyrics.length === 0) return;

  // 노래 진행률에 따라 가사 인덱스 결정
  let progress = song.currentTime() / song.duration();
  currentLyricIndex = floor(progress * lyrics.length);
  currentLyricIndex = constrain(currentLyricIndex, 0, lyrics.length - 1);

  let currentText = lyrics[currentLyricIndex];

  // 페이드 효과
  lyricAlpha = lerp(lyricAlpha, map(overall, 0, 255, 80, 230), 0.08);

  push();
  translate(width * 0.88, height * 0.12);
  textAlign(CENTER, TOP);
  textSize(36);
  fill(15, 15, 15, lyricAlpha);
  
  // 세로쓰기
  for (let i = 0; i < currentText.length; i++) {
    text(currentText[i], 0, i * 46);
  }
  pop();
}

// 화면 클릭으로 재생 시작 (안전장치)
function mousePressed() {
  if (song && !song.isPlaying() && audioStarted === false) {
    song.play();
    audioStarted = true;
  }
}
