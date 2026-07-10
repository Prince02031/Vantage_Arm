# Phase A Handoff — Person 2 (Motion Pipeline & Kinematics Contracts)

This document outlines the Phase A contract lock deliverables for the **Vantage_Arm** simulation suite, establishing clear API contracts for Person 1 (Visuals) and Person 3 (UI / Controls).

---

## 1. What Phase A Completed
- Standardized the Command Schema and factories in `commandTypes.js`.
- Implemented a lightweight, observable state store in `robotStore.js`.
- Implemented the central `executeCommand` pipeline entrypoint in `motionPipeline.js`.
- Implemented the mathematical bounds, PIN format, and joint limits validation in `safetyValidator.js`.
- Created the time-based trajectory runner interpolation skeleton in `trajectoryRunner.js`.
- Established the planning structure for automated key taps in `pinRunner.js`.
- Verified all contracts using a runtime smoke test suite and confirmed successful production builds.

---

## 2. Shared Command Contract

All movements must adhere to the structured formats in `src/core/commandTypes.js`. Command types are:
- `jog`: Increment/decrement Cartesian coordinate position.
- `moveTo`: Absolute translation to Cartesian coordinates.
- `pressKey`: Linear approach-touch-retreat movement targeting a specific panel key.
- `runPin`: Automated execution of a 6-digit touch sequence.
- `home`: Moves joints back to starting configuration.
- `stop`: Immediately interrupts active trajectories or PIN runners.
- `rotateJoint`: Relative rotation of a single joint.

---

## 3. The `executeCommand` API

`executeCommand(command, options)` is the **exclusive entrypoint** for motion requests. It executes in three steps:
1. **Normalization**: Assures correct properties, datatypes, and fills missing sources.
2. **Validation**: Verifies joints, reach, and floor collision limits.
3. **Execution**: Dispatches valid commands to execution runners, logging results in `robotStore.js`.

---

## 4. `robotAdapter` API Expected from Person 1 (Visualization)

Person 1 must register an adapter wrapper in Three.js by calling `registerRobotAdapter(adapter)`. The object must implement:
- `getMovableJoints()`: Returns array of string names for the joints (e.g. `['joint_1', 'joint_2']`).
- `getEndEffectorPosition()`: Returns current `{ x, y, z }` stylus tip coordinates.
- `getJointAngles()`: Returns active joint angles map `{ [name]: radians }`.
- `getJointLimits()`: Returns URDF joint limit ranges `{ [name]: { min, max } }`.
- `setJointAngles(anglesMap)`: Applies joint angles directly to the 3D visual links.
- `flashKey(keyId)`: *(Optional)* Triggers visual highlight on key presses.

---

## 5. Command Examples for Person 3 (UI / Controls)

Person 3's manual, keyboard, voice, and automated controllers must call `executeCommand` with these structures:

* **Joystick Jog step**:
  ```javascript
  executeCommand({ 
    type: "jog", 
    axis: "x", 
    delta: 0.02, 
    source: "joystick" 
  });
  ```

* **Keyboard Jog step**:
  ```javascript
  executeCommand({ 
    type: "jog", 
    axis: "z", 
    delta: 0.02, 
    source: "keyboard" 
  });
  ```

* **Voice Command Key Press**:
  ```javascript
  executeCommand({ 
    type: "pressKey", 
    key: "5", 
    source: "voice" 
  });
  ```

* **PIN Sequence Execution**:
  ```javascript
  executeCommand({ 
    type: "runPin", 
    pin: "123456", 
    source: "pin-panel" 
  });
  ```

---

## 6. Safety Rules Implemented
- **Jog Gating**: Step size delta cannot exceed $0.10\text{m}$ per command.
- **Workspace Gating**: Targets must fit within conservative boundary boxes (min Z $0.02\text{m}$ to prevent floor strikes, reach radius limits).
- **Joint limit Gating**: Joint movements are checked against URDF limit tags via `robotAdapter`.
- **PIN format**: Sequence validation enforces exactly 6 digits within numbers 1-6.

---

## 7. PIN Planning Behavior

The `runPin` planning logic in `pinRunner.js` computes a 3-dimensional trajectory path above key $(x, y, z)$ coordinates:
1. **Approach**: Hover height offset ($+5\text{cm}$) directly above key $\to$ `{ x, y, z: z + 0.05 }`
2. **Touch**: Downward movement onto the key $\to$ `{ x, y, z }`
3. **Retreat**: Upward retraction back to hover height $\to$ `{ x, y, z: z + 0.05 }`

---

## 8. What is Intentionally Not Implemented (Phase B Scope)
- **Jacobian IK Iterations**: Calculating mathematical joint angles from Cartesian targets.
- **Three.js Animation loop**: Translating requestAnimationFrame ticks to continuous physical visual coordinates.
- **Physical Collision / Self-intersection checks**: Checking for structural interference in visual links.

---

## 9. Exact Files Person 1 Should Use (Visualization)
- `src/core/robotStore.js` (Call `subscribeRobotState` to synchronize visual link coordinates, register `setRobotAdapter`)
- `src/robotics/forwardKinematics.js` (Call `getJointLimits`, `clampJointAngles`)

---

## 10. Exact Files Person 3 Should Use (Controls)
- `src/core/motionPipeline.js` (Call `executeCommand`)
- `src/core/commandTypes.js` (Use `COMMAND_TYPES`, `COMMAND_SOURCES`, and factories like `createJogCommand`)

---

## 11. Next Phase B Tasks for Person 2
1. Write the iterative Jacobian pseudo-inverse numerical solver in `ikSolver.js`.
2. Bind the trajectory animation interpolation in `trajectoryRunner.js` to visual state store writes.
3. Coordinate key configurations from `public/config/key.config.json` inside the pipeline handler.
4. Implement coordinate distance validation checks for automated PIN presses.

---

## Recommended Handoff Commit Message
```text
chore: lock shared motion pipeline contracts
```
