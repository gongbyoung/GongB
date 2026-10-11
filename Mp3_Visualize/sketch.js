let song = null;
let subtitles = [];
let images = [];          // 미리 로드된 이미지들
let currentIndex = -1;
let audioStarted = false;
let statusEl;

function preload() {
  // 이미지가 많으면 여기 숫자를 구절 수에 맞게 수정
  // 예: 20개 구절이면 20까지
  const totalImages = 30; // ← 실제 이미지 개수로 수정

  for (let i = 1; i <= totalImages; i++) {
    const num = String(i).padStart(3, "0");
    images[i] = loadImage(`Assets/${num}.png`,
      () => console.log(`${num}.png 로드 완료`),
      () => console.log(`${num}.png 없음`)
    );
  }
}

function setup() {
  createCanvas(1080, 1920);
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
  }

  const url = URL.createObjectURL(file);
  song = loadSound(url,
    () => setStatus("음악 로드 완료"),
    () => setStatus("음악 로드 실패")
  );
}

function handleSRT(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    subtitles = parseSRT(event.target.result);
    setStatus(`SRT 로드 완료 (${subtitles.length}개 구절)`);
  };
  reader.readAsText(file, "UTF-8");
}

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
    const content = lines.slice(2).join(" ").trim();

    result.push({ start, end, text: content });
  }
  return result;
}

function timeToSeconds(h, m, s, ms) {
  return parseInt(h)*3600 + parseInt(m)*60 + parseInt(s) + parseInt(ms)/1000;
}

function startExperience() {
  if (!song) {
    setStatus("음악을 선택해주세요");
    return;
  }
  if (subtitles.length === 0) {
    setStatus("SRT를 선택해주세요");
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

  if (!audioStarted || !song) {
    fill(40);
    textAlign(CENTER, CENTER);
    textSize(28);
    text("음악과 SRT를 선택한 뒤\n「시작하기」를 눌러주세요", width/2, height/2);
    return;
  }

  const t = song.currentTime();

  // 현재 시간에 맞는 구절 찾기
  let activeIndex = -1;
  for (let i = 0; i < subtitles.length; i++) {
    if (t >= subtitles[i].start && t <= subtitles[i].end) {
      activeIndex = i;
      break;
    }
  }

  // 이미지 표시 (구절 번호에 해당하는 이미지)
  if (activeIndex >= 0) {
    const imgIndex = activeIndex + 1; // 1부터 시작
    if (images[imgIndex]) {
      // 이미지가 캔버스를 가득 채우도록
      image(images[imgIndex], 0, 0, width, height);
    }
    currentIndex = activeIndex;
  } else if (currentIndex >= 0 && images[currentIndex + 1]) {
    // 구절 사이 간격에서는 이전 이미지 유지
    image(images[currentIndex + 1], 0, 0, width, height);
  }

  // 세로 캘리그라피
  if (activeIndex >= 0) {
    displayLyric(subtitles[activeIndex].text);
  }
}

function displayLyric(lyricText) {
  push();
  translate(width * 0.88, height * 0.1);
  textAlign(CENTER, TOP);
  textSize(36);
  fill(20, 20, 20, 230);

  const chars = lyricText.replace(/\s+/g, "");
  for (let i = 0; i < chars.length; i++) {
    text(chars[i], 0, i * 46);
  }
  pop();
}

function mousePressed() {
  if (song && audioStarted && !song.isPlaying()) {
    song.play();
  }
}
