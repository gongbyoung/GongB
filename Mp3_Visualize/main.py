import pygame
import librosa
import numpy as np
import tkinter as tk
from tkinter import filedialog, colorchooser
import threading
import os

# --- 설정값 변수 ---
config = {
    "music_path": "",
    "base_color": (255, 69, 0), # 기본 주황색
    "sensitivity": 1.0,
    "particle_size": 5,
    "save_video": False
}

# --- UI 설정 창 (Tkinter) ---
def launch_settings():
    root = tk.Tk()
    root.title("Fire Visualizer Settings")
    root.geometry("400x400")

    def select_file():
        file = filedialog.askopenfilename(filetypes=[("Audio Files", "*.mp3 *.wav")])
        if file:
            config["music_path"] = file
            path_label.config(text=os.path.basename(file))

    def pick_color():
        _, hex_color = colorchooser.askcolor()
        if hex_color:
            config["base_color"] = tuple(int(hex_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            color_btn.config(bg=hex_color)

    tk.Label(root, text="1. 음악 파일 선택", font=('Arial', 10, 'bold')).pack(pady=5)
    tk.Button(root, text="파일 열기", command=select_file).pack()
    path_label = tk.Label(root, text="선택된 파일 없음")
    path_label.pack()

    tk.Label(root, text="2. 불꽃 기본 색상", font=('Arial', 10, 'bold')).pack(pady=5)
    color_btn = tk.Button(root, text="색상 선택", bg="#ff4500", command=pick_color)
    color_btn.pack()

    tk.Label(root, text="3. 민감도 (소리에 반응하는 정도)", font=('Arial', 10, 'bold')).pack(pady=5)
    sens_scale = tk.Scale(root, from_=0.5, to=5.0, resolution=0.1, orient="horizontal")
    sens_scale.set(1.0)
    sens_scale.pack()

    tk.Label(root, text="4. 불꽃 크기", font=('Arial', 10, 'bold')).pack(pady=5)
    size_scale = tk.Scale(root, from_=1, to=20, orient="horizontal")
    size_scale.set(5)
    size_scale.pack()

    def start():
        config["sensitivity"] = sens_scale.get()
        config["particle_size"] = size_scale.get()
        if config["music_path"]:
            root.destroy()
        else:
            tk.messagebox.showwarning("경고", "음악 파일을 먼저 선택하세요!")

    tk.Button(root, text="시작하기", font=('Arial', 12, 'bold'), bg="green", fg="white", command=start).pack(pady=20)
    root.mainloop()

# --- 메인 비주얼라이저 (Pygame) ---
def run_visualizer():
    pygame.init()
    screen = pygame.display.set_mode((800, 600))
    pygame.display.set_caption("Music Fire Visualizer")
    clock = pygame.time.Clock()

    # 오디오 분석
    y, sr = librosa.load(config["music_path"])
    rms = librosa.feature.rms(y=y)[0]
    
    pygame.mixer.music.load(config["music_path"])
    pygame.mixer.music.play()

    particles = []
    running = True
    frame_idx = 0

    while running:
        screen.fill((10, 10, 10)) # 어두운 배경
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        # 현재 프레임의 볼륨 값 가져오기 (시간에 맞춰 매핑)
        pos = pygame.mixer.music.get_pos() / 1000.0 # 현재 재생 시간(초)
        current_idx = int(pos * (len(rms) / (len(y)/sr)))
        
        volume = rms[current_idx] if current_idx < len(rms) else 0
        intensity = volume * 50 * config["sensitivity"]

        # 입자 생성
        for _ in range(int(intensity)):
            p_pos = [400 + np.random.randint(-20, 20), 550]
            p_vel = [np.random.uniform(-1, 1), np.random.uniform(-intensity/2 - 2, -2)]
            p_life = np.random.uniform(2, 6)
            particles.append([p_pos, p_vel, p_life])

        # 입자 업데이트 및 그리기
        for p in particles[:]:
            p[0][0] += p[1][0]
            p[0][1] += p[1][1]
            p[2] -= 0.1 # 수명 감소
            
            if p[2] <= 0:
                particles.remove(p)
            else:
                # 색상 계산 (수명에 따라 흐려짐)
                alpha = min(255, int(p[2] * 50))
                p_color = config["base_color"]
                pygame.draw.circle(screen, p_color, (int(p[0][0]), int(p[0][1])), int(p[2] * config["particle_size"] / 2))

        pygame.display.flip()
        clock.tick(60)

    pygame.quit()

if __name__ == "__main__":
    launch_settings()
    if config["music_path"]:
        run_visualizer()