# Phase A Checklist — Person 2 (Motion Pipeline & Kinematics Contracts)

This checklist tracks the Phase A progress for Person 2 (Motion Brain) of the **Vantage_Arm** simulation suite. Phase A focuses exclusively on **contract lock and interface design**, establishing the structural API for Person 1 (Visualization) and Person 3 (Controls) before full implementation logic is written.

---

## 1. Existing Project Files & Folders

The project structure has been scaffolded at the root directory:
- **`src/core/`** (State store, commands, motion execution)
  - `commandTypes.js`
  - `robotStore.js`
  - `motionPipeline.js`
  - `safetyValidator.js`
  - `trajectoryRunner.js`
  - `pinRunner.js`
- **`src/robotics/`** (Kinematics engine)
  - `urdfRobot.js`
  - `jointDiscovery.js`
  - `forwardKinematics.js`
  - `ikSolver.js`
  - `endEffector.js`
- **`public/`** (Configuration and assets)
  - `robot/6_dof_arm.urdf`
  - `config/key.config.json`
- **`docs/`**
  - `problem-analysis.md`
  - `person-2-motion-pipeline.md`

No missing directories or core files need to be created; all files required for Person 2's responsibilities have already been scaffolded.

---

## 2. Phase A Target Files & Contracts

During Phase A, we define the API boundaries in the following files:
1. **`src/core/commandTypes.js`**: Establish standard action types (e.g., `MOVE_EE`, `JOG_JOINT`, `SET_JOINTS`, `TAP_KEY`, `EXECUTE_PIN`) and their JSON schemas.
2. **`src/core/robotStore.js`**: Set up the central state management (Zustand or custom observable state) tracking current/target joint angles, current/target Cartesian coordinates, safety state, active trajectory, and status logs.
3. **`src/core/motionPipeline.js`**: Lock down the `executeCommand(command)` interface, the validation hook, and trajectory dispatch.
4. **`src/core/safetyValidator.js`**: Define the validator interface `validateMotion(currentAngles, targetAngles, targetEE)` which returns `{ valid: boolean, error: string | null }`.
5. **`src/core/trajectoryRunner.js`**: Define the trajectory generator/runner signature which receives starting/ending states and yields interpolated coordinates/angles over time.
6. **`src/core/pinRunner.js`**: Define the sequence manager contract `runPinSequence(pin, keysConfig)` to orchestrate a multi-step key-tapping run.
7. **`src/robotics/ikSolver.js`**: Define the IK solver signature `solveIK(targetPosition, targetOrientation, currentJointAngles)` returning `jointAngles` or throwing an error.
8. **`src/robotics/forwardKinematics.js`**: Define the FK signature `solveFK(jointAngles)` returning Cartesian coordinates.

---

## 3. Interfaces & Team Dependencies

### What Person 1 (Visualization / Three.js) needs from Person 2:
- **Joint Angle Subscription**: An observable state or hook in `robotStore.js` to listen for joint angle updates and apply them to the 3D URDF model.
- **Target Marker Coordinates**: Access to the current Cartesian target coordinate (from the store) to render a visual indicator (sphere) where the end-effector is attempting to move.
- **Trajectory Path**: Access to the calculated trajectory path array (list of 3D coordinates) to render the `TrajectoryLine` trace.
- **Forward Kinematics Hook**: A function `solveFK(joints)` to check coordinates against actual Three.js matrix world states for verification.

### What Person 3 (Controls / Inputs / UI) needs from Person 2:
- **Global Command Entrypoint**: `executeCommand(command)` exposed globally or via a React context to submit joint rotations or Cartesian steps.
- **Command Schemas**: A reference dictionary of supported types and structures from `commandTypes.js` so inputs can format payloads correctly.
- **Reactive Logs**: A hook/subscription to `robotStore.js`'s log array so the `StatusLog` and `SafetyPanel` components can render errors and status changes immediately.
- **Manual Input Data**: Read-only current joint angles and end-effector position to display in the `Dashboard` and `JointPanel` input sliders.

---

## 4. Risks & Blockers

- **IK Solver Convergence**: Numerical IK solvers can get stuck in local minima or fail to converge near singularities. We must define a robust solver contract with max iterations, step sizes, and fallback error handling.
- **Concurrency in Motion**: If a user jogs the joystick while an autonomous PIN sequence is running, commands might clash. The motion pipeline needs a lock-out state (`isExecutingTrajectory` or `isExecutingPin`) to reject commands during autonomous routines.
- **Validation Overhead**: The safety validator runs in the main thread. We must keep geometric and limits validation extremely fast to prevent UI stuttering at 60fps.
