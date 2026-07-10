# Demo Script — Vantage Arm (Phase E)

A 3-minute walkthrough/judging demo showing the Phase E motion control pipeline, numerical IK solver, autonomous PIN entry, and voice control automation.

---

## Setup

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173`
4. The 6-key panel config is dynamically loaded from `public/config/key.config.json` and registered into the pipeline.

---

## Walkthrough

### 1. Show the Operator Dashboard & 3D Scene (30s)
- **Top Bar**: Vantage Arm branding showing **Phase E · Voice Control**.
- **3D Scene**: Real URDF robotic arm rendered with a stylus end-effector and a 6-key panel. A cyan target marker is visible.
- **Aside Panel**: Operator controls: Joint State (live angles & EE coordinate) → Safety → Press Key (manual tap keys) → Joystick → Move To → Keyboard → Voice (mic + fallback) → Autonomous PIN (presets and input).
- **Bottom**: Richly formatted **Status Log** with level chips (INFO, SUCCESS, WARNING, ERROR), command source, type, and timestamps.

---

### 2. Manual Move To & Inverse Kinematics (30s)
- **Target Input**: In the "Move To" panel, enter `x: 0.35`, `y: 0.1`, `z: 0.20`.
- Click **Move To**:
  - The cyan target marker instantly snaps to `(0.35, 0.1, 0.20)`.
  - The numerical gradient descent solver (`solveIK`) begins computing the required joint angles.
  - The trajectory runner smoothly interpolates the arm movement.
  - See the live angles update under **Joint State**.
  - Review the **Safety Panel**: Shows `IK Status: Solved (err: ~0.000m)` and **Status Log** shows `MOVE_TO` successful.

---

### 3. Autonomous PIN Entry (30s)
- Locate the **Autonomous PIN** panel and click the **123456** preset.
- Click **Execute PIN**.
- **Observe the sequence**:
  1. **Trajectory & Colors**: The target marker changes color (cyan approach, gold touch, green retreat), with a dynamic trajectory line drawn from the stylus to the target.
  2. **Key State**: The active key glows white.
  3. **Touch**: Stylus descends to touch the key, triggering a gold flash.
  4. **Progress**: The UI tracks per-key touch errors in millimeters. A pressed key persists a green glow.

---

### 4. Voice Control (Phase E Target) (60s)
- Scroll to the **Voice & Text Command** panel.
- Point out the **Mic Supported · TTS Ready** subtitle (if using Chrome/Edge).
- **Test Axis Jogging**: Click **Start Listening** and say clearly "move up". The arm will jog upwards 2cm.
- **Test Key Press**: Click **Start Listening** and say "press key five" or type it into the fallback box. Watch the arm execute the complete approach-touch-retreat sequence for Key 5.
- **Test PIN via Voice**: Click **Start Listening** and say "enter pin 123456" (or "enter pin one two three four five six"). Watch the arm trace the complete PIN sequence just as if the dashboard button was pressed.
- **Test Safety Intercept**: Type "press key nine" into the fallback text box. Note the immediate failure message: *Invalid key "9". Only keys 1-6 are supported.* Explain that all voice commands flow through the exact same safety pipeline.

---

### Key Technical Pillars for Judges
1. **Single Entrypoint**: No bypass. Dashboard sliders, joystick clicks, keyboard, voice, and PIN runner all invoke `executeCommand(command)`.
2. **Deterministic Voice Safety**: The Phase E voice parser uses strict regex extraction. It guarantees that malicious or hallucinated inputs ("fly away", "press key nine") can never trick the robot into an unsafe state.
3. **Numeric IK Solver**: Symmetrical numerical gradient descent solver running at 60Hz using the Three.js visual model as the coordinate oracle.
4. **Workspace Limits & Validation**: Safety validator rejects any targets outside the safe workspace boundary before the solver executes, and validates PIN formats dynamically against loaded config coordinates.
