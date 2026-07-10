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

## Current Progress — Phase E (Voice Control)

All Phase E features are fully integrated, providing unified motion control, key-press automation, autonomous PIN entry, and voice control via Web Speech API:

- **Dashboard Layout**: Rich 6-DOF controls and visualizer with live joint updates, safety panel integration, and chronological Status Log.
- **Inverse Kinematics (IK) & Trajectories**: Features a high-performance, Jacobian-free numerical gradient descent solver running at 60Hz. It accurately resolves Cartesian coordinates to joint states within a 5mm tolerance, smoothly animated by ease-in-out cubic trajectories.
- **Autonomous key tapping**: The **Press Key** panel supports direct triggers for Keys 1-6. Clicking a key initiates a multi-stage approach (hover 5cm above), touch (descend to surface), contact flash, and retreat sequence.
- **Sequential PIN Entry**: The **Autonomous PIN** panel executes sequential key pressing routines for 6-digit PIN strings consisting of digits 1-6. Includes live progress tracking, per-key error distance visualization, and mid-sequence emergency stop.
- **Advanced Visual Feedback**: In the 3D scene, target markers dynamically change color per movement phase (Cyan=approach, Gold=touch, Green=retreat) with an active trajectory line tracking the end-effector path. Keys highlight when active and persist a green glow when successfully pressed.
- **Voice Control (Deterministic)**: The **Voice** panel connects directly to the browser's Web Speech API (where supported) to listen to operator commands like "move up", "press key five", "rotate base 30 degrees", and "enter pin 123456". It parses commands strictly via a deterministic engine and provides text-to-speech (TTS) feedback. A typed fallback is provided as a primary backup for unsupported browsers.

### Controls Reference (Phase E)

| Source        | UI                          | Adapter / dispatch                             | Pipeline command |
| ------------- | --------------------------- | ---------------------------------------------- | ---------------- |
| Press Key     | `KeyPressPanel` buttons     | `executeCommand`                               | `pressKey`       |
| Joystick      | `JoystickPanel` buttons     | `createJoystickAdapter`                        | `jog` / `home` / `stop` |
| Move To       | `TargetInputPanel` form     | inline `executeCommand`                        | `moveTo`         |
| Keyboard      | window listener             | `createKeyboardAdapter` (W/A/D + Q/E + H/Space)| `jog` / `home` / `stop` |
| Voice (Mic)   | `VoicePanel` mic / text     | `parseAndExecuteVoiceCommand`                  | *various*        |
| Autonomous PIN| `PinEntryPanel` presets     | inline `executeCommand`                        | `runPin` / `stop` |
| Safety        | `SafetyPanel` buttons       | inline `executeCommand`                        | `halt` / `resetSafety` |

---

## Demo Instructions (Phase E)

To perform the Phase E judging demo:
1. Run `npm run dev` and open the app.
2. Verify the 3D scene renders the robotic arm and the 6-key panel.
3. Use **Voice Control**:
   - If your browser supports it (e.g. Chrome), click **Start Listening** in the Voice panel and allow microphone permissions.
   - Say "move up". The arm should jog upwards.
   - Say "press key five". Watch the multi-stage touch sequence.
   - Say "rotate base 30 degrees". Observe the arm rotate at the base.
   - If speech recognition fails or is unsupported, type these exact commands into the Voice panel text box and press Enter (or click Run).
4. Run the Autonomous PIN sequence via voice:
   - Say or type "enter pin 123456".
   - Observe the trajectory line and phase-colored markers tracing the entire entry path.
5. Review the **Status Log**:
   - Observe how voice inputs are logged, parsed, and executed natively via the single `executeCommand` pipeline, inheriting all safety validators.

