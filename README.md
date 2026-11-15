# oui^^

A Wii-style game console that runs in the modern web browser. It features a channel-grid menu and 4 games, controlled by mouse (developer mode), webcam hand tracking, or a smartphone used as a motion controller.

---

## 🎮 Features & Games

- **Wii-Channel Dashboard**: A 2x2 grid of rounded channels with ambient shadows, hover scaling, real-time clock, and smooth transitions.
- **Unified Input Abstraction**: All games consume a normalized `InputState` (`pointer`, `pointerVelocity`, `tilt`, `buttonA`, `buttonB`, `swing`) and stay completely decoupled from underlying hardware.
- **The 4 Games**:
  1. **Sketchboard**: Plain HTML Canvas drawing with color palette, brush sizing, eraser, and PNG export.
  2. **Fruit Ninja**: Phaser 3 fruit slicing with fading blade trail, split meshes, juice particles, bombs, and combo scoring.
  3. **Space Fighter**: Phaser 3 vertical shooter featuring parallax starfield, enemy wave patterns, object pools, boss battles, and tilt steering.
  4. **Table Tennis**: Three.js 3D physics with paddle swing impulses, restitution bounces, and AI opponent tracking.

---

## 🕹️ Controls (Developer Mode - Mouse)

| Action | Control |
|---|---|
| **Pointer Position** | Mouse movement (normalized `0..1` with exponential smoothing) |
| **Button A** | Left Mouse Click |
| **Button B** | Right Mouse Click (context menu suppressed) |
| **Tilt (Roll & Pitch)** | `W`, `A`, `S`, `D` or Arrow Keys (`-1..+1`) |
| **Swing Impulse** | Quick mouse flick (detects speed and normalized direction) |
| **Pause Overlay** | `Escape` key or in-game `⏸` button |
| **Input Debug HUD** | `Tab` key (displays live coordinates, tilt, buttons, and last swing) |

---

## 🛠️ Tech Stack

- **Framework & Bundler**: TypeScript + Vite
- **2D Game Engine**: Phaser 3 (Fruit Ninja & Space Fighter)
- **3D Graphics Engine**: Three.js (Table Tennis)
- **Canvas App**: HTML5 2D Canvas (Sketchboard)
- **Menu & UI Shell**: Plain TypeScript + CSS (No heavy UI frameworks)
- **Webcam Tracking**: MediaPipe Hands (`@mediapipe/tasks-vision`)
- **Phone Controller Relay**: Node.js + `ws` WebSocket server with HTTPS static server
- **Persistence**: `localStorage` high scores and settings

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v22+)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Shraman91/oui-.git
cd oui-

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Vite development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Building for Production

```bash
npm run build
npm run preview
```

---

## 📂 Project Architecture

```
oui/
├── src/
│   ├── core/         # SceneManager.ts, Game.ts (base interface), main.ts
│   ├── input/        # InputManager.ts, constants.ts, providers/MouseProvider.ts
│   ├── menu/         # Menu.ts, menu.css (2x2 channel grid UI)
│   ├── games/        # sketchboard/, fruitninja/, spacefighter/, tabletennis/
│   └── shared/       # smoothing.ts, storage.ts
├── index.html        # Console container & entry point
└── package.json
```

---

## 📄 License
MIT License
