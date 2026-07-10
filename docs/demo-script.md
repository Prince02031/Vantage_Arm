# Demo Script — Vantage Arm (Phase C)

A 3-minute walkthrough/judging demo showing the Phase C motion control pipeline, numerical IK solver, and key pressing automation.

---

## Setup

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173`
4. The 6-key panel config is dynamically loaded from `public/config/key.config.json` and registered into the pipeline.

---

## Walkthrough

### 1. Show the Operator Dashboard & 3D Scene (30s)
- **Top Bar**: Vantage Arm branding showing **Phase C · IK Motion & Key Press**.
- **3D Scene**: Real URDF robotic arm rendered with a stylus end-effector and a 6-key panel. A cyan target marker is visible.
- **Aside Panel**: Operator controls: Joint State (live angles & EE coordinate) → Safety → Press Key (new Phase C manual tap keys) → Joystick → Move To → Keyboard → Voice → Autonomous PIN.
- **Bottom**: Richly formatted **Status Log** with level chips (INFO, SUCCESS, WARNING, ERROR), command source, type, and timestamps.

---

### 2. Manual Move To & Inverse Kinematics (45s)
- **Target Input**: In the "Move To" panel, enter `x: 0.35`, `y: 0.1`, `z: 0.20`.
- Click **Move To**:
  - The cyan target marker instantly snaps to `(0.35, 0.1, 0.20)`.
  - The numerical gradient descent solver (`solveIK`) begins computing the required joint angles.
  - The trajectory runner smoothly interpolates the arm movement.
  - See the live angles update under **Joint State**.
  - Review the **Safety Panel**: Shows `IK Status: Solved (err: ~0.000m)` and **Status Log** shows `MOVE_TO` successful.

---

### 3. Tap Key 5 (Phase C Primary Target) (45s)
- Locate the **Press Key** panel and click the **5** button.
- **Observe the sequence**:
  1. **Approach**: Stylus moves to the hover point 5cm directly above Key 5.
  2. **Touch**: Stylus descends to touch Key 5.
  3. **Flash**: The key flashes gold/yellow in the 3D scene on contact.
  4. **Retreat**: Stylus pulls back to the hover height.
- **Verify the Result**:
  - The **Safety Panel** displays: `Last Key Press: Key [5] — OK (0.2mm)` (showing the touch error distance).
  - The **Status Log** records the `PRESS_KEY` sequence steps, verifying the 5mm touch tolerance.

---

### 4. Autonomous PIN Entry (40s)
- Compose a 6-digit PIN using digits 1 to 6 (e.g., `123456` or `552211`) in the keypad or numeric input field.
- Click **Execute PIN**:
  - The arm performs the approach-touch-flash-retreat routine sequentially for each digit in the PIN.
  - Look at the live status logging printing the progress of each digit.
  - Click **Stop** in the Joystick panel mid-sequence to demonstrate the immediate motion cancellation and trajectory abort.

---

### 5. Keyboard & Voice Commands (20s)
- Press keyboard key `W` (EE +X) or `Q` (EE +Z) to jog the arm. Notice the repeat suppression.
- In the Voice panel, click example chip `'move to 0.55 0 0.10'` or type `"press key five"` and press Enter to show command parsing and execution.

---

### Key Technical Pillars for Judges
1. **Single Entrypoint**: No bypass. Dashboard sliders, joystick clicks, keyboard, voice, and PIN runner all invoke `executeCommand(command)`.
2. **Numeric IK Solver**: Symetrical numerical gradient descent solver running at 60Hz using the Three.js visual model as the coordinate oracle.
3. **Workspace Limits & Validation**: Safety validator rejects any targets outside the safe workspace boundary before the solver executes.
