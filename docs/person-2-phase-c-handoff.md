# Person 2 — Phase C Handoff
## Branch: `feat/core-ik-keypress`

> **Generated:** 2026-07-10  
> **Author:** Person 2 (Core Robotics / Motion Pipeline)

---

## Summary

Phase C implements real motion behavior in the shared pipeline. The `executeCommand()` entrypoint now drives physical arm movement through IK solving, trajectory execution, and physical key pressing. All commands still flow through `safetyValidator` before any motion occurs.

---

## Status by Task

### ✅ `moveTo(target)` — WORKING
- **Location:** `src/core/motionPipeline.js:moveToTarget()`
- **Flow:**
  1. `adapter.updateTargetMarker(target)` — moves cyan target ring to destination
  2. `solveIK(target, adapter)` — numerical gradient descent solver
  3. `createJointTrajectory(start, end)` → `runTrajectory()` via `requestAnimationFrame`
  4. Final EE position read and logged
  5. `endEffectorPosition` updated in store
- **Logs:** approach coordinates, solver error (m), trajectory result, final distance error
- **Store updates:** `targetPosition`, `endEffectorPosition`, `safety.ikSolved`, `safety.ikError`

### ✅ `jog(axis, delta)` — WORKING
- **Location:** `src/core/motionPipeline.js` (`COMMAND_TYPES.JOG` case)
- **Flow:** Reads current EE position → builds target → validates workspace → delegates to `moveToTarget()`
- **Note:** Fully unified with `moveTo` internally — no duplicate motion logic

### ✅ `rotateJoint(jointName, deltaDeg)` — WORKING
- **Location:** `src/core/motionPipeline.js` (`COMMAND_TYPES.ROTATE_JOINT` case)
- **Flow:** Reads current angle → applies delta → clamps to URDF limits → trajectory → EE update
- **Limit aware:** reads `adapter.getJointLimits()` and uses `{min, max, lower, upper}` fields

### ✅ `pressKey(key)` — IMPLEMENTED
- **Location:** `src/core/motionPipeline.js:executePressKey()`
- **Flow:**
  1. Loads key coordinates from `localKeyConfig` (loaded by `ThreeScene.jsx` via `setKeyConfig()`)
  2. `buildKeyPressTargets(key, config)` → `{approach, touch, retreat}`
  3. `moveToTarget(approach)` — hover 5cm above key
  4. `moveToTarget(touch)` — descend to key surface
  5. Measure `distance = |actualEE − touch|` in metres
  6. Success if `distance ≤ 0.005m` (5mm tolerance)
  7. `adapter.flashKey(key)` on success
  8. `moveToTarget(retreat)` — return to hover height
  9. Update `robotStore.lastKeyPressResult`
- **Fallback:** If adapter missing, delegates to planning-only `pressKey()` for offline test compatibility

### ✅ `runPin(pin)` — SEQUENTIAL IMPLEMENTATION
- **Location:** `src/core/motionPipeline.js` (`COMMAND_TYPES.RUN_PIN` case)
- **Flow:** Loops `executePressKey()` for each digit in order; checks `isStopRequested()` between digits; updates `pinProgress` in store on each digit
- **Stop safety:** Aborts gracefully if `stopMotion()` is called mid-sequence
- **Fallback:** Returns planning result if adapter is missing (for offline smoke tests)

### ✅ Trajectory Runner — WORKING
- **Location:** `src/core/trajectoryRunner.js`
- **Method:** `requestAnimationFrame` with easeInOutCubic
- **Per frame:** `adapter.setJointAngles(interpolated)` + `adapter.getEndEffectorPosition()` → state update
- **Stop check:** Checked every frame via `isStopRequested()`
- **Post-complete:** Final EE position sync before resolving

### ✅ IK Solver — NUMERICAL GRADIENT DESCENT
- **Location:** `src/robotics/ikSolver.js:solveIK()`
- **Strategy:** Two-path solver:
  - **Method A (preferred):** Numerical gradient descent using the live visual adapter (`getEndEffectorPosition()` as feedback). Perturbs each joint by ±0.0005 rad, computes symmetric gradient, steps in negative gradient direction.
  - **Method B (fallback):** CCD (Cyclic Coordinate Descent) using the analytical forward kinematics model (`computeForwardKinematics`). Used when adapter reports zero position (not yet loaded).
- **Parameters:**
  - Max iterations: 80
  - Tolerance: 0.005m (5mm)
  - Step scale: 0.5 × 0.2
  - Joint limits: respected from `adapter.getJointLimits()`

---

## IK Strategy

