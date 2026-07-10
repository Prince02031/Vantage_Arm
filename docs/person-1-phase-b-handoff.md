# Person 1 — Phase B Handoff

**Branch:** `feat/scene-urdf`  
**Date:** 2026-07-10  
**Author:** Person 1 (Scene / URDF / Robotics Adapter)

---

## 1. URDF Load Status

| Item | Status |
|---|---|
| URDF file | `public/robot/6_dof_arm.urdf` |
| Load method | `urdf-loader` via `src/robotics/urdfRobot.js` |
| Runtime load | Async on page mount via `ThreeScene.jsx` |
| Load status | ✅ Loads successfully in browser |
| Known quirk | `joint.type` on urdf-loader objects is always `"URDFJoint"` — actual type is in `joint.jointType`. `jointDiscovery.js` is already corrected. |

---

## 2. Movable Joints

7 movable joints (all `revolute`):

| # | Name | Axis | Lower (rad) | Upper (rad) | Semantic |
|---|---|---|---|---|---|
| 1 | `joint_1`      | Z | −3.1416 | +3.1416 | Base yaw |
| 2 | `joint_2`      | Y | −2.0944 | +2.0944 | Shoulder pitch |
| 3 | `joint_3`      | Y | −2.6180 | +2.6180 | Elbow pitch |
| 4 | `joint_4`      | Z | −3.1416 | +3.1416 | Forearm roll |
| 5 | `joint_5`      | Y | −2.0944 | +2.0944 | Wrist pitch |
| 6 | `joint_6`      | Z | −3.1416 | +3.1416 | Tool roll |
| 7 | `stylus_pitch` | Y | −2.0944 | +2.0944 | Stylus pitch (extra DOF) |

> **Note for IK solver:** the last joint `stylus_pitch` is an extra Y-axis joint beyond the standard 6-DOF chain. For typical 6-DOF planning, Person 2 can hold `stylus_pitch = 0` and treat `joint_1`–`joint_6` as the manipulator chain.

---

## 3. Joint Limits Summary

Available via `adapter.getJointLimits()` — returns object `{ [name]: { lower, upper, effort, velocity } }`.

All limits are defined in the URDF `<limit>` tags. Clamping is applied automatically in `setJointAngles`.

---

## 4. End-Effector / Stylus TCP

| Item | Value |
|---|---|
| Link name | `stylus_tip` |
| Joint that positions it | `stylus_tip_frame` (fixed, +0.137 m on Z from `stylus` link) |
| Detection method | Name-pattern match in `src/robotics/endEffector.js` |
| World position source | `stylus_tip.getWorldPosition()` (Three.js scene graph) |
| **Position accuracy** | **FK only** — exact when joint angles are set correctly |
| Orientation | ❌ Not exposed yet — position only |

---

## 5. robotAdapter Method Status

Exported from `src/robotics/robotAdapter.js`, registered via `src/core/motionPipeline.js`.

To get the adapter in Person 2's code:
```js
import { getRobotAdapter } from '../core/motionPipeline.js';
const adapter = getRobotAdapter(); // null before URDF loads
```

| Method | Signature | Status | Returns when robot not loaded |
|---|---|---|---|
| `getRobot()` | `() → URDFRobot\|null` | ✅ | `null` |
| `getMovableJoints()` | `() → DiscoveredJoint[]` | ✅ | `[]` |
| `getJointLimits()` | `() → { [name]: Limits }` | ✅ | `{}` |
| `getJointAngles()` | `() → { [name]: number }` | ✅ | `{}` |
| `setJointAngles(map)` | `(map) → { set, notFound }` | ✅ | `{ set:[], notFound:[...] }` |
| `getEndEffectorPosition()` | `() → {x,y,z}` | ✅ | `{x:0,y:0,z:0}` |
| `updateTargetMarker(pos)` | `({x,y,z}) → void` | ✅ | no-op |
| `flashKey(label)` | `(string\|number) → void` | ✅ | no-op |

---

## 6. Key Panel

