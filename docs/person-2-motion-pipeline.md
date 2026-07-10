
---

# `docs/person-2-motion-pipeline.md`

This is your file.

```md
# Person 2 Role — Motion Pipeline, IK, Safety, and PIN Entry

## Owner

Person 2

## Main Responsibility

Build the core motion brain of Vantage_Arm.

This person owns:
- command schema
- shared motion pipeline
- safety validator
- robot state store
- IK solver
- trajectory runner
- key press routine
- autonomous PIN routine
- success/failure validation

## Why This Role Starts First

Every input method must call the same motion pipeline.

If this contract is not created first, agents may build separate joystick, keyboard, voice, and PIN movement logic. That would break the architecture.

## Files Owned

```text
src/core/commandTypes.js
src/core/robotStore.js
src/core/motionPipeline.js
src/core/safetyValidator.js
src/core/trajectoryRunner.js
src/core/pinRunner.js

src/robotics/ikSolver.js
src/robotics/forwardKinematics.js

src/components/PinEntryPanel.jsx
src/components/SafetyPanel.jsx