### Solver Type: Numerical Jacobian-free Gradient Descent

The IK solver does **not** compute the Jacobian analytically. Instead it uses a finite-difference symmetric gradient:

```
grad[jointN] = ( err(q + δ) - err(q - δ) ) / (2δ)
```

Then updates:
```
q[jointN] -= stepSize × grad[jointN]
```

This is robust to any kinematic chain topology without requiring DH-parameter derivation, and works with the live Three.js scene as the FK oracle.

**Limitation:** Converges slowly for complex workspace geometries. For key pressing (small moves within the reachable workspace), this is acceptable.

---

## Safety Validator Improvements

- `validateJointCommand` now reads `{min, max, lower, upper}` from limit objects (dual-field compatible)
- `resetSafety`, `reset`, `halt` all bypass safety-tripped check
- `stop` is always permitted regardless of system state

---

## Store Changes

| Field | Description |
|-------|-------------|
| `targetPosition` | Current Cartesian target `{x, y, z}` |
| `endEffectorPosition` | Live EE readout after each trajectory |
| `safety.ikSolved` | Boolean result of last IK call |
| `safety.ikError` | Error distance in metres from last IK |
| `lastKeyPressResult` | `{ key, success, errorM, timestamp }` |
| `pinProgress` | `{ pin, currentIndex, pressed, failed, complete }` |
| `isMoving` | true during trajectory, false on completion |

---

## Key Config Loading

- `ThreeScene.jsx` now calls `setKeyConfig(kp.config)` immediately after loading the key panel
- This makes `localKeyConfig` available to `executePressKey()` and `validatePinAgainstConfig()` at runtime
- Offline tests use `setKeyConfig(keyConfig)` directly from `contractSmokeTest.js`

---

## Manual Test Commands (browser console)

> Paste after page loads and arm is ready (`adapter ready` status shown).

```js
// Test 1: Home
executeCommand({ type: "home", source: "test" })

// Test 2: Rotate a joint
executeCommand({ type: "rotateJoint", jointName: "joint_1", deltaDeg: 30, source: "test" })

// Test 3: Move to Cartesian target
executeCommand({ type: "moveTo", target: { x: 0.35, y: 0.1, z: 0.20 }, source: "test" })

// Test 4: Press key 5
executeCommand({ type: "pressKey", key: "5", source: "test" })

// Test 5: Jog +5cm in Z
executeCommand({ type: "jog", axis: "z", delta: 0.05, source: "test" })
```

> `executeCommand` is automatically exported on `window` when `ThreeScene.jsx` loads.

---

## Build Result

```
✓ 70 modules transformed
✓ built in 3.26s
Smoke tests: 8/8 PASS
```

---

## Known Limitations

1. **IK convergence rate:** Gradient descent with scalar step is slow for far targets (~80 iterations × 7 joints × 2 perturbations per frame). For a 5mm key press tolerance, it typically converges within 40–60 iterations for reachable poses.

2. **IK workspace boundary:** The `estimateReachability()` check uses a simple Euclidean distance cutoff (0.10m – 0.85m). Concave regions of the workspace are not modelled; some geometrically valid targets may be rejected.

3. **Orientation unconstrained:** `pressKey` only controls EE position. The stylus orientation on key contact is not controlled. For production, a 6-DOF orientation constraint would be needed.

4. **Adapter ready check:** `isAdapterReady` checks if the EE position is non-zero. If the arm is loaded at the origin, Method A falls back to Method B unnecessarily. This is an edge case only relevant at the zero-pose home position.

5. **Trajectory interruption:** If `stopMotion()` is called during `pressKey`, the arm may stop between approach and touch, leaving the stylus in mid-air. Safe recovery requires calling `home` afterward.

---

## Phase D — Next Steps for Full PIN

For Phase D (full autonomous PIN entry), the following improvements are recommended:

1. **IK warm-starting:** Pass the previous solution as the seed for the next call to reduce convergence time between sequential keys.
2. **Orientation control:** Extend `solveIK` to minimize orientation error in addition to position (full 6-DOF). Required for reliable key pressing angle.
3. **Approach height config:** Make the 5cm approach offset configurable from `key.config.json` rather than hardcoded in `pinRunner.js`.
4. **Inter-digit home:** Consider returning to a neutral (non-singularity) pose between PIN digits to avoid joint limit accumulation.
5. **Retry logic:** `executePressKey` currently returns failure on first IK miss. Add a 1-retry with perturbed seed for robustness.
6. **Visual progress bar:** Wire `pinProgress.currentIndex` to a step indicator in `PinEntryPanel.jsx`.
