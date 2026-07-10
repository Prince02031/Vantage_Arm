# urdf-inspection.md

URDF inspected: `public/robot/6_dof_arm.urdf` (root copy: `6_dof_arm.urdf`).
Inspected by: `src/robotics/jointDiscovery.js` (called from `src/scene/ThreeScene.jsx`).
Updated: 2026-07-10 (Phase B — adapter ready).

---

## Summary

- **Robot name:** `stylus_arm`
- **Links:** 9 — `base_link`, `link_1`, `link_2`, `link_3`, `link_4`, `link_5`, `link_6`, `stylus`, `stylus_tip`
- **Joints:** 8 total — 7 movable (revolute) + 1 fixed TCP frame
- **Movable joints:** 7 — `joint_1` … `joint_6` + `stylus_pitch`
- **Materials declared:** `graphite`, `slate`, `amber`, `steel`, `tip_black`
- **Likely end-effector:** `stylus_tip`
  - *Reason:* name matches the TCP/tip pattern; reached via `stylus_pitch` → `stylus` → `stylus_tip_frame` (deepest in the kinematic chain, depth 8 from `base_link`).

---

## Joint table

| # | Name           | Type     | Movable | Axis (x,y,z)  | Lower (rad) | Upper (rad) | Parent      | Child         |
|---|----------------|----------|---------|---------------|-------------|-------------|-------------|---------------|
| 1 | joint_1        | revolute | yes     | 0, 0, 1       | -3.1416     | 3.1416      | base_link   | link_1        |
| 2 | joint_2        | revolute | yes     | 0, 1, 0       | -2.0944     | 2.0944      | link_1      | link_2        |
| 3 | joint_3        | revolute | yes     | 0, 1, 0       | -2.6180     | 2.6180      | link_2      | link_3        |
| 4 | joint_4        | revolute | yes     | 0, 0, 1       | -3.1416     | 3.1416      | link_3      | link_4        |
| 5 | joint_5        | revolute | yes     | 0, 1, 0       | -2.0944     | 2.0944      | link_4      | link_5        |
| 6 | joint_6        | revolute | yes     | 0, 0, 1       | -3.1416     | 3.1416      | link_5      | link_6        |
| 7 | stylus_pitch   | revolute | yes     | 0, 1, 0       | -2.0944     | 2.0944      | link_6      | stylus        |
| 8 | stylus_tip_frame | fixed  | no      | 1, 0, 0 (default) | -         | -           | stylus      | stylus_tip    |

Effort / velocity limits (from `<limit>`):

| Joint          | Effort (N·m) | Velocity (rad/s) |
|----------------|--------------|------------------|
| joint_1        | 60.0         | 2.5              |
| joint_2        | 60.0         | 2.5              |
| joint_3        | 40.0         | 3.0              |
| joint_4        | 25.0         | 3.5              |
| joint_5        | 15.0         | 4.0              |
| joint_6        | 10.0         | 4.5              |
| stylus_pitch   |  8.0         | 5.0              |

---

## Kinematic chain

```
base_link
  └── joint_1 (Z)       base yaw
      └── link_1
          └── joint_2 (Y)   shoulder pitch
              └── link_2
                  └── joint_3 (Y)   elbow pitch
                      └── link_3
                          └── joint_4 (Z)   forearm roll
                              └── link_4
                                  └── joint_5 (Y)   wrist pitch
                                      └── link_5
                                          └── joint_6 (Z)   tool roll
                                              └── link_6
                                                  └── stylus_pitch (Y)   stylus pitch
                                                      └── stylus
                                                          └── stylus_tip_frame (fixed, +0.137 on Z)
                                                              └── stylus_tip   ← end-effector / TCP
```

---

## Phase B — Robot Adapter Readiness

### Status: ✅ ADAPTER READY

`src/robotics/robotAdapter.js` exports `createRobotAdapter(ctx)` which returns an object satisfying the full adapter interface required by the motion pipeline.

### Methods implemented

| Method                     | Status | Notes |
|----------------------------|--------|-------|
| `getRobot()`               | ✅     | Returns raw urdf-loader robot object |
| `getMovableJoints()`       | ✅     | Returns `DiscoveryResult.movableJoints` (7 joints) |
| `getJointLimits()`         | ✅     | Returns map of name → `{lower, upper, effort, velocity}` from URDF |
| `getJointAngles()`         | ✅     | Reads `joint.angle` from live urdf-loader state |
| `setJointAngles(angles)`   | ✅     | Calls `joint.setJointValue(clamped)` per joint |
| `getEndEffectorPosition()` | ✅     | Reads world position of `stylus_tip` link via `THREE.Object3D.getWorldPosition` |
| `updateTargetMarker(pos)`  | ✅     | Moves the cyan ring/sphere marker in 3D space |
| `flashKey(key)`            | ✅     | Emissive pulse on the key mesh matching digit label `"1"`–`"6"` |

### Registration

`ThreeScene.jsx` calls `registerRobotAdapter(adapter)` after the URDF and key panel have loaded.
`motionPipeline.js` stores the adapter and exposes `getRobotAdapter()` for Person 2.

### End-effector detection

- **Detected link:** `stylus_tip`
- **Method:** `src/robotics/endEffector.js:getEndEffectorWorldPosition()` tries `stylus_tip` first, falls back by pattern, then origin.
- **Limitation:** Position is kinematic (FK), not physics-based. Until an IK solver is wired, the arm stays in its default pose.

### 6-Key panel

- Loaded at runtime via `fetch('/config/key.config.json')` — coordinates are **never hardcoded**.
- Digit labels 1–6 rendered as canvas textures on the top faces of each key box.
- `flashKey(keyLabel)` triggers an emissive pulse on the corresponding mesh.

### Known blockers / limitations

1. **No IK solver yet** — `setJointAngles` moves joints but no inverse kinematics is available yet (Person 2 scope). FK-only.
2. **stylus_pitch axis** — joint 7 uses Y axis (same family as J2/J3/J5), not Z. IK solver must account for this.
3. **Orientation control** — `getEndEffectorPosition` returns position only; full 6-DOF pose (quaternion) not yet exposed. Extend if needed.

---

## How to reproduce

```bash
npm install
npm run dev
```

Open http://localhost:5173/ → canvas loads URDF, key panel appears, status shows `loaded — 7 movable joints | adapter ready`. Full adapter JSON logged under `[MotionPipeline] robotAdapter registered:`.