- **Config source:** `fetch('/config/key.config.json')` at runtime — coordinates are **never hardcoded**
- **Rendering:** six `BoxGeometry` meshes, coloured, with canvas digit labels 1–6 on top faces
- **Flash:** `adapter.flashKey("3")` triggers a 15-frame emissive pulse on the matching mesh
- **Failure mode:** if fetch fails, key panel is silently skipped (URDF still loads)

---

## 7. Scene Visual Features

| Feature | Status |
|---|---|
| Grid floor | ✅ `GridHelper(4, 40)` |
| Coordinate axes | ✅ `AxesHelper(0.15)` at origin |
| Lighting | ✅ Hemisphere + DirectionalLight (shadow-mapped) + fill |
| Orbit controls | ✅ `OrbitControls` with damping — drag to orbit, scroll to zoom |
| Stylus TCP marker | ✅ Green sphere tracks `stylus_tip` world position |
| Target marker | ✅ Cyan ring+sphere, activated by `updateTargetMarker()` |
| Scene fog | ✅ `THREE.Fog` for depth |
| Live joint dashboard | ✅ Bar + degree readout for all 7 joints |
| Live EEF display | ✅ X/Y/Z in metres |

---

## 8. Known Issues / Limitations

1. **FK only** — arm stays in default zero-pose until Person 2 drives it via `executeCommand()` / `setJointAngles()`.
2. **No orientation output** — `getEndEffectorPosition()` returns `{x,y,z}` only. If Person 2's IK needs full pose, extend `endEffector.js` with `getEndEffectorQuaternion()`.
3. **`stylus_pitch` is an 8th DOF** — treat as a tool-frame roll; for 6-DOF planning, freeze at 0.
4. **Canvas textures** — digit labels on keys require a DOM `<canvas>` element. If running in a non-browser environment (unit tests), the key label creation silently skips.

---

## 9. What Person 2 Can Assume

- **`adapter.setJointAngles(angles)`** — call with a partial map (only the joints you want to move). Clamping is automatic.
- **`adapter.getEndEffectorPosition()`** — valid FK result as long as joint angles are in range. Call after `setJointAngles`.
- **`adapter.getRobotAdapter()` can be null** — always null-check before calling adapter methods if reading from `motionPipeline.js` store.
- **Registration happens once** — after URDF loads, adapter is registered in `motionPipeline.js`. Person 2 should poll `getRobotAdapter()` or listen for the adaptor.
- **Key coordinates** — available via `adapter.getMovableJoints()` (joints), and separately via `fetch('/config/key.config.json')` if Person 2 needs them for IK target setup.

---

## 10. Self-Verification QA Audit

The following QA checklist has been executed in the browser and verified:

| # | QA Task | Status | Results / Proof |
|---|---|---|---|
| 1 | URDF loads and renders | ✅ Pass | Verified, 3D scene renders the manipulator correctly. |
| 2 | 6-key panel renders from JSON | ✅ Pass | Dynamically fetched from `/config/key.config.json` at runtime. |
| 3 | Digit labels visible on keys | ✅ Pass | 1-6 canvas textures are drawn on the top faces of the boxes. |
| 4 | robotAdapter exists + 8 methods | ✅ Pass | Fully verified on `window.robotAdapter`. |
| 5 | `setJointAngles()` changes joints | ✅ Pass | Angles are successfully mapped and clamped to physical joints. |
| 6 | `getJointAngles()` returns state | ✅ Pass | Correctly reports back matching joint radians. |
| 7 | `getMovableJoints()` accurate | ✅ Pass | Returns only the 7 active revolute joints. |
| 8 | `getJointLimits()` accurate | ✅ Pass | Matches URDF XML specs for yaw, pitch, and roll limits. |
| 9 | `getEndEffectorPosition()` stable | ✅ Pass | Calculates world relative positional vector of `stylus_tip`. |
| 10| Null-safety check before load | ✅ Pass | Return empty values (`{}`, `[]`, `null`) rather than throwing exceptions. |
| 11| Single registration check | ✅ Pass | Initialized once. Hot reload resets properly. |
| 12| No duplicate pipeline | ✅ Pass | Source files are registered strictly into Person 2's `motionPipeline.js`. |
| 13| No hardcoded key coordinates | ✅ Pass | Extracted strictly from config file. |

