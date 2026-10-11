let song = null;
let subtitles = [];
let images = [];
let audioStarted = false;
let isPreview = false;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

let textSizeVal = 34;
let textX = 100;
let textY = 160;
let lineHeightVal = 46;
let calligraphyStrength = 35;
let writingMode = "horizontal";
let currentFont = "serif";
let orientation = "portrait";

function setup() {
  createCanvas(1080, 1920);
  statusEl = document.getElementById("status");

  // 파일
  document.getElementById("musicInput").addEventListener("change", handleMusic);
  document.getElementById("srtInput").addEventListener("change", handleSRT);
  document.getElementById("imageInput").addEventListener("change", handleImages);

  // 버튼
  document.getElementById("startBtn").addEventListener("click", startExperience);
  document.getElementById("previewBtn").addEventListener("click", togglePreview);

  // 슬라이더
  bindSlider("textSize", "textSizeVal", v => textSizeVal = v);
  bindSlider("textX", "textXVal", v => textX = v);
  bindSlider("textY", "textYVal", v => textY = v);
  bindSlider("lineHeight", "lineHeightVal", v => lineHeightVal = v);
  bindSlider("calligraphy", "calligraphyVal", v => calligraphyStrength = v);

  // 셀렉트
  document.getElementById("writingMode").addEventListener("change", e => {
    writingMode = e.target.value;
  });
  document.getElementById("fontSelect").addEventListener("change", e => {
    currentFont = e.target.value;
  });
  document.getElementById("orientation").addEventListener("change", e => {
    orientation = e.target.value;
    resizeCanvasForOrientation();
  });
}

function resizeCanvasForOrientation() {
  if (orientation === "landscape") {
    resizeCanvas(1920, 1080);
  } else {
    resizeCanvas(1080, 1920);
  }
}

function bindSlider(id, valId, cb) {
  const el = document.getElementById(id);
  const display = document.getElementById(valId);
  el.addEventListener("input", () => {
    const v = parseInt(el.value);
    display.textContent = v;
    cb(v);
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.innerHTML = msg;
}

function handleMusic(e) {
  const file = e.target.files[0];
  if (!file) return;
  setStatus("음악 로딩 중...");
  if (song) { song.stop(); song = null; }

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
  reader.onload = (ev) => {
    subtitles = parseSRT(ev.target.result);
    setStatus(`SRT 로드 완료 (${subtitles.length}개)`);
  };
  reader.readAsText(file, "UTF-8");
}

function handleImages(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric:true}));

  images = [];
  let loaded = 0;
  setStatus(`이미지 로딩 중... 0/${files.length}`);

  files.forEach((file, i) => {
    loadImage(URL.createObjectURL(file), img => {
      images[i] = img;
      loaded++;
      setStatus(`이미지 로딩 중... ${loaded}/${files.length}`);
      if (loaded === files.length) setStatus(`이미지 ${files.length}장 완료`);
    });
  });
}

function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const result = [];
  for (let block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const m = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
    if (!m) continue;
    result.push({
      start: timeToSec(m[1],m[2],m[3],m[4]),
      end:   timeToSec(m[5],m[6],m[7],m[8]),
      text:  lines.slice(2).join(" ").trim()
    });
  }
  return result;
}

function timeToSec(h,m,s,ms) {
  return (+h)*3600 + (+m)*60 + (+s) + (+ms)/1000;
}

function togglePreview() {
  if (!subtitles.length) {
    setStatus("SRT를 먼저 선택하세요");
    return;
  }
  isPreview = !isPreview;
  setStatus(isPreview ? "최종 시 미리보기 중\n(다시 누르면 해제)" : "미리보기 해제");
}

function startExperience() {
  if (!song || !subtitles.length || !images.length) {
    setStatus("음악 / SRT / 이미지를 모두 선택해주세요");
    return;
  }

  isPreview = false;
  audioStarted = true;

  // 영상 녹화 시작
  startRecording();

  if (!song.isPlaying()) song.play();
  setStatus("재생 + 녹화 중...\n노래가 끝나면 자동 저장됩니다");
}

function startRecording() {
  recordedChunks = [];
  const stream = document.querySelector("canvas").captureStream(30); // 30fps
  mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `조선시화_${Date.now()}.webm`;
    a.click();
    setStatus("영상 저장 완료!");
    isRecording = false;
  };

  mediaRecorder.start();
  isRecording = true;

  // 노래가 끝나면 녹화 중지
  song.onended(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  });
}

function draw() {
  background(248, 243, 230);

  // 미리보기
  if (isPreview) {
    if (images.length) image(images[images.length-1], 0, 0, width, height);
    displayAccumulated(subtitles.length);
    return;
  }

  if (!audioStarted || !song) {
    fill(60);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("파일을 모두 선택한 뒤\n미리보기로 확인하고 시작하세요", width/2, height/2);
    return;
  }

  const t = song.currentTime();

  // 현재까지 쌓인 구절 수
  let passed = 0;
  for (let i = 0; i < subtitles.length; i++) {
    if (t >= subtitles[i].start) passed = i + 1;
    else break;
  }

  // 이미지
  const imgIdx = constrain(passed - 1, 0, images.length - 1);
  if (images[imgIdx]) {
    image(images[imgIdx], 0, 0, width, height);
  }

  // 쌓인 시
  displayAccumulated(passed);
}

function displayAccumulated(count) {
  if (count <= 0) return;

  push();
  textFont(currentFont);
  textSize(textSizeVal);
  fill(20, 20, 20, 230);

  if (writingMode === "vertical") {
    // 세로쓰기
    let x = textX;
    for (let i = 0; i < count; i++) {
      const line = subtitles[i].text.replace(/\s+/g, "");
      let y = textY;
      for (let c of line) {
        // 캘리그라피 효과
        const shake = (calligraphyStrength / 100) * 2.5;
        const ox = random(-shake, shake);
        const oy = random(-shake, shake);
        const alpha = 200 + random(-30, 30) * (calligraphyStrength / 100);

        fill(20, 20, 20, alpha);
        text(c, x + ox, y + oy);
        y += lineHeightVal * 0.85;
      }
      x += lineHeightVal * 1.1; // 다음 줄
    }
  } else {
    // 가로쓰기
    let y = textY;
    for (let i = 0; i < count; i++) {
      const line = subtitles[i].text;
      const shake = (calligraphyStrength / 100) * 1.8;
      const ox = random(-shake, shake);
      const oy = random(-shake, shake);
      const alpha = 210 + random(-25, 25) * (calligraphyStrength / 100);

      fill(20, 20, 20, alpha);
      text(line, textX + ox, y + oy);
      y += lineHeightVal;
    }
  }
  pop();
}

function mousePressed() {
  if (song && audioStarted && !song.isPlaying()) {
    song.play();
  }
}
