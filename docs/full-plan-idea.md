Below is a **copy-paste-ready Markdown plan** for your team.

````md
# Vantage_Arm — Final Round Build Plan

## 1. Project Goal

Vantage_Arm is a browser-based simulation and control suite for a 6-DOF industrial robotic arm.

The app must:
- Load and visualize the provided URDF arm.
- Render the 6-key test panel from `key.config.json`.
- Show live joint angles and end-effector/stylus position.
- Move the stylus using inverse kinematics.
- Support joystick control.
- Support keyboard control.
- Support deterministic voice control.
- Autonomously enter a 6-digit PIN by pressing keys in sequence.
- Include an electrical schematic/Wokwi proof-of-concept.
- Include architecture explanation and demo-ready documentation.

The most important engineering principle:

> All control methods must use one shared motion-control pipeline.

No joystick, keyboard, voice, or PIN logic should move the robot directly.

---

## 2. Core Architecture

```text
Dashboard / Joystick / Keyboard / Voice / PIN / Agentic Input
                          ↓
                  Structured Command
                          ↓
                   Safety Validator
                          ↓
                       IK Solver
                          ↓
                  Trajectory Runner
                          ↓
                  URDF Robot Adapter
                          ↓
              3D Scene + Dashboard + Logs
````

Central function:

```js
executeCommand(command)
```

Every movement source must call this function.

---

## 3. Project Structure

```text
Vantage_Arm/
├── public/
│   ├── robot/
│   │   └── 6_dof_arm.urdf
│   └── config/
│       └── key.config.json
│
├── src/
│   ├── core/
│   │   ├── commandTypes.js
│   │   ├── robotStore.js
│   │   ├── motionPipeline.js
│   │   ├── safetyValidator.js
│   │   ├── trajectoryRunner.js
│   │   └── pinRunner.js
│   │
│   ├── robotics/
│   │   ├── urdfRobot.js
│   │   ├── jointDiscovery.js
│   │   ├── forwardKinematics.js
│   │   ├── ikSolver.js
│   │   └── endEffector.js
│   │
│   ├── scene/
│   │   ├── ThreeScene.jsx
│   │   ├── ArmModel.jsx
│   │   ├── KeyPanel.jsx
│   │   ├── TargetMarker.jsx
│   │   └── TrajectoryLine.jsx
│   │
│   ├── controls/
│   │   ├── joystickCommands.js
│   │   ├── keyboardCommands.js
│   │   ├── voiceCommandParser.js
│   │   └── agenticCommandParser.js
│   │
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── JointPanel.jsx
│   │   ├── JoystickPanel.jsx
│   │   ├── KeyboardHelp.jsx
│   │   ├── VoicePanel.jsx
│   │   ├── PinEntryPanel.jsx
│   │   ├── SafetyPanel.jsx
│   │   └── StatusLog.jsx
│   │
│   └── utils/
│       ├── math3d.js
│       ├── formatters.js
│       └── constants.js
│
├── docs/
│   ├── person-1-scene-urdf.md
│   ├── person-2-motion-pipeline.md
│   ├── person-3-controls-docs.md
│   ├── integration-checkpoints.md
│   ├── urdf-inspection.md
│   ├── validation-plan.md
│   └── demo-script.md
│
├── circuit/
│   ├── schematic-notes.md
│   ├── pin-mapping.md
│   └── wokwi-link.md
│
├── diagrams/
│   ├── architecture.drawio
│   └── motion-pipeline.drawio
│
├── AGENTS.md
├── README.md
├── package.json
└── vite.config.js
```

---

## 4. Key Panel Config

The key panel is loaded from:

```text
public/config/key.config.json
```

The config uses:

* frame: `base_link`
* units: meters
* approach axis: `-z`

Key coordinates:

```text
1: x=0.500, y= 0.050, z=0.050
2: x=0.550, y= 0.050, z=0.050
3: x=0.600, y= 0.050, z=0.050

