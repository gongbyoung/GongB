let song = null;
let fft = null;
let inkLayer;
let audioStarted = false;
let lyrics = [];
let currentLyricIndex = 0;
let statusMessage = "음악을 선택하고 가사를 입력한 뒤\n「시작하기」를 눌러주세요";

function setup() {
  createCanvas(1080, 1920);
  inkLayer = createGraphics(width, height);
  inkLayer.background(248, 243, 230);

  // UI 이벤트 연결
  const musicInput = document.getElementById("musicInput");
  const startBtn = document.getElementById("startBtn");

  if (musicInput) {
    musicInput.addEventListener("change", handleMusic);
  }
  if (startBtn) {
    startBtn.addEventListener("click", startExperience);
  }
}

function handleMusic(e) {
  const file = e.target.files[0];
  if (!file) return;

  statusMessage = "음악 로딩 중...";

  if (song) {
    song.stop();
    song = null;
    audioStarted = false;
  }

  const url = URL.createObjectURL(file);

  song = loadSound(url,
    // 성공 콜백
    () => {
      fft = new p5.FFT(0.8, 1024);
      statusMessage = "음악 로드 완료!\n「시작하기」를 눌러주세요";
      console.log("음악 로드 성공");
    },
    // 실패 콜백
    (err) => {
      statusMessage = "음악 로드 실패\n다른 파일을 시도해보세요";
      console.error("로드 실패:", err);
    }
  );
}

function startExperience() {
  // 가사 가져오기
  const raw = document.getElementById("lyricsInput").value.trim();
  lyrics = raw.split("\n").filter(line => line.trim() !== "");

  if (!song) {
    statusMessage = "먼저 음악을 선택해주세요";
    return;
  }

  if (lyrics.length === 0) {
    statusMessage = "가사를 입력해주세요";
    return;
  }

  // 재생 시작
  if (!song.isPlaying()) {
    song.play();
  }
  audioStarted = true;
  statusMessage = "";
  console.log("재생 시작");
}

function draw() {
  background(248, 243, 230);
  image(inkLayer, 0, 0);

  // 상태 메시지 표시
  if (statusMessage !== "") {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(28);
    text(statusMessage, width/2, height/2);
    return;
  }

  if (!song || !audioStarted) return;

  // 음악이 끝났으면 멈춤
  if (!song.isPlaying() && song.currentTime() > 0) {
    // 끝났을 때도 그림은 유지
    return;
  }

  // 주파수 분석
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let mid = fft.getEnergy("mid");
  let treble = fft.getEnergy("treble");
  let overall = fft.getEnergy(20, 20000);

  // 그림 그리기 (쌓임)
  if (frameCount % 3 === 0) {
    drawInkStrokes(bass, mid, treble);
  }

  // 가사 표시
  displayLyrics(overall);
}

// 붓 자국 그리기
function drawInkStrokes(bass, mid, treble) {
  inkLayer.noStroke();

  // 산 (Bass)
  if (bass > 35) {
    let count = floor(map(bass, 35, 255, 1, 3));
    for (let i = 0; i < count; i++) {
      let x = random(width * 0.1, width * 0.9);
      let y = random(height * 0.55, height * 0.88);
      let size = map(bass, 35, 255, 40, 110);

      inkLayer.fill(20, 20, 20, map(bass, 35, 255, 12, 35));
      inkLayer.ellipse(x, y, size * random(0.9, 1.5), size * random(0.5, 0.85));
    }
  }

  // 대나무/나무 (Mid)
  if (mid > 45) {
    let count = floor(map(mid, 45, 255, 1, 4));
    for (let i = 0; i < count; i++) {
      let x = random(width * 0.12, width * 0.88);
      let y = random(height * 0.15, height * 0.7);
      let h = map(mid, 45, 255, 50, 160);
      let w = map(mid, 45, 255, 4, 14);

      inkLayer.fill(15, 15, 15, map(mid, 45, 255, 20, 55));
      inkLayer.push();
      inkLayer.translate(x, y);
      inkLayer.rotate(random(-0.2, 0.2));
      inkLayer.ellipse(0, 0, w, h);
      inkLayer.pop();
    }
  }

  // 가는 가지 (Treble)
  if (treble > 55) {
    let count = floor(map(treble, 55, 255, 2, 7));
    for (let i = 0; i < count; i++) {
      let x = random(width);
      let y = random(height * 0.05, height * 0.55);
      let len = map(treble, 55, 255, 20, 60);

      inkLayer.stroke(25, 25, 25, map(treble, 55, 255, 18, 45));
      inkLayer.strokeWeight(random(1, 2.8));
      inkLayer.line(x, y, x + random(-len, len), y + random(-len * 0.7, len * 0.7));
      inkLayer.noStroke();
    }
  }
}

// 가사 표시
function displayLyrics(overall) {
  if (lyrics.length === 0) return;

  let progress = song.currentTime() / song.duration();
  currentLyricIndex = floor(progress * lyrics.length);
  currentLyricIndex = constrain(currentLyricIndex, 0, lyrics.length - 1);

  let currentText = lyrics[currentLyricIndex];
  let alpha = map(overall, 0, 255, 100, 240);

  push();
  translate(width * 0.87, height * 0.1);
  textAlign(CENTER, TOP);
  textSize(34);
  fill(20, 20, 20, alpha);

  for (let i = 0; i < currentText.length; i++) {
    text(currentText[i], 0, i * 44);
  }
  pop();
}

// 화면 클릭으로도 재생 가능하게
function mousePressed() {
  if (song && !song.isPlaying() && audioStarted) {
    song.play();
  }
}
