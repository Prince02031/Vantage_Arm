# Person 1 Role — Scene Visualization & URDF Rendering

## Main Responsibility
Build the 3D WebGL visualization for Vantage_Arm using Three.js (or React Three Fiber) and `urdf-loader`.

## Files Owned
- `src/scene/ThreeScene.jsx`
- `src/scene/ArmModel.jsx`
- `src/scene/KeyPanel.jsx`
- `src/scene/TargetMarker.jsx`
- `src/scene/TrajectoryLine.jsx`

---

## Technical Coordination Rules for Person 1

1. **Subscribing to State Store**:
   - The 3D scene components must act as pure consumers of the robot's state. Do not update joint positions or velocities from within the Three.js render loop.
   - Subscribe to the joint angles in `src/core/robotStore.js`:
     ```js
     import { robotStore } from '../core/robotStore.js';
     
     // Listen for state changes reactively
     robotStore.subscribe((state) => {
       const angles = state.jointAngles;
       // Update Three.js URDF joint rotations here...
     });
     ```

2. **Rendering the 6-Key Panel**:
   - Read the panel coordinates dynamically from `public/config/key.config.json`. Do not hardcode button positions in `KeyPanel.jsx`.
   - Place 3D colored boxes at the $(x, y, z)$ coordinates specified in the JSON file. Ensure they match the scale unit (meters).

3. **Visual Markers**:
   - **TargetMarker.jsx**: Render a transparent sphere at `state.targetPosition` to indicate where the operator is dragging the arm or where a command has requested it to go.
   - **TrajectoryLine.jsx**: Render a segmented path using the coordinates in `state.motion.activeTrajectoryPath` to trace the planned interpolation route.

4. **URDF Joint Extraction**:
   - Once the URDF is parsed, collaborate with Person 2 to mapping joint names to their array indices $[0..5]$. Document this in `docs/urdf-inspection.md`.
