# Person 2 Phase B Handoff — Kinematics, Trajectory & Safety Integration

This document outlines the Phase B deliverables, QA validation results, and API contracts for the **Vantage_Arm** motion pipeline to facilitate integration with Person 1 (Visuals/Scene) and Person 3 (UI/Controls).

---

## 1. `executeCommand` Status
The pipeline has a single public entry point: `executeCommand(command)`. All other helper methods (`executeValidatedCommand`, `stopMotion`, etc.) are internal or administrative.
* **Normalization**: The entry point always calls `normalizeCommand(command)` immediately to sanitize inputs, map types, and assign default jog steps.
* **Validation**: The pipeline always calls `validateCommand(normalized, context)` prior to routing commands for execution. 
* **Logging**: Every command transition (Received, Safety Blocked, Execution Success, Execution Error) is logged inside the observable state store (`robotStore.js`).

---

## 2. Supported Command Types

| Command Type | Payload Schema | Action |
|---|---|---|
| `stop` | `{ type: "stop", source: "keyboard" }` | Aborts active trajectories immediately. |
| `home` | `{ type: "home", source: "dashboard" }` | Resets all joints to 0 radians. |
| `rotateJoint` | `{ type: "rotateJoint", jointName: "joint_1", deltaDeg: 15.0, source: "dashboard" }` | Rotates a single named joint by a relative angle. |
| `jog` | `{ type: "jog", axis: "x", delta: 0.02, source: "keyboard" }` | Moves the end-effector step-wise in Cartesian coordinates. |
| `moveTo` | `{ type: "moveTo", target: { x: 0.5, y: -0.1, z: 0.2 }, source: "dashboard" }` | Translates the tip to an absolute Cartesian coordinate. |
| `pressKey` | `{ type: "pressKey", key: "5", source: "voice" }` | Plans coordinates for key presses. |
| `runPin` | `{ type: "runPin", pin: "123456", source: "pin-panel" }` | Plans a sequence of 6 coordinates presses. |

---

## 3. Validation Behavior (`safetyValidator.js`)
* **Out-of-Workspace Gating**: All `moveTo` coordinates and projected `jog` coordinates are validated to ensure they sit inside `WORKSPACE_BOUNDS`. Floor collisions are prevented by enforcing $z \ge 0.02\text{m}$.
* **Joint Limits**: The `rotateJoint` command validates the final joint angle against limits provided dynamically by the adapter.
* **Structure & Format**: Rejects invalid axis names (must be `x`, `y`, `z`), out-of-range steps (maximum $\pm0.10\text{m}$), incorrect PIN digits (must be exactly 6 digits, containing only 1-6), and unknown joint names.
* **LLM / Agentic Integration**: If an LLM/agentic layer is added in Phase C to parse free-form voice commands, it will output a structured command that is fed directly to `executeCommand`. This guarantees that LLM commands cannot bypass the safety gate.

---

## 4. IK Solver Status (`ikSolver.js`)
* **Visual-Adapter Gradient Descent (Primary)**: Temporarily perturbs joint angles on the 3D model, reads the resulting end-effector coordinates, computes symmetric gradients, and minimizes Cartesian error. Restores original joint angles at the end of the solve phase to prevent visual glitching.
* **Analytical CCD Fallback**: If the adapter is not ready or returns exactly $(0, 0, 0)$ coordinates (indicating the 3D scene hasn't loaded yet), the solver automatically falls back to an internal kinematics chain matrix solver.
* **Target Marker Support**: When a Cartesian command (`jog`, `moveTo`) is received, the target marker in the 3D scene is updated via `robotAdapter.setTargetMarkerPosition()` (if supported) to visual show where the stylus is heading.
* **Safe Fallback**: If a target coordinate is out of bounds or unreachable, the solver returns `solved: false` and logs a warning instead of crashing the application. Joint space commands (`home`, `rotateJoint`) continue working.

---

## 5. Trajectory Runner Status (`trajectoryRunner.js`)
* **Smoothing**: Generates trajectories with time-based `easeInOutCubic` interpolation.
* **Visual/Store Sync**: Calls `robotAdapter.setJointAngles()` at each animation frame, while concurrently updating `jointAngles` and `endEffectorPosition` in the state store.
* **Abortion**: Evaluates `isStopRequested()` on every animation frame. Trajectories abort instantly when a stop command is issued.

---

## 6. Adapter Assumptions
The registered `robotAdapter` (via `registerRobotAdapter(adapter)`) must implement:
1. `getMovableJoints()`: Returns array of active joint names.
2. `getJointAngles()`: Returns current angles map `{ joint_1: rad, ... }`.
3. `getJointLimits()`: Returns limits `{ joint_1: { min, max }, ... }`.
4. `setJointAngles(angles)`: Applies joint angles map to the 3D model.
5. `getEndEffectorPosition()`: Returns current `{ x, y, z }` stylus tip coordinates.
6. `setTargetMarkerPosition(target)`: *(Optional)* Updates the target position indicator.

---

## 7. Known Limitations & Next Phase C Priorities
* **Config Parsing Latency**: Coordinate mapping for `pressKey` and `runPin` requires coordinate data from `public/config/key.config.json` which is currently mock-fed.
* **Phase C Priorities**:
  1. Wire the fetch call to parse `key.config.json` inside the main React thread.
  2. Implement autonomous sequence looping to execute consecutive coordinate pushes.
  3. Validate final visual simulation fidelity once Person 1 mounts the canvas.
