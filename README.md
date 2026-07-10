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

## Current Progress — Phase C (IK Motion & Key Press)

All Phase C features are fully integrated, providing unified motion control and key-press automation:

- **Dashboard Layout**: Rich 6-DOF controls and visualizer with live joint updates, safety panel integration, and chronological Status Log.
- **Inverse Kinematics (IK) & Trajectories**: Features a high-performance, Jacobian-free numerical gradient descent solver running at 60Hz. It accurately resolves Cartesian coordinates to joint states within a 5mm tolerance, smoothly animated by ease-in-out cubic trajectories.
- **Autonomous key tapping**: The newly added **Press Key** panel supports direct triggers for Keys 1-6. Clicking a key initiates a multi-stage approach (hover 5cm above), touch (descend to surface), contact flash, and retreat sequence.
- **Sequential PIN Entry**: The **Pin Entry** panel executes sequential key pressing routines for 6-digit PIN strings.
- **Advanced Status Log & Safety**: Displays live IK solve status, absolute Cartesian distance error (in millimeters), active command source tracking, and error-highlighted logging.

### Controls Reference (Phase C)

| Source        | UI                          | Adapter / dispatch                             | Pipeline command |
| ------------- | --------------------------- | ---------------------------------------------- | ---------------- |
| Press Key     | `KeyPressPanel` buttons     | `executeCommand`                               | `pressKey`       |
| Joystick      | `JoystickPanel` buttons     | `createJoystickAdapter`                        | `jog` / `home` / `stop` |
| Move To       | `TargetInputPanel` form     | inline `executeCommand`                        | `moveTo`         |
| Keyboard      | window listener             | `createKeyboardAdapter` (W/A/D + Q/E + H/Space)| `jog` / `home` / `stop` |
| Voice (typed) | `VoicePanel` textbox/chips  | `parseVoiceCommand` → `executeCommand`         | `jog` / `pressKey` / `runPin` / `home` / `stop` / `halt` / `resetSafety` |
| Autonomous PIN| `PinEntryPanel`             | inline `executeCommand`                        | `runPin`         |
| Safety        | `SafetyPanel` buttons       | inline `executeCommand`                        | `halt` / `resetSafety` |

---

## Demo Instructions (Phase C)

To perform the Phase C judging demo:
1. Run `npm run dev` and open the app.
2. Verify the 3D scene renders the robotic arm and the 6-key panel.
3. Click the **Home** button to return the arm to the home position.
4. Try moving the arm to an absolute target:
   - In the **Move To** panel, set X: `0.35`, Y: `0.1`, Z: `0.20` and click **Move To**.
   - Observe the arm smoothly move to the target position, and the safety panel show `IK Status: Solved (err: ~0.000m)`.
5. Click **5** in the **Press Key** panel:
   - Observe the stylus hover above Key 5, descend to touch, trigger a contact flash on Key 5, and retreat.
   - Verify the touch precision in the Safety panel: `Last Key Press: Key [5] — OK (0.2mm)` or equivalent.
6. Try a sequential PIN run:
   - Enter `123456` in the **Autonomous PIN** input and click **Execute PIN**.
   - Click **Stop** in the joystick panel to interrupt the sequence at any time.

