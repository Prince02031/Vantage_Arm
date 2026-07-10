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

## Phase C — Robot Adapter Hardening

### Status: ✅ ADAPTER HARDENED (READY FOR IK & KEYPRESS)

`src/robotics/robotAdapter.js` exports `createRobotAdapter(ctx)` which provides full programmatic access to URDF properties, geometry updates, and keyboard/key panel indicators.

### Methods implemented

| Method                     | Status | Description / Behavior |
|----------------------------|--------|------------------------|
| `getRobot()`               | ✅     | Returns raw urdf-loader robot object. |
| `getMovableJoints()`       | ✅     | Returns ordered movable joints (7 total) as string-compatible objects containing `name`, `type`, `axis`, `lower`, and `upper`. |
| `getJointLimits()`         | ✅     | Returns map of name → `{lower, upper, min, max}` from URDF. |
| `getJointAngles()`         | ✅     | Reads live `joint.angle` values from urdf-loader. |
| `setJointAngles(angles)`   | ✅     | Sets angles, clamps to limits if defined, and calls `updateMatrixWorld(true)` for immediate rendering. |
| `getEndEffectorPosition()` | ✅     | Reads exact world position of the `stylus_tip` link via matrix world transform. |
| `updateTargetMarker(pos)`  | ✅     | Moves the cyan ring/sphere target marker safely in 3D space. |
| `flashKey(key)`            | ✅     | Triggers emissive highlighting pulse on key boxes 1–6. |

### Final Movable Joint Order (7 DOF)
1. `joint_1` (revolute, Yaw)
2. `joint_2` (revolute, Shoulder Pitch)
3. `joint_3` (revolute, Elbow Pitch)
4. `joint_4` (revolute, Forearm Roll)
5. `joint_5` (revolute, Wrist Pitch)
6. `joint_6` (revolute, Tool Roll)
7. `stylus_pitch` (revolute, Stylus Pitch)

### Selected End-Effector Link
* **Link:** `stylus_tip`
* **Method:** `src/robotics/endEffector.js:getEndEffectorWorldPosition()` fetches the world transform matrices of `stylus_tip` (fallback is search pattern or robot base).

### Known blockers / limitations for IK
1. **Redundant pitch DOF**: The presence of four pitch axes (`joint_2`, `joint_3`, `joint_5`, `stylus_pitch`) means the solver must handle multiple kinematic solutions and avoid singularities.
2. **Coordinate boundaries**: The physical limits of `joint_2`, `joint_3`, `joint_5`, and `stylus_pitch` are relatively narrow (approx. $\pm 120^\circ$). If coordinates require extreme angles, the solver will clamp and fail to reach the target accurately.
3. **No orientation constraint in main IK**: Currently, the position-only IK solvers only compute X, Y, Z convergence, leaving orientation of the stylus unconstrained.

---

## How to reproduce

```bash
npm install
npm run dev
```

Open http://localhost:5173/ → canvas loads URDF, key panel appears, status shows `loaded — 7 movable joints | adapter ready`. Full adapter JSON logged under `[MotionPipeline] robotAdapter registered:`.