4: x=0.500, y=-0.050, z=0.050
5: x=0.550, y=-0.050, z=0.050
6: x=0.600, y=-0.050, z=0.050
```

For each key press:

```text
1. Approach: x, y, z + 0.05
2. Touch:    x, y, z
3. Retreat:  x, y, z + 0.05
```

A successful press means the stylus reaches within `0.005m` of the target key coordinate.

---

## 5. Shared Command Contract

All controls must produce structured commands.

Examples:

```js
{
  type: "jog",
  axis: "x",
  delta: 0.02,
  source: "keyboard"
}
```

```js
{
  type: "moveTo",
  target: { x: 0.55, y: -0.05, z: 0.10 },
  source: "dashboard"
}
```

```js
{
  type: "pressKey",
  key: "5",
  source: "voice"
}
```

```js
{
  type: "runPin",
  pin: "123456",
  source: "pin-panel"
}
```

```js
{
  type: "home",
  source: "dashboard"
}
```

```js
{
  type: "stop",
  source: "keyboard"
}
```

---

## 6. Team Roles

## Person 1 — Scene, URDF, and Visualization

Owns:

* Three.js scene
* URDF loading
* robot rendering
* joint discovery
* key panel rendering
* end-effector marker
* target marker
* trajectory visualization
* live joint angle display

Main files:

```text
src/scene/*
src/robotics/urdfRobot.js
src/robotics/jointDiscovery.js
src/robotics/endEffector.js
src/components/JointPanel.jsx
docs/urdf-inspection.md
```

Must expose robot adapter:

```js
{
  getRobot,
  getMovableJoints,
  getJointLimits,
  getJointAngles,
  setJointAngles,
  getEndEffectorPosition,
  updateTargetMarker,
  flashKey
}
```

Success target:

* URDF arm visible.
* 6-key panel visible.
* Joint names/angles visible.
* End-effector position visible.
* Adapter available for Person 2.

---

## Person 2 — Motion Pipeline, IK, Safety, and PIN

Owns:

* command schema
* robot state store
* safety validator
* shared motion pipeline
* IK solver
* trajectory runner
* key press routine
* autonomous PIN routine

Main files:

```text
src/core/*
src/robotics/ikSolver.js
src/robotics/forwardKinematics.js
src/components/PinEntryPanel.jsx
src/components/SafetyPanel.jsx
```

Person 2 starts first because everyone depends on the shared pipeline contract.

Success target:

* `executeCommand()` exists.
* safety validation works.
* `moveTo()` works or reports clear failure.
* `pressKey("5")` performs approach-touch-retreat.
* `runPin("123456")` presses all keys in order.
* tolerance result is logged.

---

## Person 3 — Controls, Voice, Circuit, Docs, and Presentation

Owns:

* joystick controls
* keyboard controls
* deterministic voice command parser
* typed command fallback
* optional agentic parser
* status log UI
* electrical schematic
* architecture diagram
* README
* demo script

Main files:

```text
src/controls/*
src/components/JoystickPanel.jsx
src/components/KeyboardHelp.jsx
src/components/VoicePanel.jsx
src/components/StatusLog.jsx
circuit/*
diagrams/*
README.md
docs/demo-script.md
```

Success target:

* joystick calls `executeCommand()`
* keyboard calls `executeCommand()`
* voice/typed commands call `executeCommand()`
* circuit docs ready
* diagrams ready
* demo script ready

---

## 7. Git Workflow

Recommended branches:

```text
main
feat/motion-pipeline
feat/scene-urdf
feat/controls-docs
```

Rules:

* Person 2 pushes contracts first.
* Person 1 and Person 3 build on top of those contracts.
* Do not edit another person’s owned files unless needed for integration.
* Always run:

```bash
npm run build
```

before saying a phase is done.

Recommended commits:

```bash
git commit -m "chore: lock shared motion pipeline contracts"
git commit -m "feat: load URDF arm and render key panel"
git commit -m "feat: implement shared motion pipeline and IK runner"
git commit -m "feat: add joystick and keyboard controls"
git commit -m "feat: add autonomous PIN entry"
git commit -m "feat: add deterministic voice control"
git commit -m "docs: finalize demo materials and architecture"
```

---

## 8. Build Phases

## Phase A — Contract Lock

Lead: Person 2
Time: 20–40 minutes

Goal:
Create stable shared contracts before everyone starts parallel work.

Deliverables:

```text
AGENTS.md
docs/person-1-scene-urdf.md
docs/person-2-motion-pipeline.md
docs/person-3-controls-docs.md
docs/integration-checkpoints.md

src/core/commandTypes.js
src/core/robotStore.js
src/core/safetyValidator.js
src/core/motionPipeline.js
src/core/trajectoryRunner.js
src/core/pinRunner.js

src/robotics/ikSolver.js
src/robotics/forwardKinematics.js
```

Important:

* Do not build full IK yet.
* Do not build UI here.
* Do not build Three.js scene here.
* Only create stable APIs.

---

## Phase B — Parallel Foundation

Time: 1.5–2 hours

Person 1:

* Load URDF.
* Render arm.
* Discover joints.
* Render key panel.
* Expose robot adapter.

Person 2:

* Implement real safety validation.
* Implement trajectory runner.
* Start IK solver.
* Connect pipeline to robot adapter.

Person 3:

* Build dashboard layout.
* Build joystick panel.
* Build keyboard panel.
* Build status log shell.
* Start circuit and README.

Checkpoint:

* App opens.
* Scene visible.
* Panel visible.
* Commands can be submitted.
* Logs update.
* Build passes.

---

## Phase C — IK and First Key Press

Time: 2–4 hours

Main goal:
Make the arm reach one target coordinate.

Person 1:

* Ensure `setJointAngles()` updates URDF.
* Ensure `getEndEffectorPosition()` works.

Person 2:

* Implement position-only IK.
* Implement `moveTo()`.
* Implement `pressKey()`.
* Log distance-to-target.

Person 3:

* Wire joystick and keyboard to `executeCommand()`.
* Keep UI simple and demo-friendly.

Checkpoint:

* Press Key 5 button works.
* System reports success/failure.
* Status log shows movement results.

---

## Phase D — Autonomous PIN Entry

Time: 4–5.5 hours

Main goal:
Reliable PIN entry.

Rules:

* PIN must match `/^[1-6]{6}$/`
* Sequence through six keys.
* For each key: approach → touch → retreat.
* Stop safely on failure.
* Show progress in UI.

Person 2 leads this phase.

Checkpoint:

* Entering `123456` runs all six key presses.
* UI shows current digit.
* Each key press logs success/failure.
* Final completion message appears.

---

## Phase E — Voice and Manual Controls

Time: 5.5–6.5 hours

Person 3 leads.

Required deterministic commands:

```text
move up
move down
move left
move right
move forward
move backward
press key one
press key two
press key three
press key four
press key five
press key six
enter pin 123456
home
stop
```

Also add typed fallback:

* If microphone fails, type the same commands.

Checkpoint:

* Voice or typed command `press key five` works.
* Voice or typed command `enter pin 123456` works.
* Invalid commands are rejected safely.

---

## Phase F — Circuit, Diagrams, Docs

Time: 6.5–7.5 hours

Person 3 leads, everyone supports.

Circuit should show:

* ESP32
* PCA9685 or servo driver stage
* 6 servo motors
* external 5V/6V servo power
* common ground
* emergency stop
* Wi-Fi control link
* status LED

Architecture diagram should show:

```text
Inputs
→ Structured Commands
→ Safety Validator
→ IK Solver
→ Trajectory Runner
→ URDF Robot Renderer
→ Dashboard + Logs
```

Docs should include:

* project overview
* setup instructions
* architecture
* controls
* PIN entry
* safety validation
* circuit explanation
* demo script
* known limitations

---

## Phase G — Final Demo Rehearsal

Time: 7.5–8 hours

No new features.

Only:

* bug fixes
* build check
* commit/push
* demo rehearsal
* screenshots
* optional deployment

Run:

```bash
npm run build
```

---

## 9. Safety Rules

All commands must pass deterministic safety validation.

Validation should check:

* command type is known
* target numbers are finite
* target is inside workspace
* key exists in config
* PIN format is valid
* joint exists before rotation
* joint limit is respected
* IK result is successful before execution
* stop command interrupts movement

Default workspace:

```js
const WORKSPACE_BOUNDS = {
  x: [0.15, 0.75],
  y: [-0.35, 0.35],
  z: [0.02, 0.75],
};
```

No LLM or agentic command may move the robot directly.

---

## 10. What Not To Build

Skip these unless all core features are complete:

```text
physics simulation
collision detection
real hardware communication
database
authentication
user accounts
ROS bridge
full orientation IK
gripper controls
historical analytics
fancy landing page
```

The arm has a fixed stylus, not a gripper.

---

## 11. Demo Flow

Final demo should follow this order:

```text
1. Introduce Vantage_Arm.
2. Show URDF arm loaded in browser.
3. Show 6-key panel rendered from config.
4. Show live joint angles and end-effector position.
5. Move using joystick.
6. Move using keyboard.
7. Use voice/typed command: "press key five".
8. Enter PIN: 123456.
9. Show arm pressing keys in sequence.
10. Show success tolerance/logs.
11. Show architecture diagram.
12. Show electrical schematic.
13. Explain that every input uses one safe motion pipeline.
```

Judge-facing summary:

> Vantage_Arm validates robotic arm software in simulation before real hardware. The URDF arm, key panel, manual controls, voice commands, and autonomous PIN entry all route through one deterministic safety-checked motion pipeline. This makes the system safer, testable, and ready for real-world extension.

---

## 12. Immediate Next Steps

1. Person 2 finishes Phase A contracts and pushes.
2. Person 1 starts URDF inspection and Three.js scene in parallel.
3. Person 3 starts dashboard/control shell after `executeCommand()` exists.
4. First integration happens after Phase A push.
5. Focus on IK and autonomous PIN before polish.

```
```
