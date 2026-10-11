let song = null;
let subtitles = [];
let images = [];
let audioStarted = false;
let isPreview = false;
let statusEl;

// 조절 가능한 값
let textSizeVal = 32;
let textX = 120;
let textY = 180;
let lineHeightVal = 42;

function setup() {
  createCanvas(1080, 1920);
  statusEl = document.getElementById("status");

  // 파일 이벤트
  document.getElementById("musicInput").addEventListener("change", handleMusic);
  document.getElementById("srtInput").addEventListener("change", handleSRT);
  document.getElementById("imageInput").addEventListener("change", handleImages);

  // 버튼
  document.getElementById("startBtn").addEventListener("click", startExperience);
  document.getElementById("previewBtn").addEventListener("click", togglePreview);

  // 슬라이더 이벤트
  bindSlider("textSize", "textSizeVal", v => textSizeVal = v);
  bindSlider("textX", "textXVal", v => textX = v);
  bindSlider("textY", "textYVal", v => textY = v);
  bindSlider("lineHeight", "lineHeightVal", v => lineHeightVal = v);
}

function bindSlider(id, valId, callback) {
  const slider = document.getElementById(id);
  const display = document.getElementById(valId);
  slider.addEventListener("input", () => {
    const v = parseInt(slider.value);
    display.textContent = v;
    callback(v);
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.innerHTML = msg;
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

function handleImages(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  images = [];
  let loaded = 0;
  setStatus(`이미지 로딩 중... (0/${files.length})`);

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    loadImage(url, (img) => {
      images[index] = img;
      loaded++;
      setStatus(`이미지 로딩 중... (${loaded}/${files.length})`);
      if (loaded === files.length) {
        setStatus(`이미지 ${files.length}장 로드 완료`);
      }
    });
  });
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

function togglePreview() {
  if (subtitles.length === 0) {
    setStatus("SRT를 먼저 선택해주세요");
    return;
  }
  isPreview = !isPreview;
  if (isPreview) {
    setStatus("최종 시 미리보기 중<br>(다시 누르면 해제)");
  } else {
    setStatus("미리보기 해제");
  }
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
  if (images.length === 0) {
    setStatus("이미지를 선택해주세요");
    return;
  }

  isPreview = false;
  if (!song.isPlaying()) {
    song.play();
  }
  audioStarted = true;
  setStatus("재생 중...");
}

function draw() {
  background(248, 243, 230);

  // 미리보기 모드
  if (isPreview) {
    // 마지막 이미지 보여주기 (있으면)
    if (images.length > 0 && images[images.length - 1]) {
      image(images[images.length - 1], 0, 0, width, height);
    }
    // 전체 시 쌓아서 표시
    displayAccumulatedLyrics(subtitles.length);
    return;
  }

  if (!audioStarted || !song) {
    fill(50);
    textAlign(CENTER, CENTER);
    textSize(26);
    text("음악 → SRT → 이미지 선택 후\n미리보기로 위치를 확인하세요", width/2, height/2);
    return;
  }

  const t = song.currentTime();

  // 현재까지 지나온 구절 개수 계산 (쌓이는 방식)
  let passedCount = 0;
  for (let i = 0; i < subtitles.length; i++) {
    if (t >= subtitles[i].start) {
      passedCount = i + 1;
    } else {
      break;
    }
  }

  // 이미지 표시 (현재 구절에 해당하는 이미지)
  let imgIndex = constrain(passedCount - 1, 0, images.length - 1);
  if (images[imgIndex]) {
    image(images[imgIndex], 0, 0, width, height);
  }

  // 쌓인 시 표시
  displayAccumulatedLyrics(passedCount);
}

function displayAccumulatedLyrics(count) {
  if (count <= 0 || subtitles.length === 0) return;

  push();
  textAlign(LEFT, TOP);
  textSize(textSizeVal);
  fill(25, 25, 25, 235);

  let y = textY;

  for (let i = 0; i < count; i++) {
    const line = subtitles[i].text;
    text(line, textX, y);
    y += lineHeightVal;
  }
  pop();
}

function mousePressed() {
  if (song && audioStarted && !song.isPlaying()) {
    song.play();
  }
}
