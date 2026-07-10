# Vantage Arm

> Browser-based 6-DOF robotic arm simulation and control suite — built for the Vantage_Arm hackathon.

Vantage Arm renders a URDF robotic arm with a stylus tip in the browser and
exposes a single shared motion pipeline that every input source (dashboard,
keyboard, on-screen joystick, deterministic voice, typed voice, autonomous PIN
entry) calls into. The result is a presentation-friendly operator dashboard
that visualises the arm and the 6-key test panel defined in `key.config.json`,
with end-effector jogging, joint jogging, voice control, and autonomous PIN
entry.

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (Vite, http://localhost:5173)
npm run dev

# 3. Production build
npm run build

# 4. Preview the built bundle
npm run preview
```

Requires Node 18+ (Vite 5).

---

## Architecture Summary

There is exactly one shared motion-control pipeline. Every input source calls
the global `executeCommand(command)` exposed in `src/core/motionPipeline.js`.

```
[Dashboard Buttons] ----\
[Keyboard Listener] -----+--> [executeCommand(command)]
[GUI Joystick]  ---------/             |
[Voice Parser]  -----------------------+--> [Safety Gate] -> [Safety Validator]
[PIN Runner]    -------------------------------------+              |
                                                                  v
                                                         [Trajectory Runner]
                                                                  |
                                                                  v
                                                       [robotStore + ThreeScene]
```

### Module Map

| Layer | Files | Owner |
| --- | --- | --- |
| Command types & pipeline | `src/core/commandTypes.js`, `src/core/motionPipeline.js` | Person 2 |
| Store / state | `src/core/robotStore.js` | Person 2 |
| Safety / trajectory / PIN | `src/core/safetyValidator.js`, `src/core/trajectoryRunner.js`, `src/core/pinRunner.js` | Person 2 |
| Kinematics | `src/robotics/*.js` | Person 2 |
| Scene | `src/scene/ThreeScene.jsx`, `src/scene/ArmModel.jsx`, `src/scene/KeyPanel.jsx`, `src/scene/TargetMarker.jsx`, `src/scene/TrajectoryLine.jsx` | Person 1 |
| Controls (input adapters) | `src/controls/joystickCommands.js`, `src/controls/keyboardCommands.js`, `src/controls/voiceCommandParser.js`, `src/controls/agenticCommandParser.js` | Person 3 |
| Dashboard UI | `src/components/Dashboard.jsx`, `StatusLog.jsx`, `SafetyPanel.jsx`, `JointPanel.jsx`, `JoystickPanel.jsx`, `KeyboardHelp.jsx`, `VoicePanel.jsx`, `PinEntryPanel.jsx` | Person 3 |
| Hardware / docs | `circuit/`, `docs/`, `diagrams/`, `README.md`, `docs/demo-script.md` | Person 3 |

### Command Schema

Every input adapter builds a `command` of the form:

```js
{
  type:    'MOVE_EE' | 'SET_EE' | 'JOG_JOINT' | 'SET_JOINTS' | 'TAP_KEY' | 'EXECUTE_PIN' | 'HALT' | 'RESET_SAFETY',
  payload: { /* type-specific */ },
  source:  'dashboard' | 'keyboard' | 'joystick' | 'voice' | 'autonomous'
}
```

---

## Current Progress — Phase B (Controls & Dashboard)

Person 3 has shipped the operator-facing dashboard shell and wired every
manual input through the shared motion pipeline. Highlights:

- **Dashboard layout** (`src/components/Dashboard.jsx`): top bar, scene area on
  the left, control stack on the right, status log across the bottom — responsive
  collapse under 1100px.
- **StatusLog** (`src/components/StatusLog.jsx`): subscribes to
  `robotStore.logs`, renders level chip (INFO / SUCCESS / WARNING / ERROR),
  timestamp, source, command type, message. Empty state included. Logs are now
  pushed with structured `commandType` / `source` / `level` fields so the panel
  can render chips reliably.
- **SafetyPanel** (`src/components/SafetyPanel.jsx`): surfaces last validation
  message, violation count, current system state (Ready / Moving / Tripped),
  active command source, and adapter availability. Inline Halt + Reset buttons
  route through `executeCommand`.
- **JointPanel**: read-only display of joint angles and end-effector pose from
  `robotStore`.
- **Control panels** (all routed through `executeCommand`):
  - **JoystickPanel** — eight buttons (`X+`, `X-`, `Y+`, `Y-`, `Z+`, `Z-`,
    `Home`, `Stop`) backed by `createJoystickAdapter`. Each move dispatches
    `{ type: 'JOG_AXIS', payload: { axis, delta } }`, the system buttons
    dispatch `HOME` or `STOP`.
  - **TargetInputPanel** — numeric `x / y / z` fields + **Move To** button.
    Sends `{ type: 'MOVE_TO', payload: { target: { x, y, z } } }` from
    `source: 'dashboard'`.
  - **KeyboardHelp** — installs global `keydown` + `keyup` listeners via
    `createKeyboardAdapter`. Keymap: `W/S` ±X, `A/D` ±Y, `Q/E` ±Z, `H` home,
    `Space` stop. Keystrokes inside any `<input>` / `<textarea>` are ignored,
    and held keys do not spam the pipeline.
  - **VoicePanel** — typed-fallback UI. Each typed transcript runs through the
    deterministic parser in `src/controls/voiceCommandParser.js`. Phase B
    phrases include `move up|down|left|right|forward|back`, `press key one..six`,
    `enter pin <NNNNNN>`, `home`, `stop`, plus the legacy move-by-N / rotate-by-N
    / tap-key / halt / reset-safety shapes.
  - **PinEntryPanel** — 6-digit PIN entry shell that only accepts digits `1-6`,
    both via keypad clicks and free-text input. Dispatches
    `{ type: 'RUN_PIN', payload: { pin } }` from `source: 'pin-panel'`; the
    full hover / touch / verify / retract orchestration is owned by Person 2's
    `pinRunner.js`.
- **Scene integration** — uses a safe SVG placeholder that respects
  `window.__VA_USE_REAL_SCENE__` so Person 1's real Three.js canvas can be
  hot-swapped in from `feat/scene-urdf` without any dashboard changes.
- **Styling** — `src/index.css` ships a dark, presentation-friendly theme.
- **Architecture rule enforced** — none of the dashboard components or input
  adapters mutates `robotStore` directly. Every motion request is funneled
  through `executeCommand(command)`.

### Controls Reference (Phase B)

| Source        | UI                          | Adapter / dispatch                             | Pipeline command |
| ------------- | --------------------------- | ---------------------------------------------- | ---------------- |
| Joystick      | `JoystickPanel` buttons     | `createJoystickAdapter`                        | `JOG_AXIS` / `HOME` / `STOP` |
| Move To       | `TargetInputPanel` form     | inline `executeCommand`                        | `MOVE_TO`        |
| Keyboard      | window listener             | `createKeyboardAdapter` (W/A/D + Q/E + H/Space)| `JOG_AXIS` / `HOME` / `STOP` |
| Voice (typed) | `VoicePanel` textbox/chips  | `parseVoiceCommand` → `executeCommand`         | `JOG_AXIS` / `TAP_KEY` / `RUN_PIN` / `HOME` / `STOP` / `HALT` / `RESET_SAFETY` |
| Autonomous PIN| `PinEntryPanel`             | inline `executeCommand`                        | `RUN_PIN`        |
| Safety        | `SafetyPanel` buttons       | inline `executeCommand`                        | `HALT` / `RESET_SAFETY` |

> All commands flow through the same `executeCommand(command)` entry point in
> `src/core/motionPipeline.js`. No control mutates `robotStore` directly.

### Phase B Open Items for Person 2

To make the dashboard richer, Person 2 should expose (in a follow-up Phase C
commit):

1. **Adapter status field** on `robotStore.state` (e.g. `state.adapter` with
   `{ connected, firmwareVersion, lastHeartbeatAt }`) so `SafetyPanel` can show
   real adapter health instead of a hard-coded "Phase A contracts" line.
2. **`motion.activeCommandSource` updates** — currently the pipeline logs the
   source but does not push it onto `state.motion`. Setting it on every command
   would let `SafetyPanel` show *which* input last spoke to the arm.
3. **`motion.activeTrajectoryPath`** — `trajectoryRunner.js` should populate
   this array as the trajectory runs, so `TrajectoryLine` can visualise it.
4. **Live joint / EE updates** — once FK and IK are wired, `robotStore.jointAngles`
   and `robotStore.eePosition` need to be updated from the trajectory runner
   callbacks (currently they stay at the Phase A defaults).
5. **`logs[].commandType` and `logs[].source`** — currently the pipeline only
   pushes `type: 'INFO'` and the type/source inside the message string. Adding
   the fields directly on the log entry would let `StatusLog` render the chips
   it already supports.

---

## Demo

See `docs/demo-script.md` for a step-by-step walkthrough aligned with the
dashboard's current layout.
